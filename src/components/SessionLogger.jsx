import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ShotZoneGrid } from './ui/FormInputs';
import {
  PRESET_DRILLS, SESSION_TYPES, hasShootingDrill, hasPassingDrill, hasFitnessDrill,
} from '../utils/stats';

const today = () => new Date().toISOString().split('T')[0];

const SHOT_TYPES = [
  { id: 'open-play', label: 'Open Play' },
  { id: 'set-piece', label: 'Set Piece' },
  { id: 'counter', label: 'Counter' },
  { id: '1v1', label: '1v1' },
];

const SHOT_APPROACHES = [
  { id: 'right-foot', label: 'Right Foot' },
  { id: 'left-foot', label: 'Left Foot' },
  { id: 'header', label: 'Header' },
  { id: 'volley', label: 'Volley' },
  { id: 'first-time', label: 'First Time' },
];

const PRESSURE_SIMS = [
  { id: 'none', label: 'None' },
  { id: 'passive', label: 'Passive' },
  { id: 'active', label: 'Active' },
  { id: 'match-like', label: 'Match-like' },
];

function suggestSessionType(bodyCheck, sessions) {
  if (!bodyCheck) return null;
  const { sleepHours, energy, soreness, hrv } = bodyCheck;
  const lowRecovery = (sleepHours && Number(sleepHours) < 6) || Number(energy) <= 2 || Number(soreness) >= 4 || (hrv && Number(hrv) < 40);
  if (lowRecovery) {
    return { type: 'Representative', label: 'Low-Intensity Recommended', reason: 'Your recovery indicators suggest a lighter session today.', color: 'amber' };
  }
  const highRecovery = (sleepHours && Number(sleepHours) >= 8) && Number(energy) >= 4 && Number(soreness) <= 2;
  if (highRecovery) {
    return { type: 'Benchmark', label: 'High-Intensity Ready', reason: 'You\'re well-recovered — great day for a benchmark or intense session.', color: 'green' };
  }
  return null;
}

