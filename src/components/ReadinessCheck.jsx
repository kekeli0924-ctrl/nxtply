import { useState } from 'react';

const QUESTIONS = [
  {
    id: 'energy',
    question: "How's your energy today?",
    options: [
      { value: 'low', label: 'Low', icon: '🔋' },
      { value: 'normal', label: 'Normal', icon: '⚡' },
      { value: 'high', label: 'High', icon: '🔥' },
    ],
  },
  {
    id: 'soreness',
    question: 'Any soreness?',
    options: [
      { value: 'none', label: 'None', icon: '✅' },
      { value: 'legs', label: 'Legs', icon: '🦵' },
      { value: 'upper', label: 'Upper body', icon: '💪' },
      { value: 'full', label: 'Full body', icon: '😮‍💨' },
    ],
  },
  {
    id: 'time',
    question: 'How much time do you have?',
    options: [
      { value: 15, label: '15 min', icon: '⏱️' },
      { value: 30, label: '30 min', icon: '⏱️' },
      { value: 45, label: '45 min', icon: '⏱️' },
      { value: 60, label: '60+ min', icon: '⏱️' },
    ],
  },
];

export function ReadinessCheck({ plan, onComplete, onSkip }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});

  const current = QUESTIONS[step];

  const handleSelect = (value) => {
    const updated = { ...answers, [current.id]: value };
    setAnswers(updated);

    if (step < QUESTIONS.length - 1) {
      // Animate to next question
      setStep(step + 1);
    } else {
      // All questions answered — adapt the plan
      const adapted = adaptPlan(plan, updated);
      onComplete(adapted, updated);
    }
  };

  return (
    <div className="fixed inset-0 bg-[#0F1B2D] z-50 flex flex-col items-center justify-center text-white px-6">
      {/* Progress dots */}
      <div className="flex gap-2 mb-8">
        {QUESTIONS.map((_, i) => (
          <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i <= step ? 'bg-white' : 'bg-white/20'}`} />
        ))}
      </div>

      {/* Question */}
      <h2 className="text-2xl font-bold text-center mb-10 font-heading" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        {current.question}
      </h2>

      {/* Options */}
      <div className="w-full max-w-sm space-y-3" style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        {current.options.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleSelect(opt.value)}
            className="w-full flex items-center gap-4 bg-white/10 hover:bg-white/20 rounded-xl px-5 py-4 transition-colors text-left"
          >
            <span className="text-2xl">{opt.icon}</span>
            <span className="text-lg font-medium">{opt.label}</span>
          </button>
        ))}
      </div>

      {/* Skip */}
      <button onClick={onSkip} className="mt-8 text-white/30 text-xs">
        Skip check
      </button>
    </div>
  );
}

// --- Plan Adaptation Logic ---
function adaptPlan(plan, answers) {
  if (!plan?.timeline || plan.timeline.length === 0) return plan;

  const { energy, soreness, time } = answers;
  const adapted = { ...plan, timeline: [...plan.timeline], drills: [...(plan.drills || [])] };
  const changes = [];

  // Time constraint — trim drills to fit
  const availableMin = typeof time === 'number' ? time : 60;
  const originalDuration = plan.totalDuration || 0;

  if (availableMin < originalDuration) {
    // Keep warm-up and cool-down (10 min), fit drills in remaining time
    const drillBudget = availableMin - 10;
    let drillTime = 0;
    const keptTimeline = [];

    for (const item of adapted.timeline) {
      if (item.isWarmup || item.isCooldown) {
        keptTimeline.push(item);
        continue;
      }
      if (drillTime + item.duration <= drillBudget) {
        keptTimeline.push(item);
        drillTime += item.duration;
      }
    }

    // Recalculate start times
    let elapsed = 0;
    for (const item of keptTimeline) {
      item.startMin = elapsed;
      elapsed += item.duration;
    }

    adapted.timeline = keptTimeline;
    adapted.drills = keptTimeline.filter(t => !t.isWarmup && !t.isCooldown).map(t => t.name);
    adapted.totalDuration = elapsed;
    adapted.targetDuration = elapsed;

    if (elapsed < originalDuration) {
      changes.push(`Trimmed to fit ${availableMin} min (from ${originalDuration} min)`);
    }
  }

  // Low energy + soreness → lighter plan
  if (energy === 'low' && soreness !== 'none') {
    // Remove physical drills, keep technical
    adapted.timeline = adapted.timeline.filter(item => {
      if (item.isWarmup || item.isCooldown) return true;
      // Remove sprint/physical drills
      const physicalDrills = ['Sprint Intervals', 'Plyometric Box Jumps', 'T-Drill', 'Cone Shuttle Runs', 'Acceleration Sprints', 'Zig-Zag Agility', 'Reaction Sprints'];
      if (physicalDrills.includes(item.name)) {
        changes.push(`Removed ${item.name} (recovery mode)`);
        return false;
      }
      return true;
    });

    // Recalculate
    let elapsed = 0;
    for (const item of adapted.timeline) {
      item.startMin = elapsed;
      elapsed += item.duration;
    }
    adapted.totalDuration = elapsed;
    adapted.targetDuration = elapsed;
    adapted.drills = adapted.timeline.filter(t => !t.isWarmup && !t.isCooldown).map(t => t.name);

    if (changes.length === 0) changes.push('Adjusted for recovery');
  }
  // Low energy, no soreness → reduce reps
  else if (energy === 'low') {
    changes.push('Reduced intensity — take extra rest between sets');
  }

  // High energy, no soreness → keep as-is or extend
  if (energy === 'high' && soreness === 'none' && availableMin >= originalDuration) {
    changes.push('Full intensity — push yourself today');
  }

  // Determine intensity label
  let intensity = 'Normal';
  if (energy === 'low' || soreness === 'full') intensity = 'Light';
  if (energy === 'high' && soreness === 'none') intensity = 'Full';

  adapted._readiness = {
    energy,
    soreness,
    availableMinutes: availableMin,
    intensity,
    changes,
    originalDuration,
  };

  return adapted;
}

// --- Adapted Plan Confirmation Screen ---
export function AdaptedPlanConfirm({ plan, onStart, onChange }) {
  const readiness = plan._readiness || {};
  const hasChanges = readiness.changes?.length > 0;

  return (
    <div className="fixed inset-0 bg-[#0F1B2D] z-50 flex flex-col items-center justify-center text-white px-6">
      <h1 className="text-2xl font-bold mb-2 font-heading">Your Session</h1>

      {/* Focus + Duration + Intensity */}
      <div className="flex items-center gap-3 mt-4 mb-6">
        <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-white/40">Duration</p>
          <p className="text-lg font-bold">{plan.totalDuration} min</p>
        </div>
        <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-white/40">Intensity</p>
          <p className={`text-lg font-bold ${
            readiness.intensity === 'Light' ? 'text-green-400' :
            readiness.intensity === 'Full' ? 'text-red-400' : 'text-white'
          }`}>{readiness.intensity || 'Normal'}</p>
        </div>
        <div className="bg-white/10 rounded-lg px-3 py-2 text-center">
          <p className="text-xs text-white/40">Drills</p>
          <p className="text-lg font-bold">{plan.timeline?.filter(t => !t.isWarmup && !t.isCooldown).length || 0}</p>
        </div>
      </div>

      {/* Changes */}
      {hasChanges && (
        <div className="w-full max-w-sm mb-6 space-y-1">
          {readiness.changes.map((change, i) => (
            <div key={i} className="flex items-center gap-2 bg-white/5 rounded-lg px-3 py-2">
              <span className="text-amber-400 text-xs">↻</span>
              <span className="text-xs text-white/60">{change}</span>
            </div>
          ))}
        </div>
      )}

      {/* Drill list */}
      <div className="w-full max-w-sm mb-6 space-y-1">
        {plan.timeline?.filter(t => !t.isWarmup && !t.isCooldown).map((drill, i) => (
          <div key={i} className="flex items-center justify-between bg-white/5 rounded-lg px-3 py-2">
            <span className="text-sm text-white/80">{drill.name}</span>
            <span className="text-xs text-white/40">{drill.duration} min</span>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="w-full max-w-sm space-y-2">
        <button onClick={onStart} className="w-full py-3 bg-white text-[#0F1B2D] rounded-xl font-semibold text-sm">
          Let's Go
        </button>
        <button onClick={onChange} className="w-full py-2 text-white/30 text-xs">
          Change something
        </button>
      </div>
    </div>
  );
}
