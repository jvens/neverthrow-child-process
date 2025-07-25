import * as cp from 'node:child_process';
import { ok, err } from 'neverthrow';
import { mapNodeError, NonZeroExitError } from './errors';
import type { ProcessResult } from './errors';
import type {
  ExecSyncOptions,
  ExecFileSyncOptions,
  SpawnSyncOptions,
  SpawnSyncReturns,
  ExecSyncResult,
} from './types';

/**
 * Synchronously executes a command in a shell and returns the output.
 * @param command - The command to run, with space-separated arguments
 * @param options - Optional execution options
 * @returns Result containing the command output or a ProcessError
 * 
 * @example
 * ```typescript
 * const result = execSync('echo "Hello World"');
 * if (result.isOk()) {
 *   console.log(result.value); // "Hello World\n"
 * }
 * ```
 */
export function execSync(
  command: string,
  options?: ExecSyncOptions,
): ProcessResult<ExecSyncResult> {
  try {
    const output = cp.execSync(command, options);
    return ok(output);
  } catch (error) {
    // Check if it's a non-zero exit with output
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof error.status === 'number' &&
      error.status !== 0 &&
      'stdout' in error
    ) {
      const stdout = error.stdout?.toString() || '';
      const stderr = (error as any).stderr?.toString() || '';
      return err(
        new NonZeroExitError(
          `Command failed with exit code ${error.status}`,
          error.status as number,
          command,
          [],
          stdout,
          stderr,
          error,
        ),
      );
    }
    return err(mapNodeError(error, command));
  }
}

/**
 * Synchronously executes a file with the given arguments.
 * Similar to execSync but does not spawn a shell by default.
 * @param file - The file to execute
 * @param args - Arguments to pass to the file
 * @param options - Optional execution options
 * @returns Result containing the command output or a ProcessError
 * 
 * @example
 * ```typescript
 * const result = execFileSync('node', ['--version']);
 * if (result.isOk()) {
 *   console.log(result.value); // "v20.0.0\n"
 * }
 * ```
 */
export function execFileSync(
  file: string,
  args?: readonly string[],
  options?: ExecFileSyncOptions,
): ProcessResult<ExecSyncResult> {
  try {
    const output = cp.execFileSync(file, args, options);
    return ok(output);
  } catch (error) {
    // Check if it's a non-zero exit with output
    if (
      error &&
      typeof error === 'object' &&
      'status' in error &&
      typeof error.status === 'number' &&
      error.status !== 0 &&
      'stdout' in error
    ) {
      const stdout = error.stdout?.toString() || '';
      const stderr = (error as any).stderr?.toString() || '';
      return err(
        new NonZeroExitError(
          `Command failed with exit code ${error.status}`,
          error.status as number,
          file,
          args,
          stdout,
          stderr,
          error,
        ),
      );
    }
    return err(mapNodeError(error, file, args));
  }
}

/**
 * Synchronously spawns a child process and waits for it to complete.
 * Provides the most control over how the child process is executed.
 * @param command - The command to run
 * @param args - List of string arguments
 * @param options - Optional spawn options
 * @returns Result containing spawn result details or a ProcessError
 * 
 * @example
 * ```typescript
 * const result = spawnSync('ls', ['-la']);
 * if (result.isOk()) {
 *   console.log(result.value.stdout.toString());
 *   console.log('Exit code:', result.value.status);
 * }
 * ```
 */
export function spawnSync<T = Buffer>(
  command: string,
  args?: readonly string[],
  options?: SpawnSyncOptions,
): ProcessResult<SpawnSyncReturns<T>> {
  try {
    const result = cp.spawnSync(command, args, options) as SpawnSyncReturns<T>;

    // Check for spawn errors
    if (result.error) {
      return err(mapNodeError(result.error, command, args));
    }

    // Check for non-zero exit code
    if (result.status !== null && result.status !== 0) {
      return err(
        new NonZeroExitError(
          `Command failed with exit code ${result.status}`,
          result.status,
          command,
          args,
          result.stdout?.toString(),
          result.stderr?.toString(),
        ),
      );
    }

    // Check if killed by signal
    if (result.signal) {
      return err(
        mapNodeError(
          new Error(`Process killed by signal ${result.signal}`),
          command,
          args,
        ),
      );
    }

    return ok(result);
  } catch (error) {
    return err(mapNodeError(error, command, args));
  }
}