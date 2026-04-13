/**
 * QuickSessionForm — two-screen short-form session logging.
 *
 * Screen 1: Drills + Duration (the minimum to define a session)
 * Screen 2: Stats + Reflection (shooting, passing, RPE, notes)
 *
 * "Add more details" routes to the full SessionLogger form with data pre-filled.
 * This is NOT Quick Mode (duration + rating only). It sits between Quick Mode
 * and the full form: enough detail to be a real session log, fast enough to be
 * a 90-second experience.
 */
import { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

const today = () => new Date().toISOString().split('T')[0];

// Reuse the same drill categories as the full form
const DRILL_CATEGORIES = ['Technical', 'Physical', 'Tactical', 'Psychological', 'Warm-Up'];

export function QuickSessionForm({ onSave, onCancel, onExpandToFull, prefillPlan, customDrills = [], sessions = [] }) {
  const [screen, setScreen] = useState(1);
  const [form, setForm] = useState({
    date: today(),
    duration: prefillPlan?.targetDuration ? String(prefillPlan.targetDuration) : '',
    drills: prefillPlan?.drills || [],
    sessionType: 'solo',
    shooting: { shotsTaken: '', goals: '' },
    passing: { attempts: '', completed: '' },
    rpe: 5,
    notes: '',
  });
  const [dbDrills, setDbDrills] = useState([]);
  const [drillSearch, setDrillSearch] = useState('');

  // Fetch drills from the library
  useEffect(() => {
    fetch('/api/drills')
      .then(res => res.ok ? res.json() : [])
      .then(data => setDbDrills(Array.isArray(data) ? data : []))
      .catch(() => setDbDrills([]));
  }, []);

  // All available drills (library + custom)
  const allDrills = [...new Set([
    ...(dbDrills || []).map(d => d.name),
    ...(customDrills || []),
  ])];

  // Recently used drills from the last 10 sessions
  const recentDrills = [...new Set(
    sessions.slice(-10).flatMap(s => s.drills || [])
  )].slice(0, 8);

  const toggleDrill = (name) => {
    setForm(prev => ({
      ...prev,
      drills: prev.drills.includes(name)
        ? prev.drills.filter(d => d !== name)
        : [...prev.drills, name],
    }));
  };

  const update = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

  const canAdvanceToScreen2 = form.drills.length > 0 && form.duration && Number(form.duration) > 0;

  const handleSubmit = () => {
    const session = {
      id: crypto.randomUUID(),
      date: form.date,
      duration: Number(form.duration) || 0,
      drills: form.drills,
      notes: form.notes,
      intention: '',
      sessionType: form.sessionType,
      position: 'general',
      quickRating: 3,
      shooting: (form.shooting.shotsTaken && Number(form.shooting.shotsTaken) > 0)
        ? { shotsTaken: Number(form.shooting.shotsTaken), goals: Number(form.shooting.goals) || 0, leftFoot: { shots: 0, goals: 0 }, rightFoot: { shots: 0, goals: 0 }, shotDetails: [] }
        : null,
      passing: (form.passing.attempts && Number(form.passing.attempts) > 0)
        ? { attempts: Number(form.passing.attempts), completed: Number(form.passing.completed) || 0, keyPasses: 0 }
        : null,
      fitness: { sprints: 0, distance: '0', rpe: form.rpe },
      bodyCheck: null,
      delivery: null,
      attacking: null,
      reflection: null,
      idpGoals: [],
      mediaLinks: [],
    };
    onSave(session);
  };

  const handleExpandToFull = () => {
    // Pass current form data to the full SessionLogger via the existing prefill mechanism
    onExpandToFull?.({
      drills: form.drills,
      targetDuration: Number(form.duration) || 45,
      focus: '',
      // Include any stats already entered so they're not lost
      _partialStats: {
        shooting: form.shooting,
        passing: form.passing,
        rpe: form.rpe,
        notes: form.notes,
      },
    });
  };

  // ── Screen 1: Drills + Duration ─────────────────────────────────────────

  if (screen === 1) {
    const filteredDrills = drillSearch.trim()
      ? allDrills.filter(d => d.toLowerCase().includes(drillSearch.toLowerCase()))
      : [];

    return (
      <div className="space-y-4 max-w-3xl mx-auto">
        <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <div>
          <h2 className="text-lg font-bold text-gray-900">Log your session</h2>
          <p className="text-xs text-gray-400 mt-1">Step 1 of 2 — What did you do?</p>
        </div>

        {/* Duration */}
        <Card>
          <label className="block text-xs font-medium text-gray-500 mb-1">Duration (minutes)</label>
          <input
            type="number"
            min="1"
            max="300"
            value={form.duration}
            onChange={e => update('duration', e.target.value)}
            placeholder="45"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </Card>

        {/* Drill picker */}
        <Card>
          <label className="block text-xs font-medium text-gray-500 mb-2">
            Drills <span className="text-gray-300">({form.drills.length} selected)</span>
          </label>
          <input
            type="text"
            value={drillSearch}
            onChange={e => setDrillSearch(e.target.value)}
            placeholder="Search drills..."
            className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />

          {drillSearch.trim() ? (
            <div className="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto">
              {filteredDrills.map(drill => (
                <button key={drill} type="button" onClick={() => toggleDrill(drill)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    form.drills.includes(drill) ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {drill}
                </button>
              ))}
              {filteredDrills.length === 0 && (
                <p className="text-xs text-gray-400">No drills found</p>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {/* Recently used */}
              {recentDrills.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-gray-400 mb-1.5">Recently Used</p>
                  <div className="flex flex-wrap gap-1.5">
                    {recentDrills.map(drill => (
                      <button key={drill} type="button" onClick={() => toggleDrill(drill)}
                        className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                          form.drills.includes(drill) ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}>
                        {drill}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Selected */}
              {form.drills.length > 0 && (
                <div>
                  <p className="text-[10px] font-medium text-gray-400 mb-1.5">Selected</p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.drills.map(drill => (
                      <button key={drill} type="button" onClick={() => toggleDrill(drill)}
                        className="px-2.5 py-1 rounded-full text-xs font-medium bg-accent text-white">
                        {drill} ×
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        {/* Advance */}
        <div className="flex items-center justify-center gap-3">
          <Button onClick={() => setScreen(2)} disabled={!canAdvanceToScreen2}>
            Next
          </Button>
        </div>
        {!canAdvanceToScreen2 && (
          <p className="text-[11px] text-amber-600 text-center">
            {form.drills.length === 0 ? 'Pick at least one drill ' : ''}
            {(!form.duration || Number(form.duration) <= 0) ? 'and enter a duration ' : ''}
            to continue.
          </p>
        )}
      </div>
    );
  }

  // ── Screen 2: Stats + Reflection ────────────────────────────────────────

  const shotPct = form.shooting.shotsTaken && form.shooting.goals
    ? Math.round((Number(form.shooting.goals) / Number(form.shooting.shotsTaken)) * 100)
    : null;
  const passPct = form.passing.attempts && form.passing.completed
    ? Math.round((Number(form.passing.completed) / Number(form.passing.attempts)) * 100)
    : null;

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <button onClick={() => setScreen(1)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back
      </button>

      <div>
        <h2 className="text-lg font-bold text-gray-900">How did it go?</h2>
        <p className="text-xs text-gray-400 mt-1">Step 2 of 2 — Stats are optional but help your Pace.</p>
      </div>

      {/* Shooting */}
      <Card>
        <h3 className="text-xs font-semibold text-gray-700 mb-2">Shooting</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Shots taken</label>
            <input type="number" min="0" value={form.shooting.shotsTaken}
              onChange={e => setForm(p => ({ ...p, shooting: { ...p.shooting, shotsTaken: e.target.value } }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Goals</label>
            <input type="number" min="0" value={form.shooting.goals}
              onChange={e => setForm(p => ({ ...p, shooting: { ...p.shooting, goals: e.target.value } }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
        </div>
        {shotPct != null && <p className="text-[10px] text-gray-400 mt-1">Shot %: {shotPct}%</p>}
      </Card>

      {/* Passing */}
      <Card>
        <h3 className="text-xs font-semibold text-gray-700 mb-2">Passing</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Attempts</label>
            <input type="number" min="0" value={form.passing.attempts}
              onChange={e => setForm(p => ({ ...p, passing: { ...p.passing, attempts: e.target.value } }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label className="block text-[10px] text-gray-400 mb-1">Completed</label>
            <input type="number" min="0" value={form.passing.completed}
              onChange={e => setForm(p => ({ ...p, passing: { ...p.passing, completed: e.target.value } }))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
        </div>
        {passPct != null && <p className="text-[10px] text-gray-400 mt-1">Completion: {passPct}%</p>}
      </Card>

      {/* RPE */}
      <Card>
        <h3 className="text-xs font-semibold text-gray-700 mb-2">How hard was it?</h3>
        <div className="flex items-center gap-3">
          <input type="range" min="1" max="10" value={form.rpe}
            onChange={e => update('rpe', Number(e.target.value))}
            className="flex-1 accent-accent" />
          <span className="text-lg font-bold text-accent w-8 text-center">{form.rpe}</span>
        </div>
        <p className="text-[10px] text-gray-400 mt-1">1 = Very Easy, 10 = Maximum Effort</p>
      </Card>

      {/* Notes */}
      <Card>
        <label className="block text-xs font-medium text-gray-500 mb-1">Quick notes</label>
        <input type="text" value={form.notes} onChange={e => update('notes', e.target.value)}
          placeholder="How did the session feel?"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
      </Card>

      {/* Submit */}
      <Button onClick={handleSubmit} className="w-full py-3">
        Save session
      </Button>

      {/* Add more details — routes to the full form with data pre-filled */}
      <div className="text-center">
        <button type="button" onClick={handleExpandToFull}
          className="text-xs text-gray-400 hover:text-accent transition-colors">
          Add more details →
        </button>
      </div>
    </div>
  );
}
