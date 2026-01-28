/**
 * PulseChannel - Pulse wave (square with variable duty cycle)
 *
 * Game Boy pulse waves have 4 duty cycles: 12.5%, 25%, 50% (square), 75%
 * Implemented using PeriodicWave for accurate waveform generation.
 */

import type { Channel } from './Channel';
import { PULSE_HARMONICS } from '../utils/constants';

export class PulseChannel implements Channel {
  private context: AudioContext;
  private _oscillator: OscillatorNode | null = null;
  private gainNode: GainNode;
  private duty: number = 0.5; // Default 50% duty = square wave

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.gainNode = context.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(destination);
  }

  /**
   * Create a pulse wave using PeriodicWave (Fourier series)
   * @param duty - Duty cycle (0.125, 0.25, 0.5, 0.75)
   */
  private createPulseWave(duty: number): PeriodicWave {
    // Fourier series coefficients for pulse wave
    const real = new Float32Array(PULSE_HARMONICS);
    const imag = new Float32Array(PULSE_HARMONICS);

    real[0] = 0;
    imag[0] = 0;

    for (let n = 1; n < PULSE_HARMONICS; n++) {
      // Pulse wave Fourier series:
      // b_n = (2 / (n * PI)) * sin(n * PI * duty)
      imag[n] = (2 / (n * Math.PI)) * Math.sin(n * Math.PI * duty);
    }

    return this.context.createPeriodicWave(real, imag, { disableNormalization: false });
  }

  /**
   * Set the duty cycle
   * @param duty - Duty cycle (0.125, 0.25, 0.5, 0.75)
   */
  setDuty(duty: number): void {
    this.duty = duty;
    if (this._oscillator) {
      this._oscillator.setPeriodicWave(this.createPulseWave(duty));
    }
  }

  /**
   * Get current duty cycle
   */
  getDuty(): number {
    return this.duty;
  }

  noteOn(frequency: number, time: number): void {
    // Stop any existing oscillator
    if (this._oscillator) {
      try {
        this._oscillator.stop(time);
      } catch {
        // Oscillator may already be stopped
      }
    }

    this._oscillator = this.context.createOscillator();
    this._oscillator.setPeriodicWave(this.createPulseWave(this.duty));
    this._oscillator.frequency.value = frequency;
    this._oscillator.connect(this.gainNode);
    this._oscillator.start(time);
  }

  noteOff(time: number): void {
    if (this._oscillator) {
      try {
        this._oscillator.stop(time);
      } catch {
        // Oscillator may already be stopped
      }
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

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this._oscillator) {
      try {
        this._oscillator.stop();
        this._oscillator.disconnect();
      } catch {
        // Ignore errors
      }
      this._oscillator = null;
    }
    this.gainNode.disconnect();
  }
}
