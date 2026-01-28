/**
 * Oscillator - Wrapper for OscillatorNode with waveform generation
 *
 * Provides higher-level interface for creating and managing oscillators
 * with support for pulse waves and custom waveforms.
 */

import type { WaveformConfig, PulseWaveformConfig, WaveWaveformConfig } from '../types';
import { PULSE_HARMONICS, WAVETABLE_SIZE } from '../utils/constants';

export class Oscillator {
  private context: AudioContext;
  private _oscillator: OscillatorNode | null = null;
  private waveformConfig: WaveformConfig;

  constructor(context: AudioContext, config: WaveformConfig) {
    this.context = context;
    this.waveformConfig = config;
  }

  /**
   * Create and start an oscillator
   * @param frequency - Frequency in Hz
   * @param destination - AudioNode to connect to
   * @param startTime - When to start
   * @returns The created OscillatorNode
   */
  start(frequency: number, destination: AudioNode, startTime: number): OscillatorNode {
    this._oscillator = this.context.createOscillator();
    this._oscillator.frequency.value = frequency;

    this.applyWaveform(this._oscillator);

    this._oscillator.connect(destination);
    this._oscillator.start(startTime);

    return this._oscillator;
  }

  /**
   * Stop the oscillator
   * @param time - When to stop
   */
  stop(time: number): void {
    if (this._oscillator) {
      try {
        this._oscillator.stop(time);
      } catch {
        // Oscillator may already be stopped
      }
      this._oscillator = null;
    }
  }

  /**
   * Apply the configured waveform to an oscillator
   */
  private applyWaveform(oscillator: OscillatorNode): void {
    switch (this.waveformConfig.type) {
      case 'pulse':
        oscillator.setPeriodicWave(
          this.createPulseWave((this.waveformConfig as PulseWaveformConfig).duty ?? 0.5)
        );
        break;
      case 'triangle':
        oscillator.type = 'triangle';
        break;
      case 'sawtooth':
        oscillator.type = 'sawtooth';
        break;
      case 'custom': {
        const config = this.waveformConfig as WaveWaveformConfig;
        if (config.wavetable) {
          oscillator.setPeriodicWave(this.createWavetableWave(config.wavetable));
        } else {
          oscillator.type = 'sine'; // Fallback
        }
        break;
      }
      case 'noise':
        // Noise is handled by NoiseChannel, not oscillator
        throw new Error('Noise waveform should use NoiseChannel, not Oscillator');
    }
  }

  /**
   * Create a pulse wave PeriodicWave
   */
  private createPulseWave(duty: number): PeriodicWave {
    const real = new Float32Array(PULSE_HARMONICS);
    const imag = new Float32Array(PULSE_HARMONICS);

    real[0] = 0;
    imag[0] = 0;

    for (let n = 1; n < PULSE_HARMONICS; n++) {
      imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    }

    return this.context.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  /**
   * Create a wavetable PeriodicWave from samples
   */
  private createWavetableWave(samples: number[]): PeriodicWave {
    const size = WAVETABLE_SIZE;
    const real = new Float32Array(size);
    const imag = new Float32Array(size);

    // Normalize samples from 0-15 to -1 to 1
    const normalized = samples.map(s => (s / 7.5) - 1);

    // DFT
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

  /**
   * Update waveform configuration
   */
  setWaveform(config: WaveformConfig): void {
    this.waveformConfig = config;
    if (this._oscillator) {
      this.applyWaveform(this._oscillator);
    }
  }

  /**
   * Get current waveform config
   */
  getWaveform(): WaveformConfig {
    return this.waveformConfig;
  }

  /**
   * Get the underlying oscillator node
   */
  get oscillator(): OscillatorNode | null {
    return this._oscillator;
  }

  /**
   * Get frequency AudioParam
   */
  get frequencyParam(): AudioParam | null {
    return this._oscillator?.frequency ?? null;
  }

  /**
   * Get detune AudioParam
   */
  get detuneParam(): AudioParam | null {
    return this._oscillator?.detune ?? null;
  }
}
