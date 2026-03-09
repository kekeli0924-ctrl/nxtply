import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer,
} from 'recharts';
import { getMentalTrendData } from '../utils/stats';

const GRAY = '#78716C';
const GRID = '#E8E5E0';

export function MentalTrendChart({ sessions }) {
  const data = getMentalTrendData(sessions);

  return (
    <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">Mental Performance</h3>
      {!data.length ? (
        <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
          Complete post-session reflections to track mental trends
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
            <XAxis dataKey="date" tick={{ fontSize: 11, fill: GRAY }} />
            <YAxis domain={[1, 5]} tick={{ fontSize: 11, fill: GRAY }} />
            <Tooltip />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Line type="monotone" dataKey="confidence" stroke="#16A34A" strokeWidth={2} dot={{ r: 3 }} name="Confidence" />
            <Line type="monotone" dataKey="focus" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} name="Focus" />
            <Line type="monotone" dataKey="enjoyment" stroke="#D97706" strokeWidth={2} dot={{ r: 3 }} name="Enjoyment" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
