import { useState } from 'react';
import { Button } from './ui/Button';
import { Card } from './ui/Card';

const CORNERS = [
  { id: 'technical', label: 'Technical', emoji: '\u2699\uFE0F', bgClass: 'bg-blue-50', borderClass: 'border-blue-200' },
  { id: 'tactical', label: 'Tactical', emoji: '\uD83E\uDDE0', bgClass: 'bg-green-50', borderClass: 'border-green-200' },
  { id: 'physical', label: 'Physical', emoji: '\uD83D\uDCAA', bgClass: 'bg-green-50', borderClass: 'border-green-200' },
  { id: 'psychological', label: 'Psychological', emoji: '\uD83C\uDFAF', bgClass: 'bg-amber-50', borderClass: 'border-amber-200' },
];

function getDeadlineBadge(targetDate) {
  if (!targetDate) return null;
  const now = new Date();
  const target = new Date(targetDate);
  const daysLeft = Math.ceil((target - now) / (1000 * 60 * 60 * 24));

  if (daysLeft < 0) return { label: 'Overdue', className: 'bg-red-100 text-red-700' };
  if (daysLeft <= 7) return { label: `${daysLeft}d left`, className: 'bg-red-100 text-red-600' };
  if (daysLeft <= 30) return { label: `${daysLeft}d left`, className: 'bg-amber-100 text-amber-700' };
  return { label: `${daysLeft}d left`, className: 'bg-green-100 text-green-700' };
}

