# Retro Audio Engine - Development Specification

## Overview

**Package Name:** `retro-audio`  
**Version:** 1.0.0  
**Purpose:** A lightweight, embeddable Web Audio synthesizer engine that emulates 8-bit sound hardware (Game Boy DMG style). Consumes JSON sound definitions and plays them in any web application.

**Key Characteristics:**
- Zero UI dependencies
- ~15-25KB minified + gzipped target
- Web Audio API only (no fallbacks)
- TypeScript source with full type definitions
- ES Modules and CommonJS builds
- No external runtime dependencies

---

## Architecture

```
retro-audio/
├── src/
│   ├── index.ts                 # Public API exports
│   ├── RetroAudio.ts            # Main class - orchestrates everything
│   ├── core/
│   │   ├── AudioEngine.ts       # Web Audio context management
│   │   ├── Channel.ts           # Base channel interface
│   │   ├── PulseChannel.ts      # Pulse wave (square with duty cycle)
│   │   ├── WaveChannel.ts       # Custom wavetable channel
│   │   ├── NoiseChannel.ts      # LFSR noise generator
│   │   ├── Mixer.ts             # Channel mixing and master output
│   │   ├── VoicePool.ts         # Voice allocation and stealing
│   │   └── Voice.ts             # Single voice instance
│   ├── synthesis/
│   │   ├── Oscillator.ts        # Oscillator wrapper with waveform generation
│   │   ├── Envelope.ts          # ADSR envelope generator
│   │   ├── PitchSlide.ts        # Pitch bend/slide effects
│   │   ├── Vibrato.ts           # LFO-based pitch modulation
│   │   ├── Arpeggiator.ts       # Rapid note cycling
│   │   └── NoiseGenerator.ts    # LFSR implementation for noise
│   ├── playback/
│   │   ├── Sequencer.ts         # Pattern/song playback engine
│   │   ├── Scheduler.ts         # Precise Web Audio scheduling
│   │   └── Clock.ts             # BPM-based timing
│   ├── loader/
│   │   ├── SoundLoader.ts       # JSON parsing and validation
│   │   ├── InstrumentBank.ts    # Instrument reference management
│   │   └── Validator.ts         # Schema validation
│   ├── types/
│   │   ├── index.ts             # All TypeScript interfaces
│   │   ├── Instrument.ts        # Instrument type definitions
│   │   ├── Pattern.ts           # Pattern type definitions
│   │   └── Song.ts              # Song type definitions
│   └── utils/
│       ├── noteToFrequency.ts   # Note name to Hz conversion
│       ├── constants.ts         # Shared constants
│       └── clamp.ts             # Utility functions
├── dist/                        # Built output
│   ├── index.js                 # ES Module build
│   ├── index.cjs                # CommonJS build
│   ├── index.d.ts               # TypeScript declarations
│   └── index.min.js             # Minified UMD for <script> tag
├── package.json
├── tsconfig.json
├── rollup.config.js             # Or vite.config.js for bundling
└── README.md
```

---

## Voice Management

The engine uses a simple voice pooling system optimized for usability over strict hardware emulation.

### Configuration

```typescript
interface VoiceConfig {
  maxVoices: number;              // Default: 8. Total concurrent sounds
  stealingMode: 'oldest' | 'quietest' | 'none';  // Default: 'oldest'
}
```

### Behavior

- **Max Voices**: The engine supports up to 8 concurrent voices by default. This is a global limit shared across all sound sources.
- **Channel vs Voice**: Channels (pulse1, pulse2, wave, noise) are *timbral categories*, not hardware slots. Pattern playback uses one voice per channel type (4 max). SFX playback draws from the remaining voice pool, allowing layered sound effects over music.
- **Voice Stealing**: When the limit is reached and a new note is triggered:
  - `'oldest'`: The voice that started earliest is stopped and reused (recommended)
  - `'quietest'`: The voice with the lowest current amplitude is stopped
  - `'none'`: New note is ignored if no voices available
- **Automatic Cleanup**: Voices are automatically returned to the pool when their envelope completes (after release phase)

### Implementation

```typescript
// VoicePool.ts
export class VoicePool {
  private voices: Voice[] = [];
  private maxVoices: number;
  private stealingMode: 'oldest' | 'quietest' | 'none';

  constructor(config: Partial<VoiceConfig> = {}) {
    this.maxVoices = config.maxVoices ?? 8;
    this.stealingMode = config.stealingMode ?? 'oldest';
  }

  acquire(): Voice | null {
    // First, try to find an inactive voice
    const inactive = this.voices.find(v => !v.isActive);
    if (inactive) {
      return inactive;
    }

    // If under limit, create new voice
    if (this.voices.length < this.maxVoices) {
      const voice = new Voice();
      this.voices.push(voice);
      return voice;
    }

    // Voice stealing
    if (this.stealingMode === 'none') {
      return null;
    }

    const victim = this.stealingMode === 'oldest'
      ? this.voices.reduce((a, b) => a.startTime < b.startTime ? a : b)
      : this.voices.reduce((a, b) => a.currentAmplitude < b.currentAmplitude ? a : b);

    victim.stop();
    return victim;
  }

  releaseAll(): void {
    this.voices.forEach(v => v.stop());
  }
}
```

### Voice Class

```typescript
// Voice.ts
export class Voice {
  private context: AudioContext;
  private channel: PulseChannel | WaveChannel | NoiseChannel | null = null;
  private envelope: Envelope | null = null;
  private _isActive: boolean = false;
  private _startTime: number = 0;
  private gainNode: GainNode;

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.gainNode = context.createGain();
    this.gainNode.connect(destination);
  }

  /** Whether this voice is currently playing a note */
  get isActive(): boolean {
    return this._isActive;
  }

  /** When this voice started playing (AudioContext time) */
  get startTime(): number {
    return this._startTime;
  }

  /** Current amplitude for voice stealing comparison */
  get currentAmplitude(): number {
    return this.gainNode.gain.value;
  }

  /** Configure this voice for an instrument */
  configure(instrument: InstrumentData): void {
    switch (instrument.channel) {
      case 'pulse1':
      case 'pulse2':
        this.channel = new PulseChannel(this.context, this.gainNode);
        break;
      case 'wave':
        this.channel = new WaveChannel(this.context, this.gainNode);
        break;
      case 'noise':
        this.channel = new NoiseChannel(this.context, this.gainNode);
        break;
    }
    this.envelope = new Envelope(this.context, instrument.envelope);
  }

  noteOn(frequency: number, velocity: number, time: number): void {
    this._isActive = true;
    this._startTime = time;
    this.channel?.noteOn(frequency, time);
    this.envelope?.triggerAttack(this.gainNode.gain, time, velocity);
  }

  noteOff(time?: number): void {
    const releaseTime = time ?? this.context.currentTime;
    if (this.envelope) {
      const endTime = this.envelope.triggerRelease(this.gainNode.gain, releaseTime);
      setTimeout(() => {
        this._isActive = false;
        this.channel?.noteOff(endTime);
      }, (endTime - this.context.currentTime) * 1000);
    }
  }

  stop(): void {
    this._isActive = false;
    this.channel?.noteOff(this.context.currentTime);
    this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
  }

  /** Access to underlying channel for pitch effects */
  getChannel(): PulseChannel | WaveChannel | NoiseChannel | null {
    return this.channel;
  }
}
```

