#!/usr/bin/env node --loader ts-node/esm

/**
 * Git Operations Examples
 * 
 * This example demonstrates real-world Git automation using the
 * neverthrow-child-process library for version control operations.
 * 
 * Key concepts:
 * - Git command automation with error handling
 * - Repository management and validation
 * - Branch operations and merging strategies
 * - Commit message processing and validation
 * - Git hooks and workflow automation
 */

import { exec, execFile } from '../../src/index';
import { err, ok, Result, ResultAsync } from 'neverthrow';
import { ProcessError, NonZeroExitError } from '../../src/index';

function separator(title: string) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`${title}`);
  console.log('='.repeat(60));
}

interface GitRepository {
  path: string;
  remote?: string;
  branch?: string;
}

interface CommitInfo {
  hash: string;
  author: string;
  date: string;
  message: string;
}

interface BranchInfo {
  name: string;
  current: boolean;
  lastCommit: string;
}

class GitManager {
  constructor(private repoPath: string) {}

  /**
   * Initialize a new Git repository
   */
  initRepository(): ResultAsync<string, ProcessError> {
    console.log(`🔄 Initializing Git repository at ${this.repoPath}`);
    
    return exec(`cd "${this.repoPath}" && git init`)
      .map(result => {
        console.log('✅ Repository initialized');
        return result.stdout.trim();
      });
  }

  /**
   * Check if directory is a Git repository
   */
  isGitRepository(): ResultAsync<boolean, ProcessError> {
    return exec(`cd "${this.repoPath}" && git rev-parse --git-dir`)
      .map(() => true)
      .orElse(() => ResultAsync.fromSafePromise(Promise.resolve(false)));
  }

  /**
   * Get repository status
   */
  getStatus(): ResultAsync<{ clean: boolean; files: string[] }, ProcessError> {
    return exec(`cd "${this.repoPath}" && git status --porcelain`)
      .map(result => {
        const files = result.stdout.trim().split('\n').filter(line => line.length > 0);
        return {
          clean: files.length === 0,
          files
        };
      });
  }

  /**
   * Add files to staging area
   */
  addFiles(files: string[] | string = '.'): ResultAsync<string, ProcessError> {
    const fileList = Array.isArray(files) ? files.join(' ') : files;
    
    return exec(`cd "${this.repoPath}" && git add ${fileList}`)
      .map(result => {
        console.log(`✅ Added files: ${fileList}`);
        return result.stdout;
      });
  }

  /**
   * Create a commit with message
   */
  commit(message: string, author?: string): ResultAsync<string, ProcessError> {
    let command = `cd "${this.repoPath}" && git commit -m "${message}"`;
    
    if (author) {
      command = `cd "${this.repoPath}" && git -c user.name="${author}" commit -m "${message}"`;
    }
    
    return exec(command)
      .map(result => {
        console.log(`✅ Committed: ${message}`);
        return result.stdout.trim();
      });
  }

  /**
   * Get commit history
   */
  getCommitHistory(limit = 10): ResultAsync<CommitInfo[], ProcessError> {
    const format = '--pretty=format:%H|%an|%ad|%s';
    
    return exec(`cd "${this.repoPath}" && git log ${format} --date=short -n ${limit}`)
      .map(result => {
        const lines = result.stdout.trim().split('\n').filter(line => line.length > 0);
        
        return lines.map(line => {
          const [hash, author, date, message] = line.split('|');
          return { hash, author, date, message };
        });
      });
  }

  /**
   * Create a new branch
   */
  createBranch(branchName: string, checkout = true): ResultAsync<string, ProcessError> {
    const command = checkout 
      ? `cd "${this.repoPath}" && git checkout -b ${branchName}`
      : `cd "${this.repoPath}" && git branch ${branchName}`;
    
    return exec(command)
      .map(result => {
        console.log(`✅ Branch created: ${branchName}`);
        return result.stdout.trim();
      });
  }

  /**
   * Switch to a branch
   */
  switchBranch(branchName: string): ResultAsync<string, ProcessError> {
    return exec(`cd "${this.repoPath}" && git checkout ${branchName}`)
      .map(result => {
        console.log(`✅ Switched to branch: ${branchName}`);
        return result.stdout.trim();
      });
  }

