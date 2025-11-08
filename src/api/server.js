const express = require('express');
const cors = require('cors');
const PublishingPipelineMonitor = require('../core/publishingPipelineMonitor');
const { logger } = require('../utils/logger');

/**
 * HTTP API Server for Pipeline Monitor
 */
class PipelineMonitorServer {
  constructor(config = {}) {
    this.config = {
      port: config.port || 3000,
      host: config.host || 'localhost',
      cors: config.cors || true,
      ...config
    };

    this.app = express();
    this.monitor = null;

    this.setupMiddleware();
    this.setupRoutes();
    this.setupErrorHandling();
  }

  /**
   * Setup Express middleware
   */
  setupMiddleware() {
    // CORS support
    if (this.config.cors) {
      this.app.use(cors());
    }

    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true }));

    // Request logging
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        body: req.method !== 'GET' ? req.body : undefined
      });
      next();
    });

    // Health check endpoint (always available)
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'ok',
        timestamp: new Date(),
        service: 'publishing-pipeline-monitor'
      });
    });
  }

  /**
   * Setup API routes
   */
  setupRoutes() {
    const router = express.Router();

    // Pipeline status endpoints
    router.get('/api/v1/pipeline/status', this.getPipelineStatus.bind(this));
    router.get('/api/v1/pipeline/health', this.getHealthCheck.bind(this));

    // Recovery endpoints
    router.post('/api/v1/pipeline/recovery/:component', this.manualRecovery.bind(this));
    router.post('/api/v1/pipeline/recovery', this.bulkRecovery.bind(this));

    // Monitor control endpoints
    router.post('/api/v1/monitor/start', this.startMonitor.bind(this));
    router.post('/api/v1/monitor/stop', this.stopMonitor.bind(this));
    router.get('/api/v1/monitor/stats', this.getMonitorStats.bind(this));

    // Configuration endpoints
    router.get('/api/v1/config', this.getConfig.bind(this));
    router.put('/api/v1/config', this.updateConfig.bind(this));

    // Alert management
    router.get('/api/v1/alerts', this.getAlertConfigs.bind(this));
    router.post('/api/v1/alerts', this.addAlertConfig.bind(this));
    router.delete('/api/v1/alerts/:type/:destination', this.removeAlertConfig.bind(this));

    this.app.use(router);
  }

  /**
   * Get comprehensive pipeline status
   */
  async getPipelineStatus(req, res) {
    try {
      if (!this.monitor) {
        return res.status(503).json({
          error: 'Monitor not initialized',
          message: 'Pipeline monitor has not been started'
        });
      }

      const status = this.monitor.getPipelineStatus();

      res.json({
        success: true,
        data: status,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get pipeline status', { error: error.message });
      res.status(500).json({
        error: 'Internal server error',
        message: error.message
      });
    }
  }

  /**
   * Perform immediate health check
   */
  async getHealthCheck(req, res) {
    try {
      if (!this.monitor) {
        return res.status(503).json({
          error: 'Monitor not initialized',
          message: 'Pipeline monitor has not been started'
        });
      }

      const result = await this.monitor.performHealthCheck();

      res.json({
        success: true,
        data: result,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to perform health check', { error: error.message });
      res.status(500).json({
        error: 'Health check failed',
        message: error.message
      });
    }
  }

  /**
   * Manual recovery for specific component
   */
  async manualRecovery(req, res) {
    try {
      const { component } = req.params;
      const { checkId } = req.body;

      if (!this.monitor) {
        return res.status(503).json({
          error: 'Monitor not initialized'
        });
      }

      const validComponents = ['network', 'validation-service', 'database'];
      if (!validComponents.includes(component)) {
        return res.status(400).json({
          error: 'Invalid component',
          validComponents
        });
      }

      const result = await this.monitor.manualRecovery(component, checkId);

      res.json({
        success: true,
        data: result,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Manual recovery failed', {
        component: req.params.component,
        error: error.message
      });
      res.status(500).json({
        error: 'Recovery failed',
        message: error.message
      });
    }
  }

  /**
   * Bulk recovery for multiple components
   */
  async bulkRecovery(req, res) {
    try {
      const { components, checkId } = req.body;

      if (!this.monitor) {
        return res.status(503).json({
          error: 'Monitor not initialized'
        });
      }

      if (!Array.isArray(components) || components.length === 0) {
        return res.status(400).json({
          error: 'Components array is required'
        });
      }

      const results = [];
      for (const component of components) {
        try {
          const result = await this.monitor.manualRecovery(component, checkId);
          results.push(result);
        } catch (error) {
          results.push({
            component,
            success: false,
            error: error.message
          });
        }
      }

      res.json({
        success: true,
        data: results,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Bulk recovery failed', { error: error.message });
      res.status(500).json({
        error: 'Bulk recovery failed',
        message: error.message
      });
    }
  }

  /**
   * Start the monitor
   */
  async startMonitor(req, res) {
    try {
      if (this.monitor && this.monitor.isMonitoring) {
        return res.status(409).json({
          error: 'Monitor already running'
        });
      }

      if (!this.monitor) {
        this.monitor = new PublishingPipelineMonitor(this.config);
      }

      await this.monitor.start();

      res.json({
        success: true,
        message: 'Pipeline monitor started',
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to start monitor', { error: error.message });
      res.status(500).json({
        error: 'Failed to start monitor',
        message: error.message
      });
    }
  }

  /**
   * Stop the monitor
   */
  async stopMonitor(req, res) {
    try {
      if (!this.monitor || !this.monitor.isMonitoring) {
        return res.status(409).json({
          error: 'Monitor not running'
        });
      }

      this.monitor.stop();

      res.json({
        success: true,
        message: 'Pipeline monitor stopped',
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to stop monitor', { error: error.message });
      res.status(500).json({
        error: 'Failed to stop monitor',
        message: error.message
      });
    }
  }

  /**
   * Get monitor statistics
   */
  getMonitorStats(req, res) {
    try {
      if (!this.monitor) {
        return res.status(503).json({
          error: 'Monitor not initialized'
        });
      }

      const stats = this.monitor.getStats();

      res.json({
        success: true,
        data: stats,
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get monitor stats', { error: error.message });
      res.status(500).json({
        error: 'Failed to get stats',
        message: error.message
      });
    }
  }

  /**
   * Get current configuration
   */
  getConfig(req, res) {
    res.json({
      success: true,
      data: {
        ...this.config,
        // Don't expose sensitive data
        services: this.config.services ? {
          ...this.config.services,
          // Mask sensitive parts of connection strings
          database: this.config.services.database ?
            this._maskConnectionString(this.config.services.database) : undefined
        } : undefined
      },
      timestamp: new Date()
    });
  }

  /**
   * Update monitor configuration
   */
  async updateConfig(req, res) {
    try {
      const newConfig = req.body;

      if (this.monitor) {
        this.monitor.updateConfig(newConfig);
      }

      // Update server config
      this.config = {
        ...this.config,
        ...newConfig
      };

      res.json({
        success: true,
        message: 'Configuration updated',
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to update config', { error: error.message });
      res.status(500).json({
        error: 'Configuration update failed',
        message: error.message
      });
    }
  }

  /**
   * Get alert configurations
   */
  getAlertConfigs(req, res) {
    try {
      if (!this.monitor) {
        return res.status(503).json({
          error: 'Monitor not initialized'
        });
      }

      // This would need to be exposed from the monitor/alertService
      res.json({
        success: true,
        data: this.config.alerts || [],
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to get alert configs', { error: error.message });
      res.status(500).json({
        error: 'Failed to get alert configurations',
        message: error.message
      });
    }
  }

  /**
   * Add alert configuration
   */
  addAlertConfig(req, res) {
    try {
      const alertConfig = req.body;

      if (!alertConfig.type || !alertConfig.destination) {
        return res.status(400).json({
          error: 'Alert type and destination are required'
        });
      }

      if (this.monitor) {
        this.monitor.alertService.addAlertConfig(alertConfig);
      }

      // Update config
      if (!this.config.alerts) {
        this.config.alerts = [];
      }
      this.config.alerts.push(alertConfig);

      res.json({
        success: true,
        message: 'Alert configuration added',
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to add alert config', { error: error.message });
      res.status(500).json({
        error: 'Failed to add alert configuration',
        message: error.message
      });
    }
  }

  /**
   * Remove alert configuration
   */
  removeAlertConfig(req, res) {
    try {
      const { type, destination } = req.params;

      if (this.monitor) {
        this.monitor.alertService.removeAlertConfig(type, decodeURIComponent(destination));
      }

      // Update config
      if (this.config.alerts) {
        this.config.alerts = this.config.alerts.filter(
          alert => !(alert.type === type && alert.destination === decodeURIComponent(destination))
        );
      }

      res.json({
        success: true,
        message: 'Alert configuration removed',
        timestamp: new Date()
      });
    } catch (error) {
      logger.error('Failed to remove alert config', { error: error.message });
      res.status(500).json({
        error: 'Failed to remove alert configuration',
        message: error.message
      });
    }
  }

  /**
   * Setup error handling middleware
   */
  setupErrorHandling() {
    // 404 handler
    this.app.use((req, res) => {
      res.status(404).json({
        error: 'Not found',
        message: `${req.method} ${req.path} not found`
      });
    });

    // General error handler
    this.app.use((error, req, res, next) => {
      logger.error('Unhandled error', {
        error: error.message,
        stack: error.stack,
        url: req.url,
        method: req.method
      });

      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message
      });
    });
  }

  /**
   * Mask sensitive parts of connection strings
   */
  _maskConnectionString(connectionString) {
    if (!connectionString) return connectionString;

    // Mask password in MongoDB connection strings
    return connectionString.replace(/:([^:@]{4})[^:@]*@/, ':$1****@');
  }

  /**
   * Start the server
   */
  async start() {
    return new Promise((resolve, reject) => {
      try {
        this.server = this.app.listen(this.config.port, this.config.host, () => {
          logger.info(`Pipeline Monitor API server listening on ${this.config.host}:${this.config.port}`);
          resolve(this.server);
        });

        this.server.on('error', (error) => {
          logger.error('Failed to start server', { error: error.message });
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Stop the server
   */
  async stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => {
          logger.info('Pipeline Monitor API server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }
}

module.exports = PipelineMonitorServer;
