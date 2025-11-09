# 🚀 Publishing Pipeline Monitor

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/Tests-47%20Passing-brightgreen.svg" alt="Tests">
</p>

## 📋 Overview

**Enterprise-Grade Monitoring & Recovery System**

*Built with Node.js for robust publishing pipeline management*

---

### What This System Does

Imagine your company's article publishing system. This software acts like a **smart "doctor"** that:

- 🔍 **Checks health** every 30 seconds (network, validation service, database)
- 🚨 **Sends alerts** when problems occur (Slack, email, webhooks)
- 🔧 **Fixes problems automatically** when possible
- 📝 **Logs everything** for later analysis
- 🎛️ **Provides controls** via web dashboard and API

---



## 🎯 Key Features

| Feature | Description | Benefit |
|---------|-------------|---------|
| **Health Monitoring** | Real-time checks of all system components | Catches problems before they affect users |
| **Auto-Recovery** | Smart automatic fixes for common issues | Reduces manual intervention time |
| **Multi-Channel Alerts** | Slack, email, webhooks, console notifications | Ensures the right people get notified |
| **Audit Logging** | Complete event history with searchable logs | Easy troubleshooting and compliance |
| **REST API** | Full programmatic control | Integration with other systems |
| **Web Dashboard** | Real-time status and controls | Easy monitoring without technical knowledge |

## 🏗️ System Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   🌐 Web API     │    │ 🤖 Main Monitor  │    │ ⚙️  Services     │
│   (Express.js)   │◄──►│ (Core Logic)     │◄──►│ • Health Checks │
│   Port: 3000     │    │                 │    │ • Alert System  │
└─────────────────┘    └─────────────────┘    │ • Auto-Recovery │
                                              └─────────────────┘
                                                     │
                                                     ▼
                                           ┌─────────────────┐
                                           │ 📊 Logging &    │
                                           │ 📋 Audit System │
                                           └─────────────────┘
```

## 🚀 Quick Start

### 📋 What You Need

| Requirement | Version | Purpose |
|-------------|---------|---------|
| **Node.js** | 18.0.0+ | Runtime environment |
| **MongoDB** | Latest | Database monitoring (optional) |
| **Validation Service** | Any | Service health monitoring (optional) |

### ⚡ Installation (3 Steps)

```bash
# 1. Clone and enter the project
git clone <repository-url>
cd publishing-pipeline-monitor

# 2. Install all dependencies
npm install

# 3. Set up configuration
cp .env.example .env
```

### ⚙️ Configuration Setup

Create a `.env` file in the project root:

```bash
# 🌐 Basic Server Settings
PORT=3000
HOST=localhost
LOG_LEVEL=info

# 🔗 Services to Monitor (REQUIRED for production)
VALIDATION_SERVICE_URL=http://localhost:3001
DATABASE_URL=mongodb://localhost:27017/publishing
NETWORK_ENDPOINT=https://httpbin.org/status/200

# ⏱️ Monitoring Behavior
CHECK_INTERVAL=30000          # Check every 30 seconds
AUTO_RECOVERY=true           # Auto-fix problems when possible
HEALTH_CHECK_TIMEOUT=5000    # 5 second timeout for checks
RETRY_ATTEMPTS=2             # Retry failed checks twice

# 🔧 Recovery Settings
MAX_RECOVERY_ATTEMPTS=3      # Try recovery up to 3 times
RECOVERY_TIMEOUT=30000       # 30 seconds for recovery operations

# 📢 Alert Notifications (OPTIONAL)
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
EMAIL_ALERT_ADDRESS=alerts@company.com
WEBHOOK_URL=https://api.company.com/alerts

