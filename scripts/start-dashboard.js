#!/usr/bin/env node

/**
 * Publishing Pipeline Monitor Dashboard Starter
 * Starts the server, initializes monitoring, and opens the dashboard
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const SERVER_PORT = process.env.PORT || 3000;
const DASHBOARD_FILE = path.join(__dirname, '..', 'dashboard.html');

console.log('🚀 Starting Publishing Pipeline Monitor Dashboard...\n');

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function checkServerReady(port, callback, attempts = 0) {
  const maxAttempts = 30; // 30 seconds max wait

  if (attempts >= maxAttempts) {
    log('❌ Server failed to start within 30 seconds', 'red');
    process.exit(1);
  }

  const req = http.request({
    hostname: 'localhost',
    port: port,
    path: '/health',
    method: 'GET',
    timeout: 1000
  }, (res) => {
    if (res.statusCode === 200) {
      log('✅ Server is ready!', 'green');
      callback();
    } else {
      setTimeout(() => checkServerReady(port, callback, attempts + 1), 1000);
    }
  });

  req.on('error', () => {
    process.stdout.write('.');
    setTimeout(() => checkServerReady(port, callback, attempts + 1), 1000);
  });

  req.end();
}

function startMonitor(callback) {
  log('🔧 Starting pipeline monitor...', 'yellow');

  const req = http.request({
    hostname: 'localhost',
    port: SERVER_PORT,
    path: '/api/v1/monitor/start',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    }
  }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      if (res.statusCode === 200) {
        log('✅ Monitor started successfully!', 'green');
        callback();
      } else {
        log(`❌ Failed to start monitor: ${data}`, 'red');
        process.exit(1);
      }
    });
  });

  req.on('error', (err) => {
    log(`❌ Monitor start failed: ${err.message}`, 'red');
    process.exit(1);
  });

  req.end();
}

function openDashboard() {
  const { platform } = process;

  log('\n🎉 DASHBOARD IS READY!', 'green');
  log('=' .repeat(50), 'cyan');
  log(`📂 Open this file in your browser:`, 'bright');
  log(`   ${DASHBOARD_FILE}`, 'cyan');
  log('');
  log('🌐 Or visit the API directly:', 'bright');
  log(`   http://localhost:${SERVER_PORT}/api/v1/pipeline/status`, 'cyan');
  log('');
  log('✨ Dashboard Features:', 'yellow');
  log('   • Live status updates every 30 seconds');
  log('   • Beautiful cards for each component');
  log('   • Color-coded health indicators');
  log('   • Interactive controls');
  log('   • Recovery suggestions');
  log('');
  log('🎯 Current Status Will Show:', 'magenta');
  log('   ✅ Network connection status');
  log('   ❌ Database connection status');
  log('   ❌ Validation service status');
  log('');
  log('💡 Press Ctrl+C to stop the server', 'gray');

  // Try to open the dashboard file automatically
  const open = require('open');
  try {
    open(DASHBOARD_FILE);
    log('📖 Dashboard opened in your default browser!', 'green');
  } catch (err) {
    log('ℹ️  Please manually open dashboard.html in your browser', 'yellow');
  }
}

// Start the server
log('🔄 Starting server...', 'yellow');
const server = spawn('node', ['src/index.js'], {
  stdio: ['inherit', 'inherit', 'inherit'],
  cwd: path.join(__dirname, '..')
});

server.on('error', (err) => {
  log(`❌ Failed to start server: ${err.message}`, 'red');
  process.exit(1);
});

// Handle server shutdown
process.on('SIGINT', () => {
  log('\n🛑 Shutting down server...', 'yellow');
  server.kill();
  process.exit(0);
});

process.on('SIGTERM', () => {
  log('\n🛑 Shutting down server...', 'yellow');
  server.kill();
  process.exit(0);
});

// Wait for server to be ready, then start monitor, then open dashboard
setTimeout(() => {
  log('⏳ Waiting for server to be ready', 'yellow');
  process.stdout.write('   ');
  checkServerReady(SERVER_PORT, () => {
    console.log(''); // New line after dots
    startMonitor(() => {
      setTimeout(openDashboard, 1000);
    });
  });
}, 2000);