  /**
   * List branches
   */
  listBranches(): ResultAsync<BranchInfo[], ProcessError> {
    return exec(`cd "${this.repoPath}" && git branch -v`)
      .map(result => {
        const lines = result.stdout.trim().split('\n').filter(line => line.length > 0);
        
        return lines.map(line => {
          const current = line.startsWith('*');
          const cleanLine = line.replace(/^\*?\s*/, '');
          const parts = cleanLine.split(/\s+/);
          
          return {
            name: parts[0],
            current,
            lastCommit: parts[1] || ''
          };
        });
      });
  }

  /**
   * Merge a branch
   */
  mergeBranch(branchName: string, message?: string): ResultAsync<string, ProcessError> {
    let command = `cd "${this.repoPath}" && git merge ${branchName}`;
    
    if (message) {
      command += ` -m "${message}"`;
    }
    
    return exec(command)
      .map(result => {
        console.log(`✅ Merged branch: ${branchName}`);
        return result.stdout.trim();
      });
  }

  /**
   * Delete a branch
   */
  deleteBranch(branchName: string, force = false): ResultAsync<string, ProcessError> {
    const flag = force ? '-D' : '-d';
    
    return exec(`cd "${this.repoPath}" && git branch ${flag} ${branchName}`)
      .map(result => {
        console.log(`✅ Deleted branch: ${branchName}`);
        return result.stdout.trim();
      });
  }

  /**
   * Add remote repository
   */
  addRemote(name: string, url: string): ResultAsync<string, ProcessError> {
    return exec(`cd "${this.repoPath}" && git remote add ${name} ${url}`)
      .map(result => {
        console.log(`✅ Added remote: ${name} -> ${url}`);
        return result.stdout.trim();
      });
  }

  /**
   * Fetch from remote
   */
  fetch(remote = 'origin'): ResultAsync<string, ProcessError> {
    return exec(`cd "${this.repoPath}" && git fetch ${remote}`)
      .map(result => {
        console.log(`✅ Fetched from remote: ${remote}`);
        return result.stdout.trim();
      });
  }

  /**
   * Push to remote
   */
  push(remote = 'origin', branch?: string): ResultAsync<string, ProcessError> {
    let command = `cd "${this.repoPath}" && git push ${remote}`;
    
    if (branch) {
      command += ` ${branch}`;
    }
    
    return exec(command)
      .map(result => {
        console.log(`✅ Pushed to remote: ${remote}`);
        return result.stdout.trim();
      });
  }

  /**
   * Pull from remote
   */
  pull(remote = 'origin', branch?: string): ResultAsync<string, ProcessError> {
    let command = `cd "${this.repoPath}" && git pull ${remote}`;
    
    if (branch) {
      command += ` ${branch}`;
    }
    
    return exec(command)
      .map(result => {
        console.log(`✅ Pulled from remote: ${remote}`);
        return result.stdout.trim();
      });
  }

  /**
   * Get current branch name
   */
  getCurrentBranch(): ResultAsync<string, ProcessError> {
    return exec(`cd "${this.repoPath}" && git branch --show-current`)
      .map(result => result.stdout.trim());
  }

  /**
   * Check for uncommitted changes
   */
  hasUncommittedChanges(): ResultAsync<boolean, ProcessError> {
    return this.getStatus()
      .map(status => !status.clean);
  }

  /**
   * Stash changes
   */
  stash(message?: string): ResultAsync<string, ProcessError> {
    let command = `cd "${this.repoPath}" && git stash`;
    
    if (message) {
      command += ` push -m "${message}"`;
    }
    
    return exec(command)
      .map(result => {
        console.log('✅ Changes stashed');
        return result.stdout.trim();
      });
  }

  /**
   * Apply stashed changes
   */
  stashPop(): ResultAsync<string, ProcessError> {
    return exec(`cd "${this.repoPath}" && git stash pop`)
      .map(result => {
        console.log('✅ Stash applied');
        return result.stdout.trim();
      });
  }
}

