import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/Button';
import { SHOOTING_DRILLS, PASSING_DRILLS, FITNESS_DRILLS } from '../utils/stats';

// --- Audio Engine (Web Audio API, no files) ---
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playTone(freq, duration, count = 1, gap = 150) {
  try {
    const ctx = getAudioCtx();
    for (let i = 0; i < count; i++) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      gain.gain.value = 0.3;
      const start = ctx.currentTime + (i * (duration + gap)) / 1000;
      osc.start(start);
      osc.stop(start + duration / 1000);
    }
  } catch { /* audio not available */ }
}

const sounds = {
  drillStart: () => playTone(880, 100, 2, 120),     // Two short ascending beeps
  tenSeconds: () => playTone(660, 80, 3, 100),       // Three quick beeps
  drillEnd: () => playTone(440, 400, 1),             // One long tone
  sessionComplete: () => {                            // Ascending three-tone chime
    try {
      const ctx = getAudioCtx();
      [523, 659, 784].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        gain.gain.value = 0.3;
        osc.start(ctx.currentTime + i * 0.25);
        osc.stop(ctx.currentTime + i * 0.25 + 0.3);
      });
    } catch { /* ignore */ }
  },
};

// --- Drill Category Helper ---
function getDrillCategory(name) {
  if (SHOOTING_DRILLS.includes(name)) return 'shooting';
  if (PASSING_DRILLS.includes(name)) return 'passing';
  if (FITNESS_DRILLS.includes(name)) return 'physical';
  return 'technical';
}

function getRestDuration(drillName, isWarmup) {
  if (isWarmup) return 15;
  const cat = getDrillCategory(drillName);
  if (cat === 'physical') return 60;
  return 30;
}

