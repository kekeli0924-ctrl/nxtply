import { useState } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { getIdentity, hasAnyIdentity } from '../utils/identity';

// Canonical player positions. Ordered front-to-back so the layout reads naturally
// left-to-right. "General" was removed — players who don't pick anything simply
// leave the list empty, and the app falls back to position-agnostic metrics.
const POSITIONS = ['Striker', 'Winger', 'CAM', 'CM', 'CDM', 'Fullback', 'CB', 'GK'];
const AGE_GROUPS = ['U12', 'U14', 'U16', 'U18', 'U21', 'Senior'];
const SKILL_LEVELS = ['Recreational', 'Academy', 'Semi-Pro', 'Professional'];
const EQUIPMENT_OPTIONS = ['Ball only', 'Wall / rebounder', 'Cones / markers', 'Goal / net', 'Agility ladder', 'Resistance bands'];

// Player identity presets. Emojis removed; labels rewritten as first-person
// declarations so the player picks what they WANT TO BE, not what they are.
// The IDs are stable contract keys — do not rename them when copy changes.
const IDENTITY_OPTIONS = [
  { id: 'scorer', label: 'Scoring goals from anywhere' },
  { id: 'speedster', label: 'Too fast to catch' },
  { id: 'playmaker', label: 'The pass nobody else sees' },
  { id: 'engine', label: 'First to arrive, last to leave' },
  { id: 'rock', label: 'Every 50/50 is mine' },
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
    position: [], // multi-select: players can pick multiple positions (e.g. Winger + Fullback)
    ageGroup: '',
    skillLevel: '',
    weeklyGoal: 3,
    equipment: ['ball'],
    // Multi-select: array of preset IDs (e.g. ['scorer', 'engine']). Custom
    // free-text is held in customIdentity and merged into the final array at
    // onComplete time so it doesn't get lost when the user toggles presets.
    playerIdentity: [],
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

  // True if the player has selected at least one position. Coaches and parents
  // don't have a position, so this check is skipped for them.
  const hasPosition = () => isCoach || isParent || (Array.isArray(data.position) && data.position.length > 0);

  // True if the player has selected at least one identity (preset OR custom text).
  const hasIdentity = () => isCoach || isParent
    || (Array.isArray(data.playerIdentity) && data.playerIdentity.length > 0)
    || (data.customIdentity && data.customIdentity.trim().length > 0);

  const canAdvance = () => {
    // Google flow injects a username step at index 1. When present, it blocks
    // Next until the username validates. All other indices shift down by one.
    // The preview step (inserted after identity) is always passable.
    if (isGoogleFlow) {
      if (step === 0) return true; // role
      if (step === 1) return !validateUsername(data.username); // username
      if (step === 2) return hasPosition(); // name (optional) + position (required)
      if (!isCoach && step === 3) return data.ageGroup && data.skillLevel;
      if (!isCoach && step === 4) return hasIdentity(); // identity — required
      return true; // preview, weekly goal, equipment, finish — all passable
    }
    if (step === 0) return true; // role selection always valid
    if (step === 1) return hasPosition(); // name is optional, position is required
    if (!isCoach && step === 2) return data.ageGroup && data.skillLevel;
    if (!isCoach && step === 3) return hasIdentity(); // identity — required
    return true; // preview, weekly goal, equipment, finish — all passable
  };

  const handleFinish = () => {
    onComplete({
      role: data.role,
      // Google flow passes username through so the parent can call /google/complete.
      // Password flow ignores this field — its username is typed in SignupForm.
      username: isGoogleFlow ? data.username.trim() : undefined,
      playerName: data.playerName,
      // Position is a multi-select array. Coaches/parents don't play, so they
      // get an empty array (no profile position). Players carry through whatever
      // they picked; if they skipped the picker, it's [] and the app falls back
      // to position-agnostic metrics.
      position: (isCoach || isParent) ? [] : (Array.isArray(data.position) ? data.position : []),
      ageGroup: (isCoach || isParent) ? '' : data.ageGroup,
      skillLevel: (isCoach || isParent) ? '' : data.skillLevel,
      weeklyGoal: (isCoach || isParent) ? 3 : data.weeklyGoal,
      equipment: (isCoach || isParent) ? ['ball'] : data.equipment,
      // Merge selected presets with any custom free-text the user typed into
      // a single array. Coaches and parents don't have an identity (they don't
      // play), so they get an empty array.
      playerIdentity: (isCoach || isParent)
        ? []
        : [
            ...(Array.isArray(data.playerIdentity) ? data.playerIdentity : []),
            ...(data.customIdentity && data.customIdentity.trim() ? [data.customIdentity.trim()] : []),
          ],
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
              <label className="block text-xs font-medium text-gray-500 mb-2">
                Your position <span className="text-red-500">*</span>{' '}
                <span className="text-gray-300">(pick one or more)</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {POSITIONS.map(pos => {
                  const selected = Array.isArray(data.position) && data.position.includes(pos);
                  return (
                    <TagButton
                      key={pos}
                      selected={selected}
                      onClick={() => {
                        // Functional setState so rapid clicks / React batching don't
                        // trample each other. Each click reads the LATEST state, not
                        // the captured snapshot from when onClick was defined.
                        setData(prev => {
                          const cur = Array.isArray(prev.position) ? prev.position : [];
                          return {
                            ...prev,
                            position: cur.includes(pos)
                              ? cur.filter(p => p !== pos)
                              : [...cur, pos],
                          };
                        });
                      }}
                    >
                      {pos}
                    </TagButton>
                  );
                })}
              </div>
              {(!Array.isArray(data.position) || data.position.length === 0) && (
                <p className="text-[11px] text-amber-600 mt-2">
                  Select at least one position to continue.
                </p>
              )}
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
    // Multi-select: players can pick multiple presets AND add free-text.
    () => (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-6">
          <h2 className="text-xl font-bold text-gray-900">What do you want to be<br />known for on the pitch? <span className="text-red-500">*</span></h2>
          <p className="text-xs text-gray-400 mt-2">
            Pick one or more. This shapes your training, your goals, and your story.
          </p>
        </div>

        <div className="space-y-2.5">
          {IDENTITY_OPTIONS.map(opt => {
            const selected = Array.isArray(data.playerIdentity) && data.playerIdentity.includes(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  // Functional setState so rapid clicks / batching don't trample
                  // each other (same pattern as position multi-select).
                  setData(prev => {
                    const cur = Array.isArray(prev.playerIdentity) ? prev.playerIdentity : [];
                    return {
                      ...prev,
                      playerIdentity: cur.includes(opt.id)
                        ? cur.filter(i => i !== opt.id)
                        : [...cur, opt.id],
                    };
                  });
                }}
                className={`w-full text-left rounded-xl border-2 px-4 py-3.5 transition-all ${
                  selected
                    ? 'border-accent bg-accent/5 shadow-sm'
                    : 'border-gray-100 bg-white hover:border-gray-200'
                }`}
              >
                <span className="text-sm font-medium text-gray-900">{opt.label}</span>
              </button>
            );
          })}

          {/* Optional free-text — users can add one custom identity alongside presets */}
          <div className="rounded-xl border-2 border-gray-100 bg-white px-4 py-3.5">
            <label className="block text-xs font-medium text-gray-500 mb-2">
              Write your own <span className="text-gray-300">(optional)</span>
            </label>
            <input
              type="text"
              value={data.customIdentity}
              onChange={e => update('customIdentity', e.target.value)}
              placeholder="e.g. The clutch player who shows up in big moments"
              maxLength={80}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {/* Amber hint — same pattern as position required hint */}
          {!hasIdentity() && (
            <p className="text-[11px] text-amber-600 mt-2">
              Select at least one identity to continue.
            </p>
          )}
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

  // ── Pace Preview step — shows after identity selection ──────────────────
  // Renders a visually identical copy of the Dashboard Pace hero card from
  // Step 3, populated with the user's just-selected identity and position but
  // with clearly-labeled placeholder numbers. Does not call computePace or
  // touch any real data. The "see why" link is present but non-functional
  // (shows a tooltip note instead of routing to the audit view).
  const PREVIEW_PACE_COLORS = {
    accelerating: '#16A34A',
  };

  const pacePreviewStep = () => {
    // Determine identity label from whatever the user just selected
    const mergedIdentity = [
      ...(Array.isArray(data.playerIdentity) ? data.playerIdentity : []),
      ...(data.customIdentity && data.customIdentity.trim() ? [data.customIdentity.trim()] : []),
    ];
    const identityConfig = getIdentity(mergedIdentity);
    const identityLabel = identityConfig?.label || null;
    const positionLabel = Array.isArray(data.position) && data.position.length > 0
      ? data.position[0]
      : 'your position';

    return (
      <div style={{ animation: 'fadeSlideUp 0.3s ease-out' }}>
        <div className="text-center mb-5">
          <h2 className="text-xl font-bold text-gray-900">Here's what your<br />Dashboard will look like</h2>
          <p className="text-xs text-gray-400 mt-2">
            This is personalized to you — a {positionLabel}{identityLabel ? ` who's known for being a ${identityLabel}` : ''}.
          </p>
        </div>

        {/* Preview hero card — matches Step 3 PaceHeroCard visually */}
        <div className="bg-surface rounded-2xl border border-gray-100 shadow-card overflow-hidden relative">
          {/* Preview badge */}
          <div className="absolute top-3 right-3 bg-gray-100 text-gray-500 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full">
            Preview
          </div>

          <div className="px-5 pt-5 pb-4">
            <p className="text-xs text-gray-400 font-medium mb-1">
              {identityLabel ? `Your ${identityLabel} Pace` : 'Your Pace'}
            </p>
            <div className="flex items-baseline gap-2.5 mb-1">
              <span className="text-3xl font-bold" style={{ color: PREVIEW_PACE_COLORS.accelerating }}>
                +4.2%
              </span>
              <span
                className="text-sm font-bold uppercase tracking-wide"
                style={{ color: PREVIEW_PACE_COLORS.accelerating }}
              >
                Accelerating
              </span>
            </div>
            <p className="text-xs text-gray-400 leading-relaxed italic">
              Example — your real numbers appear once you start training.
            </p>
          </div>

          <div className="border-t border-gray-100 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400">Training Score</span>
              <span className="text-sm text-gray-300 italic">—</span>
            </div>
            <span className="text-xs text-gray-400 italic">
              See why ↗
            </span>
          </div>
        </div>

        {/* One-sentence pedagogical explanation */}
        <p className="text-xs text-gray-400 text-center mt-4 leading-relaxed px-4">
          Your Pace updates every time you train. It's weighted by what matters most for a {positionLabel}.
        </p>
      </div>
    );
  };

  // Coach skips player-specific steps (age group, identity, weekly goal)
  // Parent skips player-specific steps, gets connect-to-child step instead
  // steps[5] is the parent connect step — exclude it for player and coach
  const playerSteps = steps.filter((_, i) => i !== 5); // all except parent connect

  // For players, inject the preview step right after identity (steps[3])
  // and before weekly goal + equipment (steps[4]).
  // playerSteps order is: [role, name, age, identity, weekly, finish]
  // After injection:      [role, name, age, identity, PREVIEW, weekly, finish]
  const playerStepsWithPreview = [
    ...playerSteps.slice(0, 4),  // role, name, age, identity
    pacePreviewStep,              // NEW: preview
    ...playerSteps.slice(4),      // weekly+equipment, finish
  ];

  let activeSteps = isCoach
    ? [steps[0], steps[1], steps[steps.length - 1]]  // role, name, finish
    : isParent
    ? [steps[0], steps[5], steps[steps.length - 1]]  // role, connect, finish (skip name/position)
    : playerStepsWithPreview;

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
