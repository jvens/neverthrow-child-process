#!/usr/bin/env node --loader ts-node/esm

/**
 * Real Build Pipeline Example
 * 
 * This example demonstrates a realistic build pipeline that combines
 * sequential and parallel execution patterns for optimal performance
 * while maintaining proper dependency ordering.
 * 
 * Key concepts:
 * - Multi-stage build pipeline
 * - Dependency management between stages
 * - Mixed sequential/parallel execution
 * - Error handling with rollback capabilities
 * - Build artifact management
 * - Performance optimization
 */

import { exec, execFile } from '../../src/index';

interface BuildStage {
  name: string;
  description: string;
  parallel?: boolean;
  tasks: BuildTask[];
  dependsOn?: string[];
}

interface BuildTask {
  name: string;
  command: string;
  args?: string[];
  useExecFile?: boolean;
  cwd?: string;
  timeout?: number;
  critical?: boolean; // If true, failure stops the entire build
}

interface BuildConfig {
  projectName: string;
  buildDir: string;
  sourceDir: string;
  outputDir: string;
  stages: BuildStage[];
}

class BuildPipeline {
  private config: BuildConfig;
  private stageResults: Map<string, boolean> = new Map();
  private buildStartTime: number = 0;
  private verbose: boolean = true;

  constructor(config: BuildConfig, verbose = true) {
    this.config = config;
    this.verbose = verbose;
  }

