#!/usr/bin/env node --loader ts-node/esm

/**
 * Basic Synchronous Command Examples
 * 
 * This file demonstrates the synchronous functions:
 * - execSync: Execute shell commands
 * - execFileSync: Execute files/programs directly
 * - spawnSync: Low-level process spawning
 * 
 * All functions return Result<T, ProcessError> for type-safe error handling.
 */

import { execSync, execFileSync, spawnSync, ProcessNotFoundError, NonZeroExitError } from '../../src/index';

function separator(title: string) {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`${title}`);
  console.log('='.repeat(50));
}

function runSyncExamples() {
  separator('1. EXECSYNC EXAMPLES');
  
  // Example 1: Simple command execution
  console.log('\n1.1 Simple echo command:');
  const echoResult = execSync('echo "Hello from execSync!"', { encoding: 'utf8' });
  
  if (echoResult.isOk()) {
    console.log('✅ Success:', typeof echoResult.value === 'string' ? echoResult.value.trim() : echoResult.value);
  } else {
    console.log('❌ Error:', echoResult.error.message);
  }
  
  // Example 2: Command with complex output
  console.log('\n1.2 Date command:');
  const dateResult = execSync('date', { encoding: 'utf8' });
  
  dateResult
    .map(output => {
      console.log('✅ Current date:', typeof output === 'string' ? output.trim() : output);
      return output;
    })
    .mapErr(error => {
      console.log('❌ Failed to get date:', error.message);
      return error;
    });
  
  // Example 3: Command that might fail
  console.log('\n1.3 Handling command failure:');
  const failingResult = execSync('exit 1', { encoding: 'utf8' });
  
  if (failingResult.isErr()) {
    if (failingResult.error instanceof NonZeroExitError) {
      console.log('❌ Command failed with exit code:', failingResult.error.exitCode);
    } else {
      console.log('❌ Other error:', failingResult.error.message);
    }
  }
  
  // Example 4: Command not found
  console.log('\n1.4 Command not found:');
  const notFoundResult = execSync('nonexistent-command-xyz', { encoding: 'utf8' });
  
  if (notFoundResult.isErr()) {
    if (notFoundResult.error instanceof ProcessNotFoundError) {
      console.log('❌ Command not found:', notFoundResult.error.command);
    } else if (notFoundResult.error instanceof NonZeroExitError) {
      console.log('❌ Shell reported command not found with exit code:', notFoundResult.error.exitCode);
    } else {
      console.log('❌ Error:', notFoundResult.error.message);
    }
  }
  
  separator('2. EXECFILESYNC EXAMPLES');
  
  // Example 5: Execute Node.js directly
  console.log('\n2.1 Node.js version check:');
  const nodeVersionResult = execFileSync('node', ['--version'], { encoding: 'utf8' });
  
  nodeVersionResult
    .map(version => {
      console.log('✅ Node.js version:', typeof version === 'string' ? version.trim() : version);
      return version;
    })
    .mapErr(error => {
      console.log('❌ Failed to get Node version:', error.message);
      return error;
    });
  
  // Example 6: Execute with arguments
  console.log('\n2.2 Node.js eval:');
  const evalResult = execFileSync('node', ['-e', 'console.log("Hello from Node.js!")'], { encoding: 'utf8' });
  
  if (evalResult.isOk()) {
    console.log('✅ Node eval output:', typeof evalResult.value === 'string' ? evalResult.value.trim() : evalResult.value);
  } else {
    console.log('❌ Node eval failed:', evalResult.error.message);
  }
  
  // Example 7: File not found
  console.log('\n2.3 File not found:');
  const fileNotFoundResult = execFileSync('nonexistent-program-xyz');
  
  if (fileNotFoundResult.isErr()) {
    if (fileNotFoundResult.error instanceof ProcessNotFoundError) {
      console.log('❌ Program not found:', fileNotFoundResult.error.command);
    } else {
      console.log('❌ Error:', fileNotFoundResult.error.message);
    }
  }
  
  separator('3. SPAWNSYNC EXAMPLES');
  
  // Example 8: Basic spawn
  console.log('\n3.1 Basic spawn with ls:');
  const lsResult = spawnSync('ls', ['-la', '.'], { encoding: 'utf8' });
  
  if (lsResult.isOk()) {
    console.log('✅ Process completed with exit code:', lsResult.value.status);
    console.log('📁 Directory listing (first 5 lines):');
    const lines = lsResult.value.stdout.toString().split('\n').slice(0, 5);
    lines.forEach(line => line && console.log('  ', line));
  } else {
    console.log('❌ Spawn failed:', lsResult.error.message);
  }
  
  // Example 9: Spawn with shell
  console.log('\n3.2 Spawn with shell option:');
  const shellResult = spawnSync('echo "Hello from shell spawn!"', [], { 
    shell: true, 
    encoding: 'utf8' 
  });
  
  if (shellResult.isOk()) {
    console.log('✅ Shell output:', shellResult.value.stdout.toString().trim());
  } else {
    console.log('❌ Shell spawn failed:', shellResult.error.message);
  }
  
  // Example 10: Handling stderr
  console.log('\n3.3 Command with stderr output:');
  const stderrResult = spawnSync('node', ['-e', 'console.error("Error message"); console.log("Normal output");'], { 
    encoding: 'utf8' 
  });
  
  if (stderrResult.isOk()) {
    console.log('✅ stdout:', stderrResult.value.stdout.toString().trim());
    console.log('⚠️  stderr:', stderrResult.value.stderr.toString().trim());
  } else {
    console.log('❌ Command failed:', stderrResult.error.message);
  }
  
  separator('4. WORKING WITH BUFFERS');
  
  // Example 11: Working with Buffer output
  console.log('\n4.1 Buffer output (no encoding):');
  const bufferResult = execSync('echo "Binary data example"');
  
  if (bufferResult.isOk()) {
    const buffer = bufferResult.value as Buffer;
    console.log('✅ Buffer length:', buffer.length, 'bytes');
    console.log('✅ As string:', buffer.toString().trim());
    console.log('✅ As hex:', buffer.toString('hex').substring(0, 20) + '...');
  } else {
    console.log('❌ Buffer command failed:', bufferResult.error.message);
  }
  
  separator('5. PRACTICAL EXAMPLES');
  
  // Example 12: Check if a command exists
  console.log('\n5.1 Check if git is installed:');
  const gitCheckResult = execFileSync('git', ['--version'], { encoding: 'utf8' });
  
  gitCheckResult
    .map(version => {
      console.log('✅ Git is available:', typeof version === 'string' ? version.trim() : version);
      return true;
    })
    .mapErr(error => {
      if (error instanceof ProcessNotFoundError) {
        console.log('❌ Git is not installed');
      } else {
        console.log('❌ Error checking git:', error.message);
      }
      return false;
    });
  
  // Example 13: Get system information
  console.log('\n5.2 System information:');
  const unameResult = execSync('uname -a', { encoding: 'utf8' });
  
  if (unameResult.isOk()) {
    console.log('✅ System info:', typeof unameResult.value === 'string' ? unameResult.value.trim() : unameResult.value);
  } else {
    // Fallback for Windows
    const winVerResult = execSync('ver', { encoding: 'utf8' });
    if (winVerResult.isOk()) {
      console.log('✅ Windows version:', typeof winVerResult.value === 'string' ? winVerResult.value.trim() : winVerResult.value);
    } else {
      console.log('❌ Could not determine system info');
    }
  }
  
  console.log('\n🎉 Synchronous examples completed!');
}

// Run the examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Running synchronous command examples...');
  runSyncExamples();
}

export { runSyncExamples };