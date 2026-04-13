/**
 * TeamRankCard — small card on the player Dashboard showing their position
 * in the weekly Pace-delta ranking against roster teammates.
 *
 * Hidden when: no coach, roster ≤ 1, endpoint error, or data loading.
 * Fetches lazily after the main Dashboard renders so it doesn't slow the load.
 */
import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { getToken } from '../hooks/useApi';

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function TeamRankCard({ onTap }) {
  const [data, setData] = useState(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    fetch('/api/leaderboard/team', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {}); // silent failure
  }, []);

  // Hide conditions
  if (!data) return null;
  if (!data.myRank || !data.rosterSize || data.rosterSize < 2) return null;

  const rankStr = `${ordinal(data.myRank)} of ${data.rosterSize}`;
  const lastWeekStr = data.lastWeekRank
    ? data.myRank < data.lastWeekRank
      ? `up from ${ordinal(data.lastWeekRank)} last week`
      : data.myRank > data.lastWeekRank
      ? `down from ${ordinal(data.lastWeekRank)} last week`
      : 'same as last week'
    : null;

  return (
    <button onClick={onTap} className="w-full text-left">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">Team rank</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{rankStr} this week</p>
            {lastWeekStr && (
              <p className="text-[10px] text-gray-400 mt-0.5">{lastWeekStr}</p>
            )}
          </div>
          <div className="flex items-center gap-1 text-accent">
            <span className="text-xs font-medium">See full ranking</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </Card>
    </button>
  );
}
