import { Result, ResultAsync } from 'neverthrow';

/**
 * Union type of all possible error kinds
 */
export type ProcessErrorName =
  | 'ProcessNotFoundError'
  | 'PermissionDeniedError'
  | 'ProcessTimeoutError'
  | 'ProcessKilledError'
  | 'NonZeroExitError'
  | 'InvalidArgumentError'
  | 'SpawnError'
  | 'MaxBufferExceededError'
  | 'UnknownError';

/**
 * Base interface for all child process errors.
 * Provides a consistent structure for error handling across the library.
 */
export interface ProcessError extends Error {
  /** The type of error that occurred */
  readonly name: ProcessErrorName;
  /** Human-readable error message */
  readonly message: string;
  /** The underlying cause of the error, if available */
  readonly cause?: unknown;
  /** The command that was executed */
  readonly command?: string;
  /** The arguments passed to the command */
  readonly args?: readonly string[];
  /** The system error code, if applicable */
  readonly code?: string | number;
  /** The signal that terminated the process, if applicable */
  readonly signal?: NodeJS.Signals | null;
  /** The exit code of the process, if applicable */
  readonly exitCode?: number | null;
  /** Whether the process was killed */
  readonly killed?: boolean;
}

/**
 * Error thrown when the executable/command cannot be found.
 * Corresponds to Node.js ENOENT error.
 */
export class ProcessNotFoundError extends Error implements ProcessError {
  readonly name = 'ProcessNotFoundError' as const;
  constructor(
    readonly message: string,
    readonly command?: string,
    readonly args?: readonly string[],
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Error thrown when permission is denied to execute the command.
 * Corresponds to Node.js EACCES and EPERM errors.
 */
export class PermissionDeniedError extends Error implements ProcessError {
  readonly name = 'PermissionDeniedError' as const;
  constructor(
    readonly message: string,
    readonly command?: string,
    readonly args?: readonly string[],
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Error thrown when a process times out.
 */
export class ProcessTimeoutError extends Error implements ProcessError {
  readonly name = 'ProcessTimeoutError' as const;
  constructor(
    readonly message: string,
    readonly command?: string,
    readonly args?: readonly string[],
    readonly timeout?: number,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Error thrown when a process is killed by a signal.
 */
export class ProcessKilledError extends Error implements ProcessError {
  readonly name = 'ProcessKilledError' as const;
  readonly killed = true;
  constructor(
    readonly message: string,
    readonly command?: string,
    readonly args?: readonly string[],
    readonly signal?: NodeJS.Signals | null,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Error thrown when a process exits with a non-zero exit code.
 */
export class NonZeroExitError extends Error implements ProcessError {
  readonly name = 'NonZeroExitError' as const;
  constructor(
    readonly message: string,
    readonly exitCode: number,
    readonly command?: string,
    readonly args?: readonly string[],
    readonly stdout?: string,
    readonly stderr?: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Error thrown when invalid arguments are provided to a child process operation.
 */
export class InvalidArgumentError extends Error implements ProcessError {
  readonly name = 'InvalidArgumentError' as const;
  constructor(
    readonly message: string,
    readonly command?: string,
    readonly args?: readonly string[],
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * General spawn error for child process operations.
 * Used for errors during process spawning.
 */
export class SpawnError extends Error implements ProcessError {
  readonly name = 'SpawnError' as const;
  constructor(
    readonly message: string,
    readonly command?: string,
    readonly args?: readonly string[],
    readonly code?: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Error thrown when the stdout/stderr buffer exceeds the maximum size.
 */
export class MaxBufferExceededError extends Error implements ProcessError {
  readonly name = 'MaxBufferExceededError' as const;
  constructor(
    readonly message: string,
    readonly command?: string,
    readonly args?: readonly string[],
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/**
 * Error used when the underlying error type cannot be determined.
 * This is a catch-all for unexpected error conditions.
 */
export class UnknownError extends Error implements ProcessError {
  readonly name = 'UnknownError' as const;
  constructor(
    readonly message: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

interface ExecErrorLike {
  message?: string;
  code?: string | number | null;
  signal?: NodeJS.Signals | null;
  killed?: boolean;
  stdout?: string;
  stderr?: string;
}

/**
 * Maps Node.js child process errors to our custom error types.
 * This provides a consistent error interface regardless of the underlying error.
 *
 * @param error - The error thrown by Node.js child_process operations
 * @param command - The command that was executed
 * @param args - The arguments passed to the command
 * @returns A typed ProcessError instance
 */
export function mapNodeError(
  error: unknown,
  command?: string,
  args?: readonly string[],
): ProcessError {
  // Handle ExecException errors (from exec/execFile)
  if (error && typeof error === 'object') {
    const execErr = error as ExecErrorLike;
    const message = execErr.message ?? 'Unknown error';

    // Check for signal termination first (can exist without code)
    if (execErr.signal) {
      return new ProcessKilledError(message, command, args, execErr.signal, error);
    }

    // Check for specific error codes (string codes)
    if (execErr.code === 'ENOENT') {
      return new ProcessNotFoundError(message, command, args, error);
    }
    if (execErr.code === 'EACCES' || execErr.code === 'EPERM') {
      return new PermissionDeniedError(message, command, args, error);
    }
    if (execErr.code === 'ETIMEDOUT') {
      return new ProcessTimeoutError(message, command, args, undefined, error);
    }
    if (typeof execErr.code === 'string' && execErr.code.startsWith('ERR_CHILD_PROCESS_')) {
      return new SpawnError(message, command, args, execErr.code, error);
    }

    // Check for non-zero exit codes (numeric codes)
    if (typeof execErr.code === 'number' && execErr.code !== 0) {
      return new NonZeroExitError(
        message,
        execErr.code,
        command,
        args,
        undefined,
        undefined,
        error,
      );
    }
  }

  // Handle Error objects with specific messages
  if (error instanceof Error) {
    const message = error.message;

    // Check for max buffer exceeded error
    if (
      message.includes('maxBuffer') ||
      message.includes('stdout maxBuffer') ||
      message.includes('stderr maxBuffer')
    ) {
      return new MaxBufferExceededError(message, command, args, error);
    }

    // Check for timeout in error message
    if (message.includes('timeout') || message.includes('ETIMEDOUT')) {
      return new ProcessTimeoutError(message, command, args, undefined, error);
    }

    // Generic spawn error
    if (message.includes('spawn')) {
      return new SpawnError(message, command, args, undefined, error);
    }
  }

  // Fallback for non-Error objects
  const message = error instanceof Error ? error.message : String(error);
  return new UnknownError(message, error);
}

/**
 * Type alias for synchronous child process operation results.
 * All sync operations return a Result containing either the success value or a ProcessError.
 */
export type ProcessResult<T> = Result<T, ProcessError>;

/**
 * Type alias for asynchronous child process operation results.
 * All async operations return a ResultAsync containing either the success value or a ProcessError.
 */
export type ProcessResultAsync<T> = ResultAsync<T, ProcessError>;
