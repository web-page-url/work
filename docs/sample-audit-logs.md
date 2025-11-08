# Sample Audit Logs

This document contains sample audit log entries demonstrating various pipeline monitoring scenarios.

## Normal Operation - All Components Healthy

```json
{"timestamp":"2025-11-07T19:30:00.000Z","level":"INFO","message":"System health check completed - all components healthy","event":"SYSTEM_STATUS","overallHealth":true,"checksCount":3,"failedChecks":0,"checkId":"check-001","duration":450}
{"timestamp":"2025-11-07T19:30:00.001Z","level":"INFO","message":"Health check passed for network","event":"HEALTH_CHECK","component":"network","healthy":true,"responseTime":145,"checkId":"check-001"}
{"timestamp":"2025-11-07T19:30:00.002Z","level":"INFO","message":"Health check passed for validation-service","event":"HEALTH_CHECK","component":"validation-service","healthy":true,"responseTime":234,"checkId":"check-001"}
{"timestamp":"2025-11-07T19:30:00.003Z","level":"INFO","message":"Health check passed for database","event":"HEALTH_CHECK","component":"database","healthy":true,"responseTime":89,"checkId":"check-001"}
```

## Component Failure Detection

```json
{"timestamp":"2025-11-07T19:32:15.000Z","level":"WARN","message":"System health check completed - 1 components unhealthy","event":"SYSTEM_STATUS","overallHealth":false,"checksCount":3,"failedChecks":1,"checkId":"check-045","duration":5200,"failedComponents":["validation-service"]}
{"timestamp":"2025-11-07T19:32:15.001Z","level":"INFO","message":"Health check passed for network","event":"HEALTH_CHECK","component":"network","healthy":true,"responseTime":156,"checkId":"check-045"}
{"timestamp":"2025-11-07T19:32:15.002Z","level":"WARN","message":"Health check failed for validation-service","event":"HEALTH_CHECK","component":"validation-service","healthy":false,"responseTime":5000,"error":"Connection timeout","checkId":"check-045"}
{"timestamp":"2025-11-07T19:32:15.003Z","level":"INFO","message":"Health check passed for database","event":"HEALTH_CHECK","component":"database","healthy":true,"responseTime":94,"checkId":"check-045"}
{"timestamp":"2025-11-07T19:32:15.004Z","level":"ERROR","message":"Pipeline failure detected in validation-service","event":"PIPELINE_FAILURE","component":"validation-service","error":"Connection timeout","stack":"Error: Connection timeout\\n    at ...","timestamp":"2025-11-07T19:32:15.004Z","severity":"HIGH","consecutiveFailures":1}
```

## Alert Triggering

```json
{"timestamp":"2025-11-07T19:32:15.005Z","level":"WARN","message":"Alert triggered: slack -> #pipeline-alerts","event":"ALERT_TRIGGERED","alertType":"slack","destination":"#pipeline-alerts","reason":"Component health check failed: Connection timeout","checkId":"check-045","component":"validation-service","error":"Connection timeout","responseTime":5000,"consecutiveFailures":1,"severity":"HIGH"}
{"timestamp":"2025-11-07T19:32:15.006Z","level":"WARN","message":"Alert triggered: email -> alerts@company.com","event":"ALERT_TRIGGERED","alertType":"email","destination":"alerts@company.com","reason":"Component health check failed: Connection timeout","checkId":"check-045","component":"validation-service","error":"Connection timeout","responseTime":5000,"consecutiveFailures":1,"severity":"HIGH"}
```

## Successful Auto-Recovery

