/**
 * RetroAudio - Main class for the Retro Audio Engine
 *
 * The main entry point for consuming applications. Orchestrates all
 * audio components and provides the public API.
 */

import type {
  RetroAudioOptions,
  InstrumentData,
  PatternData,
  SongData,
  SfxData,
  PlaybackOptions,
  AudioState,
  StateChangeCallback,
} from './types';
import { AudioEngine } from './core/AudioEngine';
import { VoicePool } from './core/VoicePool';
import { Mixer } from './core/Mixer';
import { InstrumentBank } from './loader/InstrumentBank';
import { Synth } from './Synth';
import { SoundInstance } from './SoundInstance';
import { PatternPlayer } from './PatternPlayer';
import { SongPlayer } from './SongPlayer';
import { noteToFrequency } from './utils/noteToFrequency';
import {
  AudioContextNotInitializedError,
  VoiceLimitReachedError,
} from './errors';
import { DEFAULT_SAMPLE_RATE, DEFAULT_MAX_VOICES, DEFAULT_STEALING_MODE } from './utils/constants';

export class RetroAudio {
  private audioEngine: AudioEngine;
  private voicePool: VoicePool | null = null;
  private mixer: Mixer | null = null;
  private instrumentBank: InstrumentBank;
  private activeSynths: Set<Synth> = new Set();
  private activeSounds: Set<SoundInstance> = new Set();
  private activePatternPlayer: PatternPlayer | null = null;
  private activeSongPlayer: SongPlayer | null = null;
  private options: RetroAudioOptions;

  constructor(options: RetroAudioOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate ?? DEFAULT_SAMPLE_RATE,
      latencyHint: options.latencyHint ?? 'interactive',
      maxVoices: options.maxVoices ?? DEFAULT_MAX_VOICES,
      voiceStealingMode: options.voiceStealingMode ?? DEFAULT_STEALING_MODE,
    };

    this.audioEngine = new AudioEngine({
      sampleRate: this.options.sampleRate,
      latencyHint: this.options.latencyHint,
    });

