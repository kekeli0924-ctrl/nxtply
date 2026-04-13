import { useMemo } from 'react';
import { Card } from './ui/Card';
import { computePace } from '../utils/pace';
import { getPaceLabel as getIdentityPaceLabel } from '../utils/identity';

// ── Constants ────────────────────────────────────────────────────────────────

// Position weight table — imported conceptually from pace.js. We read it from
// the pace output's `.position` field + this local map so we never duplicate
// the actual calculation logic. If pace.js changes its weights, update here.
// (Ideally pace.js would export POSITION_WEIGHTS, but we're not modifying it.)
const POSITION_WEIGHTS = {
  Striker:  { shooting: 0.40, passing: 0.10, consistency: 0.20, duration: 0.10, load: 0.20 },
  Winger:   { shooting: 0.25, passing: 0.15, consistency: 0.20, duration: 0.15, load: 0.25 },
  CAM:      { shooting: 0.25, passing: 0.30, consistency: 0.20, duration: 0.10, load: 0.15 },
  CDM:      { shooting: 0.05, passing: 0.35, consistency: 0.25, duration: 0.15, load: 0.20 },
  CB:       { shooting: 0.05, passing: 0.30, consistency: 0.25, duration: 0.20, load: 0.20 },
  GK:       { shooting: 0.05, passing: 0.15, consistency: 0.30, duration: 0.20, load: 0.30 },
  Fullback: { shooting: 0.10, passing: 0.20, consistency: 0.25, duration: 0.15, load: 0.30 },
  CM:       { shooting: 0.10, passing: 0.30, consistency: 0.25, duration: 0.15, load: 0.20 },
  General:  { shooting: 0.25, passing: 0.20, consistency: 0.25, duration: 0.15, load: 0.15 },
};

const METRIC_NAMES = {
  shooting: 'Shot accuracy',
  passing: 'Pass completion',
  consistency: 'Sessions per week',
  duration: 'Avg session length',
  load: 'Training load',
};

const METRIC_UNITS = {
  shooting: '%',
  passing: '%',
  consistency: '',
  duration: 'min',
  load: '',
};

const PACE_COLORS = {
  accelerating: '#16A34A',
  steady: '#D97706',
  stalling: '#DC2626',
};

// ── Plain-English sentence generator ─────────────────────────────────────────

// NOTE: computeMetricPace returns shooting/passing values that are already
// percentages (e.g. 31 for 31%, not 0.31). Do NOT multiply by 100 again.
function formatMetricValue(key, value) {
  if (value == null) return '—';
  if (key === 'shooting' || key === 'passing') {
    return `${Math.round(value)}%`;
  }
  if (key === 'duration') return `${Math.round(value)} min`;
  if (key === 'consistency') return `${value} session${value !== 1 ? 's' : ''}`;
  if (key === 'load') return `${Math.round(value)}`;
  return `${value}`;
}

function generatePlainEnglishSummary(pace, sessions) {
  if (!pace) return null;

  const { overall, metrics } = pace;

  // No-data case
  if (overall.velocityPct == null) {
    return "Your Pace will start showing trends after your second week of training. Right now we're recording your baseline.";
  }

  // Gather ranked contributors (biggest absolute movers, weighted by position importance)
  const weights = POSITION_WEIGHTS[pace.position] || POSITION_WEIGHTS.General;
  const movers = Object.entries(metrics)
    .filter(([, m]) => m != null && m.velocityPct != null)
    .map(([key, m]) => ({
      key,
      name: METRIC_NAMES[key],
      velocity: m.velocityPct,
      weight: weights[key] || 0,
      // "Impact" combines how much it moved with how much it matters
      impact: Math.abs(m.velocityPct) * (weights[key] || 0),
      thisWeek: m.thisWeek,
      lastWeek: m.lastWeek,
    }))
    .sort((a, b) => b.impact - a.impact);

  if (movers.length === 0) {
    return "Not enough metric data to explain the movement yet. Keep logging sessions with stats.";
  }

  const delta = overall.velocityPct;
  const absDelta = Math.abs(delta);

  // Flat case: |delta| < 1%
  if (absDelta < 1) {
    return "Your Pace is roughly the same as last week — your key metrics held steady.";
  }

  // Pick the 1–2 biggest contributors
  const top = movers.slice(0, 2);
  const direction = delta > 0 ? 'went up' : 'dropped';

  const describeMove = (m) => {
    if (m.key === 'consistency') {
      const diff = (m.thisWeek || 0) - (m.lastWeek || 0);
      if (diff > 0) return `you logged ${diff} more session${diff > 1 ? 's' : ''} this week`;
      if (diff < 0) return `you trained ${Math.abs(diff)} fewer time${Math.abs(diff) > 1 ? 's' : ''} this week`;
      return 'your session count held steady';
    }
    if (m.key === 'shooting' || m.key === 'passing') {
      const from = m.lastWeek != null ? `${Math.round(m.lastWeek)}%` : '—';
      const to = m.thisWeek != null ? `${Math.round(m.thisWeek)}%` : '—';
      const label = m.key === 'shooting' ? 'shot accuracy' : 'pass completion';
      if (m.velocity > 0) return `your ${label} improved from ${from} to ${to}`;
      return `your ${label} dropped from ${from} to ${to}`;
    }
    if (m.key === 'duration') {
      const from = m.lastWeek != null ? `${Math.round(m.lastWeek)}m` : '—';
      const to = m.thisWeek != null ? `${Math.round(m.thisWeek)}m` : '—';
      if (m.velocity > 0) return `your average session grew from ${from} to ${to}`;
      return `your average session shrank from ${from} to ${to}`;
    }
    if (m.key === 'load') {
      if (m.velocity > 0) return 'your training volume and intensity increased';
      return 'your training volume and intensity decreased';
    }
    return `${m.name.toLowerCase()} ${m.velocity > 0 ? 'improved' : 'declined'}`;
  };

  if (top.length === 1) {
    return `Your Pace ${direction} because ${describeMove(top[0])}.`;
  }

  return `Your Pace ${direction} because ${describeMove(top[0])} and ${describeMove(top[1])}.`;
}

