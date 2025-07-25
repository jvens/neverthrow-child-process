# Shell Script Automation Examples

These examples demonstrate how to automate shell scripts and command sequences using the `@jvens/neverthrow-child-process` package with proper error handling and coordination.

## Files

- **`simple-shell.ts`** - Sequential command execution with the SimpleShell class
- **`parallel-shell.ts`** - Parallel command execution with performance optimization
- **`build-script.ts`** - Real build pipeline with multi-stage execution

## Key Concepts

### Sequential vs Parallel Execution
Learn when to use sequential execution (for dependent tasks) versus parallel execution (for independent tasks) to optimize performance.

### Error Handling Strategies
- **Critical vs Non-Critical Tasks** - How to handle failures that should stop execution vs warnings
- **Partial Failure Recovery** - Continuing execution when some tasks fail
- **Rollback Capabilities** - Cleaning up when builds fail

### Build Pipeline Patterns
- **Multi-Stage Pipelines** - Breaking complex builds into manageable stages
- **Dependency Management** - Ensuring proper execution order
- **Resource Optimization** - Maximizing build performance

## Running Examples

```bash
# Run simple shell automation
ts-node examples/2-shell-script/simple-shell.ts

# Run parallel execution examples
ts-node examples/2-shell-script/parallel-shell.ts

# Run build pipeline simulation
ts-node examples/2-shell-script/build-script.ts
```

## What You'll Learn

### Simple Shell Automation
- Sequential command execution with proper logging
- Early termination on critical failures
- Conditional execution based on environment
- Progress tracking and timing

### Parallel Execution
- Performance comparison between sequential and parallel execution
- Handling mixed success/failure scenarios
- Resource monitoring during execution
- Coordinating multiple independent tasks

### Build Pipeline Design
- Multi-stage build processes (setup → validation → build → package)
- Dependency management between stages
- Mixed sequential/parallel execution for optimal performance
- Error recovery and rollback strategies
- Real-world build scenarios (TypeScript, multi-language projects)

## Advanced Patterns

### Performance Optimization
```typescript
// Sequential execution
for (const task of tasks) {
  await executeTask(task);
}

// Parallel execution
const results = await ResultAsync.combine(
  tasks.map(task => executeTask(task))
);
```

### Error Handling
```typescript
const task = {
  name: 'Optional task',
  command: 'some-command',
  critical: false  // Won't stop build if it fails
};
```

### Stage Dependencies
```typescript
const stage = {
  name: 'integration-tests',
  dependsOn: ['unit-tests', 'build'],  // Must wait for these stages
  tasks: [...]
};
```

## Real-World Applications

These patterns are useful for:
- **CI/CD Pipelines** - Automating build, test, and deployment
- **Development Workflows** - Setting up development environments
- **System Administration** - Batch operations and maintenance scripts
- **Data Processing** - ETL pipelines and batch jobs
- **Release Management** - Coordinating complex release processes

## Best Practices

1. **Use Parallel Execution** for independent tasks to improve performance
2. **Mark Critical Tasks** appropriately to control failure behavior
3. **Implement Cleanup** procedures for failed builds
4. **Add Progress Logging** to track execution status
5. **Handle Timeouts** for long-running tasks
6. **Plan Dependencies** carefully to avoid deadlocks
7. **Test Error Scenarios** to ensure robust error handling