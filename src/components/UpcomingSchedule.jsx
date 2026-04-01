import { useMemo } from 'react';
import { Card } from './ui/Card';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAY_NAMES[d.getDay()]} ${d.getMonth() + 1}/${d.getDate()}`;
}

export function UpcomingSchedule({ assignedPlans = [], trainingPlans = [], sessions = [] }) {
  const today = new Date().toISOString().split('T')[0];

  const upcoming = useMemo(() => {
    // Merge assigned plans (from coach) and self-planned sessions
    const planMap = new Map();

    // Coach-assigned plans first (take priority)
    for (const p of assignedPlans) {
      if (p.date >= today) {
        planMap.set(p.date, {
          date: p.date,
          drills: p.drills || [],
          targetDuration: p.targetDuration || 0,
          notes: p.notes || '',
          source: 'coach',
        });
      }
    }

    // Self-planned sessions (don't overwrite coach plans)
    for (const p of trainingPlans) {
      if (p.date >= today && !planMap.has(p.date)) {
        planMap.set(p.date, {
          date: p.date,
          drills: p.drills || [],
          targetDuration: p.targetDuration || 0,
          notes: p.notes || '',
          source: 'self',
        });
      }
    }

    // Sort by date and take next 7 days
    const sessionDates = new Set(sessions.map(s => s.date));
    return Array.from(planMap.values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 7)
      .map(p => ({ ...p, completed: sessionDates.has(p.date) }));
  }, [assignedPlans, trainingPlans, sessions, today]);

  if (upcoming.length === 0) return null;

  return (
    <Card>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Upcoming Schedule</p>

        <div className="space-y-2">
          {upcoming.map(plan => (
            <div
              key={plan.date}
              className={`flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ${
                plan.completed ? 'opacity-50' : ''
              }`}
            >
              {/* Date */}
              <div className="w-16 shrink-0">
                <p className={`text-xs font-semibold ${plan.date === today ? 'text-accent' : 'text-gray-700'}`}>
                  {plan.date === today ? 'Today' : formatShortDate(plan.date)}
                </p>
              </div>

              {/* Drills */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1">
                  {plan.drills.slice(0, 3).map(d => (
                    <span
                      key={d}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                        plan.source === 'coach'
                          ? 'bg-blue-50 text-blue-600'
                          : 'bg-accent/10 text-accent'
                      }`}
                    >
                      {d}
                    </span>
                  ))}
                  {plan.drills.length > 3 && (
                    <span className="text-[10px] text-gray-300">+{plan.drills.length - 3}</span>
                  )}
                </div>
                {plan.notes && (
                  <p className="text-[10px] text-gray-400 truncate mt-0.5">{plan.notes}</p>
                )}
              </div>

              {/* Duration + source badge */}
              <div className="shrink-0 text-right">
                {plan.targetDuration > 0 && (
                  <p className="text-[10px] text-gray-400">{plan.targetDuration} min</p>
                )}
                {plan.source === 'coach' && (
                  <span className="text-[9px] font-medium text-blue-500">Coach</span>
                )}
                {plan.completed && (
                  <span className="text-green-500 text-sm">✓</span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}
