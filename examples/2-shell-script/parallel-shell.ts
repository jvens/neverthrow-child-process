#!/usr/bin/env node --loader ts-node/esm

/**
 * Parallel Shell Script Automation
 * 
 * This example demonstrates how to execute multiple commands in parallel
 * for improved performance, with proper error handling and coordination.
 * 
 * Key concepts:
 * - Parallel command execution
 * - ResultAsync.combine for coordinating multiple operations
 * - Performance comparison between sequential and parallel execution
 * - Handling partial failures in parallel operations
 */

import { exec, execFile, spawn } from '../../src/index';
import { ResultAsync } from 'neverthrow';

interface ParallelTask {
  name: string;
  command: string;
  args?: string[];
  useExecFile?: boolean;
  description?: string;
  timeout?: number;
}

class ParallelShell {
  private tasks: ParallelTask[] = [];
  private verbose: boolean = true;

  constructor(verbose = true) {
    this.verbose = verbose;
  }

  /**
   * Add a task to be executed in parallel
   */
  addTask(task: ParallelTask): this {
    this.tasks.push(task);
    return this;
  }

  /**
   * Add multiple tasks at once
   */
  addTasks(tasks: ParallelTask[]): this {
    this.tasks.push(...tasks);
    return this;
  }

  /**
   * Execute all tasks in parallel
   */
  async executeParallel(): Promise<void> {
    this.log('🚀 Starting parallel execution...');
    this.log(`📋 Total tasks: ${this.tasks.length}`);
    
    const startTime = Date.now();
    
    // Create ResultAsync for each task
    const taskPromises = this.tasks.map((task, index) => {
      this.log(`🔄 Queuing task ${index + 1}: ${task.name}`);
      
      if (task.useExecFile) {
        return execFile(task.command, task.args || []).map(result => ({
          taskIndex: index,
          taskName: task.name,
          result
        }));
      } else {
        return exec(task.command).map(result => ({
          taskIndex: index,
          taskName: task.name,
          result
        }));
      }
    });
    
    // Execute all tasks in parallel
    const combinedResult = await ResultAsync.combine(taskPromises);
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    if (combinedResult.isErr()) {
      this.log(`❌ Parallel execution failed: ${combinedResult.error.message}`);
      throw new Error(`Parallel execution failed: ${combinedResult.error.message}`);
    }
    
    // Display results
    this.log('\n📊 Parallel Execution Results:');
    combinedResult.value.forEach(({ taskIndex, taskName, result }) => {
      this.log(`✅ Task ${taskIndex + 1} (${taskName}): Success`);
      
      if (this.verbose && result.stdout.trim()) {
        this.log(`   📤 Output: ${result.stdout.trim()}`);
      }
      
      if (result.stderr.trim()) {
        this.log(`   ⚠️  Warnings: ${result.stderr.trim()}`);
      }
    });
    
    this.log(`\n🎉 All ${this.tasks.length} tasks completed in ${totalDuration}ms`);
  }

  /**
   * Execute tasks sequentially for comparison
   */
  async executeSequential(): Promise<void> {
    this.log('🔄 Starting sequential execution...');
    
    const startTime = Date.now();
    
    for (let i = 0; i < this.tasks.length; i++) {
      const task = this.tasks[i];
      this.log(`📍 Executing task ${i + 1}/${this.tasks.length}: ${task.name}`);
      
      const result = task.useExecFile 
        ? await execFile(task.command, task.args || [])
        : await exec(task.command);
      
      if (result.isErr()) {
        this.log(`❌ Task ${i + 1} failed: ${result.error.message}`);
        throw new Error(`Sequential execution failed at task ${i + 1}: ${task.name}`);
      }
      
      this.log(`✅ Task ${i + 1} completed`);
    }
    
    const endTime = Date.now();
    const totalDuration = endTime - startTime;
    
    this.log(`🎉 Sequential execution completed in ${totalDuration}ms`);
  }

  private log(message: string): void {
    console.log(message);
  }
}

/**
 * Example 1: System information gathering in parallel
 */
