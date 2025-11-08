const axios = require('axios');
const { logger, AuditLogger } = require('../utils/logger');

/**
 * Alert Service for notifying stakeholders of pipeline issues
 */
class AlertService {
  constructor(config = {}) {
    this.config = {
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      timeout: config.timeout || 5000,
      ...config
    };

    this.alertConfigs = config.alerts || [];
  }

  /**
   * Send alert through configured channels
   * @param {string} component - Component that failed
   * @param {string} message - Alert message
   * @param {Object} details - Additional alert details
   */
  async sendAlert(component, message, details = {}) {
    const alertPromises = this.alertConfigs.map(config =>
      this._sendAlertToChannel(config, component, message, details)
    );

    const results = await Promise.allSettled(alertPromises);

    // Log results
    results.forEach((result, index) => {
      const config = this.alertConfigs[index];
      if (result.status === 'fulfilled') {
        AuditLogger.logAlertTriggered(config.type, config.destination, `${component}: ${message}`, {
          success: true,
          ...details
        });
      } else {
        logger.error(`Failed to send ${config.type} alert to ${config.destination}`, {
          error: result.reason.message,
          component,
          message,
          ...details
        });
      }
    });
  }

  /**
   * Send alert to specific channel with retry logic
   */
  async _sendAlertToChannel(config, component, message, details) {
    let lastError;

    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        await this._executeAlert(config, component, message, details);
        return; // Success, exit retry loop
      } catch (error) {
        lastError = error;
        logger.warn(`Alert attempt ${attempt}/${this.config.retryAttempts} failed for ${config.type}`, {
          destination: config.destination,
          error: error.message
        });

        if (attempt < this.config.retryAttempts) {
          await this._delay(this.config.retryDelay * attempt); // Exponential backoff
        }
      }
    }

    throw lastError; // All retries failed
  }

  /**
   * Execute alert for specific channel type
   */
  async _executeAlert(config, component, message, details) {
    const alertData = {
      component,
      message,
      timestamp: new Date(),
      severity: details.severity || 'HIGH',
      ...details
    };

    switch (config.type.toLowerCase()) {
      case 'webhook':
        await this._sendWebhookAlert(config, alertData);
        break;

      case 'slack':
        await this._sendSlackAlert(config, alertData);
        break;

      case 'email':
        await this._sendEmailAlert(config, alertData);
        break;

      case 'console':
        await this._sendConsoleAlert(config, alertData);
        break;

      default:
        throw new Error(`Unsupported alert type: ${config.type}`);
    }
  }

  /**
   * Send webhook alert
   */
  async _sendWebhookAlert(config, alertData) {
    const response = await axios.post(config.destination, {
      alert: alertData,
      source: 'publishing-pipeline-monitor'
    }, {
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'PublishingPipelineMonitor/1.0'
      }
    });

    if (response.status < 200 || response.status >= 300) {
      throw new Error(`Webhook returned status ${response.status}`);
    }
  }

  /**
   * Send Slack alert
   */
  async _sendSlackAlert(config, alertData) {
    const slackMessage = {
      text: `:warning: *Publishing Pipeline Alert*\n*Component:* ${alertData.component}\n*Message:* ${alertData.message}\n*Severity:* ${alertData.severity}\n*Time:* ${alertData.timestamp.toISOString()}`,
      attachments: [{
        color: alertData.severity === 'CRITICAL' ? 'danger' : 'warning',
        fields: Object.entries(alertData)
          .filter(([key]) => !['component', 'message', 'timestamp', 'severity'].includes(key))
          .map(([key, value]) => ({
            title: key.charAt(0).toUpperCase() + key.slice(1),
            value: String(value),
            short: true
          }))
      }]
    };

    const response = await axios.post(config.destination, slackMessage, {
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.data.ok) {
      throw new Error(`Slack API error: ${response.data.error}`);
    }
  }

  /**
   * Send email alert (placeholder - would integrate with email service)
   */
  async _sendEmailAlert(config, alertData) {
    // Placeholder for email integration
    // In production, integrate with services like SendGrid, SES, etc.
    logger.info(`EMAIL ALERT: ${config.destination}`, alertData);

    // Simulate email sending
    if (config.destination.includes('@')) {
      logger.info(`Email would be sent to ${config.destination}`);
    } else {
      throw new Error('Invalid email destination');
    }
  }

  /**
   * Send console alert (for development/testing)
   */
  async _sendConsoleAlert(config, alertData) {
    const alertMessage = `
🚨 PUBLISHING PIPELINE ALERT 🚨
Component: ${alertData.component}
Message: ${alertData.message}
Severity: ${alertData.severity}
Time: ${alertData.timestamp.toISOString()}
Details: ${JSON.stringify(alertData, null, 2)}
    `.trim();

    console.log(alertMessage);
    logger.info('Console alert sent', alertData);
  }

  /**
   * Update alert configurations
   */
  updateConfig(newConfigs) {
    this.alertConfigs = newConfigs;
    logger.info('Alert configurations updated', { count: newConfigs.length });
  }

  /**
   * Add new alert configuration
   */
  addAlertConfig(config) {
    this.alertConfigs.push(config);
    logger.info('Alert configuration added', config);
  }

  /**
   * Remove alert configuration
   */
  removeAlertConfig(type, destination) {
    const initialCount = this.alertConfigs.length;
    this.alertConfigs = this.alertConfigs.filter(
      config => !(config.type === type && config.destination === destination)
    );

    if (this.alertConfigs.length < initialCount) {
      logger.info('Alert configuration removed', { type, destination });
    }
  }

  /**
   * Utility method for delays
   */
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = AlertService;
