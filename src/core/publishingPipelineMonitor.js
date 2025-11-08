const cron = require('node-cron');
const { v4: uuidv4 } = require('uuid');

const HealthChecker = require('../services/healthChecker');
const AlertService = require('../services/alertService');
const RecoveryService = require('../services/recoveryService');
const { logger, AuditLogger } = require('../utils/logger');

/**
 * Publishing Pipeline Monitor - Main orchestrator for pipeline health monitoring
 */
class PublishingPipelineMonitor {
  constructor(config = {}) {
    this.config = {
      checkInterval: config.checkInterval || 30000, // 30 seconds
      enabled: config.enabled !== false,
      autoRecovery: config.autoRecovery !== false,
      ...config
    };

    // Initialize services
    this.healthChecker = new HealthChecker(this.config);
    this.alertService = new AlertService(this.config);
    this.recoveryService = new RecoveryService(this.config);

    // State management
    this.isMonitoring = false;
    this.lastCheckResults = null;
    this.lastCheckTime = null;
    this.consecutiveFailures = new Map();
    this.monitoringJob = null;

    // Bind methods
    this.performHealthCheck = this.performHealthCheck.bind(this);
    this.handlePipelineFailure = this.handlePipelineFailure.bind(this);
  }

  /**
   * Start monitoring the publishing pipeline
   */
  async start() {
    if (this.isMonitoring) {
      logger.warn('Pipeline monitor is already running');
      return;
    }

    logger.info('Starting publishing pipeline monitor', {
      checkInterval: this.config.checkInterval,
      autoRecovery: this.config.autoRecovery
    });

    this.isMonitoring = true;

    // Perform initial health check
    await this.performHealthCheck();

    // Schedule regular health checks
    this.monitoringJob = cron.schedule(`*/${Math.floor(this.config.checkInterval / 1000)} * * * * *`, async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        logger.error('Scheduled health check failed', { error: error.message });
      }
    });

    AuditLogger.logSystemStatus(true, 0, 0, {
      event: 'MONITOR_STARTED',
      checkInterval: this.config.checkInterval
    });
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isMonitoring) {
      logger.warn('Pipeline monitor is not running');
      return;
    }

    logger.info('Stopping publishing pipeline monitor');

    if (this.monitoringJob) {
      this.monitoringJob.stop();
      this.monitoringJob = null;
    }

    this.isMonitoring = false;
    this.lastCheckResults = null;
    this.lastCheckTime = null;

    AuditLogger.logSystemStatus(false, 0, 0, {
      event: 'MONITOR_STOPPED'
    });
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    const checkId = uuidv4();
    const startTime = Date.now();

    try {
      logger.debug('Performing pipeline health check', { checkId });

      const healthResults = await this.healthChecker.performFullHealthCheck(this.config.services);
      const overallHealth = this.healthChecker.getOverallHealth(healthResults);
      const failedComponents = this.healthChecker.getFailedComponents(healthResults);

      this.lastCheckResults = healthResults;
      this.lastCheckTime = new Date();

      // Log overall system status
      AuditLogger.logSystemStatus(
        overallHealth,
        healthResults.length,
        failedComponents.length,
        {
          checkId,
          duration: Date.now() - startTime,
          failedComponents: failedComponents.map(fc => fc.component)
        }
      );

      if (!overallHealth) {
        await this.handlePipelineFailure(failedComponents, checkId);
      } else {
        // Reset consecutive failure counters on success
        failedComponents.forEach(fc => {
          this.consecutiveFailures.delete(fc.component);
        });
      }

      return {
        isHealthy: overallHealth,
        checks: healthResults,
        failedComponents,
        checkId,
        timestamp: this.lastCheckTime
      };

    } catch (error) {
      logger.error('Health check failed completely', {
        checkId,
        error: error.message,
        stack: error.stack
      });

      AuditLogger.logSystemStatus(false, 0, 0, {
        checkId,
        error: error.message,
        event: 'HEALTH_CHECK_ERROR'
      });

      throw error;
    }
  }

  /**
   * Handle pipeline failure scenario
   */
  async handlePipelineFailure(failedComponents, checkId) {
    logger.warn('Pipeline failure detected', {
      checkId,
      failedComponents: failedComponents.map(fc => fc.component),
      failureCount: failedComponents.length
    });

    // Update consecutive failure counters
    failedComponents.forEach(failure => {
      const component = failure.component;
      const current = this.consecutiveFailures.get(component) || 0;
      this.consecutiveFailures.set(component, current + 1);
    });

    // Send alerts for failures
    for (const failure of failedComponents) {
      try {
        await this.alertService.sendAlert(
          failure.component,
          `Component health check failed: ${failure.error}`,
          {
            checkId,
            error: failure.error,
            responseTime: failure.responseTime,
            consecutiveFailures: this.consecutiveFailures.get(failure.component),
            severity: this._determineSeverity(failure)
          }
        );

        AuditLogger.logPipelineFailure(failure.component, failure.error, {
          checkId,
          consecutiveFailures: this.consecutiveFailures.get(failure.component)
        });

      } catch (alertError) {
        logger.error('Failed to send alert', {
          component: failure.component,
          alertError: alertError.message
        });
      }
    }

    // Attempt auto-recovery if enabled
    if (this.config.autoRecovery) {
      await this.attemptRecovery(failedComponents, checkId);
    }
  }

  /**
   * Attempt automatic recovery of failed components
   */
  async attemptRecovery(failedComponents, checkId) {
    try {
      logger.info('Attempting automatic recovery', {
        checkId,
        components: failedComponents.map(fc => fc.component)
      });

      const recoveryResults = await this.recoveryService.attemptRecovery(failedComponents, this.config.services);

      // Check which recoveries succeeded
      const successfulRecoveries = recoveryResults.filter(result => result.success);
      const failedRecoveries = recoveryResults.filter(result => !result.success);

      if (successfulRecoveries.length > 0) {
        logger.info('Some recoveries succeeded', {
          checkId,
          successful: successfulRecoveries.map(r => r.component),
          failed: failedRecoveries.map(r => r.component)
        });
      }

      if (failedRecoveries.length > 0) {
        logger.warn('Some recoveries failed - manual intervention required', {
          checkId,
          failedComponents: failedRecoveries.map(r => r.component)
        });

        // Send alerts for failed recoveries
        const recoverySuggestions = this.recoveryService.generateRecoverySuggestions(failedRecoveries);

        for (const suggestion of recoverySuggestions) {
          await this.alertService.sendAlert(
            suggestion.component,
            `Auto-recovery failed: ${suggestion.suggestion}`,
            {
              checkId,
              priority: suggestion.priority,
              manualSteps: suggestion.manualSteps,
              nextSteps: suggestion.nextSteps,
              severity: 'HIGH'
            }
          );
        }
      }

      return {
        successfulRecoveries,
        failedRecoveries,
        suggestions: failedRecoveries.length > 0 ?
          this.recoveryService.generateRecoverySuggestions(failedRecoveries) : []
      };

    } catch (error) {
      logger.error('Auto-recovery process failed', {
        checkId,
        error: error.message
      });

      // Send critical alert for recovery system failure
      await this.alertService.sendAlert(
        'recovery-system',
        'Auto-recovery system failed to execute',
        {
          checkId,
          error: error.message,
          severity: 'CRITICAL'
        }
      );

      throw error;
    }
  }

  /**
   * Get current pipeline status
   */
  getPipelineStatus() {
    if (!this.lastCheckResults) {
      return {
        isHealthy: null,
        status: 'No health checks performed yet',
        lastChecked: null,
        checks: [],
        recoverySuggestion: null
      };
    }

    const overallHealth = this.healthChecker.getOverallHealth(this.lastCheckResults);
    const failedComponents = this.healthChecker.getFailedComponents(this.lastCheckResults);

    let recoverySuggestion = null;
    if (!overallHealth) {
      const suggestions = this.recoveryService.generateRecoverySuggestions(
        failedComponents.map(fc => ({
          component: fc.component,
          error: fc.error,
          details: {}
        }))
      );
      recoverySuggestion = suggestions.length > 0 ? suggestions[0] : null;
    }

    return {
      isHealthy: overallHealth,
      status: overallHealth ? 'All components healthy' : `${failedComponents.length} component(s) unhealthy`,
      checks: this.lastCheckResults,
      lastChecked: this.lastCheckTime,
      failedComponents,
      recoverySuggestion,
      monitoring: {
        isActive: this.isMonitoring,
        checkInterval: this.config.checkInterval,
        autoRecovery: this.config.autoRecovery
      }
    };
  }

  /**
   * Manually trigger a recovery attempt for a specific component
   */
  async manualRecovery(component, checkId = uuidv4()) {
    logger.info('Manual recovery requested', { component, checkId });

    const failedCheck = {
      component,
      error: 'Manual recovery requested',
      responseTime: 0
    };

    const recoveryResults = await this.recoveryService.attemptRecovery([failedCheck], this.config.services);

    return recoveryResults[0];
  }

  /**
   * Update monitor configuration
   */
  updateConfig(newConfig) {
    const oldConfig = { ...this.config };

    this.config = {
      ...this.config,
      ...newConfig
    };

    // Reinitialize services with new config
    if (newConfig.alerts || newConfig.timeout || newConfig.retryAttempts) {
      this.alertService = new AlertService(this.config);
      this.healthChecker = new HealthChecker(this.config);
      this.recoveryService = new RecoveryService(this.config);
    }

    // Restart monitoring if interval changed
    if (newConfig.checkInterval && newConfig.checkInterval !== oldConfig.checkInterval) {
      if (this.isMonitoring) {
        this.stop();
        this.start();
      }
    }

    logger.info('Pipeline monitor configuration updated', {
      oldConfig: oldConfig,
      newConfig: this.config
    });
  }

  /**
   * Determine alert severity based on failure characteristics
   */
  _determineSeverity(failure) {
    const consecutive = this.consecutiveFailures.get(failure.component) || 1;

    // Critical components or repeated failures get higher severity
    if (failure.component === 'database' || consecutive >= 3) {
      return 'CRITICAL';
    } else if (consecutive >= 2) {
      return 'HIGH';
    }
    return 'MEDIUM';
  }

  /**
   * Get monitoring statistics
   */
  getStats() {
    return {
      isMonitoring: this.isMonitoring,
      lastCheckTime: this.lastCheckTime,
      totalChecks: this.lastCheckResults ? 1 : 0,
      consecutiveFailures: Object.fromEntries(this.consecutiveFailures),
      config: {
        checkInterval: this.config.checkInterval,
        autoRecovery: this.config.autoRecovery,
        enabled: this.config.enabled
      }
    };
  }
}

module.exports = PublishingPipelineMonitor;
