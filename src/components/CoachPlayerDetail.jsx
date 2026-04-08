import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { CoachChat } from './CoachChat';
import { formatDate, getShotPercentage, getPassPercentage, getStreak } from '../utils/stats';
import { getToken } from '../hooks/useApi';

export function CoachPlayerDetail({ player, onBack }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/coach/player/${player.playerId}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }, [player.playerId]);

  if (loading) return <div className="text-center py-12 text-gray-400">Loading player data...</div>;
  if (!data) return <div className="text-center py-12 text-red-400">Failed to load player data.</div>;

  const { sessions, matches, idpGoals, assignedPlans } = data;
  const streak = getStreak(sessions);
  const recentSessions = sessions.slice(0, 10);
  const activeGoals = idpGoals.filter(g => g.status === 'active');

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" onClick={onBack}>&larr; Back</Button>
        <h2 className="text-xl font-bold text-gray-900">{player.playerName || player.username}</h2>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card>
          <div className="text-center">
            <p className="text-xl font-bold text-accent">{sessions.length}</p>
            <p className="text-[10px] text-gray-400">Sessions</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xl font-bold text-gray-900">{matches.length}</p>
            <p className="text-[10px] text-gray-400">Matches</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xl font-bold text-orange-500">{streak}</p>
            <p className="text-[10px] text-gray-400">Streak</p>
          </div>
        </Card>
        <Card>
          <div className="text-center">
            <p className="text-xl font-bold text-green-600">{activeGoals.length}</p>
            <p className="text-[10px] text-gray-400">IDP Goals</p>
          </div>
        </Card>
      </div>

      {/* Assigned Plans */}
      {assignedPlans.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Assigned Plans</h3>
          <div className="space-y-2">
            {assignedPlans.slice(0, 10).map(plan => {
              const sessionOnDate = sessions.some(s => s.date === plan.date);
              return (
                <Card key={plan.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{formatDate(plan.date)}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {plan.drills.map(d => (
                          <span key={d} className="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full">{d}</span>
                        ))}
                      </div>
                    </div>
                    <span className={`text-lg ${sessionOnDate ? 'text-green-500' : 'text-gray-200'}`}>
                      {sessionOnDate ? '✓' : '○'}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Sessions */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Sessions</h3>
        {recentSessions.length === 0 ? (
          <Card><p className="text-xs text-gray-400 text-center py-4">No sessions logged yet.</p></Card>
        ) : (
          <div className="space-y-2">
            {recentSessions.map(session => (
              <Card key={session.id}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{formatDate(session.date)}</p>
                    <p className="text-xs text-gray-400">{session.duration} min &middot; {session.drills.slice(0, 3).join(', ')}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-2 text-xs">
                      {session.shooting && (
                        <span className="bg-gray-50 rounded px-1.5 py-0.5">
                          Shot {getShotPercentage(session)}
                        </span>
                      )}
                      {session.passing && (
                        <span className="bg-gray-50 rounded px-1.5 py-0.5">
                          Pass {getPassPercentage(session)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-end gap-0.5 mt-1">
                      {Array.from({ length: 10 }, (_, i) => (
                        <div key={i} className={`w-1.5 h-1.5 rounded-full ${i < session.quickRating ? 'bg-accent' : 'bg-gray-100'}`} />
                      ))}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* IDP Goals */}
      {activeGoals.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Active IDP Goals</h3>
          <div className="space-y-2">
            {activeGoals.map(goal => (
              <Card key={goal.id}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    goal.corner === 'technical' ? 'bg-blue-50 text-blue-600' :
                    goal.corner === 'tactical' ? 'bg-purple-50 text-purple-600' :
                    goal.corner === 'physical' ? 'bg-green-50 text-green-600' :
                    'bg-amber-50 text-amber-600'
                  }`}>
                    {goal.corner}
                  </span>
                  <span className="text-xs font-medium text-gray-500">{goal.progress}%</span>
                </div>
                <p className="text-sm text-gray-700">{goal.text}</p>
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-2">
                  <div className="bg-accent h-1.5 rounded-full transition-all" style={{ width: `${goal.progress}%` }} />
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Recent Matches */}
      {matches.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Recent Matches</h3>
          <div className="space-y-2">
            {matches.slice(0, 5).map(match => {
              const resultColors = { W: 'text-green-600 bg-green-50', D: 'text-yellow-600 bg-yellow-50', L: 'text-red-600 bg-red-50' };
              return (
                <Card key={match.id}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900">vs {match.opponent}</p>
                      <p className="text-xs text-gray-400">{formatDate(match.date)} &middot; {match.minutesPlayed} min</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{match.goals}G {match.assists}A</span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${resultColors[match.result]}`}>
                        {match.result}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Chat with player */}
      <CoachChat coachId={player.playerId} coachName={player.playerName || player.username} label="Message Player" />
    </div>
  );
}
