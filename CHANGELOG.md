# 1.0.0 (2025-07-25)


### Bug Fixes

* add missing semantic-release plugin dependencies ([22267f4](https://github.com/jvens/neverthrow-child-process/commit/22267f4be7f6dc25816ff6226447d0f8ff909801))
* correct author name in LICENSE and package.json ([113cdba](https://github.com/jvens/neverthrow-child-process/commit/113cdba514efb23bd2a5ca9dd8d225df514d47c8))
* resolve all ESLint errors and configure linting ([65a4e6a](https://github.com/jvens/neverthrow-child-process/commit/65a4e6a6ab04ff624adf6471493ffddf763f81ba))


### Features

* add comprehensive examples and fix advanced patterns ([7cb4de7](https://github.com/jvens/neverthrow-child-process/commit/7cb4de702c86fc97166b5161d5a2ecb8c25fe292))
* add GitHub Actions CI/CD pipeline and semantic-release configuration ([1a5dba3](https://github.com/jvens/neverthrow-child-process/commit/1a5dba39148e6e97ad6d0ed82bcadac4d9005d34))
* initial implementation of neverthrow-child-process library ([90a183e](https://github.com/jvens/neverthrow-child-process/commit/90a183e44dab866f37aaa506d4c69cf07d75e0e1))

# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial implementation of neverthrow-child-process library
- Synchronous functions: execSync, execFileSync, spawnSync
- Asynchronous functions: exec, execFile, spawn, fork, waitForExit
- Structured error types: ProcessNotFoundError, NonZeroExitError, etc.
- Comprehensive test suite with >90% coverage
- TypeScript configuration for ESM + CJS dual module support
- ESLint, Prettier, and Jest configuration
- Detailed documentation and examples
