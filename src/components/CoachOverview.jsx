import { useState, useEffect } from 'react';
import { Card } from './ui/Card';

export function CoachOverview() {
  const [dashboard, setDashboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/coach/dashboard', { headers: { 'X-Dev-Role': window.__COMPOSED_ROLE__ || 'coach' } })
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
        </div>
      )}
    </div>
  );
}
