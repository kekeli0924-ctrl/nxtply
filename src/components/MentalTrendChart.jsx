import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { getMentalTrendData } from '../utils/stats';
import { useIsMobile } from '../hooks/useIsMobile';

const GRAY = '#78716C';
const GRID = '#E8E5E0';

export function MentalTrendChart({ sessions }) {
  const isMobile = useIsMobile();
  const data = getMentalTrendData(sessions);

  return (
    <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Mental Performance</h3>
      {!data.length ? (
        <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
          Complete post-session reflections to track mental trends
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} interval={isMobile ? 'preserveStartEnd' : undefined} />
            <YAxis domain={[1, 5]} tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: isMobile ? 10 : 11 }} />
            <Line type="monotone" dataKey="confidence" stroke="#16A34A" strokeWidth={2} dot={{ r: isMobile ? 5 : 3 }} activeDot={{ r: isMobile ? 8 : 6 }} name="Confidence" />
            <Line type="monotone" dataKey="focus" stroke="#2563EB" strokeWidth={2} dot={{ r: isMobile ? 5 : 3 }} activeDot={{ r: isMobile ? 8 : 6 }} name="Focus" />
            <Line type="monotone" dataKey="enjoyment" stroke="#D97706" strokeWidth={2} dot={{ r: isMobile ? 5 : 3 }} activeDot={{ r: isMobile ? 8 : 6 }} name="Enjoyment" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
