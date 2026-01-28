/**
 * Mixer - Channel mixing and master output
 *
 * Provides individual channel gain control and routing to master output
 */

import type { ChannelType } from '../types';

export interface MixerChannel {
  gain: GainNode;
  muted: boolean;
  solo: boolean;
}

export class Mixer {
  private context: AudioContext;
  private channels: Map<ChannelType, MixerChannel> = new Map();
  private channelVolumes: Map<ChannelType, number> = new Map();
  private soloActive: boolean = false;

  constructor(context: AudioContext, destination: AudioNode) {
    this.context = context;

    // Create mixer channels for each channel type
    const channelTypes: ChannelType[] = ['pulse1', 'pulse2', 'wave', 'noise'];
    for (const type of channelTypes) {
      const gain = context.createGain();
      gain.connect(destination);

      this.channels.set(type, {
        gain,
        muted: false,
        solo: false,
      });
      // Store default volume
      this.channelVolumes.set(type, 1);
    }
  }

  /**
   * Get the output node for a channel type
   */
  getChannelOutput(channel: ChannelType): AudioNode {
    const ch = this.channels.get(channel);
    if (!ch) {
      throw new Error(`Unknown channel type: ${channel}`);
    }
    return ch.gain;
  }

  /**
   * Set the volume for a channel
   */
  setChannelVolume(channel: ChannelType, volume: number): void {
    const ch = this.channels.get(channel);
    if (ch) {
      const clampedVolume = Math.max(0, Math.min(1, volume));
      // Store the intended volume for restoration after mute/unmute
      this.channelVolumes.set(channel, clampedVolume);
      // Only apply if channel is currently audible
      if (this.isChannelAudible(channel)) {
        ch.gain.gain.setValueAtTime(clampedVolume, this.context.currentTime);
      }
    }
  }

  /**
   * Get the volume for a channel
   */
  getChannelVolume(channel: ChannelType): number {
    // Return the intended volume, not the current gain (which may be 0 if muted)
    return this.channelVolumes.get(channel) ?? 1;
  }

  /**
   * Mute or unmute a channel
   */
  setChannelMute(channel: ChannelType, muted: boolean): void {
    const ch = this.channels.get(channel);
    if (ch) {
      ch.muted = muted;
      this.updateChannelAudibility();
    }
  }

  /**
   * Check if a channel is muted
   */
  isChannelMuted(channel: ChannelType): boolean {
    return this.channels.get(channel)?.muted ?? false;
  }

  /**
   * Solo a channel (only soloed channels will be audible)
   */
  setChannelSolo(channel: ChannelType, solo: boolean): void {
    const ch = this.channels.get(channel);
    if (ch) {
      ch.solo = solo;
      this.updateSoloState();
      this.updateChannelAudibility();
    }
  }

  /**
   * Check if a channel is soloed
   */
  isChannelSoloed(channel: ChannelType): boolean {
    return this.channels.get(channel)?.solo ?? false;
  }

  private updateSoloState(): void {
    this.soloActive = false;
    for (const ch of this.channels.values()) {
      if (ch.solo) {
        this.soloActive = true;
        break;
      }
    }
  }

  private updateChannelAudibility(): void {
    for (const [type, ch] of this.channels) {
      const audible = this.isChannelAudible(type);
      const volume = this.channelVolumes.get(type) ?? 1;
      // Set gain to 0 if muted, otherwise restore stored volume
      const targetGain = audible ? volume : 0;
      ch.gain.gain.setValueAtTime(targetGain, this.context.currentTime);
    }
  }

  /**
   * Check if a channel is currently audible
   */
  isChannelAudible(channel: ChannelType): boolean {
    const ch = this.channels.get(channel);
    if (!ch) return false;

    // If muted, never audible
    if (ch.muted) return false;

    // If any channel is soloed, only soloed channels are audible
    if (this.soloActive) {
      return ch.solo;
    }

    // Otherwise, audible
    return true;
  }

  /**
   * Mute all channels
   */
  muteAll(): void {
    for (const type of this.channels.keys()) {
      this.setChannelMute(type, true);
    }
  }

  /**
   * Unmute all channels
   */
  unmuteAll(): void {
    for (const type of this.channels.keys()) {
      this.setChannelMute(type, false);
    }
  }

  /**
   * Clear all solo states
   */
  clearSolo(): void {
    for (const type of this.channels.keys()) {
      this.setChannelSolo(type, false);
    }
  }

  /**
   * Reset all channels to default state
   */
  reset(): void {
    for (const [type, ch] of this.channels) {
      ch.muted = false;
      ch.solo = false;
      ch.gain.gain.setValueAtTime(1, this.context.currentTime);
      this.channelVolumes.set(type, 1);
    }
    this.soloActive = false;
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    for (const ch of this.channels.values()) {
      ch.gain.disconnect();
    }
    this.channels.clear();
  }
}