```json
{"timestamp":"2025-11-07T19:32:15.007Z","level":"INFO","message":"Recovery attempt initiated for validation-service: service-restart","event":"RECOVERY_ATTEMPT","component":"validation-service","action":"service-restart","attemptId":"recovery-12345","timestamp":"2025-11-07T19:32:15.007Z","failureReason":"Connection timeout","previousAttempts":[]}
{"timestamp":"2025-11-07T19:32:15.008Z","level":"INFO","message":"Recovery successful for validation-service: service-restart","event":"RECOVERY_SUCCESS","component":"validation-service","action":"service-restart","attemptId":"recovery-12345","duration":1250,"timestamp":"2025-11-07T19:32:15.008Z","strategy":"API-based service restart"}
```

## Failed Recovery with Manual Intervention Required

```json
{"timestamp":"2025-11-07T19:35:20.000Z","level":"WARN","message":"System health check completed - 2 components unhealthy","event":"SYSTEM_STATUS","overallHealth":false,"checksCount":3,"failedChecks":2,"checkId":"check-078","duration":8200,"failedComponents":["database","network"]}
{"timestamp":"2025-11-07T19:35:20.001Z","level":"WARN","message":"Health check failed for database","event":"HEALTH_CHECK","component":"database","healthy":false,"responseTime":5000,"error":"Connection refused","checkId":"check-078"}
{"timestamp":"2025-11-07T19:35:20.002Z","level":"WARN","message":"Health check failed for network","event":"HEALTH_CHECK","component":"network","healthy":false,"responseTime":5000,"error":"DNS resolution failed","checkId":"check-078"}
{"timestamp":"2025-11-07T19:35:20.003Z","level":"ERROR","message":"Pipeline failure detected in database","event":"PIPELINE_FAILURE","component":"database","error":"Connection refused","severity":"CRITICAL","consecutiveFailures":5}
{"timestamp":"2025-11-07T19:35:20.004Z","level":"ERROR","message":"Pipeline failure detected in network","event":"PIPELINE_FAILURE","component":"network","error":"DNS resolution failed","severity":"HIGH","consecutiveFailures":2}
{"timestamp":"2025-11-07T19:35:20.005Z","level":"INFO","message":"Recovery attempt initiated for database: connection-refresh","event":"RECOVERY_ATTEMPT","component":"database","action":"connection-refresh","attemptId":"recovery-23456"}
{"timestamp":"2025-11-07T19:35:20.006Z","level":"ERROR","message":"Recovery failed for database: connection-refresh","event":"RECOVERY_FAILED","component":"database","action":"connection-refresh","attemptId":"recovery-23456","error":"Connection refresh failed","duration":30000,"timestamp":"2025-11-07T19:35:20.006Z","severity":"HIGH","failureReason":"Connection refused"}
{"timestamp":"2025-11-07T19:35:20.007Z","level":"WARN","message":"Alert triggered: slack -> #pipeline-alerts","event":"ALERT_TRIGGERED","alertType":"slack","destination":"#pipeline-alerts","reason":"Auto-recovery failed: Manual intervention required","checkId":"check-078","priority":"high","manualSteps":["Check database server status","Verify database connection string","Restart database service if necessary","Contact DBA team"],"nextSteps":["Check database server logs","Verify database server is running","Check network connectivity to database","Restart database service if necessary","Contact database administrator"],"severity":"CRITICAL"}
```

## Manual Recovery Execution

```json
{"timestamp":"2025-11-07T19:40:00.000Z","level":"INFO","message":"Manual recovery requested","component":"database","checkId":"manual-001"}
{"timestamp":"2025-11-07T19:40:00.001Z","level":"INFO","message":"Recovery attempt initiated for database: connection-refresh","event":"RECOVERY_ATTEMPT","component":"database","action":"connection-refresh","attemptId":"manual-001"}
{"timestamp":"2025-11-07T19:40:00.002Z","level":"INFO","message":"Recovery successful for database: connection-refresh","event":"RECOVERY_SUCCESS","component":"database","action":"connection-refresh","attemptId":"manual-001","duration":890,"timestamp":"2025-11-07T19:40:00.002Z","strategy":"Database connection pool refresh"}
```

## System Monitoring Events

