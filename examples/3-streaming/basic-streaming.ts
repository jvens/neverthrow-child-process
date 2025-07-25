#!/usr/bin/env node --loader ts-node/esm

/**
 * Basic Streaming Examples
 * 
 * This example demonstrates fundamental streaming concepts for handling
 * real-time data flow between parent and child processes.
 * 
 * Key concepts:
 * - Basic stdout/stderr capture
 * - Real-time stream processing
 * - Stream event handling
 * - Buffer management for large outputs
 */

import { spawn, waitForExit } from '../../src/index';
import { ChildProcess } from 'child_process';

function separator(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log('='.repeat(60));
}

/**
 * Example 1: Basic stdout capture
 */
async function basicStdoutCapture() {
  separator('EXAMPLE 1: Basic stdout Capture');
  
  console.log('🔄 Spawning process with captured output...');
  
  // Spawn a process that generates output over time
  const result = await spawn(
    'node',
    ['-e', `
      for (let i = 1; i <= 5; i++) {
        console.log(\`Line \${i}: Hello from child process!\`);
        require('child_process').spawnSync('sleep', ['0.5']);
      }
    `],
    {},
    { captureStdout: true, captureStderr: true }
  );
  
  if (result.isErr()) {
    console.error('❌ Failed to spawn process:', result.error.message);
    return;
  }
  
  const { stdout, stderr, exitPromise } = result.value;
  
  console.log('✅ Process spawned, waiting for completion...');
  
  // Wait for process completion and get captured output
  const [stdoutData, stderrData, exitInfo] = await Promise.all([
    stdout!,
    stderr!,
    exitPromise
  ]);
  
  console.log('📤 Captured stdout:');
  console.log(stdoutData);
  
  if (stderrData.trim()) {
    console.log('⚠️  Captured stderr:');
    console.log(stderrData);
  }
  
  console.log(`✅ Process exited with code: ${exitInfo.code}`);
}

/**
 * Example 2: Real-time stream processing
 */
async function realTimeStreamProcessing() {
  separator('EXAMPLE 2: Real-time Stream Processing');
  
  console.log('🔄 Starting real-time stream processing...');
  
  // Spawn a process that generates continuous output
  const result = await spawn('node', ['-e', `
    let counter = 0;
    const interval = setInterval(() => {
      counter++;
      console.log(\`[Live] Message \${counter} at \${new Date().toISOString()}\`);
      
      if (counter >= 8) {
        clearInterval(interval);
        process.exit(0);
      }
    }, 800);
  `]);
  
  if (result.isErr()) {
    console.error('❌ Failed to spawn process:', result.error.message);
    return;
  }
  
  const { process } = result.value;
  
  // Set up real-time output handling
  if (process.stdout) {
    process.stdout.on('data', (chunk) => {
      const data = chunk.toString().trim();
      if (data) {
        console.log(`📡 Real-time: ${data}`);
      }
    });
  }
  
  if (process.stderr) {
    process.stderr.on('data', (chunk) => {
      const data = chunk.toString().trim();
      if (data) {
        console.log(`⚠️  Error stream: ${data}`);
      }
    });
  }
  
  // Wait for process completion
  const exitResult = await waitForExit(process);
  
  if (exitResult.isOk()) {
    console.log(`✅ Real-time processing completed with code: ${exitResult.value.code}`);
  } else {
    console.log(`❌ Process failed: ${exitResult.error.message}`);
  }
}

/**
 * Example 3: Processing large output streams
 */
