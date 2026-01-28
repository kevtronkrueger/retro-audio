/**
 * Validator - Schema validation for JSON data
 *
 * Validates instrument, pattern, song, and SFX definitions against
 * the expected schema.
 */

import type { ChannelType } from '../types';
import { WAVETABLE_SIZE, PULSE_DUTY_CYCLES } from '../utils/constants';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export class Validator {
  /**
   * Validate an instrument definition
   */
  validateInstrument(data: unknown): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Instrument must be an object'] };
    }

    const inst = data as Record<string, unknown>;

    // Required fields
    if (typeof inst.id !== 'string' || inst.id.length === 0) {
      errors.push('Instrument must have a non-empty string id');
    }
    if (typeof inst.name !== 'string') {
      errors.push('Instrument must have a string name');
    }
    if (!this.isValidChannelType(inst.channel)) {
      errors.push(`Invalid channel type: ${inst.channel}. Must be pulse1, pulse2, wave, or noise`);
    }
    if (typeof inst.volume !== 'number' || inst.volume < 0 || inst.volume > 1) {
      errors.push('Instrument volume must be a number between 0 and 1');
    }

    // Validate waveform
    const waveformErrors = this.validateWaveform(inst.waveform, inst.channel as ChannelType);
    errors.push(...waveformErrors);

    // Validate envelope
    const envelopeErrors = this.validateEnvelope(inst.envelope);
    errors.push(...envelopeErrors);

    // Optional pitch config
    if (inst.pitch !== undefined) {
      const pitchErrors = this.validatePitchConfig(inst.pitch);
      errors.push(...pitchErrors);
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate a waveform configuration
   */
  private validateWaveform(waveform: unknown, channelType: ChannelType): string[] {
    const errors: string[] = [];

    if (!waveform || typeof waveform !== 'object') {
      errors.push('Waveform must be an object');
      return errors;
    }

    const wf = waveform as Record<string, unknown>;

    // Validate waveform type matches channel
    switch (channelType) {
      case 'pulse1':
      case 'pulse2':
        if (wf.type !== 'pulse') {
          errors.push(`Pulse channels require waveform type 'pulse', got '${wf.type}'`);
        }
        if (wf.duty !== undefined && !PULSE_DUTY_CYCLES.includes(wf.duty as 0.125 | 0.25 | 0.5 | 0.75)) {
          errors.push(`Invalid duty cycle: ${wf.duty}. Must be 0.125, 0.25, 0.5, or 0.75`);
        }
        break;

      case 'wave':
        if (!['triangle', 'sawtooth', 'custom'].includes(wf.type as string)) {
          errors.push(`Wave channel requires waveform type triangle, sawtooth, or custom, got '${wf.type}'`);
        }
        if (wf.type === 'custom') {
          if (!Array.isArray(wf.wavetable)) {
            errors.push('Custom waveform requires wavetable array');
          } else if (wf.wavetable.length !== WAVETABLE_SIZE) {
            errors.push(`Wavetable must have exactly ${WAVETABLE_SIZE} samples, got ${wf.wavetable.length}`);
          } else {
            for (let i = 0; i < wf.wavetable.length; i++) {
              const sample = wf.wavetable[i];
              if (typeof sample !== 'number' || sample < 0 || sample > 15) {
                errors.push(`Wavetable sample at index ${i} must be a number between 0 and 15`);
              }
            }
          }
        }
        break;

      case 'noise':
        if (wf.type !== 'noise') {
          errors.push(`Noise channel requires waveform type 'noise', got '${wf.type}'`);
        }
        if (wf.mode !== undefined && !['long', 'short'].includes(wf.mode as string)) {
          errors.push(`Invalid noise mode: ${wf.mode}. Must be 'long' or 'short'`);
        }
        break;
    }

    return errors;
  }

  /**
   * Validate envelope configuration
   */
  private validateEnvelope(envelope: unknown): string[] {
    const errors: string[] = [];

    if (!envelope || typeof envelope !== 'object') {
      errors.push('Envelope must be an object');
      return errors;
    }

    const env = envelope as Record<string, unknown>;

    // Required ADSR values
    const timeParams = ['attack', 'decay', 'release'] as const;
    for (const param of timeParams) {
      if (typeof env[param] !== 'number' || env[param] < 0 || env[param] > 5) {
        errors.push(`Envelope ${param} must be a number between 0 and 5 seconds`);
      }
    }

    if (typeof env.sustain !== 'number' || env.sustain < 0 || env.sustain > 1) {
      errors.push('Envelope sustain must be a number between 0 and 1');
    }

    // Optional curve types
    const curveParams = ['attackCurve', 'decayCurve', 'releaseCurve'] as const;
    for (const param of curveParams) {
      if (env[param] !== undefined && !['linear', 'exponential'].includes(env[param] as string)) {
        errors.push(`Invalid ${param}: must be 'linear' or 'exponential'`);
      }
    }

    return errors;
  }

  /**
   * Validate pitch configuration
   */
  private validatePitchConfig(pitch: unknown): string[] {
    const errors: string[] = [];

    if (typeof pitch !== 'object') {
      errors.push('Pitch config must be an object');
      return errors;
    }

    const p = pitch as Record<string, unknown>;

    if (p.slide !== undefined && typeof p.slide !== 'number') {
      errors.push('Pitch slide must be a number (semitones)');
    }
    if (p.slideTime !== undefined && (typeof p.slideTime !== 'number' || p.slideTime < 0)) {
      errors.push('Pitch slideTime must be a positive number');
    }
    if (p.vibratoDepth !== undefined && (typeof p.vibratoDepth !== 'number' || p.vibratoDepth < 0 || p.vibratoDepth > 2)) {
      errors.push('Vibrato depth must be between 0 and 2 semitones');
    }
    if (p.vibratoSpeed !== undefined && (typeof p.vibratoSpeed !== 'number' || p.vibratoSpeed < 0 || p.vibratoSpeed > 20)) {
      errors.push('Vibrato speed must be between 0 and 20 Hz');
    }
    if (p.arpeggio !== undefined) {
      if (!Array.isArray(p.arpeggio)) {
        errors.push('Arpeggio must be an array of semitone offsets');
      } else if (!p.arpeggio.every(n => typeof n === 'number')) {
        errors.push('Arpeggio offsets must all be numbers');
      }
    }
    if (p.arpeggioSpeed !== undefined && (typeof p.arpeggioSpeed !== 'number' || p.arpeggioSpeed <= 0)) {
      errors.push('Arpeggio speed must be a positive number');
    }

    return errors;
  }

  /**
   * Validate a pattern definition
   */
  validatePattern(data: unknown): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Pattern must be an object'] };
    }

    const pattern = data as Record<string, unknown>;

    if (typeof pattern.id !== 'string' || pattern.id.length === 0) {
      errors.push('Pattern must have a non-empty string id');
    }
    if (typeof pattern.name !== 'string') {
      errors.push('Pattern must have a string name');
    }
    if (typeof pattern.steps !== 'number' || pattern.steps <= 0) {
      errors.push('Pattern steps must be a positive number');
    }
    if (typeof pattern.stepsPerBeat !== 'number' || pattern.stepsPerBeat <= 0) {
      errors.push('Pattern stepsPerBeat must be a positive number');
    }

    // Validate channels
    if (!pattern.channels || typeof pattern.channels !== 'object') {
      errors.push('Pattern must have a channels object');
    } else {
      const channels = pattern.channels as Record<string, unknown>;
      for (const channelName of ['pulse1', 'pulse2', 'wave', 'noise']) {
        if (!Array.isArray(channels[channelName])) {
          errors.push(`Pattern channels.${channelName} must be an array`);
        }
        // Could add more detailed note event validation here
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate a song definition
   */
  validateSong(data: unknown): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['Song must be an object'] };
    }

    const song = data as Record<string, unknown>;

    if (song.version !== '1.0') {
      errors.push(`Invalid song version: ${song.version}. Expected '1.0'`);
    }
    if (song.type !== 'song') {
      errors.push(`Invalid type: ${song.type}. Expected 'song'`);
    }
    if (typeof song.name !== 'string') {
      errors.push('Song must have a string name');
    }
    if (typeof song.bpm !== 'number' || song.bpm < 30 || song.bpm > 300) {
      errors.push('Song BPM must be between 30 and 300');
    }

    // Validate instruments array
    if (!Array.isArray(song.instruments)) {
      errors.push('Song must have an instruments array');
    } else {
      for (let i = 0; i < song.instruments.length; i++) {
        const result = this.validateInstrument(song.instruments[i]);
        if (!result.valid) {
          errors.push(`Instrument ${i}: ${result.errors.join(', ')}`);
        }
      }
    }

    // Validate patterns array
    if (!Array.isArray(song.patterns)) {
      errors.push('Song must have a patterns array');
    } else {
      for (let i = 0; i < song.patterns.length; i++) {
        const result = this.validatePattern(song.patterns[i]);
        if (!result.valid) {
          errors.push(`Pattern ${i}: ${result.errors.join(', ')}`);
        }
      }
    }

    // Validate sequence
    if (!Array.isArray(song.sequence)) {
      errors.push('Song must have a sequence array');
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Validate an SFX definition
   */
  validateSfx(data: unknown): ValidationResult {
    const errors: string[] = [];

    if (!data || typeof data !== 'object') {
      return { valid: false, errors: ['SFX must be an object'] };
    }

    const sfx = data as Record<string, unknown>;

    if (sfx.version !== '1.0') {
      errors.push(`Invalid SFX version: ${sfx.version}. Expected '1.0'`);
    }
    if (sfx.type !== 'sfx') {
      errors.push(`Invalid type: ${sfx.type}. Expected 'sfx'`);
    }
    if (typeof sfx.name !== 'string') {
      errors.push('SFX must have a string name');
    }

    // Validate embedded instrument
    const instrumentResult = this.validateInstrument(sfx.instrument);
    if (!instrumentResult.valid) {
      errors.push(`Instrument: ${instrumentResult.errors.join(', ')}`);
    }

    // Optional fields
    if (sfx.note !== undefined && typeof sfx.note !== 'string') {
      errors.push('SFX note must be a string');
    }
    if (sfx.duration !== undefined && (typeof sfx.duration !== 'number' || sfx.duration < 0)) {
      errors.push('SFX duration must be a positive number');
    }

    return { valid: errors.length === 0, errors };
  }

  private isValidChannelType(type: unknown): type is ChannelType {
    return ['pulse1', 'pulse2', 'wave', 'noise'].includes(type as string);
  }
}
