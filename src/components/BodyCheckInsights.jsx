import { Card } from './ui/Card';
import { getBodyCheckInsight, getShotPercentage, getPassPercentage } from '../utils/stats';

function getHRVInsight(sessions) {
  const withHRV = sessions.filter(s => s.bodyCheck?.hrv != null);
  if (withHRV.length < 3) return null;

  const sorted = [...withHRV].sort((a, b) => a.bodyCheck.hrv - b.bodyCheck.hrv);
  const lowThird = sorted.slice(0, Math.ceil(sorted.length / 3));
  const highThird = sorted.slice(-Math.ceil(sorted.length / 3));

  const avgPerf = (subset, perfFn) => {
    const vals = subset.map(perfFn).filter(v => v !== null);
    return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  };

  const lowShot = avgPerf(lowThird, getShotPercentage);
  const highShot = avgPerf(highThird, getShotPercentage);
  if (lowShot != null && highShot != null) {
    const diff = highShot - lowShot;
    if (Math.abs(diff) >= 5) {
      const avgLowHRV = Math.round(lowThird.reduce((s, x) => s + x.bodyCheck.hrv, 0) / lowThird.length);
      const avgHighHRV = Math.round(highThird.reduce((s, x) => s + x.bodyCheck.hrv, 0) / highThird.length);
      return `You shoot ${Math.abs(diff)}% ${diff > 0 ? 'better' : 'worse'} when HRV is high (~${avgHighHRV}ms) vs low (~${avgLowHRV}ms)`;
    }
  }
  return null;
}

function getAvgHRV(sessions, lastN) {
  const withHRV = sessions
    .filter(s => s.bodyCheck?.hrv != null)
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, lastN);
  if (!withHRV.length) return null;
  return Math.round(withHRV.reduce((s, x) => s + x.bodyCheck.hrv, 0) / withHRV.length);
}

export function BodyCheckInsights({ sessions }) {
  const sessionsWithCheck = sessions.filter(s => s.bodyCheck);
  if (sessionsWithCheck.length < 5) {
    return null;
  }

  const insights = [
    getBodyCheckInsight(sessions, 'sleepHours', getShotPercentage, 'shoot', 'well-rested'),
    getBodyCheckInsight(sessions, 'sleepHours', getPassPercentage, 'pass', 'well-rested'),
    getBodyCheckInsight(sessions, 'hydration', getShotPercentage, 'shoot', 'hydration is high'),
    getBodyCheckInsight(sessions, 'energy', getShotPercentage, 'shoot', 'energy is high'),
    getBodyCheckInsight(sessions, 'energy', getPassPercentage, 'pass', 'energy is high'),
    getHRVInsight(sessions),
  ].filter(Boolean);

  const avgHRV = getAvgHRV(sessions, 7);

  if (!insights.length && avgHRV === null) return null;

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Body Check Insights</h3>
      {avgHRV !== null && (
        <div className="bg-gray-50 rounded-lg p-2 mb-3 flex items-center justify-between">
          <span className="text-xs text-gray-500">Avg HRV (last 7)</span>
          <span className={`text-sm font-bold ${avgHRV >= 60 ? 'text-green-600' : avgHRV >= 40 ? 'text-amber-600' : 'text-red-500'}`}>
            {avgHRV}ms
          </span>
        </div>
      )}
      <ul className="space-y-1.5">
        {insights.map((insight, i) => (
          <li key={i} className="text-xs text-gray-600 flex items-start gap-2">
            <span className="text-accent mt-0.5">&#9679;</span>
            {insight}
          </li>
        ))}
      </ul>
    </Card>
  );
}