async function largeStreamProcessing() {
  separator('EXAMPLE 3: Large Stream Processing');
  
  console.log('🔄 Processing large output stream...');
  
  // Create a process that generates a lot of output
  const result = await spawn('node', ['-e', `
    // Generate 1000 lines of output
    for (let i = 1; i <= 1000; i++) {
      console.log(\`Line \${i.toString().padStart(4, '0')}: This is a sample log entry with some data - \${Math.random().toFixed(6)}\`);
      
      // Add periodic errors to stderr
      if (i % 100 === 0) {
        console.error(\`Warning: Processed \${i} lines\`);
      }
    }
    console.error('Processing complete');
  `]);
  
  if (result.isErr()) {
    console.error('❌ Failed to spawn process:', result.error.message);
    return;
  }
  
  const { process } = result.value;
  
  let lineCount = 0;
  let errorCount = 0;
  let outputBuffer = '';
  
  // Process stdout in chunks
  if (process.stdout) {
    process.stdout.on('data', (chunk) => {
      outputBuffer += chunk.toString();
      
      // Process complete lines
      const lines = outputBuffer.split('\n');
      outputBuffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      lineCount += lines.filter(line => line.trim()).length;
      
      // Show progress every 100 lines
      if (lineCount > 0 && lineCount % 100 === 0) {
        console.log(`📊 Processed ${lineCount} lines...`);
      }
    });
  }
  
  // Process stderr
  if (process.stderr) {
    process.stderr.on('data', (chunk) => {
      const data = chunk.toString().trim();
      if (data) {
        errorCount++;
        console.log(`⚠️  [${errorCount}] ${data}`);
      }
    });
  }
  
  // Wait for completion
  const exitResult = await waitForExit(process);
  
  // Process any remaining data in buffer
  if (outputBuffer.trim()) {
    lineCount++;
  }
  
  console.log(`\n📈 Stream Processing Summary:`);
  console.log(`   Lines processed: ${lineCount}`);
  console.log(`   Error messages: ${errorCount}`);
  
  if (exitResult.isOk()) {
    console.log(`   Exit code: ${exitResult.value.code}`);
  } else {
    console.log(`   Error: ${exitResult.error.message}`);
  }
}

/**
 * Example 4: JSON stream processing
 */
async function jsonStreamProcessing() {
  separator('EXAMPLE 4: JSON Stream Processing');
  
  console.log('🔄 Processing JSON stream...');
  
  // Create a process that outputs JSON objects
  const result = await spawn('node', ['-e', `
    const events = [
      { type: 'user_login', userId: 123, timestamp: new Date().toISOString() },
      { type: 'page_view', userId: 123, page: '/dashboard', timestamp: new Date().toISOString() },
      { type: 'button_click', userId: 123, button: 'save', timestamp: new Date().toISOString() },
      { type: 'user_logout', userId: 123, timestamp: new Date().toISOString() },
      { type: 'error', error: 'Network timeout', severity: 'warning', timestamp: new Date().toISOString() }
    ];
    
    events.forEach((event, index) => {
      setTimeout(() => {
        console.log(JSON.stringify(event));
      }, index * 500);
    });
    
    setTimeout(() => process.exit(0), 3000);
  `]);
  
  if (result.isErr()) {
    console.error('❌ Failed to spawn process:', result.error.message);
    return;
  }
  
  const { process } = result.value;
  
  const events: any[] = [];
  let jsonBuffer = '';
  
  // Process JSON stream
  if (process.stdout) {
    process.stdout.on('data', (chunk) => {
      jsonBuffer += chunk.toString();
      
      // Process complete lines (each line should be a JSON object)
      const lines = jsonBuffer.split('\n');
      jsonBuffer = lines.pop() || ''; // Keep incomplete line
      
      for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine) {
          try {
            const event = JSON.parse(trimmedLine);
            events.push(event);
            console.log(`📦 Received ${event.type} event:`, event);
          } catch (error) {
            console.log(`❌ Invalid JSON: ${trimmedLine}`);
          }
        }
      }
    });
  }
  
  // Wait for completion
  const exitResult = await waitForExit(process);
  
  console.log(`\n📊 JSON Stream Summary:`);
  console.log(`   Total events: ${events.length}`);
  
  // Group events by type
  const eventTypes = events.reduce((acc: Record<string, number>, event) => {
    acc[event.type] = (acc[event.type] || 0) + 1;
    return acc;
  }, {});
  
  console.log('   Event types:');
  Object.entries(eventTypes).forEach(([type, count]) => {
    console.log(`     ${type}: ${count}`);
  });
  
  if (exitResult.isOk()) {
    console.log(`   Process completed with code: ${exitResult.value.code}`);
  }
}

