const axios = require('axios');
const mongoose = require('mongoose');
const { logger, AuditLogger } = require('../utils/logger');

/**
 * Health Checker Service - Performs health checks on pipeline components
 */
class HealthChecker {
  constructor(config = {}) {
    this.config = {
      timeout: config.timeout || 5000,
      retryAttempts: config.retryAttempts || 2,
      retryDelay: config.retryDelay || 1000,
      ...config
    };
  }

  /**
   * Perform comprehensive health check on all components
   * @param {Object} services - Service endpoints configuration
   * @returns {Array} Array of health check results
   */
  async performFullHealthCheck(services) {
    const checks = [
      this.checkNetworkConnectivity(services.networkEndpoint),
      this.checkValidationService(services.validationService),
      this.checkDatabaseConnectivity(services.database)
    ];

    const results = await Promise.allSettled(checks);

    const healthResults = results.map((result, index) => {
      const componentName = ['network', 'validation-service', 'database'][index];

      if (result.status === 'fulfilled') {
        return result.value;
      } else {
        // Handle failed promises
        return {
          isHealthy: false,
          component: componentName,
          status: 'Check failed',
          responseTime: 0,
          error: result.reason.message,
          timestamp: new Date()
        };
      }
    });

    // Log all results
    healthResults.forEach(result => {
      AuditLogger.logHealthCheck(result.component, result);
    });

    return healthResults;
  }

  /**
   * Check network connectivity
   * @param {string} endpoint - Network endpoint to check
   * @returns {Promise<Object>} Health check result
   */
  async checkNetworkConnectivity(endpoint) {
    const startTime = Date.now();

    try {
      if (!endpoint) {
        throw new Error('Network endpoint not configured');
      }

      const response = await axios.get(endpoint, {
        timeout: this.config.timeout,
        headers: {
          'User-Agent': 'PublishingPipelineMonitor/1.0'
        }
      });

      const responseTime = Date.now() - startTime;

      if (response.status >= 200 && response.status < 300) {
        return {
          isHealthy: true,
          component: 'network',
          status: 'Network connectivity OK',
          responseTime,
          error: null,
          timestamp: new Date()
        };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        isHealthy: false,
        component: 'network',
        status: 'Network connectivity failed',
        responseTime,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check validation service health
   * @param {string} serviceUrl - Validation service URL
   * @returns {Promise<Object>} Health check result
   */
  async checkValidationService(serviceUrl) {
    const startTime = Date.now();

    try {
      if (!serviceUrl) {
        throw new Error('Validation service URL not configured');
      }

      // Try to hit a health endpoint or basic validation endpoint
      const healthUrl = serviceUrl.endsWith('/health') ? serviceUrl : `${serviceUrl}/health`;

      const response = await axios.get(healthUrl, {
        timeout: this.config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'PublishingPipelineMonitor/1.0'
        }
      });

      const responseTime = Date.now() - startTime;

      if (response.status >= 200 && response.status < 300) {
        return {
          isHealthy: true,
          component: 'validation-service',
          status: 'Validation service healthy',
          responseTime,
          error: null,
          timestamp: new Date()
        };
      } else {
        throw new Error(`Validation service returned ${response.status}`);
      }

    } catch (error) {
      const responseTime = Date.now() - startTime;

      // If health endpoint fails, try a basic validation test
      if (error.response?.status !== 404) {
        return await this._testValidationServiceBasic(serviceUrl, responseTime);
      }

      return {
        isHealthy: false,
        component: 'validation-service',
        status: 'Validation service unreachable',
        responseTime,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Basic validation service test when health endpoint is not available
   */
  async _testValidationServiceBasic(serviceUrl, responseTime) {
    try {
      // Try a simple validation request
      const testPayload = {
        title: 'Test Article',
        content: 'Test content for validation',
        author: 'Test Author'
      };

      const response = await axios.post(`${serviceUrl}/validate`, testPayload, {
        timeout: this.config.timeout,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return {
        isHealthy: true,
        component: 'validation-service',
        status: 'Validation service responding',
        responseTime,
        error: null,
        timestamp: new Date()
      };

    } catch (error) {
      return {
        isHealthy: false,
        component: 'validation-service',
        status: 'Validation service test failed',
        responseTime,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check database connectivity
   * @param {string} connectionString - Database connection string
   * @returns {Promise<Object>} Health check result
   */
  async checkDatabaseConnectivity(connectionString) {
    const startTime = Date.now();

    try {
      if (!connectionString) {
        throw new Error('Database connection string not configured');
      }

      // For MongoDB (assuming mongoose)
      if (connectionString.includes('mongodb')) {
        const connection = await mongoose.createConnection(connectionString, {
          serverSelectionTimeoutMS: this.config.timeout,
          connectTimeoutMS: this.config.timeout,
        });

        // Test basic database operation
        await connection.db.admin().ping();
        const responseTime = Date.now() - startTime;

        // Close the test connection
        await connection.close();

        return {
          isHealthy: true,
          component: 'database',
          status: 'Database connection healthy',
          responseTime,
          error: null,
          timestamp: new Date()
        };
      }

      // For other database types, add implementations here
      throw new Error('Unsupported database type');

    } catch (error) {
      const responseTime = Date.now() - startTime;

      return {
        isHealthy: false,
        component: 'database',
        status: 'Database connection failed',
        responseTime,
        error: error.message,
        timestamp: new Date()
      };
    }
  }

  /**
   * Check specific component health
   * @param {string} component - Component name
   * @param {Object} services - Service configuration
   * @returns {Promise<Object>} Health check result
   */
  async checkComponent(component, services) {
    switch (component) {
      case 'network':
        return await this.checkNetworkConnectivity(services.networkEndpoint);
      case 'validation-service':
        return await this.checkValidationService(services.validationService);
      case 'database':
        return await this.checkDatabaseConnectivity(services.database);
      default:
        throw new Error(`Unknown component: ${component}`);
    }
  }

  /**
   * Get overall health status from individual checks
   * @param {Array} healthResults - Individual health check results
   * @returns {boolean} Overall health status
   */
  getOverallHealth(healthResults) {
    return healthResults.every(result => result.isHealthy);
  }

  /**
   * Get summary of failed components
   * @param {Array} healthResults - Individual health check results
   * @returns {Array} List of failed components
   */
  getFailedComponents(healthResults) {
    return healthResults
      .filter(result => !result.isHealthy)
      .map(result => ({
        component: result.component,
        error: result.error,
        responseTime: result.responseTime
      }));
  }
}

module.exports = HealthChecker;
