# @jvens/neverthrow-child-process

[![npm version](https://badge.fury.io/js/@jvens%2Fneverthrow-child-process.svg)](https://badge.fury.io/js/@jvens%2Fneverthrow-child-process)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Node.js child_process wrapped in neverthrow Result types for type-safe error handling.

## Features

- 🔒 **Type-safe error handling** - All operations return `Result<T, ProcessError>` or `ResultAsync<T, ProcessError>`
- 🎯 **Full TypeScript support** - Complete type definitions with accurate inference
- 🔄 **Synchronous and asynchronous APIs** - Both sync and async child_process operations
- 📦 **ESM + CJS support** - Works with both module systems
- 🎨 **Consistent error types** - Structured error handling for all child_process operations
- 📖 **Comprehensive documentation** - JSDoc comments for all public APIs

## Installation

```bash
npm install @jvens/neverthrow-child-process neverthrow
```

**Note**: `neverthrow` is a peer dependency and must be installed separately.

## Quick Start

```typescript
import { execSync, exec, spawn } from '@jvens/neverthrow-child-process';

// Synchronous usage
const result = execSync('echo "Hello World"', { encoding: 'utf8' });
if (result.isOk()) {
  console.log(result.value); // "Hello World"
} else {
  console.error('Command failed:', result.error.message);
}

// Asynchronous usage
const asyncResult = await exec('node --version');
asyncResult
  .map(({ stdout }) => console.log('Node version:', stdout.trim()))
  .mapErr(error => console.error('Failed to get Node version:', error.message));

// Spawn with stream capture
const spawnResult = await spawn('ls', ['-la'], {}, { captureStdout: true });
if (spawnResult.isOk()) {
  const stdout = await spawnResult.value.stdout!;
  console.log('Directory listing:', stdout);
}
```

## API Reference

### Synchronous Functions

#### `execSync(command, options?)`

Executes a command in a shell and returns the output.

```typescript
import { execSync } from '@jvens/neverthrow-child-process';

const result = execSync('echo "Hello"', { encoding: 'utf8' });
// Returns: Result<string | Buffer, ProcessError>
```

#### `execFileSync(file, args?, options?)`

Executes a file with arguments (no shell by default).

```typescript
import { execFileSync } from '@jvens/neverthrow-child-process';

const result = execFileSync('node', ['--version'], { encoding: 'utf8' });
// Returns: Result<string | Buffer, ProcessError>
```

#### `spawnSync(command, args?, options?)`

Spawns a child process synchronously.

```typescript
import { spawnSync } from '@jvens/neverthrow-child-process';

const result = spawnSync('ls', ['-la'], { encoding: 'utf8' });
if (result.isOk()) {
  console.log('Exit code:', result.value.status);
  console.log('Output:', result.value.stdout);
}
```

### Asynchronous Functions

#### `exec(command, options?)`

Executes a command in a shell asynchronously.

```typescript
import { exec } from '@jvens/neverthrow-child-process';

const result = await exec('git status');
// Returns: ResultAsync<{ stdout: string, stderr: string }, ProcessError>
```

#### `execFile(file, args?, options?)`

Executes a file with arguments asynchronously.

```typescript
import { execFile } from '@jvens/neverthrow-child-process';

const result = await execFile('node', ['-e', 'console.log("Hello")']);
// Returns: ResultAsync<{ stdout: string, stderr: string }, ProcessError>
```

#### `spawn(command, args?, options?, streamOptions?)`

Spawns a child process asynchronously with optional stream capture.

```typescript
import { spawn } from '@jvens/neverthrow-child-process';

// Basic spawn
const result = await spawn('ping', ['google.com', '-c', '3']);
if (result.isOk()) {
  const { process, exitPromise } = result.value;
  const { code } = await exitPromise;
  console.log('Process exited with code:', code);
}

// Spawn with stream capture
const resultWithCapture = await spawn(
  'echo', 
  ['Hello from spawn'], 
  {}, 
  { captureStdout: true, captureStderr: true }
);
if (resultWithCapture.isOk()) {
  const [stdout, stderr] = await Promise.all([
    resultWithCapture.value.stdout!,
    resultWithCapture.value.stderr!
  ]);
  console.log('stdout:', stdout);
  console.log('stderr:', stderr);
}
```

#### `fork(modulePath, args?, options?)`

Forks a new Node.js process.

```typescript
import { fork } from '@jvens/neverthrow-child-process';

const result = await fork('./worker.js', ['--port', '3000']);
if (result.isOk()) {
  const child = result.value;
  child.send({ cmd: 'start' });
  child.on('message', (msg) => {
    console.log('Message from child:', msg);
  });
}
```

#### `waitForExit(child)`

Waits for a child process to exit.

```typescript
import { spawn, waitForExit } from '@jvens/neverthrow-child-process';

const spawnResult = await spawn('sleep', ['2']);
if (spawnResult.isOk()) {
  const exitResult = await waitForExit(spawnResult.value.process);
  exitResult
    .map(({ code, signal }) => {
      console.log(`Process exited with code ${code}, signal ${signal}`);
    })
    .mapErr(error => {
      console.error('Process error:', error.message);
    });
}
```

### Module Imports

You can import functions individually or use module imports:

```typescript
// Individual imports (recommended)
import { execSync, exec, spawn } from '@jvens/neverthrow-child-process';

// Module imports
import { sync, async } from '@jvens/neverthrow-child-process';
const result = sync.execSync('echo "Hello"');
const asyncResult = await async.exec('echo "Hello"');

// Specific module imports
import { execSync } from '@jvens/neverthrow-child-process/sync';
import { exec } from '@jvens/neverthrow-child-process/async';
```

## Error Types

All functions return structured error types:

- `ProcessNotFoundError` - Command or file not found (ENOENT)
- `PermissionDeniedError` - Permission denied (EACCES, EPERM)
- `ProcessTimeoutError` - Process timed out (ETIMEDOUT)
- `ProcessKilledError` - Process killed by signal
- `NonZeroExitError` - Process exited with non-zero code
- `InvalidArgumentError` - Invalid arguments provided
- `SpawnError` - General spawn errors
- `MaxBufferExceededError` - Output buffer exceeded
- `UnknownError` - Catch-all for unexpected errors

```typescript
import { execSync, ProcessNotFoundError, NonZeroExitError } from '@jvens/neverthrow-child-process';

const result = execSync('some-command');
if (result.isErr()) {
  if (result.error instanceof ProcessNotFoundError) {
    console.error('Command not found:', result.error.command);
  } else if (result.error instanceof NonZeroExitError) {
    console.error('Command failed with exit code:', result.error.exitCode);
    console.error('stderr:', result.error.stderr);
  }
}
```

## TypeScript Configuration

This package is built with TypeScript and provides full type safety. No additional `@types` packages are needed.

```typescript
import { execSync } from '@jvens/neverthrow-child-process';

// TypeScript knows the exact return type
const result = execSync('echo "Hello"', { encoding: 'utf8' });
// result is Result<string, ProcessError>

if (result.isOk()) {
  // TypeScript knows result.value is string
  console.log(result.value.toUpperCase());
}
```

## Comparison with Native child_process

| Feature | Native child_process | @jvens/neverthrow-child-process |
|---------|---------------------|----------------------------------|
| Error handling | Exceptions & callbacks | Result types |
| Type safety | Basic | Full TypeScript support |
| Error types | Generic Error objects | Structured error classes |
| Async patterns | Callbacks & Promises | ResultAsync |
| Composability | Limited | Full neverthrow ecosystem |

## Examples

### Running Git Commands

```typescript
import { exec } from '@jvens/neverthrow-child-process';

// Get current branch
const branchResult = await exec('git branch --show-current');
const currentBranch = branchResult
  .map(({ stdout }) => stdout.trim())
  .unwrapOr('unknown');

// Get git status
const statusResult = await exec('git status --porcelain');
statusResult
  .map(({ stdout }) => {
    const files = stdout.trim().split('\n').filter(Boolean);
    console.log(`${files.length} changed files`);
  })
  .mapErr(error => {
    console.error('Failed to get git status:', error.message);
  });
```

### Process Management

```typescript
import { spawn, waitForExit } from '@jvens/neverthrow-child-process';

// Start a long-running process
const result = await spawn('node', ['server.js'], {}, { captureStdout: true });

if (result.isOk()) {
  const { process, exitPromise } = result.value;
  
  // Set up signal handling
  process.on('SIGTERM', () => {
    console.log('Process received SIGTERM');
  });
  
  // Wait for process to exit or timeout
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout')), 10000);
  });
  
  try {
    const exitResult = await Promise.race([waitForExit(process), timeoutPromise]);
    if (exitResult.isOk()) {
      console.log('Process completed successfully');
    }
  } catch (error) {
    console.log('Process timed out, killing...');
    process.kill('SIGTERM');
  }
}
```

### File Processing Pipeline

```typescript
import { spawn } from '@jvens/neverthrow-child-process';
import { ResultAsync } from 'neverthrow';

// Process files through a pipeline
const processFile = (filename: string) => {
  return spawn('cat', [filename], {}, { captureStdout: true })
    .andThen(result => {
      return spawn('wc', ['-l'], {}, { captureStdout: true })
        .map(wcResult => ({
          filename,
          content: result.stdout,
          lineCount: parseInt(wcResult.stdout?.trim() || '0')
        }));
    });
};

// Process multiple files
const files = ['file1.txt', 'file2.txt', 'file3.txt'];
const results = await ResultAsync.combine(
  files.map(processFile)
);

results
  .map(fileResults => {
    fileResults.forEach(({ filename, lineCount }) => {
      console.log(`${filename}: ${lineCount} lines`);
    });
  })
  .mapErr(error => {
    console.error('Pipeline failed:', error.message);
  });
```

## Contributing

Contributions are welcome! Please read our contributing guidelines and ensure all tests pass:

```bash
# Clone the repository
git clone https://github.com/jvens/neverthrow-child-process.git
cd neverthrow-child-process

# Install dependencies
npm install

# Run tests
npm test

# Run type checking
npm run typecheck

# Run linting
npm run lint

# Build the package
npm run build
```

## License

MIT © [jvens](https://github.com/jvens)

## Related Projects

- [neverthrow](https://github.com/supermacro/neverthrow) - The core Result type library
- [@jvens/neverthrow-fs](https://github.com/jvens/neverthrow-fs) - File system operations with Result types