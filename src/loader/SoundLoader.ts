/**
 * SoundLoader - JSON parsing and validation
 *
 * Loads and validates sound definitions from JSON.
 */

import type { InstrumentData, PatternData, SongData, SfxData } from '../types';
import { Validator, ValidationResult } from './Validator';

export interface LoadResult<T> {
  success: boolean;
  data?: T;
  errors?: string[];
}

export class SoundLoader {
  private validator: Validator;

  constructor() {
    this.validator = new Validator();
  }

  /**
   * Parse and validate a JSON string
   */
  private parseJson(json: string): LoadResult<unknown> {
    try {
      const data = JSON.parse(json);
      return { success: true, data };
    } catch (error) {
      return {
        success: false,
        errors: [`Invalid JSON: ${error instanceof Error ? error.message : 'Unknown error'}`],
      };
    }
  }

  /**
   * Load an instrument from JSON
   */
  loadInstrument(json: string): LoadResult<InstrumentData> {
    const parseResult = this.parseJson(json);
    if (!parseResult.success) {
      return parseResult as LoadResult<InstrumentData>;
    }

    const validation = this.validator.validateInstrument(parseResult.data);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    return { success: true, data: parseResult.data as InstrumentData };
  }

  /**
   * Load instruments from JSON array
   */
  loadInstruments(json: string): LoadResult<InstrumentData[]> {
    const parseResult = this.parseJson(json);
    if (!parseResult.success) {
      return parseResult as LoadResult<InstrumentData[]>;
    }

    if (!Array.isArray(parseResult.data)) {
      return { success: false, errors: ['Expected an array of instruments'] };
    }

    const instruments: InstrumentData[] = [];
    const errors: string[] = [];

    for (let i = 0; i < parseResult.data.length; i++) {
      const validation = this.validator.validateInstrument(parseResult.data[i]);
      if (!validation.valid) {
        errors.push(`Instrument ${i}: ${validation.errors.join(', ')}`);
      } else {
        instruments.push(parseResult.data[i] as InstrumentData);
      }
    }

    if (errors.length > 0) {
      return { success: false, errors };
    }

    return { success: true, data: instruments };
  }

  /**
   * Load a pattern from JSON
   */
  loadPattern(json: string): LoadResult<PatternData> {
    const parseResult = this.parseJson(json);
    if (!parseResult.success) {
      return parseResult as LoadResult<PatternData>;
    }

    const validation = this.validator.validatePattern(parseResult.data);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    return { success: true, data: parseResult.data as PatternData };
  }

  /**
   * Load a song from JSON
   */
  loadSong(json: string): LoadResult<SongData> {
    const parseResult = this.parseJson(json);
    if (!parseResult.success) {
      return parseResult as LoadResult<SongData>;
    }

    const validation = this.validator.validateSong(parseResult.data);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    return { success: true, data: parseResult.data as SongData };
  }

  /**
   * Load an SFX from JSON
   */
  loadSfx(json: string): LoadResult<SfxData> {
    const parseResult = this.parseJson(json);
    if (!parseResult.success) {
      return parseResult as LoadResult<SfxData>;
    }

    const validation = this.validator.validateSfx(parseResult.data);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    return { success: true, data: parseResult.data as SfxData };
  }

  /**
   * Load from JSON and auto-detect type
   */
  loadAuto(json: string): LoadResult<SongData | SfxData | InstrumentData | InstrumentData[] | PatternData> {
    const parseResult = this.parseJson(json);
    if (!parseResult.success) {
      return { success: false, errors: parseResult.errors };
    }

    const data = parseResult.data as Record<string, unknown>;

    // Check for type field
    if (data.type === 'song') {
      return this.loadSong(json);
    }
    if (data.type === 'sfx') {
      return this.loadSfx(json);
    }
    if (data.type === 'project') {
      // Return the project data - caller can extract what they need
      return {
        success: true,
        data: data as unknown as SongData,
        errors: ['Project files should be processed by the composition tool'],
      };
    }

    // Check if it's an array (instruments or patterns)
    if (Array.isArray(parseResult.data)) {
      const arrData = parseResult.data as Record<string, unknown>[];
      // Try to determine type from first element
      if (arrData.length > 0 && arrData[0].channel) {
        return this.loadInstruments(json);
      }
      if (arrData.length > 0 && arrData[0].steps !== undefined) {
        // Likely patterns - validate first
        const patternResult = this.validator.validatePattern(arrData[0]);
        if (patternResult.valid) {
          return { success: true, data: arrData[0] as unknown as PatternData };
        }
      }
    }

    // Check if it's a single instrument
    if (data.channel && data.envelope) {
      return this.loadInstrument(json);
    }

    // Check if it's a pattern
    if (data.steps && data.channels) {
      return this.loadPattern(json);
    }

    return {
      success: false,
      errors: ['Could not determine data type. Add a "type" field or ensure correct structure.'],
    };
  }

  /**
   * Validate data without loading
   */
  validate(data: unknown, type: 'instrument' | 'pattern' | 'song' | 'sfx'): ValidationResult {
    switch (type) {
      case 'instrument':
        return this.validator.validateInstrument(data);
      case 'pattern':
        return this.validator.validatePattern(data);
      case 'song':
        return this.validator.validateSong(data);
      case 'sfx':
        return this.validator.validateSfx(data);
    }
  }

  /**
   * Get the validator instance for direct validation
   */
  getValidator(): Validator {
    return this.validator;
  }
}
