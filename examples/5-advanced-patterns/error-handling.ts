#!/usr/bin/env node --loader ts-node/esm

/**
 * Advanced Error Handling Examples
 * 
 * This example demonstrates sophisticated error handling patterns,
 * including retry logic, circuit breakers, and error classification.
 * 
 * Key concepts:
 * - Comprehensive error classification and handling
 * - Retry strategies with exponential backoff
 * - Circuit breaker pattern implementation
 * - Error recovery and fallback mechanisms
 * - Error aggregation and reporting
 */

import { exec, execFile, spawn, waitForExit } from '../../src/index';
import { Result, ResultAsync, ok, err } from 'neverthrow';
import { 
  ProcessError, 
  NonZeroExitError, 
  ProcessTimeoutError, 
  ProcessNotFoundError 
} from '../../src/index';

function separator(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log('='.repeat(60));
}

interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBase: number;
  retryableErrors: string[];
}

interface CircuitBreakerOptions {
  failureThreshold: number;
  recoveryTimeoutMs: number;
  monitoringPeriodMs: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

class RetryHandler {
  private defaultOptions: RetryOptions = {
    maxAttempts: 3,
    baseDelayMs: 1000,
    maxDelayMs: 30000,
    exponentialBase: 2,
    retryableErrors: ['ProcessTimeoutError', 'ProcessNotFoundError']
  };

  /**
   * Execute with retry logic
   */
  async executeWithRetry<T>(
    operation: () => ResultAsync<T, ProcessError>,
    options: Partial<RetryOptions> = {}
  ): Promise<ResultAsync<T, ProcessError>> {
    const opts = { ...this.defaultOptions, ...options };
    let lastError: ProcessError | null = null;

    for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
      console.log(`🔄 Attempt ${attempt}/${opts.maxAttempts}`);
      
      const result = await operation();
      
      if (result.isOk()) {
        if (attempt > 1) {
          console.log(`✅ Operation succeeded on attempt ${attempt}`);
        }
        return ResultAsync.fromSafePromise(Promise.resolve(ok(result.value)))
          .andThen(result => result);
      }
      
      lastError = result.error;
      console.log(`❌ Attempt ${attempt} failed: ${lastError.message}`);
      
      // Check if error is retryable
      if (!this.isRetryable(lastError, opts.retryableErrors)) {
        console.log(`🚫 Error is not retryable: ${lastError.constructor.name}`);
        break;
      }
      
      // Don't wait after the last attempt
      if (attempt < opts.maxAttempts) {
        const delay = this.calculateDelay(attempt, opts);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    console.log(`💥 Operation failed after ${opts.maxAttempts} attempts`);
    return ResultAsync.fromSafePromise(Promise.resolve(err(lastError!)))
      .andThen(result => result);
  }

  private isRetryable(error: ProcessError, retryableErrors: string[]): boolean {
    return retryableErrors.includes(error.constructor.name);
  }

  private calculateDelay(attempt: number, options: RetryOptions): number {
    const delay = options.baseDelayMs * Math.pow(options.exponentialBase, attempt - 1);
    return Math.min(delay, options.maxDelayMs);
  }
}

class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failureCount = 0;
  private lastFailureTime = 0;
  private successCount = 0;
  private totalRequests = 0;

  constructor(private options: CircuitBreakerOptions) {}

  async execute<T>(
    operation: () => ResultAsync<T, ProcessError>
  ): Promise<ResultAsync<T, ProcessError>> {
    this.totalRequests++;
    
    // Check circuit state
    if (this.state === 'open') {
      if (Date.now() - this.lastFailureTime < this.options.recoveryTimeoutMs) {
        console.log('🔴 Circuit breaker is OPEN - rejecting request');
        return ResultAsync.fromSafePromise(
          Promise.resolve(err(new ProcessTimeoutError('Circuit breaker is open')))
        ).andThen(result => result);
      } else {
        console.log('🟡 Circuit breaker moving to HALF-OPEN');
        this.state = 'half-open';
      }
    }

    const result = await operation();

    if (result.isOk()) {
      this.onSuccess();
      return result;
    } else {
      this.onFailure();
      return result;
    }
  }

