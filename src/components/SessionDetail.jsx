import { formatPercentage } from '../utils/stats';

export function SessionDetail({ session }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-500">Duration</span>
        <span className="font-medium">{session.duration} min</span>
      </div>
      <div>
        <span className="text-gray-500">Drills</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {session.drills.map(d => (
            <span key={d} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{d}</span>
          ))}
        </div>
      </div>
      {session.shooting && (
        <div className="space-y-1">
          <span className="text-gray-500 font-medium">Shooting</span>
          <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg p-2">
            <div><p className="text-xs text-gray-400">Shots</p><p className="font-semibold">{session.shooting.shotsTaken}</p></div>
            <div><p className="text-xs text-gray-400">Goals</p><p className="font-semibold">{session.shooting.goals}</p></div>
            <div><p className="text-xs text-gray-400">Shot %</p><p className="font-semibold">{formatPercentage(session.shooting.goals, session.shooting.shotsTaken)}</p></div>
          </div>
          {session.shooting.leftFoot && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-gray-400">Left Foot</p>
                <p className="font-medium">{session.shooting.leftFoot.goals}/{session.shooting.leftFoot.shots} ({formatPercentage(session.shooting.leftFoot.goals, session.shooting.leftFoot.shots)})</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-gray-400">Right Foot</p>
                <p className="font-medium">{session.shooting.rightFoot.goals}/{session.shooting.rightFoot.shots} ({formatPercentage(session.shooting.rightFoot.goals, session.shooting.rightFoot.shots)})</p>
              </div>
            </div>
          )}
        </div>
      )}
      {session.passing && (
        <div className="space-y-1">
          <span className="text-gray-500 font-medium">Passing</span>
          <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg p-2">
            <div><p className="text-xs text-gray-400">Attempts</p><p className="font-semibold">{session.passing.attempts}</p></div>
            <div><p className="text-xs text-gray-400">Completed</p><p className="font-semibold">{session.passing.completed}</p></div>
            <div><p className="text-xs text-gray-400">Completion %</p><p className="font-semibold">{formatPercentage(session.passing.completed, session.passing.attempts)}</p></div>
          </div>
          {session.passing.keyPasses > 0 && <p className="text-xs text-gray-400">Key Passes: {session.passing.keyPasses}</p>}
        </div>
      )}
      {session.fitness && (
        <div className="space-y-1">
          <span className="text-gray-500 font-medium">Fitness</span>
          <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg p-2">
            {session.fitness.sprints > 0 && <div><p className="text-xs text-gray-400">Sprints</p><p className="font-semibold">{session.fitness.sprints}</p></div>}
            {session.fitness.distance > 0 && <div><p className="text-xs text-gray-400">Distance</p><p className="font-semibold">{session.fitness.distance} {session.fitness.distanceUnit || 'km'}</p></div>}
            <div><p className="text-xs text-gray-400">RPE</p><p className="font-semibold">{session.fitness.rpe}/10</p></div>
          </div>
        </div>
      )}
      {session.notes && (
        <div>
          <span className="text-gray-500">Notes</span>
          <p className="mt-1 text-gray-700 bg-gray-50 rounded-lg p-2 text-xs">{session.notes}</p>
        </div>
      )}
      {session.mediaLinks?.length > 0 && (
        <div>
          <span className="text-gray-500">Media</span>
          <div className="mt-1 space-y-1.5">
            {session.mediaLinks.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-accent hover:underline bg-gray-50 rounded-lg px-3 py-2">
                <span>{link.type === 'youtube' ? '▶' : link.type === 'drive' ? '📁' : '🔗'}</span>
                <span className="truncate">{link.label || link.url}</span>
                <svg className="w-3 h-3 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            ))}
          </div>
        </div>
      )}
      {session.sessionInsights?.length > 0 && (
        <div>
          <span className="text-gray-500 font-medium">Analysis</span>
          <div className="mt-1 space-y-1.5">
            {session.sessionInsights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm shrink-0">{insight.icon}</span>
                <p className="text-xs text-gray-600 leading-relaxed">{insight.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
