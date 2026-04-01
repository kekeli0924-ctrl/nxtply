import { useState, useMemo } from 'react';
import { Card } from './ui/Card';
import { getStreak } from '../utils/stats';
import { computeXP, getLevel, getLevelProgress, getUnlockedBadges, getNextBadge, BADGES } from '../utils/gamification';

export function StreakXPCard({ sessions }) {
  const [showBadges, setShowBadges] = useState(false);

  const streak = useMemo(() => getStreak(sessions), [sessions]);
  const xp = useMemo(() => computeXP(sessions), [sessions]);
  const level = useMemo(() => getLevel(xp), [xp]);
  const progress = useMemo(() => getLevelProgress(xp), [xp]);
  const unlocked = useMemo(() => getUnlockedBadges(sessions), [sessions]);
  const nextBadge = useMemo(() => getNextBadge(sessions), [sessions]);

  const unlockedIds = new Set(unlocked.map(b => b.id));

  return (
    <Card>
      <div className="space-y-3">
        {/* Streak + Level row */}
        <div className="flex items-center justify-between">
          {/* Streak */}
          <div className="flex items-center gap-2">
            <span className={`text-2xl ${streak > 0 ? 'animate-pulse' : ''}`}>
              {streak > 0 ? '🔥' : '💤'}
            </span>
            <div>
              <p className="text-lg font-bold text-gray-900">{streak}</p>
              <p className="text-[10px] text-gray-400">day streak</p>
            </div>
          </div>

          {/* Level */}
          <div className="text-right">
            <p className="text-sm font-bold text-accent">Level {level}</p>
            <p className="text-[10px] text-gray-400">{xp} XP total</p>
          </div>
        </div>

        {/* XP Progress bar */}
        <div>
          <div className="flex items-center justify-between text-[10px] text-gray-400 mb-1">
            <span>Level {level}</span>
            <span>{progress.current}/{progress.needed} XP</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
        </div>

        {/* Recent badges */}
        {unlocked.length > 0 && (
          <div className="flex items-center gap-1.5">
            {unlocked.slice(-4).map(badge => (
              <span
                key={badge.id}
                title={`${badge.name}: ${badge.description}`}
                className="text-lg cursor-default"
              >
                {badge.icon}
              </span>
            ))}
            {unlocked.length > 4 && (
              <span className="text-[10px] text-gray-400">+{unlocked.length - 4} more</span>
            )}
          </div>
        )}

        {/* Next badge teaser */}
        {nextBadge && (
          <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
            <span className="text-lg opacity-30">{nextBadge.icon}</span>
            <div className="flex-1">
              <p className="text-xs font-medium text-gray-600">Next: {nextBadge.name}</p>
              <p className="text-[10px] text-gray-400">{nextBadge.description}</p>
            </div>
          </div>
        )}

        {/* View all badges toggle */}
        <button
          onClick={() => setShowBadges(!showBadges)}
          className="text-[10px] text-accent hover:underline w-full text-center"
        >
          {showBadges ? 'Hide Badges' : `View All Badges (${unlocked.length}/${BADGES.length})`}
        </button>

        {/* Badge grid */}
        {showBadges && (
          <div className="grid grid-cols-4 gap-2 pt-1">
            {BADGES.map(badge => {
              const earned = unlockedIds.has(badge.id);
              return (
                <div
                  key={badge.id}
                  className={`text-center rounded-lg p-2 ${earned ? 'bg-accent/5' : 'bg-gray-50 opacity-40'}`}
                  title={`${badge.name}: ${badge.description}`}
                >
                  <span className="text-xl">{badge.icon}</span>
                  <p className="text-[9px] text-gray-500 mt-0.5 truncate">{badge.name}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Card>
  );
}