    this.instrumentBank = new InstrumentBank();
  }

  /**
   * Initialize the audio context.
   * MUST be called from a user gesture (click, keypress, etc.)
   * due to browser autoplay policies.
   */
  async init(): Promise<void> {
    await this.audioEngine.init();

    const context = this.audioEngine.context;
    if (!context) {
      throw new AudioContextNotInitializedError('AudioContext failed to initialize');
    }

    // Initialize mixer
    this.mixer = new Mixer(context, this.audioEngine.destination);

    // Initialize voice pool
    this.voicePool = new VoicePool(context, this.audioEngine.destination, {
      maxVoices: this.options.maxVoices,
      stealingMode: this.options.voiceStealingMode,
    });
  }

  /**
   * Current state of the audio engine
   */
  get state(): AudioState {
    return this.audioEngine.state;
  }

  /**
   * Callback fired when audio context state changes
   */
  get onStateChange(): StateChangeCallback | null {
    return this.audioEngine.onStateChange;
  }

  set onStateChange(callback: StateChangeCallback | null) {
    this.audioEngine.onStateChange = callback;
  }

  /**
   * Suspend audio processing (save CPU when not in use)
   */
  async suspend(): Promise<void> {
    await this.audioEngine.suspend();
  }

  /**
   * Resume audio processing
   */
  async resume(): Promise<void> {
    await this.audioEngine.resume();
  }

  /**
   * Master volume control (0.0 - 1.0)
   */
  get masterVolume(): number {
    return this.audioEngine.masterVolume;
  }

  set masterVolume(value: number) {
    this.audioEngine.masterVolume = value;
  }

  // --- Instrument Bank ---

  /**
   * Load instruments into the bank for pattern/song playback
   */
  loadInstruments(instruments: InstrumentData[]): void {
    this.instrumentBank.load(instruments);
  }

  /**
   * Get an instrument by ID
   */
  getInstrument(id: string): InstrumentData | undefined {
    return this.instrumentBank.get(id);
  }

  /**
   * Clear all loaded instruments
   */
  clearInstruments(): void {
    this.instrumentBank.clear();
  }

  // --- One-Shot Sound Effects ---

  /**
   * Play a sound effect (one-shot, fire and forget)
   */
  playSfx(sfx: SfxData): SoundInstance;
  playSfx(instrument: InstrumentData, note: string): SoundInstance;
  playSfx(sfxOrInstrument: SfxData | InstrumentData, note?: string): SoundInstance {
    this.ensureInitialized();

    let instrument: InstrumentData;
    let noteToPlay: string;
    let duration: number | undefined;

    if ('type' in sfxOrInstrument && sfxOrInstrument.type === 'sfx') {
      // SfxData format
      const sfx = sfxOrInstrument as SfxData;
      instrument = sfx.instrument;
      noteToPlay = sfx.note ?? 'C4';
      duration = sfx.duration;
    } else {
      // Direct instrument + note
      instrument = sfxOrInstrument as InstrumentData;
      noteToPlay = note ?? 'C4';
    }

    // Acquire a voice
    if (!this.voicePool) {
      throw new AudioContextNotInitializedError('Voice pool not initialized');
    }
    const voice = this.voicePool.acquire();
    if (!voice) {
      throw new VoiceLimitReachedError();
    }

    // Configure and play
    voice.configure(instrument);
    const frequency = noteToFrequency(noteToPlay);
    voice.noteOn(frequency, 1, this.audioEngine.currentTime);

    // Create sound instance
    const context = this.audioEngine.context;
    if (!context) {
      throw new AudioContextNotInitializedError('AudioContext not available');
    }
    const soundInstance = new SoundInstance(
      context,
      voice,
      duration
    );

    // Track active sounds
    this.activeSounds.add(soundInstance);
    soundInstance.finished.then(() => {
      this.activeSounds.delete(soundInstance);
    });

    return soundInstance;
  }

  // --- Real-Time Synth ---

  /**
   * Create a real-time synth voice for live playing
   */
  createSynth(instrument: InstrumentData): Synth {
    this.ensureInitialized();

    // Acquire a voice from the pool
    if (!this.voicePool) {
      throw new AudioContextNotInitializedError('Voice pool not initialized');
    }
    const voice = this.voicePool.acquire();
    if (!voice) {
      throw new VoiceLimitReachedError();
    }

    const context = this.audioEngine.context;
    if (!context) {
      throw new AudioContextNotInitializedError('AudioContext not available');
    }

    // Create Synth wrapper
    const synth = new Synth(
      context,
      voice,
      instrument,
      () => {
        // Cleanup callback when synth is disposed
        this.activeSynths.delete(synth);
        // Release voice back to pool to prevent memory leak
        this.voicePool?.release(voice);
      }
    );

    this.activeSynths.add(synth);
    return synth;
  }

  // --- Pattern Playback ---

  /**
   * Load and play a pattern
   */
  playPattern(pattern: PatternData, options: PlaybackOptions = {}): PatternPlayer {
    this.ensureInitialized();

    // Stop any existing pattern player
    if (this.activePatternPlayer) {
      this.activePatternPlayer.dispose();
    }

    const context = this.audioEngine.context;
    if (!context) {
      throw new AudioContextNotInitializedError('AudioContext not available');
    }

    this.activePatternPlayer = new PatternPlayer(
      context,
      this,
      pattern,
      options
    );

    this.activePatternPlayer.play();
    return this.activePatternPlayer;
  }

  // --- Song Playback ---

  /**
   * Load and play a song
   */
  playSong(song: SongData): SongPlayer {
    this.ensureInitialized();

    // Stop any existing song player
    if (this.activeSongPlayer) {
      this.activeSongPlayer.dispose();
    }

    // Load song instruments
    this.loadInstruments(song.instruments);

    const context = this.audioEngine.context;
    if (!context) {
      throw new AudioContextNotInitializedError('AudioContext not available');
    }

    this.activeSongPlayer = new SongPlayer(
      context,
      this,
      song
    );

    this.activeSongPlayer.play();
    return this.activeSongPlayer;
  }

  // --- Global Controls ---

  /**
   * Stop all currently playing sounds
   */
  stopAll(): void {
    // Stop all synths
    for (const synth of this.activeSynths) {
      synth.noteOff();
    }

    // Stop all sound instances
    for (const sound of this.activeSounds) {
      sound.stop();
    }

    // Stop pattern player
    if (this.activePatternPlayer) {
      this.activePatternPlayer.stop();
    }

    // Stop song player
    if (this.activeSongPlayer) {
      this.activeSongPlayer.stop();
    }

    // Release all voices
    this.voicePool?.releaseAll();
  }

  /**
   * Get the underlying AudioContext (for advanced use)
   */
  getAudioContext(): AudioContext | null {
    return this.audioEngine.context;
  }

  /**
   * Get the mixer (for channel control)
   */
  getMixer(): Mixer | null {
    return this.mixer;
  }

  /**
   * Get current audio time
   */
  get currentTime(): number {
    return this.audioEngine.currentTime;
  }

  /**
   * Clean up and release audio resources
   */
  dispose(): void {
    this.stopAll();

    this.activeSynths.clear();
    this.activeSounds.clear();

    if (this.activePatternPlayer) {
      this.activePatternPlayer.dispose();
      this.activePatternPlayer = null;
    }

    if (this.activeSongPlayer) {
      this.activeSongPlayer.dispose();
      this.activeSongPlayer = null;
    }

    this.voicePool?.dispose();
    this.voicePool = null;

    this.mixer?.dispose();
    this.mixer = null;

    this.instrumentBank.clear();
    this.audioEngine.dispose();
  }

  private ensureInitialized(): void {
    if (this.state === 'uninitialized') {
      throw new AudioContextNotInitializedError();
    }
  }
}
