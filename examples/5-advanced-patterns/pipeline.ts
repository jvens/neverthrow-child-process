#!/usr/bin/env node --loader ts-node/esm

/**
 * Command Pipeline Examples
 * 
 * This example demonstrates building complex command pipelines
 * with proper error handling, data transformation, and composition.
 * 
 * Key concepts:
 * - Command composition and chaining
 * - Data transformation pipelines
 * - Parallel and sequential pipeline execution
 * - Error handling in pipeline stages
 * - Pipeline monitoring and debugging
 */

import { exec, execFile, spawn } from '../../src/index';
import { ResultAsync } from 'neverthrow';
import { ProcessError } from '../../src/index';

function separator(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log('='.repeat(60));
}

interface PipelineStage<TInput, TOutput> {
  name: string;
  execute: (input: TInput) => ResultAsync<TOutput, ProcessError>;
  timeout?: number;
  retryOnFailure?: boolean;
  optional?: boolean;
}

interface PipelineContext {
  startTime: number;
  stageResults: Map<string, any>;
  metadata: Map<string, any>;
}

interface PipelineMetrics {
  totalDuration: number;
  stagesExecuted: number;
  stagesFailed: number;
  stageDurations: Map<string, number>;
}

class Pipeline<TInput, TOutput> {
  private stages: PipelineStage<any, any>[] = [];
  private middleware: Array<(context: PipelineContext, next: () => Promise<void>) => Promise<void>> = [];

  /**
   * Add a stage to the pipeline
   */
  stage<TNext>(
    name: string,
    executeFn: (input: TInput) => ResultAsync<TNext, ProcessError>,
    options: Partial<PipelineStage<TInput, TNext>> = {}
  ): Pipeline<TInput, TNext> {
    const stage: PipelineStage<TInput, TNext> = {
      name,
      execute: executeFn,
      timeout: 30000,
      retryOnFailure: false,
      optional: false,
      ...options
    };

    this.stages.push(stage);
    return this as any;
  }

  /**
   * Add middleware for cross-cutting concerns
   */
  use(middleware: (context: PipelineContext, next: () => Promise<void>) => Promise<void>): this {
    this.middleware.push(middleware);
    return this;
  }

  /**
   * Execute the pipeline
   */
  async execute(input: TInput): Promise<ResultAsync<TOutput, ProcessError>> {
    const context: PipelineContext = {
      startTime: Date.now(),
      stageResults: new Map(),
      metadata: new Map()
    };

    console.log(`🚀 Starting pipeline with ${this.stages.length} stages`);

    try {
      let currentInput = input;

      for (let i = 0; i < this.stages.length; i++) {
        const stage = this.stages[i];
        console.log(`\n📍 Stage ${i + 1}/${this.stages.length}: ${stage.name}`);

        const stageStartTime = Date.now();

        try {
          // Apply middleware
          await this.applyMiddleware(context, async () => {
            const result = await stage.execute(currentInput);

            if (result.isErr()) {
              if (stage.optional) {
                console.log(`⚠️  Optional stage failed: ${stage.name}`);
                context.stageResults.set(stage.name, { error: result.error, optional: true });
                return;
              } else {
                throw result.error;
              }
            }

            currentInput = result.value;
            context.stageResults.set(stage.name, result.value);
          });

          const stageDuration = Date.now() - stageStartTime;
          console.log(`✅ Stage completed in ${stageDuration}ms`);

        } catch (error) {
          const stageDuration = Date.now() - stageStartTime;
          console.log(`❌ Stage failed after ${stageDuration}ms: ${error}`);

          if (!stage.optional) {
            return ResultAsync.fromSafePromise(Promise.reject(error));
          }
        }
      }

      const totalDuration = Date.now() - context.startTime;
      console.log(`🎉 Pipeline completed in ${totalDuration}ms`);

      return ResultAsync.fromSafePromise(Promise.resolve(currentInput as TOutput));

    } catch (error) {
      const totalDuration = Date.now() - context.startTime;
      console.log(`💥 Pipeline failed after ${totalDuration}ms`);

      return ResultAsync.fromSafePromise(
        Promise.reject(error instanceof Error ? error : new Error(String(error)))
      );
    }
  }

