/**
 * AudioEngine - Web Audio context management
 *
 * Handles AudioContext creation, state management, and system audio
 * interruptions (mobile calls, etc.)
 */

import type { AudioState, StateChangeCallback } from '../types';
import { DEFAULT_SAMPLE_RATE } from '../utils/constants';

export interface AudioEngineOptions {
  sampleRate?: number;
  latencyHint?: 'interactive' | 'balanced' | 'playback';
}

export class AudioEngine {
  private _context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private _state: AudioState = 'uninitialized';
  private options: AudioEngineOptions;

  /** Callback fired when audio context state changes */
  onStateChange: StateChangeCallback | null = null;

  constructor(options: AudioEngineOptions = {}) {
    this.options = {
      sampleRate: options.sampleRate ?? DEFAULT_SAMPLE_RATE,
      latencyHint: options.latencyHint ?? 'interactive',
    };
  }

  /**
   * Initialize the audio context.
   * MUST be called from a user gesture (click, keypress, etc.)
   * due to browser autoplay policies.
   */
  async init(): Promise<void> {
    if (this._context) {
      // Already initialized, just resume if needed
      if (this._context.state === 'suspended') {
        await this._context.resume();
      }
      this.updateState();
      return;
    }

    // Create context only on user gesture
    this._context = new AudioContext({
      sampleRate: this.options.sampleRate,
      latencyHint: this.options.latencyHint,
    });

    // Create master gain node
    this.masterGain = this._context.createGain();
    this.masterGain.connect(this._context.destination);

    // Listen for state changes (mobile interruptions, etc.)
    this._context.addEventListener('statechange', () => {
      this.handleStateChange();
    });

    // Resume if suspended (Chrome autoplay policy)
    if (this._context.state === 'suspended') {
      await this._context.resume();
    }

    this.updateState();
  }

  private handleStateChange(): void {
    this.updateState();
  }

  private updateState(): void {
    if (!this._context) {
      this._state = 'uninitialized';
    } else {
      switch (this._context.state) {
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

  /** Current state of the audio engine */
  get state(): AudioState {
    return this._state;
  }

  /** The underlying AudioContext (may be null if uninitialized) */
  get context(): AudioContext | null {
    return this._context;
  }

  /** Current audio time */
  get currentTime(): number {
    return this._context?.currentTime ?? 0;
  }

  /** Sample rate */
  get sampleRate(): number {
    return this._context?.sampleRate ?? this.options.sampleRate!;
  }

  /** Master output destination */
  get destination(): AudioNode {
    if (!this.masterGain) {
      throw new Error('AudioEngine not initialized. Call init() first.');
    }
    return this.masterGain;
  }

  /** Master volume (0.0 - 1.0) */
  get masterVolume(): number {
    return this.masterGain?.gain.value ?? 1;
  }

  set masterVolume(value: number) {
    if (this.masterGain) {
      this.masterGain.gain.setValueAtTime(
        Math.max(0, Math.min(1, value)),
        this._context!.currentTime
      );
    }
  }

  /**
   * Suspend audio processing (save CPU when not in use)
   */
  async suspend(): Promise<void> {
    if (this._context && this._context.state === 'running') {
      await this._context.suspend();
      this.updateState();
    }
  }

  /**
   * Resume audio processing
   */
  async resume(): Promise<void> {
    if (this._context && this._context.state === 'suspended') {
      await this._context.resume();
      this.updateState();
    }
  }

  /**
   * Check if the engine is ready to play audio
   */
  isReady(): boolean {
    return this._state === 'running';
  }

  /**
   * Clean up and release audio resources
   */
  dispose(): void {
    if (this._context) {
      this._context.close();
      this._context = null;
      this.masterGain = null;
      this._state = 'uninitialized';
    }
  }
}
