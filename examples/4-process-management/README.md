# Process Management Examples

These examples demonstrate advanced process lifecycle management patterns, including long-running processes, monitoring, and graceful shutdown procedures.

## Files

- **`long-running-process.ts`** - Complete lifecycle management for long-running processes
- **`process-monitoring.ts`** - Resource monitoring, metrics collection, and alerting
- **`graceful-shutdown.ts`** - Signal handling and coordinated shutdown procedures

## Key Concepts

### Process Lifecycle Management
- **Startup and Registration** - Proper process initialization and tracking
- **Health Monitoring** - Continuous health checks and status reporting
- **Restart and Recovery** - Automatic restart policies and failure recovery
- **Resource Management** - Memory, CPU, and file descriptor tracking

### Monitoring and Alerting
- **Resource Usage Tracking** - CPU, memory, and system resource monitoring
- **Performance Metrics** - Trend analysis and performance indicators
- **Alert Systems** - Threshold-based alerting with severity levels
- **Reporting** - Comprehensive monitoring reports and summaries

### Graceful Shutdown
- **Signal Handling** - Proper SIGTERM, SIGINT, and SIGKILL handling
- **Cleanup Procedures** - Resource cleanup and state preservation
- **Coordinated Shutdown** - Multi-process shutdown orchestration
- **Timeout Management** - Graceful vs. forced termination

## Running Examples

```bash
# Run process lifecycle management examples
npx tsx examples/4-process-management/long-running-process.ts

# Run process monitoring examples
npx tsx examples/4-process-management/process-monitoring.ts

# Run graceful shutdown examples
npx tsx examples/4-process-management/graceful-shutdown.ts
```

## What You'll Learn

### Long-Running Process Management (long-running-process.ts)
- **ProcessManager Class** - Complete process lifecycle management
- **Health Monitoring** - Automated health checks and status tracking
- **Process Restart** - Automatic restart policies and failure recovery
- **Multi-Process Coordination** - Managing multiple related processes
- **Graceful Lifecycle** - Proper startup, monitoring, and shutdown

### Process Monitoring (process-monitoring.ts)
- **Resource Monitoring** - CPU, memory, and system resource tracking
- **Metrics Collection** - Historical data collection and analysis
- **Alert System** - Threshold-based alerting with multiple severity levels
- **Trend Analysis** - Performance trend detection and reporting
- **Comprehensive Reporting** - Detailed monitoring reports and summaries

### Graceful Shutdown (graceful-shutdown.ts)
- **Signal Handling** - Proper SIGTERM, SIGINT handling
- **Cleanup Procedures** - Resource cleanup and state preservation
- **Coordinated Shutdown** - Multi-process shutdown in dependency order
- **Timeout Handling** - Graceful vs. forced termination strategies
- **State Preservation** - Saving application state during shutdown

## Advanced Patterns

### Process Manager
```typescript
const manager = new ProcessManager();

// Register process with health monitoring
await manager.startProcess('api-server', 'node', ['server.js']);

// Start health monitoring
manager.startHealthMonitoring(5000);

// Check process status
const status = manager.getProcessStatus('api-server');
console.log(status);

// Graceful shutdown
await manager.shutdown();
```

### Resource Monitoring
```typescript
const monitor = new ProcessMonitor();

// Add process to monitoring
monitor.addProcess('worker', childProcess);

// Start monitoring with alerts
monitor.startMonitoring(3000);

// Get metrics and trends
const metrics = monitor.getLatestMetrics('worker');
const alerts = monitor.getAlerts('high');
```

### Graceful Shutdown
```typescript
const shutdownManager = new GracefulShutdownManager();

// Register processes with cleanup
shutdownManager.registerProcess('database', dbProcess, async () => {
  await flushBuffers();
  await saveState();
});

// Coordinated shutdown
await shutdownManager.shutdownAll(['api', 'database'], {
  gracefulTimeoutMs: 10000,
  forceTimeoutMs: 15000
});
```

## Production Considerations

### Health Monitoring
- Implement appropriate health check intervals based on process criticality
- Set realistic thresholds for CPU and memory alerts
- Consider implementing custom health checks beyond resource monitoring
- Use metrics history for capacity planning and performance optimization

### Graceful Shutdown
- Always implement SIGTERM handlers in your processes
- Design cleanup procedures to be idempotent
- Set appropriate timeout values for your application's requirements
- Test shutdown procedures regularly in development

### Resource Management
- Monitor file descriptor usage to prevent resource leaks
- Implement memory usage alerts before system limits are reached
- Consider process restart policies for different failure scenarios
- Log all process lifecycle events for debugging and auditing

## Real-World Applications

These patterns are essential for:
- **Web Servers** - Managing API servers and load balancers
- **Background Workers** - Queue processors and batch job runners
- **Database Systems** - Coordinated database cluster management
- **Microservices** - Service mesh and container orchestration
- **Data Pipelines** - ETL processes and stream processors
- **Monitoring Systems** - Infrastructure monitoring and alerting

## Best Practices

1. **Health Monitoring** - Implement comprehensive health checks
2. **Resource Limits** - Set and monitor appropriate resource limits
3. **Graceful Shutdown** - Always handle termination signals properly
4. **Error Recovery** - Implement automatic restart policies
5. **State Management** - Preserve critical state during shutdown
6. **Coordinated Operations** - Shutdown dependent services in correct order
7. **Timeout Handling** - Use progressive timeout strategies
8. **Monitoring Integration** - Integrate with external monitoring systems