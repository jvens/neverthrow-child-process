/**
 * @module @jvens/neverthrow-child-process
 *
 * A type-safe wrapper around Node.js child_process APIs using neverthrow's Result types.
 *
 * This library provides:
 * - Synchronous child_process operations that return `Result<T, ProcessError>`
 * - Asynchronous child_process operations that return `ResultAsync<T, ProcessError>`
 * - Consistent error handling across all child process operations
 * - Full TypeScript support with accurate type definitions
 *
 * @example
 * ```typescript
 * // Main import (recommended) - imports both sync and async functions
 * import { exec, execSync, spawn, spawnSync } from '@jvens/neverthrow-child-process';
 *
 * // Or import from specific modules
 * import { execSync } from '@jvens/neverthrow-child-process/sync';
 * import { exec } from '@jvens/neverthrow-child-process/async';
 *
 * // Synchronous usage
 * const result = execSync('echo "Hello World"');
 * if (result.isOk()) {
 *   console.log(result.value.toString()); // "Hello World\n"
 * } else {
 *   console.error(result.error.message);
 * }
 *
 * // Asynchronous usage
 * const asyncResult = await exec('echo "Hello World"');
 * asyncResult
 *   .map(({ stdout }) => console.log(stdout)) // "Hello World\n"
 *   .mapErr(error => console.error(error.message));
 * ```
 */

// Re-export everything from sync and async modules
export * from './sync';
export * as sync from './sync';
export * from './async';
export * as async from './async';

// Re-export error types and utilities
export * from './errors';
export type { ProcessErrorName } from './errors';

// Re-export type definitions
export * from './types';
