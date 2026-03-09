import { useState, useMemo } from 'react';
import { Card, StatCard } from './ui/Card';
import { DrillTrendChart } from './Charts';
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

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Drill Breakdown</h2>

      {/* Drill Selector */}
      <Card>
        <label className="block text-xs font-medium text-gray-500 mb-2">Select a Drill</label>
        {drillsUsed.length === 0 ? (
          <p className="text-sm text-gray-300">No drills used yet. Log a session first!</p>
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
