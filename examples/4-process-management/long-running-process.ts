#!/usr/bin/env node --loader ts-node/esm

/**
 * Long-Running Process Management Examples
 * 
 * This example demonstrates how to manage long-running processes,
 * including lifecycle management, health checks, and graceful shutdown.
 * 
 * Key concepts:
 * - Long-running process lifecycle
 * - Health monitoring and status checks
 * - Graceful shutdown procedures
 * - Process restart and recovery
 * - Resource management
 */

import { spawn, waitForExit } from '../../src/index';
import { ChildProcess } from 'child_process';

function separator(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log('='.repeat(60));
}

interface ManagedProcess {
  name: string;
  process: ChildProcess;
  startTime: number;
  isHealthy: boolean;
  restartCount: number;
  lastHealthCheck: number;
}

class ProcessManager {
  private processes: Map<string, ManagedProcess> = new Map();
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private shutdownInProgress = false;

  /**
   * Start a new managed process
   */
  async startProcess(name: string, command: string, args: string[] = []): Promise<boolean> {
    console.log(`🚀 Starting process: ${name}`);
    
    const result = await spawn(command, args);
    
    if (result.isErr()) {
      console.error(`❌ Failed to start ${name}:`, result.error.message);
      return false;
    }
    
    const managedProcess: ManagedProcess = {
      name,
      process: result.value.process,
      startTime: Date.now(),
      isHealthy: true,
      restartCount: 0,
      lastHealthCheck: Date.now()
    };
    
    this.processes.set(name, managedProcess);
    
    // Set up process event handlers
    this.setupProcessHandlers(managedProcess);
    
    console.log(`✅ Process ${name} started with PID: ${managedProcess.process.pid}`);
    return true;
  }

  /**
   * Stop a managed process gracefully
   */
  async stopProcess(name: string, timeout = 5000): Promise<boolean> {
    const managedProcess = this.processes.get(name);
    if (!managedProcess) {
      console.log(`⚠️  Process ${name} not found`);
      return false;
    }

    console.log(`🛑 Stopping process: ${name}`);
    
    // Try graceful shutdown first
    managedProcess.process.kill('SIGTERM');
    
    // Wait for graceful shutdown or timeout
    const shutdownPromise = waitForExit(managedProcess.process);
    const timeoutPromise = new Promise<void>(resolve => 
      setTimeout(resolve, timeout)
    );
    
    const raceResult = await Promise.race([
      shutdownPromise.then(() => 'graceful'),
      timeoutPromise.then(() => 'timeout')
    ]);
    
    if (raceResult === 'timeout') {
      console.log(`⚡ Force killing process ${name}`);
      managedProcess.process.kill('SIGKILL');
      await waitForExit(managedProcess.process);
    }
    
    this.processes.delete(name);
    console.log(`✅ Process ${name} stopped`);
    return true;
  }

  /**
   * Restart a process
   */
  async restartProcess(name: string): Promise<boolean> {
    const managedProcess = this.processes.get(name);
    if (!managedProcess) {
      console.log(`⚠️  Process ${name} not found`);
      return false;
    }

    console.log(`🔄 Restarting process: ${name}`);
    
    // Store original command info (simplified for demo)
    const originalCommand = 'node'; // Would store actual command in real implementation
    const originalArgs: string[] = []; // Would store actual args
    
    // Stop the process
    await this.stopProcess(name);
    
    // Start it again
    const success = await this.startProcess(name, originalCommand, originalArgs);
    
    if (success) {
      const newProcess = this.processes.get(name)!;
      newProcess.restartCount++;
      console.log(`✅ Process ${name} restarted (restart count: ${newProcess.restartCount})`);
    }
    
    return success;
  }

  /**
   * Get process status
   */
  getProcessStatus(name: string): string | null {
    const managedProcess = this.processes.get(name);
    if (!managedProcess) return null;
    
    const uptime = Date.now() - managedProcess.startTime;
    const uptimeSeconds = Math.floor(uptime / 1000);
    
    return `PID: ${managedProcess.process.pid}, Uptime: ${uptimeSeconds}s, Healthy: ${managedProcess.isHealthy}, Restarts: ${managedProcess.restartCount}`;
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring(intervalMs = 5000): void {
    if (this.healthCheckInterval) return;
    
    console.log(`💓 Starting health monitoring (interval: ${intervalMs}ms)`);
    
    this.healthCheckInterval = setInterval(() => {
      this.performHealthChecks();
    }, intervalMs);
  }

  /**
   * Stop health monitoring
   */
  stopHealthMonitoring(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
      console.log('💓 Health monitoring stopped');
    }
  }

