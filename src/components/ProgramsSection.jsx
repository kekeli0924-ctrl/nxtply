import { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

const CATEGORY_COLORS = {
  Shooting: 'bg-red-50 text-red-600',
  Dribbling: 'bg-blue-50 text-blue-600',
  'All-round': 'bg-purple-50 text-purple-600',
  Physical: 'bg-green-50 text-green-600',
};

const DIFFICULTY_COLORS = {
  beginner: 'bg-green-50 text-green-600',
  intermediate: 'bg-amber-50 text-amber-600',
  'beginner-intermediate': 'bg-amber-50 text-amber-600',
  advanced: 'bg-red-50 text-red-600',
};

export function ProgramsSection({ onProgramChange }) {
  const [programs, setPrograms] = useState([]);
  const [activeProgram, setActiveProgram] = useState(null);
  const [selectedProgram, setSelectedProgram] = useState(null);
  const [programDetail, setProgramDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  const role = window.__COMPOSED_ROLE__ || 'player';

  const fetchData = useCallback(async () => {
    try {
      const [progs, active] = await Promise.all([
        fetch(`/api/programs?_role=${role}`, { headers: { 'X-Dev-Role': role } }).then(r => r.ok ? r.json() : []),
        fetch(`/api/programs/active?_role=${role}`, { headers: { 'X-Dev-Role': role } }).then(r => r.ok ? r.json() : null).then(d => d?.active || d?.program ? d : null),
      ]);
      setPrograms(progs);
      setActiveProgram(active);
    } catch { /* ignore */ }
    setLoading(false);
  }, [role]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const viewDetail = async (id) => {
    try {
      const res = await fetch(`/api/programs/${id}?_role=${role}`, { headers: { 'X-Dev-Role': role } });
      if (res.ok) {
        const data = await res.json();
        setProgramDetail(data);
        setSelectedProgram(id);
      }
    } catch { /* ignore */ }
  };

  const enroll = async (id) => {
    try {
      const res = await fetch(`/api/programs/${id}/enroll?_role=${role}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Dev-Role': role },
      });
      if (res.ok) {
        setSelectedProgram(null);
        setProgramDetail(null);
        fetchData();
        onProgramChange?.();
      }
    } catch { /* ignore */ }
  };

  const cancelProgram = async () => {
    try {
      await fetch(`/api/programs/active?_role=${role}`, {
        method: 'DELETE',
        headers: { 'X-Dev-Role': role },
      });
      fetchData();
      onProgramChange?.();
    } catch { /* ignore */ }
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      {/* Active Program */}
      {activeProgram && (
        <Card>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Active Program</p>
                <p className="text-sm font-bold text-gray-900 mt-0.5">{activeProgram.program.name}</p>
              </div>
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${CATEGORY_COLORS[activeProgram.program.category] || 'bg-gray-50 text-gray-600'}`}>
                {activeProgram.program.category}
              </span>
            </div>

            {/* Progress */}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-500">Week {activeProgram.currentWeek}, Day {activeProgram.currentDay}</span>
                <span className="font-medium text-accent">
                  {activeProgram.completedSessions.length}/{activeProgram.program.sessionCount}
                </span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-accent h-2 rounded-full transition-all"
                  style={{ width: `${(activeProgram.completedSessions.length / activeProgram.program.sessionCount) * 100}%` }}
                />
              </div>
            </div>

            {/* Current session preview */}
            {activeProgram.currentSession && (
              <div className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-700">{activeProgram.currentSession.title}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{activeProgram.currentSession.focus} — {activeProgram.currentSession.durationMinutes} min</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {JSON.parse(activeProgram.currentSession.drills || '[]').slice(0, 3).map((d, i) => (
                    <span key={i} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">
                      {typeof d === 'string' ? d : d.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button onClick={cancelProgram} className="text-[10px] text-red-400 hover:text-red-600">
              Cancel program
            </button>
          </div>
        </Card>
      )}

      {/* Available Programs */}
      <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">
        {activeProgram ? 'Other Programs' : 'Training Programs'}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {programs.filter(p => p.id !== activeProgram?.program?.id).map(prog => (
          <Card key={prog.id}>
            <button className="w-full text-left" onClick={() => viewDetail(prog.id)}>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-bold text-gray-900">{prog.name}</p>
                <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${DIFFICULTY_COLORS[prog.difficulty] || ''}`}>
                  {prog.difficulty}
                </span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2">{prog.description}</p>
              <div className="flex items-center gap-3 mt-2 text-[10px] text-gray-400">
                <span>{prog.durationWeeks} weeks</span>
                <span>{prog.sessionsPerWeek}x/week</span>
                <span>{prog.sessionCount} sessions</span>
              </div>
            </button>
          </Card>
        ))}
      </div>

      {/* Program Detail Modal */}
      <Modal
        open={!!selectedProgram}
        onClose={() => { setSelectedProgram(null); setProgramDetail(null); }}
        title={programDetail?.name || ''}
        actions={
          <>
            <Button variant="secondary" onClick={() => { setSelectedProgram(null); setProgramDetail(null); }}>Close</Button>
            {!activeProgram && <Button onClick={() => enroll(selectedProgram)}>Start Program</Button>}
          </>
        }
      >
        {programDetail && (
          <div className="space-y-4">
            <p className="text-xs text-gray-500">{programDetail.description}</p>
            <div className="flex gap-2 text-[10px]">
              <span className={`px-2 py-0.5 rounded-full ${CATEGORY_COLORS[programDetail.category] || 'bg-gray-50'}`}>{programDetail.category}</span>
              <span className={`px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[programDetail.difficulty] || ''}`}>{programDetail.difficulty}</span>
              <span className="text-gray-400">{programDetail.durationWeeks} weeks · {programDetail.sessionsPerWeek}x/week</span>
            </div>

            {/* Week-by-week breakdown */}
            {programDetail.weeks?.map((week, wi) => (
              <div key={wi}>
                <p className="text-xs font-semibold text-gray-700 mb-1">Week {week.week}</p>
                <div className="space-y-1">
                  {week.sessions.map((s, si) => (
                    <div key={si} className="bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex justify-between">
                        <span className="text-xs font-medium text-gray-700">{s.title}</span>
                        <span className="text-[10px] text-gray-400">{s.durationMinutes} min</span>
                      </div>
                      <p className="text-[10px] text-gray-400">{s.focus}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}
