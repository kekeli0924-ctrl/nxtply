import { useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

const ACTION_TYPES = ['pass', 'dribble', 'shoot', 'move', 'other'];

const ACTION_LABELS = {
  pass: 'Pass',
  dribble: 'Dribble',
  shoot: 'Shoot',
  move: 'Movement',
  other: 'Other',
};

function formatJournalDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

export function DecisionJournal({ entries, onSaveEntries, matchId, matchLabel }) {
  const [isAdding, setIsAdding] = useState(false);
  const [situation, setSituation] = useState('');
  const [actionType, setActionType] = useState('pass');
  const [rightDecision, setRightDecision] = useState(true);
  const [cleanExecution, setCleanExecution] = useState(true);

  const resetForm = () => {
    setSituation('');
    setActionType('pass');
    setRightDecision(true);
    setCleanExecution(true);
  };

  // Filter entries for this match if matchId provided
  const relevantEntries = matchId
    ? entries.filter(e => e.matchId === matchId)
    : entries;

  const handleAddDecision = () => {
    if (!situation.trim()) return;

    const today = new Date().toISOString().split('T')[0];
    const newDecision = {
      id: crypto.randomUUID(),
      situation: situation.trim(),
      actionType,
      rightDecision,
      cleanExecution,
    };

    // Find or create today's entry (with optional matchId)
    const existingEntry = entries.find(e =>
      e.date === today && (matchId ? e.matchId === matchId : !e.matchId)
    );

    if (existingEntry) {
      onSaveEntries(entries.map(e =>
        e.id === existingEntry.id
          ? { ...e, decisions: [...e.decisions, newDecision] }
          : e
      ));
    } else {
      const newEntry = {
        id: crypto.randomUUID(),
        date: today,
        matchId: matchId || null,
        matchLabel: matchLabel || null,
        decisions: [newDecision],
      };
      onSaveEntries([...entries, newEntry]);
    }

    resetForm();
    setIsAdding(false);
  };

  const handleDeleteDecision = (entryId, decisionId) => {
    onSaveEntries(
      entries.map(e => {
        if (e.id !== entryId) return e;
        const filtered = e.decisions.filter(d => d.id !== decisionId);
        return filtered.length > 0 ? { ...e, decisions: filtered } : null;
      }).filter(Boolean)
    );
  };

  // Compute summary stats across relevant entries
  const allDecisions = relevantEntries.flatMap(e => e.decisions);
  const totalDecisions = allDecisions.length;
  const goodDecisions = allDecisions.filter(d => d.rightDecision).length;
  const goodExecution = allDecisions.filter(d => d.cleanExecution).length;
  const decisionPct = totalDecisions > 0 ? Math.round((goodDecisions / totalDecisions) * 100) : 0;
  const executionPct = totalDecisions > 0 ? Math.round((goodExecution / totalDecisions) * 100) : 0;

  // Group by date for display
  const sortedEntries = [...relevantEntries].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div className="space-y-4">
      {!matchId && (
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Decision Journal</h3>
          <Button variant="ghost" onClick={() => { setIsAdding(!isAdding); resetForm(); }}>
            {isAdding ? 'Cancel' : '+ Add'}
          </Button>
        </div>
      )}

      {matchId && (
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-semibold text-gray-500">Decisions {matchLabel && `\u2014 ${matchLabel}`}</h4>
          <Button variant="ghost" onClick={() => { setIsAdding(!isAdding); resetForm(); }}>
            {isAdding ? 'Cancel' : '+ Add'}
          </Button>
        </div>
      )}

      {/* Summary stats */}
      {totalDecisions > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-surface rounded-lg border border-gray-100 shadow-card p-2">
            <p className="text-lg font-bold text-accent">{totalDecisions}</p>
            <p className="text-[10px] text-gray-400">Decisions</p>
          </div>
          <div className="bg-surface rounded-lg border border-gray-100 shadow-card p-2">
            <p className={`text-lg font-bold ${decisionPct >= 70 ? 'text-green-600' : decisionPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
              {decisionPct}%
            </p>
            <p className="text-[10px] text-gray-400">Good Decision</p>
          </div>
          <div className="bg-surface rounded-lg border border-gray-100 shadow-card p-2">
            <p className={`text-lg font-bold ${executionPct >= 70 ? 'text-green-600' : executionPct >= 50 ? 'text-amber-600' : 'text-red-500'}`}>
              {executionPct}%
            </p>
            <p className="text-[10px] text-gray-400">Good Execution</p>
          </div>
        </div>
      )}

      {/* Add decision form */}
      {isAdding && (
        <Card>
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Situation</label>
              <textarea
                value={situation}
                onChange={e => setSituation(e.target.value)}
                placeholder="Describe the situation (e.g., 1v1 on the wing, counter-attack in the final third...)"
                rows={2}
                autoFocus
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
              />
            </div>

            {/* Action type */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Action Type</label>
              <div className="flex gap-1 flex-wrap">
                {ACTION_TYPES.map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setActionType(type)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      actionType === type
                        ? 'bg-accent text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {ACTION_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Right Decision?</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setRightDecision(true)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      rightDecision ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setRightDecision(false)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      !rightDecision ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Clean Execution?</label>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setCleanExecution(true)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      cleanExecution ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setCleanExecution(false)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                      !cleanExecution ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    No
                  </button>
                </div>
              </div>
            </div>

            <Button onClick={handleAddDecision} disabled={!situation.trim()} className="w-full">
              Log Decision
            </Button>
          </div>
        </Card>
      )}

      {/* Decision entries grouped by date */}
      {sortedEntries.length === 0 && !isAdding && (
        <div className="text-center py-6">
          <p className="text-xs text-gray-400">No decisions recorded yet.</p>
          <p className="text-xs text-gray-400 mt-1">Tap + Add to log your first in-game decision.</p>
        </div>
      )}

      {sortedEntries.map(entry => (
        <div key={entry.id}>
          <div className="flex items-center gap-2 mb-1.5">
            <p className="text-xs font-semibold text-gray-500">{formatJournalDate(entry.date)}</p>
            {entry.matchLabel && (
              <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                {entry.matchLabel}
              </span>
            )}
            <span className="text-[10px] text-gray-400">{entry.decisions.length} decision{entry.decisions.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="space-y-1.5">
            {entry.decisions.map(decision => (
              <div
                key={decision.id}
                className="bg-surface rounded-lg border border-gray-100 shadow-card px-3 py-2 text-sm"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-700">{decision.situation}</p>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">
                        {ACTION_LABELS[decision.actionType] || decision.actionType}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        decision.rightDecision ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {decision.rightDecision ? 'Good call' : 'Wrong call'}
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                        decision.cleanExecution ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                      }`}>
                        {decision.cleanExecution ? 'Clean' : 'Sloppy'}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteDecision(entry.id, decision.id)}
                    className="text-gray-300 hover:text-red-500 p-0.5 flex-shrink-0"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
