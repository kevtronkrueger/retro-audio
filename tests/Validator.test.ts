/**
 * Tests for JSON validation
 */

import { describe, it, expect } from 'vitest';
import { Validator } from '../src/loader/Validator';

describe('Validator', () => {
  const validator = new Validator();

  describe('validateInstrument', () => {
    const validPulseInstrument = {
      id: 'test-pulse',
      name: 'Test Pulse',
      channel: 'pulse1',
      waveform: { type: 'pulse', duty: 0.5 },
      envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 },
      volume: 0.8,
    };

    it('validates a correct pulse instrument', () => {
      const result = validator.validateInstrument(validPulseInstrument);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('validates a correct wave instrument', () => {
      const instrument = {
        id: 'test-wave',
        name: 'Test Wave',
        channel: 'wave',
        waveform: { type: 'triangle' },
        envelope: { attack: 0, decay: 0, sustain: 1, release: 0.1 },
        volume: 1,
      };
      const result = validator.validateInstrument(instrument);
      expect(result.valid).toBe(true);
    });

    it('validates a correct noise instrument', () => {
      const instrument = {
        id: 'test-noise',
        name: 'Test Noise',
        channel: 'noise',
        waveform: { type: 'noise', mode: 'long' },
        envelope: { attack: 0, decay: 0.5, sustain: 0, release: 0.1 },
        volume: 0.5,
      };
      const result = validator.validateInstrument(instrument);
      expect(result.valid).toBe(true);
    });

    it('rejects missing id', () => {
      const instrument = { ...validPulseInstrument, id: '' };
      const result = validator.validateInstrument(instrument);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('id'))).toBe(true);
    });

    it('rejects invalid channel type', () => {
      const instrument = { ...validPulseInstrument, channel: 'invalid' };
      const result = validator.validateInstrument(instrument);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('channel'))).toBe(true);
    });

    it('rejects invalid volume', () => {
      const instrument = { ...validPulseInstrument, volume: 1.5 };
      const result = validator.validateInstrument(instrument);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('volume'))).toBe(true);
    });

    it('rejects mismatched waveform type', () => {
      const instrument = {
        ...validPulseInstrument,
        channel: 'pulse1',
        waveform: { type: 'triangle' }, // Wrong for pulse channel
      };
      const result = validator.validateInstrument(instrument);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid duty cycle', () => {
      const instrument = {
        ...validPulseInstrument,
        waveform: { type: 'pulse', duty: 0.3 }, // Invalid duty
      };
      const result = validator.validateInstrument(instrument);
      expect(result.valid).toBe(false);
    });

    it('validates custom wavetable', () => {
      const wavetable = Array(32).fill(8);
      const instrument = {
        id: 'custom-wave',
        name: 'Custom Wave',
        channel: 'wave',
        waveform: { type: 'custom', wavetable },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 },
        volume: 0.8,
      };
      const result = validator.validateInstrument(instrument);
      expect(result.valid).toBe(true);
    });

    it('rejects invalid wavetable size', () => {
      const wavetable = Array(16).fill(8); // Wrong size
      const instrument = {
        id: 'custom-wave',
        name: 'Custom Wave',
        channel: 'wave',
        waveform: { type: 'custom', wavetable },
        envelope: { attack: 0.01, decay: 0.1, sustain: 0.5, release: 0.2 },
        volume: 0.8,
      };
      const result = validator.validateInstrument(instrument);
      expect(result.valid).toBe(false);
    });
  });

  describe('validatePattern', () => {
    const validPattern = {
      id: 'test-pattern',
      name: 'Test Pattern',
      steps: 16,
      stepsPerBeat: 4,
      channels: {
        pulse1: [],
        pulse2: [],
        wave: [],
        noise: [],
      },
    };

    it('validates a correct pattern', () => {
      const result = validator.validatePattern(validPattern);
      expect(result.valid).toBe(true);
    });

    it('rejects missing channels', () => {
      const pattern = { ...validPattern, channels: {} };
      const result = validator.validatePattern(pattern);
      expect(result.valid).toBe(false);
    });

    it('rejects invalid steps', () => {
      const pattern = { ...validPattern, steps: 0 };
      const result = validator.validatePattern(pattern);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateSfx', () => {
    const validSfx = {
      version: '1.0',
      type: 'sfx',
      name: 'Test SFX',
      instrument: {
        id: 'sfx-inst',
        name: 'SFX Instrument',
        channel: 'pulse1',
        waveform: { type: 'pulse', duty: 0.5 },
        envelope: { attack: 0, decay: 0.1, sustain: 0, release: 0.1 },
        volume: 1,
      },
      note: 'C4',
      duration: 0.5,
    };

    it('validates a correct SFX', () => {
      const result = validator.validateSfx(validSfx);
      expect(result.valid).toBe(true);
    });

    it('rejects wrong version', () => {
      const sfx = { ...validSfx, version: '2.0' };
      const result = validator.validateSfx(sfx);
      expect(result.valid).toBe(false);
    });

    it('rejects wrong type', () => {
      const sfx = { ...validSfx, type: 'song' };
      const result = validator.validateSfx(sfx);
      expect(result.valid).toBe(false);
    });
  });
});
