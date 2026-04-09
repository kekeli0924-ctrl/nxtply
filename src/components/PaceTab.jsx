import { useState, useMemo } from 'react';
import { BarChart, Bar, LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine, Cell } from 'recharts';
import { Card } from './ui/Card';
import { computePace } from '../utils/pace';
import { getAverageStat, getShotPercentage, getPassPercentage, getWeeklyLoads, getCurrentWeekSessionCount } from '../utils/stats';
import { BENCHMARKS, calculatePercentile } from '../utils/benchmarks';

const PACE_COLORS = {
  accelerating: '#16A34A',
  steady: '#D97706',
  stalling: '#DC2626',
};

const METRIC_CONFIG = {
  shooting: { name: 'Shot Accuracy', unit: '%', description: 'Goals scored vs shots taken' },
  passing: { name: 'Pass Accuracy', unit: '%', description: 'Passes completed vs attempted' },
  consistency: { name: 'Sessions per Week', unit: '', description: 'How often you train' },
  duration: { name: 'Session Duration', unit: ' min', description: 'Average time per session' },
  load: { name: 'Training Load', unit: '', description: 'Volume × intensity (duration × RPE)' },
};

function PaceHeroCircle({ pace }) {
  const label = pace?.overall?.label || 'steady';
  const velocity = pace?.overall?.velocityPct;
  const color = PACE_COLORS[label] || PACE_COLORS.steady;

  // Glow intensity based on velocity
  const glowSize = Math.min(Math.abs(velocity || 0) * 2, 60);

  return (
    <div className="flex flex-col items-center py-6">
      {/* Glowing circle */}
      <div className="relative">
        <div
          className="w-44 h-44 rounded-full flex flex-col items-center justify-center relative z-10"
          style={{
            background: `radial-gradient(circle, ${color}15 0%, ${color}08 50%, transparent 70%)`,
            border: `3px solid ${color}40`,
          }}
        >
          {/* Animated glow ring */}
          <div
            className="absolute inset-0 rounded-full animate-pulse"
            style={{
              background: `radial-gradient(circle, ${color}10 0%, transparent 60%)`,
              filter: `blur(${glowSize}px)`,
            }}
          />
          <span className="text-4xl font-bold relative z-10" style={{ color }}>
            {velocity != null ? `${velocity > 0 ? '+' : ''}${velocity}%` : '—'}
          </span>
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 relative z-10 mt-1">
            YOUR PACE
          </span>
        </div>
      </div>

      {/* Label */}
      <div className="mt-3 text-center">
        <span
          className="text-sm font-bold uppercase tracking-wider"
          style={{ color }}
        >
          {label}
        </span>
        {velocity != null && (
          <p className="text-xs text-gray-400 mt-0.5">
            {label === 'accelerating' ? 'You\'re improving faster than before'
              : label === 'stalling' ? 'Your improvement has slowed down'
              : 'Maintaining a steady pace'}
          </p>
        )}
      </div>
    </div>
  );
}

