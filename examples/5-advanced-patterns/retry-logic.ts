#!/usr/bin/env node --loader ts-node/esm

/**
 * Retry Logic Examples
 * 
 * This example demonstrates sophisticated retry strategies and patterns
 * for handling transient failures in child process operations.
 * 
 * Key concepts:
 * - Exponential backoff retry strategies
 * - Jitter and randomization for avoiding thundering herd
 * - Conditional retry based on error types
 * - Circuit breaker integration
 * - Retry metrics and monitoring
 */

import { exec, execFile, spawn } from '../../src/index';
import { ResultAsync } from 'neverthrow';
import { ProcessError, NonZeroExitError, ProcessTimeoutError } from '../../src/index';

function separator(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log('='.repeat(60));
}

interface RetryConfig {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
  jitter: boolean;
  retryableErrors: (new (...args: any[]) => ProcessError)[];
  onRetry?: (attempt: number, error: ProcessError) => void;
  onSuccess?: (attempt: number) => void;
  onFailure?: (attempts: number, finalError: ProcessError) => void;
}

interface RetryMetrics {
  totalAttempts: number;
  successfulOperations: number;
  failedOperations: number;
  totalRetries: number;
  averageAttemptsToSuccess: number;
  errorDistribution: Map<string, number>;
}

class AdvancedRetryHandler {
  private metrics: RetryMetrics = {
    totalAttempts: 0,
    successfulOperations: 0,
    failedOperations: 0,
    totalRetries: 0,
    averageAttemptsToSuccess: 0,
    errorDistribution: new Map()
  };

