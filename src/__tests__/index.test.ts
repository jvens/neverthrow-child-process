import * as index from '../index';
import * as sync from '../sync';
import * as async from '../async';
import * as errors from '../errors';
// import * as types from '../types'; // Types are compile-time only

describe('Package exports', () => {
  it('should export sync functions', () => {
    expect(index.execSync).toBe(sync.execSync);
    expect(index.execFileSync).toBe(sync.execFileSync);
    expect(index.spawnSync).toBe(sync.spawnSync);
  });

  it('should export async functions', () => {
    expect(index.exec).toBe(async.exec);
    expect(index.execFile).toBe(async.execFile);
    expect(index.spawn).toBe(async.spawn);
    expect(index.fork).toBe(async.fork);
    expect(index.waitForExit).toBe(async.waitForExit);
  });

  it('should export sync module', () => {
    expect(index.sync.execSync).toBe(sync.execSync);
    expect(index.sync.execFileSync).toBe(sync.execFileSync);
    expect(index.sync.spawnSync).toBe(sync.spawnSync);
  });

  it('should export async module', () => {
    expect(index.async.exec).toBe(async.exec);
    expect(index.async.execFile).toBe(async.execFile);
    expect(index.async.spawn).toBe(async.spawn);
    expect(index.async.fork).toBe(async.fork);
    expect(index.async.waitForExit).toBe(async.waitForExit);
  });

  it('should export error classes', () => {
    expect(index.ProcessNotFoundError).toBe(errors.ProcessNotFoundError);
    expect(index.PermissionDeniedError).toBe(errors.PermissionDeniedError);
    expect(index.ProcessTimeoutError).toBe(errors.ProcessTimeoutError);
    expect(index.ProcessKilledError).toBe(errors.ProcessKilledError);
    expect(index.NonZeroExitError).toBe(errors.NonZeroExitError);
    expect(index.InvalidArgumentError).toBe(errors.InvalidArgumentError);
    expect(index.SpawnError).toBe(errors.SpawnError);
    expect(index.MaxBufferExceededError).toBe(errors.MaxBufferExceededError);
    expect(index.UnknownError).toBe(errors.UnknownError);
    expect(index.mapNodeError).toBe(errors.mapNodeError);
  });

  it('should export types', () => {
    // Types are compile-time only, so we just check that imports work
    // by ensuring the module doesn't throw when imported
    expect(typeof index).toBe('object');
  });
});

describe('Integration tests', () => {
  it('should work with direct imports from main package', () => {
    const result = index.execSync('echo "Integration test"', { encoding: 'utf8' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.toString().trim()).toBe('Integration test');
    }
  });

  it('should work with async imports from main package', async () => {
    const result = await index.exec('echo "Async integration test"');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.stdout.trim()).toBe('Async integration test');
    }
  });

  it('should work with sync module imports', () => {
    const result = index.sync.execSync('echo "Sync module test"', { encoding: 'utf8' });

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.toString().trim()).toBe('Sync module test');
    }
  });

  it('should work with async module imports', async () => {
    const result = await index.async.exec('echo "Async module test"');

    expect(result.isOk()).toBe(true);
    if (result.isOk()) {
      expect(result.value.stdout.trim()).toBe('Async module test');
    }
  });

  it('should handle errors properly with main package imports', () => {
    const result = index.execSync('nonexistent-integration-command');

    expect(result.isErr()).toBe(true);
    if (result.isErr()) {
      // Command not found can be either ProcessNotFoundError or NonZeroExitError depending on shell
      expect(result.error.name).toMatch(/ProcessNotFoundError|NonZeroExitError/);
    }
  });
});
