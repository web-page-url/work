const HealthChecker = require('../../src/services/healthChecker');

// Mock axios for network requests
jest.mock('axios');
const axios = require('axios');

// Mock mongoose for database connections
jest.mock('mongoose');
const mongoose = require('mongoose');

describe('HealthChecker', () => {
  let healthChecker;
  let mockConfig;

  beforeEach(() => {
    mockConfig = {
      timeout: 5000,
      retryAttempts: 2,
      services: {
        networkEndpoint: 'https://httpbin.org/status/200',
        validationService: 'http://localhost:3001',
        database: 'mongodb://localhost:27017/test'
      }
    };
    healthChecker = new HealthChecker(mockConfig);

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('checkNetworkConnectivity', () => {
    test('should return healthy status for successful network check', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        statusText: 'OK'
      });

      const result = await healthChecker.checkNetworkConnectivity(mockConfig.services.networkEndpoint);

      expect(result.isHealthy).toBe(true);
      expect(result.component).toBe('network');
      expect(result.status).toContain('OK');
      expect(result.responseTime).toBeGreaterThan(0);
      expect(result.error).toBeNull();
    });

    test('should return unhealthy status for network failure', async () => {
      axios.get.mockRejectedValue(new Error('Network timeout'));

      const result = await healthChecker.checkNetworkConnectivity('https://invalid.endpoint');

      expect(result.isHealthy).toBe(false);
      expect(result.component).toBe('network');
      expect(result.status).toContain('failed');
      expect(result.error).toContain('Network timeout');
    });

    test('should handle HTTP error responses', async () => {
      axios.get.mockResolvedValue({
        status: 500,
        statusText: 'Internal Server Error'
      });

      const result = await healthChecker.checkNetworkConnectivity(mockConfig.services.networkEndpoint);

      expect(result.isHealthy).toBe(false);
      expect(result.error).toContain('HTTP 500');
    });
  });

  describe('checkValidationService', () => {
    test('should return healthy status for successful validation service check', async () => {
      axios.get.mockResolvedValue({
        status: 200,
        data: { status: 'healthy' }
      });

      const result = await healthChecker.checkValidationService(mockConfig.services.validationService);

      expect(result.isHealthy).toBe(true);
      expect(result.component).toBe('validation-service');
      expect(result.status).toContain('healthy');
    });

    test('should fallback to basic validation test when health endpoint fails', async () => {
      // Health endpoint fails
      axios.get.mockRejectedValueOnce(new Error('404 Not Found'));
      // Basic validation succeeds
      axios.post.mockResolvedValue({
        status: 200,
        data: { valid: true }
      });

      const result = await healthChecker.checkValidationService(mockConfig.services.validationService);

      expect(result.isHealthy).toBe(true);
      expect(result.status).toContain('responding');
    });

    test('should return unhealthy when both health and basic checks fail', async () => {
      axios.get.mockRejectedValue(new Error('Connection refused'));
      axios.post.mockRejectedValue(new Error('Validation failed'));

      const result = await healthChecker.checkValidationService(mockConfig.services.validationService);

      expect(result.isHealthy).toBe(false);
      expect(result.error).toContain('unreachable');
    });
  });

  describe('checkDatabaseConnectivity', () => {
    test('should return healthy status for successful database connection', async () => {
      const mockConnection = {
        db: {
          admin: () => ({
            ping: jest.fn().mockResolvedValue({ ok: 1 })
          })
        },
        close: jest.fn()
      };

      mongoose.createConnection.mockResolvedValue(mockConnection);

      const result = await healthChecker.checkDatabaseConnectivity(mockConfig.services.database);

      expect(result.isHealthy).toBe(true);
      expect(result.component).toBe('database');
      expect(result.status).toContain('healthy');
      expect(mockConnection.close).toHaveBeenCalled();
    });

    test('should return unhealthy status for database connection failure', async () => {
      mongoose.createConnection.mockRejectedValue(new Error('Connection failed'));

      const result = await healthChecker.checkDatabaseConnectivity(mockConfig.services.database);

      expect(result.isHealthy).toBe(false);
      expect(result.component).toBe('database');
      expect(result.error).toContain('Connection failed');
    });

    test('should handle ping failure', async () => {
      const mockConnection = {
        db: {
          admin: () => ({
            ping: jest.fn().mockRejectedValue(new Error('Ping failed'))
          })
        },
        close: jest.fn()
      };

      mongoose.createConnection.mockResolvedValue(mockConnection);

      const result = await healthChecker.checkDatabaseConnectivity(mockConfig.services.database);

      expect(result.isHealthy).toBe(false);
      expect(result.error).toContain('Ping failed');
    });
  });

  describe('performFullHealthCheck', () => {
    test('should perform health checks for all components', async () => {
      // Mock successful responses
      axios.get.mockResolvedValue({ status: 200 });
      axios.post = axios.get; // Use same mock for post requests

      const mockConnection = {
        db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) },
        close: jest.fn()
      };
      mongoose.createConnection.mockResolvedValue(mockConnection);

      const results = await healthChecker.performFullHealthCheck(mockConfig.services);

      expect(results).toHaveLength(3);
      expect(results.every(r => r.isHealthy)).toBe(true);
      expect(results.map(r => r.component)).toEqual(
        expect.arrayContaining(['network', 'validation-service', 'database'])
      );
    });

    test('should handle partial failures', async () => {
      // Network succeeds, validation fails, database succeeds
      axios.get
        .mockResolvedValueOnce({ status: 200 }) // Network
        .mockRejectedValueOnce(new Error('Validation down')) // Validation health
        .mockRejectedValueOnce(new Error('Validation test failed')); // Validation basic

      const mockConnection = {
        db: { admin: () => ({ ping: jest.fn().mockResolvedValue({ ok: 1 }) }) },
        close: jest.fn()
      };
      mongoose.createConnection.mockResolvedValue(mockConnection);

      const results = await healthChecker.performFullHealthCheck(mockConfig.services);

      expect(results).toHaveLength(3);
      const healthyCount = results.filter(r => r.isHealthy).length;
      const unhealthyCount = results.filter(r => !r.isHealthy).length;

      expect(healthyCount).toBe(2); // Network and database
      expect(unhealthyCount).toBe(1); // Validation service
    });
  });

  describe('getOverallHealth', () => {
    test('should return true when all components are healthy', () => {
      const healthResults = [
        { isHealthy: true, component: 'network' },
        { isHealthy: true, component: 'validation-service' },
        { isHealthy: true, component: 'database' }
      ];

      const overall = healthChecker.getOverallHealth(healthResults);
      expect(overall).toBe(true);
    });

    test('should return false when any component is unhealthy', () => {
      const healthResults = [
        { isHealthy: true, component: 'network' },
        { isHealthy: false, component: 'validation-service' },
        { isHealthy: true, component: 'database' }
      ];

      const overall = healthChecker.getOverallHealth(healthResults);
      expect(overall).toBe(false);
    });
  });

  describe('getFailedComponents', () => {
    test('should return empty array when all components are healthy', () => {
      const healthResults = [
        { isHealthy: true, component: 'network' },
        { isHealthy: true, component: 'validation-service' }
      ];

      const failed = healthChecker.getFailedComponents(healthResults);
      expect(failed).toEqual([]);
    });

    test('should return failed components with details', () => {
      const healthResults = [
        { isHealthy: false, component: 'network', error: 'Timeout', responseTime: 5000 },
        { isHealthy: true, component: 'validation-service' },
        { isHealthy: false, component: 'database', error: 'Connection failed', responseTime: 2000 }
      ];

      const failed = healthChecker.getFailedComponents(healthResults);
      expect(failed).toHaveLength(2);
      expect(failed[0].component).toBe('network');
      expect(failed[1].component).toBe('database');
    });
  });
});
