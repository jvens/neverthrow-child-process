import { execSync, execFileSync, spawnSync } from '../sync';
import { ProcessNotFoundError, NonZeroExitError } from '../errors';

describe('Sync child process wrappers', () => {
  describe('execSync', () => {
    it('should execute simple command successfully', () => {
      const result = execSync('echo "Hello World"');
      
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString().trim()).toBe('Hello World');
      }
    });

    it('should handle command with encoding option', () => {
      const result = execSync('echo "Hello World"', { encoding: 'utf8' });
      
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(typeof result.value).toBe('string');
        expect(result.value.toString().trim()).toBe('Hello World');
      }
    });

    it('should return error for non-existent command', () => {
      const result = execSync('nonexistent-command-12345');
      
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        // Command not found can be either ProcessNotFoundError or NonZeroExitError depending on shell
        expect(result.error.name).toMatch(/ProcessNotFoundError|NonZeroExitError/);
      }
    });

    it('should handle non-zero exit codes', () => {
      const result = execSync('node -e "process.exit(1)"');
      
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NonZeroExitError);
        expect(result.error.exitCode).toBe(1);
      }
    });

    it('should capture stderr in non-zero exit error', () => {
      const result = execSync('node -e "console.error(\'Error message\'); process.exit(1)"');
      
      expect(result.isErr()).toBe(true);
      if (result.isErr() && result.error instanceof NonZeroExitError) {
        expect(result.error.stderr).toContain('Error message');
      }
    });
  });

  describe('execFileSync', () => {
    it('should execute node with version flag', () => {
      const result = execFileSync('node', ['--version']);
      
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString()).toMatch(/^v\d+\.\d+\.\d+/);
      }
    });

    it('should execute node with eval flag', () => {
      const result = execFileSync('node', ['-e', 'console.log("Hello from execFile")'], { encoding: 'utf8' });
      
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.toString().trim()).toBe('Hello from execFile');
      }
    });

    it('should return error for non-existent file', () => {
      const result = execFileSync('nonexistent-file-12345');
      
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ProcessNotFoundError);
      }
    });

    it('should handle non-zero exit codes from execFile', () => {
      const result = execFileSync('node', ['-e', 'process.exit(2)']);
      
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NonZeroExitError);
        expect(result.error.exitCode).toBe(2);
      }
    });
  });

  describe('spawnSync', () => {
    it('should spawn echo command successfully', () => {
      const result = spawnSync('echo', ['Hello', 'Spawn'], { encoding: 'utf8' });
      
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe(0);
        expect(result.value.stdout.toString().trim()).toBe('Hello Spawn');
        expect(result.value.signal).toBeNull();
      }
    });

    it('should spawn node command with arguments', () => {
      const result = spawnSync('node', ['--version'], { encoding: 'utf8' });
      
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.status).toBe(0);
        expect(result.value.stdout.toString()).toMatch(/^v\d+\.\d+\.\d+/);
      }
    });

    it('should return error for non-existent command', () => {
      const result = spawnSync('nonexistent-command-12345');
      
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(ProcessNotFoundError);
      }
    });

    it('should handle non-zero exit codes from spawn', () => {
      const result = spawnSync('node', ['-e', 'process.exit(3)']);
      
      expect(result.isErr()).toBe(true);
      if (result.isErr()) {
        expect(result.error).toBeInstanceOf(NonZeroExitError);
        expect(result.error.exitCode).toBe(3);
      }
    });

    it('should capture stderr in spawn', () => {
      const result = spawnSync('node', ['-e', 'console.error("Spawn error"); process.exit(1)'], { encoding: 'utf8' });
      
      expect(result.isErr()).toBe(true);
      if (result.isErr() && result.error instanceof NonZeroExitError) {
        expect(result.error.stderr).toContain('Spawn error');
      }
    });

    it('should work with shell option', () => {
      const result = spawnSync('echo "Shell test"', [], { shell: true, encoding: 'utf8' });
      
      expect(result.isOk()).toBe(true);
      if (result.isOk()) {
        expect(result.value.stdout.toString().trim()).toBe('Shell test');
      }
    });

    it('should respect timeout option', () => {
      // This test uses a short timeout to ensure it times out quickly
      const result = spawnSync('node', ['-e', 'setTimeout(() => {}, 2000)'], { timeout: 100 });
      
      expect(result.isErr()).toBe(true);
      // The exact error type may vary depending on how the timeout is handled
    }, 5000); // Give Jest more time for this test
  });
});