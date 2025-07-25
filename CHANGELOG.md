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