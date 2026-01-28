/**
 * PatternPlayer - Controls for pattern playback
 *
 * Wraps the Sequencer to provide the public API for pattern playback control.
 */

import type {
  PatternData,
  PlaybackOptions,
  ChannelType,
  StepCallback,
} from './types';
import type { RetroAudio } from './RetroAudio';
import { Sequencer } from './playback/Sequencer';
import { DEFAULT_BPM } from './utils/constants';

export class PatternPlayer {
  protected sequencer: Sequencer;
  protected _pattern: PatternData;

  /** Event callbacks */
  onStep: StepCallback | null = null;
  onEnd: (() => void) | null = null;

  constructor(
    context: AudioContext,
    engine: RetroAudio,
    pattern: PatternData,
    options: PlaybackOptions = {}
  ) {
    this._pattern = pattern;

    const bpm = options.bpm ?? DEFAULT_BPM;
    const loop = options.loop ?? false;

    this.sequencer = new Sequencer(context, engine, pattern, bpm, loop);

    // Wire up callbacks
    this.sequencer.onStep = (step) => this.onStep?.(step);
    this.sequencer.onEnd = () => this.onEnd?.();

    // Start at specified step if provided
    if (options.startStep !== undefined) {
      this.sequencer.seekToStep(options.startStep);
    }
  }

  /**
   * Start or resume playback
   */
  play(): void {
    this.sequencer.play();
  }

  /**
   * Pause playback (maintains position)
   */
  pause(): void {
    this.sequencer.pause();
  }

  /**
   * Stop playback and reset to beginning
   */
  stop(): void {
    this.sequencer.stop();
  }

  /**
   * Is the pattern currently playing?
   */
  get isPlaying(): boolean {
    return this.sequencer.isPlaying;
  }

  /**
   * Is the pattern paused?
   */
  get isPaused(): boolean {
    return this.sequencer.isPaused;
  }

  /**
   * Current step position (0 to steps-1)
   */
  get currentStep(): number {
    return this.sequencer.currentStep;
  }

  /**
   * Total steps in the pattern
   */
  get totalSteps(): number {
    return this._pattern.steps;
  }

  /**
   * Jump to a specific step
   */
  seekToStep(step: number): void {
    this.sequencer.seekToStep(step);
  }

  /**
   * Get/set BPM (adjustable in real-time)
   */
  get bpm(): number {
    return this.sequencer.bpm;
  }

  set bpm(value: number) {
    this.sequencer.bpm = value;
  }

  /**
   * Get/set loop mode
   */
  get loop(): boolean {
    return this.sequencer.loop;
  }

  set loop(value: boolean) {
    this.sequencer.loop = value;
  }

  /**
   * Mute a channel
   */
  setChannelMute(channel: ChannelType, muted: boolean): void {
    this.sequencer.setChannelMute(channel, muted);
  }

  /**
   * Check if a channel is muted
   */
  isChannelMuted(channel: ChannelType): boolean {
    return this.sequencer.isChannelMuted(channel);
  }

  /**
   * Solo a channel (only soloed channels will be audible)
   */
  setChannelSolo(channel: ChannelType, solo: boolean): void {
    this.sequencer.setChannelSolo(channel, solo);
  }

  /**
   * Check if a channel is soloed
   */
  isChannelSoloed(channel: ChannelType): boolean {
    return this.sequencer.isChannelSoloed(channel);
  }

  /**
   * Get the pattern data
   */
  get pattern(): PatternData {
    return this._pattern;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.sequencer.dispose();
    this.onStep = null;
    this.onEnd = null;
  }
}