/**
 * Example 5: Multi-stream coordination
 */
async function multiStreamCoordination() {
  separator('EXAMPLE 5: Multi-Stream Coordination');
  
  console.log('🔄 Coordinating multiple streams...');
  
  // Spawn multiple processes that output to different streams
  const processes = [
    {
      name: 'Logger',
      cmd: 'node',
      args: ['-e', `
        setInterval(() => {
          console.log(\`[LOG] \${new Date().toISOString()}: Application is running\`);
        }, 1000);
        setTimeout(() => process.exit(0), 5000);
      `]
    },
    {
      name: 'Monitor',
      cmd: 'node',
      args: ['-e', `
        setInterval(() => {
          const usage = Math.floor(Math.random() * 100);
          console.log(\`[MONITOR] CPU: \${usage}%, Memory: \${Math.floor(Math.random() * 1024)}MB\`);
        }, 1500);
        setTimeout(() => process.exit(0), 5000);
      `]
    },
    {
      name: 'Errors',
      cmd: 'node',
      args: ['-e', `
        setTimeout(() => {
          console.error('[ERROR] Minor issue detected');
        }, 2000);
        setTimeout(() => {
          console.error('[ERROR] Connection timeout');
        }, 4000);
        setTimeout(() => process.exit(0), 5000);
      `]
    }
  ];
  
  const spawnedProcesses: Array<{ name: string; process: ChildProcess }> = [];
  
  // Spawn all processes
  for (const proc of processes) {
    const result = await spawn(proc.cmd, proc.args);
    
    if (result.isOk()) {
      const childProcess = result.value.process;
      spawnedProcesses.push({ name: proc.name, process: childProcess });
      
      // Set up stream handling for this process
      if (childProcess.stdout) {
        childProcess.stdout.on('data', (chunk) => {
          const data = chunk.toString().trim();
          if (data) {
            console.log(`📡 ${proc.name}: ${data}`);
          }
        });
      }
      
      if (childProcess.stderr) {
        childProcess.stderr.on('data', (chunk) => {
          const data = chunk.toString().trim();
          if (data) {
            console.log(`⚠️  ${proc.name}: ${data}`);
          }
        });
      }
      
      console.log(`✅ Started ${proc.name} process (PID: ${childProcess.pid})`);
    } else {
      console.error(`❌ Failed to start ${proc.name}:`, result.error.message);
    }
  }
  
  // Wait for all processes to complete
  console.log('\n🔄 Waiting for all processes to complete...');
  
  const exitPromises = spawnedProcesses.map(async ({ name, process }) => {
    const exitResult = await waitForExit(process);
    if (exitResult.isOk()) {
      console.log(`✅ ${name} completed with code: ${exitResult.value.code}`);
    } else {
      console.log(`❌ ${name} failed: ${exitResult.error.message}`);
    }
    return { name, exitResult };
  });
  
  const results = await Promise.all(exitPromises);
  
  console.log('\n📊 Multi-Stream Summary:');
  results.forEach(({ name, exitResult }) => {
    const status = exitResult.isOk() ? '✅ Success' : '❌ Failed';
    console.log(`   ${name}: ${status}`);
  });
}

// Main execution
async function main() {
  console.log('📡 Basic Streaming Examples');
  console.log('============================');
  
  try {
    await basicStdoutCapture();
    await realTimeStreamProcessing();
    await largeStreamProcessing();
    await jsonStreamProcessing();
    await multiStreamCoordination();
    
    console.log('\n🎊 All basic streaming examples completed successfully!');
  } catch (error) {
    console.error('❌ Example execution failed:', error);
    process.exit(1);
  }
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Fatal error:', error);
    process.exit(1);
  });
}

export { main as runBasicStreamingExamples };