  private onSuccess(): void {
    this.successCount++;
    
    if (this.state === 'half-open') {
      console.log('🟢 Circuit breaker closing after successful test');
      this.state = 'closed';
      this.failureCount = 0;
    } else if (this.state === 'closed') {
      // Reset failure count on success
      this.failureCount = 0;
    }
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'half-open') {
      console.log('🔴 Circuit breaker opening after test failure');
      this.state = 'open';
    } else if (this.state === 'closed' && this.failureCount >= this.options.failureThreshold) {
      console.log(`🔴 Circuit breaker opening after ${this.failureCount} failures`);
      this.state = 'open';
    }
  }

  getStats() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      totalRequests: this.totalRequests,
      failureRate: this.totalRequests > 0 ? this.failureCount / this.totalRequests : 0
    };
  }
}

class ErrorClassifier {
  /**
   * Classify errors by type and severity
   */
  classifyError(error: ProcessError): {
    category: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    retryable: boolean;
    userAction: string;
  } {
    if (error instanceof ProcessNotFoundError) {
      return {
        category: 'Missing Command',
        severity: 'high',
        retryable: false,
        userAction: 'Ensure the command is installed and in PATH'
      };
    }

    if (error instanceof ProcessTimeoutError) {
      return {
        category: 'Timeout',
        severity: 'medium',
        retryable: true,
        userAction: 'Consider increasing timeout or checking system load'
      };
    }

    if (error instanceof NonZeroExitError) {
      const exitCode = error.exitCode;
      
      if (exitCode === 1) {
        return {
          category: 'General Error',
          severity: 'medium',
          retryable: true,
          userAction: 'Check command arguments and input data'
        };
      } else if (exitCode === 126) {
        return {
          category: 'Permission Denied',
          severity: 'high',
          retryable: false,
          userAction: 'Check file permissions and execution rights'
        };
      } else if (exitCode === 127) {
        return {
          category: 'Command Not Found',
          severity: 'high',
          retryable: false,
          userAction: 'Verify command name and PATH configuration'
        };
      } else if (exitCode >= 128) {
        return {
          category: 'Signal Termination',
          severity: 'critical',
          retryable: false,
          userAction: 'Process was terminated by signal - check system resources'
        };
      }
    }

    return {
      category: 'Unknown Error',
      severity: 'medium',
      retryable: true,
      userAction: 'Review error details and try again'
    };
  }

  /**
   * Generate error report
   */
  generateErrorReport(errors: ProcessError[]): void {
    console.log('\n📊 ERROR ANALYSIS REPORT');
    console.log('========================');

    const errorStats = new Map<string, number>();
    const severityStats = new Map<string, number>();
    
    errors.forEach(error => {
      const classification = this.classifyError(error);
      
      errorStats.set(classification.category, 
        (errorStats.get(classification.category) || 0) + 1);
      
      severityStats.set(classification.severity,
        (severityStats.get(classification.severity) || 0) + 1);
    });

    console.log('\n📈 Error Categories:');
    for (const [category, count] of errorStats.entries()) {
      console.log(`   ${category}: ${count}`);
    }

    console.log('\n🚨 Severity Distribution:');
    for (const [severity, count] of severityStats.entries()) {
      const icon = this.getSeverityIcon(severity);
      console.log(`   ${icon} ${severity}: ${count}`);
    }

    console.log('\n🔍 Top Errors:');
    const sortedErrors = Array.from(errorStats.entries())
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);
    
    sortedErrors.forEach(([category, count], index) => {
      console.log(`   ${index + 1}. ${category}: ${count} occurrences`);
    });
  }

  private getSeverityIcon(severity: string): string {
    switch (severity) {
      case 'low': return '💙';
      case 'medium': return '💛';
      case 'high': return '🧡';
      case 'critical': return '❤️';
      default: return '⚪';
    }
  }
}

/**
 * Example 1: Retry logic with exponential backoff
 */