### Channel Interface

All channel types implement this interface, exposing oscillator/frequency for pitch effects:

```typescript
// Channel.ts
export interface Channel {
  noteOn(frequency: number, time: number): void;
  noteOff(time: number): void;
  readonly gain: AudioParam;

  // For pitch effects - only available on oscillator-based channels
  readonly oscillator: OscillatorNode | null;
  readonly frequencyParam: AudioParam | null;
}
```

---

## JSON Schema Definitions

### Instrument Definition (`InstrumentData`)

```typescript
interface InstrumentData {
  id: string;                     // Unique identifier for referencing
  name: string;                   // Human-readable name
  channel: ChannelType;           // Which channel type this uses
  waveform: WaveformConfig;
  envelope: EnvelopeConfig;
  pitch?: PitchConfig;            // Optional pitch effects
  effects?: EffectsConfig;        // Optional effects
  volume: number;                 // 0.0 - 1.0
}

type ChannelType = 'pulse1' | 'pulse2' | 'wave' | 'noise';

// Channel-specific waveform configurations (discriminated unions)
// Validation: pulse1/pulse2 channels require PulseWaveformConfig,
//             wave channel requires WaveWaveformConfig,
//             noise channel requires NoiseWaveformConfig
type WaveformConfig = PulseWaveformConfig | WaveWaveformConfig | NoiseWaveformConfig;

interface PulseWaveformConfig {
  type: 'pulse';
  duty?: 0.125 | 0.25 | 0.5 | 0.75;  // Default: 0.5 (square wave)
}

interface WaveWaveformConfig {
  type: 'triangle' | 'sawtooth' | 'custom';
  wavetable?: number[];             // 32 samples, values 0-15 (required if type is 'custom')
}

interface NoiseWaveformConfig {
  type: 'noise';
  mode?: 'long' | 'short';          // Default: 'long'. Short = metallic/tonal
}

// Note: For noise channels, the note parameter controls the LFSR clock rate.
// Higher notes produce higher-pitched noise. The frequency mapping is approximate
// and intended for musical convenience, not precise pitch.

interface EnvelopeConfig {
  attack: number;                 // Seconds (0.0 - 5.0)
  decay: number;                  // Seconds (0.0 - 5.0)
  sustain: number;                // Level 0.0 - 1.0
  release: number;                // Seconds (0.0 - 5.0)
  attackCurve?: CurveType;        // Default: 'linear'
  decayCurve?: CurveType;         // Default: 'exponential'
  releaseCurve?: CurveType;       // Default: 'exponential'
}

type CurveType = 'linear' | 'exponential';

interface PitchConfig {
  slide?: number;                 // Semitones to slide (negative = down)
  slideTime?: number;             // Seconds for slide
  vibratoDepth?: number;          // Semitones (0 - 2)
  vibratoSpeed?: number;          // Hz (0 - 20)
  arpeggio?: number[];            // Semitone offsets, e.g., [0, 4, 7]
  arpeggioSpeed?: number;         // Notes per second
}

interface EffectsConfig {
  /**
   * Bit depth reduction (1-16). 0 or undefined = off.
   * v1.0: ScriptProcessorNode implementation
   * v1.1: AudioWorklet implementation
   */
  bitcrush?: number;
  // Future: reverb, delay, etc.
}
```

### Pattern Definition (`PatternData`)

```typescript
interface PatternData {
  id: string;                     // Unique identifier
  name: string;                   // Human-readable name
  steps: number;                  // Total steps in pattern (16, 32, 64)
  stepsPerBeat: number;           // Usually 4 (16th notes)
  channels: ChannelPattern;
  // Note: BPM is controlled at the Song level or via playPattern() options
}

interface ChannelPattern {
  pulse1: NoteEvent[];
  pulse2: NoteEvent[];
  wave: NoteEvent[];
  noise: NoteEvent[];
}

interface NoteEvent {
  step: number;                   // 0 to (steps - 1)
  note: string | null;            // "C4", "D#5", or null for explicit note-off
  instrumentId: string;           // Reference to instrument
  duration?: number;              // Duration in steps (default: until next note or pattern end)
  volume?: number;                // Override instrument volume (0.0 - 1.0)
  effects?: NoteEffects;          // Per-note effects
}

// Duration behavior:
// - If duration is set: note releases after that many steps
// - If duration is omitted: note plays until next note on same channel or pattern loops
// - If note is null: triggers immediate note-off (cuts previous note)

interface NoteEffects {
  slideToNote?: string;           // Slide to this note
  vibrato?: boolean;              // Enable vibrato for this note
  arpeggio?: number[];            // Override arpeggio
}
```

### Song Definition (`SongData`)

```typescript
interface SongData {
  version: '1.0';
  type: 'song';
  name: string;
  author?: string;
  bpm: number;                    // Master BPM
  instruments: InstrumentData[];  // All instruments used
  patterns: PatternData[];        // All patterns
  sequence: string[];             // Pattern IDs in play order
  loop?: boolean;                 // Loop the sequence
  loopPoint?: number;             // Index in sequence to loop back to
}
```

### Sound Effect Definition (`SfxData`)

A simpler format for one-shot sound effects:

```typescript
interface SfxData {
  version: '1.0';
  type: 'sfx';
  name: string;
  instrument: InstrumentData;     // Single instrument (embedded, not referenced)
  note?: string;                  // Default note to play, e.g., "C4"

  /**
   * Auto note-off after this many seconds.
   *
   * Behavior:
   * - If set: Note-off triggers after this duration, starting release phase.
   * - If omitted: Note plays through the full ADSR envelope naturally.
   *   - For sustain > 0: Sound holds at sustain level indefinitely until stopped.
   *   - For sustain = 0: Sound decays to silence automatically.
   *
   * Recommendation: Always set duration for SFX with sustain > 0,
   * or design SFX envelopes with sustain = 0 for self-terminating sounds.
   */
  duration?: number;
}
```

### Project File (`ProjectData`)

Container format for the composition tool:

```typescript
/**
 * IMPORTANT: ProjectData is NOT directly playable by RetroAudio.
 * It serves as a save/load format for the composition tool that
 * bundles multiple songs, instruments, and patterns together.
 *
 * To play content from a ProjectData:
 *
 *   const project: ProjectData = await loadProject('myproject.json');
 *   audio.loadInstruments(project.instruments);
 *   const player = audio.playSong(project.songs[0]);
 *
 * The engine does NOT provide project file loading/saving or
 * project management - that's the composition tool's responsibility.
 */
interface ProjectData {
  version: '1.0';
  type: 'project';
  name: string;
  author?: string;
  createdAt: string;              // ISO 8601 timestamp
  modifiedAt: string;             // ISO 8601 timestamp
  instruments: InstrumentData[];  // Shared instrument library
  patterns: PatternData[];        // All patterns (may be shared across songs)
  songs: SongData[];              // Multiple songs referencing above
}
```

