const { v4: uuidv4 } = require('uuid');
const { logger, AuditLogger } = require('../utils/logger');
const HealthChecker = require('./healthChecker');

/**
 * Recovery Service - Handles automatic recovery of failed pipeline components
 */
class RecoveryService {
  constructor(config = {}) {
    this.config = {
      maxRecoveryAttempts: config.maxRecoveryAttempts || 3,
      recoveryTimeout: config.recoveryTimeout || 30000,
      retryDelay: config.retryDelay || 2000,
      retryStrategy: config.retryStrategy || 'fixed', // 'fixed', 'exponential', 'linear'
      maxRetryDelay: config.maxRetryDelay || 30000,
      ...config
    };

    this.healthChecker = new HealthChecker(config);
    this.recoveryHistory = new Map(); // Track recovery attempts
  }

  /**
   * Attempt to recover failed components
   * @param {Array} failedChecks - Array of failed health check results
   * @param {Object} services - Service configuration
   * @returns {Array} Recovery results
   */
  async attemptRecovery(failedChecks, services) {
    const recoveryPromises = failedChecks.map(async (failedCheck) => {
      const attemptId = uuidv4();
      const component = failedCheck.component;

      try {
        AuditLogger.logRecoveryAttempt(component, 'auto-recovery', attemptId, {
          failureReason: failedCheck.error,
          previousAttempts: this.getRecoveryAttempts(component)
        });

        const startTime = Date.now();
        const result = await this._recoverComponent(component, services, attemptId);
        const duration = Date.now() - startTime;

        if (result.success) {
          AuditLogger.logRecoverySuccess(component, result.action, attemptId, duration, result.details);
          this.recordRecoverySuccess(component, attemptId);
        } else {
          AuditLogger.logRecoveryFailure(component, result.action, attemptId, result.error, duration, result.details);
          this.recordRecoveryFailure(component, attemptId, result.error);
        }

        return {
          component,
          attemptId,
          success: result.success,
          action: result.action,
          error: result.error,
          duration,
          details: result.details
        };

      } catch (error) {
        const duration = Date.now() - startTime;
        AuditLogger.logRecoveryFailure(component, 'auto-recovery', attemptId, error.message, duration, {
          failureReason: failedCheck.error
        });

        this.recordRecoveryFailure(component, attemptId, error.message);

        return {
          component,
          attemptId,
          success: false,
          action: 'auto-recovery',
          error: error.message,
          duration,
          details: { failureReason: failedCheck.error }
        };
      }
    });

    return await Promise.all(recoveryPromises);
  }

  /**
   * Recover specific component based on its type
   */
  async _recoverComponent(component, services, attemptId) {
    switch (component) {
      case 'network':
        return await this._recoverNetwork(services.networkEndpoint, attemptId);
      case 'validation-service':
        return await this._recoverValidationService(services.validationService, attemptId);
      case 'database':
        return await this._recoverDatabase(services.database, attemptId);
      default:
        throw new Error(`No recovery strategy for component: ${component}`);
    }
  }

  /**
   * Network recovery strategies
   */
  async _recoverNetwork(endpoint, attemptId) {
    // Strategy 1: DNS refresh
    try {
      await this._executeRecoveryAction('dns-refresh', async () => {
        // Clear DNS cache (platform dependent)
        if (process.platform === 'win32') {
          // Windows DNS flush
          const { exec } = require('child_process');
          await new Promise((resolve, reject) => {
            exec('ipconfig /flushdns', (error) => {
              if (error) reject(error);
              else resolve();
            });
          });
        }
        return { success: true };
      });

      // Verify recovery
      const healthCheck = await this.healthChecker.checkNetworkConnectivity(endpoint);
      if (healthCheck.isHealthy) {
        return {
          success: true,
          action: 'dns-refresh',
          details: { strategy: 'DNS cache flush' }
        };
      }
    } catch (error) {
      logger.warn('DNS refresh recovery failed', { attemptId, error: error.message });
    }

    // Strategy 2: Network interface reset (if available)
    try {
      // This would typically involve system-level network resets
      // For now, we'll simulate and suggest manual intervention
      logger.info('Network recovery requires manual intervention', { attemptId });

      return {
        success: false,
        action: 'network-reset',
        error: 'Network issues require manual intervention',
        details: {
          suggestion: 'Check network connectivity, router, and DNS settings',
          manualSteps: [
            'Restart network interface',
            'Check router connectivity',
            'Verify DNS configuration',
            'Contact network administrator'
          ]
        }
      };
    } catch (error) {
      return {
        success: false,
        action: 'network-recovery',
        error: 'All network recovery strategies failed',
        details: { strategiesAttempted: ['dns-refresh', 'network-reset'] }
      };
    }
  }