export function IDPModule({ goals, onSaveGoals }) {
  const [expandedCorner, setExpandedCorner] = useState(null);
  const [addingCorner, setAddingCorner] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);

  // Add goal form state
  const [goalText, setGoalText] = useState('');
  const [goalDate, setGoalDate] = useState('');
  const [goalProgress, setGoalProgress] = useState(0);

  const resetForm = () => {
    setGoalText('');
    setGoalDate('');
    setGoalProgress(0);
  };

  const handleAddGoal = (corner) => {
    if (!goalText.trim()) return;
    const newGoal = {
      id: crypto.randomUUID(),
      corner,
      text: goalText.trim(),
      targetDate: goalDate || null,
      progress: Number(goalProgress) || 0,
      status: 'active',
    };
    onSaveGoals([...goals, newGoal]);
    resetForm();
    setAddingCorner(null);
  };

  const handleUpdateGoal = (goalId) => {
    if (!goalText.trim()) return;
    onSaveGoals(goals.map(g =>
      g.id === goalId
        ? { ...g, text: goalText.trim(), targetDate: goalDate || null, progress: Number(goalProgress) || 0 }
        : g
    ));
    resetForm();
    setEditingGoal(null);
  };

  const handleToggleComplete = (goalId) => {
    onSaveGoals(goals.map(g =>
      g.id === goalId
        ? { ...g, status: g.status === 'completed' ? 'active' : 'completed', progress: g.status === 'completed' ? g.progress : 100 }
        : g
    ));
  };

  const handleDeleteGoal = (goalId) => {
    onSaveGoals(goals.filter(g => g.id !== goalId));
  };

  const handleUpdateProgress = (goalId, progress) => {
    onSaveGoals(goals.map(g =>
      g.id === goalId ? { ...g, progress: Number(progress) } : g
    ));
  };

  const startEdit = (goal) => {
    setEditingGoal(goal.id);
    setGoalText(goal.text);
    setGoalDate(goal.targetDate || '');
    setGoalProgress(goal.progress);
    setAddingCorner(null);
  };

  const startAdd = (corner) => {
    setAddingCorner(corner);
    setEditingGoal(null);
    resetForm();
  };

  const cornerGoals = (cornerId) => goals.filter(g => g.corner === cornerId);
  const activeGoals = goals.filter(g => g.status === 'active');
  const completedGoals = goals.filter(g => g.status === 'completed');

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">Individual Development Plan</h3>
        <span className="text-xs text-gray-400">FA Four Corner Model</span>
      </div>

      {/* Summary stats */}
      {goals.length > 0 && (
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-surface rounded-lg border border-gray-100 shadow-card p-2">
            <p className="text-lg font-bold text-accent">{activeGoals.length}</p>
            <p className="text-[10px] text-gray-400">Active</p>
          </div>
          <div className="bg-surface rounded-lg border border-gray-100 shadow-card p-2">
            <p className="text-lg font-bold text-green-600">{completedGoals.length}</p>
            <p className="text-[10px] text-gray-400">Completed</p>
          </div>
          <div className="bg-surface rounded-lg border border-gray-100 shadow-card p-2">
            <p className="text-lg font-bold text-accent">
              {activeGoals.length > 0 ? Math.round(activeGoals.reduce((sum, g) => sum + g.progress, 0) / activeGoals.length) : 0}%
            </p>
            <p className="text-[10px] text-gray-400">Avg Progress</p>
          </div>
        </div>
      )}

      {/* Corner cards */}
      {CORNERS.map(corner => {
        const cGoals = cornerGoals(corner.id);
        const isExpanded = expandedCorner === corner.id;
        const isAdding = addingCorner === corner.id;

        return (
          <Card key={corner.id} className={`border ${corner.borderClass} ${corner.bgClass} !p-0 overflow-hidden`}>
            {/* Corner header */}
            <button
              type="button"
              onClick={() => setExpandedCorner(isExpanded ? null : corner.id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <span className="text-base">{corner.emoji}</span>
                <span className="text-sm font-semibold text-gray-700">{corner.label}</span>
                {cGoals.length > 0 && (
                  <span className="text-[10px] text-gray-400 bg-white/60 px-1.5 py-0.5 rounded-full">
                    {cGoals.filter(g => g.status === 'active').length} active
                  </span>
                )}
              </div>
              <svg
                className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Expanded content */}
            {isExpanded && (
              <div className="px-4 pb-4 space-y-2">
                {/* Goal list */}
                {cGoals.length === 0 && !isAdding && (
                  <p className="text-xs text-gray-400 italic py-2">No goals set for this area yet.</p>
                )}
                {cGoals.map(goal => {
                  const isEditing = editingGoal === goal.id;
                  const badge = getDeadlineBadge(goal.targetDate);

                  if (isEditing) {
                    return (
                      <div key={goal.id} className="bg-surface-hover rounded-lg p-3 space-y-2">
                        <input
                          type="text"
                          value={goalText}
                          onChange={e => setGoalText(e.target.value)}
                          placeholder="Goal description"
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                        <div className="flex gap-2">
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Target Date</label>
                            <input
                              type="date"
                              value={goalDate}
                              onChange={e => setGoalDate(e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">Progress: {goalProgress}%</label>
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={goalProgress}
                              onChange={e => setGoalProgress(e.target.value)}
                              className="w-full accent-accent"
                            />
                          </div>
                        </div>
                        <div className="flex gap-2 justify-end">
                          <Button variant="ghost" onClick={() => { setEditingGoal(null); resetForm(); }}>Cancel</Button>
                          <Button onClick={() => handleUpdateGoal(goal.id)}>Save</Button>
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={goal.id} className="bg-surface-hover rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <button
                            type="button"
                            onClick={() => handleToggleComplete(goal.id)}
                            className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded border-2 transition-colors flex items-center justify-center ${
                              goal.status === 'completed'
                                ? 'bg-green-500 border-green-500 text-white'
                                : 'border-gray-300 hover:border-accent'
                            }`}
                          >
                            {goal.status === 'completed' && (
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm ${goal.status === 'completed' ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                              {goal.text}
                            </p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              {badge && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${badge.className}`}>
                                  {badge.label}
                                </span>
                              )}
                              {goal.targetDate && (
                                <span className="text-[10px] text-gray-400">
                                  {new Date(goal.targetDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button
                            type="button"
                            onClick={() => startEdit(goal)}
                            className="text-gray-400 hover:text-gray-600 p-0.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteGoal(goal.id)}
                            className="text-gray-400 hover:text-red-500 p-0.5"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {/* Progress bar */}
                      {goal.status !== 'completed' && (
                        <div className="mt-2">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-[10px] text-gray-400">Progress</span>
                            <span className="text-[10px] font-medium text-gray-500">{goal.progress}%</span>
                          </div>
                          <div className="h-1.5 rounded-full bg-gray-200">
                            <div
                              className="h-1.5 rounded-full bg-accent transition-all"
                              style={{ width: `${goal.progress}%` }}
                            />
                          </div>
                          <input
                            type="range"
                            min="0"
                            max="100"
                            value={goal.progress}
                            onChange={e => handleUpdateProgress(goal.id, e.target.value)}
                            className="w-full mt-1 accent-accent"
                            style={{ height: '4px' }}
                          />
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Add goal form */}
                {isAdding ? (
                  <div className="bg-surface-hover rounded-lg p-3 space-y-2">
                    <input
                      type="text"
                      value={goalText}
                      onChange={e => setGoalText(e.target.value)}
                      placeholder="What do you want to improve?"
                      autoFocus
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
                    />
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Target Date (optional)</label>
                        <input
                          type="date"
                          value={goalDate}
                          onChange={e => setGoalDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-accent/30"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-500 mb-1">Progress: {goalProgress}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={goalProgress}
                          onChange={e => setGoalProgress(e.target.value)}
                          className="w-full accent-accent"
                        />
                      </div>
                    </div>
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" onClick={() => { setAddingCorner(null); resetForm(); }}>Cancel</Button>
                      <Button onClick={() => handleAddGoal(corner.id)} disabled={!goalText.trim()}>Add Goal</Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => startAdd(corner.id)}
                    className="w-full py-2 rounded-lg border border-dashed border-gray-300 text-xs text-gray-400 hover:text-gray-600 hover:border-gray-400 transition-colors"
                  >
                    + Add Goal
                  </button>
                )}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
