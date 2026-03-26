import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { getWeeklyLoads } from '../utils/stats';
import { useIsMobile } from '../hooks/useIsMobile';

const GRAY = '#78716C';
const GRID = '#E8E5E0';

export function SessionLoadChart({ sessions }) {
  const isMobile = useIsMobile();
  const data = getWeeklyLoads(sessions, 8);
  const hasData = data.some(d => d.totalLoad > 0);

  return (
    <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Weekly Training Load</h3>
      {!hasData ? (
        <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
          Log sessions with RPE to see load trends
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="weekLabel" tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} interval={isMobile ? 'preserveStartEnd' : undefined} />
            <YAxis tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} />
            <Tooltip formatter={(v) => [v, 'Load']} labelFormatter={(l) => `Week of ${l}`} />
            <Bar dataKey="totalLoad" fill="#D97706" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
