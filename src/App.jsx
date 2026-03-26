import { useState, useCallback, useRef, useEffect } from 'react';
import { useApiCollection, useApiSingleton, useApiStringList } from './hooks/useApi';
import { Dashboard } from './components/Dashboard';
import { SessionLogger } from './components/SessionLogger';
import { SessionHistory } from './components/SessionHistory';
import { DrillBreakdown } from './components/DrillBreakdown';
import { MatchLogger } from './components/MatchLogger';
import { MatchHistory } from './components/MatchHistory';
import { TrainingCalendar } from './components/TrainingCalendar';
import { BenchmarkTests } from './components/BenchmarkTests';
import { IDPModule } from './components/IDPModule';
import { DecisionJournal } from './components/DecisionJournal';
import { OnboardingFlow } from './components/OnboardingFlow';
import { Toast } from './components/ui/Toast';
import { Button } from './components/ui/Button';
import { Modal, ConfirmModal } from './components/ui/Modal';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { formatDate, formatPercentage, computePersonalRecords, detectNewPRs, PR_LABELS, computeFatigueDecay, diagnoseFatigue } from './utils/stats';

const TABS = [
  { id: 'dashboard', label: 'Home', icon: DashboardIcon },
  { id: 'log', label: 'Log', icon: PlusIcon },
  { id: 'history', label: 'History', icon: ListIcon },
  { id: 'matches', label: 'Matches', icon: TrophyIcon },
  { id: 'plan', label: 'Plan', icon: CalendarIcon },
  { id: 'drills', label: 'Drills', icon: TargetIcon },
  { id: 'idp', label: 'IDP', icon: BrainIcon },
];