---

## Public API

### `RetroAudio` Class

The main entry point for consuming applications.

```typescript
class RetroAudio {
  /**
   * Create a new RetroAudio instance.
   * Does NOT start AudioContext - call init() after user gesture.
   */
  constructor(options?: RetroAudioOptions);

  /**
   * Initialize the audio context. MUST be called from a user gesture
   * (click, keypress, etc.) due to browser autoplay policies.
   * @returns Promise that resolves when audio is ready
   */
  init(): Promise<void>;

  /**
   * Current state of the audio engine
   * - 'uninitialized': init() has not been called
   * - 'running': Audio is active and playing
   * - 'suspended': Audio is paused (user-initiated, browser policy, or system interruption)
   */
  readonly state: 'uninitialized' | 'running' | 'suspended';

  /**
   * Callback fired when audio context state changes
   * Useful for handling interruptions on mobile
   */
  onStateChange: ((state: RetroAudio['state']) => void) | null;

  /**
   * Suspend audio processing (save CPU when not in use)
   */
  suspend(): Promise<void>;

  /**
   * Resume audio processing
   */
  resume(): Promise<void>;

  /**
   * Master volume control
   */
  masterVolume: number;  // 0.0 - 1.0

  // --- Instrument Bank ---

  /**
   * Load instruments into the bank for pattern/song playback
   */
  loadInstruments(instruments: InstrumentData[]): void;

  /**
   * Get an instrument by ID
   */
  getInstrument(id: string): InstrumentData | undefined;

  /**
   * Clear all loaded instruments
   */
  clearInstruments(): void;

  // --- One-Shot Sound Effects ---

  /**
   * Play a sound effect (one-shot, fire and forget)
   * @returns SoundInstance for optional early termination
   */
  playSfx(sfx: SfxData): SoundInstance;
  playSfx(instrument: InstrumentData, note: string): SoundInstance;

  // --- Real-Time Synth (for composition tool) ---

  /**
   * Create a real-time synth voice for live playing.
   * Internally acquires a Voice from the VoicePool, configures it
   * for the instrument, and wraps it in a Synth for user control.
   *
   * @param instrument - Instrument configuration
   * @returns Synth instance for note control
   * @throws VoiceLimitReachedError if pool exhausted and stealing disabled
   */
  createSynth(instrument: InstrumentData): Synth;

  // --- Pattern Playback ---

  /**
   * Load and play a pattern
   * @param pattern - Pattern data
   * @param options - Playback options
   * @returns PatternPlayer for control
   */
  playPattern(pattern: PatternData, options?: PlaybackOptions): PatternPlayer;

  // --- Song Playback ---

  /**
   * Load and play a song
   * @param song - Song data (includes instruments and patterns)
   * @returns SongPlayer for control
   */
  playSong(song: SongData): SongPlayer;

  /**
   * Stop all currently playing sounds
   */
  stopAll(): void;

  /**
   * Clean up and release audio resources
   */
  dispose(): void;
}

interface RetroAudioOptions {
  sampleRate?: number;            // Default: 44100
  latencyHint?: 'interactive' | 'balanced' | 'playback';
  maxVoices?: number;             // Default: 8
  voiceStealingMode?: 'oldest' | 'quietest' | 'none';  // Default: 'oldest'
}

interface PlaybackOptions {
  bpm?: number;                   // Required for pattern playback, defaults to 120
  loop?: boolean;
  startStep?: number;
}
```

### `Synth` Class

For real-time instrument control (used by composition tool).

```typescript
class Synth {
  /**
   * Trigger a note on
   * @param note - Note name ("C4") or frequency in Hz
   * @param velocity - Optional velocity 0.0-1.0, default 1.0
   * @param time - Optional scheduled time, default now
   */
  noteOn(note: string | number, velocity?: number, time?: number): void;

  /**
   * Release the current note
   * @param time - Optional scheduled time, default now
   */
  noteOff(time?: number): void;

  /**
   * Update instrument parameters in real-time
   * Changes take effect on next noteOn
   */
  updateInstrument(updates: Partial<InstrumentData>): void;

  /**
   * Update just the envelope
   */
  updateEnvelope(updates: Partial<EnvelopeConfig>): void;

  /**
   * Replace the waveform configuration
   * Changes take effect on next noteOn()
   */
  setWaveform(config: WaveformConfig): void;

  /**
   * Current instrument state
   */
  readonly instrument: InstrumentData;

  /**
   * Is a note currently playing?
   */
  readonly isPlaying: boolean;

  /**
   * Disconnect and clean up
   */
  dispose(): void;
}
```

### `SoundInstance` Class

Handle for a playing one-shot sound.

```typescript
class SoundInstance {
  /**
   * Stop this sound immediately
   */
  stop(): void;

  /**
   * Fade out over duration
   */
  fadeOut(duration: number): void;

  /**
   * Is this sound still playing?
   */
  readonly isPlaying: boolean;

  /**
   * Promise that resolves when sound finishes
   */
  readonly finished: Promise<void>;
}
```

### `PatternPlayer` Class

Controls for pattern playback.

```typescript
class PatternPlayer {
  play(): void;
  pause(): void;
  stop(): void;
  
  readonly isPlaying: boolean;
  readonly isPaused: boolean;
  
  /** Current step position (0 to steps-1) */
  readonly currentStep: number;
  
  /** Jump to a specific step */
  seekToStep(step: number): void;
  
  /** Adjust BPM in real-time */
  bpm: number;
  
  /** Mute/unmute channels */
  setChannelMute(channel: ChannelType, muted: boolean): void;
  setChannelSolo(channel: ChannelType, solo: boolean): void;
  
  /** Event callbacks */
  onStep: ((step: number) => void) | null;
  onEnd: (() => void) | null;
  
  dispose(): void;
}
```

### `SongPlayer` Class

Controls for song playback.

```typescript
class SongPlayer extends PatternPlayer {
  /** Current pattern index in sequence */
  readonly currentPatternIndex: number;
  
  /** Current pattern ID */
  readonly currentPatternId: string;
  
  /** Jump to pattern in sequence */
  seekToPattern(index: number): void;
  
  /** Event when pattern changes */
  onPatternChange: ((index: number, patternId: string) => void) | null;
}
```

---

## Implementation Details

### Audio Engine Initialization