  private async applyMiddleware(
    context: PipelineContext,
    next: () => Promise<void>
  ): Promise<void> {
    let index = 0;

    const dispatch = async (): Promise<void> => {
      if (index >= this.middleware.length) {
        await next();
        return;
      }

      const middleware = this.middleware[index++];
      await middleware(context, dispatch);
    };

    await dispatch();
  }
}

/**
 * Create specialized pipeline builders
 */
class DataProcessingPipeline {
  static create() {
    return new Pipeline<string, any>();
  }

  static textProcessing() {
    return this.create()
      .stage('validate-input', (input: string) => {
        if (!input || input.trim().length === 0) {
          return ResultAsync.fromSafePromise(Promise.reject(new Error('Empty input')));
        }
        return ResultAsync.fromSafePromise(Promise.resolve(input.trim()));
      })
      .stage('word-count', (text: string) => {
        return exec(`echo "${text}" | wc -w`).map(result => {
          const wordCount = parseInt(result.stdout.trim());
          return { text, wordCount };
        });
      })
      .stage('line-count', (data: { text: string; wordCount: number }) => {
        return exec(`echo "${data.text}" | wc -l`).map(result => {
          const lineCount = parseInt(result.stdout.trim());
          return { ...data, lineCount };
        });
      });
  }

  static fileProcessing() {
    return this.create()
      .stage('create-temp-file', (content: string) => {
        const filename = `/tmp/pipeline-${Date.now()}.txt`;
        return exec(`echo "${content}" > ${filename}`).map(() => filename);
      })
      .stage('analyze-file', (filename: string) => {
        return exec(`wc -c -w -l ${filename}`).map(result => {
          const [lines, words, chars] = result.stdout.trim().split(/\s+/).map(Number);
          return { filename, lines, words, chars };
        });
      })
      .stage('cleanup-file', (data: any) => {
        return exec(`rm -f ${data.filename}`).map(() => {
          const { filename, ...stats } = data;
          return { stats, cleanedUp: true };
        });
      });
  }
}

/**
 * Example 1: Basic sequential pipeline
 */
async function basicSequentialPipeline() {
  separator('EXAMPLE 1: Basic Sequential Pipeline');

  console.log('🔄 Demonstrating basic sequential pipeline...');

  const pipeline = DataProcessingPipeline.textProcessing()
    .stage('character-count', (data: any) => {
      return exec(`echo "${data.text}" | wc -c`).map(result => {
        const charCount = parseInt(result.stdout.trim()) - 1; // Subtract newline
        return { ...data, charCount };
      });
    })
    .stage('generate-summary', (data: any) => {
      const summary = `Text analysis: ${data.wordCount} words, ${data.lineCount} lines, ${data.charCount} characters`;
      return ResultAsync.fromSafePromise(Promise.resolve({ ...data, summary }));
    });

  const sampleText = "Hello world!\nThis is a sample text for pipeline processing.\nIt has multiple lines.";
  const result = await pipeline.execute(sampleText);

  if (result.isOk()) {
    console.log('📊 Pipeline Result:');
    console.log(`   Summary: ${result.value.summary}`);
    console.log(`   Details: ${JSON.stringify(result.value, null, 2)}`);
  } else {
    console.log('❌ Pipeline failed:', result.error.message);
  }
}

/**
 * Example 2: Pipeline with error handling and optional stages
 */
async function pipelineWithErrorHandling() {
  separator('EXAMPLE 2: Pipeline with Error Handling');

  console.log('🔄 Demonstrating error handling in pipeline...');

  const pipeline = new Pipeline<string, any>()
    .stage('validate-input', (input: string) => {
      console.log('   Validating input...');
      if (input.length < 5) {
        return ResultAsync.fromSafePromise(Promise.reject(new Error('Input too short')));
      }
      return ResultAsync.fromSafePromise(Promise.resolve(input));
    })
    .stage('risky-operation', (input: string) => {
      console.log('   Performing risky operation...');
      // This operation might fail
      const shouldFail = input.includes('fail');
      if (shouldFail) {
        return exec('exit 1');
      }
      return exec(`echo "Processed: ${input}"`);
    }, { optional: true }) // Make this stage optional
    .stage('final-processing', (input: any) => {
      console.log('   Final processing...');
      const processedInput = typeof input === 'string' ? input : input.stdout || 'fallback';
      return ResultAsync.fromSafePromise(Promise.resolve({
        result: `Final: ${processedInput}`,
        timestamp: new Date().toISOString()
      }));
    });

  // Test with different inputs
  const testInputs = [
    'short',                    // Will fail validation
    'this will fail somewhere', // Will fail risky operation but continue
    'this will succeed'         // Will succeed all stages
  ];

  for (const input of testInputs) {
    console.log(`\n🧪 Testing with input: "${input}"`);
    const result = await pipeline.execute(input);

    if (result.isOk()) {
      console.log('✅ Pipeline succeeded:', result.value);
    } else {
      console.log('❌ Pipeline failed:', result.error.message);
    }
  }
}