/**
 * Example 1: Basic repository operations
 */
async function basicRepositoryOperations() {
  separator('EXAMPLE 1: Basic Repository Operations');
  
  console.log('🔄 Demonstrating basic Git operations...');
  
  const repoPath = '/tmp/git-demo-repo';
  
  // Cleanup and create directory
  await exec(`rm -rf ${repoPath} && mkdir -p ${repoPath}`);
  
  const git = new GitManager(repoPath);
  
  // Initialize repository
  const initResult = await git.initRepository();
  if (initResult.isErr()) {
    console.error('Failed to initialize repository:', initResult.error.message);
    return;
  }
  
  // Configure Git user (required for commits)
  await exec(`cd "${repoPath}" && git config user.name "Demo User"`)
    .andThen(() => exec(`cd "${repoPath}" && git config user.email "demo@example.com"`))
  
    // Create some files
    .andThen(() => exec(`echo "# Demo Repository" > ${repoPath}/README.md`))
    .andThen(() => exec(`echo "console.log('Hello World');" > ${repoPath}/index.js`));
  
  // Check status
  const statusResult = await git.getStatus()
    .map(status => {
      console.log('📊 Repository status:');
      console.log(`   Clean: ${status.clean}`);
      console.log(`   Files: ${status.files.length}`);
      status.files.forEach(file => {
        console.log(`     ${file}`);
      });
      return status;
    })
    .mapErr(error => {
      console.error('❌ Failed to get repository status:', error.message);
      return { clean: false, files: [] };
    });
  
  // Add and commit files
  await git.addFiles()
    .andThen(() => git.commit('Initial commit'))
    .mapErr(error => {
      console.error('❌ Failed to add/commit files:', error.message);
      return;
    });

  // Show commit history
  const historyResult = await git.getCommitHistory(5);
  if (historyResult.isOk()) {
    console.log('\n📜 Commit History:');
    historyResult.value.forEach(commit => {
      console.log(`   ${commit.hash.substring(0, 8)} - ${commit.message} (${commit.date})`);
    });
  }
  
  // Cleanup
  await exec(`rm -rf ${repoPath}`);
}

/**
 * Example 2: Branch management workflow
 */
async function branchManagementWorkflow() {
  separator('EXAMPLE 2: Branch Management Workflow');
  
  console.log('🔄 Demonstrating branch operations...');
  
  const repoPath = '/tmp/git-branch-demo';
  await exec(`rm -rf ${repoPath} && mkdir -p ${repoPath}`);
  
  const git = new GitManager(repoPath);
  
  // Setup repository
  await git.initRepository()
   .andThen(() => exec(`cd "${repoPath}" && git config user.name "Demo User"`))
   .andThen(() => exec(`cd "${repoPath}" && git config user.email "demo@example.com"`))
   .mapErr(error => {
     console.error('❌ Failed to set up repository:', error.message);
     return;
   });

  // Create initial commit
  await exec(`echo "Initial content" > ${repoPath}/file.txt`)
    .andThen(() => git.addFiles())
    .andThen(() => git.commit('Initial commit'))
    // Create feature branch
    .andThen(() => git.createBranch('feature/new-feature'))
    // Make changes in feature branch
    .andThen(() => exec(`echo "Feature content" >> ${repoPath}/file.txt`))
    .andThen(() => exec(`echo "console.log('feature');" > ${repoPath}/feature.js`))
    .andThen(() => git.addFiles())
    .andThen(() => git.commit('Add new feature'))
    .mapErr(error => {
      console.error('❌ Failed to add/commit files:', error.message);
      return;
    });

  // List branches
  const branchesResult = await git.listBranches();
  if (branchesResult.isOk()) {
    console.log('\n🌿 Branches:');
    branchesResult.value.forEach(branch => {
      const indicator = branch.current ? '* ' : '  ';
      console.log(`   ${indicator}${branch.name} (${branch.lastCommit})`);
    });
  }
  
  // Switch back to main and merge
  await git.switchBranch('master')
    .andThen(() => git.mergeBranch('feature/new-feature', 'Merge feature branch'))
    
    // Clean up feature branch
    .andThen(() => git.deleteBranch('feature/new-feature'))
    .mapErr(error => {
      console.error('❌ Failed to delete feature branch:', error.message);
      return;
    });

  // Show final history
  const finalHistoryResult = await git.getCommitHistory();
  if (finalHistoryResult.isOk()) {
    console.log('\n📜 Final History:');
    finalHistoryResult.value.forEach(commit => {
      console.log(`   ${commit.hash.substring(0, 8)} - ${commit.message}`);
    });
  }
  
  await exec(`rm -rf ${repoPath}`);
}

