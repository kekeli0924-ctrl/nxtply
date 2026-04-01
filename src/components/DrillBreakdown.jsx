import { useState, useMemo } from 'react';
import { Card, StatCard } from './ui/Card';
import { DrillTrendChart } from './Charts';
import { DrillExplorer } from './DrillExplorer';
import {
  PRESET_DRILLS, getShotPercentage, getPassPercentage,
  getAverageStat, formatPercentage, hasShootingDrill, hasPassingDrill,
} from '../utils/stats';

export function DrillBreakdown({ sessions, customDrills }) {
  const allDrills = [...PRESET_DRILLS, ...customDrills];
  const [selectedDrill, setSelectedDrill] = useState('');

  // Count how many times each drill was used
  const drillCounts = useMemo(() => {
    const counts = {};
    for (const s of sessions) {
      for (const d of s.drills) {
        counts[d] = (counts[d] || 0) + 1;
      }
    }
    return counts;
  }, [sessions]);

  const drillsUsed = allDrills.filter(d => drillCounts[d]);

  const filteredSessions = useMemo(() => {
    if (!selectedDrill) return [];
    return sessions.filter(s => s.drills.includes(selectedDrill));
  }, [sessions, selectedDrill]);

  const avgShotPct = selectedDrill ? getAverageStat(filteredSessions, getShotPercentage) : null;
  const avgPassPct = selectedDrill ? getAverageStat(filteredSessions, getPassPercentage) : null;
  const avgDuration = selectedDrill && filteredSessions.length
    ? Math.round(filteredSessions.reduce((sum, s) => sum + s.duration, 0) / filteredSessions.length)
    : null;
  const avgRPE = selectedDrill
    ? getAverageStat(filteredSessions, s => s.fitness?.rpe ?? null)
    : null;

  const isShooting = selectedDrill ? hasShootingDrill([selectedDrill]) : false;
  const isPassing = selectedDrill ? hasPassingDrill([selectedDrill]) : false;

  // Drill effectiveness ranking
  const effectivenessRanking = useMemo(() => {
    if (!drillsUsed.length) return [];
    return drillsUsed.map(drill => {
      const drillSessions = sessions.filter(s => s.drills.includes(drill));
      const avgRating = drillSessions.length > 0
        ? Math.round(drillSessions.reduce((sum, s) => sum + (s.quickRating || 3), 0) / drillSessions.length * 10) / 10
        : 0;
      return { drill, count: drillSessions.length, avgRating };
    }).sort((a, b) => b.avgRating - a.avgRating);
  }, [sessions, drillsUsed]);

  const mostPracticed = effectivenessRanking.length > 0
    ? [...effectivenessRanking].sort((a, b) => b.count - a.count)[0].drill
    : null;
  const highestRated = effectivenessRanking.length > 0 ? effectivenessRanking[0].drill : null;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Drills</h2>

      {/* Drill Explorer */}
      <DrillExplorer />

      {/* Drill Performance Stats */}
      {drillsUsed.length > 0 && (
        <h3 className="text-sm font-semibold text-gray-700 mt-4">My Drill Performance</h3>
      )}

      {/* Drill Selector */}
      <Card>
        <label className="block text-xs font-medium text-gray-500 mb-2">Select a Drill</label>
        {drillsUsed.length === 0 ? (
          <div className="text-center py-6">
            <div className="text-3xl mb-2">🎯</div>
            <p className="text-sm font-semibold text-gray-700">Drill insights unlock after your first session</p>
            <p className="text-xs text-gray-400 mt-1">Once you log sessions with drills, this tab will show your per-drill performance breakdown — accuracy, frequency, and trends.</p>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            {drillsUsed.map(drill => (
              <button
                key={drill}
                type="button"
                onClick={() => setSelectedDrill(selectedDrill === drill ? '' : drill)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  selectedDrill === drill
                    ? 'bg-accent text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {drill}
                <span className="ml-1 opacity-60">({drillCounts[drill]})</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {/* Effectiveness Ranking */}
      {effectivenessRanking.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Drill Effectiveness</h3>
          <div className="space-y-2">
            {effectivenessRanking.map((item, i) => (
              <div key={item.drill} className="flex items-center justify-between py-1.5">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    i < 3 ? 'bg-accent text-white' : 'bg-gray-100 text-gray-500'
                  }`}>{i + 1}</span>
                  <span className="text-sm text-gray-700 truncate">{item.drill}</span>
                  {item.drill === mostPracticed && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-blue-50 text-blue-600 flex-shrink-0">Most practiced</span>
                  )}
                  {item.drill === highestRated && item.drill !== mostPracticed && (
                    <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-green-50 text-green-600 flex-shrink-0">Highest rated</span>
                  )}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 ml-2">
                  <span className="text-xs text-gray-400">{item.count}x</span>
                  <span className={`text-sm font-semibold ${item.avgRating >= 7 ? 'text-green-600' : item.avgRating >= 5 ? 'text-accent' : 'text-amber-600'}`}>
                    {item.avgRating}/10
                  </span>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-gray-400 mt-2">Ranked by average session rating when drill is performed</p>
        </Card>
      )}

      {selectedDrill && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatCard label="Times Performed" value={drillCounts[selectedDrill] || 0} />
            <StatCard label="Avg Duration" value={avgDuration ? `${avgDuration}m` : '\u2014'} />
            {isShooting && (
              <StatCard label="Avg Shot %" value={avgShotPct !== null ? `${avgShotPct}%` : '\u2014'} />
            )}
            {isPassing && (
              <StatCard label="Avg Pass %" value={avgPassPct !== null ? `${avgPassPct}%` : '\u2014'} />
            )}
            {!isShooting && !isPassing && (
              <StatCard label="Avg RPE" value={avgRPE !== null ? avgRPE : '\u2014'} />
            )}
          </div>

          {/* Trend Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {isShooting && (
              <DrillTrendChart
                sessions={filteredSessions}
                statFn={getShotPercentage}
                label={`Shot % — ${selectedDrill}`}
                color="#1E3A5F"
              />
            )}
            {isPassing && (
              <DrillTrendChart
                sessions={filteredSessions}
                statFn={getPassPercentage}
                label={`Pass % — ${selectedDrill}`}
                color="#2563EB"
              />
            )}
            <DrillTrendChart
              sessions={filteredSessions}
              statFn={s => s.duration}
              label={`Duration — ${selectedDrill}`}
              color="#6B7280"
            />
            <DrillTrendChart
              sessions={filteredSessions}
              statFn={s => s.fitness?.rpe ?? null}
              label={`RPE — ${selectedDrill}`}
              color="#D97706"
            />
          </div>

          {/* Session List */}
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">
              Sessions with {selectedDrill}
            </h3>
            <div className="space-y-2">
              {[...filteredSessions]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map(s => (
                  <div key={s.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-700">
                      {new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                    <div className="flex gap-4 text-sm">
                      {s.shooting && (
                        <span className="text-gray-500">
                          Shot: {formatPercentage(s.shooting.goals, s.shooting.shotsTaken)}
                        </span>
                      )}
                      {s.passing && (
                        <span className="text-gray-500">
                          Pass: {formatPercentage(s.passing.completed, s.passing.attempts)}
                        </span>
                      )}
                      <span className="text-gray-400">{s.duration}m</span>
                    </div>
                  </div>
                ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
