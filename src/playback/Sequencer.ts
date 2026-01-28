/**
 * Sequencer - Pattern/song playback engine
 *
 * Handles the scheduling and playback of patterns, managing note
 * events across all channels with precise timing.
 */

import type {
  PatternData,
  NoteEvent,
  ChannelType,
  StepCallback,
} from '../types';
import type { RetroAudio } from '../RetroAudio';
import { Clock } from './Clock';
import { Scheduler } from './Scheduler';
import { Synth } from '../Synth';
import { CHANNEL_NAMES } from '../utils/constants';

export class Sequencer {
  private context: AudioContext;
  private engine: RetroAudio;
  private pattern: PatternData;
  private clock: Clock;
  private scheduler: Scheduler;
  private _isPlaying: boolean = false;
  private _isPaused: boolean = false;
  private _currentStep: number = 0;
  private nextStepTime: number = 0;
  private _loop: boolean = false;

  // Channel mute/solo state
  private mutedChannels: Set<ChannelType> = new Set();
  private soloedChannels: Set<ChannelType> = new Set();

  // Active voices per channel (for note-off handling)
  private activeVoices: Map<ChannelType, Synth> = new Map();

  // Scheduled note-offs
  private scheduledNoteOffs: Map<string, ReturnType<typeof setTimeout>> = new Map();

  // Callbacks
  onStep: StepCallback | null = null;
  onEnd: (() => void) | null = null;
  onLoop: (() => void) | null = null;

  constructor(
    context: AudioContext,
    engine: RetroAudio,
    pattern: PatternData,
    bpm: number = 120,
    loop: boolean = false
  ) {
    this.context = context;
    this.engine = engine;
    this.pattern = pattern;
    this._loop = loop;

    this.clock = new Clock(bpm, pattern.stepsPerBeat);
    this.scheduler = new Scheduler(context);
    this.scheduler.setCallback((scheduleUntil) => {
      this.scheduleEvents(scheduleUntil);
    });
  }

  // --- BPM Control ---

  get bpm(): number {
    return this.clock.bpm;
  }

  set bpm(value: number) {
    this.clock.bpm = value;
  }

  // --- Loop Control ---

  get loop(): boolean {
    return this._loop;
  }

  set loop(value: boolean) {
    this._loop = value;
  }

  // --- Channel Mute/Solo ---

  setChannelMute(channel: ChannelType, muted: boolean): void {
    if (muted) {
      this.mutedChannels.add(channel);
      // Stop any active voice on this channel
      const voice = this.activeVoices.get(channel);
      if (voice) {
        voice.noteOff();
        this.activeVoices.delete(channel);
      }
    } else {
      this.mutedChannels.delete(channel);
    }
  }

  isChannelMuted(channel: ChannelType): boolean {
    return this.mutedChannels.has(channel);
  }

  setChannelSolo(channel: ChannelType, solo: boolean): void {
    if (solo) {
      this.soloedChannels.add(channel);
    } else {
      this.soloedChannels.delete(channel);
    }

    // When solo changes, stop voices on channels that are now muted
    for (const ch of CHANNEL_NAMES) {
      if (!this.isChannelAudible(ch)) {
        const voice = this.activeVoices.get(ch);
        if (voice) {
          voice.noteOff();
          this.activeVoices.delete(ch);
        }
      }
    }
  }

  isChannelSoloed(channel: ChannelType): boolean {
    return this.soloedChannels.has(channel);
  }

  private isChannelAudible(channel: ChannelType): boolean {
    // If muted, never audible
    if (this.mutedChannels.has(channel)) return false;

    // If any channel is soloed, only soloed channels are audible
    if (this.soloedChannels.size > 0) {
      return this.soloedChannels.has(channel);
    }

    return true;
  }

  // --- Playback Control ---

  play(): void {
    if (this._isPlaying && !this._isPaused) return;

    this._isPlaying = true;
    this._isPaused = false;
    this.nextStepTime = this.context.currentTime;
    this.scheduler.start();
  }

  pause(): void {
    if (!this._isPlaying) return;

    this._isPaused = true;
    this.scheduler.pause();
  }

  stop(): void {
    this._isPlaying = false;
    this._isPaused = false;
    this._currentStep = 0;
    this.scheduler.stop();

    // Stop all active voices
    for (const synth of this.activeVoices.values()) {
      synth.noteOff();
    }
    this.activeVoices.clear();

    // Clear scheduled note-offs
    for (const timeout of this.scheduledNoteOffs.values()) {
      clearTimeout(timeout);
    }
    this.scheduledNoteOffs.clear();

    this.onEnd?.();
  }

  seekToStep(step: number): void {
    this._currentStep = step % this.pattern.steps;
  }

  // --- State ---

  get isPlaying(): boolean {
    return this._isPlaying && !this._isPaused;
  }