```json
{"timestamp":"2025-11-07T19:00:00.000Z","level":"INFO","message":"Starting publishing pipeline monitor","checkInterval":30000,"autoRecovery":true}
{"timestamp":"2025-11-07T19:00:00.001Z","level":"INFO","message":"Publishing Pipeline Monitor started successfully"}
{"timestamp":"2025-11-07T19:00:00.002Z","level":"INFO","message":"System health check completed - all components healthy","event":"SYSTEM_STATUS","overallHealth":true,"checksCount":3,"failedChecks":0,"event":"MONITOR_STARTED","checkInterval":30000}
{"timestamp":"2025-11-07T19:45:00.000Z","level":"INFO","message":"Stopping publishing pipeline monitor"}
{"timestamp":"2025-11-07T19:45:00.001Z","level":"INFO","message":"System health check completed - all components healthy","event":"SYSTEM_STATUS","overallHealth":false,"checksCount":0,"failedChecks":0,"event":"MONITOR_STOPPED"}
```

## Configuration Changes

```json
{"timestamp":"2025-11-07T20:00:00.000Z","level":"INFO","message":"Pipeline monitor configuration updated","oldConfig":{"checkInterval":30000,"autoRecovery":true},"newConfig":{"checkInterval":60000,"autoRecovery":false}}
```

## Error Handling Examples

```json
{"timestamp":"2025-11-07T19:50:00.000Z","level":"ERROR","message":"Health check failed completely","checkId":"check-156","error":"All services unreachable","stack":"Error: All services unreachable\\n    at PublishingPipelineMonitor.performHealthCheck..."}
{"timestamp":"2025-11-07T19:50:00.001Z","level":"WARN","message":"Alert triggered: console -> console","event":"ALERT_TRIGGERED","alertType":"console","destination":"console","reason":"Auto-recovery system failed to execute","checkId":"check-156","error":"All services unreachable","severity":"CRITICAL"}
```

## Performance Monitoring

```json
{"timestamp":"2025-11-07T19:30:00.000Z","level":"INFO","message":"System health check completed - all components healthy","event":"SYSTEM_STATUS","overallHealth":true,"checksCount":3,"failedChecks":0,"checkId":"check-001","duration":450,"memoryUsage":52428800,"cpuUsage":3.2}
```

## Log Analysis Queries

### Recent Failures
```bash
grep '"event":"PIPELINE_FAILURE"' logs/audit.log | tail -5
```

### Recovery Success Rate
```bash
# Count total recovery attempts
grep '"event":"RECOVERY_ATTEMPT"' logs/audit.log | wc -l

# Count successful recoveries
grep '"event":"RECOVERY_SUCCESS"' logs/audit.log | wc -l
```

### Component Health Summary
```bash
echo "Component Health Summary (last 24 hours):"
for component in network validation-service database; do
  total=$(grep "\"component\":\"$component\"" logs/audit.log | grep '"event":"HEALTH_CHECK"' | wc -l)
  healthy=$(grep "\"component\":\"$component\"" logs/audit.log | grep '"healthy":true' | wc -l)
  unhealthy=$((total - healthy))
  echo "$component: $healthy healthy, $unhealthy unhealthy ($((healthy * 100 / total))% uptime)"
done
```

### Alert Frequency
```bash
echo "Alerts by severity (last 24 hours):"
grep '"event":"ALERT_TRIGGERED"' logs/audit.log | grep -o '"severity":"[^"]*"' | sort | uniq -c
```

### Recovery Time Analysis
```bash
echo "Average recovery times by component:"
grep '"event":"RECOVERY_SUCCESS"' logs/audit.log | grep -o '"component":"[^"]*","action":"[^"]*","duration":[0-9]*' | while read line; do
  component=$(echo $line | cut -d'"' -f4)
  duration=$(echo $line | grep -o '[0-9]*$')
  echo "$component: ${duration}ms"
done | sort
```
