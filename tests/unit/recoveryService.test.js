const RecoveryService = require('../../src/services/recoveryService');

// Mock child_process for system commands
jest.mock('child_process');
const { exec } = require('child_process');

// Mock axios for HTTP requests
jest.mock('axios');
const axios = require('axios');

describe('RecoveryService', () => {
  let recoveryService;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      maxRecoveryAttempts: 3,
      recoveryTimeout: 30000,
      retryDelay: 2000,
      services: {
        networkEndpoint: 'https://httpbin.org/status/200',
        validationService: 'http://localhost:3001',
        database: 'mongodb://localhost:27017/test'
      }
    };
    recoveryService = new RecoveryService(mockConfig);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('attemptRecovery', () => {
    test('should successfully recover network component', async () => {
      const failedChecks = [
        { component: 'network', error: 'Connection timeout', responseTime: 5000 }
      ];

      // Mock successful DNS flush
      exec.mockImplementation((command, callback) => {
        callback(null, 'DNS cache flushed', '');
      });

      // Mock successful health check after recovery
      const healthChecker = require('../../src/services/healthChecker');
      healthChecker.prototype.checkNetworkConnectivity = jest.fn().mockResolvedValue({
        isHealthy: true,
        component: 'network',
        status: 'Network connectivity OK',
        responseTime: 100,
        error: null,
        timestamp: new Date()
      });

      const results = await recoveryService.attemptRecovery(failedChecks, mockConfig.services);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(true);
      expect(results[0].action).toBe('dns-refresh');
      expect(results[0].component).toBe('network');
    });

    test('should handle recovery failure and generate suggestions', async () => {
      const failedChecks = [
        { component: 'validation-service', error: 'Service down', responseTime: 0 }
      ];

      // Mock failed API restart
      axios.post.mockRejectedValue(new Error('Service restart failed'));

      const results = await recoveryService.attemptRecovery(failedChecks, mockConfig.services);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].component).toBe('validation-service');
      expect(results[0].error).toContain('All validation service recovery strategies failed');
    });

    test('should recover multiple components', async () => {
      const failedChecks = [
        { component: 'network', error: 'DNS issue', responseTime: 5000 },
        { component: 'database', error: 'Connection lost', responseTime: 2000 }
      ];

      // Mock successful network recovery
      exec.mockImplementation((command, callback) => {
        callback(null, 'DNS cache flushed', '');
      });

      // Mock successful database recovery
      const mongoose = require('mongoose');
      mongoose.disconnect = jest.fn().mockResolvedValue();
      mongoose.connect = jest.fn().mockResolvedValue();

      const results = await recoveryService.attemptRecovery(failedChecks, mockConfig.services);

      expect(results).toHaveLength(2);
      expect(results.some(r => r.component === 'network' && r.success)).toBe(true);
      expect(results.some(r => r.component === 'database' && r.success)).toBe(true);
    });
  });

  describe('_recoverNetwork', () => {
    test('should attempt DNS refresh strategy', async () => {
      exec.mockImplementation((command, callback) => {
        callback(null, 'DNS cache flushed', '');
      });

      const result = await recoveryService._recoverNetwork(mockConfig.services.networkEndpoint, 'test-id');

      expect(result.success).toBe(true);
      expect(result.action).toBe('dns-refresh');
      expect(exec).toHaveBeenCalledWith('ipconfig /flushdns', expect.any(Function));
    });

    test('should fallback to manual intervention when DNS refresh fails', async () => {
      exec.mockImplementation((command, callback) => {
        callback(new Error('Command failed'), '', 'Access denied');
      });

      const result = await recoveryService._recoverNetwork(mockConfig.services.networkEndpoint, 'test-id');

      expect(result.success).toBe(false);
      expect(result.action).toBe('network-reset');
      expect(result.error).toContain('Network issues require manual intervention');
      expect(result.details.manualSteps).toBeDefined();
    });
  });

  describe('_recoverValidationService', () => {
    test('should attempt API-based service restart', async () => {
      axios.post.mockResolvedValue({ status: 200, data: { restarted: true } });

      const result = await recoveryService._recoverValidationService(mockConfig.services.validationService, 'test-id');

      expect(result.success).toBe(true);
      expect(result.action).toBe('service-restart');
      expect(axios.post).toHaveBeenCalledWith(
        `${mockConfig.services.validationService}/admin/restart`,
        {},
        expect.objectContaining({
          timeout: expect.any(Number),
          headers: expect.objectContaining({
            'Authorization': expect.stringContaining('Bearer')
          })
        })
      );
    });

    test('should fallback to process restart when API restart fails', async () => {
      axios.post.mockRejectedValue(new Error('API not available'));

      const result = await recoveryService._recoverValidationService(mockConfig.services.validationService, 'test-id');

      expect(result.success).toBe(false);
      expect(result.action).toBe('process-restart');
      expect(result.error).toContain('Process restart requires manual intervention');
      expect(result.details.manualSteps).toBeDefined();
    });
  });

  describe('_recoverDatabase', () => {
    test('should attempt connection pool refresh', async () => {
      const mongoose = require('mongoose');
      mongoose.disconnect = jest.fn().mockResolvedValue();
      mongoose.connect = jest.fn().mockResolvedValue();

      const result = await recoveryService._recoverDatabase(mockConfig.services.database, 'test-id');

      expect(result.success).toBe(true);
      expect(result.action).toBe('connection-refresh');
      expect(mongoose.disconnect).toHaveBeenCalled();
      expect(mongoose.connect).toHaveBeenCalledWith(mockConfig.services.database, expect.any(Object));
    });

    test('should fallback to manual intervention when connection refresh fails', async () => {
      const mongoose = require('mongoose');
      mongoose.disconnect = jest.fn().mockRejectedValue(new Error('Disconnect failed'));

      const result = await recoveryService._recoverDatabase(mockConfig.services.database, 'test-id');

      expect(result.success).toBe(false);
      expect(result.action).toBe('database-restart');
      expect(result.error).toContain('Database recovery requires manual intervention');
      expect(result.details.manualSteps).toBeDefined();
    });
  });

  describe('generateRecoverySuggestions', () => {
    test('should generate suggestions for failed recoveries', () => {
      const failedRecoveries = [
        {
          component: 'network',
          success: false,
          error: 'Recovery failed',
          action: 'network-reset'
        },
        {
          component: 'database',
          success: false,
          error: 'Connection failed',
          action: 'database-restart'
        }
      ];

      const suggestions = recoveryService.generateRecoverySuggestions(failedRecoveries);

      expect(suggestions).toHaveLength(2);
      expect(suggestions[0].component).toBe('network');
      expect(suggestions[0].priority).toBe('medium');
      expect(suggestions[0].canAutoRecover).toBe(false);
      expect(suggestions[0].manualSteps).toBeDefined();

      expect(suggestions[1].component).toBe('database');
      expect(suggestions[1].priority).toBe('high');
    });
  });

  describe('recovery history tracking', () => {
    test('should track successful recoveries', () => {
      recoveryService.recordRecoverySuccess('network', 'attempt-1');

      const history = recoveryService.getRecoveryAttempts('network');
      expect(history).toHaveLength(1);
      expect(history[0].success).toBe(true);
      expect(history[0].attemptId).toBe('attempt-1');
    });

    test('should track failed recoveries', () => {
      recoveryService.recordRecoveryFailure('database', 'attempt-2', 'Connection timeout');

      const history = recoveryService.getRecoveryAttempts('database');
      expect(history).toHaveLength(1);
      expect(history[0].success).toBe(false);
      expect(history[0].error).toBe('Connection timeout');
    });

    test('should limit history to last 10 attempts', () => {
      for (let i = 0; i < 12; i++) {
        recoveryService.recordRecoverySuccess('network', `attempt-${i}`);
      }

      const history = recoveryService.getRecoveryAttempts('network');
      expect(history).toHaveLength(10);
    });
  });

  describe('_executeRecoveryAction', () => {
    test('should execute recovery action with timeout', async () => {
      const actionFn = jest.fn().mockResolvedValue({ success: true });

      const result = await recoveryService._executeRecoveryAction('test-action', actionFn);

      expect(result.success).toBe(true);
      expect(actionFn).toHaveBeenCalled();
    });

    test('should timeout long-running actions', async () => {
      const actionFn = jest.fn().mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 35000))
      );

      recoveryService.config.recoveryTimeout = 1000; // Short timeout for test

      await expect(
        recoveryService._executeRecoveryAction('slow-action', actionFn)
      ).rejects.toThrow('test-action timed out');
    });
  });
});
