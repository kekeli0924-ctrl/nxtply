import { getDb } from '../db.js';

/**
 * Generate 2-4 data-driven insights for a session.
 * Every insight references a specific number from the player's data.
 */
export function generateSessionInsights(sessionId) {
  const db = getDb();
  const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(sessionId);
  if (!session) return [];

  // Scope all queries to this user's data — reject if session has no user_id
  if (!session.user_id) return [];
  const userId = session.user_id;
  const allSessions = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY date DESC').all(userId);
  const insights = [];

  const shooting = JSON.parse(session.shooting || 'null');
  const passing = JSON.parse(session.passing || 'null');
  const fitness = JSON.parse(session.fitness || 'null');
  const drills = JSON.parse(session.drills || '[]');
  const idpGoals = JSON.parse(session.idp_goals || '[]');

  // Parse all sessions for history
  const history = allSessions.map(s => ({
    id: s.id,
    date: s.date,
    duration: s.duration,
    drills: JSON.parse(s.drills || '[]'),
    shooting: JSON.parse(s.shooting || 'null'),
    passing: JSON.parse(s.passing || 'null'),
    fitness: JSON.parse(s.fitness || 'null'),
    quickRating: s.quick_rating,
  }));

  const prior = history.filter(s => s.id !== sessionId);
  const last30 = prior.filter(s => {
    const d = new Date(s.date);
    return d >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  });

  // 1. New PR — shot accuracy
  if (shooting?.shotsTaken >= 5) {
    const pct = Math.round((shooting.goals / shooting.shotsTaken) * 100);
    const prevBest = prior.reduce((max, s) => {
      if (!s.shooting?.shotsTaken || s.shooting.shotsTaken < 5) return max;
      const p = Math.round((s.shooting.goals / s.shooting.shotsTaken) * 100);
      return p > max ? p : max;
    }, 0);
    if (pct > prevBest && prevBest > 0) {
      insights.push({ icon: '🏆', text: `New Personal Record! Shot accuracy of ${pct}% beats your previous best of ${prevBest}%.` });
    }
  }

  // 2. Improvement trend — shot accuracy over last 3 sessions
  if (shooting?.shotsTaken >= 3) {
    const recentShootingSessions = prior.filter(s => s.shooting?.shotsTaken >= 3).slice(0, 2);
    if (recentShootingSessions.length >= 2) {
      const pcts = [
        ...recentShootingSessions.reverse().map(s => Math.round((s.shooting.goals / s.shooting.shotsTaken) * 100)),
        Math.round((shooting.goals / shooting.shotsTaken) * 100),
      ];
      if (pcts.length >= 3 && pcts[2] > pcts[1] && pcts[1] > pcts[0]) {
        insights.push({ icon: '📈', text: `Shot accuracy improving 3 sessions in a row: ${pcts.join('% → ')}%.` });
      }
    }
  }

  // 3. Pass completion trend
  if (passing?.attempts >= 5) {
    const pct = Math.round((passing.completed / passing.attempts) * 100);
    const avg30 = last30.filter(s => s.passing?.attempts >= 5);
    if (avg30.length >= 3) {
      const avgPct = Math.round(avg30.reduce((sum, s) => sum + (s.passing.completed / s.passing.attempts) * 100, 0) / avg30.length);
      if (pct < avgPct - 10) {
        insights.push({ icon: '📉', text: `Pass completion at ${pct}%, below your 30-day average of ${avgPct}%. Off day, or something to work on?` });
      } else if (pct > avgPct + 10) {
        insights.push({ icon: '📈', text: `Pass completion at ${pct}%, well above your 30-day average of ${avgPct}%. Sharp passing today!` });
      }
    }
  }

  // 4. Weak foot imbalance
  if (shooting?.leftFoot && shooting?.rightFoot) {
    const left = shooting.leftFoot.shots || 0;
    const right = shooting.rightFoot.shots || 0;
    if (left + right >= 10 && (left < right * 0.3 || right < left * 0.3)) {
      const dominant = left > right ? 'left' : 'right';
      const weak = dominant === 'left' ? 'right' : 'left';
      insights.push({ icon: '🦶', text: `${Math.max(left, right)} ${dominant}-foot shots, ${Math.min(left, right)} ${weak}-foot. Balancing this will make you unpredictable.` });
    }
  }

  // 5. Exceeding weekly goal
  const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);
  const weeklyGoal = settings?.weekly_goal || 3;
  const thisWeek = history.filter(s => {
    const d = new Date(s.date);
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(monday.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    monday.setHours(0, 0, 0, 0);
    return d >= monday;
  });
  if (thisWeek.length > weeklyGoal) {
    insights.push({ icon: '🎯', text: `${thisWeek.length} sessions this week — exceeding your goal of ${weeklyGoal}!` });
  }

  // 6. Drill monotony
  if (prior.length >= 5) {
    const last5Drills = prior.slice(0, 5).flatMap(s => s.drills);
    const shootingDrills = ['Finishing Drill', 'Shooting (Inside Box)', 'Shooting (Outside Box)', 'Free Kicks', 'Crossing & Finishing'];
    const passingDrills = ['Wall Passes (1-touch)', 'Wall Passes (2-touch)', 'Long Passing', 'Short Passing Combos', 'Rondo'];
    const shootingCount = last5Drills.filter(d => shootingDrills.includes(d)).length;
    const passingCount = last5Drills.filter(d => passingDrills.includes(d)).length;
    const totalDrills = last5Drills.length;
    if (shootingCount > totalDrills * 0.6) {
      insights.push({ icon: '💡', text: `Your last 5 sessions are ${Math.round((shootingCount / totalDrills) * 100)}% shooting drills. Mix in passing or dribbling to develop more evenly.` });
    } else if (passingCount > totalDrills * 0.6) {
      insights.push({ icon: '💡', text: `Your last 5 sessions are ${Math.round((passingCount / totalDrills) * 100)}% passing drills. Add some shooting or physical work for balance.` });
    }
  }

  // 7. RPE fatigue signal
  if (fitness?.rpe >= 8) {
    const yesterday = prior.find(s => {
      const sd = new Date(s.date);
      const td = new Date(session.date);
      td.setDate(td.getDate() - 1);
      return sd.toISOString().slice(0, 10) === td.toISOString().slice(0, 10);
    });
    if (yesterday?.fitness?.rpe >= 7) {
      insights.push({ icon: '⚠️', text: `RPE was ${fitness.rpe} today and ${yesterday.fitness.rpe} yesterday. Consider a lighter session tomorrow.` });
    }
  }

  // 8. Total hours milestone
  const totalMinutes = history.reduce((sum, s) => sum + (s.duration || 0), 0);
  const totalHours = Math.floor(totalMinutes / 60);
  const milestones = [5, 10, 25, 50, 100, 200];
  const prevMinutes = prior.reduce((sum, s) => sum + (s.duration || 0), 0);
  const prevHours = Math.floor(prevMinutes / 60);
  for (const m of milestones) {
    if (totalHours >= m && prevHours < m) {
      insights.push({ icon: '⏱️', text: `You've hit ${m} total hours of training! That's equivalent to ${Math.round(m / 1.5)} coaching sessions.` });
      break;
    }
  }

  // 9. Streak
  const streak = computeStreak(history);
  if (streak >= 3 && streak < 21) {
    insights.push({ icon: '🔥', text: `Day ${streak} of your streak. Real habits take shape around day 21 — you're ${21 - streak} days away.` });
  } else if (streak >= 21) {
    insights.push({ icon: '🔥', text: `Day ${streak} of your streak. You've built a real habit. Keep it going.` });
  }

  // 10. IDP connection
  if (idpGoals.length > 0) {
    const goals = db.prepare('SELECT * FROM idp_goals WHERE id IN (' + idpGoals.map(() => '?').join(',') + ')').all(...idpGoals);
    if (goals.length > 0) {
      const g = goals[0];
      insights.push({ icon: '🧠', text: `This session counts toward your "${g.text.slice(0, 50)}" goal. You're at ${g.progress}% progress.` });
    }
  }

  // Return top 4 insights
  return insights.slice(0, 4);
}

function computeStreak(sessions) {
  if (sessions.length === 0) return 0;
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  if (sorted[0].date !== today && sorted[0].date !== yesterday) return 0;

  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date);
    const curr = new Date(sorted[i].date);
    const diff = (prev - curr) / 86400000;
    if (diff === 1) streak++;
    else break;
  }
  return streak;
}
