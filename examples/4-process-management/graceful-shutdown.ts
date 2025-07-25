#!/usr/bin/env node --loader ts-node/esm

/**
 * Graceful Shutdown Examples
 * 
 * This example demonstrates proper process termination patterns,
 * including signal handling, cleanup procedures, and coordination.
 * 
 * Key concepts:
 * - Signal handling (SIGTERM, SIGINT, SIGKILL)
 * - Cleanup procedures and resource management
 * - Coordinated shutdown of multiple processes
 * - Timeout handling for unresponsive processes
 * - State preservation during shutdown
 */

import { spawn, waitForExit } from '../../src/index';
import { ChildProcess } from 'child_process';

function separator(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log('='.repeat(60));
}

interface ShutdownOptions {
  gracefulTimeoutMs: number;
  forceTimeoutMs: number;
  saveState: boolean;
  notifyDependents: boolean;
}

class GracefulShutdownManager {
  private processes: Map<string, ChildProcess> = new Map();
  private shutdownCallbacks: Map<string, () => Promise<void>> = new Map();
  private isShuttingDown = false;

  /**
   * Register a process for graceful shutdown management
   */
  registerProcess(name: string, process: ChildProcess, cleanupCallback?: () => Promise<void>): void {
    this.processes.set(name, process);
    
    if (cleanupCallback) {
      this.shutdownCallbacks.set(name, cleanupCallback);
    }
    
    console.log(`📝 Registered ${name} for graceful shutdown (PID: ${process.pid})`);
  }

  /**
   * Shutdown a single process gracefully
   */
  async shutdownProcess(
    name: string, 
    options: Partial<ShutdownOptions> = {}
  ): Promise<boolean> {
    const process = this.processes.get(name);
    if (!process || !process.pid) {
      console.log(`⚠️  Process ${name} not found or already terminated`);
      return false;
    }

    const opts: ShutdownOptions = {
      gracefulTimeoutMs: 5000,
      forceTimeoutMs: 10000,
      saveState: true,
      notifyDependents: true,
      ...options
    };

    console.log(`🔄 Initiating graceful shutdown for ${name}...`);

    try {
      // Step 1: Run cleanup callback if provided
      const cleanupCallback = this.shutdownCallbacks.get(name);
      if (cleanupCallback) {
        console.log(`🧹 Running cleanup for ${name}...`);
        await cleanupCallback();
      }

      // Step 2: Send SIGTERM for graceful shutdown
      console.log(`📤 Sending SIGTERM to ${name}...`);
      process.kill('SIGTERM');

      // Step 3: Wait for graceful shutdown
      const gracefulShutdown = this.waitForExit(process, opts.gracefulTimeoutMs);
      const gracefulResult = await gracefulShutdown;

      if (gracefulResult.success) {
        console.log(`✅ ${name} shut down gracefully (exit code: ${gracefulResult.code})`);
        this.processes.delete(name);
        this.shutdownCallbacks.delete(name);
        return true;
      }

      // Step 4: Force shutdown if graceful failed
      console.log(`⚡ Graceful shutdown timeout for ${name}, sending SIGKILL...`);
      process.kill('SIGKILL');

      const forceShutdown = this.waitForExit(process, opts.forceTimeoutMs);
      const forceResult = await forceShutdown;

      if (forceResult.success) {
        console.log(`💀 ${name} force killed`);
        this.processes.delete(name);
        this.shutdownCallbacks.delete(name);
        return true;
      }

      console.error(`❌ Failed to shutdown ${name} even with SIGKILL`);
      return false;

    } catch (error) {
      console.error(`❌ Error during shutdown of ${name}:`, error);
      return false;
    }
  }

  /**
   * Shutdown all processes in the correct order
   */
  async shutdownAll(
    order?: string[], 
    options: Partial<ShutdownOptions> = {}
  ): Promise<void> {
    if (this.isShuttingDown) {
      console.log('⚠️  Shutdown already in progress');
      return;
    }

    this.isShuttingDown = true;
    console.log('🔒 Initiating system-wide graceful shutdown...');

    const processNames = order || Array.from(this.processes.keys());
    const results: { name: string; success: boolean }[] = [];

    // Shutdown processes in specified order
    for (const name of processNames) {
      if (this.processes.has(name)) {
        const success = await this.shutdownProcess(name, options);
        results.push({ name, success });
      }
    }

    // Report results
    console.log('\n📊 Shutdown Summary:');
    results.forEach(({ name, success }) => {
      console.log(`   ${success ? '✅' : '❌'} ${name}: ${success ? 'Success' : 'Failed'}`);
    });

    const failedCount = results.filter(r => !r.success).length;
    if (failedCount === 0) {
      console.log('🎉 All processes shut down successfully');
    } else {
      console.log(`⚠️  ${failedCount} processes failed to shut down properly`);
    }

    this.isShuttingDown = false;
  }