  /**
   * Shutdown all processes
   */
  async shutdown(): Promise<void> {
    if (this.shutdownInProgress) return;
    
    this.shutdownInProgress = true;
    console.log('🔒 Initiating shutdown...');
    
    this.stopHealthMonitoring();
    
    const shutdownPromises = Array.from(this.processes.keys()).map(name =>
      this.stopProcess(name)
    );
    
    await Promise.all(shutdownPromises);
    console.log('✅ All processes stopped');
  }

  /**
   * List all processes
   */
  listProcesses(): void {
    if (this.processes.size === 0) {
      console.log('📋 No managed processes');
      return;
    }
    
    console.log('📋 Managed Processes:');
    for (const [name, proc] of this.processes) {
      const status = this.getProcessStatus(name);
      console.log(`  ${name}: ${status}`);
    }
  }

  private setupProcessHandlers(managedProcess: ManagedProcess): void {
    const { name, process } = managedProcess;
    
    process.on('exit', (code, signal) => {
      console.log(`💀 Process ${name} exited with code ${code}, signal ${signal}`);
      managedProcess.isHealthy = false;
    });
    
    process.on('error', (error) => {
      console.log(`❌ Process ${name} error:`, error.message);
      managedProcess.isHealthy = false;
    });
    
    if (process.stdout) {
      process.stdout.on('data', (chunk) => {
        console.log(`📤 ${name}:`, chunk.toString().trim());
      });
    }
    
    if (process.stderr) {
      process.stderr.on('data', (chunk) => {
        console.log(`⚠️  ${name}:`, chunk.toString().trim());
      });
    }
  }

  private performHealthChecks(): void {
    console.log('💓 Performing health checks...');
    
    for (const [name, managedProcess] of this.processes) {
      const now = Date.now();
      
      // Simple health check - process should be running
      const isRunning = !managedProcess.process.killed && managedProcess.process.pid !== undefined;
      
      if (!isRunning && managedProcess.isHealthy) {
        console.log(`💔 Process ${name} is no longer healthy`);
        managedProcess.isHealthy = false;
      } else if (isRunning && !managedProcess.isHealthy) {
        console.log(`💚 Process ${name} is healthy again`);
        managedProcess.isHealthy = true;
      }
      
      managedProcess.lastHealthCheck = now;
    }
  }
}

/**
 * Example 1: Basic process lifecycle management
 */
async function basicProcessLifecycle() {
  separator('EXAMPLE 1: Basic Process Lifecycle Management');
  
  const manager = new ProcessManager();
  
  console.log('🔄 Demonstrating basic process lifecycle...');
  
  // Start a long-running process (simulated with a Node.js script)
  const success = await manager.startProcess(
    'demo-server',
    'node',
    ['-e', `
      let counter = 0;
      console.log('Demo server starting...');
      
      const interval = setInterval(() => {
        counter++;
        console.log(\`[Server] Heartbeat \${counter} at \${new Date().toISOString()}\`);
        
        if (counter >= 10) {
          console.log('[Server] Shutting down after 10 heartbeats');
          clearInterval(interval);
          process.exit(0);
        }
      }, 1000);
      
      process.on('SIGTERM', () => {
        console.log('[Server] Received SIGTERM, shutting down gracefully...');
        clearInterval(interval);
        setTimeout(() => process.exit(0), 1000);
      });
    `]
  );
  
  if (!success) {
    console.error('❌ Failed to start demo process');
    return;
  }
  
  // Monitor the process
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  console.log('\n📊 Process Status:');
  manager.listProcesses();
  
  // Wait a bit more
  await new Promise(resolve => setTimeout(resolve, 4000));
  
  console.log('\n🛑 Stopping the process...');
  await manager.stopProcess('demo-server');
  
  manager.listProcesses();
}

/**
 * Example 2: Health monitoring
 */
async function healthMonitoring() {
  separator('EXAMPLE 2: Health Monitoring');
  
  const manager = new ProcessManager();
  
  console.log('🔄 Demonstrating health monitoring...');
  
  // Start a process that will exit after some time
  await manager.startProcess(
    'monitored-process',
    'node',
    ['-e', `
      console.log('Monitored process starting...');
      
      let heartbeat = 0;
      const interval = setInterval(() => {
        heartbeat++;
        console.log(\`Heartbeat \${heartbeat}\`);
        
        // Exit after 5 heartbeats to simulate process death
        if (heartbeat >= 5) {
          console.log('Process ending...');
          process.exit(0);
        }
      }, 1000);
    `]
  );
  
  // Start health monitoring
  manager.startHealthMonitoring(2000);
  
  // Let it run for a while
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  console.log('\n📊 Final Status:');
  manager.listProcesses();
  
  await manager.shutdown();
}

/**
 * Example 3: Process restart and recovery
 */
