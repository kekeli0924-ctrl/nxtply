import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';
import { DrillDiagram } from './DrillDiagram';

const CATEGORIES = ['All', 'Technical', 'Tactical', 'Physical', 'Psychological', 'Warm-Up & Cool-Down'];
const DIFFICULTIES = ['All', 'Beginner', 'Intermediate', 'Advanced'];

const CATEGORY_COLORS = {
  Technical: 'bg-blue-100 text-blue-700',
  Physical: 'bg-green-100 text-green-700',
  Tactical: 'bg-purple-100 text-purple-700',
  Psychological: 'bg-amber-100 text-amber-700',
  'Warm-Up & Cool-Down': 'bg-gray-200 text-gray-600',
};

const DIFFICULTY_COLORS = {
  Beginner: 'bg-green-50 text-green-600',
  Intermediate: 'bg-amber-50 text-amber-600',
  Advanced: 'bg-red-50 text-red-600',
};

function Badge({ text, colorClass }) {
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colorClass}`}>
      {text}
    </span>
  );
}

function DrillCard({ drill, onClick }) {
  return (
    <Card onClick={onClick} className="flex flex-col gap-2">
      <div className="flex items-start justify-between gap-2">
        <h4 className="text-sm font-bold text-gray-900 leading-snug">{drill.name}</h4>
      </div>
      <div className="flex flex-wrap gap-1.5">
        <Badge text={drill.category} colorClass={CATEGORY_COLORS[drill.category] || 'bg-gray-200 text-gray-600'} />
        <Badge text={drill.difficulty} colorClass={DIFFICULTY_COLORS[drill.difficulty] || 'bg-gray-200 text-gray-600'} />
      </div>
      <p className="text-xs text-gray-500 line-clamp-1">{drill.description}</p>
      <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-auto">
        {drill.durationMinutes && <span>{drill.durationMinutes} min</span>}
        {drill.equipmentNeeded && <span>{drill.equipmentNeeded}</span>}
      </div>
    </Card>
  );
}

function DrillDetailModal({ drill, open, onClose, onAddToPlan }) {
  if (!drill) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={drill.name}
      actions={
        <>
          <Button variant="secondary" onClick={onClose}>Close</Button>
          {onAddToPlan && (
            <Button onClick={() => onAddToPlan(drill)}>Add to Plan</Button>
          )}
        </>
      }
    >
      <div className="space-y-4">
        {/* Drill Diagram */}
        <DrillDiagram drill={drill} />

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge text={drill.category} colorClass={CATEGORY_COLORS[drill.category] || 'bg-gray-200 text-gray-600'} />
          <Badge text={drill.difficulty} colorClass={DIFFICULTY_COLORS[drill.difficulty] || 'bg-gray-200 text-gray-600'} />
          {drill.isPreset && <Badge text="Preset" colorClass="bg-accent/10 text-accent" />}
        </div>

        {/* Description */}
        <p className="text-sm text-gray-700 leading-relaxed">{drill.description}</p>

        {/* Reps */}
        {drill.repsDescription && (
          <div>
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Reps</h5>
            <p className="text-sm text-gray-700">{drill.repsDescription}</p>
          </div>
        )}

        {/* Coaching Points */}
        {drill.coachingPoints?.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Coaching Points</h5>
            <ol className="list-decimal list-inside space-y-1">
              {drill.coachingPoints.map((point, i) => (
                <li key={i} className="text-sm text-gray-700">{point}</li>
              ))}
            </ol>
          </div>
        )}

        {/* Variations */}
        {drill.variations?.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Variations</h5>
            <ul className="list-disc list-inside space-y-1">
              {drill.variations.map((v, i) => (
                <li key={i} className="text-sm text-gray-700">{v}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Equipment & Space */}
        <div className="flex gap-4">
          {drill.equipmentNeeded && (
            <div className="flex-1">
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Equipment</h5>
              <p className="text-sm text-gray-700">{drill.equipmentNeeded}</p>
            </div>
          )}
          {drill.spaceNeeded && (
            <div className="flex-1">
              <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Space</h5>
              <p className="text-sm text-gray-700">{drill.spaceNeeded}</p>
            </div>
          )}
        </div>

        {/* Duration */}
        {drill.durationMinutes && (
          <div>
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Duration</h5>
            <p className="text-sm text-gray-700">{drill.durationMinutes} minutes</p>
          </div>
        )}

        {/* Position Relevance */}
        {drill.positionRelevance?.length > 0 && (
          <div>
            <h5 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Position Relevance</h5>
            <div className="flex flex-wrap gap-1.5">
              {drill.positionRelevance.map((pos) => (
                <span key={pos} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
                  {pos}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function DrillExplorer({ onAddToPlan }) {
  const [drills, setDrills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [category, setCategory] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [position, setPosition] = useState('All');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedDrill, setSelectedDrill] = useState(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch drills when filters change
  const fetchDrills = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (category !== 'All') params.set('category', category);
      if (difficulty !== 'All') params.set('difficulty', difficulty);
      if (debouncedSearch) params.set('search', debouncedSearch);
      const qs = params.toString();
      const res = await fetch(`/api/drills${qs ? `?${qs}` : ''}`);
      if (!res.ok) throw new Error('Failed to load drills');
      const data = await res.json();
      setDrills(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [category, difficulty, debouncedSearch]);

  useEffect(() => { fetchDrills(); }, [fetchDrills]);

  // Filter by position on client side
  const POSITIONS = ['All', 'Striker', 'Winger', 'CAM', 'CDM', 'CB', 'GK'];

  const filteredByPosition = useMemo(() => {
    if (position === 'All') return drills;
    return drills.filter(d => {
      const pr = d.positionRelevance || [];
      return pr.includes(position) || pr.includes('All');
    });
  }, [drills, position]);

  const drillCount = filteredByPosition.length;

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Drill Explorer</h2>

      {/* Position tabs */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide">
        {POSITIONS.map(p => (
          <button
            key={p}
            onClick={() => setPosition(p)}
            className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              position === p ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      {/* Filter Bar */}
      <Card className="flex flex-wrap items-center gap-3">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Filter by category"
        >
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Filter by difficulty"
        >
          {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
        </select>

        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search drills..."
          className="flex-1 min-w-[160px] text-sm bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
          aria-label="Search drills by name or keyword"
        />
      </Card>

      {/* Results Summary */}
      <p className="text-xs text-gray-400">
        {loading ? 'Loading drills...' : `${drillCount} drill${drillCount !== 1 ? 's' : ''} found`}
      </p>

      {/* Error State */}
      {error && (
        <Card className="text-center py-6">
          <p className="text-sm text-red-600 font-medium">{error}</p>
          <Button variant="secondary" onClick={fetchDrills} className="mt-3">Retry</Button>
        </Card>
      )}

      {/* Loading Skeleton */}
      {loading && !error && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
              <div className="flex gap-1.5 mb-2">
                <div className="h-4 bg-gray-200 rounded w-16" />
                <div className="h-4 bg-gray-200 rounded w-14" />
              </div>
              <div className="h-3 bg-gray-100 rounded w-full mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/2" />
            </Card>
          ))}
        </div>
      )}

      {/* Drill Grid */}
      {!loading && !error && drillCount > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {filteredByPosition.map(drill => (
            <DrillCard
              key={drill.id}
              drill={drill}
              onClick={() => setSelectedDrill(drill)}
            />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && drillCount === 0 && (
        <Card className="text-center py-8">
          <div className="text-3xl mb-2">🔍</div>
          <p className="text-sm font-semibold text-gray-700">No drills match your filters</p>
          <p className="text-xs text-gray-400 mt-1">Try adjusting the category, difficulty, or search term.</p>
        </Card>
      )}

      {/* Detail Modal */}
      <DrillDetailModal
        drill={selectedDrill}
        open={!!selectedDrill}
        onClose={() => setSelectedDrill(null)}
        onAddToPlan={onAddToPlan}
      />
    </div>
  );
}
