import { useState, useMemo } from 'react';
import { Button } from './ui/Button';
import { analyzeGaps } from '../utils/gapAnalysis';

const urgencyStyles = {
  high: 'bg-red-100 text-red-700',
  medium: 'bg-amber-100 text-amber-700',
  low: 'bg-blue-100 text-blue-700',
};

function ChevronIcon({ open }) {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function GapSuggestionsCard({ sessions, onNavigateToLog }) {
  const gaps = useMemo(() => analyzeGaps(sessions), [sessions]);
  const [expandedIndex, setExpandedIndex] = useState(null);

  if (!gaps.length) return null;

  return (
    <div className="bg-surface rounded-xl border-l-4 border-accent p-4" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-1">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1E3A5F" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <circle cx="12" cy="12" r="6" />
          <circle cx="12" cy="12" r="2" />
          <line x1="12" y1="2" x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2" y1="12" x2="5" y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
        </svg>
        <h3 className="text-sm font-semibold text-gray-700">Suggested Sessions</h3>
      </div>
      <p className="text-xs text-gray-400 mb-3">Based on your recent training gaps</p>

      {/* Suggestions */}
      <div className="space-y-3">
        {gaps.map((gap, i) => {
          const isOpen = expandedIndex === i;
          return (
            <div key={gap.type} className="border border-gray-100 rounded-lg p-3">
              {/* Title row */}
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded uppercase ${urgencyStyles[gap.urgency]}`}>
                    {gap.urgency}
                  </span>
                  <span className="text-sm font-semibold text-gray-900">{gap.miniSession.title}</span>
                </div>
                <span className="text-xs text-gray-400 whitespace-nowrap">{gap.miniSession.duration} min</span>
              </div>

              {/* Gap detail */}
              <p className="text-xs text-gray-500 mb-1.5">{gap.detail}</p>

              {/* Expand toggle */}
              <button
                onClick={() => setExpandedIndex(isOpen ? null : i)}
                className="text-xs font-medium flex items-center gap-1 transition-colors"
                style={{ color: '#1E3A5F' }}
              >
                <ChevronIcon open={isOpen} />
                {isOpen ? 'Hide drills' : 'Show drills'}
              </button>

              {/* Expanded content */}
              {isOpen && (
                <div className="mt-2 pt-2 border-t border-gray-50">
                  <ul className="space-y-1 mb-2">
                    {gap.miniSession.drills.map(drill => (
                      <li key={drill} className="text-xs text-gray-600 flex items-center gap-1.5">
                        <span className="w-1 h-1 rounded-full flex-shrink-0 bg-accent" />
                        {drill}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-400 italic mb-3">{gap.miniSession.instruction}</p>
                  {onNavigateToLog && (
                    <Button onClick={onNavigateToLog} className="text-xs !py-1.5 !px-3">
                      Start Session
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
