import { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { ShotZoneGrid } from './ui/FormInputs';
import { VideoUpload } from './VideoUpload';
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

function detectMediaType(url) {
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube';
  if (/drive\.google\.com|docs\.google\.com/i.test(url)) return 'drive';
  return 'other';
}

function MediaLinkInput({ onAdd }) {
  const [url, setUrl] = useState('');
  const [label, setLabel] = useState('');

  const handleAdd = () => {
    if (!url.trim()) return;
    try {
      new URL(url); // validate URL
    } catch {
      return;
    }
    onAdd({ url: url.trim(), label: label.trim(), type: detectMediaType(url) });
    setUrl('');
    setLabel('');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <input type="url" value={url} onChange={e => setUrl(e.target.value)} placeholder="https://youtube.com/..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
          onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAdd())} />
        <button type="button" onClick={handleAdd}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200 transition-colors">
          Add
        </button>
      </div>
      <input type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="Label (optional)"
        className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30" />
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
      shotDetails: [],
    },
    passing: {
      attempts: '', completed: '', keyPasses: '',
    },
    fitness: {
      sprints: '', distance: '', rpe: 5,
    },
    notes: '',
    intention: '',
    sessionType: '',
    position: 'general',
    quickRating: 3,
    reflection: { confidence: 3, focus: 3, enjoyment: 3, notes: '' },
    idpGoals: [],
    mediaLinks: [],
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
    },
    passing: {
      attempts: session.passing?.attempts ?? '',
      completed: session.passing?.completed ?? '',
      keyPasses: session.passing?.keyPasses ?? '',
    },
    fitness: {
      sprints: session.fitness?.sprints ?? '',
      distance: session.fitness?.distance ?? '',
      rpe: session.fitness?.rpe ?? 5,
    },
    notes: session.notes || '',
    quickRating: session.quickRating ?? 3,
    idpGoals: session.idpGoals ? [...session.idpGoals] : [],
    mediaLinks: session.mediaLinks ? [...session.mediaLinks] : [],
  };
}

