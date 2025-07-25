#!/usr/bin/env node --loader ts-node/esm

/**
 * Process Pool Examples
 * 
 * This example demonstrates process pool management for handling
 * multiple concurrent operations efficiently with resource limits.
 * 
 * Key concepts:
 * - Process pool with configurable limits
 * - Work queue management and scheduling
 * - Load balancing across worker processes
 * - Resource monitoring and cleanup
 * - Dynamic pool sizing based on load
 */

import { spawn, waitForExit } from '../../src/index';
import { ChildProcess } from 'child_process';
import { ResultAsync } from 'neverthrow';

function separator(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log('='.repeat(60));
}

interface ProcessPoolOptions {
  minSize: number;
  maxSize: number;
  idleTimeoutMs: number;
  taskTimeoutMs: number;
  enableAutoScaling: boolean;
  scaleUpThreshold: number;
  scaleDownThreshold: number;
}

interface WorkerProcess {
  id: string;
  process: ChildProcess;
  isBusy: boolean;
  lastUsed: number;
  tasksCompleted: number;
  createdAt: number;
}

interface Task<T> {
  id: string;
  execute: (worker: WorkerProcess) => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  createdAt: number;
  priority: number;
}

interface PoolMetrics {
  totalTasks: number;
  completedTasks: number;
  failedTasks: number;
  activeWorkers: number;
  idleWorkers: number;
  queuedTasks: number;
  averageTaskDuration: number;
  poolUtilization: number;
}

class ProcessPool {
  private workers: Map<string, WorkerProcess> = new Map();
  private taskQueue: Task<any>[] = [];
  private metrics: PoolMetrics = {
    totalTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    activeWorkers: 0,
    idleWorkers: 0,
    queuedTasks: 0,
    averageTaskDuration: 0,
    poolUtilization: 0
  };
  
  private scalingTimer: NodeJS.Timeout | null = null;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private isShuttingDown = false;

  constructor(
    private workerScript: string,
    private options: ProcessPoolOptions
  ) {
    this.startCleanupTimer();
    if (options.enableAutoScaling) {
      this.startAutoScaling();
    }
  }

  /**
   * Initialize the pool with minimum number of workers
   */
  async initialize(): Promise<void> {
    console.log(`🏊 Initializing process pool (min: ${this.options.minSize}, max: ${this.options.maxSize})`);
    
    for (let i = 0; i < this.options.minSize; i++) {
      await this.createWorker();
    }
    
    console.log(`✅ Process pool initialized with ${this.workers.size} workers`);
  }

