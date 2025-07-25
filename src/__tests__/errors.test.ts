import {
  ProcessNotFoundError,
  PermissionDeniedError,
  ProcessTimeoutError,
  ProcessKilledError,
  NonZeroExitError,
  InvalidArgumentError,
  SpawnError,
  MaxBufferExceededError,
  UnknownError,
  mapNodeError,
} from '../errors';

describe('Process error classes', () => {
  describe('ProcessNotFoundError', () => {
    it('should create error with correct properties', () => {
      const error = new ProcessNotFoundError('Command not found', 'nonexistent-cmd', ['arg1']);
      expect(error.name).toBe('ProcessNotFoundError');
      expect(error.message).toBe('Command not found');
      expect(error.command).toBe('nonexistent-cmd');
      expect(error.args).toEqual(['arg1']);
    });
  });

  describe('PermissionDeniedError', () => {
    it('should create error with correct properties', () => {
      const error = new PermissionDeniedError('Permission denied', 'restricted-cmd');
      expect(error.name).toBe('PermissionDeniedError');
      expect(error.message).toBe('Permission denied');
      expect(error.command).toBe('restricted-cmd');
    });
  });

  describe('ProcessTimeoutError', () => {
    it('should create error with correct properties', () => {
      const error = new ProcessTimeoutError('Process timed out', 'slow-cmd', ['arg1'], 5000);
      expect(error.name).toBe('ProcessTimeoutError');
      expect(error.message).toBe('Process timed out');
      expect(error.command).toBe('slow-cmd');
      expect(error.timeout).toBe(5000);
    });
  });

  describe('ProcessKilledError', () => {
    it('should create error with correct properties', () => {
      const error = new ProcessKilledError('Process killed', 'killed-cmd', [], 'SIGTERM');
      expect(error.name).toBe('ProcessKilledError');
      expect(error.message).toBe('Process killed');
      expect(error.signal).toBe('SIGTERM');
      expect(error.killed).toBe(true);
    });
  });

  describe('NonZeroExitError', () => {
    it('should create error with correct properties', () => {
      const error = new NonZeroExitError(
        'Command failed',
        1,
        'failed-cmd',
        ['arg1'],
        'stdout content',
        'stderr content',
      );
      expect(error.name).toBe('NonZeroExitError');
      expect(error.message).toBe('Command failed');
      expect(error.exitCode).toBe(1);
      expect(error.command).toBe('failed-cmd');
      expect(error.stdout).toBe('stdout content');
      expect(error.stderr).toBe('stderr content');
    });
  });

  describe('InvalidArgumentError', () => {
    it('should create error with correct properties', () => {
      const error = new InvalidArgumentError('Invalid arguments', 'cmd', ['bad-arg']);
      expect(error.name).toBe('InvalidArgumentError');
      expect(error.message).toBe('Invalid arguments');
      expect(error.command).toBe('cmd');
      expect(error.args).toEqual(['bad-arg']);
    });
  });

  describe('SpawnError', () => {
    it('should create error with correct properties', () => {
      const error = new SpawnError('Spawn failed', 'cmd', ['arg'], 'ENOENT');
      expect(error.name).toBe('SpawnError');
      expect(error.message).toBe('Spawn failed');
      expect(error.command).toBe('cmd');
      expect(error.code).toBe('ENOENT');
    });
  });

  describe('MaxBufferExceededError', () => {
    it('should create error with correct properties', () => {
      const error = new MaxBufferExceededError('Buffer exceeded', 'cmd');
      expect(error.name).toBe('MaxBufferExceededError');
      expect(error.message).toBe('Buffer exceeded');
      expect(error.command).toBe('cmd');
    });
  });

  describe('UnknownError', () => {
    it('should create error with correct properties', () => {
      const error = new UnknownError('Unknown error occurred');
      expect(error.name).toBe('UnknownError');
      expect(error.message).toBe('Unknown error occurred');
    });
  });
});

