import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { formatDate } from '../utils/stats';

export function ProgressTimeline({ onViewSession }) {
  const [analyses, setAnalyses] = useState([]);

  useEffect(() => {
    // Fetch completed video analyses
    // For now, check the sessions API for those with mediaLinks
    // In production, this would query video_analyses table
  }, []);

  // This component shows video-analyzed sessions as a horizontal timeline
  // For now, it's a placeholder that activates when video analyses exist

  if (analyses.length < 2) return null;

  return (
    <Card>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Your Progress</p>

        <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
          {analyses.map((item, i) => (
            <button
              key={i}
              onClick={() => onViewSession?.(item)}
              className="shrink-0 w-28 bg-gray-50 rounded-lg p-2 text-center hover:bg-gray-100 transition-colors"
            >
              <div className="text-2xl mb-1">📹</div>
              <p className="text-[10px] font-medium text-gray-700">{formatDate(item.date)}</p>
              {item.totalKicks > 0 && (
                <p className="text-[10px] text-accent font-semibold">{item.totalKicks} kicks</p>
              )}
              {item.shotPct != null && (
                <p className="text-[10px] text-gray-400">{item.shotPct}% accuracy</p>
              )}
            </button>
          ))}
        </div>
      </div>
    </Card>
  );
}
