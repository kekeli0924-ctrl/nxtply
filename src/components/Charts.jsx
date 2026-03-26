import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import { getShotPercentage, getPassPercentage, formatDateShort, getFOETrend, getZoneHeatmapData } from '../utils/stats';
import { useIsMobile } from '../hooks/useIsMobile';

const ACCENT = '#1E3A5F';
const GRAY = '#78716C';
const GRID = '#E8E5E0';

function ChartWrapper({ children, title, empty }) {
  return (
    <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-5">
      <h3 className="text-sm font-semibold text-gray-700 mb-4">{title}</h3>
      {empty ? (
        <div className="h-48 flex items-center justify-center text-gray-300 text-sm">
          Log your first session to see trends here
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export function ShotPercentChart({ sessions }) {
  const isMobile = useIsMobile();
  const data = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map(s => ({
      date: formatDateShort(s.date),
      value: getShotPercentage(s),
    }))
    .filter(d => d.value !== null);

  return (
    <ChartWrapper title="Shot % (Last 30 Sessions)" empty={!data.length}>
      <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} interval={isMobile ? 'preserveStartEnd' : undefined} />
          <YAxis domain={[0, 100]} tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} unit="%" />
          <Tooltip formatter={(v) => [`${v}%`, 'Shot %']} />
          <Line type="monotone" dataKey="value" stroke={ACCENT} strokeWidth={2} dot={{ r: isMobile ? 5 : 3 }} activeDot={{ r: isMobile ? 8 : 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

export function PassPercentChart({ sessions }) {
  const isMobile = useIsMobile();
  const data = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map(s => ({
      date: formatDateShort(s.date),
      value: getPassPercentage(s),
    }))
    .filter(d => d.value !== null);

  return (
    <ChartWrapper title="Pass Completion % (Last 30 Sessions)" empty={!data.length}>
      <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} interval={isMobile ? 'preserveStartEnd' : undefined} />
          <YAxis domain={[0, 100]} tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} unit="%" />
          <Tooltip formatter={(v) => [`${v}%`, 'Pass %']} />
          <Line type="monotone" dataKey="value" stroke="#2563EB" strokeWidth={2} dot={{ r: isMobile ? 5 : 3 }} activeDot={{ r: isMobile ? 8 : 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

export function DurationChart({ sessions }) {
  const isMobile = useIsMobile();
  const data = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map(s => ({
      date: formatDateShort(s.date),
      value: s.duration,
    }));

  return (
    <ChartWrapper title="Session Duration (min)" empty={!data.length}>
      <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} interval={isMobile ? 'preserveStartEnd' : undefined} />
          <YAxis tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} />
          <Tooltip formatter={(v) => [`${v} min`, 'Duration']} />
          <Bar dataKey="value" fill={ACCENT} radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

export function RPEChart({ sessions }) {
  const isMobile = useIsMobile();
  const data = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30)
    .map(s => ({
      date: formatDateShort(s.date),
      value: s.fitness?.rpe ?? null,
    }))
    .filter(d => d.value !== null);

  return (
    <ChartWrapper title="RPE Over Time" empty={!data.length}>
      <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} interval={isMobile ? 'preserveStartEnd' : undefined} />
          <YAxis domain={[1, 10]} tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} />
          <Tooltip formatter={(v) => [v, 'RPE']} />
          <Line type="monotone" dataKey="value" stroke="#D97706" strokeWidth={2} dot={{ r: isMobile ? 5 : 3 }} activeDot={{ r: isMobile ? 8 : 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

const ZONE_COLORS = ['#1E3A5F', '#2A4A73', '#3B82F6', '#60A5FA', '#8B5CF6', '#A78BFA'];

export function FOETrendChart({ sessions }) {
  const isMobile = useIsMobile();
  const data = getFOETrend(sessions, 15);

  return (
    <ChartWrapper title="Finishing Over Expected (FOE)" empty={!data.length}>
      <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} interval={isMobile ? 'preserveStartEnd' : undefined} />
          <YAxis tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} />
          <Tooltip formatter={(v, name) => [+v.toFixed(2), name === 'foe' ? 'FOE' : name === 'goals' ? 'Goals' : 'xG']} />
          <Bar dataKey="foe" fill="#10B981" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}

export function ShotPortfolioChart({ sessions }) {
  const isMobile = useIsMobile();
  // Aggregate zone distribution across all sessions
  const zoneTotals = {};
  for (const s of sessions) {
    const zd = getZoneHeatmapData(s);
    if (!zd) continue;
    for (const [zone, data] of Object.entries(zd)) {
      if (!zoneTotals[zone]) zoneTotals[zone] = { shots: 0, goals: 0 };
      zoneTotals[zone].shots += data.shots;
      zoneTotals[zone].goals += data.goals;
    }
  }
  const data = Object.entries(zoneTotals)
    .filter(([, v]) => v.shots > 0)
    .map(([zone, v]) => ({
      name: zone.replace('-', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      value: v.shots,
      goals: v.goals,
      pct: Math.round((v.goals / v.shots) * 100),
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <ChartWrapper title="Shot Portfolio (Zone Distribution)" empty={!data.length}>
      <div className={isMobile ? 'flex flex-col items-center gap-3' : 'flex items-center gap-4'}>
        <ResponsiveContainer width={isMobile ? '100%' : '50%'} height={isMobile ? 150 : 180}>
          <PieChart>
            <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={isMobile ? 55 : 70} innerRadius={isMobile ? 25 : 35}>
              {data.map((_, i) => <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(v, name) => [`${v} shots`, name]} />
          </PieChart>
        </ResponsiveContainer>
        <div className={`${isMobile ? 'w-full' : 'flex-1'} space-y-1`}>
          {data.map((d, i) => (
            <div key={d.name} className="flex items-center gap-2 text-xs">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: ZONE_COLORS[i % ZONE_COLORS.length] }} />
              <span className="text-gray-600 flex-1">{d.name}</span>
              <span className="font-medium text-gray-900">{d.value}</span>
              <span className="text-gray-400">({d.pct}%)</span>
            </div>
          ))}
        </div>
      </div>
    </ChartWrapper>
  );
}

export function DrillTrendChart({ sessions, statFn, label, color = ACCENT }) {
  const isMobile = useIsMobile();
  const data = [...sessions]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(s => ({
      date: formatDateShort(s.date),
      value: statFn(s),
    }))
    .filter(d => d.value !== null);

  return (
    <ChartWrapper title={label} empty={!data.length}>
      <ResponsiveContainer width="100%" height={isMobile ? 160 : 200}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
          <XAxis dataKey="date" tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} interval={isMobile ? 'preserveStartEnd' : undefined} />
          <YAxis tick={{ fontSize: isMobile ? 10 : 11, fill: GRAY }} />
          <Tooltip />
          <Line type="monotone" dataKey="value" stroke={color} strokeWidth={2} dot={{ r: isMobile ? 5 : 3 }} activeDot={{ r: isMobile ? 8 : 6 }} />
        </LineChart>
      </ResponsiveContainer>
    </ChartWrapper>
  );
}