```typescript
// AudioEngine.ts
export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _state: 'uninitialized' | 'running' | 'suspended' = 'uninitialized';

  onStateChange: ((state: AudioEngine['_state']) => void) | null = null;

  async init(): Promise<void> {
    // Create context only on user gesture
    this.context = new AudioContext({
      sampleRate: 44100,
      latencyHint: 'interactive'
    });

    // Create master gain
    this.masterGain = this.context.createGain();
    this.masterGain.connect(this.context.destination);

    // Listen for state changes (mobile interruptions, etc.)
    this.context.addEventListener('statechange', () => {
      this.handleStateChange();
    });

    // Resume if suspended (Chrome autoplay policy)
    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    this.updateState();
  }

  private handleStateChange(): void {
    this.updateState();
  }

  private updateState(): void {
    if (!this.context) {
      this._state = 'uninitialized';
    } else {
      switch (this.context.state) {
        case 'running':
          this._state = 'running';
          break;
        case 'suspended':
          this._state = 'suspended';
          break;
        case 'closed':
          this._state = 'uninitialized';
          break;
      }
    }
    this.onStateChange?.(this._state);
  }

  get state(): AudioEngine['_state'] {
    return this._state;
  }

  async suspend(): Promise<void> {
    if (this.context && this.context.state === 'running') {
      await this.context.suspend();
      this.updateState();
    }
  }

  async resume(): Promise<void> {
    if (this.context && this.context.state === 'suspended') {
      await this.context.resume();
      this.updateState();
    }
  }

  get currentTime(): number {
    return this.context?.currentTime ?? 0;
  }

  get destination(): AudioNode {
    return this.masterGain!;
  }

  dispose(): void {
    if (this.context) {
      this.context.close();
      this.context = null;
      this.masterGain = null;
      this._state = 'uninitialized';
    }
  }
}
```

### VoicePool → Synth Integration

How `createSynth()` uses the voice pool internally:

```typescript
// RetroAudio.ts (internal implementation)
class RetroAudio {
  private audioEngine: AudioEngine;
  private voicePool: VoicePool;
  private activeSynths: Set<Synth> = new Set();

  createSynth(instrument: InstrumentData): Synth {
    // Acquire a voice from the pool
    const voice = this.voicePool.acquire();

    if (!voice) {
      throw new VoiceLimitReachedError();
    }

    // Configure the voice for this instrument
    voice.configure(instrument);

    // Create Synth wrapper that manages the voice
    const synth = new Synth(this.audioEngine.context, voice, instrument, () => {
      // Cleanup callback when synth is disposed
      this.activeSynths.delete(synth);
    });

    this.activeSynths.add(synth);
    return synth;
  }
}
```

### Handling Mobile Audio Interruptions

Mobile browsers can interrupt audio for phone calls, alarms, or other system events. The engine handles this gracefully:

```typescript
// Usage example
const audio = new RetroAudio();
await audio.init();

audio.onStateChange = (state) => {
  switch (state) {
    case 'suspended':
      // Show "tap to resume" UI (handles both user-initiated pause and system interruptions)
      showResumeButton();
      break;
    case 'running':
      hideResumeButton();
      break;
  }
};

// Resume on user gesture after interruption
resumeButton.onclick = async () => {
  await audio.resume();
};
```

### Pulse Channel Implementation

```typescript
// PulseChannel.ts
export class PulseChannel implements Channel {
  private context: AudioContext;
  private _oscillator: OscillatorNode | null = null;
  private gainNode: GainNode;
  private duty: number = 0.5;  // Default 50% duty = square wave

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.gainNode = context.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(destination);
  }

  /**
   * Create a pulse wave using PeriodicWave
   * Game Boy pulse waves have 4 duty cycles: 12.5%, 25%, 50% (square), 75%
   */
  private createPulseWave(duty: number): PeriodicWave {
    // Fourier series coefficients for pulse wave
    const harmonics = 64;
    const real = new Float32Array(harmonics);
    const imag = new Float32Array(harmonics);

    real[0] = 0;
    imag[0] = 0;

    for (let n = 1; n < harmonics; n++) {
      // Pulse wave Fourier series
      imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    }

    return this.context.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  setDuty(duty: number): void {
    this.duty = duty;
    if (this._oscillator) {
      this._oscillator.setPeriodicWave(this.createPulseWave(duty));
    }
  }

  noteOn(frequency: number, time: number): void {
    this._oscillator = this.context.createOscillator();
    this._oscillator.setPeriodicWave(this.createPulseWave(this.duty));
    this._oscillator.frequency.value = frequency;
    this._oscillator.connect(this.gainNode);
    this._oscillator.start(time);
  }

  noteOff(time: number): void {
    if (this._oscillator) {
      this._oscillator.stop(time);
      this._oscillator = null;
    }
  }

  get gain(): AudioParam {
    return this.gainNode.gain;
  }

  /** Expose oscillator for vibrato (uses detune param) */
  get oscillator(): OscillatorNode | null {
    return this._oscillator;
  }

  /** Expose frequency param for pitch slide and arpeggio */
  get frequencyParam(): AudioParam | null {
    return this._oscillator?.frequency ?? null;
  }
}
```

### Wave Channel Implementation

Supports triangle, sawtooth (native oscillator types), or custom wavetable:

```typescript
// WaveChannel.ts
export class WaveChannel implements Channel {
  private context: AudioContext;
  private _oscillator: OscillatorNode | null = null;
  private gainNode: GainNode;
  private waveformConfig: WaveWaveformConfig = { type: 'triangle' };
  private wavetable: number[] = new Array(32).fill(8);

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.gainNode = context.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(destination);
  }

  /** Set waveform configuration */
  setWaveform(config: WaveWaveformConfig): void {
    this.waveformConfig = config;
    if (config.type === 'custom' && config.wavetable) {
      this.setWavetable(config.wavetable);
    }
  }

  /**
   * Set custom wavetable (32 samples, values 0-15)
   * Game Boy wave channel uses 4-bit samples
   */
  private setWavetable(samples: number[]): void {
    if (samples.length !== 32) {
      throw new Error('Wavetable must be exactly 32 samples');
    }
    this.wavetable = samples.map(s => Math.max(0, Math.min(15, Math.round(s))));
  }

  private createWavetableWave(): PeriodicWave {
    const size = 32;
    const real = new Float32Array(size);
    const imag = new Float32Array(size);
    const normalized = this.wavetable.map(s => (s / 7.5) - 1);

    for (let k = 0; k < size; k++) {
      for (let n = 0; n < size; n++) {
        const angle = (2 * Math.PI * k * n) / size;
        real[k] += normalized[n] * Math.cos(angle);
        imag[k] -= normalized[n] * Math.sin(angle);
      }
      real[k] /= size;
      imag[k] /= size;
    }

    return this.context.createPeriodicWave(real, imag);
  }

  noteOn(frequency: number, time: number): void {
    this._oscillator = this.context.createOscillator();
    this._oscillator.frequency.value = frequency;

    // Use native types for triangle/sawtooth, custom wavetable otherwise
    switch (this.waveformConfig.type) {
      case 'triangle':
        this._oscillator.type = 'triangle';
        break;
      case 'sawtooth':
        this._oscillator.type = 'sawtooth';
        break;
      case 'custom':
        this._oscillator.setPeriodicWave(this.createWavetableWave());
        break;
    }

    this._oscillator.connect(this.gainNode);
    this._oscillator.start(time);
  }

  noteOff(time: number): void {
    if (this._oscillator) {
      this._oscillator.stop(time);
      this._oscillator = null;
    }
  }

  get gain(): AudioParam {
    return this.gainNode.gain;
  }

  /** Expose oscillator for vibrato (uses detune param) */
  get oscillator(): OscillatorNode | null {
    return this._oscillator;
  }

  /** Expose frequency param for pitch slide and arpeggio */
  get frequencyParam(): AudioParam | null {
    return this._oscillator?.frequency ?? null;
  }
}
```

