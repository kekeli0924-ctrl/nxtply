/**
 * SessionModeChoice — lightweight mode-selection screen.
 *
 * Three equally weighted options: Quick log, Record + AI, Live session with timer.
 * One is marked "Suggested" based on whether the player has done a video session
 * in the last 7 days (if no → suggest video; if yes → suggest quick log).
 * Players pass through this in one tap — it's a hallway, not a room.
 */
import { useMemo } from 'react';

export function SessionModeChoice({ sessions = [], onQuickLog, onVideoAnalysis, onLiveSession, onCancel }) {
  // Determine suggestion: video if no video-analyzed session in last 7 days
  const suggestVideo = useMemo(() => {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoStr = weekAgo.toISOString().split('T')[0];
    // Check if any recent session has shooting data that looks AI-generated
    // (proxy for video analysis — the app doesn't explicitly tag video sessions,
    // so we check for the video_analyses linkage via session metadata)
    const hasRecentVideo = sessions.some(s =>
      s.date >= weekAgoStr && s.sessionType === 'video'
    );
    return !hasRecentVideo;
  }, [sessions]);

  const modes = [
    {
      id: 'quick',
      icon: '📝',
      title: 'Quick log',
      desc: 'Drills, duration, how it felt. About 90 seconds.',
      suggested: !suggestVideo,
      onTap: onQuickLog,
    },
    {
      id: 'video',
      icon: '🎥',
      title: 'Record + AI analysis',
      desc: 'Film a drill. AI fills in the stats.',
      suggested: suggestVideo,
      onTap: onVideoAnalysis,
    },
    {
      id: 'live',
      icon: '⏱️',
      title: 'Live session with timer',
      desc: 'Start the timer and log as you go.',
      suggested: false, // never default
      onTap: onLiveSession,
    },
  ];

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      {/* Back */}
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <h2 className="text-lg font-bold text-gray-900">How do you want to log this?</h2>

      <div className="space-y-2.5">
        {modes.map(mode => (
          <button
            key={mode.id}
            type="button"
            onClick={mode.onTap}
            className="w-full text-left rounded-xl border-2 border-gray-100 bg-white hover:border-accent/40 hover:bg-accent/5 transition-all p-4 flex items-start gap-3 relative"
          >
            <span className="text-xl mt-0.5">{mode.icon}</span>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-gray-900">{mode.title}</p>
                {mode.suggested && (
                  <span className="text-[9px] font-bold text-accent bg-accent/10 px-1.5 py-0.5 rounded-full uppercase tracking-wider">
                    Suggested
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{mode.desc}</p>
            </div>
            <svg className="w-4 h-4 text-gray-300 shrink-0 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
