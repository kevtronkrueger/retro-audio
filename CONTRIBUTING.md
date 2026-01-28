# Contributing to Retro Audio

Thank you for your interest in contributing to Retro Audio! This document provides guidelines and information for contributors.

## Development Setup

### Prerequisites

- Node.js 18.x or later
- npm 9.x or later

### Getting Started

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/YOUR_USERNAME/retro-audio.git
   cd retro-audio
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Run tests to verify setup:
   ```bash
   npm test
   ```

### Available Scripts

| Script | Description |
|--------|-------------|
| `npm run build` | Build all output formats |
| `npm run dev` | Build with watch mode |
| `npm test` | Run tests in watch mode |
| `npm run test:run` | Run tests once |
| `npm run test:coverage` | Run tests with coverage |
| `npm run typecheck` | Run TypeScript type checking |
| `npm run lint` | Run ESLint |

## Project Structure

```
src/
├── index.ts              # Public API exports
├── RetroAudio.ts         # Main orchestrator class
├── Synth.ts              # Real-time synth control
├── core/                 # Core audio components
│   ├── AudioEngine.ts    # Web Audio context management
│   ├── Channel.ts        # Channel interface
│   ├── PulseChannel.ts   # Pulse wave implementation
│   ├── WaveChannel.ts    # Wave channel implementation
│   ├── NoiseChannel.ts   # Noise channel implementation
│   ├── Voice.ts          # Voice instance
│   └── VoicePool.ts      # Voice allocation
├── synthesis/            # Synthesis modules
│   ├── Envelope.ts       # ADSR envelope
│   ├── PitchSlide.ts     # Pitch effects
│   ├── Vibrato.ts        # LFO modulation
│   └── Arpeggiator.ts    # Note sequencing
├── playback/             # Playback system
│   ├── Clock.ts          # BPM timing
│   ├── Scheduler.ts      # Web Audio scheduling
│   └── Sequencer.ts      # Pattern playback
├── loader/               # Data loading
│   ├── SoundLoader.ts    # JSON parsing
│   ├── InstrumentBank.ts # Instrument storage
│   └── Validator.ts      # Schema validation
├── types/                # TypeScript types
└── utils/                # Utility functions
```

## Coding Standards

### TypeScript

- Use TypeScript strict mode
- Provide explicit types for function parameters and return values
- Use interfaces for object shapes
- Avoid `any` type; use `unknown` when type is truly unknown

### Code Style

- Use 2 spaces for indentation
- Use single quotes for strings
- Add trailing commas in multiline arrays/objects
- Use meaningful variable names
- Add JSDoc comments for public APIs

### Example

```typescript
/**
 * Calculate the frequency for a given note
 * @param note - Note name like "C4" or "A#5"
 * @returns Frequency in Hz
 * @throws Error if note format is invalid
 */
export function noteToFrequency(note: string): number {
  // Implementation
}
```

## Testing

### Writing Tests

- Place tests in the `tests/` directory
- Name test files with `.test.ts` suffix
- Use descriptive test names
- Test edge cases and error conditions

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- noteToFrequency

# Run with coverage
npm run test:coverage
```

### Mocking Web Audio API

Use the provided mocks in `tests/mocks/WebAudioMock.ts`:

```typescript
import { installWebAudioMocks, uninstallWebAudioMocks } from './mocks/WebAudioMock';

beforeEach(() => {
  installWebAudioMocks();
});

afterEach(() => {
  uninstallWebAudioMocks();
});
```

## Pull Request Process

1. **Create a branch** for your feature/fix:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes** following the coding standards

3. **Add tests** for new functionality

4. **Run checks** before committing:
   ```bash
   npm run typecheck
   npm run test:run
   npm run build
   ```

5. **Commit** with a clear message:
   ```bash
   git commit -m "Add feature: description of changes"
   ```

6. **Push** and create a pull request

7. **Describe your changes** in the PR:
   - What does this PR do?
   - How was it tested?
   - Any breaking changes?

## Commit Message Format

Use clear, descriptive commit messages:

```
<type>: <description>

[optional body]
```

Types:
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `test`: Adding/updating tests
- `refactor`: Code refactoring
- `perf`: Performance improvement
- `chore`: Maintenance tasks

Examples:
```
feat: Add pitch slide effect to Synth class
fix: Correct envelope release timing calculation
docs: Update README with pattern playback example
test: Add integration tests for VoicePool
```

## Reporting Issues

When reporting issues, please include:

1. **Description** of the problem
2. **Steps to reproduce**
3. **Expected behavior**
4. **Actual behavior**
5. **Environment** (browser, OS, Node version)
6. **Code sample** if applicable

## Feature Requests

Feature requests are welcome! Please:

1. Check existing issues first
2. Describe the use case
3. Explain why it would be useful
4. Consider implementation complexity

## Questions?

- Open a GitHub issue for questions
- Tag with `question` label

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