describe('mapNodeError', () => {
  it('should map ENOENT error to ProcessNotFoundError', () => {
    const nodeError = { code: 'ENOENT', message: 'Command not found' };
    const mapped = mapNodeError(nodeError, 'test-cmd', ['arg1']);

    expect(mapped).toBeInstanceOf(ProcessNotFoundError);
    expect(mapped.message).toBe('Command not found');
    expect(mapped.command).toBe('test-cmd');
    expect(mapped.args).toEqual(['arg1']);
  });

  it('should map EACCES error to PermissionDeniedError', () => {
    const nodeError = { code: 'EACCES', message: 'Permission denied' };
    const mapped = mapNodeError(nodeError, 'test-cmd');

    expect(mapped).toBeInstanceOf(PermissionDeniedError);
    expect(mapped.message).toBe('Permission denied');
  });

  it('should map EPERM error to PermissionDeniedError', () => {
    const nodeError = { code: 'EPERM', message: 'Operation not permitted' };
    const mapped = mapNodeError(nodeError, 'test-cmd');

    expect(mapped).toBeInstanceOf(PermissionDeniedError);
    expect(mapped.message).toBe('Operation not permitted');
  });

  it('should map ETIMEDOUT error to ProcessTimeoutError', () => {
    const nodeError = { code: 'ETIMEDOUT', message: 'Operation timed out' };
    const mapped = mapNodeError(nodeError, 'test-cmd');

    expect(mapped).toBeInstanceOf(ProcessTimeoutError);
    expect(mapped.message).toBe('Operation timed out');
  });

  it('should map ERR_CHILD_PROCESS_ errors to SpawnError', () => {
    const nodeError = {
      code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
      message: 'stdio maxBuffer exceeded',
    };
    const mapped = mapNodeError(nodeError, 'test-cmd');

    expect(mapped).toBeInstanceOf(SpawnError);
    expect(mapped.message).toBe('stdio maxBuffer exceeded');
  });

  it('should map signal termination to ProcessKilledError', () => {
    const nodeError = { signal: 'SIGTERM', message: 'Process terminated' };
    const mapped = mapNodeError(nodeError, 'test-cmd');

    expect(mapped).toBeInstanceOf(ProcessKilledError);
    expect(mapped.signal).toBe('SIGTERM');
  });

  it('should map non-zero exit codes to NonZeroExitError', () => {
    const nodeError = { code: 1, message: 'Command failed' };
    const mapped = mapNodeError(nodeError, 'test-cmd');

    expect(mapped).toBeInstanceOf(NonZeroExitError);
    expect(mapped.exitCode).toBe(1);
  });

  it('should map maxBuffer error messages to MaxBufferExceededError', () => {
    const nodeError = new Error('stdout maxBuffer exceeded');
    const mapped = mapNodeError(nodeError, 'test-cmd');

    expect(mapped).toBeInstanceOf(MaxBufferExceededError);
    expect(mapped.message).toBe('stdout maxBuffer exceeded');
  });

  it('should map timeout error messages to ProcessTimeoutError', () => {
    const nodeError = new Error('Process timeout');
    const mapped = mapNodeError(nodeError, 'test-cmd');

    expect(mapped).toBeInstanceOf(ProcessTimeoutError);
    expect(mapped.message).toBe('Process timeout');
  });

  it('should map spawn error messages to SpawnError', () => {
    const nodeError = new Error('spawn ENOENT');
    const mapped = mapNodeError(nodeError, 'test-cmd');

    expect(mapped).toBeInstanceOf(SpawnError);
    expect(mapped.message).toBe('spawn ENOENT');
  });

  it('should map unknown errors to UnknownError', () => {
    const nodeError = new Error('Some random error');
    const mapped = mapNodeError(nodeError, 'test-cmd');

    expect(mapped).toBeInstanceOf(UnknownError);
    expect(mapped.message).toBe('Some random error');
  });

  it('should handle non-Error objects', () => {
    const nodeError = 'String error';
    const mapped = mapNodeError(nodeError, 'test-cmd');

    expect(mapped).toBeInstanceOf(UnknownError);
    expect(mapped.message).toBe('String error');
  });

  it('should handle null/undefined errors', () => {
    const mapped = mapNodeError(null, 'test-cmd');

    expect(mapped).toBeInstanceOf(UnknownError);
    expect(mapped.message).toBe('null');
  });

  it('should handle error with no message property', () => {
    const errorWithoutMessage = { code: 'ENOENT' };
    const mapped = mapNodeError(errorWithoutMessage, 'test-cmd');

    expect(mapped.message).toBe('Unknown error');
    expect(mapped.name).toBe('ProcessNotFoundError');
  });

  it('should handle error with undefined message', () => {
    const errorWithUndefinedMessage = { code: 'EACCES', message: undefined };
    const mapped = mapNodeError(errorWithUndefinedMessage, 'test-cmd');

    expect(mapped.message).toBe('Unknown error');
    expect(mapped.name).toBe('PermissionDeniedError');
  });

  it('should handle error with null message', () => {
    const errorWithNullMessage = { code: 'EPERM', message: null };
    const mapped = mapNodeError(errorWithNullMessage, 'test-cmd');

    expect(mapped.message).toBe('Unknown error');
    expect(mapped.name).toBe('PermissionDeniedError');
  });

  it('should handle error with empty string message', () => {
    const errorWithEmptyMessage = { code: 'ETIMEDOUT', message: '' };
    const mapped = mapNodeError(errorWithEmptyMessage, 'test-cmd');

    expect(mapped.message).toBe('');
    expect(mapped.name).toBe('ProcessTimeoutError');
  });
});
