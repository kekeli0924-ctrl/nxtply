import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { getWeeklyReport, getStreak, PR_LABELS } from '../utils/stats';
import { renderWeeklySummaryCard, shareCanvas } from '../utils/shareCard';

export function WeeklyReport({ sessions, matches, personalRecords, weeklyGoal }) {
  const report = getWeeklyReport(sessions, matches);
  const streak = getStreak(sessions);

  if (report.totalSessions === 0 && report.weekMatches === 0) {
    return (
      <Card className="text-center">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">This Week</h3>
        <p className="text-sm text-gray-300">No activity yet this week. Time to hit the field!</p>
      </Card>
    );
  }

  // Find PRs set this week
  const weekAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const recentPRs = personalRecords
    ? Object.entries(personalRecords)
        .filter(([, rec]) => rec?.date >= weekAgoStr)
        .map(([key]) => PR_LABELS[key])
        .filter(Boolean)
    : [];

  const handleShare = () => {
    const canvas = renderWeeklySummaryCard({
      totalSessions: report.totalSessions,
      totalTime: report.totalTime,
      avgShotPct: report.avgShotPct,
      avgPassPct: report.avgPassPct,
      weeklyLoad: report.weeklyLoad,
    });
    shareCanvas(canvas);
  };

  return (
    <Card>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">This Week</h3>
        <Button variant="ghost" onClick={handleShare} className="text-xs">Share</Button>
      </div>

      <div className="grid grid-cols-3 md:grid-cols-5 gap-3 mb-4">
        <MiniStat label="Sessions" value={report.totalSessions} />
        <MiniStat label="Total Time" value={`${report.totalTime}m`} />
        <MiniStat label="Avg Shot %" value={report.avgShotPct !== null ? `${report.avgShotPct}%` : '\u2014'} />
        <MiniStat label="Avg Pass %" value={report.avgPassPct !== null ? `${report.avgPassPct}%` : '\u2014'} />
        <MiniStat
          label="Avg RPE"
          value={report.avgRPE !== null ? report.avgRPE : '\u2014'}
          sub={report.rpeTrend !== null ? (report.rpeTrend > 0 ? `\u2191${report.rpeTrend}` : report.rpeTrend < 0 ? `\u2193${Math.abs(report.rpeTrend)}` : 'same') : null}
        />
      </div>

      {/* Highlights */}
      <div className="space-y-1">
        {streak > 0 && (
          <Highlight text={`${streak} day streak going!`} />
        )}
        {report.weekMatches > 0 && (
          <Highlight text={`Played ${report.weekMatches} match${report.weekMatches > 1 ? 'es' : ''}, scored ${report.weekGoals} goal${report.weekGoals !== 1 ? 's' : ''}`} />
        )}
        {recentPRs.map(pr => (
          <Highlight key={pr} text={`New PR: ${pr}`} accent />
        ))}
      </div>
    </Card>
  );
}

function MiniStat({ label, value, sub }) {
  return (
    <div className="text-center">
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-lg font-bold text-accent">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function Highlight({ text, accent }) {
  return (
    <p className={`text-xs flex items-center gap-1.5 ${accent ? 'text-amber-600' : 'text-gray-600'}`}>
      <span className={accent ? 'text-amber-500' : 'text-accent'}>&#9679;</span>
      {text}
    </p>
  );
}
