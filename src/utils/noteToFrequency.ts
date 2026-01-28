/**
 * Note to frequency conversion utilities
 */

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const A4_FREQUENCY = 440;
const A4_MIDI = 69;

/**
 * Convert a note name to frequency in Hz
 * @param note - Note name like "C4", "D#5", "Gb3"
 * @returns Frequency in Hz
 * @throws Error if note format is invalid
 */
export function noteToFrequency(note: string): number {
  // Parse note name like "C4", "D#5", "Gb3"
  const match = note.match(/^([A-G])([#b]?)(-?\d+)$/i);
  if (!match) {
    throw new Error(`Invalid note: ${note}. Expected format like "C4", "D#5", "Gb3".`);
  }

  const [, noteName, accidental, octaveStr] = match;
  let octave = parseInt(octaveStr, 10);

  // Find base note index
  let noteIndex = NOTE_NAMES.indexOf(noteName.toUpperCase());
  if (noteIndex === -1) {
    throw new Error(`Invalid note name: ${noteName}`);
  }

  // Apply accidental
  if (accidental === '#') noteIndex++;
  else if (accidental.toLowerCase() === 'b') noteIndex--;

  // Handle wrap-around for enharmonic equivalents (Cb, B#)
  // Cb4 -> B3, B#4 -> C5
  if (noteIndex < 0) {
    noteIndex += 12;
    octave -= 1;
  }
  if (noteIndex >= 12) {
    noteIndex -= 12;
    octave += 1;
  }

  // Calculate MIDI note number
  const midi = (octave + 1) * 12 + noteIndex;

  // Convert to frequency using equal temperament
  return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Convert frequency in Hz to the nearest note name
 * @param frequency - Frequency in Hz
 * @returns Note name like "C4", "D#5"
 */
export function frequencyToNote(frequency: number): string {
  // Convert frequency to nearest MIDI note
  const midi = Math.round(12 * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI);
  const octave = Math.floor(midi / 12) - 1;
  const noteIndex = ((midi % 12) + 12) % 12; // Handle negative modulo
  return NOTE_NAMES[noteIndex] + octave;
}

/**
 * Convert MIDI note number to frequency
 * @param midi - MIDI note number (0-127)
 * @returns Frequency in Hz
 */
export function midiToFrequency(midi: number): number {
  return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Convert frequency to MIDI note number
 * @param frequency - Frequency in Hz
 * @returns MIDI note number
 */
export function frequencyToMidi(frequency: number): number {
  return 12 * Math.log2(frequency / A4_FREQUENCY) + A4_MIDI;
}

/**
 * Calculate the frequency ratio for a given number of semitones
 * @param semitones - Number of semitones (can be fractional)
 * @returns Frequency multiplier
 */
export function semitonesToRatio(semitones: number): number {
  return Math.pow(2, semitones / 12);
}

/**
 * Convert cents to frequency ratio
 * @param cents - Cents (100 cents = 1 semitone)
 * @returns Frequency multiplier
 */
export function centsToRatio(cents: number): number {
  return Math.pow(2, cents / 1200);
}
