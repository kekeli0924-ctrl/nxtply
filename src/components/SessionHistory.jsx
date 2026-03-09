import { useState, useMemo } from 'react';
import { Button } from './ui/Button';
import { ConfirmModal, Modal } from './ui/Modal';
import { Card } from './ui/Card';
import { SessionComparison } from './SessionComparison';
import { formatDate, formatPercentage, PRESET_DRILLS, SESSION_TYPES } from '../utils/stats';

export function SessionHistory({ sessions, customDrills, onEdit, onDelete, onView }) {
  const [sortField, setSortField] = useState('date');
  const [sortDir, setSortDir] = useState('desc');
  const [filterDrill, setFilterDrill] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [compareMode, setCompareMode] = useState(false);
  const [compareSelections, setCompareSelections] = useState([]);

  const allDrills = [...PRESET_DRILLS, ...customDrills];

  const filtered = useMemo(() => {
    let result = [...sessions];
    if (filterDrill) result = result.filter(s => s.drills.includes(filterDrill));
    if (filterType) result = result.filter(s => s.sessionType === filterType);
    if (filterDateFrom) result = result.filter(s => s.date >= filterDateFrom);
    if (filterDateTo) result = result.filter(s => s.date <= filterDateTo);

    result.sort((a, b) => {
      let aVal, bVal;
      switch (sortField) {
        case 'date': aVal = a.date; bVal = b.date; break;
        case 'duration': aVal = a.duration; bVal = b.duration; break;
        case 'shotPct':
          aVal = a.shooting ? (a.shooting.goals / (a.shooting.shotsTaken || 1)) : -1;
          bVal = b.shooting ? (b.shooting.goals / (b.shooting.shotsTaken || 1)) : -1;
          break;
        case 'passPct':
          aVal = a.passing ? (a.passing.completed / (a.passing.attempts || 1)) : -1;
          bVal = b.passing ? (b.passing.completed / (b.passing.attempts || 1)) : -1;
          break;
        default: aVal = a.date; bVal = b.date;
      }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return result;
  }, [sessions, filterDrill, filterType, filterDateFrom, filterDateTo, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const handleCardClick = (session) => {
    if (compareMode) {
      setCompareSelections(prev => {
        if (prev.find(s => s.id === session.id)) return prev.filter(s => s.id !== session.id);
        if (prev.length >= 2) return [prev[1], session];
        return [...prev, session];
      });
    } else {
      onView(session);
    }
  };

  const exitCompare = () => {
    setCompareMode(false);
    setCompareSelections([]);
  };

  const SortBtn = ({ field, label }) => (
    <button
      type="button"
      onClick={() => toggleSort(field)}
      className={`text-xs font-medium px-2 py-1 rounded ${sortField === field ? 'bg-accent text-white' : 'text-gray-500 hover:bg-gray-100'}`}
    >
      {label} {sortField === field ? (sortDir === 'desc' ? '\u2193' : '\u2191') : ''}
    </button>
  );

  const isSelected = (id) => compareSelections.some(s => s.id === id);

  return (
    <div className="space-y-4 max-w-3xl mx-auto">
      <h2 className="text-xl font-bold text-gray-900">Session History</h2>

      {/* Filters */}
      <Card>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Drill</label>
            <select
              value={filterDrill}
              onChange={e => setFilterDrill(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">All Drills</option>
              {allDrills.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Type</label>
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">All Types</option>
              {SESSION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">From</label>
            <input type="date" value={filterDateFrom} onChange={e => setFilterDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
            <input type="date" value={filterDateTo} onChange={e => setFilterDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
          </div>
          {(filterDrill || filterType || filterDateFrom || filterDateTo) && (
            <Button variant="ghost" onClick={() => { setFilterDrill(''); setFilterType(''); setFilterDateFrom(''); setFilterDateTo(''); }}>Clear</Button>
          )}
        </div>
      </Card>

      {/* Sort + Compare Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 items-center">
          <span className="text-xs text-gray-400 mr-1">Sort by:</span>
          <SortBtn field="date" label="Date" />
          <SortBtn field="duration" label="Duration" />
          <SortBtn field="shotPct" label="Shot %" />
          <SortBtn field="passPct" label="Pass %" />
        </div>
        {sessions.length >= 2 && (
          compareMode ? (
            <Button variant="ghost" onClick={exitCompare}>Cancel Compare</Button>
          ) : (
            <Button variant="secondary" onClick={() => setCompareMode(true)}>Compare</Button>
          )
        )}
      </div>

      {compareMode && (
        <p className="text-xs text-accent bg-accent/5 rounded-lg px-3 py-2">
          Select 2 sessions to compare. {compareSelections.length}/2 selected.
        </p>
      )}

      {/* Session List */}
      {filtered.length === 0 ? (
        <Card className="text-center text-gray-300 text-sm py-8">No sessions found.</Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((session, i) => (
            <Card
              key={session.id}
              onClick={() => handleCardClick(session)}
              className={`group ${compareMode && isSelected(session.id) ? 'ring-2 ring-accent' : ''}`}
              style={{ animation: 'fadeSlideUp 0.25s ease-out both', animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-center justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{formatDate(session.date)}</p>
                    {session.sessionType && (
                      <span className="text-[10px] font-medium bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded">{session.sessionType}</span>
                    )}
                    {session.position && session.position !== 'general' && (
                      <span className="text-[10px] font-medium bg-accent/10 text-accent px-1.5 py-0.5 rounded">{session.position.toUpperCase()}</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 truncate">{session.drills.join(', ')}</p>
                </div>
                <div className="flex items-center gap-4 ml-4">
                  <div className="flex gap-4 text-right">
                    {session.shooting && (
                      <div>
                        <p className="text-xs text-gray-400">Shot %</p>
                        <p className="text-sm font-semibold text-accent">{formatPercentage(session.shooting.goals, session.shooting.shotsTaken)}</p>
                      </div>
                    )}
                    {session.passing && (
                      <div>
                        <p className="text-xs text-gray-400">Pass %</p>
                        <p className="text-sm font-semibold text-accent">{formatPercentage(session.passing.completed, session.passing.attempts)}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-400">Min</p>
                      <p className="text-sm font-semibold text-gray-600">{session.duration}</p>
                    </div>
                  </div>
                  {!compareMode && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" onClick={e => { e.stopPropagation(); onEdit(session); }}>Edit</Button>
                      <Button variant="danger" onClick={e => { e.stopPropagation(); setDeleteTarget(session); }}>Delete</Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <p className="text-xs text-gray-400 text-center">{filtered.length} session{filtered.length !== 1 ? 's' : ''}</p>

      {/* Compare Modal */}
      <Modal
        open={compareSelections.length === 2}
        onClose={() => setCompareSelections([])}
        title="Session Comparison"
        actions={<Button variant="secondary" onClick={() => setCompareSelections([])}>Close</Button>}
      >
        <SessionComparison sessionA={compareSelections[0]} sessionB={compareSelections[1]} />
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => { onDelete(deleteTarget.id); setDeleteTarget(null); }}
        title="Delete Session"
        message={`Are you sure you want to delete the session from ${deleteTarget ? formatDate(deleteTarget.date) : ''}? This cannot be undone.`}
        confirmText="Delete"
        danger
      />
    </div>
  );
}
