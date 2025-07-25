#!/usr/bin/env node

/**
 * Helper script to run TypeScript examples
 * This compiles and runs TypeScript examples on the fly
 */

import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join, relative } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function runExample(examplePath) {
  try {
    console.log(`🔄 Compiling and running ${examplePath}...`);

    // Compile the TypeScript file to JavaScript
    const jsPath = examplePath.replace('.ts', '.js');
    execSync(
      `npx tsc "${examplePath}" --outDir examples --module esnext --target es2020 --moduleResolution node --allowSyntheticDefaultImports --esModuleInterop`,
      {
        cwd: __dirname,
        stdio: 'inherit',
      },
    );

    // Run the compiled JavaScript
    const relativePath = relative(__dirname, jsPath);
    execSync(`node "${relativePath}"`, {
      cwd: __dirname,
      stdio: 'inherit',
    });

    console.log(`✅ Example completed successfully!`);
  } catch (error) {
    console.error(`❌ Error running example:`, error.message);
    process.exit(1);
  }
}

// Get example path from command line
const examplePath = process.argv[2];

if (!examplePath) {
  console.log('Usage: node run-example.js <path-to-example.ts>');
  console.log('');
  console.log('Examples:');
  console.log('  node run-example.js examples/1-basic-usage/sync-commands.ts');
  console.log('  node run-example.js examples/1-basic-usage/async-commands.ts');
  console.log('  node run-example.js examples/2-shell-script/simple-shell.ts');
  process.exit(1);
}

runExample(examplePath);