  /**
   * Submit a task to the pool
   */
  async submitTask<T>(
    taskFn: (worker: WorkerProcess) => Promise<T>,
    priority = 0
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const task: Task<T> = {
        id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        execute: taskFn,
        resolve,
        reject,
        createdAt: Date.now(),
        priority
      };

      this.metrics.totalTasks++;
      this.addTaskToQueue(task);
      this.processQueue();
    });
  }

  /**
   * Submit multiple tasks in batch
   */
  async submitBatch<T>(
    tasks: Array<(worker: WorkerProcess) => Promise<T>>,
    priority = 0
  ): Promise<T[]> {
    console.log(`📦 Submitting batch of ${tasks.length} tasks`);
    
    const promises = tasks.map(taskFn => 
      this.submitTask(taskFn, priority)
    );
    
    return Promise.all(promises);
  }

  /**
   * Get current pool metrics
   */
  getMetrics(): PoolMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Gracefully shutdown the pool
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) return;
    
    console.log('🔒 Shutting down process pool...');
    this.isShuttingDown = true;
    
    // Stop timers
    if (this.scalingTimer) {
      clearInterval(this.scalingTimer);
    }
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
    
    // Wait for current tasks to complete
    console.log(`⏳ Waiting for ${this.taskQueue.length} queued tasks to complete...`);
    while (this.taskQueue.length > 0 || this.getActiveTasks() > 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Terminate all workers
    const shutdownPromises = Array.from(this.workers.values()).map(worker =>
      this.terminateWorker(worker.id)
    );
    
    await Promise.all(shutdownPromises);
    console.log('✅ Process pool shutdown complete');
  }

  private async createWorker(): Promise<WorkerProcess> {
    const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const result = await spawn('node', ['-e', this.workerScript]);
    
    if (result.isErr()) {
      throw new Error(`Failed to create worker: ${result.error.message}`);
    }

    const worker: WorkerProcess = {
      id: workerId,
      process: result.value.process,
      isBusy: false,
      lastUsed: Date.now(),
      tasksCompleted: 0,
      createdAt: Date.now()
    };

    this.workers.set(workerId, worker);
    
    // Set up worker event handlers
    this.setupWorkerHandlers(worker);
    
    console.log(`👷 Created worker ${workerId} (PID: ${worker.process.pid})`);
    return worker;
  }

  private async terminateWorker(workerId: string): Promise<void> {
    const worker = this.workers.get(workerId);
    if (!worker) return;

    console.log(`💀 Terminating worker ${workerId}`);
    
    // Graceful shutdown
    worker.process.kill('SIGTERM');
    
    // Wait for graceful shutdown or force kill
    const timeout = setTimeout(() => {
      worker.process.kill('SIGKILL');
    }, 5000);
    
    await waitForExit(worker.process);
    clearTimeout(timeout);
    
    this.workers.delete(workerId);
  }

  private setupWorkerHandlers(worker: WorkerProcess): void {
    worker.process.on('exit', (code, signal) => {
      console.log(`⚰️  Worker ${worker.id} exited (code: ${code}, signal: ${signal})`);
      this.workers.delete(worker.id);
      
      // Create replacement worker if not shutting down
      if (!this.isShuttingDown && this.workers.size < this.options.minSize) {
        this.createWorker().catch(error => {
          console.error('Failed to create replacement worker:', error);
        });
      }
    });

    worker.process.on('error', (error) => {
      console.error(`❌ Worker ${worker.id} error:`, error.message);
      this.workers.delete(worker.id);
    });
  }

  private addTaskToQueue<T>(task: Task<T>): void {
    // Insert task based on priority (higher priority first)
    let insertIndex = this.taskQueue.length;
    
    for (let i = 0; i < this.taskQueue.length; i++) {
      if (this.taskQueue[i].priority < task.priority) {
        insertIndex = i;
        break;
      }
    }
    
    this.taskQueue.splice(insertIndex, 0, task);
    this.metrics.queuedTasks = this.taskQueue.length;
  }

  private async processQueue(): Promise<void> {
    if (this.taskQueue.length === 0) return;

    const availableWorker = this.getAvailableWorker();
    if (!availableWorker) {
      // Try to scale up if possible
      if (this.workers.size < this.options.maxSize) {
        try {
          await this.createWorker();
          this.processQueue(); // Try again with new worker
        } catch (error) {
          console.error('Failed to scale up pool:', error);
        }
      }
      return;
    }

    const task = this.taskQueue.shift();
    if (!task) return;

    this.metrics.queuedTasks = this.taskQueue.length;
    this.executeTask(availableWorker, task);
    
    // Process more tasks if available
    if (this.taskQueue.length > 0) {
      setImmediate(() => this.processQueue());
    }
  }

  private async executeTask<T>(worker: WorkerProcess, task: Task<T>): Promise<void> {
    worker.isBusy = true;
    worker.lastUsed = Date.now();
    
    console.log(`🔧 Worker ${worker.id} executing task ${task.id}`);
    
    const startTime = Date.now();
    
    try {
      // Set up task timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Task ${task.id} timed out after ${this.options.taskTimeoutMs}ms`));
        }, this.options.taskTimeoutMs);
      });
      
      // Race between task execution and timeout
      const result = await Promise.race([
        task.execute(worker),
        timeoutPromise
      ]);
      
      const duration = Date.now() - startTime;
      this.updateAverageTaskDuration(duration);
      
      worker.tasksCompleted++;
      this.metrics.completedTasks++;
      
      console.log(`✅ Task ${task.id} completed in ${duration}ms`);
      task.resolve(result);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.metrics.failedTasks++;
      
      console.log(`❌ Task ${task.id} failed after ${duration}ms: ${error}`);
      task.reject(error instanceof Error ? error : new Error(String(error)));
    } finally {
      worker.isBusy = false;
      
      // Continue processing queue
      setImmediate(() => this.processQueue());
    }
  }

  private getAvailableWorker(): WorkerProcess | null {
    for (const worker of this.workers.values()) {
      if (!worker.isBusy) {
        return worker;
      }
    }
    return null;
  }

  private getActiveTasks(): number {
    return Array.from(this.workers.values()).filter(w => w.isBusy).length;
  }

  private updateMetrics(): void {
    this.metrics.activeWorkers = this.getActiveTasks();
    this.metrics.idleWorkers = this.workers.size - this.metrics.activeWorkers;
    this.metrics.queuedTasks = this.taskQueue.length;
    this.metrics.poolUtilization = this.workers.size > 0 
      ? this.metrics.activeWorkers / this.workers.size 
      : 0;
  }

  private updateAverageTaskDuration(duration: number): void {
    const total = this.metrics.completedTasks;
    const currentAverage = this.metrics.averageTaskDuration;
    
    this.metrics.averageTaskDuration = 
      (currentAverage * (total - 1) + duration) / total;
  }

  private startCleanupTimer(): void {
    this.cleanupTimer = setInterval(() => {
      this.cleanupIdleWorkers();
    }, 30000); // Check every 30 seconds
  }

  private cleanupIdleWorkers(): void {
    if (this.workers.size <= this.options.minSize) return;

    const now = Date.now();
    const workersToRemove: string[] = [];

    for (const [id, worker] of this.workers) {
      if (!worker.isBusy && 
          now - worker.lastUsed > this.options.idleTimeoutMs &&
          this.workers.size > this.options.minSize) {
        workersToRemove.push(id);
      }
    }

    workersToRemove.forEach(id => {
      console.log(`🧹 Cleaning up idle worker ${id}`);
      this.terminateWorker(id);
    });
  }

  private startAutoScaling(): void {
    this.scalingTimer = setInterval(() => {
      this.autoScale();
    }, 10000); // Check every 10 seconds
  }

  private autoScale(): void {
    const metrics = this.getMetrics();
    
    // Scale up if utilization is high and queue is growing
    if (metrics.poolUtilization > this.options.scaleUpThreshold &&
        metrics.queuedTasks > 0 &&
        this.workers.size < this.options.maxSize) {
      
      console.log('📈 Auto-scaling up due to high utilization');
      this.createWorker().catch(error => {
        console.error('Auto-scale up failed:', error);
      });
    }
    
    // Scale down if utilization is low
    else if (metrics.poolUtilization < this.options.scaleDownThreshold &&
             metrics.queuedTasks === 0 &&
             this.workers.size > this.options.minSize) {
      
      console.log('📉 Auto-scaling down due to low utilization');
      const idleWorker = this.getAvailableWorker();
      if (idleWorker) {
        this.terminateWorker(idleWorker.id);
      }
    }
  }
}

