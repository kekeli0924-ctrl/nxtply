/**
 * MetricRow — WHOOP-style compact metric card.
 * Shows icon + label on left, value + trend on right.
 * Tapping opens the full-screen trend view.
 */
export function MetricRow({ icon, label, value, sub, trend, trendUp, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-surface rounded-xl border border-gray-100 shadow-card px-4 py-3 flex items-center justify-between hover:shadow-card-hover transition-shadow text-left"
    >
      <div className="flex items-center gap-3 min-w-0">
        {icon && <span className="text-base shrink-0">{icon}</span>}
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wide truncate">{label}</span>
      </div>
      <div className="flex items-center gap-2 shrink-0 ml-3">
        <div className="text-right">
          <p className="text-sm font-bold text-gray-900">{value}</p>
          {sub && <p className="text-[10px] text-gray-400">{sub}</p>}
        </div>
        {trend && (
          <span className={`text-[10px] font-semibold ${trendUp ? 'text-green-600' : trendUp === false ? 'text-red-500' : 'text-gray-400'}`}>
            {trendUp ? '▲' : trendUp === false ? '▼' : ''} {trend}
          </span>
        )}
        <svg className="w-4 h-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  );
}

/**
 * MetricSection — Groups MetricRows with a section header.
 */
export function MetricSection({ title, children }) {
  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wide px-1">{title}</p>
      <div className="space-y-1.5">
        {children}
      </div>
    </div>
  );
}
