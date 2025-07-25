# Advanced Patterns Examples

These examples demonstrate sophisticated patterns for building robust, production-ready applications using the `@jvens/neverthrow-child-process` library.

## Files

- **`error-handling.ts`** - Advanced error handling with retry logic and circuit breakers
- **`retry-logic.ts`** - Sophisticated retry strategies with exponential backoff and learning
- **`process-pool.ts`** - Process pool management with auto-scaling and load balancing
- **`pipeline.ts`** - Command composition and data transformation pipelines

## Key Concepts

### Advanced Error Handling
- **Error Classification** - Categorizing errors by type, severity, and retry potential
- **Circuit Breaker Pattern** - Preventing cascade failures with automatic recovery
- **Fallback Mechanisms** - Graceful degradation with alternative strategies
- **Error Aggregation** - Collecting and analyzing error patterns

### Retry Strategies
- **Exponential Backoff** - Progressive delay increases to reduce system load
- **Jitter and Randomization** - Avoiding thundering herd problems
- **Adaptive Retry** - Learning from historical success rates
- **Conditional Retry** - Error-type-based retry decisions

### Process Pool Management
- **Resource Limits** - Configurable minimum and maximum pool sizes
- **Auto-scaling** - Dynamic scaling based on load and utilization
- **Work Queue Management** - Priority-based task scheduling
- **Load Balancing** - Efficient distribution across worker processes

### Pipeline Composition
- **Sequential Pipelines** - Step-by-step data transformation
- **Parallel Branches** - Concurrent processing for performance
- **Middleware Integration** - Cross-cutting concerns and instrumentation
- **Error Recovery** - Optional stages and fallback handling

## Running Examples

```bash
# Run error handling examples
npx tsx examples/5-advanced-patterns/error-handling.ts

# Run retry logic examples
npx tsx examples/5-advanced-patterns/retry-logic.ts

# Run process pool examples
npx tsx examples/5-advanced-patterns/process-pool.ts

# Run pipeline examples
npx tsx examples/5-advanced-patterns/pipeline.ts
```

## What You'll Learn

### Error Handling (error-handling.ts)
- **RetryHandler Class** - Configurable retry logic with exponential backoff
- **CircuitBreaker Class** - Automatic failure detection and recovery
- **ErrorClassifier** - Intelligent error categorization and analysis
- **Fallback Strategies** - Multiple recovery options for resilience
- **Comprehensive Pipelines** - Combining all error handling techniques

### Retry Logic (retry-logic.ts)
- **Advanced Retry Configuration** - Fine-tuned retry behavior
- **Metrics Collection** - Success rates and performance tracking
- **Adaptive Learning** - Adjusting strategies based on historical data
- **Batch Operations** - Coordinated retry for multiple operations
- **Circuit Breaker Integration** - Combined retry and circuit breaking

### Process Pool (process-pool.ts)
- **Pool Initialization** - Setting up worker processes with limits
- **Task Submission** - Queuing and priority-based scheduling
- **Auto-scaling** - Dynamic pool sizing based on utilization
- **Resource Monitoring** - Tracking pool performance and health
- **Graceful Shutdown** - Proper cleanup and resource management

### Pipeline Composition (pipeline.ts)
- **Sequential Processing** - Step-by-step data transformation
- **Parallel Execution** - Concurrent pipeline branches for performance
- **Middleware System** - Logging, metrics, and cross-cutting concerns
- **Error Handling** - Optional stages and recovery mechanisms
- **Complex Transformations** - Real-world data processing examples

## Advanced Patterns

### Retry with Circuit Breaker
```typescript
const retryHandler = new RetryHandler();
const circuitBreaker = new CircuitBreaker({
  failureThreshold: 3,
  recoveryTimeoutMs: 5000
});

const result = await retryHandler.executeWithRetry(() =>
  circuitBreaker.execute(() => exec('unreliable-command')), {
  maxAttempts: 3,
  baseDelayMs: 1000
});
```

### Auto-scaling Process Pool
```typescript
const pool = new ProcessPool(workerScript, {
  minSize: 2,
  maxSize: 10,
  enableAutoScaling: true,
  scaleUpThreshold: 0.8,
  scaleDownThreshold: 0.2
});

await pool.initialize();

// Submit high-priority tasks
const results = await pool.submitBatch(tasks, 10);
```

### Pipeline with Middleware
```typescript
const pipeline = new Pipeline()
  .use(loggingMiddleware)
  .use(metricsMiddleware)
  .stage('validate', validateData)
  .stage('transform', transformData)
  .stage('output', generateOutput);

const result = await pipeline.execute(inputData);
```

### Error Classification
```typescript
const classifier = new ErrorClassifier();
const classification = classifier.classifyError(error);

console.log(`Category: ${classification.category}`);
console.log(`Severity: ${classification.severity}`);
console.log(`Retryable: ${classification.retryable}`);
console.log(`Action: ${classification.userAction}`);
```

## Production Considerations

### Error Handling
- Implement proper error classification for different failure types
- Use circuit breakers to prevent cascade failures
- Set up monitoring and alerting for error patterns
- Design fallback mechanisms for critical operations

### Retry Logic
- Choose appropriate retry strategies based on operation characteristics
- Implement jitter to avoid thundering herd problems
- Monitor retry metrics to tune configuration
- Set reasonable timeout and attempt limits

### Process Pool Management
- Size pools based on system resources and expected load
- Monitor pool utilization and adjust scaling parameters
- Implement proper cleanup for long-running pools
- Handle worker failures gracefully with replacement

### Pipeline Design
- Keep stages focused and testable
- Use middleware for cross-cutting concerns
- Implement proper error boundaries
- Design for both performance and maintainability

## Real-World Applications

These patterns are essential for:
- **Microservices** - Resilient service-to-service communication
- **Data Processing** - ETL pipelines with error recovery
- **Background Jobs** - Robust task processing systems
- **API Gateways** - Request routing with circuit breaking
- **Batch Processing** - Large-scale data transformation
- **Monitoring Systems** - Reliable metric collection and alerting

## Best Practices

1. **Error Handling** - Always classify errors before deciding retry strategy
2. **Circuit Breakers** - Use for external dependencies and unreliable services
3. **Process Pools** - Size appropriately and monitor resource usage
4. **Pipelines** - Keep stages pure and composable
5. **Monitoring** - Instrument all patterns with metrics and logging
6. **Testing** - Test failure scenarios and recovery mechanisms
7. **Configuration** - Make retry/timeout values configurable
8. **Documentation** - Document error scenarios and recovery procedures