  /**
   * Validation service recovery strategies
   */
  async _recoverValidationService(serviceUrl, attemptId) {
    // Strategy 1: Service restart
    try {
      await this._executeRecoveryAction('service-restart', async () => {
        // Attempt to restart validation service via API
        const axios = require('axios');
        const restartUrl = `${serviceUrl}/admin/restart`;

        const response = await axios.post(restartUrl, {}, {
          timeout: 10000,
          headers: {
            'Authorization': `Bearer ${process.env.VALIDATION_SERVICE_TOKEN || 'admin-token'}`
          }
        });

        if (response.status === 200) {
          // Wait for service to restart
          await this._delay(5000);
          return { success: true };
        }
        throw new Error(`Restart failed with status ${response.status}`);
      });

      // Verify recovery
      const healthCheck = await this.healthChecker.checkValidationService(serviceUrl);
      if (healthCheck.isHealthy) {
        return {
          success: true,
          action: 'service-restart',
          details: { strategy: 'API-based service restart' }
        };
      }
    } catch (error) {
      logger.warn('Service restart recovery failed', { attemptId, error: error.message });
    }

    // Strategy 2: Process restart (if we have process management)
    try {
      // This would integrate with PM2, Docker, or system process manager
      logger.info('Attempting process-level restart', { attemptId });

      return {
        success: false,
        action: 'process-restart',
        error: 'Process restart requires manual intervention',
        details: {
          suggestion: 'Restart validation service process',
          manualSteps: [
            'Check service logs for errors',
            'Restart validation service container/process',
            'Verify service dependencies',
            'Contact development team if persists'
          ]
        }
      };
    } catch (error) {
      return {
        success: false,
        action: 'validation-service-recovery',
        error: 'All validation service recovery strategies failed',
        details: { strategiesAttempted: ['service-restart', 'process-restart'] }
      };
    }
  }

  /**
   * Database recovery strategies
   */
  async _recoverDatabase(connectionString, attemptId) {
    // Strategy 1: Connection pool refresh
    try {
      await this._executeRecoveryAction('connection-refresh', async () => {
        const mongoose = require('mongoose');

        // Close existing connections and reconnect
        await mongoose.disconnect();
        await mongoose.connect(connectionString, {
          serverSelectionTimeoutMS: 5000,
          maxPoolSize: 10,
          serverSelectionTimeoutMS: 5000
        });

        return { success: true };
      });

      // Verify recovery
      const healthCheck = await this.healthChecker.checkDatabaseConnectivity(connectionString);
      if (healthCheck.isHealthy) {
        return {
          success: true,
          action: 'connection-refresh',
          details: { strategy: 'Database connection pool refresh' }
        };
      }
    } catch (error) {
      logger.warn('Connection refresh recovery failed', { attemptId, error: error.message });
    }

    // Strategy 2: Database server restart (if available)
    try {
      logger.info('Attempting database server recovery', { attemptId });

      return {
        success: false,
        action: 'database-restart',
        error: 'Database recovery requires manual intervention',
        details: {
          suggestion: 'Check database server status and connectivity',
          manualSteps: [
            'Check database server logs',
            'Verify database server is running',
            'Check network connectivity to database',
            'Restart database service if necessary',
            'Contact database administrator'
          ]
        }
      };
    } catch (error) {
      return {
        success: false,
        action: 'database-recovery',
        error: 'All database recovery strategies failed',
        details: { strategiesAttempted: ['connection-refresh', 'database-restart'] }
      };
    }
  }

