import { useMemo } from 'react';
import { BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine, Cell } from 'recharts';
import { Card } from './ui/Card';
import { computePace } from '../utils/pace';

const PACE_COLORS = {
  accelerating: '#16A34A',
  steady: '#D97706',
  stalling: '#DC2626',
};

const METRIC_NAMES = {
  shooting: 'Shot Accuracy',
  passing: 'Pass Accuracy',
  consistency: 'Sessions per Week',
  duration: 'Avg Session Duration',
  load: 'Training Load',
};

const METRIC_UNITS = {
  shooting: '%',
  passing: '%',
  consistency: ' sessions',
  duration: ' min',
  load: '',
};

export function PaceDetailView({ sessions, skillLevel, onBack }) {
  const pace = useMemo(() => computePace(sessions, 4), [sessions]);

  // Compute weekly pace history (last 8 weeks)
  const weeklyHistory = useMemo(() => {
    if (!sessions || sessions.length < 5) return [];
    const history = [];
    for (let offset = 0; offset < 8; offset++) {
      // Compute pace as if "now" was offset weeks ago
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - offset * 7);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];
      const subset = sessions.filter(s => s.date <= cutoffStr);
      if (subset.length >= 5) {
        const p = computePace(subset, 4);
        if (p?.overall?.velocityPct != null) {
          const weekLabel = offset === 0 ? 'This wk' : offset === 1 ? 'Last wk' : `${offset}w ago`;
          history.unshift({
            week: weekLabel,
            velocity: p.overall.velocityPct,
            label: p.overall.label,
          });
        }
      }
    }
    return history;
  }, [sessions]);

  if (!pace) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
        <Card>
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">Not enough data yet.</p>
            <p className="text-xs text-gray-400 mt-1">Log at least 5 sessions across 2 weeks to see your Pace.</p>
          </div>
        </Card>
      </div>
    );
  }

  const overallColor = PACE_COLORS[pace.overall.label] || PACE_COLORS.steady;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Back */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <Card>
        <div className="text-center space-y-2">
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Your Improvement Pace</p>
          <div className="flex items-center justify-center gap-3">
            <div
              className="w-16 h-16 rounded-2xl flex flex-col items-center justify-center"
              style={{ backgroundColor: overallColor + '18', border: `2px solid ${overallColor}40` }}
            >
              <span className="text-2xl font-bold" style={{ color: overallColor }}>
                {pace.overall.label === 'accelerating' ? '↑' : pace.overall.label === 'stalling' ? '↓' : '→'}
              </span>
            </div>
            <div className="text-left">
              <p className="text-xl font-bold text-gray-900 capitalize">{pace.overall.label}</p>
              {pace.overall.velocityPct != null && (
                <p className="text-sm" style={{ color: overallColor }}>
                  {pace.overall.velocityPct > 0 ? '+' : ''}{pace.overall.velocityPct}% per week
                </p>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* Recommendation */}
      {pace.recommendation?.text && (
        <Card className={`border-l-4 ${pace.recommendation.urgency === 'high' ? 'border-l-red-500' : pace.recommendation.urgency === 'medium' ? 'border-l-amber-500' : 'border-l-green-500'}`}>
          <p className="text-xs text-gray-700 leading-relaxed">{pace.recommendation.text}</p>
        </Card>
      )}

      {/* Per-metric breakdown */}
      <div>
        <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide px-1 mb-2">Metric Breakdown</p>
        <div className="space-y-2">
          {Object.entries(pace.metrics).map(([key, metric]) => {
            if (!metric) return null;
            const color = PACE_COLORS[metric.label] || PACE_COLORS.steady;
            const unit = METRIC_UNITS[key];
            return (
              <Card key={key}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">{METRIC_NAMES[key]}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      {metric.lastWeek != null ? `${metric.lastWeek}${unit}` : '—'} → {metric.thisWeek != null ? `${metric.thisWeek}${unit}` : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold" style={{ color }}>
                      {metric.velocityPct > 0 ? '+' : ''}{metric.velocityPct}%
                    </span>
                    <span
                      className="text-[9px] font-semibold px-2 py-0.5 rounded-full capitalize"
                      style={{ backgroundColor: color + '18', color }}
                    >
                      {metric.label}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Weekly velocity history chart */}
      {weeklyHistory.length >= 2 && (
        <Card>
          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide mb-3">Pace Over Time</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={weeklyHistory}>
              <XAxis dataKey="week" tick={{ fontSize: 10, fill: '#8E8880' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: '#8E8880' }} axisLine={false} tickLine={false} width={35} />
              <Tooltip
                formatter={(val) => [`${val > 0 ? '+' : ''}${val}%`, 'Pace']}
                contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E8E5E0' }}
              />
              <ReferenceLine y={0} stroke="#D5D0C8" strokeDasharray="3 3" />
              <Bar dataKey="velocity" radius={[4, 4, 0, 0]}>
                {weeklyHistory.map((entry, i) => (
                  <Cell key={i} fill={PACE_COLORS[entry.label] || PACE_COLORS.steady} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </div>
  );
}
