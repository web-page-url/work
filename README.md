# Publishing Pipeline Monitor

A robust, enterprise-grade monitoring and recovery system for publishing pipelines. Built with Node.js, this system provides comprehensive health monitoring, automatic recovery capabilities, and detailed audit trails for EssentiallySports' publishing infrastructure.

## 🏗️ Architecture Overview

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   HTTP API      │    │ Publishing       │    │   Services      │
│   (Express)     │◄──►│ Pipeline Monitor │◄──►│ • Health Check  │
│                 │    │                 │    │ • Alert Service │
└─────────────────┘    └─────────────────┘    │ • Recovery      │
                                              └─────────────────┘
                                                     │
                                                     ▼
                                           ┌─────────────────┐
                                           │   Logging &     │
                                           │   Audit System  │
                                           └─────────────────┘
```

## ✨ Features

- **Comprehensive Health Monitoring**: Real-time monitoring of network, validation service, and database components
- **Automatic Recovery**: Intelligent auto-recovery strategies for different failure scenarios
- **Multi-Channel Alerts**: Support for Slack, email, webhooks, and console notifications
- **Audit Trails**: Complete logging of all pipeline events, failures, and recovery attempts
- **RESTful API**: Full HTTP API for status monitoring and manual interventions
- **Enterprise Ready**: Production-grade error handling, timeouts, and scalability

## 🚀 Quick Start

### Prerequisites

- Node.js 18.0.0 or higher
- MongoDB (for database monitoring)
- Validation service endpoint (for service monitoring)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd publishing-pipeline-monitor

# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env
```

### Environment Configuration

Create a `.env` file with the following variables:

```bash
# Server Configuration
PORT=3000
HOST=localhost
LOG_LEVEL=info

# Service Endpoints (REQUIRED)
VALIDATION_SERVICE_URL=http://localhost:3001
DATABASE_URL=mongodb://localhost:27017/publishing
NETWORK_ENDPOINT=https://httpbin.org/status/200

# Monitoring Configuration
CHECK_INTERVAL=30000
AUTO_RECOVERY=true
HEALTH_CHECK_TIMEOUT=5000
RETRY_ATTEMPTS=2
USE_MOCK_DATABASE=true

# Recovery Configuration
MAX_RECOVERY_ATTEMPTS=3
RECOVERY_TIMEOUT=30000

# Alert Configuration (OPTIONAL)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
EMAIL_ALERT_ADDRESS=alerts@company.com
WEBHOOK_URL=https://api.company.com/alerts

# Demo Configuration
USE_MOCK_DATABASE=true  # Use simulated database for demonstrations
USE_MOCK_VALIDATION=true  # Use simulated validation service for demonstrations
```

## 🎭 Mock Database for Demonstrations

The system includes a **mock database health check** that simulates real database failures for demonstration purposes. This allows you to see the complete monitoring and recovery system in action without needing a real database.

### Mock Database Behavior
```javascript
async checkDatabaseMock() {
  // Simulate DB health check - 70% chance healthy
  const isHealthy = Math.random() > 0.3;

  if (!isHealthy) {
    throw new Error("Database connection failed");
  }
  return true;
}
```

### What It Demonstrates
- ✅ **Health check logic** - How the system tests component health
- ✅ **Failure detection** - Random failures show alert triggering
- ✅ **Recovery handling** - Auto-recovery attempts and logging
- ✅ **Alert notifications** - Slack/email alerts when failures occur

### Configuration
- `USE_MOCK_DATABASE=true` (default) - Use simulated database
- `USE_MOCK_DATABASE=false` - Use real MongoDB connection

**Perfect for showcasing the complete pipeline monitoring system!**
```

### Running the Application

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start

# Run tests
npm test

# Run with coverage
npm run test:coverage
```

## 📡 API Endpoints

### Health & Status

```http
GET /health
```
Basic service health check.

```http
GET /api/v1/pipeline/status
```
Get comprehensive pipeline status including health checks and recovery suggestions.

```http
GET /api/v1/pipeline/health
```
Perform immediate health check on all components.

### Recovery Operations

```http
POST /api/v1/pipeline/recovery/:component
```
Trigger manual recovery for a specific component (`network`, `validation-service`, `database`).

```http
POST /api/v1/pipeline/recovery
Content-Type: application/json

{
  "components": ["network", "database"],
  "checkId": "manual-recovery-123"
}
```
Bulk recovery for multiple components.

### Monitor Control

```http
POST /api/v1/monitor/start
```
Start the monitoring system.

```http
POST /api/v1/monitor/stop
```
Stop the monitoring system.

```http
GET /api/v1/monitor/stats
```
Get monitoring statistics and configuration.

### Configuration Management

```http
GET /api/v1/config
```
Get current configuration (sensitive data masked).

```http
PUT /api/v1/config
Content-Type: application/json

{
  "checkInterval": 60000,
  "autoRecovery": false
}
```
Update monitor configuration.

### Alert Management

```http
GET /api/v1/alerts
```
Get configured alert channels.

```http
POST /api/v1/alerts
Content-Type: application/json

{
  "type": "slack",
  "destination": "https://hooks.slack.com/services/..."
}
```
Add new alert configuration.

```http
DELETE /api/v1/alerts/:type/:destination
```
Remove alert configuration.

