export function Card({ children, className = '', onClick, style }) {
  return (
    <div
      className={`bg-surface rounded-xl border border-gray-100 shadow-card p-5 ${onClick ? 'cursor-pointer hover:shadow-card-hover transition-shadow' : ''} ${className}`}
      onClick={onClick}
      style={style}
    >
      {children}
    </div>
  );
}

export function StatCard({ label, value, sub }) {
  return (
    <Card className="text-center">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
      <p className="text-2xl font-bold text-accent mt-1">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </Card>
  );
}