  /**
   * Setup signal handlers for the manager itself
   */
  setupSignalHandlers(): void {
    const signalHandler = (signal: string) => {
      console.log(`\n📡 Received ${signal}, initiating graceful shutdown...`);
      this.shutdownAll().then(() => {
        console.log('👋 Graceful shutdown complete, exiting...');
        process.exit(0);
      }).catch(error => {
        console.error('❌ Error during graceful shutdown:', error);
        process.exit(1);
      });
    };

    process.on('SIGTERM', () => signalHandler('SIGTERM'));
    process.on('SIGINT', () => signalHandler('SIGINT'));
    
    console.log('📡 Signal handlers registered (SIGTERM, SIGINT)');
  }

  private async waitForExit(
    process: ChildProcess, 
    timeoutMs: number
  ): Promise<{ success: boolean; code?: number }> {
    return new Promise((resolve) => {
      const timeout = setTimeout(() => {
        resolve({ success: false });
      }, timeoutMs);

      const exitResult = waitForExit(process);
      exitResult.then(result => {
        clearTimeout(timeout);
        if (result.isOk()) {
          resolve({ success: true, code: result.value.code || 0 });
        } else {
          resolve({ success: false });
        }
      })
    });
  }
}

/**
 * Example 1: Basic graceful shutdown
 */
async function basicGracefulShutdown() {
  separator('EXAMPLE 1: Basic Graceful Shutdown');

  console.log('🔄 Demonstrating basic graceful shutdown...');

  // Create a process that handles SIGTERM gracefully
  const gracefulProcessResult = await spawn('node', ['-e', `
    console.log('Graceful process starting...');
    
    let isShuttingDown = false;
    const resources = [];
    
    // Simulate ongoing work
    const workInterval = setInterval(() => {
      if (!isShuttingDown) {
        console.log('Doing important work...');
        
        // Simulate resource allocation
        resources.push({ id: Date.now(), data: 'important data' });
        
        // Keep only recent resources
        if (resources.length > 5) {
          resources.shift();
        }
      }
    }, 1000);
    
    // Handle graceful shutdown
    process.on('SIGTERM', () => {
      if (isShuttingDown) return;
      
      console.log('Received SIGTERM, starting graceful shutdown...');
      isShuttingDown = true;
      
      // Step 1: Stop accepting new work
      clearInterval(workInterval);
      console.log('Stopped accepting new work');
      
      // Step 2: Finish current work
      console.log('Finishing current work...');
      setTimeout(() => {
        
        // Step 3: Save state
        console.log('Saving application state...');
        console.log(\`Saved \${resources.length} resources\`);
        
        // Step 4: Close connections
        console.log('Closing connections...');
        
        // Step 5: Exit gracefully
        console.log('Graceful shutdown complete');
        process.exit(0);
        
      }, 2000);
    });
    
    // Handle forced shutdown
    process.on('SIGKILL', () => {
      console.log('Received SIGKILL, forcing exit');
      process.exit(1);
    });
    
    console.log('Process ready, send SIGTERM to test graceful shutdown');
  `]);

  if (gracefulProcessResult.isErr()) {
    console.error('❌ Failed to start graceful process');
    return;
  }

  const manager = new GracefulShutdownManager();
  manager.registerProcess('graceful-app', gracefulProcessResult.value.process);

  // Let it run for a few seconds
  await new Promise(resolve => setTimeout(resolve, 4000));

  // Test graceful shutdown
  await manager.shutdownProcess('graceful-app', {
    gracefulTimeoutMs: 10000,
    forceTimeoutMs: 15000
  });
}

/**
 * Example 2: Shutdown with cleanup procedures
 */