  private defaultConfig: RetryConfig = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    exponentialBase: 2,
    jitter: true,
    retryableErrors: [ProcessTimeoutError, NonZeroExitError]
  };

  /**
   * Execute operation with advanced retry logic
   */
  async executeWithRetry<T>(
    operation: () => ResultAsync<T, ProcessError>,
    config: Partial<RetryConfig> = {}
  ): Promise<ResultAsync<T, ProcessError>> {
    const finalConfig = { ...this.defaultConfig, ...config };
    let lastError: ProcessError | null = null;
    let operationAttempts = 0;

    for (let attempt = 1; attempt <= finalConfig.maxAttempts; attempt++) {
      operationAttempts++;
      this.metrics.totalAttempts++;
      
      console.log(`🔄 Attempt ${attempt}/${finalConfig.maxAttempts}`);
      
      const startTime = Date.now();
      const result = await operation();
      const duration = Date.now() - startTime;
      
      if (result.isOk()) {
        this.metrics.successfulOperations++;
        this.updateAverageAttempts(operationAttempts);
        
        if (attempt > 1) {
          console.log(`✅ Operation succeeded on attempt ${attempt} (took ${duration}ms)`);
          this.metrics.totalRetries += (attempt - 1);
        }
        
        finalConfig.onSuccess?.(attempt);
        return ResultAsync.fromSafePromise(Promise.resolve(result.value));
      }
      
      lastError = result.error;
      this.updateErrorDistribution(lastError);
      
      console.log(`❌ Attempt ${attempt} failed after ${duration}ms: ${lastError.message}`);
      finalConfig.onRetry?.(attempt, lastError);
      
      // Check if error is retryable
      if (!this.isRetryable(lastError, finalConfig.retryableErrors)) {
        console.log(`🚫 Error is not retryable: ${lastError.constructor.name}`);
        break;
      }
      
      // Don't wait after the last attempt
      if (attempt < finalConfig.maxAttempts) {
        const delay = this.calculateDelay(attempt, finalConfig);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await this.sleep(delay);
      }
    }

    this.metrics.failedOperations++;
    console.log(`💥 Operation failed after ${finalConfig.maxAttempts} attempts`);
    
    finalConfig.onFailure?.(finalConfig.maxAttempts, lastError!);
    return ResultAsync.fromSafePromise(Promise.reject(lastError!));
  }

  /**
   * Batch retry operations with different strategies
   */
  async executeBatchWithRetry<T>(
    operations: Array<() => ResultAsync<T, ProcessError>>,
    config: Partial<RetryConfig> = {}
  ): Promise<Array<ResultAsync<T, ProcessError>>> {
    console.log(`🔄 Executing batch of ${operations.length} operations with retry...`);
    
    const results = await Promise.all(
      operations.map((operation, index) => 
        this.executeWithRetry(operation, {
          ...config,
          onRetry: (attempt, error) => {
            console.log(`   Batch[${index}] retry ${attempt}: ${error.message}`);
          }
        })
      )
    );
    
    const successful = results.filter(r => r.isOk()).length;
    const failed = results.length - successful;
    
    console.log(`📊 Batch results: ${successful} successful, ${failed} failed`);
    return results;
  }

  /**
   * Adaptive retry with learning
   */
  async executeWithAdaptiveRetry<T>(
    operation: () => ResultAsync<T, ProcessError>,
    config: Partial<RetryConfig> = {}
  ): Promise<ResultAsync<T, ProcessError>> {
    // Adapt retry strategy based on historical success rate
    const successRate = this.getSuccessRate();
    const adaptedConfig = this.adaptConfigBasedOnMetrics(config, successRate);
    
    console.log(`🧠 Using adaptive retry (success rate: ${(successRate * 100).toFixed(1)}%)`);
    console.log(`   Adapted config: ${adaptedConfig.maxAttempts} attempts, ${adaptedConfig.baseDelayMs}ms base delay`);
    
    return this.executeWithRetry(operation, adaptedConfig);
  }

  /**
   * Get current retry metrics
   */
  getMetrics(): RetryMetrics {
    return { ...this.metrics };
  }

  /**
   * Reset metrics
   */
  resetMetrics(): void {
    this.metrics = {
      totalAttempts: 0,
      successfulOperations: 0,
      failedOperations: 0,
      totalRetries: 0,
      averageAttemptsToSuccess: 0,
      errorDistribution: new Map()
    };
  }

  private isRetryable(
    error: ProcessError, 
    retryableErrors: (new (...args: any[]) => ProcessError)[]
  ): boolean {
    return retryableErrors.some(ErrorClass => error instanceof ErrorClass);
  }

  private calculateDelay(attempt: number, config: RetryConfig): number {
    let delay = config.baseDelayMs * Math.pow(config.exponentialBase, attempt - 1);
    
    // Apply jitter to avoid thundering herd
    if (config.jitter) {
      const jitterRange = delay * 0.1; // 10% jitter
      const jitter = (Math.random() - 0.5) * 2 * jitterRange;
      delay += jitter;
    }
    
    return Math.min(Math.max(delay, 0), config.maxDelayMs);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private updateErrorDistribution(error: ProcessError): void {
    const errorType = error.constructor.name;
    this.metrics.errorDistribution.set(
      errorType,
      (this.metrics.errorDistribution.get(errorType) || 0) + 1
    );
  }

  private updateAverageAttempts(attempts: number): void {
    const totalSuccesses = this.metrics.successfulOperations;
    const currentAverage = this.metrics.averageAttemptsToSuccess;
    
    this.metrics.averageAttemptsToSuccess = 
      (currentAverage * (totalSuccesses - 1) + attempts) / totalSuccesses;
  }

  private getSuccessRate(): number {
    const total = this.metrics.successfulOperations + this.metrics.failedOperations;
    return total > 0 ? this.metrics.successfulOperations / total : 0;
  }

  private adaptConfigBasedOnMetrics(
    config: Partial<RetryConfig>, 
    successRate: number
  ): RetryConfig {
    const baseConfig = { ...this.defaultConfig, ...config };
    
    // If success rate is low, be more aggressive with retries
    if (successRate < 0.5) {
      return {
        ...baseConfig,
        maxAttempts: Math.min(baseConfig.maxAttempts + 2, 6),
        baseDelayMs: Math.max(baseConfig.baseDelayMs * 0.8, 500)
      };
    }
    
    // If success rate is high, be less aggressive
    if (successRate > 0.8) {
      return {
        ...baseConfig,
        maxAttempts: Math.max(baseConfig.maxAttempts - 1, 2),
        baseDelayMs: baseConfig.baseDelayMs * 1.2
      };
    }
    
    return baseConfig;
  }
}

/**
 * Example 1: Basic exponential backoff retry
 */
