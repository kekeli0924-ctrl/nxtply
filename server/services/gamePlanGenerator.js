/**
 * Game Plan Generator — Cross-references opponent scouting report with player's own data.
 * Produces a personalized pre-match brief + warm-up session from the drill library.
 */

import { GoogleGenAI } from '@google/genai';
import { logger } from '../logger.js';

// ── Rules-Based Cross-Reference ──────────────────

/**
 * Parse scouting report markdown and extract key sections.
 */
function parseReportSections(reportContent) {
  if (!reportContent) return {};
  const sections = {};
  let currentSection = null;
  let currentContent = [];

  for (const line of reportContent.split('\n')) {
    const headerMatch = line.match(/^##\s+\d*\.?\s*(.*)/);
    if (headerMatch) {
      if (currentSection) sections[currentSection] = currentContent.join('\n').trim();
      currentSection = headerMatch[1].trim().toLowerCase();
      currentContent = [];
    } else if (currentSection) {
      currentContent.push(line);
    }
  }
  if (currentSection) sections[currentSection] = currentContent.join('\n').trim();
  return sections;
}

/**
 * Detect opponent characteristics from report text.
 *
 * Uses a scored keyword approach — each style flag sums the hits of its trigger
 * phrases across the report. A flag fires when its score meets a minimum threshold.
 * This is more robust than single-regex matching because it tolerates varied phrasing.
 */
const STYLE_TRIGGERS = {
  highPress: [
    'high press', 'high-press', 'pressing', 'press high', 'intense press',
    'aggressive press', 'press aggressively', 'counter-press', 'counterpress',
    'press the goalkeeper', 'pressure from the front', 'pressure high up',
    'harass the ball', 'close down quickly', 'hunt in packs',
  ],
  possessionBased: [
    'possession', 'keep the ball', 'keeps the ball', 'build up', 'build-up',
    'builds from the back', 'patient', 'short passing', 'circulate the ball',
    'dominate possession', 'tiki-taka', 'ball retention', 'plays out from the back',
  ],
  directPlay: [
    'direct', 'long ball', 'long balls', 'counter attack', 'counter-attack',
    'fast break', 'transition', 'quick transitions', 'vertical play', 'counter',
    'plays direct', 'launches', 'route one', 'over the top', 'bypass the midfield',
  ],
  strongSetPieces: [
    'set piece', 'set-piece', 'set pieces', 'corner', 'corners',
    'free kick', 'free-kick', 'dead ball', 'dangerous from corners',
    'scored from set', 'threat from set', 'delivery from', 'aerial threat from',
  ],
  weakAerially: [
    'weak aerial', 'struggle aerial', 'struggles in the air', 'poor in the air',
    'small', 'lack of height', 'vulnerable to crosses', 'susceptible to crosses',
    'lose aerial', 'lost aerial', 'beaten in the air', 'vulnerable at the back post',
  ],
  weakLeftSide: [
    'weak left', 'vulnerable left', 'exposed left', 'left-back is vulnerable',
    'left flank issue', 'left side exposed', 'gap on the left', 'struggles on the left',
  ],
  weakRightSide: [
    'weak right', 'vulnerable right', 'exposed right', 'right-back is vulnerable',
    'right flank issue', 'right side exposed', 'gap on the right', 'struggles on the right',
  ],
  physicalTeam: [
    'physical', 'strong', 'aggressive', 'tough', 'muscular', 'robust',
    'bully', 'outmuscle', 'body contact', 'rough',
  ],
  vulnerableCounter: [
    'vulnerable to counter', 'counter-attack exposed', 'fullbacks push high',
    'leave space behind', 'space in behind', 'high defensive line',
    'exposed on the break', 'transition weakness',
  ],
};

function detectOpponentStyle(sections) {
  const text = Object.values(sections).join(' ').toLowerCase();
  const result = {};
  for (const [flag, triggers] of Object.entries(STYLE_TRIGGERS)) {
    let score = 0;
    for (const trigger of triggers) {
      // Count occurrences (not just match), so repeated mentions strengthen the signal.
      const matches = text.split(trigger).length - 1;
      score += matches;
    }
    // A flag fires on 1+ hits. We expose the score for debugging/future weighting.
    result[flag] = score >= 1;
    result[`${flag}Score`] = score;
  }
  return result;
}

/**
 * Compute rules-based cross-reference between opponent and player data.
 * Returns tactical flags and drill suggestions.
 */
export function computeRulesBasedBrief(reportContent, playerStats) {
  const sections = parseReportSections(reportContent);
  const opponent = detectOpponentStyle(sections);
  const tips = [];
  const drillNeeds = []; // Categories to search for warm-up drills

  // Cross-reference: opponent style vs player weaknesses
  if (opponent.highPress && playerStats.passAccuracy < 75) {
    tips.push({
      priority: 'high',
      text: `They press high and your passing accuracy is ${playerStats.passAccuracy}%. Focus on quick-release passing and composure under pressure.`,
    });
    drillNeeds.push('passing');
  }

  if (opponent.highPress && playerStats.passAccuracy >= 75) {
    tips.push({
      priority: 'medium',
      text: `They press high but your passing is strong at ${playerStats.passAccuracy}%. Use this to play through their press — look for through balls behind their line.`,
    });
  }

  if (opponent.weakAerially) {
    tips.push({
      priority: 'medium',
      text: 'They struggle aerially. Attack with crosses and set pieces — get the ball into the box from wide areas.',
    });
    drillNeeds.push('crossing');
  }

  if (opponent.strongSetPieces) {
    tips.push({
      priority: 'high',
      text: 'They\'re dangerous from set pieces. Stay disciplined on corners and free kicks — don\'t give away cheap fouls near your box.',
    });
  }

  if (playerStats.weakFootRatio < 30) {
    tips.push({
      priority: 'medium',
      text: `Your weak foot usage is only ${playerStats.weakFootRatio}%. The opponent may force you onto it — practice both feet in warm-up.`,
    });
    drillNeeds.push('shooting');
  }

  if (playerStats.shotAccuracy < 60) {
    tips.push({
      priority: 'medium',
      text: `Your shot accuracy is ${playerStats.shotAccuracy}%. Take 5-10 focused finishing reps in warm-up to sharpen before the match.`,
    });
    drillNeeds.push('shooting');
  }

  if (playerStats.avgRPE > 7.5) {
    tips.push({
      priority: 'low',
      text: `Your recent training intensity is high (RPE ${playerStats.avgRPE.toFixed(1)}). Manage your energy — don't go all-out in the first 20 minutes.`,
    });
  }

  if (opponent.directPlay) {
    tips.push({
      priority: 'medium',
      text: 'They play direct and counter quickly. Stay compact when you have the ball and be ready to defend transitions.',
    });
  }

  if (opponent.vulnerableCounter) {
    tips.push({
      priority: 'high',
      text: 'Their defensive line sits high and leaves space behind. Make early runs in behind when you win the ball.',
    });
    drillNeeds.push('shooting');
  }

  if (opponent.weakLeftSide || opponent.weakRightSide) {
    const side = opponent.weakLeftSide ? 'left' : 'right';
    tips.push({
      priority: 'high',
      text: `Their ${side} side is vulnerable. Overload that flank and look to create from the ${side} channel.`,
    });
  }

  if (opponent.possessionBased && !opponent.highPress) {
    tips.push({
      priority: 'medium',
      text: 'They want to keep the ball — deny them time to build up. Press the first pass and force turnovers high up the pitch.',
    });
    drillNeeds.push('physical');
  }

  if (opponent.physicalTeam) {
    tips.push({
      priority: 'medium',
      text: 'They\'re a physical team. Don\'t get drawn into 50/50s — use your technique and keep the ball moving.',
    });
  }

  // Default tip if none generated — give a more actionable baseline than "stay composed"
  if (tips.length === 0) {
    tips.push({
      priority: 'medium',
      text: 'Scouting data was limited on this opponent. Focus on your own game plan: quick ball circulation, sharp first touches, and be first to every 50/50.',
    });
    // Include a generic shooting/passing warm-up so the game plan is still useful.
    drillNeeds.push('passing');
    drillNeeds.push('shooting');
  }

  // Sort by priority
  const priorityOrder = { high: 0, medium: 1, low: 2 };
  tips.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

  return {
    tips: tips.slice(0, 5),
    drillNeeds: [...new Set(drillNeeds)],
    opponent,
    playerStats,
  };
}

// ── Warm-Up Session Builder ──────────────────

/**
 * Tiny deterministic PRNG seeded from a string. Mulberry32 + FNV-1a string hash.
 * Same seed → same sequence, so warmups for the same report regenerate identically.
 */
function seededRandom(seed) {
  // FNV-1a hash to turn the string into a 32-bit integer
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let state = h >>> 0;
  // Mulberry32
  return function () {
    state = (state + 0x6D2B79F5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build a 15-20 min warm-up session from the drill library.
 * Returns a plan object compatible with DailyPlanCard/LiveSessionMode.
 *
 * @param {object} crossReference — output of computeRulesBasedBrief
 * @param {array}  drills          — full drill library
 * @param {string} opponentName    — used as the warmup focus label
 * @param {string} [seed]          — deterministic seed; defaults to opponentName so the same
 *                                    opponent generates the same warmup across calls (idempotent).
 */
export function buildWarmupSession(crossReference, drills, opponentName, seed) {
  const { drillNeeds } = crossReference;
  const rand = seededRandom(seed || opponentName || 'default');
  const timeline = [];
  let elapsed = 0;

  // Always start with dynamic warm-up
  timeline.push({
    name: 'Dynamic Warm-Up',
    reps: '5 min',
    duration: 5,
    instruction: 'Light jog, high knees, butt kicks, leg swings, arm circles. Build up to match pace.',
    startMin: elapsed,
    isWarmup: true,
  });
  elapsed += 5;

  // Pick 2-3 drills based on tactical needs
  const selectedDrills = [];
  const categories = drillNeeds.length > 0 ? drillNeeds : ['passing', 'shooting'];

  for (const cat of categories) {
    const matching = drills.filter(d => {
      const sub = (d.subcategory || d.category || '').toLowerCase();
      return sub.includes(cat) || d.name.toLowerCase().includes(cat);
    });
    if (matching.length > 0 && selectedDrills.length < 3) {
      // Pick a drill that's short (≤10 min), deterministically
      const short = matching.filter(d => (d.durationMinutes || d.duration_minutes || 10) <= 10);
      const pool = short.length > 0 ? short : matching;
      const pick = pool[Math.floor(rand() * pool.length)];
      if (!selectedDrills.find(d => d.name === pick.name)) {
        selectedDrills.push(pick);
      }
    }
  }

  // If we still need more drills, add generic ones deterministically
  if (selectedDrills.length < 2) {
    const generic = drills.filter(d =>
      (d.difficulty === 'beginner' || d.difficulty === 'intermediate') &&
      (d.durationMinutes || d.duration_minutes || 10) <= 10 &&
      !selectedDrills.find(s => s.name === d.name)
    );
    while (selectedDrills.length < 2 && generic.length > 0) {
      const idx = Math.floor(rand() * generic.length);
      selectedDrills.push(generic.splice(idx, 1)[0]);
    }
  }

  // Add selected drills to timeline
  for (const drill of selectedDrills) {
    const dur = Math.min(drill.durationMinutes || drill.duration_minutes || 8, 8);
    timeline.push({
      name: drill.name,
      reps: drill.repsDescription || drill.reps_description || `${dur} min`,
      duration: dur,
      instruction: drill.description || '',
      startMin: elapsed,
    });
    elapsed += dur;
  }

  // Cool-down
  timeline.push({
    name: 'Match Prep Cool-Down',
    reps: '3 min',
    duration: 3,
    instruction: 'Light stretches, deep breaths. Visualize your first touch, first pass, first shot.',
    startMin: elapsed,
    isCooldown: true,
  });
  elapsed += 3;

  return {
    type: 'game-plan-warmup',
    focus: `Pre-Match: vs ${opponentName}`,
    drills: selectedDrills.map(d => d.name),
    timeline,
    totalDuration: elapsed,
    targetDuration: elapsed,
    motivation: 'You\'ve prepared. Now go show it.',
    xpReward: 50,
  };
}

// ── AI-Enhanced Game Plan (Gemini) ──────────────────

const GAME_PLAN_PROMPT = `You are a youth soccer tactical analyst. Given an opponent scouting report and a player's recent performance data, generate a concise, actionable pre-match brief.

OPPONENT SCOUTING REPORT:
{{reportContent}}

PLAYER'S RECENT STATS (last 10 sessions):
- Shot accuracy: {{shotAccuracy}}%
- Pass accuracy: {{passAccuracy}}%
- Weak foot ratio: {{weakFootRatio}}% of shots with weaker foot
- Average RPE: {{avgRPE}}/10
- Sessions this week: {{sessionsThisWeek}}

RULES-BASED FLAGS:
{{flags}}

Generate a brief with:
1. A 2-sentence summary of how this player should approach the match
2. 3-5 specific tactical tips that reference BOTH the opponent's tendencies AND the player's own data
3. One key thing to watch out for

Keep it concise, direct, and actionable. Write for a youth player (ages 12-18). No generic advice — every tip must reference specific data.

Return ONLY the brief as clean text (no JSON, no markdown headers).`;

// Wrap a promise with a timeout. Rejects with a timeout error if the promise doesn't settle in time.
function withTimeout(promise, timeoutMs, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => {
        const err = new Error(`${label || 'Operation'} timed out after ${timeoutMs / 1000}s`);
        err.code = 'GEMINI_TIMEOUT';
        reject(err);
      }, timeoutMs)
    ),
  ]);
}

