import { useMemo } from 'react';
import { computeComparison, getTier } from '../utils/benchmarks';

function getOrdinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function tierColor(percentile) {
  if (percentile >= 75) return '#22c55e';
  if (percentile >= 50) return '#1E3A5F';
  if (percentile >= 25) return '#f59e0b';
  return '#9CA3AF';
}

// ── PercentileRing ─────────────────────────────────────────────────────────

function PercentileRing({ percentile, size = 72 }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - percentile / 100);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E8E5E0" strokeWidth={4} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={tierColor(percentile)} strokeWidth={4}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold text-accent leading-none">{percentile}</span>
        <span className="text-[10px] text-gray-400">pctl</span>
      </div>
    </div>
  );
}

// ── MetricBar ──────────────────────────────────────────────────────────────

function MetricBar({ metric }) {
  const formatted = metric.value !== null
    ? (metric.unit === '%' || metric.unit === '%pts'
      ? `${metric.value}${metric.unit}`
      : `${metric.value} ${metric.unit}`)
    : '--';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-gray-600">{metric.label}</span>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-gray-900">{formatted}</span>
          <span className={`text-[10px] font-medium px-1 py-0.5 rounded ${metric.tier.bgColor} ${metric.tier.color}`}>
            P{metric.percentile}
          </span>
        </div>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full"
          style={{
            width: `${metric.percentile}%`,
            backgroundColor: tierColor(metric.percentile),
            transition: 'width 0.5s ease',
          }}
        />
      </div>
    </div>
  );
}

// ── Contextual Message ─────────────────────────────────────────────────────

function generateContextMessage(comparison) {
  const { overall, ageGroup, skillLevel, metrics } = comparison;
  const best = metrics.reduce((a, b) => a.percentile > b.percentile ? a : b, metrics[0]);

  if (overall.percentile >= 75) {
    return `You train at an elite level among ${ageGroup} ${skillLevel} players. Your strongest area is ${best.label.toLowerCase()}.`;
  }
  if (overall.percentile >= 50) {
    return `You're above average among ${ageGroup} ${skillLevel} players. ${best.label} is your standout metric at the ${getOrdinal(best.percentile)} percentile.`;
  }
  if (overall.percentile >= 25) {
    return `You're building a solid foundation. Increasing training consistency will help you climb the ranks among ${ageGroup} ${skillLevel} players.`;
  }
  return `Every session counts. Focus on consistency to move up among ${ageGroup} ${skillLevel} players.`;
}

// ── ComparisonCard ─────────────────────────────────────────────────────────

export function ComparisonCard({ sessions, ageGroup, skillLevel, onOpenSettings }) {
  const comparison = useMemo(
    () => computeComparison(sessions, ageGroup, skillLevel),
    [sessions, ageGroup, skillLevel]
  );

  // State 1: No profile set
  if (!ageGroup || !skillLevel) {
    return (
      <div className="bg-surface rounded-xl border border-gray-100 p-5" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="flex items-center gap-2 mb-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-700">How Do You Stack Up?</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Set your age group and skill level to see how your training compares to players like you.
        </p>
        {onOpenSettings && (
          <button
            onClick={onOpenSettings}
            className="px-4 py-2 rounded-lg font-semibold text-sm bg-accent text-white hover:bg-accent-light transition-colors"
          >
            Set Up Profile
          </button>
        )}
      </div>
    );
  }

  // State 2: Not enough data
  if (!comparison) return null;

  // State 3: Full comparison
  return (
    <div className="bg-surface rounded-xl border border-gray-100 p-5" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          <h3 className="text-sm font-semibold text-gray-700">Peer Comparison</h3>
        </div>
        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${comparison.overall.tier.bgColor} ${comparison.overall.tier.color}`}>
          {comparison.overall.tier.label}
        </span>
      </div>

      {/* Overall Percentile */}
      <div className="flex items-center gap-4 mb-4">
        <PercentileRing percentile={comparison.overall.percentile} />
        <div>
          <p className="text-sm font-semibold text-gray-900">
            {getOrdinal(comparison.overall.percentile)} percentile
          </p>
          <p className="text-xs text-gray-500">
            vs {comparison.ageGroup} {comparison.skillLevel} players
          </p>
        </div>
      </div>

      {/* Individual Metrics */}
      <div className="space-y-2.5">
        {comparison.metrics.map(metric => (
          <MetricBar key={metric.key} metric={metric} />
        ))}
      </div>

      {/* Contextual Message */}
      <p className="text-xs text-gray-500 mt-3 bg-gray-50 rounded-lg px-3 py-2">
        {generateContextMessage(comparison)}
      </p>
    </div>
  );
}
