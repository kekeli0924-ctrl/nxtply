import { Card } from './ui/Card';

const PACE_STYLES = {
  accelerating: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200', label: 'Accelerating', arrow: '↑' },
  steady: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200', label: 'Steady', arrow: '→' },
  stalling: { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200', label: 'Stalling', arrow: '↓' },
};

const METRIC_LABELS = {
  shooting: 'Shot %',
  passing: 'Pass %',
  consistency: 'Sessions',
  duration: 'Duration',
  load: 'Load',
};

function PaceMetricPill({ name, metric }) {
  if (!metric) return null;
  const style = PACE_STYLES[metric.label] || PACE_STYLES.steady;
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] text-gray-400">{name}</span>
      <span className={`text-[10px] font-semibold ${style.text}`}>
        {style.arrow} {metric.velocityPct != null ? `${metric.velocityPct > 0 ? '+' : ''}${metric.velocityPct}%` : '—'}
      </span>
    </div>
  );
}

export function PaceCard({ pace, onClick }) {
  // Empty state
  if (!pace) {
    return (
      <Card onClick={onClick} className="cursor-pointer hover:shadow-card-hover transition-shadow">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-gray-100 flex items-center justify-center text-xl shrink-0">
            <span className="text-gray-300">⏱</span>
          </div>
          <div>
            <p className="text-sm font-semibold text-gray-700">Your Pace</p>
            <p className="text-xs text-gray-400 mt-0.5">Log a few more sessions to unlock your improvement velocity score.</p>
          </div>
        </div>
      </Card>
    );
  }

  const style = PACE_STYLES[pace.overall.label] || PACE_STYLES.steady;

  return (
    <Card onClick={onClick} className="cursor-pointer hover:shadow-card-hover transition-shadow">
      <div className="space-y-3">
        {/* Header row */}
        <div className="flex items-center gap-3">
          {/* Pace badge */}
          <div className={`w-14 h-14 rounded-xl ${style.bg} border ${style.border} flex flex-col items-center justify-center shrink-0`}>
            <span className={`text-lg font-bold ${style.text}`}>{style.arrow}</span>
            <span className={`text-[8px] font-bold uppercase tracking-wide ${style.text}`}>{style.label}</span>
          </div>

          {/* Title + overall */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-gray-900">Your Pace</p>
              {pace.overall.velocityPct != null && (
                <span className={`text-xs font-semibold ${style.text}`}>
                  {pace.overall.velocityPct > 0 ? '+' : ''}{pace.overall.velocityPct}% weekly
                </span>
              )}
            </div>

            {/* Per-metric pills */}
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              {Object.entries(pace.metrics).map(([key, metric]) => (
                <PaceMetricPill key={key} name={METRIC_LABELS[key]} metric={metric} />
              ))}
            </div>
          </div>

          {/* Chevron */}
          <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>

        {/* Recommendation */}
        {pace.recommendation?.text && (
          <p className="text-xs text-gray-500 leading-relaxed">{pace.recommendation.text}</p>
        )}
      </div>
    </Card>
  );
}