/**
 * Example 1: Basic process pool usage
 */
async function basicProcessPoolExample() {
  separator('EXAMPLE 1: Basic Process Pool Usage');
  
  console.log('🔄 Demonstrating basic process pool...');
  
  // Worker script that simulates CPU work
  const workerScript = `
    console.log('Worker process started');
    
    // Simulate some initialization
    setTimeout(() => {
      console.log('Worker ready for tasks');
    }, 500);
    
    // Keep process alive
    setInterval(() => {
      // Worker heartbeat
    }, 1000);
  `;
  
  const pool = new ProcessPool(workerScript, {
    minSize: 2,
    maxSize: 5,
    idleTimeoutMs: 30000,
    taskTimeoutMs: 5000,
    enableAutoScaling: false,
    scaleUpThreshold: 0.8,
    scaleDownThreshold: 0.2
  });
  
  await pool.initialize();
  
  // Submit some tasks
  const tasks = Array.from({ length: 8 }, (_, i) => 
    pool.submitTask(async (worker) => {
      console.log(`   Task ${i + 1} running on worker ${worker.id}`);
      
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 500));
      
      return `Task ${i + 1} completed`;
    })
  );
  
  const results = await Promise.all(tasks);
  
  console.log('\n📋 Task Results:');
  results.forEach((result, index) => {
    console.log(`   ${index + 1}. ${result}`);
  });
  
  // Show metrics
  const metrics = pool.getMetrics();
  console.log('\n📊 Pool Metrics:');
  console.log(`   Total tasks: ${metrics.totalTasks}`);
  console.log(`   Completed: ${metrics.completedTasks}`);
  console.log(`   Failed: ${metrics.failedTasks}`);
  console.log(`   Average duration: ${metrics.averageTaskDuration.toFixed(2)}ms`);
  console.log(`   Pool utilization: ${(metrics.poolUtilization * 100).toFixed(1)}%`);
  
  await pool.shutdown();
}

