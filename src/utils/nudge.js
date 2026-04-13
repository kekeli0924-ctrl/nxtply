/**
 * getDashboardNudge — computes a single contextual one-liner for the player Dashboard.
 *
 * Pure function. Takes data in, returns the nudge out. No side effects, no data fetching.
 * Five conditions in a fixed priority order — the first match wins.
 *
 * @param {Object} ctx
 * @param {Array}  ctx.sessions        — full session array (sorted or unsorted, we sort internally)
 * @param {number} ctx.streakCount     — current streak from getStreak()
 * @param {Array}  ctx.assignedPlans   — coach-assigned plans for the current user
 * @param {Date}   [ctx.now]           — override for testing; defaults to new Date()
 * @returns {{ text: string, tone: 'positive'|'warning'|'info' } | null}
 */
export function getDashboardNudge({ sessions = [], streakCount = 0, assignedPlans = [], now } = {}) {
  const today = now ? new Date(now) : new Date();
  today.setHours(0, 0, 0, 0);

  const todayStr = today.toISOString().split('T')[0];

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  // Last session date (most recent by calendar date)
  const sorted = sessions.length > 0
    ? [...sessions].sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const lastSessionDate = sorted.length > 0 ? sorted[0].date : null;

  const lastSessionIsToday = lastSessionDate === todayStr;
  const lastSessionIsYesterday = lastSessionDate === yesterdayStr;

  // Days since last session (whole days, rounded down)
  let daysSinceLastSession = null;
  if (lastSessionDate) {
    const lastDate = new Date(lastSessionDate + 'T00:00:00');
    daysSinceLastSession = Math.floor((today - lastDate) / (1000 * 60 * 60 * 24));
  }

  // Check if coach assigned a plan for today
  const hasCoachPlanToday = assignedPlans.some(p => p.date === todayStr);

  // ── Priority 1: Coach-assigned plan for today ──────────────────────────────
  if (hasCoachPlanToday) {
    return { text: 'Coach assigned a plan for today', tone: 'info' };
  }

  // ── Priority 2: Active streak, last session yesterday (keep it alive) ──────
  if (streakCount >= 3 && lastSessionIsYesterday) {
    return { text: `🔥 ${streakCount}-day streak — train today to keep it`, tone: 'positive' };
  }

  // ── Priority 3: No session in 2+ days (stall warning) ─────────────────────
  if (daysSinceLastSession === null) {
    // Brand-new user: zero sessions ever
    return { text: 'Log your first session to start tracking your Pace', tone: 'warning' };
  }
  if (daysSinceLastSession >= 2) {
    return { text: `Your last session was ${daysSinceLastSession} days ago — your Pace is starting to stall`, tone: 'warning' };
  }

  // ── Priority 4: Streak active, already trained today (celebration) ─────────
  if (streakCount >= 1 && lastSessionIsToday) {
    return { text: `🔥 You're on a ${streakCount}-day streak`, tone: 'positive' };
  }

  // ── No match — render nothing ──────────────────────────────────────────────
  return null;
}