  /**
   * Execute the complete build pipeline
   */
  async execute(): Promise<void> {
    this.log(`🏗️  Starting build pipeline for ${this.config.projectName}`);
    this.buildStartTime = Date.now();
    
    try {
      // Setup build environment
      await this.setupBuildEnvironment();
      
      // Execute stages in order
      for (const stage of this.config.stages) {
        await this.executeStage(stage);
        this.stageResults.set(stage.name, true);
      }
      
      const totalTime = Date.now() - this.buildStartTime;
      this.log(`🎉 Build pipeline completed successfully in ${totalTime}ms`);
      
    } catch (error) {
      const totalTime = Date.now() - this.buildStartTime;
      this.log(`❌ Build pipeline failed after ${totalTime}ms: ${error}`);
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Setup build environment
   */
  private async setupBuildEnvironment(): Promise<void> {
    this.log('\n📋 Setting up build environment...');
    
    const setupTasks = [
      `mkdir -p "${this.config.buildDir}"`,
      `mkdir -p "${this.config.sourceDir}"`,
      `mkdir -p "${this.config.outputDir}"`,
      `mkdir -p "${this.config.buildDir}/temp"`,
      `mkdir -p "${this.config.buildDir}/logs"`
    ];
    
    for (const task of setupTasks) {
      const result = await exec(task);
      if (result.isErr()) {
        throw new Error(`Setup failed: ${result.error.message}`);
      }
    }
    
    this.log('✅ Build environment ready');
  }

  /**
   * Execute a single build stage
   */
  private async executeStage(stage: BuildStage): Promise<void> {
    this.log(`\n🚀 Stage: ${stage.name}`);
    this.log(`   ${stage.description}`);
    
    // Check dependencies
    if (stage.dependsOn) {
      for (const dependency of stage.dependsOn) {
        if (!this.stageResults.get(dependency)) {
          throw new Error(`Stage ${stage.name} depends on ${dependency} which has not completed successfully`);
        }
      }
    }
    
    const stageStartTime = Date.now();
    
    if (stage.parallel) {
      await this.executeTasksParallel(stage.tasks);
    } else {
      await this.executeTasksSequential(stage.tasks);
    }
    
    const stageDuration = Date.now() - stageStartTime;
    this.log(`✅ Stage ${stage.name} completed in ${stageDuration}ms`);
  }

  /**
   * Execute tasks in parallel
   */
  private async executeTasksParallel(tasks: BuildTask[]): Promise<void> {
    this.log(`   ⚡ Executing ${tasks.length} tasks in parallel...`);
    
    const taskPromises = tasks.map(async (task) => {
      const result = await this.executeTask(task);
      return { task, result };
    });
    
    const results = await Promise.all(taskPromises);
    
    // Check for critical failures
    for (const { task, result } of results) {
      if (result.isErr() && task.critical !== false) {
        throw new Error(`Critical task ${task.name} failed: ${result.error.message}`);
      }
    }
  }

  /**
   * Execute tasks sequentially
   */
  private async executeTasksSequential(tasks: BuildTask[]): Promise<void> {
    this.log(`   🔄 Executing ${tasks.length} tasks sequentially...`);
    
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      this.log(`     📍 Task ${i + 1}/${tasks.length}: ${task.name}`);
      
      const result = await this.executeTask(task);
      
      if (result.isErr()) {
        if (task.critical !== false) {
          throw new Error(`Task ${task.name} failed: ${result.error.message}`);
        } else {
          this.log(`     ⚠️  Non-critical task failed: ${task.name}`);
        }
      } else {
        this.log(`     ✅ Task completed: ${task.name}`);
      }
    }
  }

  /**
   * Execute a single task
   */
  private async executeTask(task: BuildTask): Promise<any> {
    const options = {
      cwd: task.cwd || this.config.buildDir,
      timeout: task.timeout || 30000
    };
    
    if (task.useExecFile) {
      return execFile(task.command, task.args || [], options);
    } else {
      return exec(task.command, options);
    }
  }

  /**
   * Cleanup build artifacts
   */
  private async cleanup(): Promise<void> {
    this.log('\n🧹 Cleaning up build artifacts...');
    await exec(`rm -rf "${this.config.buildDir}/temp"`);
    this.log('✅ Cleanup completed');
  }

  private log(message: string): void {
    if (this.verbose) {
      console.log(message);
    }
  }
}

/**
 * Example 1: TypeScript Project Build Pipeline
 */
async function typescriptBuildPipeline() {
  console.log('='.repeat(70));
  console.log('EXAMPLE 1: TypeScript Project Build Pipeline');
  console.log('='.repeat(70));

  const projectPath = '/tmp/typescript-build-demo';
  
  const buildConfig: BuildConfig = {
    projectName: 'TypeScript Demo Project',
    buildDir: projectPath,
    sourceDir: `${projectPath}/src`,
    outputDir: `${projectPath}/dist`,
    stages: [
      {
        name: 'setup',
        description: 'Project initialization and dependency setup',
        parallel: false,
        tasks: [
          {
            name: 'Create source files',
            command: `cat > "${projectPath}/src/index.ts" << 'EOF'
export interface User {
  id: number;
  name: string;
  email: string;
}

export class UserService {
  private users: User[] = [];

  addUser(user: User): void {
    this.users.push(user);
  }

  getUser(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getAllUsers(): User[] {
    return [...this.users];
  }
}

console.log('UserService initialized');
EOF`
          },
          {
            name: 'Create package.json',
            command: `cat > "${projectPath}/package.json" << 'EOF'
{
  "name": "typescript-demo",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "test": "echo \\"Tests passed\\"",
    "lint": "echo \\"Lint passed\\""
  },
  "devDependencies": {
    "typescript": "^5.0.0"
  }
}
EOF`
          },
          {
            name: 'Create tsconfig.json',
            command: `cat > "${projectPath}/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF`
          }
        ]
      },
      {
        name: 'validation',
        description: 'Code quality checks and validation',
        parallel: true,
        dependsOn: ['setup'],
        tasks: [
          {
            name: 'Type checking',
            command: 'echo "TypeScript type checking: PASSED" && sleep 1',
            critical: true
          },
          {
            name: 'Linting',
            command: 'echo "ESLint validation: PASSED" && sleep 0.8',
            critical: true
          },
          {
            name: 'Unit tests',
            command: 'echo "Unit tests: 15 passed, 0 failed" && sleep 1.2',
            critical: true
          },
          {
            name: 'Integration tests',
            command: 'echo "Integration tests: 8 passed, 0 failed" && sleep 1.5',
            critical: false
          }
        ]
      },
      {
        name: 'build',
        description: 'Compilation and asset generation',
        parallel: true,
        dependsOn: ['validation'],
        tasks: [
          {
            name: 'Compile TypeScript',
            command: 'echo "Compiling TypeScript..." && sleep 2 && echo "TypeScript compilation complete"',
            critical: true
          },
          {
            name: 'Generate documentation',
            command: 'echo "Generating API documentation..." && sleep 1 && echo "Documentation generated"',
            critical: false
          },
          {
            name: 'Optimize assets',
            command: 'echo "Optimizing assets..." && sleep 1.5 && echo "Assets optimized"',
            critical: false
          }
        ]
      },
      {
        name: 'package',
        description: 'Package creation and finalization',
        parallel: false,
        dependsOn: ['build'],
        tasks: [
          {
            name: 'Create distribution package',
            command: `echo "Creating package..." && echo "Built successfully" > "${projectPath}/dist/index.js"`,
            critical: true
          },
          {
            name: 'Generate build manifest',
            command: `echo "{\\"buildTime\\": \\"$(date)\\", \\"version\\": \\"1.0.0\\"}" > "${projectPath}/dist/manifest.json"`,
            critical: false
          },
          {
            name: 'Create archive',
            command: `cd "${projectPath}" && tar -czf dist.tar.gz dist/`,
            critical: false
          }
        ]
      }
    ]
  };

  const pipeline = new BuildPipeline(buildConfig);
  
  try {
    await pipeline.execute();
    
    // Show build artifacts
    console.log('\n📦 Build Artifacts:');
    const listResult = await exec(`find "${projectPath}" -type f -name "*.js" -o -name "*.json" -o -name "*.gz" | head -10`);
    if (listResult.isOk()) {
      console.log(listResult.value.stdout);
    }
    
  } catch (error) {
    console.error('Build pipeline failed:', error);
  } finally {
    // Cleanup
    await exec(`rm -rf "${projectPath}"`);
  }
}

/**
 * Example 2: Multi-Language Build Pipeline
 */
async function multiLanguageBuildPipeline() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 2: Multi-Language Build Pipeline');
  console.log('='.repeat(70));

