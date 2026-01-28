/**
 * Voice - Single voice instance
 *
 * Represents a single playable voice that can be configured with an instrument
 * and used to play notes. Voices are managed by the VoicePool.
 */

import type { Channel } from './Channel';
import type { InstrumentData, PulseWaveformConfig, WaveWaveformConfig, NoiseWaveformConfig } from '../types';
import { PulseChannel } from './PulseChannel';
import { WaveChannel } from './WaveChannel';
import { NoiseChannel } from './NoiseChannel';
import { Envelope } from '../synthesis/Envelope';

export class Voice {
  private context: AudioContext;
  private channel: Channel | null = null;
  private envelope: Envelope | null = null;
  private _isActive: boolean = false;
  private _startTime: number = 0;
  private gainNode: GainNode;
  private currentInstrument: InstrumentData | null = null;
  private releaseTimeoutId: ReturnType<typeof setTimeout> | null = null;

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.gainNode = context.createGain();
    this.gainNode.gain.value = 0;
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

  /** Get the current instrument configuration */
  get instrument(): InstrumentData | null {
    return this.currentInstrument;
  }

  /**
   * Configure this voice for an instrument
   */
  configure(instrument: InstrumentData): void {
    // Clean up previous channel
    if (this.channel) {
      this.disposeChannel();
    }

    this.currentInstrument = instrument;

    // Create appropriate channel based on instrument type
    switch (instrument.channel) {
      case 'pulse1':
      case 'pulse2': {
        const pulseChannel = new PulseChannel(this.context, this.gainNode);
        const pulseConfig = instrument.waveform as PulseWaveformConfig;
        if (pulseConfig.duty) {
          pulseChannel.setDuty(pulseConfig.duty);
        }
        this.channel = pulseChannel;
        break;
      }
      case 'wave': {
        const waveChannel = new WaveChannel(this.context, this.gainNode);
        const waveConfig = instrument.waveform as WaveWaveformConfig;
        waveChannel.setWaveform(waveConfig);
        this.channel = waveChannel;
        break;
      }
      case 'noise': {
        const noiseChannel = new NoiseChannel(this.context, this.gainNode);
        const noiseConfig = instrument.waveform as NoiseWaveformConfig;
        if (noiseConfig.mode) {
          noiseChannel.setMode(noiseConfig.mode);
        }
        this.channel = noiseChannel;
        break;
      }
    }

    // Create envelope
    this.envelope = new Envelope(this.context, instrument.envelope);
  }

  /**
   * Trigger a note on
   * @param frequency - Frequency in Hz
   * @param velocity - Velocity 0-1
   * @param time - Scheduled start time
   */
  noteOn(frequency: number, velocity: number, time: number): void {
    if (!this.channel || !this.envelope) {
      throw new Error('Voice not configured. Call configure() first.');
    }

    // Clear any pending release timeout
    if (this.releaseTimeoutId) {
      clearTimeout(this.releaseTimeoutId);
      this.releaseTimeoutId = null;
    }

    this._isActive = true;
    this._startTime = time;

    // Apply instrument volume
    const volume = this.currentInstrument?.volume ?? 1;
    const adjustedVelocity = velocity * volume;

    // Start the channel (oscillator/noise source)
    this.channel.noteOn(frequency, time);

    // Apply envelope to gain
    this.envelope.triggerAttack(this.gainNode.gain, time, adjustedVelocity);
  }

  /**
   * Release the current note
   * @param time - Scheduled release time
   */
  noteOff(time?: number): void {
    if (!this.channel || !this.envelope) return;

    const releaseTime = time ?? this.context.currentTime;

    // Trigger release phase
    const endTime = this.envelope.triggerRelease(this.gainNode.gain, releaseTime);

    // Schedule voice deactivation after release completes
    const releaseDelay = Math.max(0, (endTime - this.context.currentTime) * 1000);

    this.releaseTimeoutId = setTimeout(() => {
      this._isActive = false;
      this.channel?.noteOff(endTime);
      this.releaseTimeoutId = null;
    }, releaseDelay);
  }

  /**
   * Immediately stop the voice (for voice stealing or stopAll)
   */
  stop(): void {
    // Clear any pending release timeout
    if (this.releaseTimeoutId) {
      clearTimeout(this.releaseTimeoutId);
      this.releaseTimeoutId = null;
    }

    this._isActive = false;

    if (this.channel) {
      this.channel.noteOff(this.context.currentTime);
    }

    // Immediately silence
    this.gainNode.gain.cancelScheduledValues(this.context.currentTime);
    this.gainNode.gain.setValueAtTime(0, this.context.currentTime);
  }

  /**
   * Access the underlying channel for pitch effects
   */
  getChannel(): Channel | null {
    return this.channel;
  }

  /**
   * Get the gain node for external connections
   */
  getGainNode(): GainNode {
    return this.gainNode;
  }

  /**
   * Update envelope in real-time
   */
  updateEnvelope(updates: Partial<InstrumentData['envelope']>): void {
    if (this.envelope) {
      this.envelope.update(updates);
    }
  }

  private disposeChannel(): void {
    if (this.channel) {
      // Stop and cleanup
      try {
        this.channel.noteOff(this.context.currentTime);
      } catch {
        // Ignore errors
      }

      // Call dispose if available
      if ('dispose' in this.channel && typeof this.channel.dispose === 'function') {
        (this.channel as { dispose: () => void }).dispose();
      }

      this.channel = null;
    }
  }

  /**
   * Clean up all resources
   */
  dispose(): void {
    if (this.releaseTimeoutId) {
      clearTimeout(this.releaseTimeoutId);
      this.releaseTimeoutId = null;
    }

    this.disposeChannel();
    this.gainNode.disconnect();
    this.envelope = null;
    this.currentInstrument = null;
    this._isActive = false;
  }
}
