# @jvens/neverthrow-child-process Examples

This directory contains comprehensive examples demonstrating how to use the `@jvens/neverthrow-child-process` library in real-world scenarios.

## 📁 Examples Overview

### [1. Basic Usage](./1-basic-usage/)
Fundamental examples showing synchronous and asynchronous command execution.
- `sync-commands.ts` - execSync, execFileSync, spawnSync examples
- `async-commands.ts` - exec, execFile, spawn examples

### [2. Shell Script Automation](./2-shell-script/) 🔧
Automating shell scripts and command sequences with proper error handling.
- `simple-shell.ts` - Sequential command execution
- `parallel-shell.ts` - Parallel command execution
- `build-script.ts` - Real build pipeline example

### [3. Streaming Data](./3-streaming/) 📡
Handling streaming data between parent and child processes.
- `basic-streaming.ts` - Basic stdout/stderr capture
- `interactive-process.ts` - Two-way communication
- `large-data-stream.ts` - Handling large data streams

### [4. Process Management](./4-process-management/)
Lifecycle management of long-running processes.
- `long-running-process.ts` - Managing long-running processes
- `process-monitoring.ts` - Monitoring and health checks
- `graceful-shutdown.ts` - Proper process termination

### [5. Advanced Patterns](./5-advanced-patterns/)
Sophisticated patterns for complex use cases.
- `error-handling.ts` - Comprehensive error handling
- `retry-logic.ts` - Retry failed commands
- `process-pool.ts` - Managing multiple processes
- `pipeline.ts` - Command pipelines

### [6. Real-World Use Cases](./6-real-world/)
Practical examples for common development scenarios.
- `git-operations.ts` - Git command automation
- `docker-manager.ts` - Docker container management
- `log-processor.ts` - Log file processing
- `ci-pipeline.ts` - CI/CD pipeline simulation

## 🚀 Running the Examples

### Prerequisites

1. **Install the package** (if not already installed):
   ```bash
   npm install @jvens/neverthrow-child-process neverthrow
   ```

2. **TypeScript setup** (if running .ts files directly):
   ```bash
   npm install -g ts-node
   # or
   npm install --save-dev ts-node @types/node
   ```

### Running Individual Examples

```bash
# Recommended: Using tsx (fastest and most reliable)
npx tsx examples/1-basic-usage/sync-commands.ts

# Alternative: Using ts-node with ESM support
npx ts-node --esm examples/1-basic-usage/sync-commands.ts

# Or compile and run
npm run build
node examples/1-basic-usage/sync-commands.js
```

### Running All Examples in a Category

```bash
# Run all basic usage examples
for file in examples/1-basic-usage/*.ts; do
  echo "Running $file..."
  npx tsx "$file"
  echo "---"
done
```

## 💡 Key Concepts Demonstrated

### Type-Safe Error Handling
All examples show how to handle errors using neverthrow's `Result` types:

```typescript
const result = await exec('some-command');
result
  .map(({ stdout }) => console.log('Success:', stdout))
  .mapErr(error => console.error('Failed:', error.message));
```

### Stream Processing
Examples demonstrate various approaches to handling process streams:

```typescript
// Capture output
const result = await spawn('ls', ['-la'], {}, { captureStdout: true });
if (result.isOk()) {
  const output = await result.value.stdout;
  console.log(output);
}

// Real-time streaming
const result = await spawn('tail', ['-f', 'logfile.txt']);
if (result.isOk()) {
  result.value.process.stdout?.on('data', (chunk) => {
    console.log('New log:', chunk.toString());
  });
}
```

### Error Types
Examples show how to handle different error types:

```typescript
if (result.isErr()) {
  if (result.error instanceof ProcessNotFoundError) {
    console.error('Command not found:', result.error.command);
  } else if (result.error instanceof NonZeroExitError) {
    console.error('Command failed with exit code:', result.error.exitCode);
    console.error('stderr:', result.error.stderr);
  }
}
```

### Parallel vs Sequential Execution
Examples demonstrate both patterns:

```typescript
// Sequential
const step1 = await exec('step1');
if (step1.isErr()) return step1;

const step2 = await exec('step2');
if (step2.isErr()) return step2;

// Parallel
const results = await ResultAsync.combine([
  exec('task1'),
  exec('task2'),
  exec('task3'),
]);
```

## 🔧 Customizing Examples

Most examples are designed to be:
- **Self-contained** - Can run independently
- **Configurable** - Use environment variables or arguments
- **Cross-platform** - Work on Windows, macOS, and Linux
- **Educational** - Include detailed comments and explanations

## 📚 Additional Resources

- [Main README](../README.md) - Package documentation
- [API Reference](../README.md#api-reference) - Complete API documentation
- [neverthrow Documentation](https://github.com/supermacro/neverthrow) - Core Result type library
- [Node.js child_process](https://nodejs.org/api/child_process.html) - Native Node.js documentation

## 🤝 Contributing Examples

Found a useful pattern not covered here? Consider contributing!

1. Create a new example file following the existing structure
2. Include comprehensive comments and error handling
3. Add a brief description to the relevant section README
4. Test on multiple platforms if possible

---

*Happy coding with type-safe child processes! 🚀*