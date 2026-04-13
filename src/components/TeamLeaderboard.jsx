/**
 * TeamLeaderboard — full roster ranked by weekly Pace delta.
 *
 * One list. No toggles. No charts. No filters. Resets Monday.
 */
import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { getToken } from '../hooks/useApi';

const PACE_BADGE = {
  accelerating: { label: 'ACCEL', color: 'text-green-600', bg: 'bg-green-50' },
  steady:       { label: 'STEADY', color: 'text-amber-600', bg: 'bg-amber-50' },
  stalling:     { label: 'STALL', color: 'text-red-600', bg: 'bg-red-50' },
  no_activity:  { label: 'NO ACTIVITY', color: 'text-gray-400', bg: 'bg-gray-50' },
};

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function TeamLeaderboard({ onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch('/api/leaderboard/team', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setData(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="h-6 bg-gray-100 rounded w-48 animate-pulse" />
        {[1,2,3,4].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!data || !data.rankings || data.rankings.length < 2) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <Card>
          <p className="text-sm text-gray-500 text-center py-6">
            Your team ranking appears once your coach has more players on the roster.
          </p>
        </Card>
      </div>
    );
  }

  const weekFrom = new Date(data.weekOf + 'T12:00:00');
  const weekTo = new Date(weekFrom);
  weekTo.setDate(weekTo.getDate() + 6);
  const fmtDate = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div>
        <h2 className="text-lg font-bold text-gray-900">Team Rank</h2>
        <p className="text-xs text-gray-400 mt-1">Week of {fmtDate(weekFrom)} – {fmtDate(weekTo)}</p>
      </div>

      <div className="space-y-1.5">
        {data.rankings.map(player => {
          const badge = PACE_BADGE[player.paceLabel] || PACE_BADGE.steady;
          const isMe = player.isMe;
          return (
            <div
              key={player.playerId}
              className={`rounded-xl border px-3 py-2.5 flex items-center gap-3 ${
                isMe ? 'border-accent/30 bg-accent/5' : 'border-gray-100 bg-surface'
              }`}
            >
              {/* Rank */}
              <span className={`text-sm font-bold w-7 text-center ${isMe ? 'text-accent' : 'text-gray-400'}`}>
                {player.rank}
              </span>

              {/* Name */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm truncate ${isMe ? 'font-bold text-accent' : 'font-medium text-gray-900'}`}>
                  {player.name}{isMe ? ' (you)' : ''}
                </p>
                <p className="text-[10px] text-gray-400">
                  {player.sessionsThisWeek} session{player.sessionsThisWeek !== 1 ? 's' : ''} this week
                </p>
              </div>

              {/* Delta */}
              <span className={`text-xs font-bold ${
                player.paceDelta == null ? 'text-gray-300'
                : player.paceDelta > 0 ? 'text-green-600'
                : player.paceDelta < 0 ? 'text-red-500'
                : 'text-gray-500'
              }`}>
                {player.paceDelta == null ? '—' : `${player.paceDelta > 0 ? '+' : ''}${player.paceDelta}%`}
              </span>

              {/* Pace label */}
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badge.bg} ${badge.color}`}>
                {badge.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <p className="text-[10px] text-gray-300 text-center leading-relaxed">
        Updated {new Date(data.computedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}. Resets Monday.
      </p>
    </div>
  );
}
