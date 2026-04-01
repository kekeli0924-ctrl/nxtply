import { useMemo } from 'react';
import { Card } from './ui/Card';

export function GettingStartedChecklist({ sessions, idpGoals, friends, myCoach, settings, onNavigate, onDismiss }) {
  // Don't show if already dismissed or has 3+ sessions
  if (settings.gettingStartedComplete || sessions.length >= 3) return null;

  const items = useMemo(() => {
    const list = [
      {
        id: 'first_session',
        label: 'Log your first session',
        done: sessions.length > 0,
        action: () => onNavigate?.('log'),
      },
      {
        id: 'video',
        label: 'Upload a video for AI analysis',
        done: sessions.some(s => s.mediaLinks?.some(l => l.type === 'youtube' || l.type === 'other')),
        action: () => onNavigate?.('log'),
      },
      {
        id: 'idp',
        label: 'Create your first IDP goal',
        done: (idpGoals || []).length > 0,
        action: () => onNavigate?.('idp'),
      },
      {
        id: 'friend',
        label: 'Add a friend on Community',
        done: (friends || []).length > 0,
        action: () => onNavigate?.('social'),
      },
      {
        id: 'coach',
        label: 'Connect with a coach',
        done: !!myCoach,
        action: () => onNavigate?.('social'),
      },
    ];
    return list;
  }, [sessions, idpGoals, friends, myCoach, onNavigate]);

  const completedCount = items.filter(i => i.done).length;
  const allDone = completedCount === items.length;

  // Auto-dismiss when all complete
  if (allDone) {
    if (onDismiss) setTimeout(() => onDismiss(), 2000);
    return (
      <Card>
        <div className="text-center py-4">
          <div className="text-3xl mb-2">🎉</div>
          <p className="text-sm font-semibold text-gray-900">All set! You're ready to train.</p>
          <p className="text-xs text-gray-400 mt-1">You've completed all the getting started tasks.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Getting Started</p>
          <span className="text-[10px] text-gray-300">{completedCount}/{items.length}</span>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-100 rounded-full h-1.5">
          <div
            className="bg-accent h-1.5 rounded-full transition-all duration-500"
            style={{ width: `${(completedCount / items.length) * 100}%` }}
          />
        </div>

        {/* Checklist */}
        <div className="space-y-1">
          {items.map(item => (
            <button
              key={item.id}
              onClick={item.done ? undefined : item.action}
              className={`w-full flex items-center gap-3 py-2 px-1 rounded-lg text-left transition-colors ${
                item.done ? 'opacity-50' : 'hover:bg-gray-50'
              }`}
              disabled={item.done}
            >
              {/* Checkbox */}
              <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                item.done ? 'bg-green-500 border-green-500' : 'border-gray-200'
              }`}>
                {item.done && (
                  <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
              </span>
              <span className={`text-xs ${item.done ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                {item.label}
              </span>
              {!item.done && (
                <svg className="w-3 h-3 text-gray-300 ml-auto shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              )}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
