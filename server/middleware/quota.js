/**
 * Per-user daily quota middleware.
 *
 * Tracks request counts per (userId, quotaName) in memory. Resets daily at midnight UTC.
 * Protects against abuse/cost-runaway on expensive endpoints (video upload, AI chat, scouting).
 *
 * Note: in-memory only — resets on server restart. This is intentional: the goal is abuse prevention
 * at runtime, not billing accounting. If you need persistent quotas (e.g., for paid tiers), move this
 * to a DB-backed store later.
 */

import { logger } from '../logger.js';

// Map<dayStamp, Map<userId, Map<quotaName, count>>>
const store = new Map();

function currentDayStamp() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function getUserQuotaMap(day, userId) {
  if (!store.has(day)) {
    // New day: wipe all older day buckets to free memory.
    store.clear();
    store.set(day, new Map());
  }
  const byUser = store.get(day);
  if (!byUser.has(userId)) byUser.set(userId, new Map());
  return byUser.get(userId);
}

/**
 * Express middleware factory.
 *
 * @param {string} quotaName    Logical name of the quota bucket (e.g. 'video-upload', 'ai-chat').
 * @param {number} dailyLimit   Max requests per user per UTC day.
 * @param {string} [userMsg]    Optional custom message shown to the user when blocked.
 */
export function enforceDailyQuota(quotaName, dailyLimit, userMsg) {
  return (req, res, next) => {
    if (!req.userId) {
      // No user — can't enforce per-user quota. Skip.
      return next();
    }

    const day = currentDayStamp();
    const userMap = getUserQuotaMap(day, req.userId);
    const current = userMap.get(quotaName) ?? 0;

    if (current >= dailyLimit) {
      logger.warn('Daily quota exceeded', { userId: req.userId, quotaName, current, dailyLimit });
      return res.status(429).json({
        error: userMsg || `Daily limit reached (${dailyLimit}/day). Resets at midnight UTC.`,
        code: 'QUOTA_EXCEEDED',
        quotaName,
        limit: dailyLimit,
        used: current,
      });
    }

    userMap.set(quotaName, current + 1);

    // Expose current usage on the response headers for debugging/UX.
    res.setHeader('X-Quota-Name', quotaName);
    res.setHeader('X-Quota-Limit', String(dailyLimit));
    res.setHeader('X-Quota-Used', String(current + 1));
    res.setHeader('X-Quota-Remaining', String(dailyLimit - current - 1));

    next();
  };
}

/**
 * Helper to check remaining quota without consuming. Useful if a route wants to
 * warn the user before they hit the wall.
 */
export function checkQuota(userId, quotaName, dailyLimit) {
  if (!userId) return { used: 0, remaining: dailyLimit, limit: dailyLimit };
  const day = currentDayStamp();
  const userMap = getUserQuotaMap(day, userId);
  const used = userMap.get(quotaName) ?? 0;
  return { used, remaining: Math.max(0, dailyLimit - used), limit: dailyLimit };
}
