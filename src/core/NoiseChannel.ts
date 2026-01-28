/**
 * NoiseChannel - LFSR noise generator
 *
 * Game Boy noise uses a Linear Feedback Shift Register (LFSR):
 * - Long mode: 15-bit LFSR (32767 samples before repeat)
 * - Short mode: 7-bit LFSR (127 samples - more tonal/metallic)
 *
 * The note parameter controls the LFSR clock rate - higher notes produce
 * higher-pitched noise.
 */

import type { Channel } from './Channel';
import { LFSR_LONG_LENGTH, LFSR_SHORT_LENGTH } from '../utils/constants';

export class NoiseChannel implements Channel {
  private context: AudioContext;
  private bufferSource: AudioBufferSourceNode | null = null;
  private gainNode: GainNode;
  private noiseBufferLong: AudioBuffer | null = null;
  private noiseBufferShort: AudioBuffer | null = null;
  private mode: 'long' | 'short' = 'long';

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;
    this.gainNode = context.createGain();
    this.gainNode.gain.value = 0;
    this.gainNode.connect(destination);

    // Pre-generate both noise buffers
    this.generateNoiseBuffers();
  }

  /**
   * Generate LFSR noise buffers for both modes
   */
  private generateNoiseBuffers(): void {
    this.noiseBufferLong = this.generateLFSRBuffer(LFSR_LONG_LENGTH, 15);
    this.noiseBufferShort = this.generateLFSRBuffer(LFSR_SHORT_LENGTH, 7);
  }

  /**
   * Generate an LFSR-based noise buffer
   * @param length - Buffer length (number of samples)
   * @param bits - LFSR bit width (15 or 7)
   */
  private generateLFSRBuffer(length: number, bits: number): AudioBuffer {
    const sampleRate = this.context.sampleRate;
    const buffer = this.context.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    // LFSR implementation
    // Initialize with all 1s (except bit 0 which we'll shift out)
    let lfsr = (1 << bits) - 1;

    // Tap positions for XOR feedback
    // For 15-bit: taps at 0 and 1 (Game Boy uses this)
    // For 7-bit: taps at 0 and 1
    const tap1 = 0;
    const tap2 = 1;

    for (let i = 0; i < length; i++) {
      // Output is bit 0 - convert to bipolar (-1 or 1)
      data[i] = (lfsr & 1) ? 1 : -1;

      // Feedback: XOR of tap bits
      const bit = ((lfsr >> tap1) ^ (lfsr >> tap2)) & 1;
      // Shift right and insert feedback bit at MSB
      lfsr = (lfsr >> 1) | (bit << (bits - 1));
    }

    return buffer;
  }

  /**
   * Set noise mode
   * @param mode - 'long' for 15-bit LFSR, 'short' for 7-bit (metallic)
   */
  setMode(mode: 'long' | 'short'): void {
    this.mode = mode;
  }

  /**
   * Get current noise mode
   */
  getMode(): 'long' | 'short' {
    return this.mode;
  }

  /**
   * Get the current noise buffer based on mode
   */
  private getCurrentBuffer(): AudioBuffer | null {
    return this.mode === 'long' ? this.noiseBufferLong : this.noiseBufferShort;
  }

  noteOn(frequency: number, time: number): void {
    const buffer = this.getCurrentBuffer();
    if (!buffer) return;

    // Stop any existing source
    if (this.bufferSource) {
      try {
        this.bufferSource.stop(time);
      } catch {
        // Source may already be stopped
      }
    }

    this.bufferSource = this.context.createBufferSource();
    this.bufferSource.buffer = buffer;
    this.bufferSource.loop = true;

    // Frequency affects playback rate
    // Higher frequency = faster LFSR cycling = higher pitched noise
    // Base rate is calculated so that the buffer plays at approximately
    // the intended frequency
    const baseRate = buffer.sampleRate / buffer.length;
    this.bufferSource.playbackRate.value = frequency / baseRate;

    this.bufferSource.connect(this.gainNode);
    this.bufferSource.start(time);
  }

  noteOff(time: number): void {
    if (this.bufferSource) {
      try {
        this.bufferSource.stop(time);
      } catch {
        // Source may already be stopped
      }
      this.bufferSource = null;
    }
  }

  get gain(): AudioParam {
    return this.gainNode.gain;
  }

  /** Noise doesn't have a traditional oscillator - returns null */
  get oscillator(): null {
    return null;
  }

  /** For noise, frequency controls playback rate */
  get frequencyParam(): AudioParam | null {
    return this.bufferSource?.playbackRate ?? null;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    if (this.bufferSource) {
      try {
        this.bufferSource.stop();
        this.bufferSource.disconnect();
      } catch {
        // Ignore errors
      }
      this.bufferSource = null;
    }
    this.gainNode.disconnect();
  }
}