/**
 * Example 3: Parallel pipeline branches
 */
async function parallelPipelineBranches() {
  separator('EXAMPLE 3: Parallel Pipeline Branches');

  console.log('🔄 Demonstrating parallel pipeline branches...');

  // Create multiple parallel processing branches
  const createAnalysisBranch = (name: string, command: string) =>
    new Pipeline<string, any>()
      .stage(`${name}-analysis`, (text: string) => {
        console.log(`   Running ${name} analysis...`);
        return exec(`echo "${text}" | ${command}`).map(result => ({
          type: name,
          result: result.stdout.trim(),
          processedAt: Date.now()
        }));
      });

  const wordAnalysisBranch = createAnalysisBranch('word', 'wc -w');
  const lineAnalysisBranch = createAnalysisBranch('line', 'wc -l');
  const charAnalysisBranch = createAnalysisBranch('char', 'wc -c');

  const sampleText = "Multi-line text sample\nfor parallel processing\nwith different analyses";

  console.log('🚀 Executing parallel branches...');
  const startTime = Date.now();

  // Execute all branches in parallel
  const branchResults = await Promise.all([
    wordAnalysisBranch.execute(sampleText),
    lineAnalysisBranch.execute(sampleText),
    charAnalysisBranch.execute(sampleText)
  ]);

  const parallelDuration = Date.now() - startTime;

  // Combine results
  const combinedResult = {
    text: sampleText,
    analyses: branchResults
      .filter(r => r.isOk())
      .map(r => r.value),
    parallelDuration
  };

  console.log('📊 Parallel Pipeline Results:');
  console.log(`   Execution time: ${parallelDuration}ms`);
  console.log('   Analyses:');
  combinedResult.analyses.forEach(analysis => {
    console.log(`     ${analysis.type}: ${analysis.result}`);
  });

  // Compare with sequential execution
  console.log('\n🔄 Comparing with sequential execution...');
  const seqStartTime = Date.now();

  for (const branch of [wordAnalysisBranch, lineAnalysisBranch, charAnalysisBranch]) {
    await branch.execute(sampleText);
  }

  const sequentialDuration = Date.now() - seqStartTime;
  console.log(`   Sequential time: ${sequentialDuration}ms`);
  console.log(`   Speedup: ${(sequentialDuration / parallelDuration).toFixed(2)}x`);
}

/**
 * Example 4: Pipeline with middleware
 */
async function pipelineWithMiddleware() {
  separator('EXAMPLE 4: Pipeline with Middleware');

  console.log('🔄 Demonstrating pipeline middleware...');

  const pipeline = DataProcessingPipeline.fileProcessing()
    // Add logging middleware
    .use(async (context, next) => {
      console.log(`   🔍 Middleware: Starting stage execution`);
      const stageStart = Date.now();
      
      await next();
      
      const stageDuration = Date.now() - stageStart;
      console.log(`   🔍 Middleware: Stage completed in ${stageDuration}ms`);
    })
    // Add metrics collection middleware
    .use(async (context, next) => {
      context.metadata.set('middlewareTimestamp', Date.now());
      
      await next();
      
      const executionTime = Date.now() - context.metadata.get('middlewareTimestamp');
      context.metadata.set('lastStageExecutionTime', executionTime);
    })
    // Add error handling middleware
    .use(async (context, next) => {
      try {
        await next();
      } catch (error) {
        console.log(`   🚨 Middleware: Caught error - ${error}`);
        context.metadata.set('lastError', error);
        throw error;
      }
    });

  const content = "Sample file content for middleware demonstration\nwith multiple lines\nand various processing stages.";
  
  const result = await pipeline.execute(content);

  if (result.isOk()) {
    console.log('✅ Pipeline with middleware succeeded:');
    console.log('   Result:', result.value);
  } else {
    console.log('❌ Pipeline with middleware failed:', result.error.message);
  }
}

