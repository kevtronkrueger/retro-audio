/**
 * NoiseGenerator - LFSR implementation for noise
 *
 * Generates noise buffers using Linear Feedback Shift Register algorithm.
 * Supports both long (15-bit) and short (7-bit) modes.
 */

import { LFSR_LONG_LENGTH, LFSR_SHORT_LENGTH } from '../utils/constants';

export type NoiseMode = 'long' | 'short';

export interface NoiseBuffers {
  long: AudioBuffer;
  short: AudioBuffer;
}

export class NoiseGenerator {
  private context: AudioContext;
  private buffers: NoiseBuffers | null = null;

  constructor(context: AudioContext) {
    this.context = context;
  }

  /**
   * Generate and cache noise buffers for both modes
   */
  generateBuffers(): NoiseBuffers {
    if (this.buffers) {
      return this.buffers;
    }

    this.buffers = {
      long: this.generateLFSRBuffer(LFSR_LONG_LENGTH, 15),
      short: this.generateLFSRBuffer(LFSR_SHORT_LENGTH, 7),
    };

    return this.buffers;
  }

  /**
   * Get the noise buffer for a specific mode
   */
  getBuffer(mode: NoiseMode): AudioBuffer {
    const buffers = this.generateBuffers();
    return mode === 'long' ? buffers.long : buffers.short;
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
    // Initialize with all 1s
    let lfsr = (1 << bits) - 1;

    // Tap positions for XOR feedback (Game Boy style)
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
   * Create a buffer source node for playback
   */
  createSource(mode: NoiseMode): AudioBufferSourceNode {
    const buffer = this.getBuffer(mode);
    const source = this.context.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    return source;
  }

  /**
   * Calculate the base playback rate for a given frequency
   */
  getPlaybackRate(frequency: number, mode: NoiseMode): number {
    const buffer = this.getBuffer(mode);
    const baseRate = buffer.sampleRate / buffer.length;
    return frequency / baseRate;
  }

  /**
   * Generate white noise (random values)
   * Not LFSR-based, just random for comparison
   */
  generateWhiteNoise(length: number): AudioBuffer {
    const buffer = this.context.createBuffer(1, length, this.context.sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    return buffer;
  }

  /**
   * Clear cached buffers
   */
  dispose(): void {
    this.buffers = null;
  }
}
