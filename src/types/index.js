/**
 * @typedef {Object} HealthCheckResult
 * @property {boolean} isHealthy - Whether the component is healthy
 * @property {string} component - Name of the component being checked
 * @property {string} status - Status message
 * @property {number} responseTime - Response time in milliseconds
 * @property {string|null} error - Error message if unhealthy
 * @property {Date} timestamp - When the check was performed
 */

/**
 * @typedef {Object} PipelineStatus
 * @property {boolean} isHealthy - Overall pipeline health
 * @property {HealthCheckResult[]} checks - Individual health check results
 * @property {string} overallStatus - Overall status message
 * @property {Date} lastChecked - Last time pipeline was checked
 * @property {RecoverySuggestion|null} recoverySuggestion - Suggested recovery action if unhealthy
 */

/**
 * @typedef {Object} RecoverySuggestion
 * @property {string} action - Suggested recovery action
 * @property {string} description - Description of what the action does
 * @property {string} priority - Priority level (high, medium, low)
 * @property {boolean} canAutoRecover - Whether this can be auto-recovered
 */

/**
 * @typedef {Object} AlertConfig
 * @property {string} type - Alert type (email, slack, webhook, etc.)
 * @property {string} destination - Where to send the alert
 * @property {string[]} triggers - What triggers this alert
 */

/**
 * @typedef {Object} RecoveryAttempt
 * @property {string} id - Unique recovery attempt ID
 * @property {string} component - Component being recovered
 * @property {string} action - Recovery action taken
 * @property {boolean} success - Whether recovery was successful
 * @property {string|null} error - Error message if recovery failed
 * @property {Date} timestamp - When recovery was attempted
 * @property {number} duration - How long recovery took in milliseconds
 */

/**
 * @typedef {Object} PipelineConfig
 * @property {number} checkInterval - Health check interval in milliseconds
 * @property {number} timeout - Timeout for health checks in milliseconds
 * @property {number} retryAttempts - Number of retry attempts for failed checks
 * @property {AlertConfig[]} alerts - Alert configurations
 * @property {Object} services - Service endpoints configuration
 * @property {string} services.validationService - Validation service URL
 * @property {string} services.database - Database connection string
 * @property {string} services.networkEndpoint - Network endpoint to check
 */

module.exports = {
  // Export types for documentation
  HealthCheckResult: 'HealthCheckResult',
  PipelineStatus: 'PipelineStatus',
  RecoverySuggestion: 'RecoverySuggestion',
  AlertConfig: 'AlertConfig',
  RecoveryAttempt: 'RecoveryAttempt',
  PipelineConfig: 'PipelineConfig'
};