/**
 * Example 5: Complex data transformation pipeline
 */
async function complexDataTransformationPipeline() {
  separator('EXAMPLE 5: Complex Data Transformation Pipeline');

  console.log('🔄 Demonstrating complex data transformation...');

  // Create a pipeline that processes CSV-like data
  const csvPipeline = new Pipeline<string, any>()
    .stage('parse-csv', (csvData: string) => {
      console.log('   Parsing CSV data...');
      const lines = csvData.trim().split('\n');
      const headers = lines[0].split(',');
      const rows = lines.slice(1).map(line => {
        const values = line.split(',');
        const obj: any = {};
        headers.forEach((header, index) => {
          obj[header.trim()] = values[index]?.trim() || '';
        });
        return obj;
      });
      
      return ResultAsync.fromSafePromise(Promise.resolve({ headers, rows, count: rows.length }));
    })
    .stage('validate-data', (data: any) => {
      console.log('   Validating data structure...');
      if (!data.rows || data.rows.length === 0) {
        return ResultAsync.fromSafePromise(Promise.reject(new Error('No data rows found')));
      }
      
      // Add validation metadata
      const validRows = data.rows.filter((row: any) => 
        Object.values(row).every(value => value !== '')
      );
      
      return ResultAsync.fromSafePromise(Promise.resolve({
        ...data,
        validRows: validRows.length,
        invalidRows: data.rows.length - validRows.length
      }));
    })
    .stage('generate-statistics', (data: any) => {
      console.log('   Generating statistics...');
      
      // Use command line tools for statistics
      const tempFile = `/tmp/pipeline-data-${Date.now()}.json`;
      const jsonData = JSON.stringify(data.rows);
      
      return exec(`echo '${jsonData}' > ${tempFile}`)
        .andThen(() => exec(`wc -c ${tempFile}`))
        .map(result => {
          const fileSize = parseInt(result.stdout.trim().split(' ')[0]);
          
          return {
            ...data,
            statistics: {
              totalRows: data.rows.length,
              validRows: data.validRows,
              invalidRows: data.invalidRows,
              dataSize: fileSize,
              averageRowSize: Math.round(fileSize / data.rows.length)
            }
          };
        })
        .andThen(result => 
          exec(`rm -f ${tempFile}`).map(() => result)
        );
    })
    .stage('format-output', (data: any) => {
      console.log('   Formatting final output...');
      
      const report = {
        summary: `Processed ${data.statistics.totalRows} rows (${data.statistics.validRows} valid, ${data.statistics.invalidRows} invalid)`,
        details: data.statistics,
        processedAt: new Date().toISOString()
      };
      
      return ResultAsync.fromSafePromise(Promise.resolve(report));
    });

  // Sample CSV data
  const csvData = `name,age,city
John Doe,30,New York
Jane Smith,25,Los Angeles
Bob Johnson,,Chicago
Alice Brown,35,
Charlie Wilson,28,Seattle`;

  const result = await csvPipeline.execute(csvData);

  if (result.isOk()) {
    console.log('📊 Data Transformation Results:');
    console.log(`   Summary: ${result.value.summary}`);
    console.log('   Details:', JSON.stringify(result.value.details, null, 2));
  } else {
    console.log('❌ Data transformation failed:', result.error.message);
  }
}

// Main execution
async function main() {
  console.log('🔗 Command Pipeline Examples');
  console.log('=============================');

  try {
    await basicSequentialPipeline();
    await pipelineWithErrorHandling();
    await parallelPipelineBranches();
    await pipelineWithMiddleware();
    await complexDataTransformationPipeline();

    console.log('\n🎊 All pipeline examples completed successfully!');
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

export { Pipeline, DataProcessingPipeline, main as runPipelineExamples };