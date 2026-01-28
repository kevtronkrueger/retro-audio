/**
 * Retro Audio Engine
 *
 * A lightweight, embeddable Web Audio synthesizer engine that emulates
 * 8-bit sound hardware (Game Boy DMG style).
 *
 * @packageDocumentation
 */

// Main class
export { RetroAudio } from './RetroAudio';

// Player classes
export { Synth } from './Synth';
export { SoundInstance } from './SoundInstance';
export { PatternPlayer } from './PatternPlayer';
export { SongPlayer } from './SongPlayer';

// Core components (for advanced use)
export { AudioEngine } from './core/AudioEngine';
export { Mixer } from './core/Mixer';
export { Voice } from './core/Voice';
export { VoicePool } from './core/VoicePool';

// Channel implementations
export type { Channel } from './core/Channel';
export { PulseChannel } from './core/PulseChannel';
export { WaveChannel } from './core/WaveChannel';
export { NoiseChannel } from './core/NoiseChannel';

// Synthesis components
export { Envelope } from './synthesis/Envelope';
export { PitchSlide } from './synthesis/PitchSlide';
export { Vibrato } from './synthesis/Vibrato';
export { Arpeggiator } from './synthesis/Arpeggiator';
export { Oscillator } from './synthesis/Oscillator';
export { NoiseGenerator } from './synthesis/NoiseGenerator';

// Playback components
export { Clock } from './playback/Clock';
export { Scheduler } from './playback/Scheduler';
export { Sequencer } from './playback/Sequencer';

// Loader components
export { SoundLoader } from './loader/SoundLoader';
export { InstrumentBank } from './loader/InstrumentBank';
export { Validator } from './loader/Validator';

// Utilities
export {
  noteToFrequency,
  frequencyToNote,
  midiToFrequency,
  frequencyToMidi,
  semitonesToRatio,
  centsToRatio,
} from './utils/noteToFrequency';

export {
  clamp,
  clampVolume,
  clampBpm,
  lerp,
  mapRange,
  normalizeWavetableSample,
  dbToLinear,
  linearToDb,
} from './utils/clamp';

export * from './utils/constants';

// Error types
export {
  RetroAudioError,
  AudioContextNotInitializedError,
  InstrumentNotFoundError,
  InvalidNoteError,
  AudioSuspendedError,
  VoiceLimitReachedError,
  ValidationError,
  PatternNotFoundError,
} from './errors';

// Type exports
export type {
  // Instrument types
  ChannelType,
  CurveType,
  PulseWaveformConfig,
  WaveWaveformConfig,
  NoiseWaveformConfig,
  WaveformConfig,
  EnvelopeConfig,
  PitchConfig,
  EffectsConfig,
  InstrumentData,

  // Pattern types
  NoteEffects,
  NoteEvent,
  ChannelPattern,
  PatternData,
  PlaybackOptions,

  // Song types
  SongData,
  SfxData,
  ProjectData,

  // Configuration types
  VoiceConfig,
  RetroAudioOptions,
  AudioState,
  StateChangeCallback,
  StepCallback,
  PatternChangeCallback,
  NoteOnOptions,
} from './types';
