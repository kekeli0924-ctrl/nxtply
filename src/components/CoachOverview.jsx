import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { getToken } from '../hooks/useApi';

export function CoachOverview() {
  const [dashboard, setDashboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [leaderboardMetric, setLeaderboardMetric] = useState('sessions');

  useEffect(() => {
    fetch('/api/coach/dashboard', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setDashboard)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  const totalPlayers = dashboard.length;
  const totalSessions = dashboard.reduce((sum, p) => sum + p.sessionsLast7d, 0);
  const playersWithPlans = dashboard.filter(p => p.compliancePercent != null);
  const avgCompliance = playersWithPlans.length > 0
    ? Math.round(playersWithPlans.reduce((sum, p) => sum + p.compliancePercent, 0) / playersWithPlans.length)
    : null;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Overview</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <div className="text-center">
            <p className="text-2xl font-bold text-accent">{totalPlayers}</p>
            <p className="text-xs text-gray-400">Players</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-2xl font-bold text-gray-900">{totalSessions}</p>
            <p className="text-xs text-gray-400">Sessions (7d)</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className={`text-2xl font-bold ${
              avgCompliance == null ? 'text-gray-300' :
              avgCompliance >= 80 ? 'text-green-600' :
              avgCompliance >= 50 ? 'text-amber-500' : 'text-red-500'
            }`}>
              {avgCompliance != null ? `${avgCompliance}%` : '-'}
            </p>
            <p className="text-xs text-gray-400">Avg Compliance</p>
          </div>
        </Card>
      </div>

      {/* Player compliance breakdown */}
      {dashboard.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No players on your roster yet.</p>
            <p className="text-xs text-gray-400 mt-1">Go to Roster to invite players.</p>
          </div>
        </Card>
      ) : (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Player Activity</h3>
          <div className="space-y-2">
            {dashboard.map(player => (
              <Card key={player.playerId}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{player.username}</p>
                    <p className="text-[10px] text-gray-400">
                      {player.lastSessionDate
                        ? `Last session: ${player.lastSessionDate}`
                        : 'No sessions yet'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold">{player.sessionsLast7d} sessions</p>
                    <p className="text-[10px] text-gray-400">this week</p>
                  </div>
                </div>

                {player.assignedThisWeek > 0 && (
                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-gray-500">Plan compliance</span>
                      <span className={`font-medium ${
                        player.compliancePercent >= 80 ? 'text-green-600' :
                        player.compliancePercent >= 50 ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {player.completedThisWeek}/{player.assignedThisWeek} ({player.compliancePercent}%)
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          player.compliancePercent >= 80 ? 'bg-green-500' :
                          player.compliancePercent >= 50 ? 'bg-amber-400' : 'bg-red-400'
                        }`}
                        style={{ width: `${Math.min(player.compliancePercent, 100)}%` }}
                      />
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>

          {/* Team Leaderboard */}
          {dashboard.length >= 2 && (() => {
            const metrics = [
              { key: 'sessions', label: 'Sessions' },
              { key: 'compliance', label: 'Compliance' },
              { key: 'streak', label: 'Streak' },
            ];
            const ranked = [...dashboard]
              .map(p => ({
                ...p,
                _value:
                  leaderboardMetric === 'sessions' ? p.sessionsLast7d :
                  leaderboardMetric === 'compliance' ? (p.compliancePercent ?? 0) :
                  p.sessionsLast7d, // streak uses sessions as proxy
              }))
              .sort((a, b) => b._value - a._value);
            const medals = ['🥇', '🥈', '🥉'];

            return (
              <div className="mt-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Team Leaderboard</h3>
                <div className="flex gap-2 mb-3">
                  {metrics.map(m => (
                    <button
                      key={m.key}
                      onClick={() => setLeaderboardMetric(m.key)}
                      className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        leaderboardMetric === m.key
                          ? 'bg-accent text-white'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <Card>
                  <div className="space-y-2">
                    {ranked.map((player, i) => (
                      <div
                        key={player.playerId}
                        className={`flex items-center justify-between py-1.5 px-2 rounded ${
                          i === 0 ? 'bg-amber-50' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm w-6 text-center">
                            {i < 3 ? medals[i] : <span className="text-gray-400">{i + 1}</span>}
                          </span>
                          <span className="text-sm font-medium text-gray-900">{player.username}</span>
                        </div>
                        <span className="text-sm font-semibold text-gray-700">
                          {leaderboardMetric === 'compliance'
                            ? `${player._value}%`
                            : player._value}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
