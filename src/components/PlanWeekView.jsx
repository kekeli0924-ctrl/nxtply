import { useState, useMemo, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { PRESET_DRILLS, getWeekDates, formatDateShort, formatPercentage } from '../utils/stats';
import { getToken } from '../hooks/useApi';

const DAY_NAMES_FULL = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

export function PlanWeekView({
  plans, sessions, assignedPlans = [], activeProgram,
  weeklyGoal = 3, onStartPlan, onStartManual,
  onSavePlan, onDeletePlan, customDrills = [],
  onNavigatePrograms,
}) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingPlan, setEditingPlan] = useState(null);
  const [restDays, setRestDays] = useState(new Set());

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

  const sessionsByDate = useMemo(() => {
    const map = {};
    for (const s of sessions) {
      if (!map[s.date]) map[s.date] = s;
    }
    return map;
  }, [sessions]);

  const todayStr = new Date().toISOString().split('T')[0];

  // Week label
  const weekLabel = weekOffset === 0
    ? 'This Week'
    : `${formatDateShort(weekDates[0])} \u2013 ${formatDateShort(weekDates[6])}`;

  // Weekly summary
  const weekStats = useMemo(() => {
    let planned = 0, completed = 0, totalMinutes = 0;
    for (const date of weekDates) {
      if (plansByDate[date] || assignedByDate[date]) planned++;
      const session = sessionsByDate[date];
      if (session) {
        completed++;
        totalMinutes += session.duration || 0;
      }
    }
    return { planned, completed, totalMinutes };
  }, [weekDates, plansByDate, assignedByDate, sessionsByDate]);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      {/* Week Header Bar */}
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekOffset(w => w - 1)} className="text-sm text-gray-500 hover:text-accent font-medium px-2 py-1">
          &larr; Prev
        </button>
        <button
          onClick={() => setWeekOffset(0)}
          className="text-sm font-semibold text-gray-700 hover:text-accent"
        >
          {weekLabel}
        </button>
        <button onClick={() => setWeekOffset(w => w + 1)} className="text-sm text-gray-500 hover:text-accent font-medium px-2 py-1">
          Next &rarr;
        </button>
      </div>

      {/* Active Program Banner */}
      {activeProgram?.program && (
        <div
          className="bg-accent/5 border border-accent/20 rounded-xl px-4 py-3 flex items-center justify-between cursor-pointer hover:bg-accent/10 transition-colors"
          onClick={onNavigatePrograms}
        >
          <div>
            <p className="text-xs font-semibold text-accent">{activeProgram.program.name}</p>
            <p className="text-[10px] text-gray-500">
              Week {activeProgram.currentWeek || 1}, Day {activeProgram.currentDay || 1} &mdash; {activeProgram.completedCount || 0} of {activeProgram.program.totalSessions || '?'} sessions
            </p>
          </div>
          <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      )}

      {/* Day Cards */}
      <div className="space-y-3">
        {weekDates.map((date, i) => {
          const plan = plansByDate[date];
          const assigned = assignedByDate[date];
          const session = sessionsByDate[date];
          const isToday = date === todayStr;
          const isPast = date < todayStr;
          const isRest = restDays.has(date);

          // Completed day
          if (session) {
            const shooting = session.shooting;
            const passing = session.passing;
            return (
              <Card key={date} className={`${isToday ? 'border-accent' : 'border-gray-100'} opacity-80`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-green-500 text-lg">&#10003;</span>
                    <div>
                      <p className={`text-xs font-medium ${isToday ? 'text-accent' : 'text-gray-500'}`}>
                        {DAY_NAMES_FULL[i]}, {formatDateShort(date)}
                        {isToday && <span className="ml-1.5 text-[9px] bg-accent text-white px-1.5 py-0.5 rounded-full font-semibold">TODAY</span>}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {session.drills?.slice(0, 3).join(' \u00b7 ')}
                        {session.drills?.length > 3 ? ' ...' : ''}
                      </p>
                    </div>
                  </div>
                </div>
                <div className="flex gap-4 mt-2 ml-7">
                  <span className="text-[10px] text-gray-500">{session.duration}m</span>
                  {shooting?.shotsTaken > 0 && (
                    <span className="text-[10px] text-gray-500">Shot: {formatPercentage(shooting.goals, shooting.shotsTaken)}</span>
                  )}
                  {passing?.attempts > 0 && (
                    <span className="text-[10px] text-gray-500">Pass: {formatPercentage(passing.completed, passing.attempts)}</span>
                  )}
                  {session.quick_rating && (
                    <span className="text-[10px] text-gray-500">{'⭐'.repeat(Math.min(session.quick_rating, 5))}</span>
                  )}
                </div>
              </Card>
            );
          }

          // Rest day
          if (isRest) {
            return (
              <Card key={date} className="border-gray-100 opacity-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-medium text-gray-400">{DAY_NAMES_FULL[i]}, {formatDateShort(date)}</p>
                    <p className="text-xs text-gray-300 mt-0.5">Rest Day</p>
                  </div>
                  <button onClick={() => setRestDays(prev => { const n = new Set(prev); n.delete(date); return n; })}
                    className="text-[10px] text-gray-400 hover:text-gray-600">Undo</button>
                </div>
              </Card>
            );
          }

          // Day with plan (user or coach assigned)
          const activePlan = assigned || plan;
          if (activePlan) {
            const drills = activePlan.drills || [];
            const duration = activePlan.targetDuration || drills.length * 10;
            return (
              <Card key={date} className={isToday ? 'border-accent border-2' : assigned ? 'border-blue-200' : 'border-gray-100'}>
                <div>
                  <p className={`text-xs font-medium ${isToday ? 'text-accent' : 'text-gray-500'}`}>
                    {DAY_NAMES_FULL[i]}, {formatDateShort(date)}
                    {isToday && <span className="ml-1.5 text-[9px] bg-accent text-white px-1.5 py-0.5 rounded-full font-semibold">TODAY</span>}
                  </p>
                  {assigned && (
                    <span className="text-[9px] font-semibold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full mt-1 inline-block">
                      Assigned by Coach
                    </span>
                  )}
                  <p className="text-xs text-gray-700 mt-1">
                    {drills.slice(0, 3).join(' \u00b7 ')}
                    {drills.length > 3 ? ` +${drills.length - 3} more` : ''}
                  </p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-[10px] text-gray-400">{duration} min</span>
                    <span className="text-[10px] text-gray-400">{drills.length} drills</span>
                    <span className="text-[10px] text-accent font-medium">+50 XP</span>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button
                    onClick={() => {
                      // Build a timeline that LiveSessionMode expects
                      const timeline = [
                        { name: 'Warm-up', reps: '5 min', duration: 5, instruction: 'Light jog, dynamic stretches.', startMin: 0, isWarmup: true },
                      ];
                      let elapsed = 5;
                      const drillDuration = drills.length > 0 ? Math.max(5, Math.floor((duration - 10) / drills.length)) : 10;
                      drills.forEach(d => {
                        const name = typeof d === 'string' ? d : d.name;
                        timeline.push({ name, reps: `${drillDuration} min`, duration: drillDuration, instruction: '', startMin: elapsed });
                        elapsed += drillDuration;
                      });
                      timeline.push({ name: 'Cool-down', reps: '5 min', duration: 5, instruction: 'Static stretches.', startMin: elapsed, isCooldown: true });
                      onStartPlan({ drills, timeline, targetDuration: duration, focus: '' });
                    }}
                    className="flex-1 !text-xs !py-2"
                  >
                    Start Session
                  </Button>
                  {!assigned && (
                    <Button variant="ghost" onClick={() => setEditingPlan({ ...plan })} className="!text-xs !py-2">
                      Edit
                    </Button>
                  )}
                </div>
              </Card>
            );
          }

          // Empty day
          return (
            <Card key={date} className={`border-gray-100 ${isPast ? 'opacity-50' : ''} ${isToday ? 'border-accent' : ''}`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className={`text-xs font-medium ${isToday ? 'text-accent' : 'text-gray-400'}`}>
                    {DAY_NAMES_FULL[i]}, {formatDateShort(date)}
                    {isToday && <span className="ml-1.5 text-[9px] bg-accent text-white px-1.5 py-0.5 rounded-full font-semibold">TODAY</span>}
                  </p>
                  <p className="text-xs text-gray-300 mt-0.5">No plan set</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setEditingPlan({ date, drills: [], targetDuration: '', notes: '' })} className="!text-xs !py-1.5">
                    + Create Plan
                  </Button>
                  {!isPast && (
                    <button
                      onClick={() => setRestDays(prev => new Set([...prev, date]))}
                      className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1"
                    >
                      Rest Day
                    </button>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Weekly Summary Bar */}
      <div className="bg-gray-50 rounded-xl px-4 py-3 flex items-center justify-between text-xs">
        <div className="flex gap-4">
          <span className="text-gray-600">
            <span className="font-semibold text-accent">{weekStats.completed}</span> of {weekStats.planned || weeklyGoal} sessions
          </span>
          <span className="text-gray-400">{weekStats.totalMinutes} min trained</span>
        </div>
        {weeklyGoal > 0 && (
          <span className="text-gray-500">
            {weekStats.completed}/{weeklyGoal} goal
          </span>
        )}
      </div>

      {/* Browse Programs Button */}
      <button
        onClick={onNavigatePrograms}
        className="w-full bg-surface rounded-xl border border-gray-100 shadow-card p-4 text-left hover:shadow-card-hover transition-shadow"
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">Browse Training Programs &rarr;</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {activeProgram?.program
                ? `Currently in: ${activeProgram.program.name}`
                : '4-week structured plans for every level'}
            </p>
          </div>
          <svg className="w-5 h-5 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </button>

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

// Plan Editor Modal — reused from TrainingCalendar pattern
function PlanEditorModal({ plan, allDrills, onSave, onClose }) {
  const [drills, setDrills] = useState(plan.drills || []);
  const [targetDuration, setTargetDuration] = useState(plan.targetDuration || '');
  const [notes, setNotes] = useState(plan.notes || '');
  const [dbDrills, setDbDrills] = useState([]);
  const [search, setSearch] = useState('');
  const [collapsed, setCollapsed] = useState({});

  useEffect(() => {
    fetch('/api/drills', { headers: { Authorization: `Bearer ${getToken()}` } })
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
          <input
            type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search drills..."
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs mb-3 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
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
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {Object.entries(categories).map(([cat, catDrills]) => (
                <div key={cat}>
                  <button type="button" onClick={() => setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))}
                    className="flex items-center gap-1 text-xs font-semibold text-gray-600 mb-1 hover:text-gray-800">
                    <span className="text-[10px]">{collapsed[cat] ? '\u25b6' : '\u25bc'}</span>
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
          <input type="number" min="0" value={targetDuration} onChange={e => setTargetDuration(e.target.value)}
            placeholder="60" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
          <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
            placeholder="Focus areas, goals..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
        </div>
      </div>
    </Modal>
  );
}