### Noise Channel Implementation (LFSR)

```typescript
// NoiseChannel.ts
export class NoiseChannel implements Channel {
  private context: AudioContext;
  private bufferSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private noiseBuffer: AudioBuffer | null = null;
  private mode: 'long' | 'short' = 'long';

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.gainNode = context.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(destination);
    
    this.generateNoiseBuffer();
  }

  /**
   * Game Boy noise uses a Linear Feedback Shift Register (LFSR)
   * Long mode: 15-bit LFSR (32767 samples before repeat)
   * Short mode: 7-bit LFSR (127 samples - more tonal/metallic)
   */
  private generateNoiseBuffer(): void {
    const sampleRate = this.context.sampleRate;
    const length = this.mode === 'long' ? 32767 : 127;
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // LFSR implementation
    let lfsr = this.mode === 'long' ? 0x7FFF : 0x7F;
    const bits = this.mode === 'long' ? 15 : 7;
    const tap1 = this.mode === 'long' ? 0 : 0;
    const tap2 = this.mode === 'long' ? 1 : 1;

    for (let i = 0; i < length; i++) {
      // Output is bit 0
      data[i] = (lfsr & 1) ? 1 : -1;

      // Feedback: XOR of tap bits
      const bit = ((lfsr >> tap1) ^ (lfsr >> tap2)) & 1;
      lfsr = (lfsr >> 1) | (bit << (bits - 1));
    }

    this.noiseBuffer = buffer;
  }

  setMode(mode: 'long' | 'short'): void {
    if (mode !== this.mode) {
      this.mode = mode;
      this.generateNoiseBuffer();
    }
  }

  noteOn(frequency: number, time: number): void {
    if (!this.noiseBuffer) return;

    this.bufferSource = this.context.createBufferSource();
    this.bufferSource.buffer = this.noiseBuffer;
    this.bufferSource.loop = true;

    // Frequency affects playback rate
    // Higher frequency = faster LFSR cycling = higher pitched noise
    const baseRate = this.noiseBuffer.sampleRate / this.noiseBuffer.length;
    this.bufferSource.playbackRate.value = frequency / baseRate;

    this.bufferSource.connect(this.gainNode);
    this.bufferSource.start(time);
  }

  noteOff(time: number): void {
    if (this.bufferSource) {
      this.bufferSource.stop(time);
      this.bufferSource = null;
    }
  }

  get gain(): AudioParam {
    return this.gainNode.gain;
  }

  /** Noise doesn't have a traditional oscillator */
  get oscillator(): null {
    return null;
  }

  /** For noise, frequency controls playback rate */
  get frequencyParam(): AudioParam | null {
    return this.bufferSource?.playbackRate ?? null;
  }
}
```

### ADSR Envelope Implementation

```typescript
// Envelope.ts
export class Envelope {
  private context: AudioContext;
  private config: EnvelopeConfig;

  constructor(context: AudioContext, config: EnvelopeConfig) {
    this.context = context;
    this.config = config;
  }

  /**
   * Apply envelope to a gain AudioParam
   * @param param - The gain parameter to modulate
   * @param startTime - When to start the envelope
   * @param velocity - Velocity multiplier (0-1)
   * @returns The time when sustain phase begins
   */
  triggerAttack(param: AudioParam, startTime: number, velocity: number = 1): number {
    const { attack, decay, sustain, attackCurve, decayCurve } = this.config;
    const peakLevel = velocity;
    const sustainLevel = sustain * velocity;

    // Start at zero
    param.setValueAtTime(0, startTime);

    // Attack phase
    const attackEnd = startTime + attack;
    if (attackCurve === 'exponential' && attack > 0.001) {
      // Exponential attack (starts slow, ends fast)
      param.exponentialRampToValueAtTime(Math.max(peakLevel, 0.001), attackEnd);
    } else {
      // Linear attack
      param.linearRampToValueAtTime(peakLevel, attackEnd);
    }

    // Decay phase
    const decayEnd = attackEnd + decay;
    if (decayCurve === 'exponential' && decay > 0.001 && sustainLevel > 0.001) {
      param.exponentialRampToValueAtTime(Math.max(sustainLevel, 0.001), decayEnd);
    } else {
      param.linearRampToValueAtTime(sustainLevel, decayEnd);
    }

    return decayEnd;
  }

  /**
   * Trigger release phase
   * @param param - The gain parameter
   * @param startTime - When to start release
   * @returns The time when envelope reaches zero
   */
  triggerRelease(param: AudioParam, startTime: number): number {
    const { release, releaseCurve } = this.config;

    // Cancel any scheduled changes from this point
    param.cancelScheduledValues(startTime);

    // Get current value
    param.setValueAtTime(param.value, startTime);

    // Release to zero
    const releaseEnd = startTime + release;
    if (releaseCurve === 'exponential' && release > 0.001) {
      param.exponentialRampToValueAtTime(0.001, releaseEnd);
      param.setValueAtTime(0, releaseEnd);
    } else {
      param.linearRampToValueAtTime(0, releaseEnd);
    }

    return releaseEnd;
  }

  update(config: Partial<EnvelopeConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
```

### Pitch Slide Implementation

```typescript
// PitchSlide.ts
import { noteToFrequency } from '../utils/noteToFrequency';

export class PitchSlide {
  private context: AudioContext;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Apply pitch slide to an oscillator frequency param
   * @param param - The frequency AudioParam
   * @param startFreq - Starting frequency in Hz
   * @param semitones - Semitones to slide (positive = up, negative = down)
   * @param duration - Slide duration in seconds
   * @param startTime - When to start the slide
   */
  apply(
    param: AudioParam,
    startFreq: number,
    semitones: number,
    duration: number,
    startTime: number
  ): void {
    const endFreq = startFreq * Math.pow(2, semitones / 12);

    param.setValueAtTime(startFreq, startTime);
    param.exponentialRampToValueAtTime(endFreq, startTime + duration);
  }

  /**
   * Slide to a specific note
   */
  slideToNote(
    param: AudioParam,
    startFreq: number,
    targetNote: string,
    duration: number,
    startTime: number
  ): void {
    const targetFreq = noteToFrequency(targetNote);

    param.setValueAtTime(startFreq, startTime);
    param.exponentialRampToValueAtTime(targetFreq, startTime + duration);
  }
}
```

### Vibrato Implementation