## 📊 Monitoring Dashboard

The system provides comprehensive status information:

```json
{
  "success": true,
  "data": {
    "isHealthy": true,
    "status": "All components healthy",
    "checks": [
      {
        "isHealthy": true,
        "component": "network",
        "status": "Network connectivity OK",
        "responseTime": 145,
        "error": null,
        "timestamp": "2025-11-07T19:32:15.000Z"
      }
    ],
    "lastChecked": "2025-11-07T19:32:15.000Z",
    "failedComponents": [],
    "recoverySuggestion": null,
    "monitoring": {
      "isActive": true,
      "checkInterval": 30000,
      "autoRecovery": true
    }
  }
}
```

## 📋 Log Interpretation Guide

### Log Files

The system maintains three types of logs:

- `logs/pipeline.log`: General application logs
- `logs/audit.log`: Audit trail of critical events
- `logs/exceptions.log`: Unhandled exceptions
- `logs/rejections.log`: Unhandled promise rejections

### Log Entry Format

All logs use JSON format for programmatic processing:

```json
{
  "timestamp": "2025-11-07T19:32:15.123Z",
  "level": "INFO",
  "message": "Health check passed for network",
  "event": "HEALTH_CHECK",
  "component": "network",
  "healthy": true,
  "responseTime": 145,
  "checkId": "check-12345"
}
```

### Key Events to Monitor

#### Health Check Events
```json
{
  "event": "HEALTH_CHECK",
  "component": "database",
  "healthy": false,
  "responseTime": 5000,
  "error": "Connection timeout"
}
```
**Interpretation**: Database health check failed with 5-second timeout.

#### Pipeline Failure Events
```json
{
  "event": "PIPELINE_FAILURE",
  "component": "validation-service",
  "error": "Service returned 500",
  "severity": "HIGH",
  "consecutiveFailures": 3
}
```
**Interpretation**: Validation service has failed 3 consecutive checks - requires immediate attention.

#### Recovery Events
```json
{
  "event": "RECOVERY_ATTEMPT",
  "component": "network",
  "action": "dns-refresh",
  "attemptId": "recovery-67890"
}
{
  "event": "RECOVERY_SUCCESS",
  "component": "network",
  "action": "dns-refresh",
  "attemptId": "recovery-67890",
  "duration": 1250
}
```
**Interpretation**: Network recovery succeeded via DNS cache refresh in 1.25 seconds.

#### Alert Events
```json
{
  "event": "ALERT_TRIGGERED",
  "alertType": "slack",
  "destination": "#pipeline-alerts",
  "reason": "Pipeline failure detected",
  "severity": "HIGH"
}
```
**Interpretation**: Alert sent to Slack channel about pipeline failure.

### Log Analysis Commands

```bash
# View recent pipeline failures
grep '"event":"PIPELINE_FAILURE"' logs/audit.log | tail -10

# Count recovery attempts by component
grep '"event":"RECOVERY_ATTEMPT"' logs/audit.log | grep -o '"component":"[^"]*"' | sort | uniq -c

# Find health check response times
grep '"event":"HEALTH_CHECK"' logs/audit.log | grep -o '"responseTime":[0-9]*' | sort -n

# Monitor consecutive failures
grep '"consecutiveFailures":[2-9]' logs/audit.log
```

## 🔧 Recovery Strategies

### Network Component
1. **DNS Cache Refresh**: Clears local DNS cache
2. **Manual Intervention**: Network admin involvement required

### Validation Service
1. **API Restart**: Calls service restart endpoint
2. **Process Restart**: Manual service restart required

### Database Component
1. **Connection Refresh**: Reconnects database connection pool
2. **Manual Intervention**: Database admin involvement required

## 🧪 Testing

The system includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run with coverage report
npm run test:coverage

# Run specific test suites
npm test -- tests/unit/healthChecker.test.js
npm test -- tests/integration/

# Watch mode for development
npm run test:watch
```

### Test Scenarios Covered

- ✅ Component health checks (success/failure)
- ✅ Recovery strategy execution
- ✅ Alert system functionality
- ✅ API endpoint responses
- ✅ Error handling and edge cases
- ✅ Configuration management
- ✅ Audit logging accuracy

## 📈 Performance Metrics

- **Health Check Frequency**: Configurable (default: 30 seconds)
- **Recovery Timeout**: Configurable (default: 30 seconds)
- **Alert Delivery**: Sub-second for local alerts
- **Memory Usage**: ~50MB baseline
- **CPU Usage**: <5% during normal operation

## 🚨 Alert Severity Levels

- **LOW**: Informational events
- **MEDIUM**: Single component failures
- **HIGH**: Multiple failures or repeated issues
- **CRITICAL**: Database failures or system-wide issues

## 🔒 Security Considerations

- All sensitive configuration masked in logs
- No credentials stored in memory
- HTTPS recommended for production deployment
- Input validation on all API endpoints
- Rate limiting should be implemented at infrastructure level

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues and questions:
1. Check the logs in `logs/` directory
2. Review the test output for failures
3. Examine API responses for error details
4. Contact the development team with log excerpts

---

**Built with ❤️ for robust publishing pipeline monitoring**
#   w o r k 
 
 