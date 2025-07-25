import * as cp from 'node:child_process';
import { promisify } from 'node:util';
import { ResultAsync } from 'neverthrow';
import { mapNodeError, NonZeroExitError, ProcessKilledError, ProcessError } from './errors';
import type { ProcessResultAsync } from './errors';
import type {
  ExecOptions,
  ExecFileOptions,
  SpawnOptions,
  ForkOptions,
  ExecResult,
  ChildProcess,
  StreamOptions,
  SpawnResult,
} from './types';

interface AsyncErrorWithOutput {
  code?: string | number | null;
  signal?: NodeJS.Signals | null;
  stdout?: string | Buffer;
  stderr?: string | Buffer;
  message?: string;
}

// Promisified versions of callback-based functions
const execPromise = promisify(cp.exec);
const execFilePromise = promisify(cp.execFile);

/**
 * Asynchronously executes a command in a shell and returns the output.
 * @param command - The command to run, with space-separated arguments
 * @param options - Optional execution options
 * @returns ResultAsync containing the command output or a ProcessError
 *
 * @example
 * ```typescript
 * const result = await exec('echo "Hello World"');
 * result
 *   .map(({ stdout }) => console.log(stdout)) // "Hello World\n"
 *   .mapErr(error => console.error(error.message));
 * ```
 */
export function exec(command: string, options?: ExecOptions): ProcessResultAsync<ExecResult> {
  return ResultAsync.fromPromise(
    execPromise(command, options).then(({ stdout, stderr }) => ({
      stdout: stdout.toString(),
      stderr: stderr.toString(),
    })),
    (error) => {
      // Check if it's a non-zero exit with output
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'number' &&
        error.code !== 0
      ) {
        const execErr = error as AsyncErrorWithOutput;
        return new NonZeroExitError(
          `Command failed with exit code ${execErr.code}`,
          execErr.code as number,
          command,
          [],
          execErr.stdout?.toString() ?? '',
          execErr.stderr?.toString() ?? '',
          error,
        );
      }
      return mapNodeError(error, command);
    },
  );
}

/**
 * Asynchronously executes a file with the given arguments.
 * Similar to exec but does not spawn a shell by default.
 * @param file - The file to execute
 * @param args - Arguments to pass to the file
 * @param options - Optional execution options
 * @returns ResultAsync containing the command output or a ProcessError
 *
 * @example
 * ```typescript
 * const result = await execFile('node', ['--version']);
 * result
 *   .map(({ stdout }) => console.log(stdout)) // "v20.0.0\n"
 *   .mapErr(error => console.error(error.message));
 * ```
 */
export function execFile(
  file: string,
  args?: readonly string[],
  options?: ExecFileOptions,
): ProcessResultAsync<ExecResult> {
  return ResultAsync.fromPromise(
    execFilePromise(file, args, options).then(({ stdout, stderr }) => ({
      stdout: stdout.toString(),
      stderr: stderr.toString(),
    })),
    (error) => {
      // Check if it's a non-zero exit with output
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        typeof error.code === 'number' &&
        error.code !== 0
      ) {
        const execErr = error as AsyncErrorWithOutput;
        return new NonZeroExitError(
          `Command failed with exit code ${execErr.code}`,
          execErr.code as number,
          file,
          args,
          execErr.stdout?.toString() ?? '',
          execErr.stderr?.toString() ?? '',
          error,
        );
      }
      return mapNodeError(error, file, args);
    },
  );
}

/**
 * Spawns a new process with the given command.
 * Provides the most control over how the child process is executed.
 * @param command - The command to run
 * @param args - List of string arguments
 * @param options - Optional spawn options
 * @param streamOptions - Options for capturing stdout/stderr
 * @returns ResultAsync containing the spawned process or a ProcessError
 *
 * @example
 * ```typescript
 * // Basic usage
 * const result = await spawn('ls', ['-la']);
 * if (result.isOk()) {
 *   const { process, exitPromise } = result.value;
 *   const { code } = await exitPromise;
 *   console.log('Exit code:', code);
 * }
 *
 * // With stream capture
 * const result = await spawn('echo', ['Hello'], {}, { captureStdout: true });
 * if (result.isOk()) {
 *   const stdout = await result.value.stdout;
 *   console.log(stdout); // "Hello\n"
 * }
 * ```
 */
