#!/usr/bin/env node --loader ts-node/esm

/**
 * Simple Shell Script Automation
 * 
 * This example demonstrates how to create a simple shell script that executes
 * several commands sequentially with proper error handling and logging.
 * 
 * Key concepts:
 * - Sequential command execution
 * - Error handling between steps
 * - Logging and progress tracking
 * - Early termination on failure
 */

import { exec, execFile } from '../../src/index';

interface ShellStep {
  name: string;
  command: string;
  args?: string[];
  useExecFile?: boolean;
  description?: string;
}

class SimpleShell {
  private steps: ShellStep[] = [];
  private verbose: boolean = true;

  constructor(verbose = true) {
    this.verbose = verbose;
  }

  /**
   * Add a step to the shell script
   */
  addStep(step: ShellStep): this {
    this.steps.push(step);
    return this;
  }

  /**
   * Add multiple steps at once
   */
  addSteps(steps: ShellStep[]): this {
    this.steps.push(...steps);
    return this;
  }

  /**
   * Execute all steps sequentially
   */
  async execute(): Promise<void> {
    this.log('🚀 Starting shell script execution...');
    this.log(`📋 Total steps: ${this.steps.length}`);
    
    for (let i = 0; i < this.steps.length; i++) {
      const step = this.steps[i];
      const stepNumber = i + 1;
      
      this.log(`\n📍 Step ${stepNumber}/${this.steps.length}: ${step.name}`);
      if (step.description) {
        this.log(`   ${step.description}`);
      }
      
      const startTime = Date.now();
      
      try {
        const result = step.useExecFile 
          ? await execFile(step.command, step.args || [])
          : await exec(step.command);
        
        if (result.isErr()) {
          this.log(`❌ Step ${stepNumber} failed: ${result.error.message}`);
          throw new Error(`Shell script failed at step ${stepNumber}: ${step.name}`);
        }
        
        const duration = Date.now() - startTime;
        this.log(`✅ Step ${stepNumber} completed in ${duration}ms`);
        
        // Show output if verbose and there's stdout
        if (this.verbose && result.value.stdout.trim()) {
          this.log(`📤 Output: ${result.value.stdout.trim()}`);
        }
        
        // Show stderr if present (warnings)
        if (result.value.stderr.trim()) {
          this.log(`⚠️  Warnings: ${result.value.stderr.trim()}`);
        }
        
      } catch (error) {
        this.log(`💥 Fatal error in step ${stepNumber}: ${error}`);
        throw error;
      }
    }
    
    this.log('\n🎉 Shell script execution completed successfully!');
  }

  private log(message: string): void {
    console.log(message);
  }
}

/**
 * Example 1: Basic file operations script
 */
async function basicFileOperationsScript() {
  console.log('='.repeat(60));
  console.log('EXAMPLE 1: Basic File Operations Script');
  console.log('='.repeat(60));

  const shell = new SimpleShell();
  
  shell
    .addStep({
      name: 'Create temp directory',
      command: 'mkdir -p /tmp/shell-script-demo',
      description: 'Setting up workspace'
    })
    .addStep({
      name: 'Create sample file',
      command: 'echo "Hello from shell script!" > /tmp/shell-script-demo/sample.txt',
      description: 'Creating a sample text file'
    })
    .addStep({
      name: 'List files',
      command: 'ls -la /tmp/shell-script-demo/',
      description: 'Checking created files'
    })
    .addStep({
      name: 'Read file content',
      command: 'cat /tmp/shell-script-demo/sample.txt',
      description: 'Verifying file content'
    })
    .addStep({
      name: 'Clean up',
      command: 'rm -rf /tmp/shell-script-demo',
      description: 'Removing temporary files'
    });

  try {
    await shell.execute();
  } catch (error) {
    console.error('Script failed:', error);
  }
}

/**
 * Example 2: Development environment check script
 */
async function devEnvironmentCheckScript() {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 2: Development Environment Check Script');
  console.log('='.repeat(60));

  const shell = new SimpleShell();
  
  shell
    .addStep({
      name: 'Check Node.js version',
      command: 'node',
      args: ['--version'],
      useExecFile: true,
      description: 'Verifying Node.js installation'
    })
    .addStep({
      name: 'Check npm version',
      command: 'npm',
      args: ['--version'],
      useExecFile: true,
      description: 'Verifying npm installation'
    })
    .addStep({
      name: 'Check git version',
      command: 'git',
      args: ['--version'],
      useExecFile: true,
      description: 'Verifying git installation'
    })
    .addStep({
      name: 'Check current directory',
      command: 'pwd',
      description: 'Getting current working directory'
    })
    .addStep({
      name: 'List package.json',
      command: 'ls -la package.json',
      description: 'Checking for package.json'
    });

  try {
    await shell.execute();
  } catch (error) {
    console.error('Environment check failed:', error);
  }
}

