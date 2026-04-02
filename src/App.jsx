import { useState, useCallback, useRef, useEffect } from 'react';
import { useApiCollection, useApiSingleton, useApiStringList } from './hooks/useApi';
import { Dashboard } from './components/Dashboard';
import { SessionLogger } from './components/SessionLogger';
import { SessionHistory } from './components/SessionHistory';
import { DrillBreakdown } from './components/DrillBreakdown';
import { TrainingCalendar } from './components/TrainingCalendar';
import { IDPModule } from './components/IDPModule';
import { OnboardingFlow } from './components/OnboardingFlow';
import { CoachRoster } from './components/CoachRoster';
import { CoachPlanAssign } from './components/CoachPlanAssign';
import { CoachOverview } from './components/CoachOverview';
import { CoachPlayerDetail } from './components/CoachPlayerDetail';
import { SocialFeed } from './components/SocialFeed';
import { CoachChat } from './components/CoachChat';
import { StreakXPCard } from './components/StreakXPCard';
import { LiveSessionMode } from './components/LiveSessionMode';
import { SessionComments } from './components/SessionComments';
import { Toast } from './components/ui/Toast';
import { Button } from './components/ui/Button';
import { Modal, ConfirmModal } from './components/ui/Modal';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { formatDate, formatPercentage, computePersonalRecords, detectNewPRs, PR_LABELS, getStreak } from './utils/stats';
import { computeXP, getLevel } from './utils/gamification';
import { getNewBadges } from './utils/gamification';

const PLAYER_TABS = [
  { id: 'dashboard', label: 'Home', icon: DashboardIcon },
  { id: 'history', label: 'History', icon: ListIcon },
  { id: 'plan', label: 'Plan', icon: CalendarIcon },
  { id: 'social', label: 'Community', icon: SocialIcon },
  { id: 'drills', label: 'Drills', icon: TargetIcon },
  { id: 'idp', label: 'IDP', icon: BrainIcon },
];

// COACH_TABS defined after icon functions below

