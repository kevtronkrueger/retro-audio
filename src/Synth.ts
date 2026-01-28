/**
 * Synth - Real-time instrument control
 *
 * Provides a high-level interface for playing notes with an instrument.
 * Used by the composition tool for live playing and preview.
 */

import type {
  InstrumentData,
  EnvelopeConfig,
  WaveformConfig,
  NoteOnOptions,
} from './types';
import { Voice } from './core/Voice';
import { PitchSlide } from './synthesis/PitchSlide';
import { Vibrato } from './synthesis/Vibrato';
import { Arpeggiator } from './synthesis/Arpeggiator';
import { noteToFrequency } from './utils/noteToFrequency';

export class Synth {
  private context: AudioContext;
  private voice: Voice;
  private _instrument: InstrumentData;
  private _isPlaying: boolean = false;
  private _noteDuration: number | null = null;
  private onDispose: (() => void) | null;

  // Pitch effect instances
  private pitchSlide: PitchSlide;
  private vibrato: Vibrato;
  private arpeggiator: Arpeggiator;

  constructor(
    context: AudioContext,
    voice: Voice,
    instrument: InstrumentData,
    onDispose?: () => void
  ) {
    this.context = context;
    this.voice = voice;
    this._instrument = instrument;
    this.onDispose = onDispose ?? null;

    // Configure the voice for this instrument
    this.voice.configure(instrument);

    // Initialize pitch effects
    this.pitchSlide = new PitchSlide(context);
    this.vibrato = new Vibrato(context);
    this.arpeggiator = new Arpeggiator(context);
  }

  /**
   * Trigger a note on
   * @param note - Note name ("C4") or frequency in Hz
   * @param velocityOrOptions - Velocity (0-1) or options object
   * @param time - Optional scheduled time
   */
  noteOn(note: string | number, velocity?: number, time?: number): void;
  noteOn(note: string | number, options?: NoteOnOptions): void;
  noteOn(
    note: string | number,
    velocityOrOptions?: number | NoteOnOptions,
    time?: number
  ): void {
    let velocity = 1;
    let startTime = this.context.currentTime;

    // Parse arguments
    if (typeof velocityOrOptions === 'object') {
      velocity = velocityOrOptions.velocity ?? 1;
      startTime = velocityOrOptions.time ?? startTime;
      this._noteDuration = velocityOrOptions.duration ?? null;
    } else if (typeof velocityOrOptions === 'number') {
      velocity = velocityOrOptions;
      startTime = time ?? startTime;
    }

    // Convert note name to frequency
    const frequency = typeof note === 'string' ? noteToFrequency(note) : note;

    // Stop any previous vibrato
    this.vibrato.stop();

    // Start the voice
    this.voice.noteOn(frequency, velocity, startTime);
    this._isPlaying = true;

    // Apply pitch effects
    this.applyPitchEffects(frequency, startTime);
  }

  /**
   * Apply pitch effects based on instrument configuration
   */
  private applyPitchEffects(frequency: number, startTime: number): void {
    const pitch = this._instrument.pitch;
    if (!pitch) return;

    const channel = this.voice.getChannel();
    const freqParam = channel?.frequencyParam;
    const oscillator = channel?.oscillator;

    // Pitch slide
    if (pitch.slide && pitch.slideTime && freqParam) {
      this.pitchSlide.apply(
        freqParam,
        frequency,
        pitch.slide,
        pitch.slideTime,
        startTime
      );
    }

    // Vibrato (uses oscillator.detune for correct pitch modulation)
    if (pitch.vibratoDepth && pitch.vibratoSpeed && oscillator) {
      // Start vibrato after slide completes
      const vibratoStart = startTime + (pitch.slideTime ?? 0);
      this.vibrato.start(
        oscillator,
        pitch.vibratoDepth,
        pitch.vibratoSpeed,
        vibratoStart
      );
    }

    // Arpeggio (pre-scheduled using Web Audio timing)
    if (pitch.arpeggio && pitch.arpeggio.length > 0 && freqParam) {
      const arpeggioSpeed = pitch.arpeggioSpeed ?? 12;
      // Use note duration if available, otherwise default to 2 seconds
      const duration = this._noteDuration ?? 2;
      this.arpeggiator.start(
        freqParam,
        frequency,
        pitch.arpeggio,
        arpeggioSpeed,
        startTime,
        duration
      );
    }
  }

  /**
   * Release the current note
   * @param time - Optional scheduled time
   */
  noteOff(time?: number): void {
    const releaseTime = time ?? this.context.currentTime;

    // Stop vibrato
    this.vibrato.stop(releaseTime);

    // Stop arpeggiator
    const freqParam = this.voice.getChannel()?.frequencyParam;
    if (freqParam) {
      this.arpeggiator.stop(freqParam, releaseTime);
    }

    // Release the voice
    this.voice.noteOff(releaseTime);
    this._isPlaying = false;
  }

  /**
   * Set note duration hint for arpeggiator
   */
  setNoteDuration(seconds: number): void {
    this._noteDuration = seconds;
  }

  /**
   * Update instrument parameters
   * Changes take effect on next noteOn
   */
  updateInstrument(updates: Partial<InstrumentData>): void {
    this._instrument = {
      ...this._instrument,
      ...updates,
    };
    // Reconfigure voice with updated instrument
    this.voice.configure(this._instrument);
  }

  /**
   * Update just the envelope
   * Changes take effect on next noteOn
   */
  updateEnvelope(updates: Partial<EnvelopeConfig>): void {
    this._instrument = {
      ...this._instrument,
      envelope: {
        ...this._instrument.envelope,
        ...updates,
      },
    };
    this.voice.updateEnvelope(updates);
  }

  /**
   * Replace the waveform configuration
   * Changes take effect on next noteOn
   */
  setWaveform(config: WaveformConfig): void {
    this._instrument = {
      ...this._instrument,
      waveform: config,
    };
    // Will take effect on next noteOn when voice is reconfigured
    this.voice.configure(this._instrument);
  }

  /**
   * Current instrument state
   */
  get instrument(): InstrumentData {
    return { ...this._instrument };
  }

  /**
   * Is a note currently playing?
   */
  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * Access the underlying voice for advanced control
   */
  getVoice(): Voice {
    return this.voice;
  }

  /**
   * Disconnect and clean up
   */
  dispose(): void {
    this.noteOff();
    this.vibrato.stop();
    this.onDispose?.();
  }
}