async function processRestart() {
  separator('EXAMPLE 3: Process Restart and Recovery');
  
  const manager = new ProcessManager();
  
  console.log('🔄 Demonstrating process restart...');
  
  // Start a process
  await manager.startProcess(
    'restartable-process',
    'node',
    ['-e', `
      const startTime = Date.now();
      console.log('Restartable process starting...');
      
      const interval = setInterval(() => {
        const uptime = Math.floor((Date.now() - startTime) / 1000);
        console.log(\`Process uptime: \${uptime}s\`);
      }, 1000);
      
      // Exit after 5 seconds to simulate crash
      setTimeout(() => {
        console.log('Process crashing...');
        process.exit(1);
      }, 5000);
    `]
  );
  
  console.log('\n📊 Initial Status:');
  manager.listProcesses();
  
  // Wait for the process to "crash"
  await new Promise(resolve => setTimeout(resolve, 6000));
  
  console.log('\n📊 Status After Crash:');
  manager.listProcesses();
  
  // Restart the process
  console.log('\n🔄 Restarting the process...');
  await manager.restartProcess('restartable-process');
  
  console.log('\n📊 Status After Restart:');
  manager.listProcesses();
  
  // Wait a bit and shutdown
  await new Promise(resolve => setTimeout(resolve, 3000));
  await manager.shutdown();
}

/**
 * Example 4: Multiple process management
 */
async function multipleProcessManagement() {
  separator('EXAMPLE 4: Multiple Process Management');
  
  const manager = new ProcessManager();
  
  console.log('🔄 Managing multiple processes...');
  
  // Start multiple processes
  const processes = [
    { name: 'worker-1', delay: 1000 },
    { name: 'worker-2', delay: 1500 },
    { name: 'worker-3', delay: 800 }
  ];
  
  for (const proc of processes) {
    await manager.startProcess(
      proc.name,
      'node',
      ['-e', `
        console.log('${proc.name} starting...');
        let counter = 0;
        
        const interval = setInterval(() => {
          counter++;
          console.log(\`${proc.name}: Task \${counter} completed\`);
          
          if (counter >= 6) {
            console.log('${proc.name}: Work completed, shutting down');
            clearInterval(interval);
            process.exit(0);
          }
        }, ${proc.delay});
        
        process.on('SIGTERM', () => {
          console.log('${proc.name}: Received shutdown signal');
          clearInterval(interval);
          process.exit(0);
        });
      `]
    );
  }
  
  // Start health monitoring
  manager.startHealthMonitoring(3000);
  
  console.log('\n📊 All Processes Started:');
  manager.listProcesses();
  
  // Let them run for a while
  await new Promise(resolve => setTimeout(resolve, 8000));
  
  console.log('\n📊 Status After Running:');
  manager.listProcesses();
  
  // Shutdown all
  await manager.shutdown();
}

/**
 * Example 5: Graceful shutdown handling
 */
async function gracefulShutdown() {
  separator('EXAMPLE 5: Graceful Shutdown Handling');
  
  const manager = new ProcessManager();
  
  console.log('🔄 Demonstrating graceful shutdown...');
  
  // Start a process that handles SIGTERM gracefully
  await manager.startProcess(
    'graceful-process',
    'node',
    ['-e', `
      console.log('Graceful process starting...');
      
      let isShuttingDown = false;
      const cleanup = [];
      
      // Simulate some ongoing work
      const workInterval = setInterval(() => {
        if (!isShuttingDown) {
          console.log('Doing important work...');
        }
      }, 1000);
      
      cleanup.push(() => {
        clearInterval(workInterval);
        console.log('Work interval cleared');
      });
      
      // Handle graceful shutdown
      process.on('SIGTERM', () => {
        if (isShuttingDown) return;
        
        console.log('Received SIGTERM, starting graceful shutdown...');
        isShuttingDown = true;
        
        console.log('Cleaning up resources...');
        cleanup.forEach(fn => fn());
        
        console.log('Saving state...');
        setTimeout(() => {
          console.log('Graceful shutdown complete');
          process.exit(0);
        }, 2000);
      });
      
      console.log('Process ready, press Ctrl+C or send SIGTERM to test graceful shutdown');
    `]
  );
  
  console.log('\n📊 Process Status:');
  manager.listProcesses();
  
  // Let it run for a few seconds
  await new Promise(resolve => setTimeout(resolve, 4000));
  
  // Now test graceful shutdown
  console.log('\n🔄 Testing graceful shutdown...');
  await manager.stopProcess('graceful-process', 10000); // Give 10 seconds for graceful shutdown
  
  console.log('\n✅ Graceful shutdown test completed');
}

// Main execution
async function main() {
  console.log('🔧 Long-Running Process Management Examples');
  console.log('===========================================');
  
  try {
    await basicProcessLifecycle();
    await healthMonitoring();
    await processRestart();
    await multipleProcessManagement();
    await gracefulShutdown();
    
    console.log('\n🎊 All process management examples completed successfully!');
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

export { ProcessManager, main as runLongRunningProcessExamples };