  const projectPath = '/tmp/multi-lang-build-demo';
  
  const buildConfig: BuildConfig = {
    projectName: 'Multi-Language Project',
    buildDir: projectPath,
    sourceDir: `${projectPath}/src`,
    outputDir: `${projectPath}/dist`,
    stages: [
      {
        name: 'setup',
        description: 'Multi-language project setup',
        parallel: false,
        tasks: [
          {
            name: 'Create frontend sources',
            command: `mkdir -p "${projectPath}/src/frontend" && echo "console.log('Frontend app');" > "${projectPath}/src/frontend/app.js"`
          },
          {
            name: 'Create backend sources',
            command: `mkdir -p "${projectPath}/src/backend" && echo "#!/usr/bin/env python3\nprint('Backend service')" > "${projectPath}/src/backend/main.py"`
          },
          {
            name: 'Create shared resources',
            command: `mkdir -p "${projectPath}/src/shared" && echo "/* Shared styles */" > "${projectPath}/src/shared/styles.css"`
          }
        ]
      },
      {
        name: 'frontend-build',
        description: 'Frontend build and optimization',
        parallel: true,
        dependsOn: ['setup'],
        tasks: [
          {
            name: 'JavaScript bundling',
            command: 'echo "Bundling JavaScript..." && sleep 2 && echo "JS bundle: 245KB"',
            critical: true
          },
          {
            name: 'CSS processing',
            command: 'echo "Processing CSS..." && sleep 1 && echo "CSS processed: 45KB"',
            critical: true
          },
          {
            name: 'Image optimization',
            command: 'echo "Optimizing images..." && sleep 1.5 && echo "Images optimized: 1.2MB → 380KB"',
            critical: false
          }
        ]
      },
      {
        name: 'backend-build',
        description: 'Backend compilation and setup',
        parallel: true,
        dependsOn: ['setup'],
        tasks: [
          {
            name: 'Python compilation',
            command: 'echo "Compiling Python bytecode..." && sleep 1.5 && echo "Python compiled"',
            critical: true
          },
          {
            name: 'Dependency resolution',
            command: 'echo "Resolving dependencies..." && sleep 1 && echo "Dependencies resolved"',
            critical: true
          },
          {
            name: 'API documentation',
            command: 'echo "Generating API docs..." && sleep 1 && echo "API docs generated"',
            critical: false
          }
        ]
      },
      {
        name: 'integration',
        description: 'Integration testing and deployment prep',
        parallel: false,
        dependsOn: ['frontend-build', 'backend-build'],
        tasks: [
          {
            name: 'Integration tests',
            command: 'echo "Running integration tests..." && sleep 2 && echo "Integration tests: PASSED"',
            critical: true
          },
          {
            name: 'Performance tests',
            command: 'echo "Performance testing..." && sleep 1.5 && echo "Performance: 95% score"',
            critical: false
          },
          {
            name: 'Security scan',
            command: 'echo "Security scanning..." && sleep 1 && echo "Security: No vulnerabilities found"',
            critical: true
          }
        ]
      },
      {
        name: 'deploy-prep',
        description: 'Deployment preparation',
        parallel: true,
        dependsOn: ['integration'],
        tasks: [
          {
            name: 'Docker image build',
            command: 'echo "Building Docker image..." && sleep 2.5 && echo "Docker image: multi-lang:1.0.0"',
            critical: true
          },
          {
            name: 'Configuration generation',
            command: 'echo "Generating configs..." && sleep 0.5 && echo "Configs generated"',
            critical: true
          },
          {
            name: 'Release notes',
            command: 'echo "Generating release notes..." && sleep 0.5 && echo "Release notes ready"',
            critical: false
          }
        ]
      }
    ]
  };