/**
 * Example 3: Git workflow automation
 */
async function gitWorkflowAutomation() {
  separator('EXAMPLE 3: Git Workflow Automation');
  
  console.log('🔄 Demonstrating automated Git workflow...');
  
  const repoPath = '/tmp/git-workflow-demo';
  await exec(`rm -rf ${repoPath} && mkdir -p ${repoPath}`);
  
  const git = new GitManager(repoPath);
  
  // Automated workflow function
  const automatedWorkflow = async (featureName: string, changes: string[]): Promise<Result<void, Error>> => {
    console.log(`\n🤖 Starting automated workflow for: ${featureName}`);
    
    // 1. Check if repository is clean
    const hasChanges = await git.hasUncommittedChanges();
    if (hasChanges.isOk() && hasChanges.value) {
      console.log('   Stashing uncommitted changes...');
      await git.stash(`Auto-stash before ${featureName}`);
    }
    
    // 2. Get current branch
    const currentBranch = await git.getCurrentBranch();
    if (currentBranch.isErr()) {
      return err(new Error('Could not determine current branch'));
    }
    
    // 3. Create feature branch
    const branchName = `feature/${featureName}`;
    await git.createBranch(branchName);
    
    // 4. Apply changes
    for (const change of changes) {
      await exec(`cd "${repoPath}" && ${change}`);
    }
    
    // 5. Commit changes
    await git.addFiles();
    await git.commit(`Implement ${featureName}`);
    
    // 6. Switch back to original branch
    await git.switchBranch(currentBranch.value);
    
    // 7. Merge feature branch
    await git.mergeBranch(branchName, `Merge ${featureName}`);
    
    // 8. Clean up
    await git.deleteBranch(branchName);
    
    // 9. Restore stashed changes if any
    if (hasChanges.isOk() && hasChanges.value) {
      console.log('   Restoring stashed changes...');
      await git.stashPop();
    }
    
    console.log(`   ✅ Workflow completed for: ${featureName}`);
    return ok(undefined)
  };
  
  // Setup repository
  await git.initRepository();
  await exec(`cd "${repoPath}" && git config user.name "Workflow Bot"`);
  await exec(`cd "${repoPath}" && git config user.email "bot@example.com"`);
  
  // Initial setup
  await exec(`echo "# Workflow Demo" > ${repoPath}/README.md`);
  await git.addFiles();
  await git.commit('Initial commit');
  
  // Run multiple automated workflows
  const workflows = [
    {
      name: 'user-authentication',
      changes: [
        'echo "module.exports = { auth: true };" > auth.js',
        'echo "Authentication module" >> README.md'
      ]
    },
    {
      name: 'database-connection',
      changes: [
        'echo "module.exports = { db: \'connected\' };" > db.js',
        'echo "Database module" >> README.md'
      ]
    },
    {
      name: 'api-endpoints',
      changes: [
        'echo "module.exports = { api: \'ready\' };" > api.js',
        'echo "API module" >> README.md'
      ]
    }
  ];
  
  for (const workflow of workflows) {
    (await automatedWorkflow(workflow.name, workflow.changes))
      .mapErr(error => {
        console.error('❌ Failed to delete feature branch:', error.message);
        return;
      });
  }
  
  // Show final repository state
  const finalHistory = await git.getCommitHistory();
  if (finalHistory.isOk()) {
    console.log('\n📜 Automated Workflow History:');
    finalHistory.value.forEach(commit => {
      console.log(`   ${commit.hash.substring(0, 8)} - ${commit.message} (${commit.author})`);
    });
  }
  
  await exec(`rm -rf ${repoPath}`);
}

