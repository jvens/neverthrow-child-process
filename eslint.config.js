import js from '@eslint/js';
import typescriptEslint from 'typescript-eslint';
import jest from 'eslint-plugin-jest';
import prettier from 'eslint-plugin-prettier/recommended';

export default typescriptEslint.config(
  js.configs.recommended,
  ...typescriptEslint.configs.recommendedTypeChecked,
  prettier,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.js', '**/*.cjs'],
    ...typescriptEslint.configs.disableTypeChecked,
  },
  {
    files: ['**/*.test.ts', '**/*.spec.ts'],
    plugins: {
      jest,
    },
    languageOptions: {
      globals: jest.environments.globals.globals,
    },
    rules: {
      ...jest.configs.recommended.rules,
      // Allow conditional expects in Result-based tests
      'jest/no-conditional-expect': 'off',
    },
  },
  {
    ignores: [
      'dist/',
      'coverage/',
      'node_modules/',
      'examples/',
      '*.config.js',
      '*.config.cjs',
      '*.config.ts',
      'jest.setup.js',
      'run-example.js',
    ],
  },
);