# 🎭 Demo Mode (Perfect for presentations!)
USE_MOCK_DATABASE=true       # Simulate database for demos
USE_MOCK_VALIDATION=true     # Simulate validation service for demos
```

## 🎭 Demo Mode Features

### Mock Services for Perfect Demonstrations

The system includes **simulated services** so you can see everything working without complex setup:

#### 🤖 Mock Database
```javascript
// Simulates real database behavior
async checkDatabaseMock() {
  // 70% success rate - shows realistic failures
  const isHealthy = Math.random() > 0.3;

  if (!isHealthy) {
    throw new Error("Database connection failed");
  }
  return { status: "healthy", responseTime: 150 };
}
```

#### ✅ What You Get to See:
- **Real Health Checks** - How the system monitors components
- **Actual Failures** - Random issues that trigger alerts
- **Auto-Recovery** - System attempts to fix problems automatically
- **Alert Notifications** - Slack/email alerts in action
- **Complete Logging** - Full audit trail of events

#### ⚙️ Demo Configuration:
```bash
# Enable demo mode (recommended for first run)
USE_MOCK_DATABASE=true      # Fake database for demos
USE_MOCK_VALIDATION=true    # Fake validation service
```

<div align="center">

**🚀 Perfect for presentations and testing!**

*See the full monitoring system without external dependencies*

</div>

## ▶️ How to Run

### 🚀 Start Commands

| Mode | Command | Description |
|------|---------|-------------|
| **Development** | `npm run dev` | Auto-reload on file changes |
| **Production** | `npm start` | Optimized for production use |
| **Dashboard** | `npm run dashboard` | Start server + open dashboard |

### 🧪 Testing Commands

```bash
# Run all tests (47 comprehensive tests)
npm test

# Run with coverage report
npm run test:coverage

# Run specific tests
npm test -- tests/unit/healthChecker.test.js
npm test -- tests/integration/

# Watch mode (re-run on changes)
npm run test:watch
```

---

## 📡 API Reference

### 🔍 Health & Status Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Basic system health check |
| `GET` | `/api/v1/pipeline/status` | Full pipeline status with recovery suggestions |
| `GET` | `/api/v1/pipeline/health` | Immediate health check of all components |

**Example Status Response:**
```json
{
  "success": true,
  "data": {
    "isHealthy": true,
    "status": "All components healthy",
    "checks": [
      {
        "component": "network",
        "healthy": true,
        "responseTime": 145,
        "status": "Network connectivity OK"
      }
    ]
  }
}
```

### 🔧 Recovery Endpoints

| Method | Endpoint | Description | Example |
|--------|----------|-------------|---------|
| `POST` | `/api/v1/pipeline/recovery/database` | Fix database issues | `POST /recovery/database` |
| `POST` | `/api/v1/pipeline/recovery/validation` | Fix validation service | `POST /recovery/validation` |
| `POST` | `/api/v1/pipeline/recovery/network` | Fix network issues | `POST /recovery/network` |
| `POST` | `/api/v1/pipeline/recovery` | Fix multiple components | See below |

**Bulk Recovery Example:**
```bash
curl -X POST http://localhost:3000/api/v1/pipeline/recovery \
  -H "Content-Type: application/json" \
  -d '{"components": ["network", "database"]}'
```

### 🎛️ System Control

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/monitor/start` | Start monitoring system |
| `POST` | `/api/v1/monitor/stop` | Stop monitoring system |
| `GET` | `/api/v1/monitor/stats` | Get monitoring statistics |

### ⚙️ Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/config` | View current settings |
| `PUT` | `/api/v1/config` | Update configuration |

### 📢 Alert Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/alerts` | List alert channels |
| `POST` | `/api/v1/alerts` | Add alert channel |
| `DELETE` | `/api/v1/alerts/:type/:destination` | Remove alert channel |

## 📊 Web Dashboard

### Live Monitoring Interface

Visit `http://localhost:3000/dashboard.html` to see:

#### 📈 **Real-Time Status Display:**
- ✅ **Component Health** - Network, Validation Service, Database
- 📊 **System Metrics** - Uptime, success rate, recovery statistics
- 🚨 **Active Alerts** - Current issues and notifications
- 🔄 **Recovery Actions** - Auto-recovery attempts and results