export function spawn(
  command: string,
  args?: readonly string[],
  options?: SpawnOptions,
  streamOptions?: StreamOptions,
): ProcessResultAsync<SpawnResult> {
  return ResultAsync.fromSafePromise<SpawnResult, ProcessError>(
    new Promise((resolve, reject) => {
      try {
        const child = cp.spawn(command, args || [], options || {});

        // Handle spawn errors
        child.on('error', (error: Error) => {
          reject(mapNodeError(error, command, args));
        });

        // Set up exit promise
        const exitPromise = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>(
          (exitResolve) => {
            child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
              exitResolve({ code, signal });
            });
          },
        );

        // Set up stream capture if requested
        let stdoutPromise: Promise<string> | undefined;
        let stderrPromise: Promise<string> | undefined;

        if (streamOptions?.captureStdout && child.stdout) {
          const chunks: Buffer[] = [];
          child.stdout.on('data', (chunk: Buffer) => chunks.push(chunk));
          stdoutPromise = new Promise<string>((stdoutResolve) => {
            child.stdout!.on('end', () => {
              stdoutResolve(Buffer.concat(chunks).toString());
            });
          });
        }

        if (streamOptions?.captureStderr && child.stderr) {
          const chunks: Buffer[] = [];
          child.stderr.on('data', (chunk: Buffer) => chunks.push(chunk));
          stderrPromise = new Promise<string>((stderrResolve) => {
            child.stderr!.on('end', () => {
              stderrResolve(Buffer.concat(chunks).toString());
            });
          });
        }

        resolve({
          process: child,
          exitPromise,
          stdout: stdoutPromise,
          stderr: stderrPromise,
        });
      } catch (error) {
        reject(mapNodeError(error, command, args));
      }
    }),
  );
}

/**
 * Spawns a new Node.js process and executes a module.
 * @param modulePath - The module to run in the child
 * @param args - Arguments to pass to the module
 * @param options - Optional fork options
 * @returns ResultAsync containing the forked process or a ProcessError
 *
 * @example
 * ```typescript
 * const result = await fork('./worker.js', ['--port', '3000']);
 * if (result.isOk()) {
 *   const child = result.value;
 *   child.send({ cmd: 'start' });
 *   child.on('message', (msg) => {
 *     console.log('Message from child:', msg);
 *   });
 * }
 * ```
 */
export function fork(
  modulePath: string,
  args?: readonly string[],
  options?: ForkOptions,
): ProcessResultAsync<ChildProcess> {
  return ResultAsync.fromSafePromise(
    new Promise((resolve, reject) => {
      try {
        const child = cp.fork(modulePath, args || [], options || {});

        // Handle spawn errors
        child.on('error', (error: Error) => {
          reject(mapNodeError(error, modulePath, args));
        });

        // Wait for the process to be ready
        // Fork doesn't have a 'spawn' event, so we resolve immediately
        // The error handler above will catch any immediate errors
        resolve(child);
      } catch (error) {
        reject(mapNodeError(error, modulePath, args));
      }
    }),
  );
}

/**
 * Helper function to wait for a child process to exit.
 * @param child - The child process to wait for
 * @returns ResultAsync containing exit code and signal or a ProcessError
 *
 * @example
 * ```typescript
 * const spawnResult = await spawn('sleep', ['1']);
 * if (spawnResult.isOk()) {
 *   const exitResult = await waitForExit(spawnResult.value.process);
 *   exitResult
 *     .map(({ code }) => console.log('Exit code:', code))
 *     .mapErr(error => console.error('Error:', error.message));
 * }
 * ```
 */
export function waitForExit(
  child: ChildProcess,
): ProcessResultAsync<{ code: number | null; signal: NodeJS.Signals | null }> {
  return ResultAsync.fromPromise(
    new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
      child.on('exit', (code: number | null, signal: NodeJS.Signals | null) => {
        if (code !== null && code !== 0) {
          reject(
            new NonZeroExitError(
              `Process exited with code ${code}`,
              code,
              undefined,
              undefined,
              undefined,
              undefined,
            ),
          );
          return;
        }
        if (signal) {
          reject(
            new ProcessKilledError(
              `Process killed by signal ${signal}`,
              undefined,
              undefined,
              signal,
            ),
          );
          return;
        }
        resolve({ code, signal });
      });

      child.on('error', (error) => {
        reject(mapNodeError(error));
      });
    }),
    (error) => {
      // Map errors to ProcessError if they aren't already
      if (error instanceof NonZeroExitError || error instanceof ProcessKilledError) {
        return error as ProcessError;
      }
      return mapNodeError(error);
    },
  );
}
