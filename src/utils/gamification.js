import { getStreak, getShotPercentage } from './stats';

// XP per action
const XP_SESSION = 25;
const XP_DAILY_PLAN = 50;
const XP_STREAK_BONUS = 10; // per day of current streak
const XP_PR = 100;
const XP_VIDEO = 30;

// Level thresholds
const XP_PER_LEVEL = 200;

export const BADGES = [
  { id: 'first_session', name: 'First Touch', icon: '⚽', description: 'Log your first session', condition: (s) => s.length >= 1 },
  { id: 'five_sessions', name: 'Getting Serious', icon: '💪', description: 'Log 5 sessions', condition: (s) => s.length >= 5 },
  { id: 'ten_sessions', name: 'Dedicated', icon: '🔟', description: 'Log 10 sessions', condition: (s) => s.length >= 10 },
  { id: 'twentyfive_sessions', name: 'Quarter Century', icon: '🏅', description: 'Log 25 sessions', condition: (s) => s.length >= 25 },
  { id: 'fifty_sessions', name: 'Half Century', icon: '⭐', description: 'Log 50 sessions', condition: (s) => s.length >= 50 },
  { id: 'centurion', name: 'Centurion', icon: '💯', description: 'Log 100 sessions', condition: (s) => s.length >= 100 },
  { id: 'streak_3', name: 'Hat Trick', icon: '🔥', description: '3-day training streak', condition: (s) => getStreak(s) >= 3 },
  { id: 'streak_7', name: 'Week Warrior', icon: '🗓️', description: '7-day training streak', condition: (s) => getStreak(s) >= 7 },
  { id: 'streak_14', name: 'Fortnight Fighter', icon: '⚡', description: '14-day training streak', condition: (s) => getStreak(s) >= 14 },
  { id: 'streak_30', name: 'Iron Will', icon: '🛡️', description: '30-day training streak', condition: (s) => getStreak(s) >= 30 },
  { id: 'sharpshooter', name: 'Sharpshooter', icon: '🎯', description: '80%+ shooting accuracy in a session', condition: (s) => s.some(sess => {
    if (!sess.shooting?.shotsTaken || sess.shooting.shotsTaken < 5) return false;
    const pct = (sess.shooting.goals / sess.shooting.shotsTaken) * 100;
    return pct >= 80;
  })},
  { id: 'weak_foot', name: 'Weak Foot Hero', icon: '🦶', description: 'Log 20 sessions with weak foot drills', condition: (s) => {
    const count = s.filter(sess => sess.shooting?.leftFoot?.shots > 0 || sess.shooting?.rightFoot?.shots > 0).length;
    return count >= 20;
  }},
  { id: 'early_bird', name: 'Early Bird', icon: '🌅', description: 'Train 5 days in a row', condition: (s) => getStreak(s) >= 5 },
  { id: 'marathon', name: 'Marathon Session', icon: '⏱️', description: 'Complete a 90+ minute session', condition: (s) => s.some(sess => sess.duration >= 90) },
  { id: 'video_pro', name: 'Video Pro', icon: '🎥', description: 'Analyze 5 videos', condition: (s) => s.filter(sess => sess.mediaLinks?.some(l => l.type === 'youtube')).length >= 5 },
];

export function computeXP(sessions) {
  let xp = 0;

  // Base XP: per session
  xp += sessions.length * XP_SESSION;

  // Streak bonus
  const streak = getStreak(sessions);
  xp += streak * XP_STREAK_BONUS;

  // Long session bonus (+10 for 60+ min sessions)
  xp += sessions.filter(s => s.duration >= 60).length * 10;

  return xp;
}

export function getLevel(xp) {
  return Math.floor(xp / XP_PER_LEVEL) + 1;
}

export function getLevelProgress(xp) {
  const currentLevelXP = xp % XP_PER_LEVEL;
  return { current: currentLevelXP, needed: XP_PER_LEVEL, pct: Math.round((currentLevelXP / XP_PER_LEVEL) * 100) };
}

export function getUnlockedBadges(sessions) {
  return BADGES.filter(b => b.condition(sessions));
}

export function getNewBadges(prevSessions, newSessions) {
  const prevBadges = new Set(getUnlockedBadges(prevSessions).map(b => b.id));
  return getUnlockedBadges(newSessions).filter(b => !prevBadges.has(b.id));
}

export function getNextBadge(sessions) {
  const unlocked = new Set(getUnlockedBadges(sessions).map(b => b.id));
  const locked = BADGES.filter(b => !unlocked.has(b.id));

  if (locked.length === 0) return null;

  // Return the first locked badge (they're ordered by difficulty)
  return locked[0];
}