async function basicExponentialBackoff() {
  separator('EXAMPLE 1: Basic Exponential Backoff Retry');
  
  console.log('🔄 Demonstrating basic exponential backoff...');
  
  const retryHandler = new AdvancedRetryHandler();
  
  // Simulate a flaky network operation
  let attemptCount = 0;
  const flakyNetworkOperation = () => {
    attemptCount++;
    console.log(`   Network request attempt ${attemptCount}`);
    
    // Fail first 2 attempts, succeed on 3rd
    if (attemptCount <= 2) {
      return exec('exit 1'); // Simulate network timeout
    } else {
      return exec('echo "Network response: success"');
    }
  };
  
  const result = await retryHandler.executeWithRetry(flakyNetworkOperation, {
    maxAttempts: 4,
    baseDelayMs: 500,
    exponentialBase: 2,
    jitter: true,
    retryableErrors: [NonZeroExitError],
    onRetry: (attempt, error) => {
      console.log(`   🔄 Retry callback: Attempt ${attempt} failed with ${error.constructor.name}`);
    },
    onSuccess: (attempt) => {
      console.log(`   ✅ Success callback: Succeeded on attempt ${attempt}`);
    }
  });
  
  if (result.isOk()) {
    console.log(`🎉 Final result: ${result.value.stdout.trim()}`);
  } else {
    console.log('💥 Final result: All attempts failed');
  }
  
  // Show metrics
  const metrics = retryHandler.getMetrics();
  console.log('\n📊 Retry Metrics:');
  console.log(`   Total attempts: ${metrics.totalAttempts}`);
  console.log(`   Successful operations: ${metrics.successfulOperations}`);
  console.log(`   Total retries: ${metrics.totalRetries}`);
}

/**
 * Example 2: Conditional retry based on error types
 */
async function conditionalRetryExample() {
  separator('EXAMPLE 2: Conditional Retry Based on Error Types');
  
  console.log('🔄 Demonstrating conditional retry...');
  
  const retryHandler = new AdvancedRetryHandler();
  
  // Test different error types
  const testCases = [
    {
      name: 'Timeout Error (retryable)',
      operation: () => exec('sleep 2', { timeout: 100 })
    },
    {
      name: 'Non-zero Exit (retryable)',
      operation: () => exec('exit 1')
    },
    {
      name: 'Command Not Found (non-retryable)',
      operation: () => exec('nonexistent-command-xyz')
    }
  ];
  
  for (const testCase of testCases) {
    console.log(`\n🧪 Testing: ${testCase.name}`);
    
    const result = await retryHandler.executeWithRetry(testCase.operation, {
      maxAttempts: 3,
      baseDelayMs: 500,
      retryableErrors: [ProcessTimeoutError, NonZeroExitError], // Only these are retryable
      onRetry: (attempt, error) => {
        console.log(`   Retrying due to ${error.constructor.name}`);
      }
    });
    
    if (result.isOk()) {
      console.log('   ✅ Operation succeeded');
    } else {
      console.log(`   ❌ Operation failed: ${result.error.constructor.name}`);
    }
  }
  
  // Show error distribution
  const metrics = retryHandler.getMetrics();
  console.log('\n📊 Error Distribution:');
  for (const [errorType, count] of metrics.errorDistribution.entries()) {
    console.log(`   ${errorType}: ${count}`);
  }
}

/**
 * Example 3: Batch operations with retry
 */
async function batchRetryExample() {
  separator('EXAMPLE 3: Batch Operations with Retry');
  
  console.log('🔄 Demonstrating batch retry...');
  
  const retryHandler = new AdvancedRetryHandler();
  
  // Create a batch of operations with varying reliability
  const batchOperations = [
    () => exec('echo "Batch operation 1: reliable"'),
    () => exec('exit 1'), // Always fails
    () => exec('echo "Batch operation 3: reliable"'),
    () => {
      // Randomly succeed or fail
      const random = Math.random();
      if (random > 0.6) {
        return exec('echo "Batch operation 4: random success"');
      } else {
        return exec('exit 1');
      }
    },
    () => exec('echo "Batch operation 5: reliable"')
  ];
  
  const results = await retryHandler.executeBatchWithRetry(batchOperations, {
    maxAttempts: 3,
    baseDelayMs: 300,
    retryableErrors: [NonZeroExitError]
  });
  
  console.log('\n📋 Batch Results:');
  results.forEach((result, index) => {
    if (result.isOk()) {
      console.log(`   ✅ Operation ${index + 1}: ${result.value.stdout.trim()}`);
    } else {
      console.log(`   ❌ Operation ${index + 1}: Failed after retries`);
    }
  });
}

/**
 * Example 4: Adaptive retry with learning
 */