// --- Format Helpers ---
function formatTime(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatElapsed(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// --- Main Component ---
export function LiveSessionMode({ plan, onComplete, onExit }) {
  const timeline = plan?.timeline || [];
  const totalDrills = timeline.filter(t => !t.isWarmup && !t.isCooldown).length;

  // Build the full sequence: drill → rest → drill → rest → ...
  const sequence = useRef([]);
  if (sequence.current.length === 0 && timeline.length > 0) {
    const seq = [];
    timeline.forEach((item, i) => {
      seq.push({ type: 'drill', ...item, index: i });
      // Add rest between drills (not after cool-down, not after last item)
      if (i < timeline.length - 1 && !item.isCooldown) {
        const restSec = getRestDuration(item.name, item.isWarmup);
        seq.push({
          type: 'rest',
          duration: restSec / 60,
          durationSeconds: restSec,
          nextDrill: timeline[i + 1],
        });
      }
    });
    sequence.current = seq;
  }

  const [currentIndex, setCurrentIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(0);
  const [paused, setPaused] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [showStatEntry, setShowStatEntry] = useState(null); // { drillName, type: 'shooting'|'passing', reps }
  const [sessionStats, setSessionStats] = useState({}); // { [drillName]: { goals, shots } or { completed, attempts } }
  const [finished, setFinished] = useState(false);
  const playedTenSecRef = useRef(false);
  const playedStartRef = useRef(false);

  const current = sequence.current[currentIndex];

  // Initialize timer for current segment
  useEffect(() => {
    if (!current) return;
    if (current.type === 'rest') {
      setSecondsLeft(current.durationSeconds);
    } else {
      setSecondsLeft(current.duration * 60);
    }
    playedTenSecRef.current = false;
    playedStartRef.current = false;
  }, [currentIndex]);

  // Play drill start sound
  useEffect(() => {
    if (current?.type === 'drill' && !playedStartRef.current && soundOn) {
      sounds.drillStart();
      playedStartRef.current = true;
    }
  }, [currentIndex, soundOn]);

  // Countdown timer
  useEffect(() => {
    if (paused || finished || showStatEntry) return;
    if (secondsLeft <= 0) return;

    const interval = setInterval(() => {
      setSecondsLeft(prev => {
        const next = prev - 1;
        // 10-second warning
        if (next === 10 && !playedTenSecRef.current && soundOn) {
          sounds.tenSeconds();
          playedTenSecRef.current = true;
        }
        // Timer done
        if (next <= 0) {
          clearInterval(interval);
          handleSegmentEnd();
          return 0;
        }
        return next;
      });
      setTotalElapsed(prev => prev + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [paused, finished, secondsLeft, showStatEntry, soundOn]);

  const handleSegmentEnd = useCallback(() => {
    if (soundOn) sounds.drillEnd();

    const cur = sequence.current[currentIndex];

    // After a shooting/passing drill, show quick stat entry
    if (cur?.type === 'drill' && !cur.isWarmup && !cur.isCooldown) {
      const cat = getDrillCategory(cur.name);
      if (cat === 'shooting') {
        setShowStatEntry({ drillName: cur.name, type: 'shooting', reps: cur.reps });
        return;
      }
      if (cat === 'passing') {
        setShowStatEntry({ drillName: cur.name, type: 'passing', reps: cur.reps });
        return;
      }
    }

    advanceToNext();
  }, [currentIndex, soundOn]);

  const advanceToNext = useCallback(() => {
    setShowStatEntry(null);
    const nextIdx = currentIndex + 1;
    if (nextIdx >= sequence.current.length) {
      // Session complete
      setFinished(true);
      if (soundOn) sounds.sessionComplete();
    } else {
      setCurrentIndex(nextIdx);
    }
  }, [currentIndex, soundOn]);

  const handleStatSubmit = (data) => {
    if (showStatEntry) {
      setSessionStats(prev => ({ ...prev, [showStatEntry.drillName]: data }));
    }
    advanceToNext();
  };

  const handleSkip = () => {
    setShowStatEntry(null);
    advanceToNext();
  };

  const handleEndEarly = () => {
    setFinished(true);
  };

  const handleLogResults = () => {
    // Build pre-fill data from session stats
    const shootingStats = Object.entries(sessionStats).filter(([name]) => getDrillCategory(name) === 'shooting');
    const passingStats = Object.entries(sessionStats).filter(([name]) => getDrillCategory(name) === 'passing');

    let totalShots = 0, totalGoals = 0, totalAttempts = 0, totalCompleted = 0;
    shootingStats.forEach(([, s]) => { totalShots += (s.shots || 0); totalGoals += (s.goals || 0); });
    passingStats.forEach(([, s]) => { totalAttempts += (s.attempts || 0); totalCompleted += (s.completed || 0); });

    const prefillData = {
      drills: plan.drills || [],
      targetDuration: Math.round(totalElapsed / 60),
      focus: plan.focus || '',
      shooting: totalShots > 0 ? { shotsTaken: totalShots, goals: totalGoals } : null,
      passing: totalAttempts > 0 ? { attempts: totalAttempts, completed: totalCompleted } : null,
    };

    onComplete?.(prefillData);
  };

  // --- RENDER ---

  // Session Complete screen
  if (finished) {
    const drillsDone = sequence.current.filter(s => s.type === 'drill' && sequence.current.indexOf(s) < currentIndex + 1).length;
    return (
      <div className="fixed inset-0 bg-[#0F1B2D] z-50 flex flex-col items-center justify-center text-white px-6">
        <div className="text-5xl mb-4">✅</div>
        <h1 className="text-3xl font-bold mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>Session Complete</h1>
        <p className="text-lg text-white/60 mb-8">{formatElapsed(totalElapsed)} total</p>

        <div className="grid grid-cols-2 gap-4 w-full max-w-xs mb-8">
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{drillsDone}</p>
            <p className="text-xs text-white/50">Drills</p>
          </div>
          <div className="bg-white/10 rounded-xl p-4 text-center">
            <p className="text-2xl font-bold">{Math.round(totalElapsed / 60)}</p>
            <p className="text-xs text-white/50">Minutes</p>
          </div>
        </div>

        {Object.keys(sessionStats).length > 0 && (
          <div className="w-full max-w-xs mb-8 space-y-2">
            {Object.entries(sessionStats).map(([name, stats]) => (
              <div key={name} className="bg-white/10 rounded-lg px-3 py-2 flex justify-between text-sm">
                <span className="text-white/70">{name}</span>
                <span className="font-semibold">
                  {stats.goals != null ? `${stats.goals}/${stats.shots}` : `${stats.completed}/${stats.attempts}`}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="w-full max-w-xs space-y-3">
          <button onClick={handleLogResults} className="w-full py-3 bg-white text-[#0F1B2D] rounded-xl font-semibold text-sm">
            Log Results
          </button>
          <button onClick={onExit} className="w-full py-2 text-white/40 text-xs">
            Skip Logging
          </button>
        </div>
      </div>
    );
  }

  // Quick Stat Entry overlay
  if (showStatEntry) {
    return (
      <StatEntryOverlay
        drillName={showStatEntry.drillName}
        type={showStatEntry.type}
        reps={showStatEntry.reps}
        onSubmit={handleStatSubmit}
        onSkip={() => advanceToNext()}
      />
    );
  }

  if (!current) return null;

  // Rest period screen
  if (current.type === 'rest') {
    return (
      <div className="fixed inset-0 bg-[#0F1B2D] z-50 flex flex-col items-center justify-center text-white px-6">
        <p className="text-sm text-white/40 uppercase tracking-widest mb-2">Rest</p>
        <p className="text-6xl font-bold mb-4 font-mono">{formatTime(secondsLeft)}</p>
        <p className="text-white/50 text-sm mb-2">
          {current.durationSeconds >= 60 ? 'Catch your breath.' : 'Shake out your legs.'}
        </p>
        <div className="mt-8 bg-white/10 rounded-xl px-5 py-3 text-center">
          <p className="text-xs text-white/40 uppercase">Next up</p>
          <p className="text-lg font-semibold mt-1">{current.nextDrill?.name}</p>
          <p className="text-xs text-white/50 mt-1">{current.nextDrill?.reps}</p>
        </div>
        <button onClick={handleSkip} className="mt-6 text-white/30 text-xs">Skip rest</button>
      </div>
    );
  }

  // Active drill screen
  const drillNumber = timeline.slice(0, current.index + 1).filter(t => !t.isWarmup && !t.isCooldown).length;
  const phaseLabel = current.isWarmup ? 'Warm-Up' : current.isCooldown ? 'Cool-Down' : `Drill ${drillNumber} of ${totalDrills}`;
  const progress = secondsLeft / (current.duration * 60);
  const circumference = 2 * Math.PI * 90;

  return (
    <div className="fixed inset-0 bg-[#0F1B2D] z-50 flex flex-col text-white">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/20">
        <div className="flex items-center gap-2">
          <span className="text-xs text-white/40 font-mono">{formatElapsed(totalElapsed)}</span>
        </div>
        <p className="text-xs text-white/60 uppercase tracking-wider">{phaseLabel}</p>
        <button
          onClick={() => setSoundOn(!soundOn)}
          className="text-xs text-white/40"
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>

      {/* Center content */}
      <div className="flex-1 flex flex-col items-center justify-center px-8">
        {/* Circular timer */}
        <div className="relative w-52 h-52 mb-6">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 200 200">
            <circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="6" />
            <circle
              cx="100" cy="100" r="90" fill="none"
              stroke={current.isWarmup ? '#FACC15' : current.isCooldown ? '#60A5FA' : '#FFFFFF'}
              strokeWidth="6"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - progress)}
              strokeLinecap="round"
              className="transition-all duration-1000 ease-linear"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold font-mono">{formatTime(secondsLeft)}</span>
            <span className="text-xs text-white/40 mt-1">{current.reps}</span>
          </div>
        </div>

        {/* Drill name */}
        <h1 className="text-2xl font-bold text-center mb-2" style={{ fontFamily: "'Playfair Display', serif" }}>
          {current.name}
        </h1>

        {/* Coaching point */}
        <p className="text-sm text-white/60 text-center max-w-sm leading-relaxed">
          {current.instruction}
        </p>
      </div>

      {/* Bottom controls */}
      <div className="flex items-center justify-between px-6 py-4 bg-black/20">
        <button onClick={handleEndEarly} className="text-xs text-white/30">
          End Early
        </button>
        <button
          onClick={() => setPaused(!paused)}
          className="w-14 h-14 rounded-full bg-white/10 flex items-center justify-center"
        >
          <span className="text-xl">{paused ? '▶' : '⏸'}</span>
        </button>
        <button onClick={handleSkip} className="text-xs text-white/30">
          Skip
        </button>
      </div>
    </div>
  );
}

// --- Quick Stat Entry Overlay ---
function StatEntryOverlay({ drillName, type, reps, onSubmit, onSkip }) {
  const [value1, setValue1] = useState('');
  const [value2, setValue2] = useState('');
  const [countdown, setCountdown] = useState(15);

  // Auto-dismiss after 15 seconds
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) { clearInterval(timer); onSkip(); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onSkip]);

  const handleSubmit = () => {
    if (type === 'shooting') {
      onSubmit({ goals: Number(value1) || 0, shots: Number(value2) || 0 });
    } else {
      onSubmit({ completed: Number(value1) || 0, attempts: Number(value2) || 0 });
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0F1B2D] z-50 flex flex-col items-center justify-center text-white px-6">
      <p className="text-xs text-white/40 mb-1">Quick Log — {countdown}s</p>
      <h2 className="text-lg font-bold mb-1" style={{ fontFamily: "'Playfair Display', serif" }}>{drillName}</h2>
      <p className="text-xs text-white/50 mb-6">{reps}</p>

      <div className="w-full max-w-xs space-y-4">
        <div>
          <label className="text-xs text-white/50 block mb-1">
            {type === 'shooting' ? 'Goals scored' : 'Passes completed'}
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={value1}
            onChange={e => setValue1(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-2xl text-center font-bold text-white focus:outline-none focus:border-white/40"
            autoFocus
          />
        </div>
        <div>
          <label className="text-xs text-white/50 block mb-1">
            {type === 'shooting' ? 'Total shots' : 'Total attempts'}
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={value2}
            onChange={e => setValue2(e.target.value)}
            className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-2xl text-center font-bold text-white focus:outline-none focus:border-white/40"
          />
        </div>
      </div>

      <div className="w-full max-w-xs mt-6 space-y-2">
        <button onClick={handleSubmit} className="w-full py-3 bg-white text-[#0F1B2D] rounded-xl font-semibold text-sm">
          Save & Continue
        </button>
        <button onClick={onSkip} className="w-full py-2 text-white/30 text-xs">
          Skip
        </button>
      </div>
    </div>
  );
}
