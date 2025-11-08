const PublishingPipelineMonitor = require('../../src/core/publishingPipelineMonitor');

// Mock all external dependencies
jest.mock('axios');
jest.mock('mongoose');
jest.mock('node-cron');
jest.mock('../../src/utils/logger');

const axios = require('axios');
const mongoose = require('mongoose');
const cron = require('node-cron');
const { logger, AuditLogger } = require('../../src/utils/logger');

describe('PublishingPipelineMonitor Integration', () => {
  let monitor;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      checkInterval: 30000,
      autoRecovery: true,
      services: {
        networkEndpoint: 'https://httpbin.org/status/200',
        validationService: 'http://localhost:3001',
        database: 'mongodb://localhost:27017/test'
      },
      alerts: []
    };

    monitor = new PublishingPipelineMonitor(mockConfig);

    // Reset mocks
    jest.clearAllMocks();

    // Mock cron schedule
    cron.schedule = jest.fn().mockReturnValue({
      stop: jest.fn()
    });

    // Mock logger methods
    logger.info = jest.fn();
    logger.warn = jest.fn();
    logger.error = jest.fn();
    AuditLogger.logHealthCheck = jest.fn();
    AuditLogger.logSystemStatus = jest.fn();
    AuditLogger.logPipelineFailure = jest.fn();
    AuditLogger.logRecoveryAttempt = jest.fn();
    AuditLogger.logRecoverySuccess = jest.fn();
    AuditLogger.logRecoveryFailure = jest.fn();
  });

  describe('start and stop monitoring', () => {
    test('should start monitoring successfully', async () => {
      // Mock healthy system
      axios.get.mockResolvedValue({ status: 200 });
      const mockConnection = {
        db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) },
        close: jest.fn()
      };
      mongoose.createConnection.mockResolvedValue(mockConnection);

      await monitor.start();

      expect(monitor.isMonitoring).toBe(true);
      expect(cron.schedule).toHaveBeenCalledWith('*/30 * * * * *', expect.any(Function));
      expect(AuditLogger.logSystemStatus).toHaveBeenCalledWith(
        true, 0, 0, expect.objectContaining({ event: 'MONITOR_STARTED' })
      );
    });

    test('should stop monitoring successfully', () => {
      monitor.monitoringJob = { stop: jest.fn() };
      monitor.isMonitoring = true;

      monitor.stop();

      expect(monitor.isMonitoring).toBe(false);
      expect(monitor.monitoringJob.stop).toHaveBeenCalled();
      expect(AuditLogger.logSystemStatus).toHaveBeenCalledWith(
        false, 0, 0, expect.objectContaining({ event: 'MONITOR_STOPPED' })
      );
    });

    test('should prevent starting when already running', async () => {
      monitor.isMonitoring = true;

      await monitor.start();

      expect(logger.warn).toHaveBeenCalledWith('Pipeline monitor is already running');
    });
  });

  describe('health check execution', () => {
    test('should perform successful health check', async () => {
      // Mock all healthy components
      axios.get.mockResolvedValue({ status: 200 });
      const mockConnection = {
        db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) },
        close: jest.fn()
      };
      mongoose.createConnection.mockResolvedValue(mockConnection);

      const result = await monitor.performHealthCheck();

      expect(result.isHealthy).toBe(true);
      expect(result.checks).toHaveLength(3);
      expect(result.failedComponents).toHaveLength(0);
      expect(AuditLogger.logSystemStatus).toHaveBeenCalledWith(
        true, 3, 0, expect.any(Object)
      );
    });

    test('should handle partial system failure', async () => {
      // Network healthy, validation fails, database healthy
      axios.get
        .mockResolvedValueOnce({ status: 200 }) // Network
        .mockRejectedValueOnce(new Error('Validation down')) // Validation health
        .mockRejectedValueOnce(new Error('Validation test failed')); // Validation basic

      const mockConnection = {
        db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) },
        close: jest.fn()
      };
      mongoose.createConnection.mockResolvedValue(mockConnection);

      const result = await monitor.performHealthCheck();

      expect(result.isHealthy).toBe(false);
      expect(result.checks).toHaveLength(3);
      expect(result.failedComponents).toHaveLength(1);
      expect(result.failedComponents[0].component).toBe('validation-service');
    });

    test('should handle complete system failure', async () => {
      // All components fail
      axios.get.mockRejectedValue(new Error('Network down'));
      mongoose.createConnection.mockRejectedValue(new Error('Database down'));

      const result = await monitor.performHealthCheck();

      expect(result.isHealthy).toBe(false);
      expect(result.checks).toHaveLength(3);
      expect(result.failedComponents).toHaveLength(3);
      expect(AuditLogger.logSystemStatus).toHaveBeenCalledWith(
        false, 3, 3, expect.any(Object)
      );
    });
  });

  describe('failure handling and recovery', () => {
    test('should trigger alerts and recovery for component failure', async () => {
      // Setup monitor
      await monitor.start();

      // Mock validation service failure, others healthy
      axios.get
        .mockResolvedValueOnce({ status: 200 }) // Network
        .mockRejectedValueOnce(new Error('Validation down')) // Validation health
        .mockRejectedValueOnce(new Error('Validation test failed')); // Validation basic

      const mockConnection = {
        db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) },
        close: jest.fn()
      };
      mongoose.createConnection.mockResolvedValue(mockConnection);

      // Mock failed recovery
      const { exec } = require('child_process');
      exec.mockImplementation((command, callback) => {
        callback(new Error('Restart failed'), '', '');
      });

      await monitor.performHealthCheck();

      // Verify failure handling
      expect(AuditLogger.logPipelineFailure).toHaveBeenCalled();
      expect(AuditLogger.logRecoveryAttempt).toHaveBeenCalled();
      expect(AuditLogger.logRecoveryFailure).toHaveBeenCalled();
    });

    test('should track consecutive failures', async () => {
      monitor.consecutiveFailures.set('validation-service', 2);

      // Mock validation failure
      axios.get
        .mockResolvedValueOnce({ status: 200 }) // Network
        .mockRejectedValueOnce(new Error('Validation down')) // Validation health
        .mockRejectedValueOnce(new Error('Validation test failed')); // Validation basic

      const mockConnection = {
        db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) },
        close: jest.fn()
      };
      mongoose.createConnection.mockResolvedValue(mockConnection);

      await monitor.performHealthCheck();

      expect(monitor.consecutiveFailures.get('validation-service')).toBe(3);
    });

    test('should reset consecutive failures on recovery', async () => {
      monitor.consecutiveFailures.set('network', 2);

      // Mock all healthy
      axios.get.mockResolvedValue({ status: 200 });
      const mockConnection = {
        db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) },
        close: jest.fn()
      };
      mongoose.createConnection.mockResolvedValue(mockConnection);

      await monitor.performHealthCheck();

      expect(monitor.consecutiveFailures.get('network')).toBeUndefined();
    });
  });

  describe('manual recovery', () => {
    test('should perform manual recovery for specific component', async () => {
      const { exec } = require('child_process');
      exec.mockImplementation((command, callback) => {
        callback(null, 'DNS flushed', '');
      });

      const result = await monitor.manualRecovery('network', 'manual-test-id');

      expect(result.success).toBe(true);
      expect(result.action).toBe('dns-refresh');
      expect(result.component).toBe('network');
      expect(AuditLogger.logRecoveryAttempt).toHaveBeenCalled();
      expect(AuditLogger.logRecoverySuccess).toHaveBeenCalled();
    });

    test('should handle invalid component in manual recovery', async () => {
      await expect(monitor.manualRecovery('invalid-component')).rejects.toThrow(
        'No recovery strategy for component: invalid-component'
      );
    });
  });

  describe('pipeline status reporting', () => {
    test('should return correct status when no checks performed', () => {
      const status = monitor.getPipelineStatus();

      expect(status.isHealthy).toBeNull();
      expect(status.status).toBe('No health checks performed yet');
      expect(status.lastChecked).toBeNull();
      expect(status.checks).toEqual([]);
    });

    test('should return comprehensive status after checks', async () => {
      // Mock mixed health status
      axios.get
        .mockResolvedValueOnce({ status: 200 }) // Network
        .mockRejectedValueOnce(new Error('Validation down')); // Validation

      const mockConnection = {
        db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) },
        close: jest.fn()
      };
      mongoose.createConnection.mockResolvedValue(mockConnection);

      await monitor.performHealthCheck();
      const status = monitor.getPipelineStatus();

      expect(status.isHealthy).toBe(false);
      expect(status.checks).toHaveLength(3);
      expect(status.failedComponents).toHaveLength(1);
      expect(status.lastChecked).toBeInstanceOf(Date);
      expect(status.recoverySuggestion).toBeDefined();
    });
  });

  describe('configuration updates', () => {
    test('should update configuration and restart monitoring', () => {
      const newConfig = {
        checkInterval: 60000,
        autoRecovery: false
      };

      monitor.isMonitoring = true;
      monitor.stop = jest.fn();
      monitor.start = jest.fn();

      monitor.updateConfig(newConfig);

      expect(monitor.config.checkInterval).toBe(60000);
      expect(monitor.config.autoRecovery).toBe(false);
      expect(monitor.stop).toHaveBeenCalled();
      expect(monitor.start).toHaveBeenCalled();
    });

    test('should not restart monitoring if not running', () => {
      monitor.isMonitoring = false;
      monitor.start = jest.fn();

      monitor.updateConfig({ checkInterval: 45000 });

      expect(monitor.start).not.toHaveBeenCalled();
    });
  });

  describe('severity determination', () => {
    test('should determine correct severity levels', () => {
      const failure1 = { component: 'network', responseTime: 5000 };
      const failure2 = { component: 'database', responseTime: 2000 };
      const failure3 = { component: 'validation-service', responseTime: 1000 };

      monitor.consecutiveFailures.set('network', 1);
      monitor.consecutiveFailures.set('database', 3);
      monitor.consecutiveFailures.set('validation-service', 2);

      expect(monitor._determineSeverity(failure1)).toBe('MEDIUM');
      expect(monitor._determineSeverity(failure2)).toBe('CRITICAL'); // Database + consecutive
      expect(monitor._determineSeverity(failure3)).toBe('HIGH'); // Consecutive >= 2
    });
  });

  describe('statistics reporting', () => {
    test('should return comprehensive statistics', () => {
      monitor.isMonitoring = true;
      monitor.lastCheckTime = new Date();
      monitor.consecutiveFailures.set('network', 2);
      monitor.consecutiveFailures.set('database', 1);

      const stats = monitor.getStats();

      expect(stats.isMonitoring).toBe(true);
      expect(stats.lastCheckTime).toBeInstanceOf(Date);
      expect(stats.consecutiveFailures).toEqual({
        'network': 2,
        'database': 1
      });
      expect(stats.config.checkInterval).toBe(30000);
    });
  });
});