// ── Session list for this period ─────────────────────────────────────────────

function getThisWeekSessions(sessions) {
  if (!sessions || sessions.length === 0) return [];
  const now = new Date();
  const weekAgo = new Date(now);
  weekAgo.setDate(weekAgo.getDate() - 7);
  const cutoff = weekAgo.toISOString().split('T')[0];
  return sessions
    .filter(s => s.date > cutoff)
    .sort((a, b) => b.date.localeCompare(a.date));
}

// ── Component ────────────────────────────────────────────────────────────────

export function PaceAuditView({ sessions, position, playerIdentity, onBack, onViewSession }) {
  const pace = useMemo(() => computePace(sessions, 4, position), [sessions, position]);
  const thisWeekSessions = useMemo(() => getThisWeekSessions(sessions), [sessions]);
  const weights = POSITION_WEIGHTS[position] || POSITION_WEIGHTS.General;
  const positionLabel = position || 'General';

  // Sort metrics by weight (heaviest first) for the movement section
  const sortedMetrics = useMemo(() => {
    if (!pace?.metrics) return [];
    return Object.entries(pace.metrics)
      .filter(([, m]) => m != null)
      .sort(([keyA], [keyB]) => (weights[keyB] || 0) - (weights[keyA] || 0));
  }, [pace, weights]);

  // Weight bar visual: sorted by weight descending
  const sortedWeights = useMemo(() => {
    return Object.entries(weights)
      .sort(([, a], [, b]) => b - a)
      .map(([key, w]) => ({ key, weight: w, name: METRIC_NAMES[key] || key, pct: Math.round(w * 100) }));
  }, [weights]);

  const summary = useMemo(() => generatePlainEnglishSummary(pace, sessions), [pace, sessions]);
  const overallColor = pace ? (PACE_COLORS[pace.overall.label] || PACE_COLORS.steady) : '#9CA3AF';

  // ── First-week / no-data states ────────────────────────────────────────────

  if (!sessions || sessions.length === 0) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <BackButton onClick={onBack} />
        <Card>
          <div className="text-center py-10 space-y-3">
            <div className="w-20 h-20 rounded-full bg-gray-100 mx-auto flex items-center justify-center">
              <span className="text-3xl text-gray-300">↑</span>
            </div>
            <p className="text-sm font-semibold text-gray-700">No sessions yet</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
              Log your first training session and your Pace story starts here.
            </p>
          </div>
        </Card>
        <PaceExplainer />
      </div>
    );
  }

  if (!pace) {
    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <BackButton onClick={onBack} />
        <Card>
          <div className="text-center py-10 space-y-3">
            <div className="w-20 h-20 rounded-full bg-gray-100 mx-auto flex items-center justify-center">
              <span className="text-3xl text-gray-300">↑</span>
            </div>
            <p className="text-sm font-semibold text-gray-700">Building your baseline</p>
            <p className="text-xs text-gray-400 max-w-xs mx-auto leading-relaxed">
              Your Pace will start showing trends once you've logged at least 5 sessions across 2 weeks.
              Right now we're recording your baseline — keep training.
            </p>
          </div>
        </Card>
        <PaceExplainer />
      </div>
    );
  }

  // ── Main audit view ────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <BackButton onClick={onBack} />

      {/* ── 1. Plain-English summary ────────────────────────────────────── */}
      <Card>
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: overallColor + '18', border: `2px solid ${overallColor}40` }}
          >
            <span className="text-lg font-bold" style={{ color: overallColor }}>
              {pace.overall.label === 'accelerating' ? '↑' : pace.overall.label === 'stalling' ? '↓' : '→'}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-bold" style={{ color: overallColor }}>
                {pace.overall.velocityPct > 0 ? '+' : ''}{pace.overall.velocityPct}%
              </span>
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                {pace.overall.label}
              </span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
          </div>
        </div>
      </Card>

      {/* ── 2. Sessions this period ─────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">
          Sessions This Week ({thisWeekSessions.length})
        </p>
        {thisWeekSessions.length === 0 ? (
          <Card>
            <p className="text-xs text-gray-400 text-center py-3">
              No sessions logged this week yet.
            </p>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {thisWeekSessions.map(s => (
              <SessionRow
                key={s.id}
                session={s}
                position={position}
                onTap={() => onViewSession?.(s)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── 3. Position weight breakdown ────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">
          What Moves Your Pace
        </p>
        <Card>
          <p className="text-xs text-gray-500 mb-3">
            Because you're a <span className="font-semibold text-gray-700">{positionLabel}</span>, your Pace weights:
          </p>
          <div className="space-y-2">
            {sortedWeights.map(({ key, name, pct }) => (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[11px] text-gray-600 w-28 shrink-0">{name}</span>
                <div className="flex-1 h-2.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-accent/60"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-gray-500 w-8 text-right">{pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* ── 4. Metric-level movement ────────────────────────────────────── */}
      <div>
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide px-1 mb-2">
          Metric Movement
        </p>
        <div className="space-y-1.5">
          {sortedMetrics.map(([key, metric]) => {
            const color = PACE_COLORS[metric.label] || PACE_COLORS.steady;
            const weightPct = Math.round((weights[key] || 0) * 100);
            return (
              <Card key={key}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <p className="text-xs font-semibold text-gray-700">{METRIC_NAMES[key]}</p>
                      <span className="text-[9px] text-gray-400">({weightPct}%)</span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      {formatMetricValue(key, metric.lastWeek)} → {formatMetricValue(key, metric.thisWeek)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold" style={{ color }}>
                      {metric.velocityPct > 0 ? '+' : ''}{metric.velocityPct}%
                    </span>
                    <span className="text-base" style={{ color }}>
                      {metric.velocityPct > 2 ? '↑' : metric.velocityPct < -2 ? '↓' : '→'}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      {/* ── 5. Explainer footer ─────────────────────────────────────────── */}
      <PaceExplainer />
    </div>
  );
}

// ── Subcomponents ────────────────────────────────────────────────────────────

function BackButton({ onClick }) {
  return (
    <button onClick={onClick} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
      </svg>
      Back
    </button>
  );
}

function SessionRow({ session, position, onTap }) {
  const s = session;
  const shotPct = s.shooting?.shotsTaken > 0
    ? Math.round((s.shooting.goals / s.shooting.shotsTaken) * 100)
    : null;
  const passPct = s.passing?.attempts > 0
    ? Math.round((s.passing.completed / s.passing.attempts) * 100)
    : null;
  const dateLabel = new Date(s.date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  // Show the most position-relevant stat prominently
  const weights = POSITION_WEIGHTS[position] || POSITION_WEIGHTS.General;
  const shootingWeight = weights.shooting || 0;
  const passingWeight = weights.passing || 0;

  return (
    <button
      onClick={onTap}
      className="w-full text-left bg-surface rounded-xl border border-gray-100 px-3 py-2.5 flex items-center justify-between hover:bg-gray-50 transition-colors"
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-700">{dateLabel}</span>
          <span className="text-[10px] text-gray-400">{s.duration}m</span>
        </div>
        <p className="text-[10px] text-gray-400 truncate mt-0.5">
          {(s.drills || []).slice(0, 2).join(', ')}{(s.drills || []).length > 2 ? ` +${s.drills.length - 2}` : ''}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0 ml-2">
        {shotPct != null && (
          <div className="text-right">
            <p className="text-[10px] text-gray-400">Shot</p>
            <p className="text-xs font-semibold text-gray-700">{shotPct}%</p>
          </div>
        )}
        {passPct != null && (
          <div className="text-right">
            <p className="text-[10px] text-gray-400">Pass</p>
            <p className="text-xs font-semibold text-gray-700">{passPct}%</p>
          </div>
        )}
        <svg className="w-3.5 h-3.5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

function PaceExplainer() {
  return (
    <div className="px-2 pb-4">
      <p className="text-[10px] text-gray-300 leading-relaxed text-center">
        Pace measures how much your training is improving week over week,
        weighted by what matters most for your position. It's not a grade —
        it's a trend signal.
      </p>
    </div>
  );
}