async function adaptiveRetryExample() {
  separator('EXAMPLE 4: Adaptive Retry with Learning');
  
  console.log('🔄 Demonstrating adaptive retry...');
  
  const retryHandler = new AdvancedRetryHandler();
  
  // Simulate different phases of system reliability
  const phases = [
    { name: 'High Failure Phase', successRate: 0.2, operations: 5 },
    { name: 'Recovery Phase', successRate: 0.6, operations: 5 },
    { name: 'Stable Phase', successRate: 0.9, operations: 5 }
  ];
  
  for (const phase of phases) {
    console.log(`\n🏗️  Entering: ${phase.name}`);
    
    for (let i = 1; i <= phase.operations; i++) {
      const shouldSucceed = Math.random() < phase.successRate;
      
      const operation = () => {
        if (shouldSucceed) {
          return exec(`echo "Phase operation ${i}: success"`);
        } else {
          return exec('exit 1');
        }
      };
      
      console.log(`\n--- Operation ${i} in ${phase.name} ---`);
      const result = await retryHandler.executeWithAdaptiveRetry(operation, {
        retryableErrors: [NonZeroExitError]
      });
      
      if (result.isOk()) {
        console.log(`   ✅ Result: ${result.value.stdout.trim()}`);
      } else {
        console.log('   ❌ Failed after adaptive retry');
      }
    }
    
    // Show metrics after each phase
    const metrics = retryHandler.getMetrics();
    console.log(`\n📊 Phase ${phase.name} Metrics:`);
    console.log(`   Success rate: ${((metrics.successfulOperations / (metrics.successfulOperations + metrics.failedOperations)) * 100).toFixed(1)}%`);
    console.log(`   Average attempts to success: ${metrics.averageAttemptsToSuccess.toFixed(2)}`);
  }
}

/**
 * Example 5: Retry with circuit breaker integration
 */
async function retryWithCircuitBreakerExample() {
  separator('EXAMPLE 5: Retry with Circuit Breaker Integration');
  
  console.log('🔄 Demonstrating retry with circuit breaker...');
  
  const retryHandler = new AdvancedRetryHandler();
  
  // Simple circuit breaker state
  let circuitState: 'closed' | 'open' | 'half-open' = 'closed';
  let failureCount = 0;
  let lastFailureTime = 0;
  const failureThreshold = 3;
  const recoveryTimeoutMs = 5000;
  
  const circuitBreakerOperation = () => {
    // Check circuit state
    if (circuitState === 'open') {
      if (Date.now() - lastFailureTime < recoveryTimeoutMs) {
        console.log('   🔴 Circuit breaker is OPEN - rejecting request');
        return ResultAsync.fromSafePromise(Promise.reject(new Error('Circuit breaker open')));
      } else {
        console.log('   🟡 Circuit breaker moving to HALF-OPEN');
        circuitState = 'half-open';
      }
    }
    
    // Simulate operation (fails first few times)
    const shouldFail = failureCount < 4;
    
    if (shouldFail) {
      failureCount++;
      lastFailureTime = Date.now();
      
      if (circuitState === 'half-open' || failureCount >= failureThreshold) {
        console.log('   🔴 Circuit breaker opening due to failures');
        circuitState = 'open';
      }
      
      return exec('exit 1');
    } else {
      // Success - reset circuit breaker
      failureCount = 0;
      circuitState = 'closed';
      console.log('   🟢 Circuit breaker closed after success');
      return exec('echo "Service recovered"');
    }
  };
  
  // Test multiple requests with circuit breaker
  for (let i = 1; i <= 8; i++) {
    console.log(`\n🌐 Request ${i}:`);
    console.log(`   Circuit state: ${circuitState.toUpperCase()}`);
    
    const result = await retryHandler.executeWithRetry(circuitBreakerOperation, {
      maxAttempts: 2,
      baseDelayMs: 1000,
      retryableErrors: [NonZeroExitError],
      onRetry: (attempt, error) => {
        console.log(`   Retry ${attempt}: ${error.message}`);
      }
    });
    
    if (result.isOk()) {
      console.log(`   ✅ Success: ${result.value.stdout.trim()}`);
    } else {
      console.log('   ❌ Failed after retries');
    }
    
    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  // Final metrics
  const finalMetrics = retryHandler.getMetrics();
  console.log('\n📈 Final Metrics:');
  console.log(`   Total operations: ${finalMetrics.successfulOperations + finalMetrics.failedOperations}`);
  console.log(`   Success rate: ${((finalMetrics.successfulOperations / (finalMetrics.successfulOperations + finalMetrics.failedOperations)) * 100).toFixed(1)}%`);
  console.log(`   Total retries: ${finalMetrics.totalRetries}`);
}

// Main execution
async function main() {
  console.log('🔄 Advanced Retry Logic Examples');
  console.log('=================================');
  
  try {
    await basicExponentialBackoff();
    await conditionalRetryExample();
    await batchRetryExample();
    await adaptiveRetryExample();
    await retryWithCircuitBreakerExample();
    
    console.log('\n🎊 All retry logic examples completed successfully!');
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

export { AdvancedRetryHandler, main as runRetryLogicExamples };