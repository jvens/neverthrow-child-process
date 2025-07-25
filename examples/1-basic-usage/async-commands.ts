#!/usr/bin/env node --loader ts-node/esm

/**
 * Basic Asynchronous Command Examples
 * 
 * This file demonstrates the asynchronous functions:
 * - exec: Execute shell commands asynchronously
 * - execFile: Execute files/programs directly asynchronously
 * - spawn: Low-level asynchronous process spawning
 * - waitForExit: Wait for process completion
 * 
 * All functions return ResultAsync<T, ProcessError> for type-safe error handling.
 */

import { 
  exec, 
  execFile, 
  spawn, 
  waitForExit,
  ProcessNotFoundError, 
  NonZeroExitError 
} from '../../src/index';
import { ResultAsync } from 'neverthrow';

function separator(title: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${title}`);
  console.log('='.repeat(50));
}

async function runAsyncExamples() {
  separator('1. EXEC EXAMPLES');
  
  // Example 1: Simple async command
  console.log('\n1.1 Simple echo command:');
  const echoResult = await exec('echo "Hello from async exec!"');
  
  if (echoResult.isOk()) {
    console.log('✅ Success:', echoResult.value.stdout.trim());
    console.log('💬 stderr:', echoResult.value.stderr || '(empty)');
  } else {
    console.log('❌ Error:', echoResult.error.message);
  }
  
  // Example 2: Using map/mapErr pattern
  console.log('\n1.2 Date command with map/mapErr:');
  await exec('date')
    .map(({ stdout, stderr }) => {
      console.log('✅ Date:', stdout.trim());
      if (stderr) {
        console.log('⚠️  Warnings:', stderr.trim());
      }
      return stdout;
    })
    .mapErr(error => {
      console.log('❌ Failed to get date:', error.message);
      return error;
    });
  
  // Example 3: Command with timeout
  console.log('\n1.3 Command with timeout:');
  const timeoutResult = await exec('sleep 1', { timeout: 500 });
  
  if (timeoutResult.isErr()) {
    console.log('❌ Command timed out as expected:', timeoutResult.error.message);
  } else {
    console.log('✅ Command completed within timeout');
  }
  
  // Example 4: Handling non-zero exit codes
  console.log('\n1.4 Non-zero exit code:');
  const failResult = await exec('node -e "process.exit(42)"');
  
  if (failResult.isErr()) {
    if (failResult.error instanceof NonZeroExitError) {
      console.log('❌ Exit code:', failResult.error.exitCode);
      console.log('❌ stdout:', failResult.error.stdout || '(empty)');
      console.log('❌ stderr:', failResult.error.stderr || '(empty)');
    }
  }
  
  separator('2. EXECFILE EXAMPLES');
  
  // Example 5: Execute Node.js with arguments
  console.log('\n2.1 Node.js version:');
  const nodeResult = await execFile('node', ['--version']);
  
  nodeResult
    .map(({ stdout }) => {
      console.log('✅ Node.js version:', stdout.trim());
      return stdout;
    })
    .mapErr(error => {
      console.log('❌ Failed to get Node version:', error.message);
      return error;
    });
  
  // Example 6: Complex Node.js execution
  console.log('\n2.2 Node.js with complex script:');
  const complexResult = await execFile('node', [
    '-e',
    `
    console.log('Process ID:', process.pid);
    console.log('Platform:', process.platform);
    console.log('Node version:', process.version);
    console.error('This goes to stderr');
    `
  ]);
  
  if (complexResult.isOk()) {
    console.log('✅ stdout:');
    console.log(complexResult.value.stdout);
    console.log('⚠️  stderr:');
    console.log(complexResult.value.stderr);
  } else {
    console.log('❌ Complex execution failed:', complexResult.error.message);
  }
  
  separator('3. SPAWN EXAMPLES');
  
  // Example 7: Basic spawn
  console.log('\n3.1 Basic spawn:');
  const spawnResult = await spawn('echo', ['Hello', 'from', 'spawn']);
  
  if (spawnResult.isOk()) {
    const { process, exitPromise } = spawnResult.value;
    console.log('✅ Process spawned with PID:', process.pid);
    
    const { code, signal } = await exitPromise;
    console.log('✅ Process exited with code:', code, 'signal:', signal);
  } else {
    console.log('❌ Spawn failed:', spawnResult.error.message);
  }
  
  // Example 8: Spawn with output capture
  console.log('\n3.2 Spawn with output capture:');
  const captureResult = await spawn(
    'node',
    ['-e', 'console.log("Captured output!"); console.error("Error output!");'],
    {},
    { captureStdout: true, captureStderr: true }
  );
  
  if (captureResult.isOk()) {
    const { stdout, stderr, exitPromise } = captureResult.value;
    
    // Wait for process to complete and get output
    const [stdoutData, stderrData] = await Promise.all([
      stdout!,
      stderr!,
      exitPromise
    ]);
    
    console.log('✅ Captured stdout:', stdoutData.trim());
    console.log('✅ Captured stderr:', stderrData.trim());
  } else {
    console.log('❌ Capture spawn failed:', captureResult.error.message);
  }
  
  // Example 9: Real-time output processing
  console.log('\n3.3 Real-time output processing:');
  const realtimeResult = await spawn('node', [
    '-e',
    `
    for (let i = 0; i < 5; i++) {
      console.log('Line', i + 1);
      require('child_process').spawnSync('sleep', ['0.1']);
    }
    `
  ]);
  
  if (realtimeResult.isOk()) {
    const { process } = realtimeResult.value;
    
    // Set up real-time output handling
    if (process.stdout) {
      process.stdout.on('data', (chunk) => {
        console.log('✨ Real-time:', chunk.toString().trim());
      });
    }
    
    // Wait for completion
    const exitResult = await waitForExit(process);
    if (exitResult.isOk()) {
      console.log('✅ Real-time processing completed');
    } else {
      console.log('❌ Real-time processing failed:', exitResult.error.message);
    }
  }
  
  separator('4. PARALLEL EXECUTION');
  
  // Example 10: Parallel command execution
  console.log('\n4.1 Parallel command execution:');
  const startTime = Date.now();
  
  const parallelResults = await ResultAsync.combine([
    exec('sleep 1; echo "Task 1 complete"'),
    exec('sleep 1; echo "Task 2 complete"'),
    exec('sleep 1; echo "Task 3 complete"')
  ]);
  
  const endTime = Date.now();
  const duration = endTime - startTime;
  
  if (parallelResults.isOk()) {
    console.log('✅ All parallel tasks completed in', duration, 'ms');
    parallelResults.value.forEach((result, index) => {
      console.log(`  Task ${index + 1}:`, result.stdout.trim());
    });
  } else {
    console.log('❌ Some parallel tasks failed:', parallelResults.error.message);
  }
  
  // Example 11: Sequential vs Parallel comparison
  console.log('\n4.2 Sequential vs Parallel comparison:');
  
  // Sequential execution
  const seqStart = Date.now();
  const seq1 = await exec('sleep 0.5; echo "Sequential 1"');
  const seq2 = await exec('sleep 0.5; echo "Sequential 2"');
  const seqEnd = Date.now();
  
  // Parallel execution
  const parStart = Date.now();
  const parResults = await ResultAsync.combine([
    exec('sleep 0.5; echo "Parallel 1"'),
    exec('sleep 0.5; echo "Parallel 2"')
  ]);
  const parEnd = Date.now();
  
  console.log('⏱️  Sequential execution:', seqEnd - seqStart, 'ms');
  console.log('⏱️  Parallel execution:', parEnd - parStart, 'ms');
  
  separator('5. ERROR HANDLING PATTERNS');
  
  // Example 12: Comprehensive error handling
  console.log('\n5.1 Comprehensive error handling:');
  
  async function safeExecute(command: string) {
    const result = await exec(command);
    
    return result
      .map(({ stdout, stderr }) => {
        console.log('✅ Command succeeded:', command);
        if (stdout) console.log('  stdout:', stdout.trim());
        if (stderr) console.log('  stderr:', stderr.trim());
        return { stdout, stderr };
      })
      .mapErr(error => {
        console.log('❌ Command failed:', command);
        
        if (error instanceof ProcessNotFoundError) {
          console.log('  Reason: Command not found');
        } else if (error instanceof NonZeroExitError) {
          console.log('  Reason: Non-zero exit code', error.exitCode);
          if (error.stderr) console.log('  stderr:', error.stderr);
        } else {
          console.log('  Reason:', error.message);
        }
        
        return error;
      });
  }
  
  // Test with various commands
  await safeExecute('echo "This works"');
  await safeExecute('nonexistent-command');
  await safeExecute('node -e "process.exit(1)"');
  
  separator('6. PRACTICAL EXAMPLES');
  
  // Example 13: Get system information
  console.log('\n6.1 System information gathering:');
  
  const systemInfo = await ResultAsync.combine([
    execFile('node', ['--version']),
    execFile('npm', ['--version']),
    exec('echo $OSTYPE || echo %OS%')
  ]);
  
  systemInfo
    .map(([nodeVersion, npmVersion, platform]) => {
      console.log('✅ System Information:');
      console.log('  Node.js:', nodeVersion.stdout.trim());
      console.log('  npm:', npmVersion.stdout.trim());
      console.log('  Platform:', platform.stdout.trim());
      return [nodeVersion, npmVersion, platform];
    })
    .mapErr(error => {
      console.log('❌ Failed to gather system info:', error.message);
      return error;
    });
  
  // Example 14: File operations
  console.log('\n6.2 File operations:');
  
  const fileOps = await exec('ls -la | head -5')
    .map(({ stdout }) => {
      console.log('✅ Directory listing (first 5 items):');
      stdout.split('\n').forEach((line, index) => {
        if (line.trim() && index < 5) {
          console.log(`  ${line}`);
        }
      });
      return stdout;
    })
    .mapErr(error => {
      console.log('❌ Directory listing failed:', error.message);
      return error;
    });
  
  console.log('\n🎉 Asynchronous examples completed!');
}

// Run the examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Running asynchronous command examples...');
  runAsyncExamples().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
}

export { runAsyncExamples };