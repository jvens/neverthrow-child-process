# Basic Usage Examples

These examples demonstrate the fundamental operations of the `@jvens/neverthrow-child-process` package.

## Files

- **`sync-commands.ts`** - Synchronous command execution (execSync, execFileSync, spawnSync)
- **`async-commands.ts`** - Asynchronous command execution (exec, execFile, spawn)

## Key Concepts

### Synchronous Operations
Synchronous operations block until the command completes and return a `Result<T, ProcessError>`.

### Asynchronous Operations
Asynchronous operations return immediately with a `ResultAsync<T, ProcessError>` that resolves when the command completes.

### Error Handling
All operations use neverthrow's Result types for type-safe error handling without exceptions.

## Running Examples

```bash
# Recommended: Using tsx (fastest and most reliable)
npx tsx examples/1-basic-usage/sync-commands.ts
npx tsx examples/1-basic-usage/async-commands.ts

# Alternative: Using ts-node with ESM support
npx ts-node --esm examples/1-basic-usage/sync-commands.ts
npx ts-node --esm examples/1-basic-usage/async-commands.ts

# Or compile and run with Node.js
npm run build
node dist/esm/examples/1-basic-usage/sync-commands.js
```

## What You'll Learn

- How to execute simple commands with type safety
- Difference between exec/execFile and their sync counterparts
- Basic error handling patterns
- Working with command output and exit codes
- Setting encoding and other basic options