  get isPaused(): boolean {
    return this._isPaused;
  }

  get currentStep(): number {
    return this._currentStep;
  }

  get totalSteps(): number {
    return this.pattern.steps;
  }

  // --- Internal Scheduling ---

  private scheduleEvents(scheduleUntil: number): void {
    // Schedule all steps that fall within the schedule window
    while (this.nextStepTime < scheduleUntil && this._isPlaying && !this._isPaused) {
      this.scheduleStep(this._currentStep, this.nextStepTime);
      this.advanceStep();
    }
  }

  private scheduleStep(step: number, time: number): void {
    // Notify UI (scheduled slightly ahead)
    if (this.onStep) {
      const delay = Math.max(0, (time - this.context.currentTime) * 1000);
      setTimeout(() => this.onStep?.(step), delay);
    }

    // Schedule notes for each channel
    for (const channelName of CHANNEL_NAMES) {
      if (!this.isChannelAudible(channelName)) continue;

      const events = this.pattern.channels[channelName];
      const event = events.find(e => e.step === step);

      if (event) {
        if (event.note === null) {
          // Explicit note-off
          const voice = this.activeVoices.get(channelName);
          if (voice) {
            voice.noteOff(time);
            this.activeVoices.delete(channelName);
          }
        } else {
          this.playNote(channelName, event, time, step);
        }
      }
    }
  }

  private playNote(
    channel: ChannelType,
    event: NoteEvent,
    time: number,
    step: number
  ): void {
    const instrument = this.engine.getInstrument(event.instrumentId);
    if (!instrument) {
      console.warn(`Instrument not found: ${event.instrumentId}`);
      return;
    }

    // Stop any currently playing voice on this channel
    const existingVoice = this.activeVoices.get(channel);
    if (existingVoice) {
      existingVoice.noteOff(time);
    }

    // Create synth for this note
    try {
      const synth = this.engine.createSynth(instrument);
      const volume = event.volume ?? instrument.volume;

      // Calculate note duration
      const noteDuration = this.calculateNoteDuration(channel, event, step);
      synth.setNoteDuration(noteDuration);

      // Schedule note on
      synth.noteOn(event.note!, volume, time);

      // Track active voice
      this.activeVoices.set(channel, synth);

      // Schedule note off
      const noteOffTime = time + noteDuration;
      const noteOffKey = `${channel}-${step}`;

      // Clear any existing scheduled note-off for this channel
      const existingTimeout = this.scheduledNoteOffs.get(noteOffKey);
      if (existingTimeout) {
        clearTimeout(existingTimeout);
      }

      const noteOffDelay = Math.max(0, (noteOffTime - this.context.currentTime) * 1000);
      const timeout = setTimeout(() => {
        synth.noteOff(noteOffTime);
        if (this.activeVoices.get(channel) === synth) {
          this.activeVoices.delete(channel);
        }
        this.scheduledNoteOffs.delete(noteOffKey);
      }, noteOffDelay);

      this.scheduledNoteOffs.set(noteOffKey, timeout);
    } catch {
      // Voice limit reached - skip note
      console.warn('Voice limit reached, skipping note');
    }
  }

  private calculateNoteDuration(
    channel: ChannelType,
    event: NoteEvent,
    step: number
  ): number {
    // If explicit duration is set, use it
    if (event.duration !== undefined) {
      return this.clock.stepsToSeconds(event.duration);
    }

    // Otherwise, find next event on this channel
    const events = this.pattern.channels[channel];
    const nextEvent = events.find(e => e.step > step);

    if (nextEvent) {
      // Play until next event
      const stepsUntilNext = nextEvent.step - step;
      return this.clock.stepsToSeconds(stepsUntilNext);
    } else {
      // Play until end of pattern
      const stepsUntilEnd = this.pattern.steps - step;
      return this.clock.stepsToSeconds(stepsUntilEnd);
    }
  }

  private advanceStep(): void {
    this.nextStepTime += this.clock.secondsPerStep;
    this._currentStep++;

    if (this._currentStep >= this.pattern.steps) {
      if (this._loop) {
        this._currentStep = 0;
        this.onLoop?.();
      } else {
        this.stop();
      }
    }
  }

  /**
   * Get the pattern
   */
  getPattern(): PatternData {
    return this.pattern;
  }

  /**
   * Set a new pattern
   */
  setPattern(pattern: PatternData): void {
    const wasPlaying = this.isPlaying;
    this.stop();
    this.pattern = pattern;
    this.clock.stepsPerBeat = pattern.stepsPerBeat;
    if (wasPlaying) {
      this.play();
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    this.scheduler.dispose();
    this.activeVoices.clear();
    this.scheduledNoteOffs.clear();
    this.onStep = null;
    this.onEnd = null;
    this.onLoop = null;
  }
}