/**
 * Example 4: Git hook simulation
 */
async function gitHookSimulation() {
  separator('EXAMPLE 4: Git Hook Simulation');
  
  console.log('🔄 Demonstrating Git hooks simulation...');
  
  const repoPath = '/tmp/git-hooks-demo';
  await exec(`rm -rf ${repoPath} && mkdir -p ${repoPath}`);
  
  const git = new GitManager(repoPath);
  
  // Pre-commit hook simulation
  const preCommitCheck = async (files: string[]): Promise<{ valid: boolean; errors: string[] }> => {
    console.log('   🔍 Running pre-commit checks...');
    const errors: string[] = [];
    
    for (const file of files) {
      // Check for TODO comments
      const todoCheck = await exec(`cd "${repoPath}" && grep -n "TODO" ${file} || true`);
      if (todoCheck.isOk() && todoCheck.value.stdout.trim()) {
        errors.push(`${file}: Contains TODO comments`);
      }
      
      // Check for large files
      const sizeCheck = await exec(`cd "${repoPath}" && wc -c < ${file}`);
      if (sizeCheck.isOk()) {
        const size = parseInt(sizeCheck.value.stdout.trim());
        if (size > 1000) {
          errors.push(`${file}: File too large (${size} bytes)`);
        }
      }
      
      // Check for syntax (JavaScript files)
      if (file.endsWith('.js')) {
        const syntaxCheck = await exec(`cd "${repoPath}" && node -c ${file}`);
        if (syntaxCheck.isErr()) {
          errors.push(`${file}: Syntax error`);
        }
      }
    }
    
    return { valid: errors.length === 0, errors };
  };
  
  // Post-commit hook simulation
  const postCommitAction = async (commitHash: string): Promise<void> => {
    console.log('   📤 Running post-commit actions...');
    
    // Simulate notifications
    console.log(`     📧 Sending notification for commit ${commitHash.substring(0, 8)}`);
    
    // Simulate build trigger
    console.log('     🏗️  Triggering automated build');
    
    // Simulate deployment check
    console.log('     🚀 Checking deployment readiness');
  };
  
  // Setup repository
  await git.initRepository();
  await exec(`cd "${repoPath}" && git config user.name "Hook Demo"`);
  await exec(`cd "${repoPath}" && git config user.email "hooks@example.com"`);
  
  // Test scenarios
  const testScenarios = [
    {
      name: 'Valid commit',
      files: {
        'app.js': 'console.log("Hello World");',
        'README.md': '# Clean application'
      }
    },
    {
      name: 'Commit with TODOs',
      files: {
        'todo-app.js': 'console.log("App"); // TODO: Add features',
        'README.md': '# App with TODOs'
      }
    },
    {
      name: 'Large file commit',
      files: {
        'large-file.txt': 'x'.repeat(1500), // Large file
        'README.md': '# App with large file'
      }
    }
  ];
  
  for (const scenario of testScenarios) {
    console.log(`\n🧪 Testing: ${scenario.name}`);
    
    // Create files
    const fileNames = Object.keys(scenario.files);
    for (const [fileName, content] of Object.entries(scenario.files)) {
      await exec(`echo "${content}" > ${repoPath}/${fileName}`);
    }
    
    // Run pre-commit checks
    const checkResult = await preCommitCheck(fileNames);
    
    if (checkResult.valid) {
      console.log('   ✅ Pre-commit checks passed');
      
      // Proceed with commit
      await git.addFiles();
      const commitResult = await git.commit(`Test: ${scenario.name}`);
      
      if (commitResult.isOk()) {
        // Get commit hash
        const historyResult = await git.getCommitHistory(1);
        if (historyResult.isOk() && historyResult.value.length > 0) {
          await postCommitAction(historyResult.value[0].hash);
        }
      }
    } else {
      console.log('   ❌ Pre-commit checks failed:');
      checkResult.errors.forEach(error => {
        console.log(`     - ${error}`);
      });
      console.log('   🚫 Commit blocked');
    }
  }
  
  await exec(`rm -rf ${repoPath}`);
}