export function SessionLogger({ onSave, editSession, customDrills, onAddCustomDrill, distanceUnit, templates = [], setTemplates, idpGoals = [] }) {
  const [form, setForm] = useState(emptyForm);
  const [newDrill, setNewDrill] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [errors, setErrors] = useState({});
  const [showFootBreakdown, setShowFootBreakdown] = useState(false);
  const [quickMode, setQuickMode] = useState(false);
  const [showShotDetails, setShowShotDetails] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [inputMode, setInputMode] = useState('manual'); // 'manual' | 'video'
  const [aiFields, setAiFields] = useState(new Set()); // track which fields were AI-filled

  const allDrills = [...PRESET_DRILLS, ...customDrills];
  const isEditing = !!editSession;

  const handleVideoAnalysis = useCallback((result) => {
    const filled = new Set();
    const updates = {};

    if (result.duration) { updates.duration = String(result.duration); filled.add('duration'); }
    if (result.drills?.length) { updates.drills = result.drills; filled.add('drills'); }
    if (result.quickRating) { updates.quickRating = result.quickRating; filled.add('quickRating'); }
    if (result.sessionType) { updates.sessionType = result.sessionType; filled.add('sessionType'); }
    if (result.notes) { updates.notes = result.notes; filled.add('notes'); }

    if (result.shooting) {
      updates.shooting = {
        goals: String(result.shooting.goals || 0),
        shotsTaken: String(result.shooting.shotsTaken || 0),
        leftFoot: result.shooting.leftFoot ? {
          shots: String(result.shooting.leftFoot.shots || 0),
          goals: String(result.shooting.leftFoot.goals || 0),
        } : { shots: '0', goals: '0' },
        rightFoot: result.shooting.rightFoot ? {
          shots: String(result.shooting.rightFoot.shots || 0),
          goals: String(result.shooting.rightFoot.goals || 0),
        } : { shots: '0', goals: '0' },
      };
      filled.add('shooting');
      if (result.shooting.leftFoot || result.shooting.rightFoot) setShowFootBreakdown(true);
    }

    if (result.passing) {
      updates.passing = {
        attempts: String(result.passing.attempts || 0),
        completed: String(result.passing.completed || 0),
        keyPasses: String(result.passing.keyPasses || 0),
      };
      filled.add('passing');
    }

    if (result.fitness) {
      updates.fitness = {
        rpe: String(result.fitness.rpe || 5),
        sprints: String(result.fitness.sprints || 0),
        distance: String(result.fitness.distance || 0),
        distanceUnit: distanceUnit || 'km',
      };
      filled.add('fitness');
    }

    setForm(prev => ({ ...prev, ...updates }));
    setAiFields(filled);
    setInputMode('manual'); // switch to manual so player can review
  }, [distanceUnit]);

  useEffect(() => {
    if (editSession) {
      setForm(sessionToForm(editSession));
      setShowFootBreakdown(
        !!(editSession.shooting?.leftFoot?.shots || editSession.shooting?.rightFoot?.shots)
      );
      setShowShotDetails(!!(editSession.shooting?.shotDetails?.length));
    } else {
      setForm(emptyForm());
      setShowFootBreakdown(false);
      setShowShotDetails(false);
    }
  }, [editSession]);

  // Listen for daily plan pre-fill
  useEffect(() => {
    const handler = (e) => {
      const plan = e.detail;
      if (plan?.drills) {
        setForm(prev => ({
          ...prev,
          drills: plan.drills,
          duration: String(plan.targetDuration || 45),
          intention: plan.focus || '',
        }));
        setInputMode('manual');
      }
    };
    window.addEventListener('prefill-session', handler);
    return () => window.removeEventListener('prefill-session', handler);
  }, []);

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
      idpGoals: form.idpGoals || [],
      mediaLinks: form.mediaLinks || [],
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

      {/* Input mode toggle */}
      {!isEditing && (
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
          <button type="button" onClick={() => setInputMode('manual')}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${inputMode === 'manual' ? 'bg-white text-accent shadow-sm' : 'text-gray-500'}`}>
            Manual Entry
          </button>
          <button type="button" onClick={() => setInputMode('video')}
            className={`flex-1 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${inputMode === 'video' ? 'bg-white text-accent shadow-sm' : 'text-gray-500'}`}>
            Upload Video
          </button>
        </div>
      )}

      {/* Video upload mode */}
      {inputMode === 'video' && !isEditing && (
        <VideoUpload onAnalysisComplete={handleVideoAnalysis} />
      )}

      {/* AI-filled notice */}
      {aiFields.size > 0 && inputMode === 'manual' && (
        <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
          <span className="text-blue-500 text-sm">🤖</span>
          <p className="text-xs text-blue-600">
            AI pre-filled {aiFields.size} fields from your video. Review and adjust before saving.
          </p>
          <button type="button" onClick={() => setAiFields(new Set())} className="text-blue-400 hover:text-blue-600 ml-auto text-xs">Dismiss</button>
        </div>
      )}

      {/* Template Selector */}
      {!isEditing && templates.length > 0 && !quickMode && inputMode === 'manual' && (
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

      <div className={inputMode === 'video' && !isEditing ? 'hidden' : ''}>
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

      {/* IDP Goal Selector */}
      {idpGoals.filter(g => g.status === 'active').length > 0 && (
        <Card>
          <label className="block text-xs font-medium text-gray-500 mb-3">Link IDP Goals (optional)</label>
          <div className="flex flex-wrap gap-2">
            {idpGoals.filter(g => g.status === 'active').map(goal => (
              <button
                key={goal.id}
                type="button"
                onClick={() => {
                  setForm(prev => ({
                    ...prev,
                    idpGoals: prev.idpGoals.includes(goal.id)
                      ? prev.idpGoals.filter(id => id !== goal.id)
                      : [...prev.idpGoals, goal.id],
                  }));
                }}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  form.idpGoals.includes(goal.id)
                    ? 'bg-accent text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {goal.text.length > 40 ? goal.text.slice(0, 40) + '...' : goal.text}
              </button>
            ))}
          </div>
        </Card>
      )}

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

      {/* Media Links */}
      <Card>
        <label className="block text-xs font-medium text-gray-500 mb-3">Media Links (optional)</label>
        {form.mediaLinks.map((link, i) => (
          <div key={i} className="flex items-center gap-2 mb-2">
            <span className="text-xs shrink-0">
              {link.type === 'youtube' ? '▶' : link.type === 'drive' ? '📁' : '🔗'}
            </span>
            <span className="text-xs text-accent truncate flex-1">{link.label || link.url}</span>
            <button type="button" onClick={() => setForm(prev => ({ ...prev, mediaLinks: prev.mediaLinks.filter((_, j) => j !== i) }))}
              className="text-xs text-red-400 hover:text-red-600">✕</button>
          </div>
        ))}
        {form.mediaLinks.length < 10 && (
          <MediaLinkInput onAdd={(link) => setForm(prev => ({ ...prev, mediaLinks: [...prev.mediaLinks, link] }))} />
        )}
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
      </div>
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