function ExpandableMetricCard({ metricKey, metric, sessions, ageGroup, skillLevel }) {
  const [expanded, setExpanded] = useState(false);
  const config = METRIC_CONFIG[metricKey];
  if (!metric || !config) return null;

  // Cohort median for reference line
  const benchKey = PACE_TO_BENCHMARK[metricKey];
  const benchmarkLevel = SKILL_MAP[skillLevel] || null;
  const cohortMedian = (ageGroup && benchmarkLevel && benchKey)
    ? BENCHMARKS?.[ageGroup]?.[benchmarkLevel]?.[benchKey]?.P50 ?? null
    : null;

  const color = PACE_COLORS[metric.label] || PACE_COLORS.steady;
  const velocity = metric.velocityPct;

  // Build trend data for expanded chart
  const trendData = useMemo(() => {
    if (!expanded || !sessions || sessions.length < 3) return [];
    const sorted = [...sessions].sort((a, b) => a.date.localeCompare(b.date));

    return sorted.map(s => {
      let value = null;
      switch (metricKey) {
        case 'shooting':
          value = s.shooting?.shotsTaken > 0 ? Math.round((s.shooting.goals / s.shooting.shotsTaken) * 100) : null;
          break;
        case 'passing':
          value = s.passing?.attempts > 0 ? Math.round((s.passing.completed / s.passing.attempts) * 100) : null;
          break;
        case 'duration':
          value = s.duration || null;
          break;
        case 'load':
          value = (s.duration || 0) * (s.fitness?.rpe || 5);
          break;
        case 'consistency':
          value = null; // Consistency is weekly, not per-session
          break;
      }
      return value != null ? {
        date: new Date(s.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value,
      } : null;
    }).filter(Boolean);
  }, [expanded, sessions, metricKey]);

  // Color bar position (0-100 scale for visual)
  const barPct = Math.max(0, Math.min(100, 50 + (velocity || 0) * 2));

  return (
    <div className="bg-surface rounded-xl border border-gray-100 shadow-card overflow-hidden">
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-3 flex items-center justify-between text-left"
      >
        <div>
          <p className="text-xs font-bold text-gray-700 uppercase tracking-wide">{config.name}</p>
          <div className="flex items-center gap-2 mt-1">
            {/* Color bar */}
            <div className="w-32 h-2 bg-gray-100 rounded-full relative overflow-hidden">
              <div
                className="absolute top-0 left-0 h-full rounded-full transition-all"
                style={{ width: `${barPct}%`, backgroundColor: color }}
              />
            </div>
            <span className="text-xs font-semibold" style={{ color }}>
              {velocity != null ? `${velocity > 0 ? '+' : ''}${velocity}%` : '—'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-sm font-bold text-gray-900">
              {metric.thisWeek != null ? `${metric.thisWeek}${config.unit}` : '—'}
            </p>
            <p className="text-[10px] text-gray-400">this week</p>
          </div>
          <svg className={`w-4 h-4 text-gray-300 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Expanded content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-3" style={{ animation: 'fadeSlideUp 0.2s ease-out' }}>
          {/* Week comparison */}
          <div className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
            <div>
              <span className="text-gray-400">Last week: </span>
              <span className="font-semibold text-gray-600">{metric.lastWeek != null ? `${metric.lastWeek}${config.unit}` : '—'}</span>
            </div>
            <div>
              <span className="text-gray-400">This week: </span>
              <span className="font-semibold text-gray-900">{metric.thisWeek != null ? `${metric.thisWeek}${config.unit}` : '—'}</span>
            </div>
            <span className="font-bold" style={{ color }}>
              {velocity > 0 ? '↑' : velocity < 0 ? '↓' : '→'} {Math.abs(velocity)}%
            </span>
          </div>

          {/* Trend chart */}
          {trendData.length >= 2 && (
            <ResponsiveContainer width="100%" height={120}>
              <LineChart data={trendData}>
                <XAxis dataKey="date" tick={{ fontSize: 9, fill: '#8E8880' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#8E8880' }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  formatter={(val) => [`${val}${config.unit}`, config.name]}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E8E5E0' }}
                />
                {cohortMedian != null && (
                  <ReferenceLine y={cohortMedian} stroke="#9CA3AF" strokeDasharray="4 4"
                    label={{ value: `${ageGroup} avg`, position: 'right', fontSize: 9, fill: '#9CA3AF' }} />
                )}
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} />
              </LineChart>
            </ResponsiveContainer>
          )}

          <p className="text-[10px] text-gray-400">{config.description}</p>
        </div>
      )}
    </div>
  );
}

// ── Skill level mapping (onboarding values → benchmark keys) ──
const SKILL_MAP = {
  'Recreational': 'Recreational',
  'Academy': 'Academy',
  'Semi-Pro': 'Semi-Pro',
  'Professional': 'Professional',
  // Legacy / alternate values
  'beginner': 'Recreational',
  'intermediate': 'Academy',
  'advanced': 'Semi-Pro',
};

// Map Pace metric keys → benchmark metric keys
const PACE_TO_BENCHMARK = {
  shooting: 'shotAccuracy',
  passing: 'passAccuracy',
  consistency: 'sessionsPerWeek',
  load: 'avgSessionLoad',
  duration: null, // no direct benchmark match
};

function PeerContextCard({ pace, sessions, ageGroup, skillLevel }) {
  const benchmarkLevel = SKILL_MAP[skillLevel] || 'Academy';
  const benchmarks = BENCHMARKS?.[ageGroup]?.[benchmarkLevel];

  if (!benchmarks || !pace?.metrics) return null;

  // Compute player's current values and percentiles
  const comparisons = useMemo(() => {
    const results = [];

    for (const [paceKey, benchKey] of Object.entries(PACE_TO_BENCHMARK)) {
      if (!benchKey || !benchmarks[benchKey]) continue;
      const metric = pace.metrics[paceKey];
      if (!metric || metric.thisWeek == null) continue;

      const dist = benchmarks[benchKey];
      const playerValue = metric.thisWeek;
      const percentile = calculatePercentile(playerValue, dist);
      const median = dist.P50;

      results.push({
        paceKey,
        benchKey,
        name: METRIC_CONFIG[paceKey]?.name || paceKey,
        unit: METRIC_CONFIG[paceKey]?.unit || '',
        playerValue,
        median,
        percentile: Math.round(percentile),
        aboveMedian: playerValue >= median,
      });
    }

    // Sort: best percentile first, worst last
    results.sort((a, b) => b.percentile - a.percentile);
    return results;
  }, [pace, benchmarks]);

  if (comparisons.length === 0) return null;

  // Pick the 3 most interesting insights
  const insights = useMemo(() => {
    const picks = [];
    if (comparisons.length > 0) picks.push(comparisons[0]); // best
    if (comparisons.length > 1) picks.push(comparisons[comparisons.length - 1]); // worst
    // Find one near a milestone (P75 or P90)
    const nearMilestone = comparisons.find(c =>
      !picks.includes(c) && (Math.abs(c.percentile - 75) <= 5 || Math.abs(c.percentile - 90) <= 5)
    );
    if (nearMilestone) picks.push(nearMilestone);
    else if (comparisons.length > 2 && !picks.includes(comparisons[1])) picks.push(comparisons[1]);
    return picks;
  }, [comparisons]);

  function insightText(c) {
    if (c.percentile >= 90) return `Your ${c.name.toLowerCase()} puts you in the top 10% of ${ageGroup} ${benchmarkLevel} players. Elite level.`;
    if (c.percentile >= 75) return `Your ${c.name.toLowerCase()} (${c.playerValue}${c.unit}) is above 75% of ${ageGroup} ${benchmarkLevel} players. Strong.`;
    if (c.percentile >= 50) return `Your ${c.name.toLowerCase()} (${c.playerValue}${c.unit}) is above average for ${ageGroup} ${benchmarkLevel} players. Keep pushing.`;
    if (c.percentile >= 25) return `Your ${c.name.toLowerCase()} is below the median for ${ageGroup} ${benchmarkLevel} (${c.median}${c.unit}). Focused work here pays off fast.`;
    return `Your ${c.name.toLowerCase()} has room to grow — most ${ageGroup} ${benchmarkLevel} players are at ${c.median}${c.unit}. A dedicated session each week can close the gap.`;
  }

  function percentileColor(pct) {
    if (pct >= 75) return 'text-green-600 bg-green-50';
    if (pct >= 50) return 'text-accent bg-accent/10';
    if (pct >= 25) return 'text-amber-600 bg-amber-50';
    return 'text-red-500 bg-red-50';
  }

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="text-xs font-bold text-gray-900">Players Like You</h4>
            <p className="text-[10px] text-gray-400">{ageGroup} {benchmarkLevel}</p>
          </div>
          <span className="text-lg">👥</span>
        </div>

        {/* Percentile pills */}
        <div className="flex flex-wrap gap-2">
          {comparisons.map(c => (
            <div key={c.paceKey} className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${percentileColor(c.percentile)}`}>
              {c.name}: P{c.percentile}
            </div>
          ))}
        </div>

        {/* Conversational insights */}
        <div className="space-y-2 pt-1">
          {insights.map(c => (
            <p key={c.paceKey} className="text-xs text-gray-600 leading-relaxed">
              {c.percentile >= 50 ? '✦ ' : '→ '}{insightText(c)}
            </p>
          ))}
        </div>
      </div>
    </Card>
  );
}

