import { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

const POSITIONS = ['General', 'Winger', 'Striker', 'CAM', 'CDM', 'CB', 'GK'];
const AGE_GROUPS = ['U12', 'U14', 'U16', 'U18', 'U21', 'Senior'];
const SKILL_LEVELS = ['Recreational', 'Academy', 'Semi-Pro', 'Professional'];
const EQUIPMENT_OPTIONS = ['Ball only', 'Wall / rebounder', 'Cones / markers', 'Goal / net', 'Agility ladder', 'Resistance bands'];

const IDENTITY_OPTIONS = [
  { id: 'scorer', label: 'Scoring goals from anywhere', icon: '🎯' },
  { id: 'speedster', label: 'Speed that nobody can match', icon: '⚡' },
  { id: 'playmaker', label: 'Vision and creativity', icon: '🧠' },
  { id: 'engine', label: 'Being the hardest worker', icon: '🔥' },
  { id: 'rock', label: 'Winning every ball', icon: '🛡️' },
];

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

export function OnboardingFlow({ settings, onComplete, googleFlow }) {
  // When googleFlow is set, the user is signing up via Google. They didn't get to
  // type a username on the auth screen, so we inject a dedicated "Pick a username"
  // step and include the picked value in onComplete(). Pre-seed playerName from
  // the Google profile so they don't have to retype it.
  const isGoogleFlow = !!googleFlow;

  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    role: 'player',
    playerName: googleFlow?.name || settings.playerName || '',
    username: '',
    usernameError: '',
    position: 'General',
    ageGroup: '',
    skillLevel: '',
    weeklyGoal: 3,
    equipment: ['ball'],
    playerIdentity: '',
    customIdentity: '',
    parentCode: '',
    parentConnectError: '',
    parentConnected: false,
  });

  const update = (field, value) => setData(prev => ({ ...prev, [field]: value }));

  const isCoach = data.role === 'coach';
  const isParent = data.role === 'parent';

  // Mirror the server's username rules so the user sees errors immediately
  // instead of after a round-trip to /google/complete.
  const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
  const validateUsername = (u) => {
    if (!u) return 'Pick a username';
    if (u.length < 3) return 'At least 3 characters';
    if (u.length > 50) return 'Too long (max 50)';
    if (!USERNAME_REGEX.test(u)) return 'Letters, numbers, underscores, hyphens only';
    return '';
  };

  const canAdvance = () => {
    // Google flow injects a username step at index 1. When present, it blocks
    // Next until the username validates. All other indices shift down by one.
    if (isGoogleFlow) {
      if (step === 0) return true; // role
      if (step === 1) return !validateUsername(data.username); // username
      if (step === 2) return true; // name (optional)
      if (!isCoach && step === 3) return data.ageGroup && data.skillLevel;
      return true;
    }
    if (step === 0) return true; // role selection always valid
    if (step === 1) return true; // name is optional
    if (!isCoach && step === 2) return data.ageGroup && data.skillLevel;
    return true;
  };

  const handleFinish = () => {
    onComplete({
      role: data.role,
      // Google flow passes username through so the parent can call /google/complete.
      // Password flow ignores this field — its username is typed in SignupForm.
      username: isGoogleFlow ? data.username.trim() : undefined,
      playerName: data.playerName,
      ageGroup: (isCoach || isParent) ? '' : data.ageGroup,
      skillLevel: (isCoach || isParent) ? '' : data.skillLevel,
      weeklyGoal: (isCoach || isParent) ? 3 : data.weeklyGoal,
      equipment: (isCoach || isParent) ? ['ball'] : data.equipment,
      playerIdentity: (isCoach || isParent) ? '' : (data.playerIdentity || data.customIdentity || ''),
      onboardingComplete: 1,
    });
  };

  const handleParentConnect = async () => {
    if (!data.parentCode.trim()) return;
    update('parentConnectError', '');
    try {
      const res = await fetch('/api/parent/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: data.parentCode.trim() }),
      });
      const result = await res.json();
      if (res.ok) {
        update('parentConnected', true);
        update('parentConnectError', '');
      } else {
        update('parentConnectError', result.error || 'Invalid code');
      }
    } catch {
      update('parentConnectError', 'Connection failed. Try again.');
    }
  };

  const steps = [
    // Step 0: Role Selection
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <h2 className="text-3xl text-gray-900 tracking-tight font-logo italic">stay composed</h2>
        </div>

        <div className="space-y-3">
          {[
            { role: 'player', icon: '', title: "I'm a Player", desc: 'Track my training, log sessions, improve my game' },
            { role: 'coach', icon: '', title: "I'm a Coach", desc: 'Manage players, assign plans, track progress' },
            { role: 'parent', icon: '', title: "I'm a Parent", desc: "See your child's training progress" },
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
          <h2 className="text-3xl text-gray-900 tracking-tight font-logo italic">stay composed</h2>
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
          <h2 className="text-3xl text-gray-900 tracking-tight font-logo italic">stay composed</h2>
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

    // Step 3: Player Identity — "What do you want to be known for?"
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">What do you want to be<br />known for on the pitch?</h2>
          <p className="text-xs text-gray-400 mt-2">This shapes your training, your goals, and your story.</p>
        </div>

        <div className="space-y-2.5">
          {IDENTITY_OPTIONS.map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => { update('playerIdentity', opt.id); update('customIdentity', ''); }}
              className={`w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all flex items-center gap-3 ${
                data.playerIdentity === opt.id
                  ? 'border-accent bg-accent/5 shadow-sm'
                  : 'border-gray-100 bg-white hover:border-gray-200'
              }`}
            >
              <span className="text-xl">{opt.icon}</span>
              <span className="text-sm font-medium text-gray-900">{opt.label}</span>
            </button>
          ))}

          {/* Custom option */}
          <div className={`rounded-xl border-2 px-4 py-3.5 transition-all ${
            data.playerIdentity === 'custom' ? 'border-accent bg-accent/5' : 'border-gray-100 bg-white'
          }`}>
            <button
              type="button"
              onClick={() => update('playerIdentity', 'custom')}
              className="w-full text-left flex items-center gap-3"
            >
              <span className="text-xl">✍️</span>
              <span className="text-sm font-medium text-gray-900">Write your own</span>
            </button>
            {data.playerIdentity === 'custom' && (
              <input
                type="text"
                value={data.customIdentity}
                onChange={e => update('customIdentity', e.target.value)}
                placeholder="e.g. The clutch player who shows up in big moments"
                maxLength={80}
                className="w-full mt-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
                autoFocus
              />
            )}
          </div>
        </div>
      </div>
    ),

    // Step 4: Weekly Goal
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <h2 className="text-3xl text-gray-900 tracking-tight font-logo italic">stay composed</h2>
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

    // Parent: Connect to Child (parent only — skipped for player/coach via activeSteps)
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <h2 className="text-3xl text-gray-900 tracking-tight font-logo italic">stay composed</h2>
        </div>

        <Card>
          <div className="space-y-4">
            <div className="text-center">
              <div className="text-3xl mb-2">🔗</div>
              <p className="text-sm font-semibold text-gray-900">Connect to your child's account</p>
              <p className="text-xs text-gray-500 mt-1">Ask your child to generate a parent invite code from their settings.</p>
            </div>

            {data.parentConnected ? (
              <div className="text-center py-2">
                <div className="text-2xl mb-1">✅</div>
                <p className="text-sm font-semibold text-green-700">Connected!</p>
                <p className="text-xs text-gray-400 mt-1">You can connect more children later from your dashboard.</p>
              </div>
            ) : (
              <>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={data.parentCode}
                    onChange={e => update('parentCode', e.target.value.toUpperCase())}
                    placeholder="Enter 6-character code"
                    maxLength={6}
                    className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm text-center uppercase tracking-widest focus:outline-none focus:ring-2 focus:ring-accent/30"
                  />
                  <Button onClick={handleParentConnect} disabled={data.parentCode.length < 4}>
                    Connect
                  </Button>
                </div>
                {data.parentConnectError && (
                  <p className="text-xs text-red-500 text-center">{data.parentConnectError}</p>
                )}
              </>
            )}

            <div className="space-y-2 pt-2 border-t border-gray-100">
              <p className="text-[10px] text-gray-400 uppercase tracking-wide font-medium text-center">How it works</p>
              {[
                { num: '1', text: 'Your child opens Settings → Parent Access' },
                { num: '2', text: "They tap 'Generate Parent Code'" },
                { num: '3', text: 'You enter the code above' },
              ].map(s => (
                <div key={s.num} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-accent/10 text-accent flex items-center justify-center text-[10px] font-bold shrink-0">{s.num}</span>
                  <p className="text-xs text-gray-600">{s.text}</p>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>
    ),

    // Feature Overview + CTA
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <h2 className="text-3xl text-gray-900 tracking-tight font-logo italic">stay composed</h2>
        </div>

        <div className="space-y-3">
          {(isCoach ? [
            { num: 1, title: 'Build Your Roster', desc: 'Generate invite codes and link up with your players.' },
            { num: 2, title: 'Assign Plans', desc: 'Create training plans on specific dates for each player.' },
            { num: 3, title: 'Track Progress', desc: 'View stats, compliance, and development across your squad.' },
          ] : isParent ? [
            { num: 1, title: 'Stay Updated', desc: "See your child's training sessions, stats, and streaks at a glance." },
            { num: 2, title: 'Track Progress', desc: 'Monitor development goals, shooting accuracy, and fitness trends.' },
            { num: 3, title: 'Stay Connected', desc: 'See coach-assigned plans and training compliance.' },
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
            {isCoach ? 'Get Started' : isParent ? 'View Dashboard' : 'Start Training'}
          </Button>
        </div>
      </div>
    ),
  ];

  // Google-only step: pick a username. Injected at position 1 in activeSteps
  // when the user is signing up via Google. We use a live error so typing an
  // invalid character shows feedback immediately instead of waiting for Next.
  const googleUsernameStep = () => {
    const liveError = data.username ? validateUsername(data.username) : '';
    return (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <h2 className="text-3xl text-gray-900 tracking-tight font-logo italic">stay composed</h2>
          <p className="text-xs text-gray-400 mt-2">Signed in as {googleFlow?.email || 'your Google account'}</p>
        </div>

        <Card>
          <label className="block text-xs font-medium text-gray-500 mb-1">Pick a username</label>
          <input
            type="text"
            autoFocus
            value={data.username}
            onChange={e => update('username', e.target.value)}
            placeholder="e.g. lukemessi"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck="false"
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <p className="text-[10px] text-gray-400 mt-2">
            3–50 characters. Letters, numbers, underscores, and hyphens only.
          </p>
          {liveError && (
            <p className="text-[11px] text-red-500 mt-2">{liveError}</p>
          )}
        </Card>
      </div>
    );
  };

  // Coach skips player-specific steps (age group, identity, weekly goal)
  // Parent skips player-specific steps, gets connect-to-child step instead
  // steps[5] is the parent connect step — exclude it for player and coach
  const playerSteps = steps.filter((_, i) => i !== 5); // all except parent connect
  let activeSteps = isCoach
    ? [steps[0], steps[1], steps[steps.length - 1]]  // role, name, finish
    : isParent
    ? [steps[0], steps[5], steps[steps.length - 1]]  // role, connect, finish (skip name/position)
    : playerSteps;

  // Inject the Google "pick a username" step at position 1 (after role select)
  // for Google sign-up flows. Works for all three roles.
  if (isGoogleFlow) {
    activeSteps = [activeSteps[0], googleUsernameStep, ...activeSteps.slice(1)];
  }

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