// Errors we consider retry-eligible: rate limits and transient 5xx.
function isRetryableGeminiError(err) {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('RESOURCE_EXHAUSTED') ||
    msg.includes('429') ||
    msg.includes('500') ||
    msg.includes('503') ||
    msg.includes('UNAVAILABLE') ||
    msg.includes('DEADLINE_EXCEEDED') ||
    err?.code === 'GEMINI_TIMEOUT'
  );
}

export async function generateAIGamePlan(reportContent, playerStats, crossReference) {
  if (!process.env.GEMINI_API_KEY) return null;

  const flags = crossReference.tips.map(t => `[${t.priority}] ${t.text}`).join('\n');

  let prompt = GAME_PLAN_PROMPT;
  prompt = prompt.replace('{{reportContent}}', (reportContent || '').slice(0, 3000));
  prompt = prompt.replace('{{shotAccuracy}}', playerStats.shotAccuracy ?? '—');
  prompt = prompt.replace('{{passAccuracy}}', playerStats.passAccuracy ?? '—');
  prompt = prompt.replace('{{weakFootRatio}}', playerStats.weakFootRatio ?? '—');
  prompt = prompt.replace('{{avgRPE}}', playerStats.avgRPE?.toFixed(1) ?? '—');
  prompt = prompt.replace('{{sessionsThisWeek}}', playerStats.sessionsThisWeek ?? '—');
  prompt = prompt.replace('{{flags}}', flags);

  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const models = ['gemini-2.5-pro', 'gemini-2.5-flash'];
  const TIMEOUT_MS = 30 * 1000;

  // Try each model in order. Retry-eligible errors fall through to the next model;
  // non-retryable errors are logged and abort the whole operation (return null).
  for (const model of models) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
        }),
        TIMEOUT_MS,
        `Gemini ${model}`
      );
      const text = response?.text?.trim();
      if (text) return text;
      // Empty response — treat as failure and try the next model.
      logger.warn('Gemini returned empty response', { model });
    } catch (err) {
      if (isRetryableGeminiError(err)) {
        logger.warn('Gemini retryable error — trying next model', { model, error: err.message });
        continue;
      }
      // Non-retryable (auth error, bad request, etc.) — give up.
      logger.error('Gemini non-retryable error', { model, error: err.message });
      return null;
    }
  }

  // All models failed or returned empty.
  logger.error('Game plan AI generation failed — all models exhausted');
  return null;
}
