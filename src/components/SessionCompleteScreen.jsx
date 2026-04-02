import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { formatPercentage } from '../utils/stats';

const INSIGHT_COLORS = {
  '🏆': 'bg-amber-50 border-amber-200',
  '📈': 'bg-green-50 border-green-200',
  '📉': 'bg-red-50 border-red-200',
  '🦶': 'bg-blue-50 border-blue-200',
  '🎯': 'bg-accent/5 border-accent/20',
  '💡': 'bg-amber-50 border-amber-200',
  '⚠️': 'bg-red-50 border-red-200',
  '⏱️': 'bg-gray-50 border-gray-200',
  '🔥': 'bg-orange-50 border-orange-200',
  '🧠': 'bg-purple-50 border-purple-200',
};

export function SessionCompleteScreen({ session, xpEarned, badgeUnlocked, onDone }) {
  if (!session) return null;

  const insights = session.sessionInsights || [];
  const shooting = session.shooting;
  const passing = session.passing;

  return (
    <div className="max-w-lg mx-auto py-8 px-4 space-y-5" style={{ animation: 'fadeSlideUp 0.4s ease-out' }}>
      {/* Header */}
      <div className="text-center">
        <div className="text-4xl mb-3">✅</div>
        <h1 className="text-2xl font-bold text-gray-900 font-heading">
          Session Complete
        </h1>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="!p-3 text-center">
          <p className="text-lg font-bold text-accent">{session.duration}</p>
          <p className="text-[10px] text-gray-400">Minutes</p>
        </Card>
        {shooting?.shotsTaken > 0 && (
          <Card className="!p-3 text-center">
            <p className="text-lg font-bold text-green-600">
              {formatPercentage(shooting.goals, shooting.shotsTaken)}
            </p>
            <p className="text-[10px] text-gray-400">Shot %</p>
          </Card>
        )}
        {passing?.attempts > 0 && (
          <Card className="!p-3 text-center">
            <p className="text-lg font-bold text-blue-600">
              {formatPercentage(passing.completed, passing.attempts)}
            </p>
            <p className="text-[10px] text-gray-400">Pass %</p>
          </Card>
        )}
        {!shooting?.shotsTaken && !passing?.attempts && (
          <>
            <Card className="!p-3 text-center">
              <p className="text-lg font-bold text-gray-900">{(session.drills || []).length}</p>
              <p className="text-[10px] text-gray-400">Drills</p>
            </Card>
            <Card className="!p-3 text-center">
              <p className="text-lg font-bold text-accent">{session.quickRating || '-'}/10</p>
              <p className="text-[10px] text-gray-400">Rating</p>
            </Card>
          </>
        )}
      </div>

      {/* XP + Badge */}
      <div className="flex items-center justify-center gap-4">
        {xpEarned > 0 && (
          <span className="text-sm font-medium text-accent">✨ +{xpEarned} XP</span>
        )}
        {badgeUnlocked && (
          <span className="text-sm font-medium text-amber-600">{badgeUnlocked.icon} {badgeUnlocked.name}</span>
        )}
      </div>

      {/* AI Insights */}
      {insights.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Analysis</p>
          {insights.map((insight, i) => (
            <div
              key={i}
              className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${INSIGHT_COLORS[insight.icon] || 'bg-gray-50 border-gray-200'}`}
            >
              <span className="text-lg shrink-0">{insight.icon}</span>
              <p className="text-xs text-gray-700 leading-relaxed">{insight.text}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="space-y-2 pt-2">
        <Button onClick={onDone} className="w-full py-3">
          Done
        </Button>
      </div>
    </div>
  );
}
