import { useState, useRef, useEffect } from 'react';
import { Button } from './ui/Button';
import { Card, StatCard } from './ui/Card';
import { NumInput } from './ui/FormInputs';
import { formatDate, formatDateShort, computeLSPTScore, computeLSSTScore, LSPT_NORMS, LSST_NORMS, getBenchmarkLevel } from '../utils/stats';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const ACCENT = '#1E3A5F';
const GRAY = '#78716C';
const GRID = '#E8E5E0';

const LEVEL_COLORS = { Elite: 'bg-green-100 text-green-700', Advanced: 'bg-blue-100 text-blue-700', Intermediate: 'bg-amber-100 text-amber-700', Beginner: 'bg-gray-100 text-gray-500' };

function LevelBadge({ score, norms }) {
  const level = getBenchmarkLevel(score, norms);
  return <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${LEVEL_COLORS[level]}`}>{level}</span>;
}

function NormsLegend({ norms }) {
  return (
    <div className="flex gap-3 mt-1 justify-center">
      {Object.entries(norms).filter(([k]) => k !== 'beginner').map(([key, val]) => (
        <span key={key} className="text-[10px] text-gray-400">{key.charAt(0).toUpperCase() + key.slice(1)}: {val}+</span>
      ))}
    </div>
  );
}

const emptyLSPT = { timeSeconds: '', attempts: '', completed: '', errors: '' };
const emptyLSST = {
  zones: {
    'left-near': { shots: '', goals: '' }, 'left-mid': { shots: '', goals: '' }, 'left-far': { shots: '', goals: '' },
    'right-near': { shots: '', goals: '' }, 'right-mid': { shots: '', goals: '' }, 'right-far': { shots: '', goals: '' },
  },
  leftFoot: { shots: '', goals: '' },
  rightFoot: { shots: '', goals: '' },
};

export function BenchmarkTests({ benchmarks, onSaveBenchmark }) {
  const [mode, setMode] = useState(null); // null | 'lspt' | 'lsst'
  const [lsptForm, setLsptForm] = useState(emptyLSPT);
  const [lsstForm, setLsstForm] = useState(emptyLSST);

  // Timer state
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerElapsed, setTimerElapsed] = useState(0);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);

  useEffect(() => {
    if (timerRunning) {
      startTimeRef.current = Date.now() - timerElapsed * 1000;
      timerRef.current = setInterval(() => {
        setTimerElapsed(+((Date.now() - startTimeRef.current) / 1000).toFixed(1));
      }, 100);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [timerRunning]);

  const resetTimer = () => {
    setTimerRunning(false);
    setTimerElapsed(0);
  };

  const handleStartLSPT = () => {
    setMode('lspt');
    setLsptForm(emptyLSPT);
    resetTimer();
  };

  const handleStartLSST = () => {
    setMode('lsst');
    setLsstForm(emptyLSST);
  };

  const handleSaveLSPT = () => {
    const time = Number(lsptForm.timeSeconds) || timerElapsed;
    const attempts = Number(lsptForm.attempts) || 0;
    const completed = Number(lsptForm.completed) || 0;
    const errors = Number(lsptForm.errors) || 0;
    if (!time || !attempts) return;
    const score = computeLSPTScore(time, completed, errors);
    onSaveBenchmark({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: 'lspt',
      timeSeconds: +time.toFixed(1),
      attempts,
      completed,
      errors,
      score,
    });
    setMode(null);
    resetTimer();
  };

  const handleSaveLSST = () => {
    const zones = {};
    let totalShots = 0, totalGoals = 0;
    for (const [zone, data] of Object.entries(lsstForm.zones)) {
      const shots = Number(data.shots) || 0;
      const goals = Number(data.goals) || 0;
      if (shots > 0) {
        zones[zone] = { shots, goals };
        totalShots += shots;
        totalGoals += goals;
      }
    }
    const lf = { shots: Number(lsstForm.leftFoot.shots) || 0, goals: Number(lsstForm.leftFoot.goals) || 0 };
    const rf = { shots: Number(lsstForm.rightFoot.shots) || 0, goals: Number(lsstForm.rightFoot.goals) || 0 };
    if (!totalShots && !lf.shots && !rf.shots) return;
    const score = computeLSSTScore(zones, totalShots, totalGoals);
    onSaveBenchmark({
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      type: 'lsst',
      zones,
      leftFoot: lf.shots ? lf : undefined,
      rightFoot: rf.shots ? rf : undefined,
      totalShots: totalShots || (lf.shots + rf.shots),
      totalGoals: totalGoals || (lf.goals + rf.goals),
      score,
    });
    setMode(null);
  };

  const updateZone = (zone, field, value) => {
    setLsstForm(prev => ({
      ...prev,
      zones: { ...prev.zones, [zone]: { ...prev.zones[zone], [field]: value } },
    }));
  };

  const lsptResults = benchmarks.filter(b => b.type === 'lspt').sort((a, b) => a.date.localeCompare(b.date));
  const lsstResults = benchmarks.filter(b => b.type === 'lsst').sort((a, b) => a.date.localeCompare(b.date));
  const lastLSPT = lsptResults[lsptResults.length - 1];
  const lastLSST = lsstResults[lsstResults.length - 1];
  const bestLSPT = lsptResults.length ? Math.max(...lsptResults.map(b => b.score)) : null;
  const bestLSST = lsstResults.length ? Math.max(...lsstResults.map(b => b.score)) : null;

  const formatTimer = (s) => {
    const mins = Math.floor(s / 60);
    const secs = (s % 60).toFixed(1);
    return mins > 0 ? `${mins}:${secs.padStart(4, '0')}` : `${secs}s`;
  };

  if (mode === 'lspt') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">LSPT-Lite (Passing Benchmark)</h3>
          <Button variant="ghost" onClick={() => { setMode(null); resetTimer(); }}>Cancel</Button>
        </div>
        <Card>
          <p className="text-xs text-gray-500 mb-3">
            Set up passing targets. Complete as many accurate passes as fast as possible. Start timer, perform circuit, stop timer when done.
          </p>
          {/* Timer */}
          <div className="text-center mb-4">
            <p className="text-4xl font-bold text-accent font-mono">{formatTimer(timerElapsed)}</p>
            <div className="flex justify-center gap-2 mt-2">
              {!timerRunning ? (
                <Button onClick={() => setTimerRunning(true)}>{timerElapsed > 0 ? 'Resume' : 'Start Timer'}</Button>
              ) : (
                <Button variant="danger" onClick={() => setTimerRunning(false)}>Stop</Button>
              )}
              {timerElapsed > 0 && !timerRunning && (
                <Button variant="ghost" onClick={resetTimer}>Reset</Button>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <NumInput label="Attempts" value={lsptForm.attempts} onChange={v => setLsptForm(p => ({ ...p, attempts: v }))} />
            <NumInput label="Completed" value={lsptForm.completed} onChange={v => setLsptForm(p => ({ ...p, completed: v }))} />
            <NumInput label="Errors" value={lsptForm.errors} onChange={v => setLsptForm(p => ({ ...p, errors: v }))} />
          </div>
          {timerElapsed === 0 && (
            <div className="mt-3">
              <NumInput label="Manual Time (sec)" value={lsptForm.timeSeconds} onChange={v => setLsptForm(p => ({ ...p, timeSeconds: v }))} step="0.1" placeholder="Or use timer above" />
            </div>
          )}
          {(timerElapsed > 0 || lsptForm.timeSeconds) && lsptForm.attempts && (
            <div className="mt-3 text-center">
              <p className="text-xs text-gray-400">Preview Score</p>
              <p className="text-2xl font-bold text-accent">
                {computeLSPTScore(Number(lsptForm.timeSeconds) || timerElapsed, Number(lsptForm.completed) || 0, Number(lsptForm.errors) || 0)}
              </p>
            </div>
          )}
          <div className="mt-4">
            <Button onClick={handleSaveLSPT} disabled={!(timerElapsed > 0 || lsptForm.timeSeconds) || !lsptForm.attempts} className="w-full">
              Save Benchmark
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  if (mode === 'lsst') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">LSST-Lite (Shooting Benchmark)</h3>
          <Button variant="ghost" onClick={() => setMode(null)}>Cancel</Button>
        </div>
        <Card>
          <p className="text-xs text-gray-500 mb-3">
            Shoot from each zone. Record shots and goals per zone. Harder zones score more.
          </p>
          {/* Zone Grid */}
          <div className="space-y-2">
            <p className="text-xs font-medium text-gray-500">Shots by Zone</p>
            <div className="grid grid-cols-4 gap-1 text-center">
              <div />
              <p className="text-[10px] text-gray-400">Far</p>
              <p className="text-[10px] text-gray-400">Mid</p>
              <p className="text-[10px] text-gray-400">Near</p>
              {['left', 'right'].map(side => (
                <div key={side} className="contents">
                  <p className="text-[10px] text-gray-500 font-medium flex items-center justify-center">{side[0].toUpperCase()}</p>
                  {['far', 'mid', 'near'].map(dist => {
                    const zone = `${side}-${dist}`;
                    return (
                      <div key={zone} className="bg-gray-50 rounded p-1">
                        <input type="number" min="0" placeholder="S"
                          value={lsstForm.zones[zone].shots}
                          onChange={e => updateZone(zone, 'shots', e.target.value)}
                          className="w-full text-center text-xs border border-gray-200 rounded px-1 py-1 mb-0.5 focus:outline-none focus:ring-1 focus:ring-accent/30"
                        />
                        <input type="number" min="0" placeholder="G"
                          value={lsstForm.zones[zone].goals}
                          onChange={e => updateZone(zone, 'goals', e.target.value)}
                          className="w-full text-center text-xs border border-gray-200 rounded px-1 py-1 focus:outline-none focus:ring-1 focus:ring-accent/30"
                        />
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="text-[10px] text-gray-400 text-center">Top: shots, Bottom: goals</p>
          </div>
          {/* Foot split */}
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Left Foot</p>
              <NumInput label="Shots" value={lsstForm.leftFoot.shots} onChange={v => setLsstForm(p => ({ ...p, leftFoot: { ...p.leftFoot, shots: v } }))} />
              <NumInput label="Goals" value={lsstForm.leftFoot.goals} onChange={v => setLsstForm(p => ({ ...p, leftFoot: { ...p.leftFoot, goals: v } }))} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-medium text-gray-500">Right Foot</p>
              <NumInput label="Shots" value={lsstForm.rightFoot.shots} onChange={v => setLsstForm(p => ({ ...p, rightFoot: { ...p.rightFoot, shots: v } }))} />
              <NumInput label="Goals" value={lsstForm.rightFoot.goals} onChange={v => setLsstForm(p => ({ ...p, rightFoot: { ...p.rightFoot, goals: v } }))} />
            </div>
          </div>
          <div className="mt-4">
            <Button onClick={handleSaveLSST} className="w-full">Save Benchmark</Button>
          </div>
        </Card>
      </div>
    );
  }

  // Default: overview
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-700">Benchmark Tests</h3>
      <p className="text-xs text-gray-400">Run standardized tests periodically to track progress objectively.</p>

      {/* Quick stats */}
      {(lastLSPT || lastLSST) && (
        <div className="grid grid-cols-2 gap-3">
          {lastLSPT && <StatCard label="LSPT Score" value={lastLSPT.score} sub={bestLSPT > lastLSPT.score ? `Best: ${bestLSPT}` : 'Personal best!'} badge={{ label: getBenchmarkLevel(lastLSPT.score, LSPT_NORMS), className: LEVEL_COLORS[getBenchmarkLevel(lastLSPT.score, LSPT_NORMS)] }} />}
          {lastLSST && <StatCard label="LSST Score" value={lastLSST.score} sub={bestLSST > lastLSST.score ? `Best: ${bestLSST}` : 'Personal best!'} badge={{ label: getBenchmarkLevel(lastLSST.score, LSST_NORMS), className: LEVEL_COLORS[getBenchmarkLevel(lastLSST.score, LSST_NORMS)] }} />}
        </div>
      )}

      {/* Start buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Card onClick={handleStartLSPT} className="text-center">
          <p className="text-lg font-bold text-accent">LSPT</p>
          <p className="text-xs text-gray-400 mt-1">Passing Benchmark</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Timed passing circuit</p>
        </Card>
        <Card onClick={handleStartLSST} className="text-center">
          <p className="text-lg font-bold text-accent">LSST</p>
          <p className="text-xs text-gray-400 mt-1">Shooting Benchmark</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Zone-based accuracy</p>
        </Card>
      </div>

      {/* LSPT Trend */}
      {lsptResults.length >= 2 && (
        <Card>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">LSPT Score Trend</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={lsptResults.slice(-15).map(b => ({ date: formatDateShort(b.date), score: b.score }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: GRAY }} />
              <YAxis tick={{ fontSize: 11, fill: GRAY }} />
              <Tooltip formatter={(v) => [v, 'Score']} />
              <ReferenceLine y={LSPT_NORMS.elite} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'Elite', fontSize: 10, fill: '#22c55e' }} />
              <ReferenceLine y={LSPT_NORMS.advanced} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: 'Adv', fontSize: 10, fill: '#3b82f6' }} />
              <ReferenceLine y={LSPT_NORMS.intermediate} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Int', fontSize: 10, fill: '#f59e0b' }} />
              <Line type="monotone" dataKey="score" stroke={ACCENT} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <NormsLegend norms={LSPT_NORMS} />
        </Card>
      )}

      {/* LSST Trend */}
      {lsstResults.length >= 2 && (
        <Card>
          <h4 className="text-sm font-semibold text-gray-700 mb-3">LSST Score Trend</h4>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={lsstResults.slice(-15).map(b => ({ date: formatDateShort(b.date), score: b.score }))}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: GRAY }} />
              <YAxis tick={{ fontSize: 11, fill: GRAY }} />
              <Tooltip formatter={(v) => [v, 'Score']} />
              <ReferenceLine y={LSST_NORMS.elite} stroke="#22c55e" strokeDasharray="4 4" label={{ value: 'Elite', fontSize: 10, fill: '#22c55e' }} />
              <ReferenceLine y={LSST_NORMS.advanced} stroke="#3b82f6" strokeDasharray="4 4" label={{ value: 'Adv', fontSize: 10, fill: '#3b82f6' }} />
              <ReferenceLine y={LSST_NORMS.intermediate} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'Int', fontSize: 10, fill: '#f59e0b' }} />
              <Line type="monotone" dataKey="score" stroke="#2563EB" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
          <NormsLegend norms={LSST_NORMS} />
        </Card>
      )}

      {/* History */}
      {benchmarks.length > 0 && (
        <div>
          <h4 className="text-sm font-semibold text-gray-700 mb-2">Recent Results</h4>
          <div className="space-y-1.5">
            {[...benchmarks].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10).map(b => (
              <div key={b.id} className="bg-surface rounded-lg border border-gray-100 px-3 py-2 flex items-center justify-between text-sm">
                <div>
                  <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${b.type === 'lspt' ? 'bg-blue-50 text-blue-600' : 'bg-green-50 text-green-600'}`}>
                    {b.type.toUpperCase()}
                  </span>
                  <span className="text-xs text-gray-500 ml-2">{formatDate(b.date)}</span>
                </div>
                <div className="flex items-center gap-3">
                  {b.type === 'lspt' && (
                    <span className="text-xs text-gray-400">{b.completed}/{b.attempts} in {b.timeSeconds}s</span>
                  )}
                  {b.type === 'lsst' && (
                    <span className="text-xs text-gray-400">{b.totalGoals}/{b.totalShots}</span>
                  )}
                  <LevelBadge score={b.score} norms={b.type === 'lspt' ? LSPT_NORMS : LSST_NORMS} />
                  <span className="font-bold text-accent">{b.score}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