/**
 * Example 2: Auto-scaling process pool
 */
async function autoScalingPoolExample() {
  separator('EXAMPLE 2: Auto-scaling Process Pool');
  
  console.log('🔄 Demonstrating auto-scaling...');
  
  const workerScript = `
    console.log('Auto-scaling worker started');
    let taskCount = 0;
    
    // Simulate worker doing tasks
    setInterval(() => {
      if (Math.random() > 0.9) {
        console.log(\`Worker completed \${++taskCount} tasks\`);
      }
    }, 2000);
  `;
  
  const pool = new ProcessPool(workerScript, {
    minSize: 1,
    maxSize: 4,
    idleTimeoutMs: 15000,
    taskTimeoutMs: 8000,
    enableAutoScaling: true,
    scaleUpThreshold: 0.7,
    scaleDownThreshold: 0.3
  });
  
  await pool.initialize();
  
  // Phase 1: Low load
  console.log('\n📊 Phase 1: Low load');
  await pool.submitTask(async (worker) => {
    console.log(`   Low load task on worker ${worker.id}`);
    await new Promise(resolve => setTimeout(resolve, 1000));
    return 'Low load complete';
  });
  
  let metrics = pool.getMetrics();
  console.log(`   Pool size: ${metrics.activeWorkers + metrics.idleWorkers}, Utilization: ${(metrics.poolUtilization * 100).toFixed(1)}%`);
  
  // Phase 2: High load burst
  console.log('\n📊 Phase 2: High load burst');
  const burstTasks = Array.from({ length: 6 }, (_, i) =>
    pool.submitTask(async (worker) => {
      console.log(`   Burst task ${i + 1} on worker ${worker.id}`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      return `Burst task ${i + 1} complete`;
    })
  );
  
  // Check metrics during burst
  setTimeout(() => {
    const burstMetrics = pool.getMetrics();
    console.log(`   During burst - Pool size: ${burstMetrics.activeWorkers + burstMetrics.idleWorkers}, Queued: ${burstMetrics.queuedTasks}`);
  }, 1000);
  
  await Promise.all(burstTasks);
  
  // Phase 3: Cool down
  console.log('\n📊 Phase 3: Cool down period');
  await new Promise(resolve => setTimeout(resolve, 20000));
  
  metrics = pool.getMetrics();
  console.log(`   After cooldown - Pool size: ${metrics.activeWorkers + metrics.idleWorkers}, Utilization: ${(metrics.poolUtilization * 100).toFixed(1)}%`);
  
  await pool.shutdown();
}

/**
 * Example 3: Priority task scheduling
 */
async function priorityTaskSchedulingExample() {
  separator('EXAMPLE 3: Priority Task Scheduling');
  
  console.log('🔄 Demonstrating priority scheduling...');
  
  const workerScript = `
    console.log('Priority worker started');
    setInterval(() => {}, 1000);
  `;
  
  const pool = new ProcessPool(workerScript, {
    minSize: 2,
    maxSize: 3,
    idleTimeoutMs: 30000,
    taskTimeoutMs: 5000,
    enableAutoScaling: false,
    scaleUpThreshold: 0.8,
    scaleDownThreshold: 0.2
  });
  
  await pool.initialize();
  
  // Submit tasks with different priorities
  const taskPromises = [
    // Low priority tasks (submitted first but should execute last)
    pool.submitTask(async (worker) => {
      console.log(`   Low priority task on worker ${worker.id}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return 'Low priority completed';
    }, 1),
    
    pool.submitTask(async (worker) => {
      console.log(`   Low priority task on worker ${worker.id}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return 'Low priority completed';
    }, 1),
    
    // High priority tasks (submitted later but should execute first)
    pool.submitTask(async (worker) => {
      console.log(`   🔥 HIGH priority task on worker ${worker.id}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      return 'HIGH priority completed';
    }, 10),
    
    pool.submitTask(async (worker) => {
      console.log(`   🔥 HIGH priority task on worker ${worker.id}`);
      await new Promise(resolve => setTimeout(resolve, 800));
      return 'HIGH priority completed';
    }, 10),
    
    // Medium priority task
    pool.submitTask(async (worker) => {
      console.log(`   📊 Medium priority task on worker ${worker.id}`);
      await new Promise(resolve => setTimeout(resolve, 900));
      return 'Medium priority completed';
    }, 5)
  ];
  
  const results = await Promise.all(taskPromises);
  
  console.log('\n📋 Execution Results (notice the order):');
  results.forEach((result, index) => {
    console.log(`   ${index + 1}. ${result}`);
  });
  
  await pool.shutdown();
}

/**
 * Example 4: Batch processing with process pool
 */
async function batchProcessingExample() {
  separator('EXAMPLE 4: Batch Processing with Process Pool');
  
  console.log('🔄 Demonstrating batch processing...');
  
  const workerScript = `
    console.log('Batch worker started');
    
    // Simulate data processing worker
    process.on('message', (data) => {
      console.log(\`Worker processing batch of \${data.items.length} items\`);
      
      // Simulate processing time
      setTimeout(() => {
        const results = data.items.map(item => \`Processed: \${item}\`);
        process.send({ success: true, results });
      }, Math.random() * 1000 + 500);
    });
    
    setInterval(() => {}, 1000);
  `;
  
  const pool = new ProcessPool(workerScript, {
    minSize: 2,
    maxSize: 4,
    idleTimeoutMs: 30000,
    taskTimeoutMs: 10000,
    enableAutoScaling: true,
    scaleUpThreshold: 0.6,
    scaleDownThreshold: 0.2
  });
  
  await pool.initialize();
  
  // Create batch processing tasks
  const batches = [
    ['item1', 'item2', 'item3'],
    ['item4', 'item5', 'item6', 'item7'],
    ['item8', 'item9'],
    ['item10', 'item11', 'item12', 'item13', 'item14']
  ];
  
  const batchTasks = batches.map((batch, index) =>
    pool.submitTask(async (worker) => {
      console.log(`   Processing batch ${index + 1} with ${batch.length} items on worker ${worker.id}`);
      
      return new Promise((resolve, reject) => {
        // Send data to worker
        if (worker.process.send) {
          worker.process.send({ items: batch });
          
          // Listen for response
          const messageHandler = (message: any) => {
            if (message.success) {
              worker.process.removeListener('message', messageHandler);
              resolve(message.results);
            } else {
              worker.process.removeListener('message', messageHandler);
              reject(new Error('Batch processing failed'));
            }
          };
          
          worker.process.on('message', messageHandler);
          
          // Timeout handling
          setTimeout(() => {
            worker.process.removeListener('message', messageHandler);
            reject(new Error('Batch processing timeout'));
          }, 8000);
        } else {
          reject(new Error('Worker process does not support messaging'));
        }
      });
    }, 5) // Medium priority for all batch tasks
  );
  
  try {
    const results = await Promise.all(batchTasks);
    
    console.log('\n📦 Batch Processing Results:');
    results.forEach((batchResult, index) => {
      console.log(`   Batch ${index + 1}:`);
      if (Array.isArray(batchResult)) {
        batchResult.forEach((item: string) => {
          console.log(`     - ${item}`);
        });
      }
    });
    
  } catch (error) {
    console.error('Batch processing error:', error);
  }
  
  const finalMetrics = pool.getMetrics();
  console.log('\n📊 Final Batch Processing Metrics:');
  console.log(`   Total batches processed: ${finalMetrics.completedTasks}`);
  console.log(`   Failed batches: ${finalMetrics.failedTasks}`);
  console.log(`   Average processing time: ${finalMetrics.averageTaskDuration.toFixed(2)}ms`);
  
  await pool.shutdown();
}

// Main execution
async function main() {
  console.log('🏊 Process Pool Management Examples');
  console.log('====================================');
  
  try {
    await basicProcessPoolExample();
    await autoScalingPoolExample();
    await priorityTaskSchedulingExample();
    await batchProcessingExample();
    
    console.log('\n🎊 All process pool examples completed successfully!');
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

export { ProcessPool, main as runProcessPoolExamples };