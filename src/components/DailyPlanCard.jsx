import { useMemo } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { generateDailyPlan } from '../utils/dailyPlan';

export function DailyPlanCard({ sessions, idpGoals, onStartPlan, onStartManual, assignedPlans = [], activeProgram }) {
  const today = new Date().toISOString().split('T')[0];

  // If player has an active program, show the program session
  const programSession = useMemo(() => {
    if (!activeProgram?.currentSession) return null;
    const s = activeProgram.currentSession;
    const drills = JSON.parse(s.drills || '[]').map(d => typeof d === 'string' ? d : d.name);
    return { ...s, drills, parsedDrills: JSON.parse(s.drills || '[]') };
  }, [activeProgram]);

  // If coach assigned drills for today, use those instead of the auto-generated plan
  const coachPlanToday = useMemo(() => {
    const assigned = assignedPlans.find(p => p.date === today);
    if (!assigned || !assigned.drills?.length) return null;
    return assigned;
  }, [assignedPlans, today]);

  const plan = useMemo(() => {
    // Priority: coach plan > active program > auto-generated
    if (programSession && !coachPlanToday) {
      const DRILL_DETAILS = {
        'Wall Passes (1-touch)': { reps: '3 sets x 20 passes', duration: 5, instruction: 'Alternate feet each set.' },
        'Finishing Drill': { reps: '20 shots total', duration: 8, instruction: '10 right foot, 10 left foot.' },
        'Dribbling Circuit': { reps: '5 runs through', duration: 6, instruction: 'Inside-outside, drag backs, step-overs.' },
        'Sprint Intervals': { reps: '8 x 30m sprints', duration: 8, instruction: '30 sec rest between.' },
      };

      const timeline = [{ name: 'Warm-up', reps: '5 min', duration: 5, instruction: 'Light jog, dynamic stretches.', startMin: 0, isWarmup: true }];
      let elapsed = 5;
      for (const d of programSession.parsedDrills || []) {
        const name = typeof d === 'string' ? d : d.name;
        const detail = DRILL_DETAILS[name] || { reps: d.reps || '10 min', duration: d.duration || 10, instruction: 'Focus on quality.' };
        timeline.push({ name, reps: d.reps || detail.reps, duration: d.duration || detail.duration, instruction: detail.instruction, startMin: elapsed });
        elapsed += d.duration || detail.duration;
      }
      timeline.push({ name: 'Cool-down', reps: '5 min', duration: 5, instruction: 'Static stretches.', startMin: elapsed, isCooldown: true });
      elapsed += 5;

      return {
        type: 'program',
        focus: `${activeProgram.program.name} — Week ${activeProgram.currentWeek}`,
        drills: programSession.drills,
        timeline,
        totalDuration: elapsed,
        targetDuration: elapsed,
        motivation: programSession.coaching_notes || programSession.coachingNotes || 'Follow the program. Trust the process.',
        xpReward: 50,
        programTitle: programSession.title,
        programWeek: activeProgram.currentWeek,
        programDay: activeProgram.currentDay,
        programTotal: activeProgram.program.sessionCount,
        programCompleted: activeProgram.completedSessions?.length || 0,
      };
    }

    if (coachPlanToday) {
      // Build a plan from coach's assignment
      const DRILL_DETAILS = {
        'Wall Passes (1-touch)': { reps: '3 sets x 20 passes', duration: 5, instruction: 'Alternate feet each set. Stay on your toes.' },
        'Wall Passes (2-touch)': { reps: '3 sets x 15 passes', duration: 5, instruction: 'First touch to control, second to pass.' },
        'Finishing Drill': { reps: '20 shots total', duration: 8, instruction: '10 right foot, 10 left foot. Aim corners.' },
        'Shooting (Inside Box)': { reps: '15 shots', duration: 7, instruction: '5 right, 5 left, 5 from angles. Quick release.' },
        'Shooting (Outside Box)': { reps: '10 shots', duration: 6, instruction: 'Focus on power and placement.' },
        'Long Passing': { reps: '20 passes', duration: 7, instruction: 'Hit targets at 30+ yards. Lock ankle, follow through.' },
        'Short Passing Combos': { reps: '3 sets x 2 min', duration: 6, instruction: 'Quick 1-2 touch passing.' },
        'Crossing & Finishing': { reps: '10 crosses + finish', duration: 8, instruction: 'Alternate sides.' },
        'Free Kicks': { reps: '15 kicks', duration: 8, instruction: '5 near post, 5 far post, 5 over wall.' },
        'Rondo': { reps: '3 rounds x 3 min', duration: 10, instruction: 'Keep possession. 2-touch max.' },
        'Dribbling Circuit': { reps: '5 runs through', duration: 6, instruction: 'Cones: inside-outside, drag backs, step-overs.' },
        'Sprint Intervals': { reps: '8 x 30m sprints', duration: 8, instruction: '30 sec rest between. Max effort.' },
      };

      const timeline = [];
      let elapsed = 0;
      timeline.push({ name: 'Warm-up', reps: '5 min', duration: 5, instruction: 'Light jog, dynamic stretches, ball rolls.', startMin: 0, isWarmup: true });
      elapsed = 5;

      for (const drill of coachPlanToday.drills) {
        const detail = DRILL_DETAILS[drill] || { reps: '10 min', duration: 10, instruction: 'Focus on quality.' };
        timeline.push({ name: drill, reps: detail.reps, duration: detail.duration, instruction: detail.instruction, startMin: elapsed });
        elapsed += detail.duration;
      }

      timeline.push({ name: 'Cool-down', reps: '5 min', duration: 5, instruction: 'Static stretches. Hold each 20-30 seconds.', startMin: elapsed, isCooldown: true });
      elapsed += 5;

      return {
        type: 'coach',
        focus: 'Coach\'s Plan',
        drills: coachPlanToday.drills,
        timeline,
        totalDuration: elapsed,
        targetDuration: coachPlanToday.targetDuration || elapsed,
        motivation: coachPlanToday.notes || 'Your coach prepared this session for you. Let\'s go!',
        xpReward: 50,
      };
    }
    return generateDailyPlan(sessions, idpGoals);
  }, [coachPlanToday, sessions, idpGoals]);

  if (!plan) return null;

  // Already trained today
  if (plan.type === 'completed') {
    return (
      <Card>
        <div className="text-center py-4">
          <div className="text-3xl mb-2">✅</div>
          <p className="text-sm font-semibold text-gray-900">Session Complete</p>
          <p className="text-xs text-gray-400 mt-1">{plan.motivation}</p>
        </div>
      </Card>
    );
  }

  const urgencyColors = {
    high: 'bg-red-50 text-red-600',
    medium: 'bg-amber-50 text-amber-600',
    low: 'bg-blue-50 text-blue-600',
  };

  return (
    <Card>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Today's Training</p>
            <p className="text-sm font-bold text-gray-900 mt-0.5">{plan.focus}</p>
          </div>
          <div className="flex items-center gap-2">
            {plan.type === 'program' && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-purple-50 text-purple-600">
                {plan.programCompleted + 1}/{plan.programTotal}
              </span>
            )}
            {plan.type === 'coach' && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                From Coach
              </span>
            )}
            {plan.gapUrgency && (
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${urgencyColors[plan.gapUrgency] || urgencyColors.low}`}>
                {plan.gapUrgency} priority
              </span>
            )}
            {plan.type === 'recovery' && (
              <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-600">recovery</span>
            )}
          </div>
        </div>

        {/* Total duration + XP */}
        <div className="flex items-center gap-4 text-xs text-gray-400">
          <span className="font-medium text-gray-600">⏱ {plan.totalDuration} min total</span>
          {plan.xpReward > 0 && <span>✨ +{plan.xpReward} XP</span>}
        </div>

        {/* Timeline */}
        {plan.timeline && plan.timeline.length > 0 && (
          <div className="space-y-0">
            {plan.timeline.map((item, i) => (
              <div key={i} className={`flex gap-3 py-2 ${i > 0 ? 'border-t border-gray-50' : ''}`}>
                {/* Time marker */}
                <div className="w-10 shrink-0 text-right">
                  <span className="text-[10px] font-mono text-gray-300">{item.startMin}:00</span>
                </div>

                {/* Timeline dot + line */}
                <div className="flex flex-col items-center shrink-0">
                  <div className={`w-2 h-2 rounded-full mt-1 ${
                    item.isWarmup ? 'bg-amber-300' :
                    item.isCooldown ? 'bg-blue-300' :
                    'bg-accent'
                  }`} />
                  {i < plan.timeline.length - 1 && <div className="w-px flex-1 bg-gray-100 mt-1" />}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 pb-1">
                  <div className="flex items-center justify-between">
                    <p className={`text-xs font-semibold ${
                      item.isWarmup || item.isCooldown ? 'text-gray-400' : 'text-gray-800'
                    }`}>
                      {item.name}
                    </p>
                    <span className="text-[10px] text-gray-300 shrink-0">{item.duration} min</span>
                  </div>
                  <p className="text-[11px] font-medium text-accent mt-0.5">{item.reps}</p>
                  <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">{item.instruction}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Motivation */}
        <p className="text-xs text-gray-500 italic leading-relaxed">{plan.motivation}</p>

        {/* CTA */}
        <Button
          onClick={() => onStartPlan && onStartPlan(plan)}
          className="w-full py-2.5 text-sm"
        >
          Start Guided Session
        </Button>
        <button
          onClick={() => onStartManual && onStartManual(plan)}
          className="w-full text-center text-[10px] text-gray-400 hover:text-accent mt-1"
        >
          Log manually instead
        </button>
      </div>
    </Card>
  );
}