#### 🎛️ **Interactive Controls:**
- **Manual Recovery** - Trigger fixes for specific components
- **System Control** - Start/stop monitoring
- **Configuration** - Adjust settings in real-time

#### 📱 **Beautiful Interface:**
- Clean, professional design
- Mobile-responsive layout
- Real-time updates
- Easy-to-understand status indicators

---

<div align="center">

**🎯 Quick Access:**
```bash
# Start server and open dashboard automatically
npm run dashboard

# Or manually:
npm start
# Then visit: http://localhost:3000/dashboard.html
```

</div>

## 📋 Understanding the Logs

### 📁 Log Files Overview

The system creates detailed logs in the `logs/` directory:

| Log File | Purpose | What It Contains |
|----------|---------|------------------|
| **`pipeline.log`** | General activity | All system operations and events |
| **`audit.log`** | Critical events | Security, failures, recoveries, alerts |
| **`exceptions.log`** | System errors | Unexpected errors and crashes |
| **`rejections.log`** | Promise errors | Unhandled promise rejections |

### 🔍 Reading Log Entries

**All logs are in JSON format** for easy analysis:

```json
{
  "timestamp": "2025-11-07T19:32:15.123Z",
  "level": "INFO",
  "message": "Health check passed for network",
  "event": "HEALTH_CHECK",
  "component": "network",
  "healthy": true,
  "responseTime": 145
}
```

### 🚨 Important Events to Watch

#### ✅ **Health Check Events**
```json
{
  "event": "HEALTH_CHECK",
  "component": "database",
  "healthy": false,
  "error": "Connection timeout"
}
```
**Meaning**: Database check failed - investigate immediately!

#### 🚨 **Pipeline Failure Events**
```json
{
  "event": "PIPELINE_FAILURE",
  "component": "validation-service",
  "severity": "HIGH",
  "consecutiveFailures": 3
}
```
**Meaning**: Validation service failing repeatedly - needs urgent attention!

#### 🔧 **Recovery Events**
```json
{
  "event": "RECOVERY_SUCCESS",
  "component": "network",
  "action": "dns-refresh",
  "duration": 1250
}
```
**Meaning**: Network issue automatically fixed in 1.25 seconds!

#### 📢 **Alert Events**
```json
{
  "event": "ALERT_TRIGGERED",
  "alertType": "slack",
  "destination": "#pipeline-alerts"
}
```
**Meaning**: Team notified via Slack about the issue.

### 🛠️ Quick Log Analysis Commands

```bash
# See recent failures
grep '"event":"PIPELINE_FAILURE"' logs/audit.log | tail -5

# Count recoveries by component
grep '"event":"RECOVERY_ATTEMPT"' logs/audit.log | grep -o '"component":"[^"]*"' | sort | uniq -c

# Find slow response times
grep '"responseTime":[5-9][0-9][0-9][0-9]' logs/audit.log

# Check for repeated failures
grep '"consecutiveFailures":[3-9]' logs/audit.log
```

## 🔧 How Auto-Recovery Works

### 🛠️ Recovery Methods by Component

| Component | Auto-Recovery Action | When Manual Help Needed |
|-----------|---------------------|-------------------------|
| **🌐 Network** | DNS cache refresh | Firewall/proxy issues |
| **🔍 Validation Service** | API restart call | Service completely down |
| **💾 Database** | Connection pool refresh | Server/database corruption |

### 📋 Recovery Process:
1. **Detect** → System identifies the problem
2. **Attempt Auto-Fix** → Tries automated solution
3. **Verify** → Checks if fix worked
4. **Alert if Needed** → Notifies humans if auto-fix fails

---

## 🧪 Quality Assurance

### 📊 Test Coverage (47 Tests)

