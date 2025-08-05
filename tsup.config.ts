import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  // Preserve JSDoc comments
  treeshake: false,
  // External dependencies
  external: ['child_process', 'neverthrow'],
  // Output configuration
  outDir: 'dist',
  // Ensure proper extensions
  outExtension({ format }) {
    return {
      js: format === 'esm' ? '.es.js' : '.cjs.js',
    };
  },
});