async function shutdownWithCleanup() {
  separator('EXAMPLE 2: Shutdown with Cleanup Procedures');

  console.log('🔄 Demonstrating shutdown with cleanup...');

  // Start a database-like process
  const dbProcessResult = await spawn('node', ['-e', `
    console.log('Database service starting...');
    
    const connections = new Set();
    const transactions = new Map();
    let isShuttingDown = false;
    
    // Simulate connections
    setInterval(() => {
      if (!isShuttingDown) {
        const connId = Math.random().toString(36).substr(2, 9);
        connections.add(connId);
        console.log(\`New connection: \${connId} (total: \${connections.size})\`);
        
        // Remove connection after some time
        setTimeout(() => {
          connections.delete(connId);
        }, Math.random() * 5000 + 2000);
      }
    }, 1500);
    
    // Simulate transactions
    setInterval(() => {
      if (!isShuttingDown) {
        const txId = Math.random().toString(36).substr(2, 9);
        transactions.set(txId, { start: Date.now(), status: 'active' });
        console.log(\`Transaction started: \${txId}\`);
        
        // Complete transaction
        setTimeout(() => {
          if (transactions.has(txId)) {
            transactions.set(txId, { ...transactions.get(txId), status: 'completed' });
            transactions.delete(txId);
          }
        }, Math.random() * 3000 + 1000);
      }
    }, 2000);
    
    process.on('SIGTERM', () => {
      console.log('Database received SIGTERM, starting graceful shutdown...');
      isShuttingDown = true;
      
      console.log(\`Active connections: \${connections.size}\`);
      console.log(\`Active transactions: \${transactions.size}\`);
      
      // Wait for transactions to complete
      const checkTransactions = () => {
        if (transactions.size === 0) {
          console.log('All transactions completed');
          console.log('Closing database connections...');
          console.log('Database shutdown complete');
          process.exit(0);
        } else {
          console.log(\`Waiting for \${transactions.size} transactions to complete...\`);
          setTimeout(checkTransactions, 500);
        }
      };
      
      checkTransactions();
    });
  `]);

  if (dbProcessResult.isErr()) {
    console.error('❌ Failed to start database process');
    return;
  }

  const manager = new GracefulShutdownManager();
  
  // Register with cleanup callback
  manager.registerProcess('database', dbProcessResult.value.process, async () => {
    console.log('🧹 Running database cleanup procedures...');
    console.log('   - Flushing write buffers');
    console.log('   - Syncing to disk');
    console.log('   - Updating metadata');
    await new Promise(resolve => setTimeout(resolve, 1000));
    console.log('✅ Database cleanup completed');
  });

  // Let it run and accumulate connections/transactions
  await new Promise(resolve => setTimeout(resolve, 8000));

  // Shutdown with cleanup
  await manager.shutdownProcess('database', {
    gracefulTimeoutMs: 15000,
    saveState: true
  });
}

/**
 * Example 3: Coordinated multi-process shutdown
 */
async function coordinatedMultiProcessShutdown() {
  separator('EXAMPLE 3: Coordinated Multi-Process Shutdown');

  console.log('🔄 Demonstrating coordinated shutdown...');

  const manager = new GracefulShutdownManager();

  // Start multiple interconnected processes
  const processes = [
    {
      name: 'load-balancer',
      script: `
        console.log('Load balancer starting...');
        setInterval(() => console.log('Routing requests...'), 2000);
        
        process.on('SIGTERM', () => {
          console.log('Load balancer: Stopping new request acceptance');
          console.log('Load balancer: Draining existing connections');
          setTimeout(() => {
            console.log('Load balancer: Shutdown complete');
            process.exit(0);
          }, 1000);
        });
      `
    },
    {
      name: 'api-server-1',
      script: `
        console.log('API Server 1 starting...');
        setInterval(() => console.log('Processing API requests...'), 1500);
        
        process.on('SIGTERM', () => {
          console.log('API Server 1: Finishing current requests');
          console.log('API Server 1: Closing database connections');
          setTimeout(() => {
            console.log('API Server 1: Shutdown complete');
            process.exit(0);
          }, 2000);
        });
      `
    },
    {
      name: 'api-server-2',
      script: `
        console.log('API Server 2 starting...');
        setInterval(() => console.log('Processing API requests...'), 1800);
        
        process.on('SIGTERM', () => {
          console.log('API Server 2: Finishing current requests');
          console.log('API Server 2: Closing database connections');
          setTimeout(() => {
            console.log('API Server 2: Shutdown complete');
            process.exit(0);
          }, 1800);
        });
      `
    },
    {
      name: 'database',
      script: `
        console.log('Database starting...');
        setInterval(() => console.log('Processing queries...'), 1000);
        
        process.on('SIGTERM', () => {
          console.log('Database: Waiting for queries to complete');
          console.log('Database: Flushing write buffers');
          console.log('Database: Syncing to disk');
          setTimeout(() => {
            console.log('Database: Shutdown complete');
            process.exit(0);
          }, 3000);
        });
      `
    }
  ];

  // Start all processes
  for (const proc of processes) {
    const result = await spawn('node', ['-e', proc.script]);
    if (result.isOk()) {
      manager.registerProcess(proc.name, result.value.process);
    }
  }

  // Let the system run
  await new Promise(resolve => setTimeout(resolve, 6000));

  // Shutdown in correct order (reverse dependency order)
  console.log('🔄 Starting coordinated shutdown...');
  
  const shutdownOrder = [
    'load-balancer',    // Stop accepting new requests first
    'api-server-1',     // Then shutdown API servers
    'api-server-2',
    'database'          // Finally shutdown database
  ];

  await manager.shutdownAll(shutdownOrder, {
    gracefulTimeoutMs: 8000,
    forceTimeoutMs: 12000
  });
}

