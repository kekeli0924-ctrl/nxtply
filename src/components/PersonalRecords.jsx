import { Card } from './ui/Card';
import { PR_LABELS, formatDate } from '../utils/stats';
import { renderPRAchievementCard, shareCanvas } from '../utils/shareCard';

const PR_FORMATS = {
  bestShotPct: v => `${v}%`,
  bestPassPct: v => `${v}%`,
  longestStreak: v => `${v} day${v !== 1 ? 's' : ''}`,
  mostGoals: v => `${v}`,
  longestDuration: v => `${v} min`,
};

export function PersonalRecords({ records }) {
  if (!records) return null;

  const entries = Object.entries(PR_LABELS).map(([key, label]) => ({
    key,
    label,
    record: records[key],
    format: PR_FORMATS[key],
  }));

  const hasAny = entries.some(e => e.record);
  if (!hasAny) return null;

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Personal Records</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {entries.map(({ key, label, record, format }) => (
          <div key={key} className="bg-gray-50 rounded-lg p-3 text-center relative group">
            <p className="text-xs text-gray-400">{label}</p>
            <p className="text-lg font-bold text-accent">
              {record ? format(record.value) : '\u2014'}
            </p>
            {record?.date && (
              <p className="text-xs text-gray-400">{formatDate(record.date)}</p>
            )}
            {record && (
              <button type="button" onClick={() => {
                const canvas = renderPRAchievementCard(label, format(record.value));
                shareCanvas(canvas);
              }} className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-gray-400 hover:text-accent transition-opacity text-xs" title="Share">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
              </button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
