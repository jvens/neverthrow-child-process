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
    },
  },
  {
    ignores: [
      'dist/',
      'coverage/',
      'node_modules/',
      '*.config.js',
      '*.config.cjs',
      'jest.setup.js',
    ],
  },
);