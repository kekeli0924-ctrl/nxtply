import { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

const POSITIONS = ['General', 'Winger', 'Striker', 'CAM', 'CDM', 'CB', 'GK'];
const AGE_GROUPS = ['U12', 'U14', 'U16', 'U18', 'U21', 'Senior'];
const SKILL_LEVELS = ['Recreational', 'Academy', 'Semi-Pro', 'Professional'];
const EQUIPMENT_OPTIONS = ['Ball only', 'Wall / rebounder', 'Cones / markers', 'Goal / net', 'Agility ladder', 'Resistance bands'];

function ProgressDots({ current, total }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`w-2 h-2 rounded-full transition-colors ${
            i <= current ? 'bg-accent' : 'bg-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

function TagButton({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        selected
          ? 'bg-accent text-white'
          : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
      }`}
    >
      {children}
    </button>
  );
}

export function OnboardingFlow({ settings, onComplete }) {
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    role: 'player',
    playerName: settings.playerName || '',
    position: 'General',
    ageGroup: '',
    skillLevel: '',
    weeklyGoal: 3,
    equipment: ['ball'],
  });

  const update = (field, value) => setData(prev => ({ ...prev, [field]: value }));

  const isCoach = data.role === 'coach';

  const canAdvance = () => {
    if (step === 0) return true; // role selection always valid
    if (step === 1) return true; // name is optional
    if (!isCoach && step === 2) return data.ageGroup && data.skillLevel;
    return true;
  };

  const handleFinish = () => {
    onComplete({
      role: data.role,
      playerName: data.playerName,
      ageGroup: isCoach ? '' : data.ageGroup,
      skillLevel: isCoach ? '' : data.skillLevel,
      weeklyGoal: isCoach ? 3 : data.weeklyGoal,
      equipment: isCoach ? ['ball'] : data.equipment,
      onboardingComplete: 1,
    });
  };

  const steps = [
    // Step 0: Role Selection
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight font-heading italic">stay composed</h2>
        </div>

        <div className="space-y-3">
          {[
            { role: 'player', icon: '', title: "I'm a Player", desc: 'Track my training, log sessions, improve my game' },
            { role: 'coach', icon: '', title: "I'm a Coach", desc: 'Manage players, assign plans, track progress' },
          ].map(opt => (
            <button
              key={opt.role}
              type="button"
              onClick={() => update('role', opt.role)}
              className={`w-full text-center rounded-xl border-2 p-4 transition-all ${
                data.role === opt.role
                  ? 'border-accent bg-accent/5 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <p className="text-sm font-semibold text-gray-900">{opt.title}</p>
              <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
            </button>
          ))}
        </div>
      </div>
    ),

    // Step 1: Welcome + Name + Position
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">⚽</div>
          <h2 className="text-2xl font-semibold text-gray-900 tracking-tight font-heading">Welcome to Composed</h2>
          <p className="text-sm text-gray-500 mt-2">Your personal soccer development tracker. Let's set up your profile.</p>
        </div>

        <Card>
          <label className="block text-xs font-medium text-gray-500 mb-1">What's your name?</label>
          <input
            type="text"
            value={data.playerName}
            onChange={e => update('playerName', e.target.value)}
            placeholder={isCoach ? 'Name (optional)' : 'Player name (optional)'}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 mb-4"
          />

          {!isCoach && (
            <>
              <label className="block text-xs font-medium text-gray-500 mb-2">Your position</label>
              <div className="flex flex-wrap gap-2">
                {POSITIONS.map(pos => (
                  <TagButton key={pos} selected={data.position === pos} onClick={() => update('position', pos)}>
                    {pos}
                  </TagButton>
                ))}
              </div>
            </>
          )}
        </Card>
      </div>
    ),

    // Step 2: Age Group + Skill Level
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-gray-900">Your Profile</h2>
          <p className="text-sm text-gray-500 mt-1">This helps us compare your stats to players like you.</p>
        </div>

        <Card className="mb-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">Age Group</label>
          <div className="flex flex-wrap gap-2">
            {AGE_GROUPS.map(age => (
              <TagButton key={age} selected={data.ageGroup === age} onClick={() => update('ageGroup', age)}>
                {age}
              </TagButton>
            ))}
          </div>
        </Card>

        <Card>
          <label className="block text-xs font-medium text-gray-500 mb-2">Skill Level</label>
          <div className="flex flex-wrap gap-2">
            {SKILL_LEVELS.map(level => (
              <TagButton key={level} selected={data.skillLevel === level} onClick={() => update('skillLevel', level)}>
                {level}
              </TagButton>
            ))}
          </div>
        </Card>
      </div>
    ),

    // Step 3: Weekly Goal
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-gray-900">Weekly Goal</h2>
          <p className="text-sm text-gray-500 mt-1">How many sessions do you want to train per week?</p>
        </div>

        <Card>
          <div className="text-center mb-4">
            <span className="text-5xl font-bold text-accent">{data.weeklyGoal}</span>
            <p className="text-xs text-gray-400 mt-1">sessions per week</p>
          </div>

          <input
            type="range"
            min={1}
            max={7}
            value={data.weeklyGoal}
            onChange={e => update('weeklyGoal', Number(e.target.value))}
            className="w-full accent-accent"
          />

          <div className="flex justify-between text-[10px] text-gray-400 mt-1">
            <span>1</span>
            <span>7</span>
          </div>

          <p className="text-xs text-gray-500 text-center mt-4">
            {data.weeklyGoal <= 2 && 'A solid starting point. Consistency is what matters most.'}
            {data.weeklyGoal >= 3 && data.weeklyGoal <= 4 && 'Great target for steady improvement.'}
            {data.weeklyGoal >= 5 && data.weeklyGoal <= 6 && 'Ambitious — make sure to include recovery days.'}
            {data.weeklyGoal === 7 && 'Elite commitment. Make sure to include recovery days.'}
          </p>
        </Card>

        <Card className="mt-4">
          <label className="block text-xs font-medium text-gray-500 mb-2">What equipment do you have?</label>
          <div className="flex flex-wrap gap-2">
            {EQUIPMENT_OPTIONS.map(item => {
              const key = item.toLowerCase().split(' ')[0];
              const isSelected = data.equipment.includes(key);
              return (
                <TagButton
                  key={item}
                  selected={isSelected}
                  onClick={() => {
                    setData(prev => ({
                      ...prev,
                      equipment: isSelected
                        ? prev.equipment.filter(e => e !== key)
                        : [...prev.equipment, key],
                    }));
                  }}
                >
                  {item}
                </TagButton>
              );
            })}
          </div>
        </Card>
      </div>
    ),

    // Recording Tips (player only — skipped for coach via activeSteps)
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <div className="text-3xl mb-3">📹</div>
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight font-heading">Get the Best Results</h2>
          <p className="text-sm text-gray-500 mt-1">Tips for recording training videos that AI can analyze accurately.</p>
        </div>

        <div className="space-y-3">
          {[
            { icon: '📐', title: 'Stable Camera', desc: 'Use a tripod or lean your phone against something steady. No handheld.' },
            { icon: '🌅', title: 'Good Lighting', desc: 'Film in landscape mode. Natural daylight works best — avoid shadows on the ball.' },
            { icon: '⏱️', title: 'Keep It Short', desc: 'Videos under 5 minutes analyze fastest. Break longer sessions into clips.' },
            { icon: '🎯', title: 'Full View', desc: 'Make sure the goal/wall AND your full body are visible in frame.' },
          ].map(tip => (
            <Card key={tip.title}>
              <div className="flex items-start gap-3">
                <span className="text-xl shrink-0">{tip.icon}</span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{tip.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{tip.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    ),

    // Feature Overview + CTA
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <h2 className="text-xl font-semibold text-gray-900 tracking-tight font-heading">You're All Set!</h2>
          <p className="text-sm text-gray-500 mt-1">
            {isCoach ? "Here's how Composed helps you manage players." : "Here's how Composed helps you develop."}
          </p>
        </div>

        <div className="space-y-3">
          {(isCoach ? [
            { num: 1, title: 'Build Your Roster', desc: 'Generate invite codes and link up with your players.' },
            { num: 2, title: 'Assign Plans', desc: 'Create training plans on specific dates for each player.' },
            { num: 3, title: 'Track Progress', desc: 'View stats, compliance, and development across your squad.' },
          ] : [
            { num: 1, title: 'Log', desc: 'Track every session — shooting, passing, fitness, and more. Or upload a video for AI analysis.' },
            { num: 2, title: 'Track', desc: 'See trends, streaks, personal records, and peer comparisons.' },
            { num: 3, title: 'Improve', desc: 'Get AI insights, gap analysis, and personalized session recommendations.' },
          ]).map(item => (
            <Card key={item.num}>
              <div className="flex items-start gap-3">
                <span className="w-7 h-7 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold shrink-0">
                  {item.num}
                </span>
                <div>
                  <p className="text-sm font-semibold text-gray-900">{item.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        <div className="mt-6">
          <Button onClick={handleFinish} className="w-full py-3 text-base">
            {isCoach ? 'Get Started' : 'Start Training'}
          </Button>
        </div>
      </div>
    ),
  ];

  // Coach skips player-specific steps (age group, weekly goal)
  const activeSteps = isCoach
    ? [steps[0], steps[1], steps[steps.length - 1]]  // role, name, finish
    : steps;
  const TOTAL_STEPS = activeSteps.length;

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <ProgressDots current={step} total={TOTAL_STEPS} />

      {activeSteps[step]()}

      {step < TOTAL_STEPS - 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          {step > 0 && (
            <Button variant="secondary" onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          )}
          <Button
            onClick={() => setStep(s => s + 1)}
            disabled={!canAdvance()}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
