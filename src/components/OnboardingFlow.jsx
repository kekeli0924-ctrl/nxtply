import { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

const POSITIONS = ['General', 'Winger', 'Striker', 'CAM', 'CDM', 'CB', 'GK'];
const AGE_GROUPS = ['U12', 'U14', 'U16', 'U18', 'U21', 'Senior'];
const SKILL_LEVELS = ['Recreational', 'Academy', 'Semi-Pro', 'Professional'];

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
    playerName: settings.playerName || '',
    position: 'General',
    ageGroup: '',
    skillLevel: '',
    weeklyGoal: 3,
  });

  const update = (field, value) => setData(prev => ({ ...prev, [field]: value }));

  const canAdvance = () => {
    if (step === 0) return true; // name is optional
    if (step === 1) return data.ageGroup && data.skillLevel;
    return true;
  };

  const handleFinish = () => {
    onComplete({
      playerName: data.playerName,
      ageGroup: data.ageGroup,
      skillLevel: data.skillLevel,
      weeklyGoal: data.weeklyGoal,
      onboardingComplete: 1,
    });
  };

  const steps = [
    // Step 1: Welcome + Name + Position
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">⚽</div>
          <h2 className="text-xl font-bold text-gray-900">Welcome to NXTPLY</h2>
          <p className="text-sm text-gray-500 mt-2">Your personal soccer development tracker. Let's set up your profile.</p>
        </div>

        <Card>
          <label className="block text-xs font-medium text-gray-500 mb-1">What's your name?</label>
          <input
            type="text"
            value={data.playerName}
            onChange={e => update('playerName', e.target.value)}
            placeholder="Player name (optional)"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30 mb-4"
          />

          <label className="block text-xs font-medium text-gray-500 mb-2">Your position</label>
          <div className="flex flex-wrap gap-2">
            {POSITIONS.map(pos => (
              <TagButton key={pos} selected={data.position === pos} onClick={() => update('position', pos)}>
                {pos}
              </TagButton>
            ))}
          </div>
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
            {data.weeklyGoal === 7 && 'Elite commitment. Watch your body check metrics to avoid burnout.'}
          </p>
        </Card>
      </div>
    ),

    // Step 4: Feature Overview + CTA
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <h2 className="text-lg font-bold text-gray-900">You're All Set!</h2>
          <p className="text-sm text-gray-500 mt-1">Here's how NXTPLY helps you develop.</p>
        </div>

        <div className="space-y-3">
          {[
            { num: 1, title: 'Log', desc: 'Track every session — shooting, passing, fitness, body check, and more.' },
            { num: 2, title: 'Track', desc: 'See trends, streaks, personal records, and peer comparisons.' },
            { num: 3, title: 'Improve', desc: 'Get AI insights, gap analysis, and personalized session recommendations.' },
          ].map(item => (
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
            Start Training
          </Button>
        </div>
      </div>
    ),
  ];

  const TOTAL_STEPS = steps.length;

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <ProgressDots current={step} total={TOTAL_STEPS} />

      {steps[step]()}

      {step < TOTAL_STEPS - 1 && (
        <div className="flex items-center justify-between mt-6">
          {step > 0 ? (
            <Button variant="secondary" onClick={() => setStep(s => s - 1)}>
              Back
            </Button>
          ) : (
            <div />
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