async function systemInfoParallel() {
  console.log('='.repeat(60));
  console.log('EXAMPLE 1: System Information Gathering (Parallel)');
  console.log('='.repeat(60));

  const shell = new ParallelShell();
  
  shell
    .addTask({
      name: 'Node.js version',
      command: 'node',
      args: ['--version'],
      useExecFile: true,
      description: 'Get Node.js version'
    })
    .addTask({
      name: 'npm version',
      command: 'npm',
      args: ['--version'],
      useExecFile: true,
      description: 'Get npm version'
    })
    .addTask({
      name: 'System info',
      command: 'uname -a',
      description: 'Get system information'
    })
    .addTask({
      name: 'Current directory',
      command: 'pwd',
      description: 'Get current working directory'
    })
    .addTask({
      name: 'Disk usage',
      command: 'df -h .',
      description: 'Get disk usage for current directory'
    });

  try {
    await shell.executeParallel();
  } catch (error) {
    console.error('Parallel system info gathering failed:', error);
  }
}

/**
 * Example 2: Performance comparison - Sequential vs Parallel
 */
async function performanceComparison() {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Performance Comparison (Sequential vs Parallel)');
  console.log('='.repeat(60));

  // Create tasks that take some time
  const tasks: ParallelTask[] = [
    {
      name: 'Sleep 1 second',
      command: 'sleep 1 && echo "Task 1 completed"',
      description: 'Simulate 1-second task'
    },
    {
      name: 'Sleep 1 second',
      command: 'sleep 1 && echo "Task 2 completed"',
      description: 'Simulate 1-second task'
    },
    {
      name: 'Sleep 1 second',
      command: 'sleep 1 && echo "Task 3 completed"',
      description: 'Simulate 1-second task'
    }
  ];

  // Sequential execution
  console.log('\n🔄 Running tasks sequentially...');
  const sequentialShell = new ParallelShell(false);
  sequentialShell.addTasks(tasks);
  
  const seqStart = Date.now();
  await sequentialShell.executeSequential();
  const seqDuration = Date.now() - seqStart;
  
  // Parallel execution
  console.log('\n⚡ Running tasks in parallel...');
  const parallelShell = new ParallelShell(false);
  parallelShell.addTasks(tasks);
  
  const parStart = Date.now();
  await parallelShell.executeParallel();
  const parDuration = Date.now() - parStart;
  
  // Comparison
  console.log('\n📊 Performance Comparison:');
  console.log(`   Sequential: ${seqDuration}ms`);
  console.log(`   Parallel:   ${parDuration}ms`);
  console.log(`   Speedup:    ${(seqDuration / parDuration).toFixed(2)}x`);
  console.log(`   Time saved: ${seqDuration - parDuration}ms`);
}

/**
 * Example 3: Build pipeline simulation
 */
async function buildPipelineSimulation() {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Build Pipeline Simulation');
  console.log('='.repeat(60));

  const projectPath = '/tmp/build-pipeline-demo';
  
  // Setup phase (sequential)
  console.log('📋 Phase 1: Project Setup (Sequential)');
  const setupShell = new ParallelShell();
  setupShell
    .addTask({
      name: 'Create project directory',
      command: `mkdir -p ${projectPath}/src ${projectPath}/tests ${projectPath}/dist`,
      description: 'Setting up project structure'
    })
    .addTask({
      name: 'Create source files',
      command: `echo "export const hello = () => 'Hello World';" > ${projectPath}/src/index.ts && echo "export const math = (a: number, b: number) => a + b;" > ${projectPath}/src/math.ts`,
      description: 'Creating TypeScript source files'
    })
    .addTask({
      name: 'Create test files',
      command: `echo "// Test file placeholder" > ${projectPath}/tests/index.test.ts`,
      description: 'Creating test files'
    });
  
  await setupShell.executeParallel();
  
  // Parallel build tasks
  console.log('\n⚡ Phase 2: Build Tasks (Parallel)');
  const buildShell = new ParallelShell();
  buildShell
    .addTask({
      name: 'Type checking',
      command: `echo "TypeScript compilation: OK" && sleep 2`,
      description: 'Simulating TypeScript type checking'
    })
    .addTask({
      name: 'Linting',
      command: `echo "ESLint checks: PASSED" && sleep 1.5`,
      description: 'Simulating ESLint validation'
    })
    .addTask({
      name: 'Unit tests',
      command: `echo "Tests: 10 passed, 0 failed" && sleep 2.5`,
      description: 'Simulating test execution'
    })
    .addTask({
      name: 'Bundle analysis',
      command: `echo "Bundle size: 42KB (optimized)" && sleep 1`,
      description: 'Simulating bundle size analysis'
    });
  
  await buildShell.executeParallel();
  
  // Cleanup
  console.log('\n🧹 Phase 3: Cleanup');
  await exec(`rm -rf ${projectPath}`);
  console.log('✅ Cleanup completed');
}

