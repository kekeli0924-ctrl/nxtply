import { formatDate, formatPercentage, getShotPercentage, getPassPercentage, getSessionLoad, getDuelSuccessRate } from '../utils/stats';

export function SessionComparison({ sessionA, sessionB, onClose }) {
  if (!sessionA || !sessionB) return null;

  const metrics = [
    { label: 'Date', a: formatDate(sessionA.date), b: formatDate(sessionB.date), neutral: true },
    { label: 'Duration', a: `${sessionA.duration} min`, b: `${sessionB.duration} min`, aVal: sessionA.duration, bVal: sessionB.duration, higher: true },
    { label: 'Shot %', a: fmtPct(sessionA, 'shot'), b: fmtPct(sessionB, 'shot'), aVal: getShotPercentage(sessionA), bVal: getShotPercentage(sessionB), higher: true },
    { label: 'Goals', a: sessionA.shooting?.goals ?? '\u2014', b: sessionB.shooting?.goals ?? '\u2014', aVal: sessionA.shooting?.goals, bVal: sessionB.shooting?.goals, higher: true },
    { label: 'Shots Taken', a: sessionA.shooting?.shotsTaken ?? '\u2014', b: sessionB.shooting?.shotsTaken ?? '\u2014', neutral: true },
    { label: 'Pass %', a: fmtPct(sessionA, 'pass'), b: fmtPct(sessionB, 'pass'), aVal: getPassPercentage(sessionA), bVal: getPassPercentage(sessionB), higher: true },
    { label: 'Passes', a: sessionA.passing ? `${sessionA.passing.completed}/${sessionA.passing.attempts}` : '\u2014', b: sessionB.passing ? `${sessionB.passing.completed}/${sessionB.passing.attempts}` : '\u2014', neutral: true },
    { label: 'RPE', a: sessionA.fitness?.rpe ?? '\u2014', b: sessionB.fitness?.rpe ?? '\u2014', aVal: sessionA.fitness?.rpe, bVal: sessionB.fitness?.rpe, higher: false },
    { label: 'Sprints', a: sessionA.fitness?.sprints ?? '\u2014', b: sessionB.fitness?.sprints ?? '\u2014', aVal: sessionA.fitness?.sprints, bVal: sessionB.fitness?.sprints, higher: true },
    { label: 'Sleep', a: sessionA.bodyCheck?.sleepHours ? `${sessionA.bodyCheck.sleepHours}h` : '\u2014', b: sessionB.bodyCheck?.sleepHours ? `${sessionB.bodyCheck.sleepHours}h` : '\u2014', neutral: true },
    { label: 'Energy', a: sessionA.bodyCheck?.energy ?? '\u2014', b: sessionB.bodyCheck?.energy ?? '\u2014', neutral: true },
    { label: 'Session Load', a: getSessionLoad(sessionA) ?? '\u2014', b: getSessionLoad(sessionB) ?? '\u2014', aVal: getSessionLoad(sessionA), bVal: getSessionLoad(sessionB), higher: true },
    { label: 'Duel %', a: getDuelSuccessRate(sessionA) != null ? `${getDuelSuccessRate(sessionA)}%` : '\u2014', b: getDuelSuccessRate(sessionB) != null ? `${getDuelSuccessRate(sessionB)}%` : '\u2014', aVal: getDuelSuccessRate(sessionA), bVal: getDuelSuccessRate(sessionB), higher: true },
    { label: 'Chances Created', a: sessionA.attacking?.chancesCreated ?? '\u2014', b: sessionB.attacking?.chancesCreated ?? '\u2014', aVal: sessionA.attacking?.chancesCreated, bVal: sessionB.attacking?.chancesCreated, higher: true },
    { label: 'Confidence', a: sessionA.reflection?.confidence ?? '\u2014', b: sessionB.reflection?.confidence ?? '\u2014', aVal: sessionA.reflection?.confidence, bVal: sessionB.reflection?.confidence, higher: true },
  ];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2 text-xs font-medium text-gray-500 px-2">
        <div className="text-center">Session A</div>
        <div></div>
        <div className="text-center">Session B</div>
      </div>
      {metrics.map(m => {
        const aColor = getColor(m, 'a');
        const bColor = getColor(m, 'b');
        return (
          <div key={m.label} className="grid grid-cols-3 gap-2 items-center bg-gray-50 rounded-lg px-3 py-2">
            <div className={`text-sm font-medium text-center ${aColor}`}>{m.a}</div>
            <div className="text-xs text-gray-400 text-center">{m.label}</div>
            <div className={`text-sm font-medium text-center ${bColor}`}>{m.b}</div>
          </div>
        );
      })}
    </div>
  );
}

function fmtPct(session, type) {
  if (type === 'shot') return formatPercentage(session.shooting?.goals, session.shooting?.shotsTaken);
  return formatPercentage(session.passing?.completed, session.passing?.attempts);
}

function getColor(metric, side) {
  if (metric.neutral) return 'text-gray-700';
  const a = metric.aVal;
  const b = metric.bVal;
  if (a == null || b == null || a === b) return 'text-gray-700';
  const val = side === 'a' ? a : b;
  const other = side === 'a' ? b : a;
  if (metric.higher) {
    return val > other ? 'text-green-600' : 'text-red-500';
  }
  return val < other ? 'text-green-600' : 'text-red-500';
}