/**
 * Example 5: Repository backup and restore
 */
async function repositoryBackupRestore() {
  separator('EXAMPLE 5: Repository Backup and Restore');
  
  console.log('🔄 Demonstrating repository backup and restore...');
  
  const originalRepo = '/tmp/git-original';
  const backupPath = '/tmp/git-backup.tar.gz';
  const restoreRepo = '/tmp/git-restored';
  
  // Cleanup
  await exec(`rm -rf ${originalRepo} ${restoreRepo} ${backupPath}`);
  await exec(`mkdir -p ${originalRepo}`);
  
  const git = new GitManager(originalRepo);
  
  // Create original repository with history
  await git.initRepository();
  await exec(`cd "${originalRepo}" && git config user.name "Backup Demo"`);
  await exec(`cd "${originalRepo}" && git config user.email "backup@example.com"`);
  
  // Create multiple commits
  const commits = [
    { file: 'first.txt', content: 'First file', message: 'Add first file' },
    { file: 'second.txt', content: 'Second file', message: 'Add second file' },
    { file: 'third.txt', content: 'Third file', message: 'Add third file' }
  ];
  
  for (const commit of commits) {
    await exec(`echo "${commit.content}" > ${originalRepo}/${commit.file}`);
    await git.addFiles();
    await git.commit(commit.message);
  }
  
  // Show original repository state
  console.log('\n📊 Original Repository:');
  const originalHistory = await git.getCommitHistory();
  if (originalHistory.isOk()) {
    originalHistory.value.forEach(commit => {
      console.log(`   ${commit.hash.substring(0, 8)} - ${commit.message}`);
    });
  }
  
  // Create backup
  console.log('\n💾 Creating backup...');
  const backupResult = await exec(`cd /tmp && tar -czf git-backup.tar.gz git-original`);
  if (backupResult.isOk()) {
    console.log('✅ Backup created successfully');
    
    // Verify backup size
    const sizeResult = await exec(`ls -lh ${backupPath}`);
    if (sizeResult.isOk()) {
      console.log(`   Backup size: ${sizeResult.value.stdout.trim()}`);
    }
  }
  
  // Simulate repository corruption/loss
  console.log('\n💥 Simulating repository loss...');
  await exec(`rm -rf ${originalRepo}`);
  
  // Restore from backup
  console.log('\n🔄 Restoring from backup...');
  const restoreResult = await exec(`cd /tmp && tar -xzf git-backup.tar.gz && mv git-original git-restored`);
  if (restoreResult.isOk()) {
    console.log('✅ Repository restored successfully');
    
    // Verify restored repository
    const restoredGit = new GitManager(restoreRepo);
    const restoredHistory = await restoredGit.getCommitHistory();
    
    if (restoredHistory.isOk()) {
      console.log('\n📊 Restored Repository:');
      restoredHistory.value.forEach(commit => {
        console.log(`   ${commit.hash.substring(0, 8)} - ${commit.message}`);
      });
      
      // Compare with original
      const originalCount = originalHistory.isOk() ? originalHistory.value.length : 0;
      const restoredCount = restoredHistory.value.length;
      
      if (originalCount === restoredCount) {
        console.log('✅ Repository fully restored - all commits preserved');
      } else {
        console.log(`⚠️  Restore incomplete: ${restoredCount}/${originalCount} commits`);
      }
    }
  }
  
  // Cleanup
  await exec(`rm -rf ${originalRepo} ${restoreRepo} ${backupPath}`);
}

// Main execution
async function main() {
  console.log('🔧 Git Operations Examples');
  console.log('===========================');
  
  try {
    await basicRepositoryOperations();
    await branchManagementWorkflow();
    await gitWorkflowAutomation();
    await gitHookSimulation();
    await repositoryBackupRestore();
    
    console.log('\n🎊 All Git operations examples completed successfully!');
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

export { GitManager, main as runGitOperationsExamples };