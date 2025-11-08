const winston = require('winston');
const path = require('path');

// Create logs directory if it doesn't exist
const fs = require('fs');
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom log format for audit trails
const auditFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };
    return JSON.stringify(logEntry, null, 0);
  })
);

// Regular log format for general logging
const generalFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = Object.keys(meta).length ? `\n${JSON.stringify(meta, null, 2)}` : '';
    return `${timestamp} [${level}]: ${message}${metaStr}`;
  })
);

// Create winston logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: generalFormat,
  transports: [
    // Console transport for development
    new winston.transports.Console({
      format: generalFormat
    }),

    // File transport for general logs
    new winston.transports.File({
      filename: path.join(logsDir, 'pipeline.log'),
      format: auditFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 5,
    }),

    // Separate audit log for critical events
    new winston.transports.File({
      filename: path.join(logsDir, 'audit.log'),
      level: 'warn',
      format: auditFormat,
      maxsize: 5242880, // 5MB
      maxFiles: 10,
    })
  ],
  exceptionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'exceptions.log'),
      format: auditFormat
    })
  ],
  rejectionHandlers: [
    new winston.transports.File({
      filename: path.join(logsDir, 'rejections.log'),
      format: auditFormat
    })
  ]
});

/**
 * Audit logger specifically for pipeline events
 */
class AuditLogger {
  static logHealthCheck(component, result, details = {}) {
    const logEntry = {
      event: 'HEALTH_CHECK',
      component,
      healthy: result.isHealthy,
      responseTime: result.responseTime,
      error: result.error,
      timestamp: result.timestamp,
      ...details
    };

    if (result.isHealthy) {
      logger.info(`Health check passed for ${component}`, logEntry);
    } else {
      logger.warn(`Health check failed for ${component}`, logEntry);
    }
  }

  static logPipelineFailure(component, error, context = {}) {
    const logEntry = {
      event: 'PIPELINE_FAILURE',
      component,
      error: error.message || error,
      stack: error.stack,
      timestamp: new Date(),
      severity: 'CRITICAL',
      ...context
    };

    logger.error(`Pipeline failure detected in ${component}`, logEntry);
  }

  static logRecoveryAttempt(component, action, attemptId, details = {}) {
    const logEntry = {
      event: 'RECOVERY_ATTEMPT',
      component,
      action,
      attemptId,
      timestamp: new Date(),
      ...details
    };

    logger.info(`Recovery attempt initiated for ${component}: ${action}`, logEntry);
  }

  static logRecoverySuccess(component, action, attemptId, duration, details = {}) {
    const logEntry = {
      event: 'RECOVERY_SUCCESS',
      component,
      action,
      attemptId,
      duration,
      timestamp: new Date(),
      ...details
    };

    logger.info(`Recovery successful for ${component}: ${action}`, logEntry);
  }

  static logRecoveryFailure(component, action, attemptId, error, duration, details = {}) {
    const logEntry = {
      event: 'RECOVERY_FAILED',
      component,
      action,
      attemptId,
      error: error.message || error,
      duration,
      timestamp: new Date(),
      severity: 'HIGH',
      ...details
    };

    logger.error(`Recovery failed for ${component}: ${action}`, logEntry);
  }

  static logAlertTriggered(alertType, destination, reason, details = {}) {
    const logEntry = {
      event: 'ALERT_TRIGGERED',
      alertType,
      destination,
      reason,
      timestamp: new Date(),
      ...details
    };

    logger.warn(`Alert triggered: ${alertType} -> ${destination}`, logEntry);
  }

  static logSystemStatus(overallHealth, checksCount, failedChecks, details = {}) {
    const logEntry = {
      event: 'SYSTEM_STATUS',
      overallHealth,
      checksCount,
      failedChecks,
      timestamp: new Date(),
      ...details
    };

    if (overallHealth) {
      logger.info('System health check completed - all components healthy', logEntry);
    } else {
      logger.warn(`System health check completed - ${failedChecks} components unhealthy`, logEntry);
    }
  }
}

module.exports = {
  logger,
  AuditLogger
};