function App() {
  // Persistent state (API-backed)
  const [sessions, setSessions, sessionsLoaded] = useApiCollection('/sessions', []);
  const [customDrills, setCustomDrills] = useApiStringList('/custom-drills', []);
  const [settings, setSettings] = useApiSingleton('/settings', { distanceUnit: 'km' });
  const [matches, setMatches] = useApiCollection('/matches', []);
  const [personalRecords, setPersonalRecords] = useApiSingleton('/personal-records', null);
  const [trainingPlans, setTrainingPlans] = useApiCollection('/training-plans', []);
  const [idpGoals, setIdpGoals] = useApiCollection('/idp-goals', []);
  const [decisionJournal, setDecisionJournal] = useApiCollection('/decision-journal', []);
  const [benchmarks, setBenchmarks] = useApiCollection('/benchmarks', []);
  const [templates, setTemplates] = useApiCollection('/templates', []);

  // UI state
  const [activeTab, setActiveTab] = useState('dashboard');
  const [editSession, setEditSession] = useState(null);
  const [viewSession, setViewSession] = useState(null);
  const [editMatch, setEditMatch] = useState(null);
  const [viewMatch, setViewMatch] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showClearDouble, setShowClearDouble] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [matchSubView, setMatchSubView] = useState('history'); // 'history' | 'journal'
  const [drillsSubView, setDrillsSubView] = useState('breakdown'); // 'breakdown' | 'benchmarks'
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

    // PR detection
    setTimeout(() => {
      const records = computePersonalRecords(newSessions);
      const newPRs = detectNewPRs(personalRecords, records);
      setPersonalRecords(records);
      if (newPRs.length > 0) {
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

  // === Match callbacks ===
  const handleSaveMatch = useCallback((match) => {
    setMatches(prev => {
      const existing = prev.findIndex(m => m.id === match.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = match;
        return updated;
      }
      return [...prev, match];
    });
    setEditMatch(null);
    showToast(editMatch?.id ? 'Match updated!' : 'Match saved!');
  }, [setMatches, showToast, editMatch]);

  const handleDeleteMatch = useCallback((id) => {
    setMatches(prev => prev.filter(m => m.id !== id));
    showToast('Match deleted');
  }, [setMatches, showToast]);

  const handleEditMatch = useCallback((match) => {
    setEditMatch(match);
  }, []);

  const handleViewMatch = useCallback((match) => {
    setViewMatch(match);
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
      a.download = `nxtply-${new Date().toISOString().split('T')[0]}.json`;
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

  const handleSaveBenchmark = useCallback((benchmark) => {
    setBenchmarks(prev => [...prev, benchmark]);
  }, [setBenchmarks]);

  const handleAddCustomDrill = useCallback((name) => {
    setCustomDrills(prev => [...prev, name]);
  }, [setCustomDrills]);

  const toggleUnit = useCallback(() => {
    setSettings(prev => ({ ...prev, distanceUnit: prev.distanceUnit === 'km' ? 'mi' : 'km' }));
  }, [setSettings]);

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId !== 'log') setEditSession(null);
    if (tabId !== 'matches') { setEditMatch(null); setMatchSubView('history'); }
    if (tabId !== 'drills') { setDrillsSubView('breakdown'); }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20 md:pb-4">
      <OfflineIndicator />
      {/* Header */}
      <header className="bg-white border-b border-gray-100 shadow-card sticky top-0 z-30" role="banner">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-bold text-accent">NXTPLY</h1>
          <Button variant="ghost" onClick={() => setShowSettings(true)} aria-label="Settings"><SettingsIcon /></Button>
        </div>
        <nav className="hidden md:flex max-w-3xl mx-auto px-4 gap-1" aria-label="Main navigation">
          {TABS.map(tab => (
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
              setSettings(prev => ({ ...prev, ...data }));
              setActiveTab('log');
            }}
          />
        ) : (
        <>
        <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
          <Dashboard sessions={sessions} matches={matches} personalRecords={personalRecords} onViewSession={handleViewSession} decisionJournal={decisionJournal} idpGoals={idpGoals} weeklyGoal={settings.weeklyGoal ?? 3} ageGroup={settings.ageGroup} skillLevel={settings.skillLevel} onOpenSettings={() => setShowSettings(true)} onNavigateToLog={() => setActiveTab('log')} />
        </div>
        <div className={activeTab === 'log' ? '' : 'hidden'}>
          <SessionLogger onSave={handleSaveSession} editSession={editSession} customDrills={customDrills} onAddCustomDrill={handleAddCustomDrill} distanceUnit={settings.distanceUnit} templates={templates} setTemplates={setTemplates} idpGoals={idpGoals} />
        </div>
        <div className={activeTab === 'history' ? '' : 'hidden'}>
          <SessionHistory sessions={sessions} customDrills={customDrills} onEdit={handleEditSession} onDelete={handleDeleteSession} onView={handleViewSession} />
        </div>
        <div className={activeTab === 'matches' ? '' : 'hidden'}>
          {editMatch !== null ? (
            <MatchLogger onSave={handleSaveMatch} editMatch={editMatch} onCancel={() => setEditMatch(null)} />
          ) : (
            <>
              <div className="flex gap-2 mb-4">
                <button onClick={() => setMatchSubView('history')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${matchSubView === 'history' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Match History
                </button>
                <button onClick={() => setMatchSubView('journal')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${matchSubView === 'journal' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  Decision Journal
                </button>
              </div>
              {matchSubView === 'history' ? (
                <MatchHistory matches={matches} onEdit={handleEditMatch} onDelete={handleDeleteMatch} onView={handleViewMatch} onNewMatch={() => setEditMatch({})} />
              ) : (
                <DecisionJournal entries={decisionJournal} onSaveEntries={setDecisionJournal} />
              )}
            </>
          )}
        </div>
        <div className={activeTab === 'plan' ? '' : 'hidden'}>
          <TrainingCalendar plans={trainingPlans} sessions={sessions} customDrills={customDrills} onSavePlan={handleSavePlan} onDeletePlan={handleDeletePlan} />
        </div>
        <div className={activeTab === 'drills' ? '' : 'hidden'}>
          <div className="flex gap-2 mb-4">
            <button onClick={() => setDrillsSubView('breakdown')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${drillsSubView === 'breakdown' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Drill Breakdown
            </button>
            <button onClick={() => setDrillsSubView('benchmarks')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${drillsSubView === 'benchmarks' ? 'bg-accent text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Benchmarks
            </button>
          </div>
          {drillsSubView === 'breakdown' ? (
            <DrillBreakdown sessions={sessions} customDrills={customDrills} />
          ) : (
            <BenchmarkTests benchmarks={benchmarks} onSaveBenchmark={handleSaveBenchmark} />
          )}
        </div>
        <div className={activeTab === 'idp' ? '' : 'hidden'}>
          <IDPModule goals={idpGoals} onSaveGoals={setIdpGoals} sessions={sessions} />
        </div>
        </>
        )}
      </main>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-card z-30" aria-label="Main navigation">
        <div className="flex">
          {TABS.map(tab => (
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
        {viewSession && <SessionDetail session={viewSession} />}
      </Modal>

      {/* Match Detail Modal */}
      <Modal
        open={!!viewMatch}
        onClose={() => setViewMatch(null)}
        title={viewMatch ? `Match \u2014 ${formatDate(viewMatch.date)}` : ''}
        actions={
          <>
            <Button variant="secondary" onClick={() => setViewMatch(null)}>Close</Button>
            <Button onClick={() => { handleEditMatch(viewMatch); setViewMatch(null); }}>Edit</Button>
          </>
        }
      >
        {viewMatch && (
          <>
            <MatchDetail match={viewMatch} />
            <div className="mt-4 pt-4 border-t border-gray-100">
              <DecisionJournal
                entries={decisionJournal}
                onSaveEntries={setDecisionJournal}
                matchId={viewMatch.id}
                matchLabel={`vs ${viewMatch.opponent}`}
              />
            </div>
          </>
        )}
      </Modal>

      {/* Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title="Settings & Data"
        actions={<Button variant="secondary" onClick={() => setShowSettings(false)}>Close</Button>}
      >
        <div className="space-y-4">
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
          <hr className="border-gray-100" />
          <div className="space-y-2">
            <Button variant="secondary" onClick={handleExport} className="w-full" disabled={exporting}>
              {exporting ? 'Exporting...' : 'Export as JSON'}
            </Button>
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()} className="w-full">Import JSON</Button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            <Button variant="danger" onClick={() => setShowClearConfirm(true)} className="w-full">Clear All Data</Button>
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
      {session.bodyCheck && (
        <div className="space-y-1">
          <span className="text-gray-500 font-medium">Body Check</span>
          <div className={`grid ${session.bodyCheck.hrv != null ? 'grid-cols-5' : 'grid-cols-4'} gap-2 text-center bg-gray-50 rounded-lg p-2`}>
            <div><p className="text-xs text-gray-400">Sleep</p><p className="font-semibold">{session.bodyCheck.sleepHours}h</p></div>
            {session.bodyCheck.hrv != null && (
              <div><p className="text-xs text-gray-400">HRV</p><p className={`font-semibold ${session.bodyCheck.hrv >= 60 ? 'text-green-600' : session.bodyCheck.hrv >= 40 ? 'text-amber-600' : 'text-red-500'}`}>{session.bodyCheck.hrv}ms</p></div>
            )}
            <div><p className="text-xs text-gray-400">Hydration</p><p className="font-semibold">{session.bodyCheck.hydration}/5</p></div>
            <div><p className="text-xs text-gray-400">Energy</p><p className="font-semibold">{session.bodyCheck.energy}/5</p></div>
            <div><p className="text-xs text-gray-400">Soreness</p><p className="font-semibold">{session.bodyCheck.soreness}/5</p></div>
          </div>
          {session.bodyCheck.injuryNotes && (
            <p className="text-xs text-red-500">Injury: {session.bodyCheck.injuryNotes}</p>
          )}
        </div>
      )}
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
      {session.delivery?.entries?.length > 0 && (
        <div className="space-y-1">
          <span className="text-gray-500 font-medium">Deliveries</span>
          <div className="space-y-1">
            {session.delivery.entries.map((e, i) => (
              <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2 py-1.5 text-xs">
                <span className="font-medium capitalize">{e.type?.replace('-', ' ')}</span>
                <span className="text-gray-400">{e.targetZone?.replace('-', ' ')}</span>
                <span className={`ml-auto font-medium ${e.quality === 'perfect' ? 'text-green-600' : e.quality === 'usable' ? 'text-amber-600' : 'text-red-500'}`}>
                  {e.quality}
                </span>
              </div>
            ))}
          </div>
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
      {/* Phase Breakdown */}
      {(session.shooting?.phases || session.passing?.phases || session.fitness?.phases) && (
        <div className="space-y-1">
          <span className="text-gray-500 font-medium">Phase Breakdown</span>
          {session.shooting?.phases && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Shooting by Phase</p>
              <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 rounded-lg p-2">
                {['early', 'mid', 'late'].map(phase =>
                  session.shooting.phases[phase] && (
                    <div key={phase}>
                      <p className="text-xs text-gray-400 capitalize">{phase}</p>
                      <p className="font-semibold text-sm">
                        {session.shooting.phases[phase].goals}/{session.shooting.phases[phase].shots}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatPercentage(session.shooting.phases[phase].goals, session.shooting.phases[phase].shots)}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
          {session.passing?.phases && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Passing by Phase</p>
              <div className="grid grid-cols-2 gap-2 text-center bg-gray-50 rounded-lg p-2">
                {['early', 'late'].map(phase =>
                  session.passing.phases[phase] && (
                    <div key={phase}>
                      <p className="text-xs text-gray-400 capitalize">{phase}</p>
                      <p className="font-semibold text-sm">
                        {session.passing.phases[phase].completed}/{session.passing.phases[phase].attempts}
                      </p>
                      <p className="text-xs text-gray-500">
                        {formatPercentage(session.passing.phases[phase].completed, session.passing.phases[phase].attempts)}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
          {session.fitness?.phases && (
            <div>
              <p className="text-xs text-gray-400 mb-1">Sprint Quality by Phase</p>
              <div className="grid grid-cols-2 gap-2 text-center bg-gray-50 rounded-lg p-2">
                {['early', 'late'].map(phase =>
                  session.fitness.phases[phase] && (
                    <div key={phase}>
                      <p className="text-xs text-gray-400 capitalize">{phase}</p>
                      <p className="font-semibold text-sm">{session.fitness.phases[phase].sprintQuality}/5</p>
                    </div>
                  )
                )}
              </div>
            </div>
          )}
          {(() => {
            const decay = computeFatigueDecay(session);
            const diagnosis = diagnoseFatigue(session);
            if (!decay) return null;
            const clr = decay.score >= 80 ? 'text-green-600' : decay.score >= 60 ? 'text-amber-600' : 'text-red-500';
            return (
              <div className="bg-gray-50 rounded-lg p-2 mt-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Fatigue Decay Score</span>
                  <span className={`text-sm font-bold ${clr}`}>{decay.score}/100</span>
                </div>
                {diagnosis && (
                  <p className="text-xs text-gray-500 mt-1"><strong>{diagnosis.label}:</strong> {diagnosis.message}</p>
                )}
              </div>
            );
          })()}
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

function MatchDetail({ match }) {
  const resultColors = { W: 'text-green-600', D: 'text-yellow-600', L: 'text-red-600' };
  const resultLabels = { W: 'Win', D: 'Draw', L: 'Loss' };
  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between">
        <span className="text-gray-500">vs {match.opponent}</span>
        <span className={`font-bold ${resultColors[match.result]}`}>{resultLabels[match.result]}</span>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center bg-gray-50 rounded-lg p-2">
        <div><p className="text-xs text-gray-400">Minutes</p><p className="font-semibold">{match.minutesPlayed}</p></div>
        <div><p className="text-xs text-gray-400">Goals</p><p className="font-semibold">{match.goals}</p></div>
        <div><p className="text-xs text-gray-400">Assists</p><p className="font-semibold">{match.assists}</p></div>
        <div><p className="text-xs text-gray-400">Rating</p><p className="font-semibold">{match.rating}/10</p></div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center bg-gray-50 rounded-lg p-2">
        <div><p className="text-xs text-gray-400">Shots</p><p className="font-semibold">{match.shots}</p></div>
        <div><p className="text-xs text-gray-400">Passes</p><p className="font-semibold">{match.passesCompleted}</p></div>
      </div>
      {match.notes && (
        <div>
          <span className="text-gray-500">Notes</span>
          <p className="mt-1 text-gray-700 bg-gray-50 rounded-lg p-2 text-xs">{match.notes}</p>
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
function TrophyIcon({ active }) {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={active ? '#1E3A5F' : 'currentColor'} strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 21h8m-4-4v4m-4.5-8.5c-.83-.71-1.5-2-1.5-3.5V4h12v5c0 1.5-.67 2.79-1.5 3.5M7 4H4v3a3 3 0 003 3m10-6h3v3a3 3 0 01-3 3" />
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
function SettingsIcon() {
  return (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

export default App;
