/**
 * InstrumentBank - Instrument reference management
 *
 * Stores and retrieves instrument definitions by ID for use during
 * pattern and song playback.
 */

import type { InstrumentData } from '../types';

export class InstrumentBank {
  private instruments: Map<string, InstrumentData> = new Map();

  /**
   * Load instruments into the bank
   * @param instruments - Array of instrument definitions
   */
  load(instruments: InstrumentData[]): void {
    for (const instrument of instruments) {
      this.instruments.set(instrument.id, instrument);
    }
  }

  /**
   * Add a single instrument
   * @param instrument - Instrument definition
   */
  add(instrument: InstrumentData): void {
    this.instruments.set(instrument.id, instrument);
  }

  /**
   * Get an instrument by ID
   * @param id - Instrument ID
   * @returns The instrument or undefined if not found
   */
  get(id: string): InstrumentData | undefined {
    return this.instruments.get(id);
  }

  /**
   * Check if an instrument exists
   * @param id - Instrument ID
   */
  has(id: string): boolean {
    return this.instruments.has(id);
  }

  /**
   * Remove an instrument by ID
   * @param id - Instrument ID
   */
  remove(id: string): boolean {
    return this.instruments.delete(id);
  }

  /**
   * Get all instrument IDs
   */
  getIds(): string[] {
    return Array.from(this.instruments.keys());
  }

  /**
   * Get all instruments
   */
  getAll(): InstrumentData[] {
    return Array.from(this.instruments.values());
  }

  /**
   * Get the number of loaded instruments
   */
  get count(): number {
    return this.instruments.size;
  }

  /**
   * Clear all loaded instruments
   */
  clear(): void {
    this.instruments.clear();
  }

  /**
   * Find instruments by channel type
   * @param channel - Channel type to filter by
   */
  findByChannel(channel: InstrumentData['channel']): InstrumentData[] {
    return Array.from(this.instruments.values())
      .filter(inst => inst.channel === channel);
  }

  /**
   * Find instruments by name (partial match, case-insensitive)
   * @param name - Name to search for
   */
  findByName(name: string): InstrumentData[] {
    const lowerName = name.toLowerCase();
    return Array.from(this.instruments.values())
      .filter(inst => inst.name.toLowerCase().includes(lowerName));
  }

  /**
   * Clone an instrument with a new ID
   * @param sourceId - ID of instrument to clone
   * @param newId - ID for the cloned instrument
   * @param newName - Optional new name
   */
  clone(sourceId: string, newId: string, newName?: string): InstrumentData | undefined {
    const source = this.instruments.get(sourceId);
    if (!source) {
      return undefined;
    }

    // Use structuredClone for proper deep cloning (handles all serializable values)
    const cloned: InstrumentData = {
      ...structuredClone(source),
      id: newId,
      name: newName ?? `${source.name} (copy)`,
    };

    this.instruments.set(newId, cloned);
    return cloned;
  }

  /**
   * Update an existing instrument
   * @param id - Instrument ID
   * @param updates - Partial updates to apply
   */
  update(id: string, updates: Partial<InstrumentData>): InstrumentData | undefined {
    const existing = this.instruments.get(id);
    if (!existing) {
      return undefined;
    }

    const updated: InstrumentData = {
      ...existing,
      ...updates,
      id: existing.id, // Prevent ID change through updates
    };

    this.instruments.set(id, updated);
    return updated;
  }

  /**
   * Export all instruments as JSON-serializable data
   */
  export(): InstrumentData[] {
    return JSON.parse(JSON.stringify(this.getAll()));
  }

  /**
   * Import instruments from JSON data
   * @param data - Array of instrument data
   * @param replace - If true, clear existing instruments first
   */
  import(data: InstrumentData[], replace: boolean = false): void {
    if (replace) {
      this.clear();
    }
    this.load(data);
  }
}
