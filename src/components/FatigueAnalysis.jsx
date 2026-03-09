import { Card } from './ui/Card';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { computeFatigueDecay, diagnoseFatigue, getAverageFatigueScore } from '../utils/stats';

export function FatigueAnalysis({ sessions }) {
  const sessionsWithPhases = sessions.filter(
    s => s.shooting?.phases || s.passing?.phases || s.fitness?.phases
  );

  if (!sessionsWithPhases.length) return null;

  const latestSession = [...sessionsWithPhases].sort((a, b) => b.date.localeCompare(a.date))[0];
  const decay = computeFatigueDecay(latestSession);
  const diagnosis = diagnoseFatigue(latestSession);
  const avgScore = getAverageFatigueScore(sessionsWithPhases, 7);

  if (!decay) return null;

  const phaseChartData = buildPhaseChartData(decay.phases);

  const scoreColor = decay.score >= 80 ? 'text-green-600' : decay.score >= 60 ? 'text-amber-600' : 'text-red-500';
  const scoreBg = decay.score >= 80 ? 'bg-green-50' : decay.score >= 60 ? 'bg-amber-50' : 'bg-red-50';
  const severityColors = {
    none: 'bg-green-50 text-green-700',
    low: 'bg-blue-50 text-blue-700',
    moderate: 'bg-amber-50 text-amber-700',
    high: 'bg-red-50 text-red-700',
  };

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Fatigue Analysis</h3>

      {/* Score + Avg Row */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className={`${scoreBg} rounded-lg p-3 text-center`}>
          <p className="text-xs text-gray-500">Latest Decay Score</p>
          <p className={`text-3xl font-bold ${scoreColor}`}>{decay.score}</p>
          <p className="text-xs text-gray-400">out of 100</p>
        </div>
        <div className="bg-gray-50 rounded-lg p-3 text-center">
          <p className="text-xs text-gray-500">
            {sessionsWithPhases.length > 1 ? `${Math.min(sessionsWithPhases.length, 7)}-Session Avg` : 'Sprint Decay'}
          </p>
          {avgScore !== null && sessionsWithPhases.length > 1 ? (
            <>
              <p className="text-3xl font-bold text-accent">{avgScore}</p>
              <p className="text-xs text-gray-400">out of 100</p>
            </>
          ) : (
            <>
              <p className="text-3xl font-bold text-accent">
                {decay.ratios.fitness != null ? `${Math.round(decay.ratios.fitness * 100)}%` : '\u2014'}
              </p>
              <p className="text-xs text-gray-400">late vs early</p>
            </>
          )}
        </div>
      </div>

      {/* Phase Comparison Chart */}
      {phaseChartData.length > 1 && (
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Phase Performance (Latest Session)</p>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={phaseChartData} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E8E5E0" />
              <XAxis dataKey="phase" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} unit="%" />
              <Tooltip formatter={(value) => `${value}%`} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="shotPct" name="Shot %" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
              <Bar dataKey="passPct" name="Pass %" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Sprint Quality Row */}
      {decay.phases.fitness && decay.phases.fitness.early != null && decay.phases.fitness.late != null && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-400">Early Sprint Quality</p>
            <p className="text-lg font-bold text-accent">{decay.phases.fitness.early}/5</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-xs text-gray-400">Late Sprint Quality</p>
            <p className={`text-lg font-bold ${decay.phases.fitness.late < decay.phases.fitness.early ? 'text-red-500' : 'text-green-600'}`}>
              {decay.phases.fitness.late}/5
            </p>
          </div>
        </div>
      )}

      {/* Diagnosis */}
      {diagnosis && (
        <div className={`${severityColors[diagnosis.severity]} rounded-lg px-3 py-2`}>
          <p className="text-xs font-semibold mb-0.5">
            {diagnosis.category === 'strong' ? '\u2705' : diagnosis.severity === 'high' ? '\u26A0\uFE0F' : '\u{1F50D}'}{' '}
            {diagnosis.label}
          </p>
          <p className="text-xs leading-relaxed">{diagnosis.message}</p>
        </div>
      )}
    </Card>
  );
}

function buildPhaseChartData(phases) {
  const data = [];
  const phaseNames = ['early', 'mid', 'late'];
  for (const name of phaseNames) {
    const entry = { phase: name.charAt(0).toUpperCase() + name.slice(1) };
    let hasData = false;
    if (phases.shooting?.[name] != null) {
      entry.shotPct = phases.shooting[name];
      hasData = true;
    }
    if (phases.passing?.[name] != null) {
      entry.passPct = phases.passing[name];
      hasData = true;
    }
    if (hasData) data.push(entry);
  }
  return data;
}
