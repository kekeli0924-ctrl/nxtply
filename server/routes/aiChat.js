import { Router } from 'express';
import { GoogleGenAI } from '@google/genai';
import { getDb } from '../db.js';
import { logger } from '../logger.js';
import { enforceDailyQuota } from '../middleware/quota.js';

const router = Router();

const SYSTEM_PROMPT = `You are Composed, a personal soccer training analyst. You have access to this player's training data provided below. Reference their actual numbers. Be specific and actionable. Keep responses concise (2-4 sentences for simple questions, a short paragraph for complex ones). Speak like a knowledgeable but friendly youth coach. Never invent stats — only reference the provided data. If data is insufficient, say so and suggest what the player should log.`;

function gatherPlayerContext(userId) {
  const db = getDb();

  // Last 10 sessions for this user
  const sessions = db.prepare('SELECT * FROM sessions WHERE user_id = ? ORDER BY date DESC LIMIT 10').all(userId).map(s => ({
    date: s.date,
    duration: s.duration,
    drills: JSON.parse(s.drills || '[]'),
    shooting: JSON.parse(s.shooting || 'null'),
    passing: JSON.parse(s.passing || 'null'),
    fitness: JSON.parse(s.fitness || 'null'),
    quickRating: s.quick_rating,
    insights: JSON.parse(s.session_insights || '[]'),
  }));

  // Settings
  const settings = db.prepare('SELECT * FROM settings WHERE user_id = ?').get(userId);

  // IDP goals
  const goals = db.prepare("SELECT * FROM idp_goals WHERE status = 'active' AND user_id = ?").all(userId).map(g => ({
    corner: g.corner,
    text: g.text,
    progress: g.progress,
    targetDate: g.target_date,
  }));

  // Active program
  const program = db.prepare("SELECT up.*, p.name as program_name FROM user_programs up JOIN programs p ON p.id = up.program_id WHERE up.status = 'active' AND up.user_id = ? LIMIT 1").get(userId);

  // Streak
  let streak = 0;
  if (sessions.length > 0) {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    if (sessions[0].date === today || sessions[0].date === yesterday) {
      streak = 1;
      for (let i = 1; i < sessions.length; i++) {
        const prev = new Date(sessions[i - 1].date);
        const curr = new Date(sessions[i].date);
        if ((prev - curr) / 86400000 === 1) streak++;
        else break;
      }
    }
  }

  return {
    totalSessions: sessions.length,
    recentSessions: sessions.slice(0, 5),
    streak,
    weeklyGoal: settings?.weekly_goal || 3,
    ageGroup: settings?.age_group || 'unknown',
    skillLevel: settings?.skill_level || 'unknown',
    playerName: settings?.player_name || 'Player',
    activeGoals: goals,
    activeProgram: program ? { name: program.program_name, week: program.current_week, day: program.current_day } : null,
  };
}

// POST /api/ai/chat
router.post('/chat', enforceDailyQuota('ai-chat', 50, 'Daily AI chat limit reached (50/day). Try again tomorrow.'), async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'AI not configured' });
  }

  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message required' });
  if (message.length > 500) return res.status(400).json({ error: 'Message too long (max 500 chars)' });

  try {
    const context = gatherPlayerContext(req.userId);
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

    const contextStr = `
Player: ${context.playerName}, ${context.ageGroup}, ${context.skillLevel}
Total sessions: ${context.totalSessions}, Streak: ${context.streak} days, Weekly goal: ${context.weeklyGoal}
${context.activeProgram ? `Active program: ${context.activeProgram.name} (Week ${context.activeProgram.week}, Day ${context.activeProgram.day})` : 'No active program'}
Active IDP goals: ${context.activeGoals.length > 0 ? context.activeGoals.map(g => `${g.corner}: "${g.text}" (${g.progress}%)`).join(', ') : 'None'}

Recent sessions:
${context.recentSessions.map(s => {
  const parts = [`${s.date}: ${s.duration}min, drills: ${s.drills.join(', ')}`];
  if (s.shooting?.shotsTaken) parts.push(`shooting: ${s.shooting.goals}/${s.shooting.shotsTaken}`);
  if (s.passing?.attempts) parts.push(`passing: ${s.passing.completed}/${s.passing.attempts}`);
  if (s.fitness?.rpe) parts.push(`RPE: ${s.fitness.rpe}`);
  return parts.join(', ');
}).join('\n')}`;

    // Try pro first, fall back to flash
    const models = ['gemini-2.5-pro', 'gemini-2.5-flash'];
    let response = null;

    for (const model of models) {
      try {
        response = await ai.models.generateContent({
          model,
          contents: [
            { role: 'user', parts: [{ text: `${SYSTEM_PROMPT}\n\n--- PLAYER DATA ---\n${contextStr}\n\n--- PLAYER QUESTION ---\n${message}` }] },
          ],
        });
        break;
      } catch (err) {
        if (String(err).includes('RESOURCE_EXHAUSTED') || String(err).includes('429')) continue;
        throw err;
      }
    }

    if (!response) return res.status(503).json({ error: 'AI temporarily unavailable. Try again in a moment.' });

    const reply = response.text?.trim() || 'I couldn\'t generate a response. Try asking differently.';
    logger.info('AI chat response generated', { messageLength: message.length, replyLength: reply.length });

    res.json({ reply });
  } catch (err) {
    logger.error('AI chat error', { error: err.message });
    res.status(500).json({ error: 'Composing... try again in a moment.' });
  }
});

// GET /api/ai/available — check if AI chat is available
router.get('/available', (req, res) => {
  res.json({ available: !!process.env.GEMINI_API_KEY });
});

export default router;
