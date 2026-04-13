import { useState, useEffect, useMemo } from 'react';
import { Card } from './ui/Card';
import { getToken } from '../hooks/useApi';

// ── Status colors ────────────────────────────────────────────────────────────
// Reuses the same green/amber/red scheme the rest of the app uses for Pace
// and compliance. No new color tokens.
const PACE_BADGE = {
  accelerating: { label: 'ACCEL', color: 'text-green-600', bg: 'bg-green-50' },
  steady:       { label: 'STEADY', color: 'text-amber-600', bg: 'bg-amber-50' },
  stalling:     { label: 'STALL', color: 'text-red-600', bg: 'bg-red-50' },
};

// Compliance dot: the single strongest visual signal per row.
//   Green  = active this week AND either no plans assigned or ≥70% compliance
//   Yellow = active this week BUT compliance < 70%
//   Red    = zero sessions this week (regardless of plans)
function complianceDot(sessionsThisWeek, compliancePct) {
  if (!sessionsThisWeek || sessionsThisWeek === 0) return { color: 'bg-red-500', ring: 'ring-red-100' };
  if (compliancePct != null && compliancePct < 70) return { color: 'bg-amber-400', ring: 'ring-amber-100' };
  return { color: 'bg-green-500', ring: 'ring-green-100' };
}

// ── Component ────────────────────────────────────────────────────────────────

export function CoachSquadDashboard({ onSelectPlayer }) {
  const [pulse, setPulse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = getToken();
    fetch('/api/coach/squad-pulse', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => setPulse(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Aggregate header numbers
  const header = useMemo(() => {
    if (!pulse?.players) return null;
    const players = pulse.players;
    const total = players.length;
    const training = players.filter(p => p.sessionsThisWeek > 0).length;
    const slipping = players.filter(p => !p.sessionsThisWeek || p.sessionsThisWeek === 0).length;
    return { total, training, slipping };
  }, [pulse]);

  // Sort: red (no activity) first, then yellow, then green — the coach sees
  // who needs attention at the TOP without scrolling.
  const sortedPlayers = useMemo(() => {
    if (!pulse?.players) return [];
    return [...pulse.players].sort((a, b) => {
      const aScore = (a.sessionsThisWeek || 0) === 0 ? 0 : (a.compliancePct != null && a.compliancePct < 70) ? 1 : 2;
      const bScore = (b.sessionsThisWeek || 0) === 0 ? 0 : (b.compliancePct != null && b.compliancePct < 70) ? 1 : 2;
      return aScore - bScore;
    });
  }, [pulse]);

  const dayOfWeek = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <div className="h-6 bg-gray-100 rounded w-48 animate-pulse" />
        <div className="h-4 bg-gray-100 rounded w-64 animate-pulse" />
        {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
      </div>
    );
  }

  // ── Empty state — no players on roster ─────────────────────────────────────
  if (!pulse?.players || pulse.players.length === 0) {
    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Your Squad</h1>
          <p className="text-xs text-gray-400 mt-1">{dayOfWeek}</p>
        </div>
        <Card>
          <div className="text-center py-10 space-y-3">
            <div className="w-16 h-16 rounded-full bg-gray-100 mx-auto flex items-center justify-center">
              <span className="text-2xl text-gray-300">👥</span>
            </div>
            <p className="text-sm font-semibold text-gray-700">No players on your roster yet</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
              Go to the Roster tab and generate an invite code. Share it with your players so they can join your squad.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  // ── Main Dashboard ─────────────────────────────────────────────────────────
  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Header — minimal, one-line aggregate */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Your Squad</h1>
        <p className="text-xs text-gray-400 mt-1">
          {header.total} player{header.total !== 1 ? 's' : ''} · {header.training} training this week
          {header.slipping > 0 && (
            <span className="text-red-500 font-medium"> · {header.slipping} slipping</span>
          )}
        </p>
      </div>

      {/* Roster list — compact rows, sorted by urgency */}
      <div className="space-y-1.5">
        {sortedPlayers.map(player => {
          const dot = complianceDot(player.sessionsThisWeek, player.compliancePct);
          const pace = PACE_BADGE[player.paceLabel] || PACE_BADGE.steady;
          const positionStr = Array.isArray(player.position) && player.position.length > 0
            ? player.position.join(', ')
            : '';

          return (
            <button
              key={player.playerId}
              onClick={() => onSelectPlayer?.({ id: player.playerId, username: player.name })}
              className="w-full text-left bg-surface rounded-xl border border-gray-100 px-3 py-2.5 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
            >
              {/* Compliance dot — the single strongest signal */}
              <div className={`w-2.5 h-2.5 rounded-full shrink-0 ring-2 ${dot.color} ${dot.ring}`} />

              {/* Name + position */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{player.name}</p>
                {positionStr && (
                  <p className="text-[10px] text-gray-400 truncate">{positionStr}</p>
                )}
              </div>

              {/* Sessions this week */}
              <div className="text-right shrink-0">
                <p className="text-xs font-semibold text-gray-700">
                  {player.sessionsThisWeek || 0}
                </p>
                <p className="text-[9px] text-gray-400">
                  {player.sessionsThisWeek === 1 ? 'session' : 'sessions'}
                </p>
              </div>

              {/* Pace label pill */}
              <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full shrink-0 ${pace.bg} ${pace.color}`}>
                {pace.label}
              </span>

              {/* Chevron */}
              <svg className="w-3.5 h-3.5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          );
        })}
      </div>
    </div>
  );
}