```typescript
// Vibrato.ts
export class Vibrato {
  private context: AudioContext;
  private lfo: OscillatorNode | null = null;
  private lfoGain: GainNode | null = null;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Apply vibrato to an oscillator's detune param
   * Uses detune (in cents) for correct pitch modulation at any frequency
   * @param oscillator - The oscillator to modulate
   * @param depthSemitones - Vibrato depth in semitones (0-2)
   * @param speed - Vibrato speed in Hz (0-20)
   * @param startTime - When to start vibrato
   */
  start(
    oscillator: OscillatorNode,
    depthSemitones: number,
    speed: number,
    startTime: number
  ): void {
    // Convert semitones to cents (100 cents = 1 semitone)
    const depthCents = depthSemitones * 100;

    // Create LFO
    this.lfo = this.context.createOscillator();
    this.lfo.type = 'sine';
    this.lfo.frequency.value = speed;

    // Gain to scale LFO output to cents
    this.lfoGain = this.context.createGain();
    this.lfoGain.gain.value = depthCents;

    // Connect LFO -> Gain -> Detune param (not frequency)
    this.lfo.connect(this.lfoGain);
    this.lfoGain.connect(oscillator.detune);

    this.lfo.start(startTime);
  }

  stop(time?: number): void {
    if (this.lfo) {
      this.lfo.stop(time ?? this.context.currentTime);
      this.lfo.disconnect();
      this.lfo = null;
    }
    if (this.lfoGain) {
      this.lfoGain.disconnect();
      this.lfoGain = null;
    }
  }
}
```

### Arpeggiator Implementation

```typescript
// Arpeggiator.ts
export class Arpeggiator {
  private context: AudioContext;
  private scheduledUntil: number = 0;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Schedule arpeggio using Web Audio timing for sample-accurate playback
   * @param param - The frequency AudioParam
   * @param baseFreq - Base frequency in Hz
   * @param offsets - Semitone offsets, e.g., [0, 4, 7] for major chord
   * @param speed - Notes per second (e.g., 12 for 12 notes/sec)
   * @param startTime - When to start
   * @param duration - How long to arpeggiate (in seconds)
   */
  start(
    param: AudioParam,
    baseFreq: number,
    offsets: number[],
    speed: number,
    startTime: number,
    duration: number
  ): void {
    const safeOffsets = offsets.length > 0 ? offsets : [0];
    const stepDuration = 1 / speed;
    const totalSteps = Math.ceil(duration / stepDuration);

    // Pre-schedule all arpeggio steps using Web Audio timing
    for (let i = 0; i < totalSteps; i++) {
      const semitones = safeOffsets[i % safeOffsets.length];
      const freq = baseFreq * Math.pow(2, semitones / 12);
      param.setValueAtTime(freq, startTime + (i * stepDuration));
    }

    this.scheduledUntil = startTime + duration;
  }

  /**
   * Cancel any scheduled arpeggio changes from a given time
   */
  stop(param: AudioParam, time?: number): void {
    const stopTime = time ?? this.context.currentTime;
    param.cancelScheduledValues(stopTime);
  }
}
```

### Pitch Effects Integration

The `Synth` class integrates all pitch effects. Note duration for arpeggiator can be
provided via options or set externally by the Sequencer:

```typescript
// Synth.ts
interface NoteOnOptions {
  velocity?: number;
  time?: number;
  duration?: number;  // Hint for arpeggiator scheduling
}

class Synth {
  private voice: Voice;
  private _instrument: InstrumentData;
  private _noteDuration: number | null = null;
  // ... pitch effect instances ...

  /** Duration hint for arpeggiator - set by Sequencer or noteOn options */
  setNoteDuration(seconds: number): void {
    this._noteDuration = seconds;
  }

  noteOn(note: string | number, velocity?: number, time?: number): void;
  noteOn(note: string | number, options?: NoteOnOptions): void;
  noteOn(
    note: string | number,
    velocityOrOptions?: number | NoteOnOptions,
    time?: number
  ): void {
    let velocity = 1;
    let startTime = this.context.currentTime;

    if (typeof velocityOrOptions === 'object') {
      velocity = velocityOrOptions.velocity ?? 1;
      startTime = velocityOrOptions.time ?? startTime;
      this._noteDuration = velocityOrOptions.duration ?? null;
    } else if (typeof velocityOrOptions === 'number') {
      velocity = velocityOrOptions;
      startTime = time ?? startTime;
    }

    const frequency = typeof note === 'string' ? noteToFrequency(note) : note;

    // Start voice
    this.voice.noteOn(frequency, velocity, startTime);

    // Apply pitch effects using exposed channel params
    const pitch = this._instrument.pitch;
    if (pitch) {
      const channel = this.voice.getChannel();
      const freqParam = channel?.frequencyParam;
      const oscillator = channel?.oscillator;

      // Pitch slide
      if (pitch.slide && pitch.slideTime && freqParam) {
        this.pitchSlide.apply(freqParam, frequency, pitch.slide, pitch.slideTime, startTime);
      }

      // Vibrato (uses oscillator.detune for correct pitch modulation)
      if (pitch.vibratoDepth && pitch.vibratoSpeed && oscillator) {
        const vibratoStart = startTime + (pitch.slideTime ?? 0);
        this.vibrato.start(oscillator, pitch.vibratoDepth, pitch.vibratoSpeed, vibratoStart);
      }

      // Arpeggio (pre-scheduled using Web Audio timing)
      if (pitch.arpeggio && pitch.arpeggio.length > 0 && freqParam) {
        const arpeggioSpeed = pitch.arpeggioSpeed ?? 12;
        const duration = this._noteDuration ?? 2; // Default 2 seconds if unknown
        this.arpeggiator.start(freqParam, frequency, pitch.arpeggio, arpeggioSpeed, startTime, duration);
      }
    }
  }
}
```

### Sequencer Implementation

