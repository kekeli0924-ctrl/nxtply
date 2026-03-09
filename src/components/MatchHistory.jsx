import { useState, useMemo } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { ConfirmModal } from './ui/Modal';
import { formatDate } from '../utils/stats';

const RESULT_COLORS = { W: 'bg-green-100 text-green-700', D: 'bg-yellow-100 text-yellow-700', L: 'bg-red-100 text-red-700' };
const RESULT_LABELS = { W: 'Win', D: 'Draw', L: 'Loss' };

export function MatchHistory({ matches, onEdit, onDelete, onView, onNewMatch }) {
  const [filterResult, setFilterResult] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);

  const filtered = useMemo(() => {
    let result = [...matches].sort((a, b) => b.date.localeCompare(a.date));
    if (filterResult) result = result.filter(m => m.result === filterResult);
    return result;
  }, [matches, filterResult]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Matches</h2>
        <Button onClick={onNewMatch}>Log Match</Button>
      </div>

      {/* Filters */}
      <div className="flex gap-1 items-center">
        <span className="text-xs text-gray-400 mr-1">Filter:</span>
        {['', 'W', 'D', 'L'].map(r => (
          <button
            key={r}
            onClick={() => setFilterResult(r)}
            className={`text-xs font-medium px-2 py-1 rounded ${filterResult === r ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100'}`}
          >
            {r || 'All'}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card className="text-center text-gray-300 text-sm py-8">
          {matches.length === 0 ? 'No matches logged yet.' : 'No matches match the filter.'}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map(match => (
            <Card key={match.id} onClick={() => onView(match)} className="group">
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded ${RESULT_COLORS[match.result]}`}>
                      {match.result}
                    </span>
                    <p className="text-sm font-medium text-gray-900">vs {match.opponent}</p>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{formatDate(match.date)}</p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="flex gap-4 text-right">
                    <div>
                      <p className="text-xs text-gray-400">Goals</p>
                      <p className="text-sm font-semibold text-accent">{match.goals}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Assists</p>
                      <p className="text-sm font-semibold text-accent">{match.assists}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Rating</p>
                      <p className="text-sm font-semibold text-gray-600">{match.rating}/10</p>
                    </div>
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" onClick={e => { e.stopPropagation(); onEdit(match); }}>Edit</Button>
                    <Button variant="danger" onClick={e => { e.stopPropagation(); setDeleteTarget(match); }}>Delete</Button>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">{filtered.length} match{filtered.length !== 1 ? 'es' : ''}</p>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
        title="Delete Match"
        message={`Delete the match vs ${deleteTarget?.opponent || ''} on ${deleteTarget ? formatDate(deleteTarget.date) : ''}?`}
        confirmText="Delete"
        danger
      />
    </div>
  );
}
