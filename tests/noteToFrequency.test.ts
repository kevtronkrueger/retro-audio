/**
 * Tests for note to frequency conversion
 */

import { describe, it, expect } from 'vitest';
import {
  noteToFrequency,
  frequencyToNote,
  midiToFrequency,
  frequencyToMidi,
  semitonesToRatio,
  centsToRatio,
} from '../src/utils/noteToFrequency';

describe('noteToFrequency', () => {
  it('converts A4 to 440 Hz', () => {
    expect(noteToFrequency('A4')).toBeCloseTo(440, 2);
  });

  it('converts C4 (middle C) correctly', () => {
    expect(noteToFrequency('C4')).toBeCloseTo(261.63, 1);
  });

  it('handles sharps', () => {
    expect(noteToFrequency('C#4')).toBeCloseTo(277.18, 1);
    expect(noteToFrequency('F#4')).toBeCloseTo(369.99, 1);
  });

  it('handles flats', () => {
    expect(noteToFrequency('Db4')).toBeCloseTo(277.18, 1);
    expect(noteToFrequency('Bb4')).toBeCloseTo(466.16, 1);
  });

  it('handles different octaves', () => {
    const c3 = noteToFrequency('C3');
    const c4 = noteToFrequency('C4');
    const c5 = noteToFrequency('C5');

    expect(c4 / c3).toBeCloseTo(2, 2); // Octave = 2x frequency
    expect(c5 / c4).toBeCloseTo(2, 2);
  });

  it('handles case-insensitive note names', () => {
    expect(noteToFrequency('a4')).toBeCloseTo(440, 2);
    expect(noteToFrequency('c4')).toBeCloseTo(261.63, 1);
  });

  it('handles negative octaves', () => {
    expect(noteToFrequency('A-1')).toBeCloseTo(13.75, 2);
  });

  it('throws on invalid note', () => {
    expect(() => noteToFrequency('X4')).toThrow();
    expect(() => noteToFrequency('C')).toThrow();
    expect(() => noteToFrequency('')).toThrow();
    expect(() => noteToFrequency('CC4')).toThrow();
  });
});

describe('frequencyToNote', () => {
  it('converts 440 Hz to A4', () => {
    expect(frequencyToNote(440)).toBe('A4');
  });

  it('converts middle C frequency to C4', () => {
    expect(frequencyToNote(261.63)).toBe('C4');
  });

  it('rounds to nearest note', () => {
    expect(frequencyToNote(442)).toBe('A4'); // Slightly sharp A
    expect(frequencyToNote(438)).toBe('A4'); // Slightly flat A
  });
});

describe('midiToFrequency', () => {
  it('converts MIDI 69 (A4) to 440 Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 2);
  });

  it('converts MIDI 60 (C4) correctly', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.63, 1);
  });

  it('handles octave relationship', () => {
    const midi60 = midiToFrequency(60);
    const midi72 = midiToFrequency(72); // C4 to C5

    expect(midi72 / midi60).toBeCloseTo(2, 2);
  });
});

describe('frequencyToMidi', () => {
  it('converts 440 Hz to MIDI 69', () => {
    expect(Math.round(frequencyToMidi(440))).toBe(69);
  });

  it('converts middle C to MIDI 60', () => {
    expect(Math.round(frequencyToMidi(261.63))).toBe(60);
  });
});

describe('semitonesToRatio', () => {
  it('octave (12 semitones) equals 2x frequency', () => {
    expect(semitonesToRatio(12)).toBeCloseTo(2, 5);
  });

  it('fifth (7 semitones) equals ~1.5x frequency', () => {
    expect(semitonesToRatio(7)).toBeCloseTo(1.4983, 3);
  });

  it('negative semitones divide frequency', () => {
    expect(semitonesToRatio(-12)).toBeCloseTo(0.5, 5);
  });

  it('zero semitones equals no change', () => {
    expect(semitonesToRatio(0)).toBe(1);
  });
});

describe('centsToRatio', () => {
  it('1200 cents (octave) equals 2x', () => {
    expect(centsToRatio(1200)).toBeCloseTo(2, 5);
  });

  it('100 cents (semitone) matches semitonesToRatio', () => {
    expect(centsToRatio(100)).toBeCloseTo(semitonesToRatio(1), 5);
  });

  it('50 cents is quarter tone', () => {
    expect(centsToRatio(50)).toBeCloseTo(1.0293, 3);
  });
});