/**
 * Example 3: Project setup script
 */
async function projectSetupScript() {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 3: Project Setup Script');
  console.log('='.repeat(60));

  const shell = new SimpleShell();
  const projectName = 'demo-project';
  const projectPath = `/tmp/${projectName}`;
  
  shell
    .addStep({
      name: 'Create project directory',
      command: `mkdir -p ${projectPath}`,
      description: `Creating ${projectName} directory`
    })
    .addStep({
      name: 'Initialize npm project',
      command: `cd ${projectPath} && npm init -y`,
      description: 'Creating package.json'
    })
    .addStep({
      name: 'Create src directory',
      command: `mkdir -p ${projectPath}/src`,
      description: 'Setting up source directory'
    })
    .addStep({
      name: 'Create main file',
      command: `echo "console.log('Hello World!');" > ${projectPath}/src/index.js`,
      description: 'Creating main application file'
    })
    .addStep({
      name: 'Create README',
      command: `echo "# ${projectName}\n\nA demo project created with shell automation." > ${projectPath}/README.md`,
      description: 'Creating project documentation'
    })
    .addStep({
      name: 'List project structure',
      command: `find ${projectPath} -type f | head -10`,
      description: 'Showing project structure'
    })
    .addStep({
      name: 'Test the application',
      command: `cd ${projectPath} && node src/index.js`,
      description: 'Running the demo application'
    })
    .addStep({
      name: 'Clean up demo project',
      command: `rm -rf ${projectPath}`,
      description: 'Removing demo project'
    });

  try {
    await shell.execute();
  } catch (error) {
    console.error('Project setup failed:', error);
  }
}

/**
 * Example 4: Conditional execution with error handling
 */
async function conditionalExecutionScript() {
  console.log('\n' + '='.repeat(60));
  console.log('EXAMPLE 4: Conditional Execution with Error Handling');
  console.log('='.repeat(60));

  console.log('🔍 Checking if git is available...');
  
  const gitCheck = await execFile('git', ['--version']);
  
  if (gitCheck.isErr()) {
    console.log('❌ Git is not available, skipping git operations');
    console.log('✅ Continuing with non-git operations...');
    
    // Execute alternative script
    const shell = new SimpleShell();
    shell
      .addStep({
        name: 'Create temp file',
        command: 'echo "No git available" > /tmp/no-git.txt',
        description: 'Creating fallback file'
      })
      .addStep({
        name: 'Show fallback content',
        command: 'cat /tmp/no-git.txt',
        description: 'Displaying fallback message'
      })
      .addStep({
        name: 'Clean up',
        command: 'rm -f /tmp/no-git.txt',
        description: 'Cleaning up'
      });
    
    await shell.execute();
    return;
  }
  
  console.log('✅ Git is available, proceeding with git operations');
  
  const shell = new SimpleShell();
  const repoPath = '/tmp/demo-git-repo';
  
  shell
    .addStep({
      name: 'Create repository directory',
      command: `mkdir -p ${repoPath}`,
      description: 'Setting up git repository'
    })
    .addStep({
      name: 'Initialize git repository',
      command: `cd ${repoPath} && git init`,
      description: 'Initializing git'
    })
    .addStep({
      name: 'Create initial file',
      command: `echo "Initial commit" > ${repoPath}/README.md`,
      description: 'Creating README file'
    })
    .addStep({
      name: 'Add file to git',
      command: `cd ${repoPath} && git add README.md`,
      description: 'Staging file'
    })
    .addStep({
      name: 'Set git user',
      command: `cd ${repoPath} && git config user.email "demo@example.com" && git config user.name "Demo User"`,
      description: 'Configuring git user'
    })
    .addStep({
      name: 'Make initial commit',
      command: `cd ${repoPath} && git commit -m "Initial commit"`,
      description: 'Creating first commit'
    })
    .addStep({
      name: 'Show git log',
      command: `cd ${repoPath} && git log --oneline`,
      description: 'Displaying commit history'
    })
    .addStep({
      name: 'Clean up repository',
      command: `rm -rf ${repoPath}`,
      description: 'Removing demo repository'
    });

  try {
    await shell.execute();
  } catch (error) {
    console.error('Git operations failed:', error);
  }
}

// Main execution
async function main() {
  console.log('🔧 Shell Script Automation Examples');
  console.log('=====================================');
  
  try {
    await basicFileOperationsScript();
    await devEnvironmentCheckScript();
    await projectSetupScript();
    await conditionalExecutionScript();
    
    console.log('\n🎊 All shell script examples completed successfully!');
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

export { SimpleShell, main as runSimpleShellExamples };