| Test Category | Coverage | Examples |
|---------------|----------|----------|
| **Unit Tests** | 35 tests | Individual functions and methods |
| **Integration Tests** | 12 tests | Full system workflows |
| **API Tests** | All endpoints | REST API functionality |

### ✅ What's Tested:
- Component health monitoring
- Automatic recovery logic
- Alert system delivery
- API responses and error handling
- Configuration management
- Log accuracy and completeness

### 🚀 Run Tests:

```bash
# Complete test suite
npm test

# With coverage report
npm run test:coverage

# Specific test files
npm test -- tests/unit/healthChecker.test.js

# Development watch mode
npm run test:watch
```

---

## ⚡ Performance & Reliability

### 📈 System Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| **Health Check Frequency** | Every 30 seconds | Configurable |
| **Recovery Timeout** | 30 seconds | Max time for auto-fixes |
| **Memory Usage** | ~50MB | Baseline consumption |
| **CPU Usage** | <5% | During normal operation |
| **Alert Delivery** | <1 second | For local notifications |

### 🚨 Alert Priority Levels

| Level | Trigger | Response Time |
|-------|---------|---------------|
| **🔵 LOW** | Informational | Log only |
| **🟡 MEDIUM** | Single failure | Email notification |
| **🟠 HIGH** | Repeated failures | Slack + email alerts |
| **🔴 CRITICAL** | System-wide issues | All channels + urgent |

### 🔐 Security Features

- **Masked Credentials** - Sensitive data hidden in logs
- **Input Validation** - All API inputs validated
- **HTTPS Ready** - Production deployment with SSL
- **Rate Limiting** - Prevents API abuse
- **Audit Trails** - Complete activity logging

## 🤝 Contributing

We welcome contributions! Here's how to get involved:

### 📋 Development Workflow
1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Add tests** for new functionality
4. **Ensure** all tests pass (`npm test`)
5. **Commit** your changes (`git commit -m 'Add amazing feature'`)
6. **Push** to the branch (`git push origin feature/amazing-feature`)
7. **Open** a Pull Request

### 🐛 Bug Reports & Feature Requests
- Use [GitHub Issues](https://github.com/anubhav/publishing-pipeline-monitor/issues) for bugs
- Include log excerpts and steps to reproduce
- For features, describe the use case and benefit

### 📖 Code Standards
- Follow existing code style
- Add JSDoc comments for new functions
- Write comprehensive tests
- Update documentation

---

## 📞 Support & Troubleshooting

### 🆘 Getting Help

**Quick Self-Help:**
1. **Check Logs**: `tail -f logs/audit.log`
2. **Run Tests**: `npm test` (should all pass)
3. **Health Check**: `GET /api/v1/pipeline/status`
4. **Dashboard**: Visit `http://localhost:3000/dashboard.html`

**Common Issues:**
- **Server won't start?** Check Node.js version (`node --version`)
- **Tests failing?** Run `npm install` to ensure dependencies
- **No alerts?** Verify `.env` configuration
- **Database errors?** Check `USE_MOCK_DATABASE=true` for demos

### 📧 Contact Information

- **📧 Email**: support@publishing-monitor.com
- **💬 Slack**: #pipeline-support
- **📚 Docs**: Full documentation at `/docs/`

---

## 📄 License

**MIT License** - Open source and free to use

```
Copyright (c) 2025 Publishing Pipeline Monitor

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software...
```

[Read full license](LICENSE)

---

## 🎉 **Ready to Get Started?**

```bash
# Clone the project
git clone https://github.com/anubhav/publishing-pipeline-monitor.git
cd publishing-pipeline-monitor

# Quick demo setup
cp .env.example .env
npm install
npm run dashboard
```

**Visit: http://localhost:3000/dashboard.html**

---

<p align="center">
  <strong>🏆 Built with ❤️ for enterprise-grade publishing pipeline monitoring</strong><br><br>
  <em>Making systems reliable, one health check at a time.</em><br><br>
  <strong>👨‍💻 Created by Anubhav</strong>
</p>
