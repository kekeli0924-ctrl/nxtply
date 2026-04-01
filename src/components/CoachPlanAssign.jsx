import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { PRESET_DRILLS, getWeekDates, formatDateShort } from '../utils/stats';

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function CoachPlanAssign() {
  const [roster, setRoster] = useState([]);
  const [selectedPlayer, setSelectedPlayer] = useState(null);
  const [plans, setPlans] = useState([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [editingPlan, setEditingPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch roster
  useEffect(() => {
    fetch('/api/roster', { headers: { 'X-Dev-Role': window.__COMPOSED_ROLE__ || 'coach' } })
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setRoster(data);
        if (data.length > 0 && !selectedPlayer) setSelectedPlayer(data[0]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch plans for selected player
  const fetchPlans = useCallback(async () => {
    if (!selectedPlayer) return;
    try {
      const res = await fetch(`/api/assigned-plans/player/${selectedPlayer.playerId}`, {
        headers: { 'X-Dev-Role': 'coach' },
      });
      if (res.ok) setPlans(await res.json());
    } catch { /* ignore */ }
  }, [selectedPlayer]);

  useEffect(() => { fetchPlans(); }, [fetchPlans]);

  const plansByDate = useMemo(() => {
    const map = {};
    for (const p of plans) map[p.date] = p;
    return map;
  }, [plans]);

  const savePlan = async (planData) => {
    if (!selectedPlayer) return;
    const existing = plansByDate[planData.date];
    const method = existing ? 'PUT' : 'POST';
    const url = existing ? `/api/assigned-plans/${existing.id}` : '/api/assigned-plans';
    const body = existing
      ? { date: planData.date, drills: planData.drills, targetDuration: planData.targetDuration, notes: planData.notes }
      : { id: crypto.randomUUID(), playerId: selectedPlayer.playerId, ...planData };

    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json', 'X-Dev-Role': window.__COMPOSED_ROLE__ || 'coach' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        fetchPlans();
        setEditingPlan(null);
      }
    } catch { /* ignore */ }
  };

  const deletePlan = async (id) => {
    try {
      await fetch(`/api/assigned-plans/${id}`, {
        method: 'DELETE',
        headers: { 'X-Dev-Role': 'coach' },
      });
      fetchPlans();
      setEditingPlan(null);
    } catch { /* ignore */ }
  };

  if (loading) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  if (roster.length === 0) {
    return (
      <div className="space-y-5 max-w-3xl mx-auto">
        <h2 className="text-xl font-bold text-gray-900">Assign Plans</h2>
        <Card>
          <div className="text-center py-8">
            <p className="text-sm text-gray-500">No players on your roster yet.</p>
            <p className="text-xs text-gray-400 mt-1">Go to Roster to invite players first.</p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Assign Plans</h2>

      {/* Player selector */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {roster.map(p => (
          <button
            key={p.playerId}
            onClick={() => setSelectedPlayer(p)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              selectedPlayer?.playerId === p.playerId
                ? 'bg-accent text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p.playerName}
          </button>
        ))}
      </div>

      {/* Week navigation */}
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

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDates.map((date, i) => {
          const plan = plansByDate[date];
          const isToday = date === todayStr;

          return (
            <div
              key={date}
              onClick={() => setEditingPlan({ date, drills: plan?.drills || [], targetDuration: plan?.targetDuration || 60, notes: plan?.notes || '' })}
              className={`rounded-xl border p-3 min-h-[120px] flex flex-col cursor-pointer hover:border-accent/50 transition-colors ${
                isToday ? 'border-accent bg-accent/5' : 'border-gray-100 bg-surface'
              }`}
            >
              <div className="mb-2">
                <p className={`text-xs font-medium ${isToday ? 'text-accent' : 'text-gray-400'}`}>{DAY_NAMES[i]}</p>
                <p className="text-sm font-semibold text-gray-700">{formatDateShort(date)}</p>
              </div>

              {plan ? (
                <div className="flex-1">
                  <div className="flex flex-wrap gap-1 mb-1">
                    {plan.drills.slice(0, 2).map(d => (
                      <span key={d} className="bg-blue-50 text-blue-600 text-[10px] px-1.5 py-0.5 rounded-full">{d}</span>
                    ))}
                    {plan.drills.length > 2 && (
                      <span className="text-[10px] text-gray-400">+{plan.drills.length - 2}</span>
                    )}
                  </div>
                  {plan.targetDuration > 0 && (
                    <p className="text-[10px] text-gray-400">{plan.targetDuration} min</p>
                  )}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <span className="text-gray-200 text-xl">+</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Edit plan modal */}
      <Modal
        open={!!editingPlan}
        onClose={() => setEditingPlan(null)}
        title={editingPlan ? `Plan for ${formatDateShort(editingPlan.date)}` : ''}
        actions={
          <>
            <Button variant="secondary" onClick={() => setEditingPlan(null)}>Cancel</Button>
            {plansByDate[editingPlan?.date] && (
              <Button variant="danger" onClick={() => deletePlan(plansByDate[editingPlan.date].id)}>Delete</Button>
            )}
            <Button onClick={() => editingPlan && savePlan(editingPlan)}>Save</Button>
          </>
        }
      >
        {editingPlan && (
          <PlanEditForm
            plan={editingPlan}
            onChange={setEditingPlan}
          />
        )}
      </Modal>
    </div>
  );
}

function PlanEditForm({ plan, onChange }) {
  const allDrills = PRESET_DRILLS;
  const toggleDrill = (drill) => {
    const drills = plan.drills.includes(drill)
      ? plan.drills.filter(d => d !== drill)
      : [...plan.drills, drill];
    onChange({ ...plan, drills });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-2">Drills</label>
        <div className="flex flex-wrap gap-2">
          {allDrills.map(d => (
            <button
              key={d}
              type="button"
              onClick={() => toggleDrill(d)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                plan.drills.includes(d)
                  ? 'bg-accent text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Target Duration (min)</label>
        <input
          type="number"
          min={0}
          max={300}
          value={plan.targetDuration}
          onChange={e => onChange({ ...plan, targetDuration: Number(e.target.value) || 0 })}
          className="w-24 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">Notes</label>
        <textarea
          value={plan.notes}
          onChange={e => onChange({ ...plan, notes: e.target.value })}
          rows={3}
          placeholder="Instructions for the player..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>
    </div>
  );
}