  const pipeline = new BuildPipeline(buildConfig);
  
  try {
    await pipeline.execute();
    console.log('\n🎊 Multi-language build completed successfully!');
  } catch (error) {
    console.error('Multi-language build failed:', error);
  } finally {
    await exec(`rm -rf "${projectPath}"`);
  }
}

/**
 * Example 3: Build pipeline with failure recovery
 */
async function buildPipelineWithRecovery() {
  console.log('\n' + '='.repeat(70));
  console.log('EXAMPLE 3: Build Pipeline with Failure Recovery');
  console.log('='.repeat(70));

  const projectPath = '/tmp/recovery-build-demo';
  
  console.log('🔄 Attempting build with intentional failure...');
  
  const flakyConfig: BuildConfig = {
    projectName: 'Recovery Demo Project',
    buildDir: projectPath,
    sourceDir: `${projectPath}/src`,
    outputDir: `${projectPath}/dist`,
    stages: [
      {
        name: 'setup',
        description: 'Project setup',
        parallel: false,
        tasks: [
          {
            name: 'Initialize project',
            command: `mkdir -p "${projectPath}/src" && echo "Project initialized"`,
            critical: true
          }
        ]
      },
      {
        name: 'flaky-stage',
        description: 'Stage with potential failures',
        parallel: true,
        dependsOn: ['setup'],
        tasks: [
          {
            name: 'Reliable task',
            command: 'echo "This always works" && sleep 1',
            critical: false
          },
          {
            name: 'Flaky task',
            command: 'echo "This might fail" && exit 1',
            critical: false  // Non-critical, so build continues
          },
          {
            name: 'Another reliable task',
            command: 'echo "This also works" && sleep 0.5',
            critical: false
          }
        ]
      },
      {
        name: 'recovery',
        description: 'Recovery and completion',
        parallel: false,
        dependsOn: ['flaky-stage'],
        tasks: [
          {
            name: 'Check and recover',
            command: 'echo "Checking build status..." && echo "Recovering from failures..." && echo "Recovery complete"',
            critical: true
          }
        ]
      }
    ]
  };

  const pipeline = new BuildPipeline(flakyConfig);
  
  try {
    await pipeline.execute();
    console.log('\n✅ Build completed despite non-critical failures!');
    console.log('   This demonstrates resilient build pipeline design.');
  } catch (error) {
    console.error('Build failed:', error);
  } finally {
    await exec(`rm -rf "${projectPath}"`);
  }
}

// Main execution
async function main() {
  console.log('🏗️  Real Build Pipeline Examples');
  console.log('===============================');
  
  try {
    await typescriptBuildPipeline();
    await multiLanguageBuildPipeline();
    await buildPipelineWithRecovery();
    
    console.log('\n🎊 All build pipeline examples completed successfully!');
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

export { BuildPipeline, main as runBuildScriptExamples };