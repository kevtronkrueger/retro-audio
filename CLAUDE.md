# Retro Audio Engine

Lightweight Web Audio synthesizer emulating 8-bit Game Boy DMG sound hardware. Consumes JSON sound definitions for playback in web apps.

## Commands

```bash
npm run dev          # Watch mode with rollup
npm run build        # Production build
npm test             # Run tests (vitest watch)
npm run test:run     # Run tests once
npm run typecheck    # TypeScript check
npm run lint         # ESLint
```

## Architecture

```
src/
├── core/           # Channel implementations (Pulse, Wave, Noise, Mixer)
├── synthesis/      # Sound generation (Envelope, Arpeggiator, effects)
├── playback/       # Timing (Clock, Sequencer)
├── loader/         # JSON validation (InstrumentBank, Validator)
├── types/          # TypeScript interfaces
├── utils/          # Helpers (noteToFrequency, clamp, constants)
├── RetroAudio.ts   # Main public API
├── Synth.ts        # Real-time synth control
├── SongPlayer.ts   # Pattern/song playback
├── SoundInstance.ts # Individual sound handle
└── PatternPlayer.ts # Pattern sequencing
```

## Key Files

- @README.md - Full API documentation
- @retro-audio-engine-spec.md - Original design specification
- @docs/BUG-REPORT.md - Known issues being investigated

## Conventions

### Naming
- Classes: PascalCase (`PulseChannel.ts`)
- Utilities: camelCase (`noteToFrequency.ts`)
- Constants: SCREAMING_SNAKE_CASE

### Patterns
- ES modules (import/export), not CommonJS
- TypeScript strict mode
- Colocate tests in `tests/` mirroring `src/` structure
- Web Audio API nodes created lazily on init()

## Domain Terms

- **Channel** - Hardware-emulated audio generator (pulse1, pulse2, wave, noise)
- **Instrument** - JSON definition of sound parameters (waveform, envelope, pitch effects)
- **SfxData** - Complete sound effect (instrument + note + duration)
- **Duty Cycle** - Pulse wave width ratio (0.125, 0.25, 0.5, 0.75)
- **ADSR** - Attack/Decay/Sustain/Release envelope
- **Voice** - Active playing instance of an instrument

## Notes

- Browser requires user gesture before AudioContext can start
- All timing is sample-accurate via Web Audio scheduling
- Tests use WebAudioMock in `tests/mocks/`
