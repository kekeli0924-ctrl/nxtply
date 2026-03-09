import { useMemo } from 'react';
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ResponsiveContainer, Tooltip,
} from 'recharts';
import { computeFourPillars } from '../utils/stats';

const ACCENT = '#1E3A5F';
const GRID = '#E8E5E0';
const LABEL = '#78716C';

function CustomTick({ payload, x, y, textAnchor }) {
  return (
    <text x={x} y={y} textAnchor={textAnchor} fill={LABEL} fontSize={12} fontWeight={500}>
      {payload.value}
    </text>
  );
}

export function FourPillarChart({ sessions, decisionJournal = [] }) {
  const pillars = useMemo(
    () => computeFourPillars(sessions, decisionJournal),
    [sessions, decisionJournal]
  );

  if (!pillars) return null;

  const avgScore = Math.round(pillars.reduce((s, p) => s + p.score, 0) / pillars.length);

  return (
    <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-5" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-gray-700">Development Balance</h3>
        <span className="text-xs font-medium text-accent">{avgScore}/100</span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <RadarChart data={pillars} cx="50%" cy="50%" outerRadius="70%">
          <PolarGrid stroke={GRID} />
          <PolarAngleAxis dataKey="pillar" tick={<CustomTick />} />
          <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
          <Radar
            dataKey="score"
            stroke={ACCENT}
            fill={ACCENT}
            fillOpacity={0.2}
            strokeWidth={2}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #E8E5E0',
              borderRadius: '8px',
              color: '#292524',
              fontSize: '12px',
            }}
            formatter={(value) => [`${value}/100`, 'Score']}
          />
        </RadarChart>
      </ResponsiveContainer>

      {/* Pillar scores row */}
      <div className="grid grid-cols-4 gap-2 mt-1">
        {pillars.map(p => (
          <div key={p.pillar} className="text-center">
            <p className="text-lg font-bold text-accent">{p.score}</p>
            <p className="text-[10px] text-gray-400">{p.pillar}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
