/**
 * Scheduler - Precise Web Audio scheduling
 *
 * Uses a lookahead scheduler pattern for precise timing of note events.
 * This avoids JavaScript timing jitter by scheduling ahead using
 * Web Audio's high-precision timing.
 */

import { SCHEDULE_AHEAD_TIME, SCHEDULER_INTERVAL } from '../utils/constants';

export interface ScheduledEvent {
  time: number;
  callback: () => void;
}

export class Scheduler {
  private context: AudioContext;
  private scheduleAheadTime: number;
  private timerInterval: number;
  private timerId: ReturnType<typeof setTimeout> | null = null;
  private isRunning: boolean = false;
  private schedulerCallback: ((time: number) => void) | null = null;

  constructor(
    context: AudioContext,
    scheduleAheadTime: number = SCHEDULE_AHEAD_TIME,
    timerInterval: number = SCHEDULER_INTERVAL
  ) {
    this.context = context;
    this.scheduleAheadTime = scheduleAheadTime;
    this.timerInterval = timerInterval;
  }

  /**
   * Set the callback function that will be called on each scheduler tick
   * The callback receives the current schedule window end time
   */
  setCallback(callback: (time: number) => void): void {
    this.schedulerCallback = callback;
  }

  /**
   * Start the scheduler
   * @param startTime - Optional start time (defaults to current time)
   */
  start(_startTime?: number): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.tick();
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    this.isRunning = false;
    if (this.timerId) {
      clearTimeout(this.timerId);
      this.timerId = null;
    }
  }

  /**
   * Pause the scheduler (remembers position)
   */
  pause(): void {
    this.stop();
  }

  /**
   * Resume the scheduler from pause
   */
  resume(): void {
    if (!this.isRunning) {
      this.isRunning = true;
      this.tick();
    }
  }

  private tick(): void {
    if (!this.isRunning) return;

    // Calculate the schedule window end time
    const scheduleUntil = this.context.currentTime + this.scheduleAheadTime;

    // Call the scheduler callback if set
    if (this.schedulerCallback) {
      this.schedulerCallback(scheduleUntil);
    }

    // Schedule next tick
    this.timerId = setTimeout(() => this.tick(), this.timerInterval);
  }

  /**
   * Get the current audio context time
   */
  get currentTime(): number {
    return this.context.currentTime;
  }

  /**
   * Get the schedule ahead time
   */
  get lookaheadTime(): number {
    return this.scheduleAheadTime;
  }

  /**
   * Set the schedule ahead time
   */
  set lookaheadTime(value: number) {
    this.scheduleAheadTime = Math.max(0.01, value);
  }

  /**
   * Check if scheduler is running
   */
  get running(): boolean {
    return this.isRunning;
  }

  /**
   * Schedule a callback to run at a specific time
   * Uses setTimeout with calculated delay
   */
  scheduleCallback(time: number, callback: () => void): void {
    const delay = Math.max(0, (time - this.context.currentTime) * 1000);
    setTimeout(callback, delay);
  }

  /**
   * Schedule multiple callbacks
   */
  scheduleCallbacks(events: ScheduledEvent[]): void {
    for (const event of events) {
      this.scheduleCallback(event.time, event.callback);
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stop();
    this.schedulerCallback = null;
  }
}
