/**
 * WaveChannel - Custom wavetable channel
 *
 * Supports triangle, sawtooth (native oscillator types), or custom wavetable.
 * Game Boy wave channel uses 4-bit samples (0-15) in a 32-sample wavetable.
 */

import type { Channel } from './Channel';
import type { WaveWaveformConfig } from '../types';
import { WAVETABLE_SIZE, WAVETABLE_MAX_VALUE } from '../utils/constants';

export class WaveChannel implements Channel {
  private context: AudioContext;
  private _oscillator: OscillatorNode | null = null;
  private _oscillatorStopped: boolean = false;
  private gainNode: GainNode;
  private waveformConfig: WaveWaveformConfig = { type: 'triangle' };
  private wavetable: number[] = new Array(WAVETABLE_SIZE).fill(8); // Default mid-level

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.gainNode = context.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(destination);
  }

  /**
   * Set waveform configuration
   */
  setWaveform(config: WaveWaveformConfig): void {
    this.waveformConfig = config;
    if (config.type === 'custom' && config.wavetable) {
      this.setWavetable(config.wavetable);
    }
  }

  /**
   * Get current waveform configuration
   */
  getWaveform(): WaveWaveformConfig {
    return this.waveformConfig;
  }

  /**
   * Set custom wavetable (32 samples, values 0-15)
   * Game Boy wave channel uses 4-bit samples
   */
  private setWavetable(samples: number[]): void {
    if (samples.length !== WAVETABLE_SIZE) {
      throw new Error(`Wavetable must be exactly ${WAVETABLE_SIZE} samples`);
    }
    // Clamp values to 0-15 range
    this.wavetable = samples.map(s =>
      Math.max(0, Math.min(WAVETABLE_MAX_VALUE, Math.round(s)))
    );
  }

  /**
   * Create a PeriodicWave from the wavetable using DFT
   */
  private createWavetableWave(): PeriodicWave {
    const size = WAVETABLE_SIZE;
    const real = new Float32Array(size);
    const imag = new Float32Array(size);

    // Normalize samples from 0-15 to -1 to 1
    const normalized = this.wavetable.map(s => (s / 7.5) - 1);

    // Discrete Fourier Transform to get frequency components
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
    // Stop any existing oscillator (only if not already stopped)
    if (this._oscillator && !this._oscillatorStopped) {
      this._oscillator.stop(time);
    }

    this._oscillator = this.context.createOscillator();
    this._oscillatorStopped = false;
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
    if (this._oscillator && !this._oscillatorStopped) {
      this._oscillator.stop(time);
      this._oscillatorStopped = true;
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

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this._oscillator) {
      if (!this._oscillatorStopped) {
        this._oscillator.stop();
        this._oscillatorStopped = true;
      }
      this._oscillator.disconnect();
      this._oscillator = null;
    }
    this.gainNode.disconnect();
  }
}