function TagSelector({ label, options, value, onChange }) {
  return (
    <div>
      {label && <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>}
      <div className="flex flex-wrap gap-1.5">
        {options.map(opt => {
          const id = typeof opt === 'string' ? opt : opt.id;
          const lbl = typeof opt === 'string' ? opt : opt.label;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onChange(value === id ? '' : id)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                value === id ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {lbl}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function emptyForm() {
  return {
    date: today(),
    duration: '',
    drills: [],
    bodyCheck: { sleepHours: '', hrv: '', hydration: 3, energy: 3, soreness: 1, injuryNotes: '' },
    shooting: {
      shotsTaken: '', goals: '', xG: '',
      leftFoot: { shots: '', goals: '' },
      rightFoot: { shots: '', goals: '' },
      phases: { early: { shots: '', goals: '' }, mid: { shots: '', goals: '' }, late: { shots: '', goals: '' } },
      shotDetails: [],
    },
    passing: {
      attempts: '', completed: '', keyPasses: '',
      phases: { early: { attempts: '', completed: '' }, late: { attempts: '', completed: '' } },
    },
    fitness: {
      sprints: '', distance: '', rpe: 5,
      phases: { early: { sprintQuality: '' }, late: { sprintQuality: '' } },
    },
    notes: '',
    intention: '',
    sessionType: '',
    position: 'general',
    quickRating: 3,
    delivery: { entries: [] },
    attacking: { duels: { attempts: '', successes: '', endProducts: '', insideCount: '' }, takeOns: { attempts: '', endProducts: '' } },
    reflection: { confidence: 3, focus: 3, enjoyment: 3, notes: '' },
  };
}

function sessionToForm(session) {
  return {
    date: session.date,
    duration: session.duration,
    drills: [...session.drills],
    bodyCheck: {
      sleepHours: session.bodyCheck?.sleepHours ?? '',
      hrv: session.bodyCheck?.hrv ?? '',
      hydration: session.bodyCheck?.hydration ?? 3,
      energy: session.bodyCheck?.energy ?? 3,
      soreness: session.bodyCheck?.soreness ?? 1,
      injuryNotes: session.bodyCheck?.injuryNotes ?? '',
    },
    shooting: {
      shotsTaken: session.shooting?.shotsTaken ?? '',
      goals: session.shooting?.goals ?? '',
      leftFoot: {
        shots: session.shooting?.leftFoot?.shots ?? '',
        goals: session.shooting?.leftFoot?.goals ?? '',
      },
      rightFoot: {
        shots: session.shooting?.rightFoot?.shots ?? '',
        goals: session.shooting?.rightFoot?.goals ?? '',
      },
      phases: {
        early: { shots: session.shooting?.phases?.early?.shots ?? '', goals: session.shooting?.phases?.early?.goals ?? '' },
        mid: { shots: session.shooting?.phases?.mid?.shots ?? '', goals: session.shooting?.phases?.mid?.goals ?? '' },
        late: { shots: session.shooting?.phases?.late?.shots ?? '', goals: session.shooting?.phases?.late?.goals ?? '' },
      },
    },
    passing: {
      attempts: session.passing?.attempts ?? '',
      completed: session.passing?.completed ?? '',
      keyPasses: session.passing?.keyPasses ?? '',
      phases: {
        early: { attempts: session.passing?.phases?.early?.attempts ?? '', completed: session.passing?.phases?.early?.completed ?? '' },
        late: { attempts: session.passing?.phases?.late?.attempts ?? '', completed: session.passing?.phases?.late?.completed ?? '' },
      },
    },
    fitness: {
      sprints: session.fitness?.sprints ?? '',
      distance: session.fitness?.distance ?? '',
      rpe: session.fitness?.rpe ?? 5,
      phases: {
        early: { sprintQuality: session.fitness?.phases?.early?.sprintQuality ?? '' },
        late: { sprintQuality: session.fitness?.phases?.late?.sprintQuality ?? '' },
      },
    },
    notes: session.notes || '',
    quickRating: session.quickRating ?? 3,
  };
}

export function SessionLogger({ onSave, editSession, customDrills, onAddCustomDrill, distanceUnit, templates = [], setTemplates }) {
  const [form, setForm] = useState(emptyForm);
  const [newDrill, setNewDrill] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [errors, setErrors] = useState({});
  const [showFootBreakdown, setShowFootBreakdown] = useState(false);
  const [showPhaseBreakdown, setShowPhaseBreakdown] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [showShotDetails, setShowShotDetails] = useState(false);
  const [showDelivery, setShowDelivery] = useState(false);
  const [showDuelDetails, setShowDuelDetails] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);

  const allDrills = [...PRESET_DRILLS, ...customDrills];
  const isEditing = !!editSession;

  useEffect(() => {
    if (editSession) {
      setForm(sessionToForm(editSession));
      setShowFootBreakdown(
        !!(editSession.shooting?.leftFoot?.shots || editSession.shooting?.rightFoot?.shots)
      );
      setShowPhaseBreakdown(
        !!(editSession.shooting?.phases || editSession.passing?.phases || editSession.fitness?.phases)
      );
      setShowShotDetails(!!(editSession.shooting?.shotDetails?.length));
      setShowDelivery(!!(editSession.delivery?.entries?.length));
      setShowDuelDetails(!!(editSession.attacking?.duels?.endProducts || editSession.attacking?.duels?.insideCount));
    } else {
      setForm(emptyForm());
      setShowFootBreakdown(false);
      setShowPhaseBreakdown(false);
      setShowShotDetails(false);
      setShowDelivery(false);
      setShowDuelDetails(false);
    }
  }, [editSession]);

  const update = (path, value) => {
    setForm(prev => {
      const next = { ...prev };
      const keys = path.split('.');
      let obj = next;
      for (let i = 0; i < keys.length - 1; i++) {
        obj[keys[i]] = { ...obj[keys[i]] };
        obj = obj[keys[i]];
      }
      obj[keys[keys.length - 1]] = value;
      return next;
    });
    setErrors(prev => ({ ...prev, [path]: undefined }));
  };

  const toggleDrill = (drill) => {
    setForm(prev => ({
      ...prev,
      drills: prev.drills.includes(drill)
        ? prev.drills.filter(d => d !== drill)
        : [...prev.drills, drill],
    }));
    setErrors(prev => ({ ...prev, drills: undefined }));
  };

  const addCustomDrill = () => {
    const name = newDrill.trim();
    if (name && !allDrills.includes(name)) {
      onAddCustomDrill(name);
      setForm(prev => ({ ...prev, drills: [...prev.drills, name] }));
      setNewDrill('');
      setShowCustomInput(false);
    }
  };

  const validate = () => {
    const errs = {};
    if (!quickMode && !form.drills.length) errs.drills = 'Select at least one drill';
    if (!form.duration || Number(form.duration) <= 0) errs.duration = 'Enter a valid duration';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    const num = (v) => v === '' || v === undefined ? undefined : Number(v);

    const session = {
      id: editSession?.id || crypto.randomUUID(),
      date: form.date,
      duration: Number(form.duration),
      drills: form.drills,
      notes: form.notes,
    };

    if (hasShootingDrill(form.drills) && num(form.shooting.shotsTaken)) {
      session.shooting = {
        shotsTaken: num(form.shooting.shotsTaken) || 0,
        goals: num(form.shooting.goals) || 0,
      };
      if (showFootBreakdown) {
        session.shooting.leftFoot = {
          shots: num(form.shooting.leftFoot.shots) || 0,
          goals: num(form.shooting.leftFoot.goals) || 0,
        };
        session.shooting.rightFoot = {
          shots: num(form.shooting.rightFoot.shots) || 0,
          goals: num(form.shooting.rightFoot.goals) || 0,
        };
      }
    }

    if (hasPassingDrill(form.drills) && num(form.passing.attempts)) {
      session.passing = {
        attempts: num(form.passing.attempts) || 0,
        completed: num(form.passing.completed) || 0,
        keyPasses: num(form.passing.keyPasses) || 0,
      };
    }

    if (hasFitnessDrill(form.drills)) {
      session.fitness = {
        sprints: num(form.fitness.sprints) || 0,
        distance: num(form.fitness.distance) || 0,
        distanceUnit,
        rpe: Number(form.fitness.rpe),
      };
    } else if (form.fitness.rpe !== 5 || num(form.fitness.sprints) || num(form.fitness.distance)) {
      session.fitness = {
        sprints: num(form.fitness.sprints) || 0,
        distance: num(form.fitness.distance) || 0,
        distanceUnit,
        rpe: Number(form.fitness.rpe),
      };
    }

    // Always save RPE if set
    if (!session.fitness) {
      session.fitness = { rpe: Number(form.fitness.rpe) };
    } else {
      session.fitness.rpe = Number(form.fitness.rpe);
    }

    // Phase breakdown
    if (showPhaseBreakdown) {
      if (session.shooting) {
        const sp = form.shooting.phases;
        const hasData = ['early', 'mid', 'late'].some(p => num(sp[p].shots));
        if (hasData) {
          session.shooting.phases = {};
          for (const phase of ['early', 'mid', 'late']) {
            if (num(sp[phase].shots)) {
              session.shooting.phases[phase] = { shots: num(sp[phase].shots) || 0, goals: num(sp[phase].goals) || 0 };
            }
          }
        }
      }
      if (session.passing) {
        const pp = form.passing.phases;
        const hasData = ['early', 'late'].some(p => num(pp[p].attempts));
        if (hasData) {
          session.passing.phases = {};
          for (const phase of ['early', 'late']) {
            if (num(pp[phase].attempts)) {
              session.passing.phases[phase] = { attempts: num(pp[phase].attempts) || 0, completed: num(pp[phase].completed) || 0 };
            }
          }
        }
      }
      if (session.fitness) {
        const fp = form.fitness.phases;
        const hasData = ['early', 'late'].some(p => fp[p].sprintQuality !== '' && fp[p].sprintQuality !== undefined);
        if (hasData) {
          session.fitness.phases = {};
          for (const phase of ['early', 'late']) {
            if (fp[phase].sprintQuality !== '' && fp[phase].sprintQuality !== undefined) {
              session.fitness.phases[phase] = { sprintQuality: Number(fp[phase].sprintQuality) };
            }
          }
        }
      }
    }

    // Body check
    if (form.bodyCheck.sleepHours !== '' || form.bodyCheck.hrv !== '' || form.bodyCheck.hydration !== 3 || form.bodyCheck.energy !== 3 || form.bodyCheck.soreness !== 1 || form.bodyCheck.injuryNotes.trim()) {
      session.bodyCheck = {
        sleepHours: Number(form.bodyCheck.sleepHours) || 0,
        hrv: num(form.bodyCheck.hrv) || undefined,
        hydration: Number(form.bodyCheck.hydration),
        energy: Number(form.bodyCheck.energy),
        soreness: Number(form.bodyCheck.soreness),
        injuryNotes: form.bodyCheck.injuryNotes.trim(),
      };
      // Only include HRV if user entered a value
      if (session.bodyCheck.hrv === undefined) delete session.bodyCheck.hrv;
    }

    onSave(session);
  };

  const showShooting = hasShootingDrill(form.drills);
  const showPassing = hasPassingDrill(form.drills);
  const showFitness = hasFitnessDrill(form.drills);

  const handleLoadTemplate = (template) => {
    const f = emptyForm();
    f.drills = template.drills || [];
    f.sessionType = template.sessionType || '';
    f.position = template.position || 'general';
    f.fitness = { ...f.fitness, rpe: template.rpe ?? 5 };
    setForm(f);
  };

  const handleSaveTemplate = () => {
    if (!templateName.trim()) return;
    const tmpl = {
      id: crypto.randomUUID(),
      name: templateName.trim(),
      drills: form.drills,
      sessionType: form.sessionType,
      position: form.position,
      rpe: form.fitness.rpe,
    };
    setTemplates?.(prev => [...prev, tmpl]);
    setTemplateName('');
    setShowSaveTemplate(false);
  };

  const handleDeleteTemplate = (id) => {
    setTemplates?.(prev => prev.filter(t => t.id !== id));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          {isEditing ? 'Edit Session' : 'Log Session'}
        </h2>
        {!isEditing && (
          <button type="button" onClick={() => setQuickMode(q => !q)}
            className={`text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${quickMode ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {quickMode ? 'Quick Log' : 'Full Log'}
          </button>
        )}
      </div>

      {/* Template Selector */}
      {!isEditing && templates.length > 0 && !quickMode && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400">Templates:</span>
          {templates.map(t => (
            <span key={t.id} className="inline-flex items-center gap-1 bg-gray-100 rounded-full px-3 py-1 text-xs">
              <button type="button" onClick={() => handleLoadTemplate(t)} className="text-gray-700 hover:text-accent font-medium">{t.name}</button>
              <button type="button" onClick={() => handleDeleteTemplate(t.id)} className="text-gray-400 hover:text-red-500 ml-1">&times;</button>
            </span>
          ))}
        </div>
      )}

      {/* Quick Log Mode */}
      {quickMode && !isEditing && (
        <>
          <Card>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <input type="date" value={form.date} onChange={e => update('date', e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Duration (min)</label>
                <input type="number" min="1" value={form.duration} onChange={e => update('duration', e.target.value)} placeholder="90"
                  className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 ${errors.duration ? 'border-red-300' : 'border-gray-200'}`} />
                {errors.duration && <p className="text-xs text-red-500 mt-1">{errors.duration}</p>}
              </div>
            </div>
          </Card>
          <Card>
            <TagSelector label="Session Type" options={SESSION_TYPES.map(t => ({ id: t, label: t.charAt(0).toUpperCase() + t.slice(1) }))} value={form.sessionType} onChange={v => update('sessionType', v)} />
          </Card>
          <Card>
            <ScaleInput label="Session Rating" value={form.quickRating} onChange={v => update('quickRating', v)} lowLabel="Poor" highLabel="Great" />
          </Card>
          <Card>
            <label className="block text-xs font-medium text-gray-500 mb-1">Intention (optional)</label>
            <textarea value={form.intention} onChange={e => update('intention', e.target.value)} placeholder="What was your focus?" rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
          </Card>
          <Card>
            <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => update('notes', e.target.value)} placeholder="Quick notes..." rows={2}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none" />
          </Card>
          <Card>
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Session RPE</h3>
            <div className="flex items-center gap-3">
              <input type="range" min="1" max="10" value={form.fitness.rpe} onChange={e => update('fitness.rpe', e.target.value)} className="flex-1 accent-accent" />
              <span className="text-lg font-bold text-accent w-8 text-center">{form.fitness.rpe}</span>
            </div>
          </Card>
          <Button type="submit" className="w-full py-3">Save Quick Session</Button>
        </>
      )}

      {/* Full Log Mode */}
      {(!quickMode || isEditing) && <>

      {/* Readiness Suggestion */}
      {!isEditing && (() => {
        const suggestion = suggestSessionType(form.bodyCheck);
        if (!suggestion) return null;
        const colors = { amber: 'bg-amber-50 text-amber-700 border-amber-200', green: 'bg-green-50 text-green-700 border-green-200' };
        return (
          <div className={`rounded-lg px-4 py-3 border text-sm ${colors[suggestion.color]}`}>
            <p className="font-medium">{suggestion.label}</p>
            <p className="text-xs mt-0.5 opacity-75">{suggestion.reason}</p>
            {!form.sessionType && (
              <button type="button" onClick={() => update('sessionType', suggestion.type)}
                className="mt-2 text-xs font-medium underline">
                Set as session type
              </button>
            )}
          </div>
        );
      })()}

      {/* Date & Duration */}
      <Card>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={e => update('date', e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Duration (min)</label>
            <input
              type="number"
              min="1"
              value={form.duration}
              onChange={e => update('duration', e.target.value)}
              placeholder="90"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 ${errors.duration ? 'border-red-300' : 'border-gray-200'}`}
            />
            {errors.duration && <p className="text-xs text-red-500 mt-1">{errors.duration}</p>}
          </div>
        </div>
      </Card>

      {/* Body Check */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Pre-Session Body Check</h3>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Sleep (hours)" value={form.bodyCheck.sleepHours} onChange={v => update('bodyCheck.sleepHours', v)} step="0.5" />
            <NumInput label="HRV (ms)" value={form.bodyCheck.hrv} onChange={v => update('bodyCheck.hrv', v)} placeholder="e.g. 65" />
          </div>
          <ScaleInput label="Hydration" value={form.bodyCheck.hydration} onChange={v => update('bodyCheck.hydration', v)} lowLabel="Low" highLabel="High" />
          <ScaleInput label="Energy" value={form.bodyCheck.energy} onChange={v => update('bodyCheck.energy', v)} lowLabel="Low" highLabel="High" />
          <ScaleInput label="Soreness" value={form.bodyCheck.soreness} onChange={v => update('bodyCheck.soreness', v)} lowLabel="None" highLabel="Very" />
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Injury Notes (optional)</label>
            <input
              type="text"
              value={form.bodyCheck.injuryNotes}
              onChange={e => update('bodyCheck.injuryNotes', e.target.value)}
              placeholder="Any niggles or pain..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
        </div>
      </Card>

      {/* Drill Selector */}
      <Card>
        <label className="block text-xs font-medium text-gray-500 mb-3">
          Drills Performed
          {errors.drills && <span className="text-red-500 ml-2">{errors.drills}</span>}
        </label>
        <div className="flex flex-wrap gap-2">
          {allDrills.map(drill => (
            <button
              key={drill}
              type="button"
              onClick={() => toggleDrill(drill)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                form.drills.includes(drill)
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {drill}
            </button>
          ))}
        </div>
        {showCustomInput ? (
          <div className="flex gap-2 mt-3">
            <input
              type="text"
              value={newDrill}
              onChange={e => setNewDrill(e.target.value)}
              placeholder="Custom drill name"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustomDrill())}
            />
            <Button onClick={addCustomDrill} variant="primary">Add</Button>
            <Button onClick={() => { setShowCustomInput(false); setNewDrill(''); }} variant="ghost">Cancel</Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setShowCustomInput(true)}
            className="mt-3 text-xs text-accent hover:underline"
          >
            + Add Custom Drill
          </button>
        )}
      </Card>

      {/* Shooting Stats */}
      {showShooting && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Shooting Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Shots Taken" value={form.shooting.shotsTaken} onChange={v => update('shooting.shotsTaken', v)} />
            <NumInput label="Goals Scored" value={form.shooting.goals} onChange={v => update('shooting.goals', v)} />
          </div>
          {form.shooting.shotsTaken > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Shot %: {form.shooting.goals && form.shooting.shotsTaken
                ? `${Math.round((Number(form.shooting.goals) / Number(form.shooting.shotsTaken)) * 100)}%`
                : '\u2014'}
            </p>
          )}
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <button
              type="button"
              onClick={() => setShowFootBreakdown(!showFootBreakdown)}
              className="text-xs text-accent hover:underline"
            >
              {showFootBreakdown ? 'Hide' : 'Show'} foot breakdown
            </button>
            <button
              type="button"
              onClick={() => setShowPhaseBreakdown(!showPhaseBreakdown)}
              className="text-xs text-accent hover:underline"
            >
              {showPhaseBreakdown ? 'Hide' : 'Show'} phase breakdown (early/mid/late)
            </button>
            <button
              type="button"
              onClick={() => setShowShotDetails(!showShotDetails)}
              className="text-xs text-accent hover:underline"
            >
              {showShotDetails ? 'Hide' : 'Show'} shot context details
            </button>
          </div>
          {showFootBreakdown && (
            <div className="mt-3 space-y-3">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Left Foot</p>
                <div className="grid grid-cols-2 gap-4">
                  <NumInput label="Shots" value={form.shooting.leftFoot.shots} onChange={v => update('shooting.leftFoot.shots', v)} />
                  <NumInput label="Goals" value={form.shooting.leftFoot.goals} onChange={v => update('shooting.leftFoot.goals', v)} />
                </div>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Right Foot</p>
                <div className="grid grid-cols-2 gap-4">
                  <NumInput label="Shots" value={form.shooting.rightFoot.shots} onChange={v => update('shooting.rightFoot.shots', v)} />
                  <NumInput label="Goals" value={form.shooting.rightFoot.goals} onChange={v => update('shooting.rightFoot.goals', v)} />
                </div>
              </div>
            </div>
          )}
          {showPhaseBreakdown && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-400">Break down shooting by session phase</p>
              <div className="grid grid-cols-3 gap-3">
                {['early', 'mid', 'late'].map(phase => (
                  <div key={phase}>
                    <p className="text-xs font-medium text-gray-500 mb-2 capitalize">{phase}</p>
                    <NumInput label="Shots" value={form.shooting.phases[phase].shots} onChange={v => update(`shooting.phases.${phase}.shots`, v)} />
                    <div className="mt-1">
                      <NumInput label="Goals" value={form.shooting.phases[phase].goals} onChange={v => update(`shooting.phases.${phase}.goals`, v)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
          {showShotDetails && (
            <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
              <p className="text-xs text-gray-400">Add shot groups with context tags (zone, type, approach, pressure)</p>
              {form.shooting.shotDetails.map((detail, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gray-500">Group {idx + 1}</span>
                    <button type="button" onClick={() => {
                      const next = [...form.shooting.shotDetails];
                      next.splice(idx, 1);
                      update('shooting.shotDetails', next);
                    }} className="text-xs text-red-400 hover:underline">Remove</button>
                  </div>
                  <ShotZoneGrid value={detail.zone} onChange={v => {
                    const next = [...form.shooting.shotDetails];
                    next[idx] = { ...next[idx], zone: v };
                    update('shooting.shotDetails', next);
                  }} />
                  <TagSelector label="Shot Type" options={SHOT_TYPES} value={detail.type} onChange={v => {
                    const next = [...form.shooting.shotDetails];
                    next[idx] = { ...next[idx], type: v };
                    update('shooting.shotDetails', next);
                  }} />
                  <TagSelector label="Approach" options={SHOT_APPROACHES} value={detail.approach} onChange={v => {
                    const next = [...form.shooting.shotDetails];
                    next[idx] = { ...next[idx], approach: v };
                    update('shooting.shotDetails', next);
                  }} />
                  <TagSelector label="Pressure" options={PRESSURE_SIMS} value={detail.pressure} onChange={v => {
                    const next = [...form.shooting.shotDetails];
                    next[idx] = { ...next[idx], pressure: v };
                    update('shooting.shotDetails', next);
                  }} />
                  <div className="grid grid-cols-2 gap-3">
                    <NumInput label="Shots" value={detail.shots} onChange={v => {
                      const next = [...form.shooting.shotDetails];
                      next[idx] = { ...next[idx], shots: v };
                      update('shooting.shotDetails', next);
                    }} />
                    <NumInput label="Goals" value={detail.goals} onChange={v => {
                      const next = [...form.shooting.shotDetails];
                      next[idx] = { ...next[idx], goals: v };
                      update('shooting.shotDetails', next);
                    }} />
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => {
                update('shooting.shotDetails', [...form.shooting.shotDetails, { zone: '', type: '', approach: '', pressure: '', shots: '', goals: '' }]);
              }} className="text-xs text-accent hover:underline">+ Add Shot Group</button>
            </div>
          )}
        </Card>
      )}

      {/* Passing Stats */}
      {showPassing && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Passing Stats</h3>
          <div className="grid grid-cols-3 gap-4">
            <NumInput label="Attempts" value={form.passing.attempts} onChange={v => update('passing.attempts', v)} />
            <NumInput label="Completed" value={form.passing.completed} onChange={v => update('passing.completed', v)} />
            <NumInput label="Key Passes" value={form.passing.keyPasses} onChange={v => update('passing.keyPasses', v)} />
          </div>
          {form.passing.attempts > 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Completion %: {form.passing.completed && form.passing.attempts
                ? `${Math.round((Number(form.passing.completed) / Number(form.passing.attempts)) * 100)}%`
                : '\u2014'}
            </p>
          )}
          {showPhaseBreakdown && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-400">Early vs late passing</p>
              <div className="grid grid-cols-2 gap-4">
                {['early', 'late'].map(phase => (
                  <div key={phase}>
                    <p className="text-xs font-medium text-gray-500 mb-2 capitalize">{phase}</p>
                    <NumInput label="Attempts" value={form.passing.phases[phase].attempts} onChange={v => update(`passing.phases.${phase}.attempts`, v)} />
                    <div className="mt-1">
                      <NumInput label="Completed" value={form.passing.phases[phase].completed} onChange={v => update(`passing.phases.${phase}.completed`, v)} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* Fitness Stats */}
      {showFitness && (
        <Card>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Fitness Stats</h3>
          <div className="grid grid-cols-2 gap-4">
            <NumInput label="Sprints Completed" value={form.fitness.sprints} onChange={v => update('fitness.sprints', v)} />
            <NumInput label={`Distance (${distanceUnit})`} value={form.fitness.distance} onChange={v => update('fitness.distance', v)} step="0.1" />
          </div>
          {showPhaseBreakdown && (
            <div className="mt-3 space-y-2">
              <p className="text-xs text-gray-400">Rate sprint quality per phase</p>
              <div className="grid grid-cols-2 gap-4">
                {['early', 'late'].map(phase => (
                  <div key={phase}>
                    <ScaleInput
                      label={`${phase.charAt(0).toUpperCase() + phase.slice(1)} Sprint Quality`}
                      value={form.fitness.phases[phase].sprintQuality}
                      onChange={v => update(`fitness.phases.${phase}.sprintQuality`, v)}
                      lowLabel="Poor"
                      highLabel="Great"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* RPE */}
      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Session RPE</h3>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="10"
            value={form.fitness.rpe}
            onChange={e => update('fitness.rpe', e.target.value)}
            className="flex-1 accent-accent"
          />
          <span className="text-lg font-bold text-accent w-8 text-center">{form.fitness.rpe}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">1 = Very Easy, 10 = Maximum Effort</p>
      </Card>

      {/* Notes */}
      <Card>
        <label className="block text-xs font-medium text-gray-500 mb-1">Session Notes</label>
        <textarea
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          placeholder="How did the session feel? Any observations..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
        />
      </Card>

      {/* Save as Template */}
      {!isEditing && setTemplates && (
        showSaveTemplate ? (
          <div className="flex gap-2">
            <input type="text" value={templateName} onChange={e => setTemplateName(e.target.value)} placeholder="Template name"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleSaveTemplate())} />
            <Button onClick={handleSaveTemplate}>Save</Button>
            <Button variant="ghost" onClick={() => { setShowSaveTemplate(false); setTemplateName(''); }}>Cancel</Button>
          </div>
        ) : (
          <button type="button" onClick={() => setShowSaveTemplate(true)} className="text-xs text-gray-400 hover:text-accent">
            Save as Template
          </button>
        )
      )}

      {/* Submit */}
      <Button type="submit" className="w-full py-3">
        {isEditing ? 'Update Session' : 'Save Session'}
      </Button>

      </>}
    </form>
  );
}

function ScaleInput({ label, value, onChange, lowLabel, highLabel }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <div className="flex items-center gap-1">
        {lowLabel && <span className="text-[10px] text-gray-400 mr-1 w-8">{lowLabel}</span>}
        {[1, 2, 3, 4, 5].map(n => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            className={`w-8 h-8 rounded-full text-xs font-medium transition-colors ${
              Number(value) === n ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {n}
          </button>
        ))}
        {highLabel && <span className="text-[10px] text-gray-400 ml-1 w-8">{highLabel}</span>}
      </div>
    </div>
  );
}

function NumInput({ label, value, onChange, step, placeholder }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        min="0"
        step={step || '1'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  );
}