```typescript
// Sequencer.ts
export class Sequencer {
  private context: AudioContext;
  private engine: RetroAudio;
  private pattern: PatternData;
  private _bpm: number;
  private isPlaying: boolean = false;
  private currentStep: number = 0;
  private nextStepTime: number = 0;
  private scheduleAheadTime: number = 0.1; // Schedule 100ms ahead
  private timerInterval: number = 25; // Check every 25ms
  private timerId: number | null = null;

  // Channel mute/solo state
  private mutedChannels: Set<ChannelType> = new Set();
  private soloedChannels: Set<ChannelType> = new Set();

  // Active voices per channel (for note-off handling)
  private activeVoices: Map<ChannelType, Synth> = new Map();

  onStep: ((step: number) => void) | null = null;
  onEnd: (() => void) | null = null;

  constructor(context: AudioContext, engine: RetroAudio, pattern: PatternData, bpm: number = 120) {
    this.context = context;
    this.engine = engine;
    this.pattern = pattern;
    this._bpm = bpm;
  }

  get bpm(): number {
    return this._bpm;
  }

  set bpm(value: number) {
    this._bpm = Math.max(30, Math.min(300, value));
  }

  private get secondsPerStep(): number {
    const beatsPerSecond = this._bpm / 60;
    const stepsPerSecond = beatsPerSecond * this.pattern.stepsPerBeat;
    return 1 / stepsPerSecond;
  }

  // --- Channel Mute/Solo ---

  setChannelMute(channel: ChannelType, muted: boolean): void {
    if (muted) {
      this.mutedChannels.add(channel);
      // Stop any active voice on this channel
      this.activeVoices.get(channel)?.noteOff();
    } else {
      this.mutedChannels.delete(channel);
    }
  }

  setChannelSolo(channel: ChannelType, solo: boolean): void {
    if (solo) {
      this.soloedChannels.add(channel);
    } else {
      this.soloedChannels.delete(channel);
    }
    // When solo changes, stop voices on channels that are now effectively muted
    for (const ch of ['pulse1', 'pulse2', 'wave', 'noise'] as const) {
      if (!this.isChannelAudible(ch)) {
        this.activeVoices.get(ch)?.noteOff();
      }
    }
  }

  private isChannelAudible(channel: ChannelType): boolean {
    // If any channel is soloed, only soloed channels are audible
    if (this.soloedChannels.size > 0) {
      return this.soloedChannels.has(channel) && !this.mutedChannels.has(channel);
    }
    // Otherwise, check mute state
    return !this.mutedChannels.has(channel);
  }

  // --- Playback Control ---

  play(): void {
    if (this.isPlaying) return;

    this.isPlaying = true;
    this.nextStepTime = this.context.currentTime;
    this.scheduler();
  }

  private scheduler(): void {
    // Schedule all steps that fall within the schedule window
    while (this.nextStepTime < this.context.currentTime + this.scheduleAheadTime) {
      this.scheduleStep(this.currentStep, this.nextStepTime);
      this.advanceStep();
    }

    // Schedule next check
    if (this.isPlaying) {
      this.timerId = window.setTimeout(() => this.scheduler(), this.timerInterval);
    }
  }

  private scheduleStep(step: number, time: number): void {
    // Notify UI (will be slightly ahead of actual playback)
    if (this.onStep) {
      const delay = (time - this.context.currentTime) * 1000;
      setTimeout(() => this.onStep?.(step), delay);
    }

    // Schedule notes for each channel
    for (const channelName of ['pulse1', 'pulse2', 'wave', 'noise'] as const) {
      if (!this.isChannelAudible(channelName)) continue;

      const events = this.pattern.channels[channelName];
      const event = events.find(e => e.step === step);

      if (event) {
        if (event.note === null) {
          // Explicit note-off: stop any active voice on this channel
          this.activeVoices.get(channelName)?.noteOff(time);
          this.activeVoices.delete(channelName);
        } else {
          this.playNote(channelName, event, time, step);
        }
      }
    }
  }

  private playNote(channel: ChannelType, event: NoteEvent, time: number, step: number): void {
    const instrument = this.engine.getInstrument(event.instrumentId);
    if (!instrument) {
      console.warn(`Instrument not found: ${event.instrumentId}`);
      return;
    }

    // Stop any currently playing voice on this channel
    this.activeVoices.get(channel)?.noteOff(time);

    // Create and schedule the note
    const synth = this.engine.createSynth(instrument);
    const volume = event.volume ?? instrument.volume;
    synth.noteOn(event.note!, volume, time);

    // Track active voice
    this.activeVoices.set(channel, synth);

    // Calculate note-off time
    const noteOffTime = this.calculateNoteOffTime(channel, event, time, step);
    synth.noteOff(noteOffTime);
  }

  private calculateNoteOffTime(
    channel: ChannelType,
    event: NoteEvent,
    startTime: number,
    step: number
  ): number {
    // If explicit duration is set, use it
    if (event.duration !== undefined) {
      return startTime + (event.duration * this.secondsPerStep);
    }

    // Otherwise, find next event on this channel (note or note-off)
    const events = this.pattern.channels[channel];
    const nextEvent = events.find(e => e.step > step);

    if (nextEvent) {
      // Play until next event
      const stepsUntilNext = nextEvent.step - step;
      return startTime + (stepsUntilNext * this.secondsPerStep);
    } else {
      // Play until end of pattern
      const stepsUntilEnd = this.pattern.steps - step;
      return startTime + (stepsUntilEnd * this.secondsPerStep);
    }
  }

  private advanceStep(): void {
    this.nextStepTime += this.secondsPerStep;
    this.currentStep++;

    if (this.currentStep >= this.pattern.steps) {
      this.currentStep = 0;
      // Loop handling is done by PatternPlayer wrapper
    }
  }

  pause(): void {
    this.isPlaying = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  stop(): void {
    this.pause();
    this.currentStep = 0;
    // Stop all active voices
    for (const synth of this.activeVoices.values()) {
      synth.noteOff();
    }
    this.activeVoices.clear();
    this.engine.stopAll();
    this.onEnd?.();
  }

  seekToStep(step: number): void {
    this.currentStep = step % this.pattern.steps;
  }

  dispose(): void {
    this.stop();
  }
}
```

### Note to Frequency Conversion

```typescript
// noteToFrequency.ts
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const A4_FREQUENCY = 440;
const A4_MIDI = 69;

export function noteToFrequency(note: string): number {
  // Parse note name like "C4", "D#5", "Gb3"
  const match = note.match(/^([A-G])([#b]?)(-?\d+)$/i);
  if (!match) {
    throw new Error(`Invalid note: ${note}`);
  }

  const [, noteName, accidental, octaveStr] = match;
  const octave = parseInt(octaveStr, 10);

  // Find base note index
  let noteIndex = NOTE_NAMES.indexOf(noteName.toUpperCase());
  if (noteIndex === -1) {
    throw new Error(`Invalid note name: ${noteName}`);
  }

  // Apply accidental
  if (accidental === '#') noteIndex++;
  else if (accidental === 'b') noteIndex--;

  // Calculate MIDI note number
  const midi = (octave + 1) * 12 + noteIndex;

  // Convert to frequency
  return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / 12);
}

export function frequencyToNote(frequency: number): string {
  // Convert frequency to nearest note name
  const midi = Math.round(12 * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI);
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = midi % 12;
  return NOTE_NAMES[noteIndex] + octave;
}
```

---

## Build Configuration

### package.json

```json
{
  "name": "retro-audio",
  "version": "1.0.0",
  "description": "Embeddable 8-bit audio synthesis engine",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist"
  ],
  "scripts": {
    "build": "rollup -c",
    "dev": "rollup -c -w",
    "test": "vitest",
    "lint": "eslint src --ext .ts",
    "typecheck": "tsc --noEmit"
  },
  "keywords": [
    "audio",
    "synthesizer",
    "chiptune",
    "8-bit",
    "gameboy",
    "web-audio"
  ],
  "author": "",
  "license": "MIT",
  "devDependencies": {
    "@rollup/plugin-typescript": "^11.0.0",
    "@types/node": "^20.0.0",
    "rollup": "^4.0.0",
    "rollup-plugin-dts": "^6.0.0",
    "rollup-plugin-terser": "^7.0.0",
    "typescript": "^5.0.0",
    "vitest": "^1.0.0"
  }
}
```

### tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2020", "DOM"],
    "declaration": true,
    "declarationDir": "./dist",
    "outDir": "./dist",
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### rollup.config.js

```javascript
import typescript from '@rollup/plugin-typescript';
import { terser } from 'rollup-plugin-terser';
import dts from 'rollup-plugin-dts';

export default [
  // ES Module build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'es',
      sourcemap: true
    },
    plugins: [typescript()]
  },
  // CommonJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true
    },
    plugins: [typescript()]
  },
  // Minified UMD build for <script> tag
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.min.js',
      format: 'umd',
      name: 'RetroAudio',
      sourcemap: true
    },
    plugins: [typescript(), terser()]
  },
  // Type declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.d.ts',
      format: 'es'
    },
    plugins: [dts()]
  }
];
```

---

## Testing Requirements

### Unit Tests

```typescript
// tests/noteToFrequency.test.ts
import { describe, it, expect } from 'vitest';
import { noteToFrequency } from '../src/utils/noteToFrequency';

describe('noteToFrequency', () => {
  it('converts A4 to 440 Hz', () => {
    expect(noteToFrequency('A4')).toBeCloseTo(440, 2);
  });

  it('converts C4 (middle C) correctly', () => {
    expect(noteToFrequency('C4')).toBeCloseTo(261.63, 1);
  });

  it('handles sharps', () => {
    expect(noteToFrequency('C#4')).toBeCloseTo(277.18, 1);
  });

  it('handles flats', () => {
    expect(noteToFrequency('Db4')).toBeCloseTo(277.18, 1);
  });

  it('handles different octaves', () => {
    const c3 = noteToFrequency('C3');
    const c4 = noteToFrequency('C4');
    expect(c4 / c3).toBeCloseTo(2, 2); // Octave = 2x frequency
  });

  it('throws on invalid note', () => {
    expect(() => noteToFrequency('X4')).toThrow();
    expect(() => noteToFrequency('C')).toThrow();
  });
});
```

### Integration Tests

```typescript
// tests/RetroAudio.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { RetroAudio } from '../src/RetroAudio';

describe('RetroAudio', () => {
  let audio: RetroAudio;

  beforeEach(async () => {
    audio = new RetroAudio();
    // Note: In tests, we may need to mock AudioContext
  });

  afterEach(() => {
    audio.dispose();
  });

  it('initializes in uninitialized state', () => {
    expect(audio.state).toBe('uninitialized');
  });

  it('loads instruments correctly', () => {
    const instrument = {
      id: 'test-inst',
      name: 'Test',
      channel: 'pulse1' as const,
      waveform: { type: 'pulse' as const, duty: 0.5 },
      envelope: { attack: 0.1, decay: 0.1, sustain: 0.5, release: 0.1 },
      volume: 0.8
    };

    audio.loadInstruments([instrument]);
    expect(audio.getInstrument('test-inst')).toEqual(instrument);
  });

  it('clears instruments', () => {
    audio.loadInstruments([{ /* ... */ }]);
    audio.clearInstruments();
    expect(audio.getInstrument('test-inst')).toBeUndefined();
  });
});
```

---

## Error Handling

```typescript
// Custom error types
export class RetroAudioError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RetroAudioError';
  }
}

export class AudioContextNotInitializedError extends RetroAudioError {
  constructor() {
    super('AudioContext not initialized. Call init() first.');
  }
}

export class InstrumentNotFoundError extends RetroAudioError {
  constructor(id: string) {
    super(`Instrument not found: ${id}`);
  }
}

export class InvalidNoteError extends RetroAudioError {
  constructor(note: string) {
    super(`Invalid note format: ${note}. Expected format like "C4", "D#5", "Gb3".`);
  }
}

export class AudioSuspendedError extends RetroAudioError {
  constructor() {
    super('Audio is suspended. Call resume() after user gesture.');
  }
}

export class VoiceLimitReachedError extends RetroAudioError {
  constructor() {
    super('Maximum voice limit reached and voice stealing is disabled.');
  }
}
```

---

## Usage Examples

### Basic Usage (Consuming Application)

```typescript
import { RetroAudio } from 'retro-audio';

// Initialize on button click
document.querySelector('#start-button').addEventListener('click', async () => {
  const audio = new RetroAudio();
  await audio.init();

  // Load a sound effect
  const coinSfx = await fetch('/sounds/coin.p8sfx.json').then(r => r.json());
  
  // Play it!
  audio.playSfx(coinSfx);
});
```

### Playing a Song

```typescript
import { RetroAudio } from 'retro-audio';

const audio = new RetroAudio();
await audio.init();

// Load song (includes instruments and patterns)
const song = await fetch('/music/level1.p8song.json').then(r => r.json());

const player = audio.playSong(song);

// React to playback events
player.onStep = (step) => {
  updateVisualization(step);
};

player.onPatternChange = (index, patternId) => {
  console.log(`Now playing pattern: ${patternId}`);
};

// Control playback
document.querySelector('#pause').onclick = () => player.pause();
document.querySelector('#stop').onclick = () => player.stop();
```

### Real-Time Synth (Composition Tool)

```typescript
import { RetroAudio } from 'retro-audio';

const audio = new RetroAudio();
await audio.init();

const instrument = {
  id: 'lead',
  name: 'Lead Synth',
  channel: 'pulse1',
  waveform: { type: 'pulse', duty: 0.25 },
  envelope: { attack: 0.01, decay: 0.1, sustain: 0.7, release: 0.2 },
  volume: 0.8
};

const synth = audio.createSynth(instrument);

// Keyboard input
document.addEventListener('keydown', (e) => {
  if (e.key === 'a') synth.noteOn('C4');
  if (e.key === 's') synth.noteOn('D4');
  if (e.key === 'd') synth.noteOn('E4');
});

document.addEventListener('keyup', () => {
  synth.noteOff();
});

// Update parameters in real-time
attackSlider.oninput = (e) => {
  synth.updateEnvelope({ attack: parseFloat(e.target.value) });
};
```

---

## Performance Considerations

1. **Voice Pooling**: Reuse oscillator/gain node setups instead of creating new ones
2. **Scheduling**: Use Web Audio's scheduling (not setTimeout) for precise timing
3. **Garbage Collection**: Disconnect and null out nodes when done
4. **Buffer Sizes**: Keep wavetables and LFSR buffers reasonably sized
5. **Event Throttling**: Debounce rapid parameter changes in real-time mode

---

## Browser Support

- Chrome 66+
- Firefox 76+
- Safari 14.1+
- Edge 79+

No fallbacks for older browsers - graceful degradation with error message.

---

## Future Expansion Points

1. **Additional chip emulations**: NES (2A03), C64 (SID), Williams arcade
2. **Effects**: Delay, reverb, distortion
3. **MIDI input**: Connect hardware controllers
4. **Export**: Render to WAV via OfflineAudioContext
5. **Web Workers**: Offload heavy processing
