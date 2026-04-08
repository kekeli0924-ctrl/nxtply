import { useState, useMemo } from 'react';
import { LineChart, Line, BarChart, Bar, ResponsiveContainer, XAxis, YAxis, Tooltip, ReferenceLine } from 'recharts';
import { Card } from './ui/Card';

const TIME_RANGES = [
  { key: 'W', label: 'W', days: 7 },
  { key: 'M', label: 'M', days: 30 },
  { key: '6M', label: '6M', days: 180 },
];

function formatDateShort(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/**
 * MetricTrendView — Full-screen trend page for a single metric.
 * Shows a chart with time range selector, current value, average, and insight.
 */
export function MetricTrendView({
  title,
  sessions = [],
  metricFn,        // (session) => number | null
  chartType = 'line', // 'line' | 'bar'
  unit = '',
  color = '#1E3A5F',
  onBack,
  currentValue,    // optional override for display
  insight,         // optional written insight text
  children,        // optional custom content below chart
}) {
  const [range, setRange] = useState('M');

  const selectedRange = TIME_RANGES.find(r => r.key === range) || TIME_RANGES[1];
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - selectedRange.days);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];

  const chartData = useMemo(() => {
    if (!metricFn) return [];
    return sessions
      .filter(s => s.date >= cutoffStr)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => {
        const val = metricFn(s);
        return val != null ? { date: s.date, label: formatDateShort(s.date), value: val } : null;
      })
      .filter(Boolean);
  }, [sessions, metricFn, cutoffStr]);

  const avg = useMemo(() => {
    if (chartData.length === 0) return null;
    const sum = chartData.reduce((s, d) => s + d.value, 0);
    return Math.round((sum / chartData.length) * 10) / 10;
  }, [chartData]);

  const latestValue = currentValue ?? (chartData.length > 0 ? chartData[chartData.length - 1].value : null);

  // Trend vs previous period
  const trend = useMemo(() => {
    if (chartData.length < 2) return null;
    const mid = Math.floor(chartData.length / 2);
    const firstHalf = chartData.slice(0, mid);
    const secondHalf = chartData.slice(mid);
    const avgFirst = firstHalf.reduce((s, d) => s + d.value, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, d) => s + d.value, 0) / secondHalf.length;
    const diff = avgSecond - avgFirst;
    return { diff: Math.round(diff * 10) / 10, up: diff > 0 };
  }, [chartData]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          {latestValue != null && (
            <p className="text-3xl font-bold text-accent mt-1">
              {typeof latestValue === 'number' ? Math.round(latestValue * 10) / 10 : latestValue}{unit}
              {trend && (
                <span className={`text-sm font-semibold ml-2 ${trend.up ? 'text-green-600' : 'text-red-500'}`}>
                  {trend.up ? '▲' : '▼'} {Math.abs(trend.diff)}{unit}
                </span>
              )}
            </p>
          )}
        </div>

        {/* Time range selector */}
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {TIME_RANGES.map(r => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                range === r.key ? 'bg-white text-accent shadow-sm' : 'text-gray-500'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <Card>
        {chartData.length === 0 ? (
          <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
            No data for this period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            {chartType === 'bar' ? (
              <BarChart data={chartData}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8E8880' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8E8880' }} axisLine={false} tickLine={false} width={35} />
                <Tooltip
                  formatter={(val) => [`${Math.round(val * 10) / 10}${unit}`, title]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E8E5E0' }}
                />
                {avg != null && <ReferenceLine y={avg} stroke="#C4956A" strokeDasharray="4 4" label={{ value: `Avg: ${avg}${unit}`, fontSize: 10, fill: '#C4956A', position: 'right' }} />}
                <Bar dataKey="value" fill={color} radius={[4, 4, 0, 0]} />
              </BarChart>
            ) : (
              <LineChart data={chartData}>
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#8E8880' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: '#8E8880' }} axisLine={false} tickLine={false} width={35} />
                <Tooltip
                  formatter={(val) => [`${Math.round(val * 10) / 10}${unit}`, title]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E8E5E0' }}
                />
                {avg != null && <ReferenceLine y={avg} stroke="#C4956A" strokeDasharray="4 4" label={{ value: `Avg: ${avg}${unit}`, fontSize: 10, fill: '#C4956A', position: 'right' }} />}
                <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: 3, fill: color }} activeDot={{ r: 5 }} />
              </LineChart>
            )}
          </ResponsiveContainer>
        )}
      </Card>

      {/* Insight */}
      {insight && (
        <Card>
          <p className="text-xs text-gray-600 leading-relaxed">{insight}</p>
        </Card>
      )}

      {/* Average summary */}
      {avg != null && (
        <div className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3 text-xs">
          <span className="text-gray-500">Period average</span>
          <span className="font-bold text-accent">{avg}{unit}</span>
        </div>
      )}

      {/* Custom content */}
      {children}
    </div>
  );
}
