#!/usr/bin/env node

const PipelineMonitorServer = require('./api/server');
const { logger } = require('./utils/logger');

/**
 * Main entry point for Publishing Pipeline Monitor
 */

// Load configuration from environment variables
const config = {
  port: process.env.PORT || 3000,
  host: process.env.HOST || 'localhost',
  checkInterval: parseInt(process.env.CHECK_INTERVAL) || 30000,
  autoRecovery: process.env.AUTO_RECOVERY !== 'false',
  logLevel: process.env.LOG_LEVEL || 'info',
  useMockDatabase: process.env.USE_MOCK_DATABASE !== 'false', // Enable mock DB for demos
  useMockValidation: process.env.USE_MOCK_VALIDATION !== 'false', // Enable mock validation for demos

  // Service endpoints
  services: {
    validationService: process.env.VALIDATION_SERVICE_URL || 'http://localhost:3001',
    database: process.env.DATABASE_URL || 'mongodb://localhost:27017/publishing',
    networkEndpoint: process.env.NETWORK_ENDPOINT || 'https://httpbin.org/status/200'
  },

  // Alert configurations
  alerts: [],

  // Health check settings
  timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT) || 5000,
  retryAttempts: parseInt(process.env.RETRY_ATTEMPTS) || 2,

  // Recovery settings
  maxRecoveryAttempts: parseInt(process.env.MAX_RECOVERY_ATTEMPTS) || 3,
  recoveryTimeout: parseInt(process.env.RECOVERY_TIMEOUT) || 30000
};

// Add alert configurations from environment
if (process.env.SLACK_WEBHOOK_URL) {
  config.alerts.push({
    type: 'slack',
    destination: process.env.SLACK_WEBHOOK_URL
  });
}

if (process.env.EMAIL_ALERT_ADDRESS) {
  config.alerts.push({
    type: 'email',
    destination: process.env.EMAIL_ALERT_ADDRESS
  });
}

if (process.env.WEBHOOK_URL) {
  config.alerts.push({
    type: 'webhook',
    destination: process.env.WEBHOOK_URL
  });
}

/**
 * Validate configuration
 */
function validateConfig(config) {
  const errors = [];

  if (!config.services.validationService) {
    errors.push('VALIDATION_SERVICE_URL is required');
  }

  if (!config.services.database) {
    errors.push('DATABASE_URL is required');
  }

  if (!config.services.networkEndpoint) {
    errors.push('NETWORK_ENDPOINT is required');
  }

  if (config.checkInterval < 5000) {
    errors.push('CHECK_INTERVAL must be at least 5000ms');
  }

  if (config.timeout < 1000) {
    errors.push('HEALTH_CHECK_TIMEOUT must be at least 1000ms');
  }

  return errors;
}

/**
 * Print usage information
 */
function printUsage() {
  console.log(`
Publishing Pipeline Monitor

Environment Variables:
  PORT                    Server port (default: 3000)
  HOST                    Server host (default: localhost)
  CHECK_INTERVAL          Health check interval in ms (default: 30000)
  AUTO_RECOVERY           Enable auto-recovery (default: true)
  LOG_LEVEL               Logging level (default: info)

Service Configuration:
  VALIDATION_SERVICE_URL  Validation service endpoint (required)
  DATABASE_URL            Database connection string (required)
  NETWORK_ENDPOINT        Network connectivity test endpoint (required)

Alert Configuration:
  SLACK_WEBHOOK_URL       Slack webhook URL for alerts
  EMAIL_ALERT_ADDRESS     Email address for alerts
  WEBHOOK_URL             Custom webhook URL for alerts

Health Check Settings:
  HEALTH_CHECK_TIMEOUT    Timeout for health checks in ms (default: 5000)
  RETRY_ATTEMPTS          Number of retry attempts (default: 2)

Recovery Settings:
  MAX_RECOVERY_ATTEMPTS   Maximum recovery attempts (default: 3)
  RECOVERY_TIMEOUT        Recovery timeout in ms (default: 30000)

API Endpoints:
  GET  /health                    Service health check
  GET  /api/v1/pipeline/status    Get pipeline status
  GET  /api/v1/pipeline/health    Perform immediate health check
  POST /api/v1/pipeline/recovery/:component  Manual recovery
  POST /api/v1/monitor/start      Start monitoring
  POST /api/v1/monitor/stop       Stop monitoring
  GET  /api/v1/monitor/stats      Get monitoring statistics

Usage:
  npm start                      Start the server
  npm run dev                    Start with auto-reload
  node src/index.js              Direct execution
  `);
}

/**
 * Main application startup
 */
async function main() {
  try {
    // Print banner
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║                 Publishing Pipeline Monitor                   ║
║                                                              ║
║  Monitoring and recovery system for publishing pipelines     ║
╚══════════════════════════════════════════════════════════════╝
    `);

    // Validate configuration
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
      console.error('Configuration errors:');
      configErrors.forEach(error => console.error(`  - ${error}`));
      process.exit(1);
    }

    // Print configuration summary
    console.log('Configuration:');
    console.log(`  Server: ${config.host}:${config.port}`);
    console.log(`  Check Interval: ${config.checkInterval}ms`);
    console.log(`  Auto Recovery: ${config.autoRecovery}`);
    console.log(`  Validation Service: ${config.services.validationService}`);
    console.log(`  Database: ${config.services.database.replace(/:([^:@]{4})[^:@]*@/, ':$1****@')}`);
    console.log(`  Network Endpoint: ${config.services.networkEndpoint}`);
    console.log(`  Alerts: ${config.alerts.length} configured`);
    console.log('');

    // Create and start server
    const server = new PipelineMonitorServer(config);
    await server.start();

    // Handle graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      await server.stop();
      process.exit(0);
    });

    logger.info('Publishing Pipeline Monitor started successfully');

  } catch (error) {
    logger.error('Failed to start Publishing Pipeline Monitor', {
      error: error.message,
      stack: error.stack
    });
    console.error('Failed to start server:', error.message);
    process.exit(1);
  }
}

// Handle command line arguments
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

// Start the application
if (require.main === module) {
  main();
}

module.exports = { config, validateConfig };