function App() {
  // Persistent state (API-backed)
  const [sessions, setSessions, sessionsLoaded] = useApiCollection('/sessions', []);
  const [customDrills, setCustomDrills] = useApiStringList('/custom-drills', []);
  const [settings, setSettings] = useApiSingleton('/settings', { distanceUnit: 'km' });
  const [personalRecords, setPersonalRecords] = useApiSingleton('/personal-records', null);
  const [trainingPlans, setTrainingPlans] = useApiCollection('/training-plans', []);
  const [idpGoals, setIdpGoals] = useApiCollection('/idp-goals', []);
  const [templates, setTemplates] = useApiCollection('/templates', []);

  const [assignedPlans, setAssignedPlans] = useState([]);
  const [myCoach, setMyCoach] = useState(null);

  // Fetch coach info for player
  useEffect(() => {
    fetch('/api/roster/my-coach')
      .then(r => r.ok ? r.json() : null)
      .then(setMyCoach)
      .catch(() => {});
  }, []);

  // Role state
  const [userRole, setUserRole] = useState(null); // 'player' | 'coach' | null (loading)

  // Sync role to window for API requests
  useEffect(() => {
    window.__COMPOSED_ROLE__ = userRole || 'player';
  }, [userRole]);

  // Fetch assigned plans for players (poll every 30s for coach updates)
  useEffect(() => {
    if (userRole === 'coach') return;
    const fetchPlans = () => {
      const role = window.__COMPOSED_ROLE__ || 'player';
      fetch(`/api/assigned-plans?_role=${role}`, { headers: { 'X-Dev-Role': role } })
        .then(r => r.ok ? r.json() : [])
        .then(setAssignedPlans)
        .catch(() => {});
    };
    fetchPlans();
    const interval = setInterval(fetchPlans, 30000);
    return () => clearInterval(interval);
  }, [userRole]);

  // UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedCoachPlayer, setSelectedCoachPlayer] = useState(null);
  const [editSession, setEditSession] = useState(null);
  const [viewSession, setViewSession] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearDouble, setShowClearDouble] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  const showToast = useCallback((message, variant = 'success') => {
    setToast({ show: true, message, variant });
  }, []);

  const hideToast = useCallback(() => {
    setToast({ show: false, message: '', variant: 'success' });
  }, []);

  // Listen for API error events from useApi hooks
  useEffect(() => {
    const handler = (e) => showToast(e.detail, 'error');
    window.addEventListener('api-error', handler);
    return () => window.removeEventListener('api-error', handler);
  }, [showToast]);

  // === Session callbacks ===
  const handleSaveSession = useCallback((session) => {
    let newSessions;
    setSessions(prev => {
      const existing = prev.findIndex(s => s.id === session.id);
      if (existing >= 0) {
        newSessions = [...prev];
        newSessions[existing] = session;
      } else {
        newSessions = [...prev, session];
      }
      return newSessions;
    });

    // PR + Badge detection
    setTimeout(() => {
      const records = computePersonalRecords(newSessions);
      const newPRs = detectNewPRs(personalRecords, records);
      setPersonalRecords(records);

      // Check for new badges
      const prevSessions = newSessions.filter(s => s.id !== session.id);
      const badges = getNewBadges(prevSessions, newSessions);

      if (badges.length > 0) {
        showToast(`${badges[0].icon} Badge unlocked: ${badges[0].name}!`);
      } else if (newPRs.length > 0) {
        showToast(`New PR: ${PR_LABELS[newPRs[0]]}!`);
      } else {
        showToast(editSession ? 'Session updated!' : 'Session saved!');
      }
    }, 0);

    setEditSession(null);
    setActiveTab('dashboard');
  }, [setSessions, showToast, editSession, personalRecords, setPersonalRecords]);

  const handleDeleteSession = useCallback((id) => {
    setSessions(prev => prev.filter(s => s.id !== id));
    showToast('Session deleted');
  }, [setSessions, showToast]);

  const handleEditSession = useCallback((session) => {
    setEditSession(session);
    setActiveTab('log');
  }, []);

  const handleViewSession = useCallback((session) => {
    setViewSession(session);
  }, []);

  // === Plan callbacks ===
  const handleSavePlan = useCallback((plan) => {
    setTrainingPlans(prev => {
      const existing = prev.findIndex(p => p.id === plan.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = plan;
        return updated;
      }
      return [...prev, plan];
    });
    showToast('Plan saved');
  }, [setTrainingPlans, showToast]);

  const handleDeletePlan = useCallback((id) => {
    setTrainingPlans(prev => prev.filter(p => p.id !== id));
  }, [setTrainingPlans]);

  // === Data management ===
  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/data/export');
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `composed-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Data exported');
    } catch {
      showToast('Export failed', 'error');
    } finally {
      setExporting(false);
    }
  }, [showToast]);

  const handleImport = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        const res = await fetch('/api/data/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error('Import failed');
        // Reload page to refetch all data from API
        showToast('Data imported — reloading...');
        setTimeout(() => window.location.reload(), 500);
      } catch {
        showToast('Invalid file format', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }, [showToast]);

  const handleClearAll = useCallback(() => {
    setShowClearConfirm(false);
    setShowClearDouble(true);
  }, []);

  const handleClearConfirmed = useCallback(async () => {
    try {
      await fetch('/api/data/clear', { method: 'POST' });
      setShowClearDouble(false);
      showToast('All data cleared — reloading...');
      setTimeout(() => window.location.reload(), 500);
    } catch {
      showToast('Clear failed', 'error');
    }
  }, [showToast]);


  const handleAddCustomDrill = useCallback((name) => {
    setCustomDrills(prev => [...prev, name]);
  }, [setCustomDrills]);

  const toggleUnit = useCallback(() => {
    setSettings(prev => ({ ...prev, distanceUnit: prev.distanceUnit === 'km' ? 'mi' : 'km' }));
  }, [setSettings]);

  const [livePlan, setLivePlan] = useState(null); // Active live session plan

  const handleStartPlan = useCallback((plan) => {
    // Launch Live Session Mode
    setLivePlan(plan);
  }, []);

  const handleStartManual = useCallback((plan) => {
    setEditSession(null);
    setActiveTab('log');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('prefill-session', { detail: plan }));
    }, 100);
  }, []);

  const handleLiveComplete = useCallback((prefillData) => {
    setLivePlan(null);
    setEditSession(null);
    setActiveTab('log');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('prefill-session', { detail: prefillData }));
    }, 100);
  }, []);

  const handleLiveExit = useCallback(() => {
    setLivePlan(null);
  }, []);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId !== 'log') setEditSession(null);
    // Refresh assigned plans when going to dashboard
    if (tabId === 'dashboard' && userRole !== 'coach') {
      const role = window.__COMPOSED_ROLE__ || 'player';
      fetch(`/api/assigned-plans?_role=${role}`, { headers: { 'X-Dev-Role': role } })
        .then(r => r.ok ? r.json() : [])
        .then(setAssignedPlans)
        .catch(() => {});
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
      {/* Live Session Mode (full-screen overlay) */}
      {livePlan && (
        <LiveSessionMode plan={livePlan} onComplete={handleLiveComplete} onExit={handleLiveExit} />
      )}
      <OfflineIndicator />
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-card sticky top-0 z-30" role="banner">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="w-5" />
          <button onClick={() => setShowSettings(true)} aria-label="Profile" className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
            {settings.playerName ? settings.playerName[0]?.toUpperCase() : '⚽'}
          </button>
        </div>
        <nav className="hidden md:flex max-w-3xl mx-auto px-4 gap-1" aria-label="Main navigation">
          {(userRole === 'coach' ? COACH_TABS : PLAYER_TABS).map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id ? 'border-accent text-accent' : 'border-transparent text-gray-400 hover:text-gray-600'
              }`}
            >
              <tab.icon active={activeTab === tab.id} />
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      {/* Content */}
      <main className="max-w-3xl mx-auto px-4 py-6">
        {sessionsLoaded && sessions.length === 0 && !settings.onboardingComplete ? (
          <OnboardingFlow
            settings={settings}
            onComplete={(data) => {
              const { role, ...settingsData } = data;
              setUserRole(role || 'player');
              setSettings(prev => ({ ...prev, ...settingsData }));
              setActiveTab(role === 'coach' ? 'roster' : 'dashboard');
            }}
          />
        ) : (
        <>
        <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
          <Dashboard sessions={sessions} personalRecords={personalRecords} onViewSession={handleViewSession} idpGoals={idpGoals} weeklyGoal={settings.weeklyGoal ?? 3} ageGroup={settings.ageGroup} skillLevel={settings.skillLevel} onOpenSettings={() => setShowSettings(true)} onNavigateToLog={() => setActiveTab('log')} onStartPlan={handleStartPlan} onStartManual={handleStartManual} assignedPlans={assignedPlans} trainingPlans={trainingPlans} settings={settings} myCoach={myCoach} onNavigate={(tab) => setActiveTab(tab)} onDismissGettingStarted={() => setSettings(prev => ({ ...prev, gettingStartedComplete: 1 }))} />
        </div>
        <div className={activeTab === 'log' ? '' : 'hidden'}>
          <SessionLogger onSave={handleSaveSession} editSession={editSession} customDrills={customDrills} onAddCustomDrill={handleAddCustomDrill} distanceUnit={settings.distanceUnit} templates={templates} setTemplates={setTemplates} idpGoals={idpGoals} sessions={sessions} />
        </div>
        <div className={activeTab === 'history' ? '' : 'hidden'}>
          <SessionHistory sessions={sessions} customDrills={customDrills} onEdit={handleEditSession} onDelete={handleDeleteSession} onView={handleViewSession} />
        </div>
        <div className={activeTab === 'plan' ? '' : 'hidden'}>
          <TrainingCalendar plans={trainingPlans} sessions={sessions} customDrills={customDrills} onSavePlan={handleSavePlan} onDeletePlan={handleDeletePlan} assignedPlans={assignedPlans} />
        </div>
        <div className={activeTab === 'social' ? '' : 'hidden'}>
          <div className="space-y-5 max-w-3xl mx-auto">
            <h2 className="text-xl font-bold text-gray-900">Community</h2>
            <CoachChat coachId={myCoach?.coachId} coachName={myCoach?.coachName} />
            <SocialFeed />
          </div>
        </div>
        <div className={activeTab === 'drills' ? '' : 'hidden'}>
          <DrillBreakdown sessions={sessions} customDrills={customDrills} />
        </div>
        <div className={activeTab === 'idp' ? '' : 'hidden'}>
          <IDPModule goals={idpGoals} onSaveGoals={setIdpGoals} sessions={sessions} />
        </div>

        {/* Coach views */}
        <div className={activeTab === 'roster' ? '' : 'hidden'}>
          {selectedCoachPlayer ? (
            <CoachPlayerDetail player={selectedCoachPlayer} onBack={() => setSelectedCoachPlayer(null)} />
          ) : (
            <CoachRoster onSelectPlayer={setSelectedCoachPlayer} />
          )}
        </div>
        <div className={activeTab === 'assign' ? '' : 'hidden'}>
          <CoachPlanAssign />
        </div>
        <div className={activeTab === 'overview' ? '' : 'hidden'}>
          <CoachOverview />
        </div>
        </>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-card z-30" aria-label="Main navigation">
        <div className="flex">
          {(userRole === 'coach' ? COACH_TABS : PLAYER_TABS).map(tab => (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab.id)}
              className={`flex-1 flex flex-col items-center py-2 text-[10px] font-medium transition-colors ${
                activeTab === tab.id ? 'text-accent' : 'text-gray-400'
              }`}
            >
              <tab.icon active={activeTab === tab.id} />
              <span className="mt-0.5">{tab.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* Session Detail Modal */}
      <Modal
        open={!!viewSession}
        onClose={() => setViewSession(null)}
        title={viewSession ? `Session \u2014 ${formatDate(viewSession.date)}` : ''}
        actions={
          <>
            <Button variant="secondary" onClick={() => setViewSession(null)}>Close</Button>
            <Button onClick={() => { handleEditSession(viewSession); setViewSession(null); }}>Edit</Button>
          </>
        }
      >
        {viewSession && (
          <>
            <SessionDetail session={viewSession} />
            <div className="mt-4 pt-4 border-t border-gray-100">
              <SessionComments sessionId={viewSession.id} />
            </div>
          </>
        )}
      </Modal>


      {/* Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title=""
        actions={<Button variant="secondary" onClick={() => setShowSettings(false)}>Close</Button>}
      >
        <div className="space-y-5">
          {/* Profile Header */}
          <div className="text-center -mt-2">
            <div className="w-20 h-20 rounded-full bg-accent/10 mx-auto flex items-center justify-center text-3xl">
              {settings.playerName ? settings.playerName[0]?.toUpperCase() : '⚽'}
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-3">{settings.playerName || 'Player'}</h2>
            <p className="text-xs text-gray-400">
              {settings.ageGroup && `${settings.ageGroup} · `}{settings.skillLevel || 'Set your profile'}
            </p>
            <div className="flex items-center justify-center gap-1 mt-2 bg-gray-100 rounded-lg p-0.5 w-fit mx-auto">
              {['player', 'coach'].map(r => (
                <button
                  key={r}
                  onClick={() => {
                    setUserRole(r);
                    setActiveTab(r === 'coach' ? 'roster' : 'dashboard');
                  }}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                    userRole === r ? 'bg-white text-accent shadow-sm' : 'text-gray-500'
                  }`}
                >
                  {r === 'player' ? 'Player' : 'Coach'}
                </button>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Streak + XP + Badges */}
          <StreakXPCard sessions={sessions} />

          <hr className="border-gray-100" />

          {/* Profile Settings */}
          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Profile</p>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Distance Unit</span>
            <Button variant="secondary" onClick={toggleUnit}>
              {settings.distanceUnit === 'km' ? 'Kilometers (km)' : 'Miles (mi)'}
            </Button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Weekly Session Goal</span>
            <div className="flex items-center gap-2">
              <input type="number" min="1" max="14" value={settings.weeklyGoal ?? 3}
                onChange={e => setSettings(prev => ({ ...prev, weeklyGoal: Number(e.target.value) || 3 }))}
                className="w-16 border border-gray-200 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-accent/30" />
              <span className="text-xs text-gray-400">sessions</span>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Age Group</span>
            <select
              value={settings.ageGroup || ''}
              onChange={e => setSettings(prev => ({ ...prev, ageGroup: e.target.value || undefined }))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">Select...</option>
              <option value="U12">U12</option>
              <option value="U14">U14</option>
              <option value="U16">U16</option>
              <option value="U18">U18</option>
              <option value="U21">U21</option>
              <option value="Senior">Senior (21+)</option>
            </select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700">Skill Level</span>
            <select
              value={settings.skillLevel || ''}
              onChange={e => setSettings(prev => ({ ...prev, skillLevel: e.target.value || undefined }))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="">Select...</option>
              <option value="Recreational">Recreational</option>
              <option value="Academy">Academy</option>
              <option value="Semi-Pro">Semi-Pro</option>
              <option value="Professional">Professional</option>
            </select>
          </div>
          </div>

          <hr className="border-gray-100" />

          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Training Setup</p>
            <label className="block text-sm text-gray-700 mb-1">Available Equipment</label>
            <div className="flex flex-wrap gap-2">
              {['Ball only', 'Wall / rebounder', 'Cones / markers', 'Goal / net', 'Agility ladder', 'Resistance bands'].map(item => {
                const key = item.toLowerCase().split(' ')[0];
                const eq = settings.equipment || ['ball', 'wall'];
                const isSelected = eq.includes(key);
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      const newEq = isSelected ? eq.filter(e => e !== key) : [...eq, key];
                      setSettings(prev => ({ ...prev, equipment: newEq }));
                    }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                      isSelected
                        ? 'bg-accent text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {item}
                  </button>
                );
              })}
            </div>
          </div>

          <hr className="border-gray-100" />

          <div className="space-y-3">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Data</p>
          <div className="space-y-2">
            <Button variant="secondary" onClick={handleExport} className="w-full" disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export as JSON'}
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full">Import JSON</Button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            <Button variant="danger" onClick={() => setShowClearConfirm(true)} className="w-full">Clear All Data</Button>
          </div>
          </div>
        </div>
      </Modal>

      <ConfirmModal open={showClearConfirm} onClose={() => setShowClearConfirm(false)} onConfirm={handleClearAll}
        title="Clear All Data" message="This will permanently delete all your data. This action cannot be undone." confirmText="Continue" danger />
      <ConfirmModal open={showClearDouble} onClose={() => setShowClearDouble(false)} onConfirm={handleClearConfirmed}
        title="Are you absolutely sure?" message="All sessions, matches, plans, IDP goals, decision journal, and settings will be permanently deleted." confirmText="Delete Everything" danger />

      <Toast message={toast.message} show={toast.show} onHide={hideToast} variant={toast.variant} />
    </div>
  );
}

function SessionDetail({ session }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-500">Duration</span>
        <span className="font-medium">{session.duration} min</span>
      </div>
      <div>
        <span className="text-gray-500">Drills</span>
        <div className="flex flex-wrap gap-1 mt-1">
          {session.drills.map(d => (
            <span key={d} className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full text-xs">{d}</span>
          ))}
        </div>
      </div>
      {session.shooting && (
        <div className="space-y-1">
          <span className="text-gray-500 font-medium">Shooting</span>
          <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg p-2">
            <div><p className="text-xs text-gray-400">Shots</p><p className="font-semibold">{session.shooting.shotsTaken}</p></div>
            <div><p className="text-xs text-gray-400">Goals</p><p className="font-semibold">{session.shooting.goals}</p></div>
            <div><p className="text-xs text-gray-400">Shot %</p><p className="font-semibold">{formatPercentage(session.shooting.goals, session.shooting.shotsTaken)}</p></div>
          </div>
          {session.shooting.leftFoot && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-gray-400">Left Foot</p>
                <p className="font-medium">{session.shooting.leftFoot.goals}/{session.shooting.leftFoot.shots} ({formatPercentage(session.shooting.leftFoot.goals, session.shooting.leftFoot.shots)})</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2 text-center">
                <p className="text-gray-400">Right Foot</p>
                <p className="font-medium">{session.shooting.rightFoot.goals}/{session.shooting.rightFoot.shots} ({formatPercentage(session.shooting.rightFoot.goals, session.shooting.rightFoot.shots)})</p>
              </div>
            </div>
          )}
        </div>
      )}
      {session.passing && (
        <div className="space-y-1">
          <span className="text-gray-500 font-medium">Passing</span>
          <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg p-2">
            <div><p className="text-xs text-gray-400">Attempts</p><p className="font-semibold">{session.passing.attempts}</p></div>
            <div><p className="text-xs text-gray-400">Completed</p><p className="font-semibold">{session.passing.completed}</p></div>
            <div><p className="text-xs text-gray-400">Completion %</p><p className="font-semibold">{formatPercentage(session.passing.completed, session.passing.attempts)}</p></div>
          </div>
          {session.passing.keyPasses > 0 && <p className="text-xs text-gray-400">Key Passes: {session.passing.keyPasses}</p>}
        </div>
      )}
      {session.fitness && (
        <div className="space-y-1">
          <span className="text-gray-500 font-medium">Fitness</span>
          <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg p-2">
            {session.fitness.sprints > 0 && <div><p className="text-xs text-gray-400">Sprints</p><p className="font-semibold">{session.fitness.sprints}</p></div>}
            {session.fitness.distance > 0 && <div><p className="text-xs text-gray-400">Distance</p><p className="font-semibold">{session.fitness.distance} {session.fitness.distanceUnit || 'km'}</p></div>}
            <div><p className="text-xs text-gray-400">RPE</p><p className="font-semibold">{session.fitness.rpe}/10</p></div>
          </div>
        </div>
      )}
      {session.notes && (
        <div>
          <span className="text-gray-500">Notes</span>
          <p className="mt-1 text-gray-700 bg-gray-50 rounded-lg p-2 text-xs">{session.notes}</p>
        </div>
      )}
      {session.mediaLinks?.length > 0 && (
        <div>
          <span className="text-gray-500">Media</span>
          <div className="mt-1 space-y-1.5">
            {session.mediaLinks.map((link, i) => (
              <a key={i} href={link.url} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 text-xs text-accent hover:underline bg-gray-50 rounded-lg px-3 py-2">
                <span>{link.type === 'youtube' ? '▶' : link.type === 'drive' ? '📁' : '🔗'}</span>
                <span className="truncate">{link.label || link.url}</span>
                <svg className="w-3 h-3 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Icons
function DashboardIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : 'currentColor'} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function PlusIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : 'currentColor'} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}
function ListIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : 'currentColor'} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
function SocialIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : 'currentColor'} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}
function CalendarIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : 'currentColor'} strokeWidth={2}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}
function TargetIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : 'currentColor'} strokeWidth={2}>
      <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" />
    </svg>
  );
}
function BrainIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : 'currentColor'} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 2a7 7 0 00-4.6 12.3l.1.1c.4.4.5.9.5 1.4V17a1 1 0 001 1h6a1 1 0 001-1v-1.2c0-.5.2-1 .5-1.4l.1-.1A7 7 0 0012 2z" />
      <path strokeLinecap="round" d="M9 21h6M10 17v1M14 17v1" />
    </svg>
  );
}
function RosterIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : 'currentColor'} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
    </svg>
  );
}

const COACH_TABS = [
  { id: 'roster', label: 'Roster', icon: RosterIcon },
  { id: 'assign', label: 'Assign', icon: CalendarIcon },
  { id: 'overview', label: 'Overview', icon: DashboardIcon },
];

function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default App;