/**
 * Example 4: Handling unresponsive processes
 */
async function unresponsiveProcessHandling() {
  separator('EXAMPLE 4: Handling Unresponsive Processes');

  console.log('🔄 Demonstrating unresponsive process handling...');

  const manager = new GracefulShutdownManager();

  // Start a responsive process
  const responsiveResult = await spawn('node', ['-e', `
    console.log('Responsive process starting...');
    
    process.on('SIGTERM', () => {
      console.log('Responsive: Received SIGTERM, shutting down...');
      setTimeout(() => {
        console.log('Responsive: Cleanup complete');
        process.exit(0);
      }, 1000);
    });
    
    setInterval(() => console.log('Responsive: Working...'), 2000);
  `]);

  // Start an unresponsive process (ignores SIGTERM)
  const unresponsiveResult = await spawn('node', ['-e', `
    console.log('Unresponsive process starting...');
    
    // Intentionally ignore SIGTERM
    process.on('SIGTERM', () => {
      console.log('Unresponsive: Received SIGTERM but ignoring it...');
      // Do nothing - simulate unresponsive process
    });
    
    setInterval(() => console.log('Unresponsive: Working...'), 2000);
  `]);

  if (responsiveResult.isOk()) {
    manager.registerProcess('responsive-app', responsiveResult.value.process);
  }

  if (unresponsiveResult.isOk()) {
    manager.registerProcess('unresponsive-app', unresponsiveResult.value.process);
  }

  // Let them run
  await new Promise(resolve => setTimeout(resolve, 4000));

  console.log('🔄 Testing shutdown behavior...');

  // Shutdown both processes with short timeouts to demonstrate force-kill
  await Promise.all([
    manager.shutdownProcess('responsive-app', {
      gracefulTimeoutMs: 3000,
      forceTimeoutMs: 5000
    }),
    manager.shutdownProcess('unresponsive-app', {
      gracefulTimeoutMs: 2000,  // Short timeout to force SIGKILL
      forceTimeoutMs: 4000
    })
  ]);
}

/**
 * Example 5: Signal handling and state preservation
 */
async function signalHandlingStatePreservation() {
  separator('EXAMPLE 5: Signal Handling and State Preservation');

  console.log('🔄 Demonstrating signal handling with state preservation...');

  const manager = new GracefulShutdownManager();

  // Start a stateful process
  const statefulResult = await spawn('node', ['-e', `
    console.log('Stateful process starting...');
    
    const state = {
      counter: 0,
      items: [],
      lastUpdate: Date.now()
    };
    
    const interval = setInterval(() => {
      state.counter++;
      state.items.push(\`item-\${state.counter}\`);
      state.lastUpdate = Date.now();
      
      console.log(\`State update: counter=\${state.counter}, items=\${state.items.length}\`);
      
      // Keep only last 5 items
      if (state.items.length > 5) {
        state.items.shift();
      }
    }, 1000);
    
    function saveState() {
      console.log('Saving state to file...');
      console.log(\`Final state: \${JSON.stringify(state, null, 2)}\`);
      console.log('State saved successfully');
    }
    
    process.on('SIGTERM', () => {
      console.log('Stateful: Received SIGTERM, preserving state...');
      clearInterval(interval);
      saveState();
      console.log('Stateful: Graceful shutdown complete');
      process.exit(0);
    });
    
    process.on('SIGINT', () => {
      console.log('Stateful: Received SIGINT, emergency state save...');
      clearInterval(interval);
      saveState();
      process.exit(0);
    });
  `]);

  if (statefulResult.isOk()) {
    manager.registerProcess('stateful-app', statefulResult.value.process, async () => {
      console.log('🧹 External cleanup: Backing up state files...');
      console.log('🧹 External cleanup: Notifying monitoring systems...');
      await new Promise(resolve => setTimeout(resolve, 500));
      console.log('✅ External cleanup completed');
    });
  }

  // Setup signal handlers for the manager
  manager.setupSignalHandlers();

  // Let it accumulate state
  await new Promise(resolve => setTimeout(resolve, 5000));

  // Test different shutdown scenarios
  console.log('🔄 Testing SIGTERM shutdown...');
  await manager.shutdownProcess('stateful-app', {
    gracefulTimeoutMs: 8000,
    saveState: true
  });
}

// Main execution
async function main() {
  console.log('🛑 Graceful Shutdown Examples');
  console.log('==============================');

  try {
    await basicGracefulShutdown();
    await shutdownWithCleanup();
    await coordinatedMultiProcessShutdown();
    await unresponsiveProcessHandling();
    await signalHandlingStatePreservation();

    console.log('\n🎊 All graceful shutdown examples completed successfully!');
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

export { GracefulShutdownManager, main as runGracefulShutdownExamples };