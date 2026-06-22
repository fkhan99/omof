import {
  computeNextStreak,
  localDateKey,
  todayKey,
  yesterdayKey,
} from '@/utils/streak';

describe('streak', () => {
  // Fixed local reference time: June 22, 2026, 12:00 noon.
  const now = new Date(2026, 5, 22, 12, 0, 0);

  it('starts at 1 for the first ever visit', () => {
    expect(computeNextStreak(null, 0, now)).toBe(1);
  });

  it('stays the same when the user was already active today', () => {
    expect(computeNextStreak(todayKey(now), 4, now)).toBe(4);
  });

  it('advances by 1 when the last visit was yesterday', () => {
    expect(computeNextStreak(yesterdayKey(now), 4, now)).toBe(5);
  });

  it('resets to 1 after a missed day', () => {
    const twoDaysAgo = new Date(now);
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
    expect(computeNextStreak(localDateKey(twoDaysAgo), 9, now)).toBe(1);
  });

  it('counts many consecutive days correctly', () => {
    let streak = 0;
    let lastActive: string | null = null;
    for (let i = 0; i < 10; i += 1) {
      const day = new Date(2026, 5, 1 + i, 9, 0, 0);
      streak = computeNextStreak(lastActive, streak, day);
      lastActive = localDateKey(day);
    }
    expect(streak).toBe(10);
  });

  it('uses the local calendar day, not UTC, for the boundary', () => {
    // 11:30 PM local — in any positive-offset interpretation a UTC slice could
    // roll to the next day; the local key must stay on June 22.
    const lateLocal = new Date(2026, 5, 22, 23, 30, 0);
    expect(localDateKey(lateLocal)).toBe('2026-06-22');

    // Early morning local stays on its own day too.
    const earlyLocal = new Date(2026, 5, 22, 0, 15, 0);
    expect(localDateKey(earlyLocal)).toBe('2026-06-22');
  });

  it('treats two consecutive local evenings as a streak (timezone-safe)', () => {
    const monEvening = new Date(2026, 5, 22, 21, 0, 0);
    const tueEvening = new Date(2026, 5, 23, 21, 0, 0);

    const afterMon = computeNextStreak(null, 0, monEvening);
    const afterTue = computeNextStreak(localDateKey(monEvening), afterMon, tueEvening);

    expect(afterMon).toBe(1);
    expect(afterTue).toBe(2);
  });
});
