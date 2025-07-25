import type {
  ChildProcess,
  ExecOptions as NodeExecOptions,
  ExecFileOptions as NodeExecFileOptions,
  ForkOptions as NodeForkOptions,
  SpawnOptions as NodeSpawnOptions,
  SpawnSyncOptions as NodeSpawnSyncOptions,
  ExecSyncOptions as NodeExecSyncOptions,
  ExecFileSyncOptions as NodeExecFileSyncOptions,
  SpawnSyncReturns as NodeSpawnSyncReturns,
  Serializable,
  StdioOptions,
} from 'node:child_process';

/**
 * Re-export common child_process types for convenience
 */
export type {
  ChildProcess,
  Serializable,
  StdioOptions,
};

/**
 * Options for exec operations
 */
export interface ExecOptions extends NodeExecOptions {
  /** Optional timeout in milliseconds */
  timeout?: number;
  /** Maximum amount of data in bytes allowed on stdout */
  maxBuffer?: number;
  /** Default: 'utf8' */
  encoding?: BufferEncoding;
}

/**
 * Options for execFile operations
 */
export interface ExecFileOptions extends NodeExecFileOptions {
  /** Optional timeout in milliseconds */
  timeout?: number;
  /** Maximum amount of data in bytes allowed on stdout or stderr */
  maxBuffer?: number;
  /** Default: 'utf8' */
  encoding?: BufferEncoding;
}

/**
 * Options for spawn operations
 */
export interface SpawnOptions extends NodeSpawnOptions {
  /** If true, runs command inside of a shell */
  shell?: boolean | string;
  /** Optional timeout in milliseconds */
  timeout?: number;
}

/**
 * Options for fork operations
 */
export interface ForkOptions extends NodeForkOptions {
  /** Silent mode - pipes stdout/stderr to parent */
  silent?: boolean;
  /** Optional timeout in milliseconds */
  timeout?: number;
}

/**
 * Options for synchronous exec operations
 */
export interface ExecSyncOptions extends NodeExecSyncOptions {
  /** Optional timeout in milliseconds */
  timeout?: number;
  /** Maximum amount of data in bytes allowed on stdout */
  maxBuffer?: number;
  /** Default: 'utf8' */
  encoding?: BufferEncoding;
}

/**
 * Options for synchronous execFile operations
 */
export interface ExecFileSyncOptions extends NodeExecFileSyncOptions {
  /** Optional timeout in milliseconds */
  timeout?: number;
  /** Maximum amount of data in bytes allowed on stdout */
  maxBuffer?: number;
  /** Default: 'utf8' */
  encoding?: BufferEncoding;
}

/**
 * Options for synchronous spawn operations
 */
export interface SpawnSyncOptions extends NodeSpawnSyncOptions {
  /** Optional timeout in milliseconds */
  timeout?: number;
  /** Default: 'utf8' */
  encoding?: BufferEncoding;
  /** Maximum amount of data in bytes allowed on stdout or stderr */
  maxBuffer?: number;
}

/**
 * Result of exec/execFile operations
 */
export interface ExecResult {
  /** The stdout from the command */
  stdout: string;
  /** The stderr from the command */
  stderr: string;
}

/**
 * Result of execSync/execFileSync operations
 */
export type ExecSyncResult = string | Buffer;

/**
 * Enhanced spawn sync returns with better typing
 */
export interface SpawnSyncReturns<T = Buffer | string> extends NodeSpawnSyncReturns<T> {
  /** The exit code of the subprocess, or null if the subprocess was killed by a signal */
  status: number | null;
  /** The signal used to kill the subprocess, or null if the subprocess exited normally */
  signal: NodeJS.Signals | null;
  /** The stdout from the command */
  stdout: T;
  /** The stderr from the command */
  stderr: T;
}

/**
 * Result of fork operations - returns the child process
 */
export type ForkResult = ChildProcess;

/**
 * Options for handling child process streams
 */
export interface StreamOptions {
  /** Whether to capture stdout */
  captureStdout?: boolean;
  /** Whether to capture stderr */
  captureStderr?: boolean;
  /** Maximum buffer size for captured streams */
  maxBuffer?: number;
}

/**
 * Extended spawn result with stream handling
 */
export interface SpawnResult {
  /** The spawned child process */
  process: ChildProcess;
  /** Promise that resolves when the process exits */
  exitPromise: Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
  }>;
  /** Captured stdout if captureStdout was true */
  stdout?: Promise<string>;
  /** Captured stderr if captureStderr was true */
  stderr?: Promise<string>;
}