export function PaceTab({ sessions = [], onViewMetric, ageGroup, skillLevel }) {
  const pace = useMemo(() => computePace(sessions, 4), [sessions]);

  // Weekly history for bar chart
  const weeklyHistory = useMemo(() => {
    if (!sessions || sessions.length < 5) return [];
    const history = [];
    for (let offset = 0; offset < 8; offset++) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - offset * 7);
      const cutoffStr = cutoffDate.toISOString().split('T')[0];
      const subset = sessions.filter(s => s.date <= cutoffStr);
      if (subset.length >= 5) {
        const p = computePace(subset, 4);
        if (p?.overall?.velocityPct != null) {
          history.unshift({
            week: offset === 0 ? 'Now' : offset === 1 ? '1w' : `${offset}w`,
            velocity: p.overall.velocityPct,
            label: p.overall.label,
          });
        }
      }
    }
    return history;
  }, [sessions]);

  // Empty state
  if (!pace) {
    return (
      <div className="space-y-6 max-w-3xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 text-center">Your Pace</h1>
        <Card>
          <div className="text-center py-12 space-y-3">
            <div className="w-24 h-24 rounded-full bg-gray-100 mx-auto flex items-center justify-center">
              <span className="text-3xl text-gray-300">↑</span>
            </div>
            <p className="text-sm text-gray-600">Not enough data yet</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
              Log at least 5 sessions across 2 weeks to unlock your improvement velocity score.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">YOUR PACE</p>

      {/* Hero Circle */}
      <PaceHeroCircle pace={pace} />

      {/* Recommendation */}
      {pace.recommendation?.text && (
        <Card className={`border-l-4 ${pace.recommendation.urgency === 'high' ? 'border-l-red-500' : pace.recommendation.urgency === 'medium' ? 'border-l-amber-500' : 'border-l-green-500'}`}>
          <p className="text-xs font-semibold text-gray-700 mb-1">
            {pace.overall.label === 'accelerating' ? 'Steady And Improving' : pace.overall.label === 'stalling' ? 'Needs Attention' : 'Holding Steady'}
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">{pace.recommendation.text}</p>
        </Card>
      )}

      {/* Peer Comparison */}
      {ageGroup && skillLevel ? (
        <PeerContextCard pace={pace} sessions={sessions} ageGroup={ageGroup} skillLevel={skillLevel} />
      ) : (
        <Card>
          <div className="flex items-center gap-3 py-1">
            <span className="text-lg">👥</span>
            <div>
              <p className="text-xs font-semibold text-gray-700">See how you compare</p>
              <p className="text-[10px] text-gray-400">Set your age group and skill level in Profile to unlock peer benchmarks.</p>
            </div>
          </div>
        </Card>
      )}

      {/* Weekly Pace History */}
      {weeklyHistory.length >= 2 && (
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">PACE OVER TIME</p>
          <Card>
            <ResponsiveContainer width="100%" height={140}>
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
        </div>
      )}

      {/* Expandable Metric Cards */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">METRIC BREAKDOWN</p>
        <div className="space-y-2">
          {Object.entries(pace.metrics).map(([key, metric]) => (
            <ExpandableMetricCard
              key={key}
              metricKey={key}
              metric={metric}
              sessions={sessions}
              ageGroup={ageGroup}
              skillLevel={skillLevel}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
