import { useState, useMemo, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { PRESET_DRILLS, getWeekDates, formatDateShort } from '../utils/stats';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function TrainingCalendar({ plans, sessions, customDrills, onSavePlan, onDeletePlan, assignedPlans = [] }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingPlan, setEditingPlan] = useState(null); // { date, ...existing plan data }

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const allDrills = [...PRESET_DRILLS, ...customDrills];

  const plansByDate = useMemo(() => {
    const map = {};
    for (const p of plans) map[p.date] = p;
    return map;
  }, [plans]);

  const assignedByDate = useMemo(() => {
    const map = {};
    for (const p of assignedPlans) map[p.date] = p;
    return map;
  }, [assignedPlans]);

  const sessionDates = useMemo(() => new Set(sessions.map(s => s.date)), [sessions]);

  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Training Plan</h2>

      {/* Week Navigation */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => setWeekOffset(w => w - 1)}>&larr; Prev</Button>
        <button
          onClick={() => setWeekOffset(0)}
          className="text-sm font-medium text-gray-600 hover:text-accent"
        >
          {weekOffset === 0 ? 'This Week' : `Week of ${formatDateShort(weekDates[0])}`}
        </button>
        <Button variant="ghost" onClick={() => setWeekOffset(w => w + 1)}>Next &rarr;</Button>
      </div>

      {/* Calendar Grid — hidden on mobile, shown on md+ */}
      <div className="hidden md:grid grid-cols-7 gap-2">
        {weekDates.map((date, i) => {
          const plan = plansByDate[date];
          const assigned = assignedByDate[date];
          const hasSession = sessionDates.has(date);
          const isToday = date === todayStr;
          const isPast = date < todayStr;

          return (
            <div
              key={date}
              className={`rounded-lg border p-2 min-h-[90px] flex flex-col ${
                isToday ? 'border-accent bg-accent/5' : assigned ? 'border-blue-200 bg-blue-50/30' : 'border-gray-100 bg-surface'
              }`}
            >
              <div className="mb-1">
                <p className={`text-[10px] font-medium ${isToday ? 'text-accent' : 'text-gray-400'}`}>{DAY_NAMES[i]}</p>
                <p className="text-xs font-semibold text-gray-700">{formatDateShort(date)}</p>
                <div className="flex items-center gap-1 mt-0.5">
                  {assigned && (
                    <span className="text-[8px] font-semibold text-blue-600 bg-blue-100 px-1 py-0.5 rounded-full leading-none">Coach</span>
                  )}
                  {hasSession && (
                    <span className="text-green-500 text-sm">&#10003;</span>
                  )}
                </div>
              </div>

              {/* Assigned plan from coach (read-only) */}
              {assigned && (
                <div className="mb-1 pb-1 border-b border-blue-100">
                  <div className="flex flex-wrap gap-1">
                    {assigned.drills.slice(0, 2).map(d => (
                      <span key={d} className="bg-blue-100 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full">{d}</span>
                    ))}
                    {assigned.drills.length > 2 && (
                      <span className="text-[10px] text-blue-400">+{assigned.drills.length - 2}</span>
                    )}
                  </div>
                  {assigned.notes && <p className="text-[10px] text-blue-400 mt-0.5 truncate">{assigned.notes}</p>}
                </div>
              )}

              {plan ? (
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {plan.drills.slice(0, 2).map(d => (
                      <span key={d} className="bg-accent/10 text-accent text-[8px] px-1 py-0.5 rounded-full leading-tight">{d}</span>
                    ))}
                    {plan.drills.length > 2 && (
                      <span className="text-[10px] text-gray-400">+{plan.drills.length - 2}</span>
                    )}
                  </div>
                  {plan.targetDuration > 0 && (
                    <p className="text-[10px] text-gray-400">{plan.targetDuration} min</p>
                  )}
                  <div className="flex gap-1 mt-auto pt-1">
                    <button
                      onClick={() => setEditingPlan({ ...plan })}
                      className="text-[10px] text-accent hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => onDeletePlan(plan.id)}
                      className="text-[10px] text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setEditingPlan({ date, drills: [], targetDuration: '', notes: '' })}
                  className={`flex-1 flex items-center justify-center text-gray-300 hover:text-accent transition-colors ${isPast ? 'opacity-50' : ''}`}
                >
                  <span className="text-2xl">+</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Mobile: Stacked list view */}
      <div className="md:hidden space-y-2">
        {weekDates.map((date, i) => {
          const plan = plansByDate[date];
          const assigned = assignedByDate[date];
          const hasSession = sessionDates.has(date);
          const isToday = date === todayStr;
          return (
            <Card key={date + '-mobile'} className={isToday ? 'border-accent' : assigned ? 'border-blue-200' : ''}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div>
                    <p className={`text-xs font-medium ${isToday ? 'text-accent' : 'text-gray-400'}`}>{DAY_NAMES[i]}</p>
                    <p className="text-sm font-semibold text-gray-700">{formatDateShort(date)}</p>
                  </div>
                  {assigned && <span className="text-[9px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full">Coach</span>}
                  {hasSession && <span className="text-green-500">&#10003;</span>}
                </div>
                {plan ? (
                  <div className="text-right">
                    <p className="text-xs text-gray-600">{plan.drills.slice(0, 2).join(', ')}{plan.drills.length > 2 ? '...' : ''}</p>
                    {plan.targetDuration > 0 && <p className="text-xs text-gray-400">{plan.targetDuration} min</p>}
                    <div className="flex gap-2 justify-end mt-1">
                      <button onClick={() => setEditingPlan({ ...plan })} className="text-xs text-accent hover:underline">Edit</button>
                      <button onClick={() => onDeletePlan(plan.id)} className="text-xs text-red-400 hover:underline">Remove</button>
                    </div>
                  </div>
                ) : (
                  <Button variant="ghost" onClick={() => setEditingPlan({ date, drills: [], targetDuration: '', notes: '' })}>
                    + Plan
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Plan Editor Modal */}
      {editingPlan && (
        <PlanEditorModal
          plan={editingPlan}
          allDrills={allDrills}
          onSave={(plan) => { onSavePlan(plan); setEditingPlan(null); }}
          onClose={() => setEditingPlan(null)}
        />
      )}
    </div>
  );
}

function PlanEditorModal({ plan, allDrills, onSave, onClose }) {
  const [drills, setDrills] = useState(plan.drills || []);
  const [targetDuration, setTargetDuration] = useState(plan.targetDuration || '');
  const [notes, setNotes] = useState(plan.notes || '');
  const [dbDrills, setDbDrills] = useState([]);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => {
    const role = window.__COMPOSED_ROLE__ || 'player';
    fetch(`/api/drills?_role=${role}`, { headers: { 'X-Dev-Role': role } })
      .then(r => r.ok ? r.json() : [])
      .then(setDbDrills)
      .catch(() => {});
  }, []);

  const toggleDrill = (drill) => {
    setDrills(prev => prev.includes(drill) ? prev.filter(d => d !== drill) : [...prev, drill]);
  };

  const categories = useMemo(() => {
    const map = {};
    for (const d of dbDrills) {
      const cat = d.category || 'Other';
      if (!map[cat]) map[cat] = [];
      map[cat].push(d);
    }
    return map;
  }, [dbDrills]);

  const filteredDrills = search.trim()
    ? dbDrills.filter(d => d.name.toLowerCase().includes(search.toLowerCase()))
    : null;

  const handleSave = () => {
    onSave({
      id: plan.id || crypto.randomUUID(),
      date: plan.date,
      drills,
      targetDuration: Number(targetDuration) || 0,
      notes: notes.trim(),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Plan for ${formatDateShort(plan.date)}`}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave}>Save Plan</Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Drills</label>

          {/* Selected drills */}
          {drills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-3">
              {drills.map(d => (
                <span key={d} className="inline-flex items-center gap-1 bg-accent text-white text-xs px-2.5 py-1 rounded-full">
                  {d}
                  <button type="button" onClick={() => toggleDrill(d)} className="text-white/60 hover:text-white">&times;</button>
                </span>
              ))}
            </div>
          )}

          {/* Search */}
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search drills..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs mb-3 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />

          {/* Filtered results */}
          {filteredDrills ? (
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {filteredDrills.map(d => (
                <button key={d.id} type="button" onClick={() => toggleDrill(d.name)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    drills.includes(d.name) ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {d.name}
                </button>
              ))}
              {filteredDrills.length === 0 && <p className="text-xs text-gray-400">No drills found</p>}
            </div>
          ) : (
            /* Categorized drills */
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.entries(categories).map(([cat, catDrills]) => (
                <div key={cat}>
                  <button type="button" onClick={() => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-600 mb-1 hover:text-gray-800">
                    <span className="text-[10px]">{collapsed[cat] ? '▶' : '▼'}</span>
                    {cat} ({catDrills.length})
                  </button>
                  {!collapsed[cat] && (
                    <div className="flex flex-wrap gap-1.5 ml-3 mb-2">
                      {catDrills.map(d => (
                        <button key={d.id} type="button" onClick={() => toggleDrill(d.name)}
                          className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors ${
                            drills.includes(d.name) ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                          }`}>
                          {d.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Target Duration (min)</label>
          <input
            type="number"
            min="0"
            value={targetDuration}
            onChange={e => setTargetDuration(e.target.value)}
            placeholder="60"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
          <input
            type="text"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Focus areas, goals..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
      </div>
    </Modal>
  );
}
