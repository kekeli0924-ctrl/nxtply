import { useState, useEffect } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

const today = () => new Date().toISOString().split('T')[0];

function emptyForm() {
  return {
    date: today(),
    opponent: '',
    result: '',
    minutesPlayed: '',
    goals: '',
    assists: '',
    shots: '',
    passesCompleted: '',
    rating: 6,
    notes: '',
  };
}

export function MatchLogger({ onSave, editMatch, onCancel }) {
  const [form, setForm] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const isEditing = editMatch && editMatch.id;

  useEffect(() => {
    if (editMatch?.id) {
      setForm({
        date: editMatch.date,
        opponent: editMatch.opponent || '',
        result: editMatch.result || '',
        minutesPlayed: editMatch.minutesPlayed ?? '',
        goals: editMatch.goals ?? '',
        assists: editMatch.assists ?? '',
        shots: editMatch.shots ?? '',
        passesCompleted: editMatch.passesCompleted ?? '',
        rating: editMatch.rating ?? 6,
        notes: editMatch.notes || '',
      });
    } else {
      setForm(emptyForm());
    }
  }, [editMatch]);

  const update = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    setErrors(prev => ({ ...prev, [field]: undefined }));
  };

  const validate = () => {
    const errs = {};
    if (!form.opponent.trim()) errs.opponent = 'Enter opponent name';
    if (!form.result) errs.result = 'Select a result';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;
    const num = (v) => v === '' ? 0 : Number(v);
    onSave({
      id: editMatch?.id || crypto.randomUUID(),
      date: form.date,
      opponent: form.opponent.trim(),
      result: form.result,
      minutesPlayed: num(form.minutesPlayed),
      goals: num(form.goals),
      assists: num(form.assists),
      shots: num(form.shots),
      passesCompleted: num(form.passesCompleted),
      rating: Number(form.rating),
      notes: form.notes.trim(),
    });
  };

  const results = ['W', 'D', 'L'];
  const resultColors = { W: 'bg-green-500 text-white', D: 'bg-yellow-400 text-white', L: 'bg-red-500 text-white' };
  const resultLabels = { W: 'Win', D: 'Draw', L: 'Loss' };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          {isEditing ? 'Edit Match' : 'Log Match'}
        </h2>
        {onCancel && (
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
        )}
      </div>

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
            <label className="block text-xs font-medium text-gray-500 mb-1">Opponent</label>
            <input
              type="text"
              value={form.opponent}
              onChange={e => update('opponent', e.target.value)}
              placeholder="Team name"
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 ${errors.opponent ? 'border-red-300' : 'border-gray-200'}`}
            />
            {errors.opponent && <p className="text-xs text-red-500 mt-1">{errors.opponent}</p>}
          </div>
        </div>
      </Card>

      <Card>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Result
              {errors.result && <span className="text-red-500 ml-2">{errors.result}</span>}
            </label>
            <div className="flex gap-2">
              {results.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => update('result', r)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    form.result === r ? resultColors[r] : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {resultLabels[r]}
                </button>
              ))}
            </div>
          </div>
          <NumInput label="Minutes Played" value={form.minutesPlayed} onChange={v => update('minutesPlayed', v)} />
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Match Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <NumInput label="Goals" value={form.goals} onChange={v => update('goals', v)} />
          <NumInput label="Assists" value={form.assists} onChange={v => update('assists', v)} />
          <NumInput label="Shots" value={form.shots} onChange={v => update('shots', v)} />
          <NumInput label="Passes Completed" value={form.passesCompleted} onChange={v => update('passesCompleted', v)} />
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Match Rating</h3>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="1"
            max="10"
            value={form.rating}
            onChange={e => update('rating', e.target.value)}
            className="flex-1 accent-accent"
          />
          <span className="text-lg font-bold text-accent w-8 text-center">{form.rating}</span>
        </div>
        <p className="text-xs text-gray-400 mt-1">1 = Poor, 10 = Outstanding</p>
      </Card>

      <Card>
        <label className="block text-xs font-medium text-gray-500 mb-1">Match Notes</label>
        <textarea
          value={form.notes}
          onChange={e => update('notes', e.target.value)}
          placeholder="Key moments, areas to improve..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30 resize-none"
        />
      </Card>

      <Button type="submit" className="w-full py-3">
        {isEditing ? 'Update Match' : 'Save Match'}
      </Button>
    </form>
  );
}

function NumInput({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 mb-1">{label}</label>
      <input
        type="number"
        min="0"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
    </div>
  );
}