async function retryLogicExample() {
  separator('EXAMPLE 1: Retry Logic with Exponential Backoff');

  console.log('🔄 Demonstrating retry logic...');

  const retryHandler = new RetryHandler();

  // Simulate a flaky command that sometimes fails
  let attemptCount = 0;
  const flakyOperation = () => {
    attemptCount++;
    
    if (attemptCount <= 2) {
      // Fail first two attempts
      console.log(`   Simulating failure on attempt ${attemptCount}`);
      return exec('exit 1');  // Will create NonZeroExitError
    } else {
      // Succeed on third attempt
      console.log('   Operation succeeding...');
      return exec('echo "Success!"');
    }
  };

  const result = await retryHandler.executeWithRetry(flakyOperation, {
    maxAttempts: 4,
    baseDelayMs: 500,
    exponentialBase: 2,
    retryableErrors: ['NonZeroExitError']
  });

  if (result.isOk()) {
    console.log('✅ Final result: Operation succeeded');
  } else {
    console.log('❌ Final result: Operation failed');
  }
}

/**
 * Example 2: Circuit breaker pattern
 */
async function circuitBreakerExample() {
  separator('EXAMPLE 2: Circuit Breaker Pattern');

  console.log('🔄 Demonstrating circuit breaker...');

  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 3,
    recoveryTimeoutMs: 5000,
    monitoringPeriodMs: 1000
  });

  // Simulate a service that starts failing
  let requestCount = 0;
  const flakyService = () => {
    requestCount++;
    
    // Fail requests 2-6 to trigger circuit breaker
    if (requestCount >= 2 && requestCount <= 6) {
      console.log(`   Request ${requestCount}: Service failing`);
      return exec('exit 1');
    } else {
      console.log(`   Request ${requestCount}: Service working`);
      return exec('echo "Service response"');
    }
  };

  // Make several requests to demonstrate circuit breaker behavior
  for (let i = 1; i <= 10; i++) {
    console.log(`\n🌐 Making request ${i}:`);
    
    const result = await circuitBreaker.execute(flakyService);
    
    if (result.isOk()) {
      console.log('✅ Request succeeded');
    } else {
      console.log('❌ Request failed:', result.error.message);
    }

    const stats = circuitBreaker.getStats();
    console.log(`📊 Circuit Stats: ${stats.state.toUpperCase()}, Failures: ${stats.failureCount}, Success Rate: ${((1 - stats.failureRate) * 100).toFixed(1)}%`);

    // Wait between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * Example 3: Error classification and analysis
 */
async function errorClassificationExample() {
  separator('EXAMPLE 3: Error Classification and Analysis');

  console.log('🔄 Demonstrating error classification...');

  const classifier = new ErrorClassifier();
  const errors: ProcessError[] = [];

  // Generate various types of errors
  const errorGenerators = [
    () => exec('nonexistent-command'),  // Command not found
    () => exec('exit 1'),               // General error
    () => exec('exit 126'),             // Permission denied
    () => exec('exit 127'),             // Command not found (shell)
    () => exec('sleep 10', { timeout: 100 }),  // Timeout
    () => execFile('nonexistent-file')  // File not found
  ];

  console.log('Generating sample errors...');
  
  for (let i = 0; i < errorGenerators.length; i++) {
    const generator = errorGenerators[i];
    
    try {
      const result = await generator();
      if (result.isErr()) {
        errors.push(result.error);
        
        const classification = classifier.classifyError(result.error);
        console.log(`\n❌ Error ${i + 1}:`);
        console.log(`   Type: ${result.error.constructor.name}`);
        console.log(`   Category: ${classification.category}`);
        console.log(`   Severity: ${classification.severity}`);
        console.log(`   Retryable: ${classification.retryable}`);
        console.log(`   Action: ${classification.userAction}`);
      }
    } catch (error) {
      // Some operations might throw before returning a Result
      console.log(`⚠️  Error ${i + 1}: ${error}`);
    }
  }

  // Generate error report
  classifier.generateErrorReport(errors);
}

/**
 * Example 4: Fallback mechanisms
 */
async function fallbackMechanismsExample() {
  separator('EXAMPLE 4: Fallback Mechanisms');

  console.log('🔄 Demonstrating fallback mechanisms...');

  // Primary, secondary, and tertiary strategies
  const strategies = [
    {
      name: 'Primary (fast but unreliable)',
      operation: () => exec('exit 1')  // Simulates failure
    },
    {
      name: 'Secondary (slower but more reliable)',
      operation: () => exec('echo "Secondary strategy worked"')
    },
    {
      name: 'Tertiary (fallback to local cache)',
      operation: () => exec('echo "Using cached data"')
    }
  ];

  for (const strategy of strategies) {
    console.log(`\n🎯 Trying: ${strategy.name}`);
    
    const result = await strategy.operation();
    
    if (result.isOk()) {
      console.log(`✅ Success with: ${strategy.name}`);
      console.log(`📤 Result: ${result.value.stdout.trim()}`);
      break;
    } else {
      console.log(`❌ Failed: ${strategy.name} - ${result.error.message}`);
      
      if (strategy === strategies[strategies.length - 1]) {
        console.log('💥 All fallback strategies exhausted');
      } else {
        console.log('🔄 Falling back to next strategy...');
      }
    }
  }
}

/**
 * Example 5: Comprehensive error handling pipeline
 */
async function comprehensiveErrorHandling() {
  separator('EXAMPLE 5: Comprehensive Error Handling Pipeline');

  console.log('🔄 Demonstrating comprehensive error handling...');

  const retryHandler = new RetryHandler();
  const circuitBreaker = new CircuitBreaker({
    failureThreshold: 2,
    recoveryTimeoutMs: 3000,
    monitoringPeriodMs: 1000
  });
  const classifier = new ErrorClassifier();

  // Complex operation that combines retry + circuit breaker + classification
  const complexOperation = async (shouldFail: boolean) => {
    const operation = () => {
      if (shouldFail) {
        return exec('exit 1');
      } else {
        return exec('echo "Complex operation succeeded"');
      }
    };

    console.log('\n🔧 Executing complex operation...');

    // Step 1: Circuit breaker check
    const circuitResult = await circuitBreaker.execute(operation);
    
    if (circuitResult.isErr()) {
      const classification = classifier.classifyError(circuitResult.error);
      
      console.log('📊 Error Classification:');
      console.log(`   Category: ${classification.category}`);
      console.log(`   Severity: ${classification.severity}`);
      console.log(`   Retryable: ${classification.retryable}`);
      
      // Step 2: Retry if appropriate
      if (classification.retryable) {
        console.log('🔄 Attempting retry...');
        
        const retryResult = await retryHandler.executeWithRetry(() => 
          circuitBreaker.execute(operation), {
          maxAttempts: 2,
          baseDelayMs: 1000
        });
        
        return retryResult;
      }
    }

    return circuitResult;
  };

  // Test the pipeline with failing operations first
  console.log('Phase 1: Testing with failing operations');
  for (let i = 1; i <= 4; i++) {
    console.log(`\n--- Test ${i} ---`);
    const result = await complexOperation(true);
    
    if (result.isOk()) {
      console.log('✅ Operation succeeded');
    } else {
      console.log('❌ Operation failed after all retry attempts');
    }
  }

  // Wait for circuit breaker recovery
  console.log('\n⏳ Waiting for circuit breaker recovery...');
  await new Promise(resolve => setTimeout(resolve, 4000));

  // Test with successful operations
  console.log('\nPhase 2: Testing with successful operations');
  for (let i = 1; i <= 2; i++) {
    console.log(`\n--- Recovery Test ${i} ---`);
    const result = await complexOperation(false);
    
    if (result.isOk()) {
      console.log('✅ Operation succeeded:', result.value.stdout.trim());
    } else {
      console.log('❌ Operation failed');
    }
  }

  // Final stats
  const stats = circuitBreaker.getStats();
  console.log('\n📈 Final Circuit Breaker Stats:');
  console.log(`   State: ${stats.state.toUpperCase()}`);
  console.log(`   Total Requests: ${stats.totalRequests}`);
  console.log(`   Failures: ${stats.failureCount}`);
  console.log(`   Success Rate: ${((1 - stats.failureRate) * 100).toFixed(1)}%`);
}

// Main execution
async function main() {
  console.log('🛡️  Advanced Error Handling Examples');
  console.log('====================================');

  try {
    await retryLogicExample();
    await circuitBreakerExample();
    await errorClassificationExample();
    await fallbackMechanismsExample();
    await comprehensiveErrorHandling();

    console.log('\n🎊 All advanced error handling examples completed successfully!');
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

export { RetryHandler, CircuitBreaker, ErrorClassifier, main as runErrorHandlingExamples };