  /**
   * Execute a recovery action with timeout, retry strategy, and error handling
   */
  async _executeRecoveryAction(actionName, actionFn, attemptNumber = 1) {
    const maxAttempts = this.config.maxRecoveryAttempts;

    for (let attempt = attemptNumber; attempt <= maxAttempts; attempt++) {
      try {
        logger.debug(`Executing recovery action ${actionName} (attempt ${attempt}/${maxAttempts})`);

        const result = await Promise.race([
          actionFn(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`${actionName} timed out`)), this.config.recoveryTimeout)
          )
        ]);

        return result;

      } catch (error) {
        logger.warn(`Recovery action ${actionName} failed (attempt ${attempt}/${maxAttempts})`, {
          error: error.message,
          attempt,
          maxAttempts
        });

        if (attempt < maxAttempts) {
          // Calculate delay based on retry strategy
          const delay = this._calculateRetryDelay(attempt);
          logger.info(`Waiting ${delay}ms before retry...`);
          await this._delay(delay);
        } else {
          // All attempts failed
          throw new Error(`${actionName} failed after ${maxAttempts} attempts: ${error.message}`);
        }
      }
    }
  }

  /**
   * Calculate retry delay based on configured strategy
   */
  _calculateRetryDelay(attemptNumber) {
    const baseDelay = this.config.retryDelay;

    switch (this.config.retryStrategy.toLowerCase()) {
      case 'exponential':
        // Exponential backoff: delay * 2^(attempt-1)
        const exponentialDelay = baseDelay * Math.pow(2, attemptNumber - 1);
        return Math.min(exponentialDelay, this.config.maxRetryDelay);

      case 'linear':
        // Linear increase: delay * attempt
        const linearDelay = baseDelay * attemptNumber;
        return Math.min(linearDelay, this.config.maxRetryDelay);

      case 'fixed':
      default:
        // Fixed delay
        return baseDelay;
    }
  }

  /**
   * Get recovery history for a component
   */
  getRecoveryAttempts(component) {
    return this.recoveryHistory.get(component) || [];
  }

  /**
   * Record successful recovery
   */
  recordRecoverySuccess(component, attemptId) {
    const history = this.recoveryHistory.get(component) || [];
    history.push({
      attemptId,
      timestamp: new Date(),
      success: true
    });

    // Keep only last 10 attempts
    if (history.length > 10) {
      history.shift();
    }

    this.recoveryHistory.set(component, history);
  }

  /**
   * Record failed recovery
   */
  recordRecoveryFailure(component, attemptId, error) {
    const history = this.recoveryHistory.get(component) || [];
    history.push({
      attemptId,
      timestamp: new Date(),
      success: false,
      error
    });

    // Keep only last 10 attempts
    if (history.length > 10) {
      history.shift();
    }

    this.recoveryHistory.set(component, history);
  }

  /**
   * Generate recovery suggestions for failed recoveries
   */
  generateRecoverySuggestions(failedRecoveries) {
    return failedRecoveries.map(failure => ({
      component: failure.component,
      suggestion: failure.details?.suggestion || 'Manual intervention required',
      priority: this._getRecoveryPriority(failure.component),
      canAutoRecover: false,
      manualSteps: failure.details?.manualSteps || ['Contact system administrator'],
      nextSteps: this._getNextSteps(failure.component)
    }));
  }

  /**
   * Get recovery priority for component
   */
  _getRecoveryPriority(component) {
    const priorities = {
      'database': 'high',
      'validation-service': 'high',
      'network': 'medium'
    };
    return priorities[component] || 'medium';
  }

  /**
   * Get next steps for failed component
   */
  _getNextSteps(component) {
    const nextSteps = {
      'database': [
        'Check database server status',
        'Review database connection logs',
        'Verify database credentials',
        'Contact DBA team'
      ],
      'validation-service': [
        'Check validation service logs',
        'Verify service dependencies',
        'Review recent deployments',
        'Contact development team'
      ],
      'network': [
        'Check network connectivity',
        'Verify DNS resolution',
        'Check firewall rules',
        'Contact network team'
      ]
    };
    return nextSteps[component] || ['Contact system administrator'];
  }

  /**
   * Utility method for delays
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = RecoveryService;