/**
 * Example 4: Handling partial failures in parallel execution
 */
async function partialFailureHandling() {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Handling Partial Failures');
  console.log('='.repeat(60));

  const tasks: ParallelTask[] = [
    {
      name: 'Successful task 1',
      command: 'echo "Success 1" && sleep 0.5',
      description: 'This will succeed'
    },
    {
      name: 'Failing task',
      command: 'echo "This will fail" && exit 1',
      description: 'This will fail with exit code 1'
    },
    {
      name: 'Successful task 2',
      command: 'echo "Success 2" && sleep 0.5',
      description: 'This will succeed'
    }
  ];

  console.log('🔄 Executing tasks with mixed success/failure...');
  
  // Execute tasks individually to handle partial failures
  const taskPromises = tasks.map(async (task, index) => {
    const result = await exec(task.command);
    
    if (result.isOk()) {
      console.log(`✅ Task ${index + 1} (${task.name}): SUCCESS`);
      console.log(`   📤 Output: ${result.value.stdout.trim()}`);
      return { success: true, taskName: task.name, output: result.value.stdout };
    } else {
      console.log(`❌ Task ${index + 1} (${task.name}): FAILED`);
      console.log(`   💬 Error: ${result.error.message}`);
      return { success: false, taskName: task.name, error: result.error.message };
    }
  });

  const results = await Promise.all(taskPromises);
  
  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;
  
  console.log('\n📊 Execution Summary:');
  console.log(`   ✅ Successful tasks: ${successCount}`);
  console.log(`   ❌ Failed tasks: ${failCount}`);
  console.log(`   📈 Success rate: ${((successCount / results.length) * 100).toFixed(1)}%`);
  
  if (failCount > 0) {
    console.log('\n⚠️  Note: Some tasks failed, but execution continued');
    console.log('   This demonstrates resilient parallel execution');
  }
}

/**
 * Example 5: Resource monitoring during parallel execution
 */
async function resourceMonitoringExample() {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 5: Resource Monitoring During Parallel Execution');
  console.log('='.repeat(60));

  console.log('🔄 Starting CPU-intensive parallel tasks...');
  
  // Start monitoring task
  const monitoringTask = await spawn('top', ['-bn', '3', '-d', '1'], {}, { captureStdout: true });
  
  if (monitoringTask.isErr()) {
    console.log('⚠️  Could not start system monitoring');
  } else {
    console.log('📊 System monitoring started');
  }
  
  // Execute parallel CPU tasks
  const cpuTasks = Array.from({ length: 4 }, (_, i) => ({
    name: `CPU task ${i + 1}`,
    command: `node -e "
      const start = Date.now();
      let count = 0;
      while (Date.now() - start < 1000) {
        count++;
      }
      console.log('Task ${i + 1}: Completed', count, 'iterations');
    "`,
    description: `CPU-intensive task ${i + 1}`
  }));
  
  const cpuShell = new ParallelShell();
  cpuShell.addTasks(cpuTasks);
  
  const startTime = Date.now();
  await cpuShell.executeParallel();
  const duration = Date.now() - startTime;
  
  // Get monitoring results
  if (monitoringTask.isOk()) {
    const monitorResult = await monitoringTask.value.stdout;
    console.log('\n📈 System Resource Usage:');
    console.log('   (Showing top processes during execution)');
    if (monitorResult) {
      const lines = monitorResult.split('\n').slice(0, 10);
      lines.forEach(line => line.trim() && console.log(`   ${line}`));
    }
  }
  
  console.log(`\n⏱️  Parallel execution completed in ${duration}ms`);
}

// Main execution
async function main() {
  console.log('⚡ Parallel Shell Script Automation Examples');
  console.log('===========================================');
  
  try {
    await systemInfoParallel();
    await performanceComparison();
    await buildPipelineSimulation();
    await partialFailureHandling();
    await resourceMonitoringExample();
    
    console.log('\n🎊 All parallel shell script examples completed successfully!');
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

export { ParallelShell, main as runParallelShellExamples };