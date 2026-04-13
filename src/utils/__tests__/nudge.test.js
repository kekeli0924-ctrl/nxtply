import { describe, it, expect } from 'vitest';
import { getDashboardNudge } from '../nudge';

// Fixed "now" so tests are deterministic: Wednesday April 9, 2026
const NOW = new Date('2026-04-09T10:00:00');

function makeSession(date) {
  return { id: `s-${date}`, date, duration: 45, drills: ['Passing'] };
}

describe('getDashboardNudge', () => {
  it('Priority 1: coach-assigned plan for today beats active streak', () => {
    const result = getDashboardNudge({
      sessions: [makeSession('2026-04-08'), makeSession('2026-04-07'), makeSession('2026-04-06')],
      streakCount: 3,
      assignedPlans: [{ date: '2026-04-09', drills: ['Shooting'] }],
      now: NOW,
    });
    expect(result).toEqual({ text: 'Coach assigned a plan for today', tone: 'info' });
  });

  it('Priority 2: active streak ≥3, last session yesterday, no coach plan', () => {
    const result = getDashboardNudge({
      sessions: [makeSession('2026-04-08'), makeSession('2026-04-07'), makeSession('2026-04-06'), makeSession('2026-04-05')],
      streakCount: 4,
      assignedPlans: [],
      now: NOW,
    });
    expect(result).toEqual({ text: '🔥 4-day streak — train today to keep it', tone: 'positive' });
  });

  it('Priority 3: no session in 5 days (stall warning with day count)', () => {
    const result = getDashboardNudge({
      sessions: [makeSession('2026-04-04')],
      streakCount: 0,
      assignedPlans: [],
      now: NOW,
    });
    expect(result).toEqual({
      text: 'Your last session was 5 days ago — your Pace is starting to stall',
      tone: 'warning',
    });
  });

  it('Priority 3 variant: brand-new user with zero sessions', () => {
    const result = getDashboardNudge({
      sessions: [],
      streakCount: 0,
      assignedPlans: [],
      now: NOW,
    });
    expect(result).toEqual({
      text: 'Log your first session to start tracking your Pace',
      tone: 'warning',
    });
  });

  it('Priority 4: active streak, last session was today (celebration)', () => {
    const result = getDashboardNudge({
      sessions: [makeSession('2026-04-09'), makeSession('2026-04-08'), makeSession('2026-04-07')],
      streakCount: 3,
      assignedPlans: [],
      now: NOW,
    });
    expect(result).toEqual({ text: "🔥 You're on a 3-day streak", tone: 'positive' });
  });

  it('returns null when no conditions match (session today, streak 0, no plan)', () => {
    // Edge case: session today but streak is 0 (e.g., just started, only 1 session ever
    // but getStreak might return 1 — let's test with streakCount=0 explicitly)
    const result = getDashboardNudge({
      sessions: [makeSession('2026-04-09')],
      streakCount: 0,
      assignedPlans: [],
      now: NOW,
    });
    expect(result).toBeNull();
  });

  it('Priority 3 fires for 2-day gap (exactly 2 days ago)', () => {
    const result = getDashboardNudge({
      sessions: [makeSession('2026-04-07')],
      streakCount: 0,
      assignedPlans: [],
      now: NOW,
    });
    expect(result).toEqual({
      text: 'Your last session was 2 days ago — your Pace is starting to stall',
      tone: 'warning',
    });
  });

  it('Priority 2 requires streak ≥ 3 (streak of 2 does NOT trigger it)', () => {
    const result = getDashboardNudge({
      sessions: [makeSession('2026-04-08'), makeSession('2026-04-07')],
      streakCount: 2,
      assignedPlans: [],
      now: NOW,
    });
    // Streak 2 with last session yesterday: doesn't match P2 (needs ≥3).
    // daysSinceLastSession = 1 (yesterday), which is < 2 so P3 doesn't fire.
    // Not today so P4 doesn't fire. → null
    expect(result).toBeNull();
  });
});
