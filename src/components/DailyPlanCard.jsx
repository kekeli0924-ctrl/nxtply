import { useMemo } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { generateDailyPlan } from '../utils/dailyPlan';

export function DailyPlanCard({ sessions, idpGoals, onStartPlan }) {
  const plan = useMemo(() => generateDailyPlan(sessions, idpGoals), [sessions, idpGoals]);

  if (!plan) return null;

  // Already trained today
  if (plan.type === 'completed') {
    return (
      <Card>
        <div className="text-center py-4">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-sm font-semibold text-gray-900">Session Complete</p>
          <p className="text-xs text-gray-400 mt-1">{plan.motivation}</p>
        </div>
      </Card>
    );
  }

  const urgencyColors = {
    high: 'bg-red-50 text-red-600',
    medium: 'bg-amber-50 text-amber-600',
    low: 'bg-blue-50 text-blue-600',
  };

  return (
    <Card>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Today's Training</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{plan.focus}</p>
          </div>
          <div className="flex items-center gap-2">
            {plan.gapUrgency && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${urgencyColors[plan.gapUrgency] || urgencyColors.low}`}>
                {plan.gapUrgency} priority
              </span>
            )}
            {plan.type === 'recovery' && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">recovery</span>
            )}
          </div>
        </div>

        {/* Total duration + XP */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="font-medium text-gray-600">⏱ {plan.totalDuration} min total</span>
          {plan.xpReward > 0 && <span>✨ +{plan.xpReward} XP</span>}
        </div>

        {/* Timeline */}
        {plan.timeline && plan.timeline.length > 0 && (
          <div className="space-y-0">
            {plan.timeline.map((item, i) => (
              <div key={i} className={`flex gap-3 py-2 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                {/* Time marker */}
                <div className="w-10 shrink-0 text-right">
                  <span className="text-[10px] font-mono text-gray-300">{item.startMin}:00</span>
                </div>

                {/* Timeline dot + line */}
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-2 h-2 rounded-full mt-1 ${
                    item.isWarmup ? 'bg-amber-300' :
                    item.isCooldown ? 'bg-blue-300' :
                    'bg-accent'
                  }`} />
                  {i < plan.timeline.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold ${
                      item.isWarmup || item.isCooldown ? 'text-gray-400' : 'text-gray-800'
                    }`}>
                      {item.name}
                    </p>
                    <span className="text-[10px] text-gray-300 shrink-0">{item.duration} min</span>
                  </div>
                  <p className="text-[11px] font-medium text-accent mt-0.5">{item.reps}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{item.instruction}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Motivation */}
        <p className="text-xs text-gray-500 italic leading-relaxed">{plan.motivation}</p>

        {/* CTA */}
        <Button
          onClick={() => onStartPlan && onStartPlan(plan)}
          className="w-full py-2.5 text-sm"
        >
          Start Session
        </Button>
      </div>
    </Card>
  );
}
