import { Card } from './ui/Card';
import { getWeakFootStats } from '../utils/stats';

export function WeakFootWidget({ sessions }) {
  const stats = getWeakFootStats(sessions);

  if (!stats.totalShots) {
    return null;
  }

  const dominant = stats.leftRatio > stats.rightRatio ? 'Left' : 'Right';
  const dominantRatio = Math.max(stats.leftRatio, stats.rightRatio);
  const imbalanced = dominantRatio > 70;

  return (
    <Card>
      <h3 className="text-sm font-semibold text-gray-700 mb-3">Foot Balance</h3>

      {/* Bar */}
      <div className="flex h-6 rounded-full overflow-hidden bg-gray-100">
        <div
          className="bg-accent flex items-center justify-center text-white text-xs font-medium transition-all"
          style={{ width: `${stats.leftRatio}%`, minWidth: stats.leftRatio > 0 ? '2rem' : 0 }}
        >
          {stats.leftRatio > 15 ? `L ${stats.leftRatio}%` : ''}
        </div>
        <div
          className="bg-accent-light flex items-center justify-center text-white text-xs font-medium transition-all"
          style={{ width: `${stats.rightRatio}%`, minWidth: stats.rightRatio > 0 ? '2rem' : 0 }}
        >
          {stats.rightRatio > 15 ? `R ${stats.rightRatio}%` : ''}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mt-3 text-center">
        <div>
          <p className="text-xs text-gray-400">Left Foot</p>
          <p className="text-sm font-semibold">{stats.left.goals}/{stats.left.shots} shots</p>
          <p className="text-xs text-gray-500">{stats.leftAccuracy !== null ? `${stats.leftAccuracy}% accuracy` : '\u2014'}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Right Foot</p>
          <p className="text-sm font-semibold">{stats.right.goals}/{stats.right.shots} shots</p>
          <p className="text-xs text-gray-500">{stats.rightAccuracy !== null ? `${stats.rightAccuracy}% accuracy` : '\u2014'}</p>
        </div>
      </div>

      {imbalanced && (
        <p className="text-xs text-amber-600 mt-3 bg-amber-50 rounded-lg px-3 py-2">
          Your {dominant.toLowerCase()} foot takes {dominantRatio}% of shots. Consider more weak foot practice.
        </p>
      )}
    </Card>
  );
}
