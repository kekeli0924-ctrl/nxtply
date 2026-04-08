import { useState, useCallback, useRef, useEffect } from 'react';
import { useApiCollection, useApiSingleton, useApiStringList, getToken, clearTokens } from './hooks/useApi';
import { AuthScreen, SignupForm } from './components/AuthScreen';
import { IntroFlow } from './components/IntroFlow';
import { ScoutingPage } from './features/scouting/ScoutingPage';
import { MetricTrendView } from './components/MetricTrendView';
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
import { PlanWeekView } from './components/PlanWeekView';
import { StreakXPCard } from './components/StreakXPCard';
import { LiveSessionMode } from './components/LiveSessionMode';
import { CameraSetup } from './components/CameraSetup';
import { ReadinessCheck, AdaptedPlanConfirm } from './components/ReadinessCheck';
import { ProgramsSection } from './components/ProgramsSection';
import { AskComposed } from './components/AskComposed';
import { SessionCompleteScreen } from './components/SessionCompleteScreen';
import { SessionComments } from './components/SessionComments';
import { ParentDashboard } from './components/ParentDashboard';
import { Toast } from './components/ui/Toast';
import { Button } from './components/ui/Button';
import { Modal, ConfirmModal } from './components/ui/Modal';
import { OfflineIndicator } from './components/ui/OfflineIndicator';
import { formatDate, formatPercentage, computePersonalRecords, detectNewPRs, PR_LABELS, getStreak } from './utils/stats';
import { computeXP, getLevel, getLevelProgress } from './utils/gamification';
import { getNewBadges } from './utils/gamification';

const PLAYER_TABS = [
  { id: 'dashboard', label: 'Home', icon: DashboardIcon },
  { id: 'plan', label: 'Plan', icon: CalendarIcon },
  { id: 'drills', label: 'Drills', icon: TargetIcon },
  { id: 'social', label: 'Community', icon: SocialIcon },
];

// COACH_TABS defined after icon functions below

function App() {
  // ── Auth state ──────────────────────────────
  const [authUser, setAuthUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [authFlow, setAuthFlow] = useState('check'); // 'check' | 'login' | 'onboarding' | 'signup' | 'done'
  const [onboardingData, setOnboardingData] = useState(null); // Data collected during onboarding (role, name, etc.)

  // Check for existing token on mount
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthChecked(true);
      const hasSeenIntro = localStorage.getItem('composed_intro_seen');
      setAuthFlow(hasSeenIntro ? 'login' : 'intro');
      return;
    }
    fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(user => {
        if (user) {
          setAuthUser(user);
          setAuthFlow('done');
        } else {
          clearTokens();
          setAuthFlow('login');
        }
        setAuthChecked(true);
      })
      .catch(() => { clearTokens(); setAuthChecked(true); setAuthFlow('login'); });
  }, []);

  // Listen for auth failures from useApi (expired tokens)
  useEffect(() => {
    const handler = () => { setAuthUser(null); clearTokens(); setAuthFlow('login'); };
    window.addEventListener('auth-failure', handler);
    return () => window.removeEventListener('auth-failure', handler);
  }, []);

  const handleLogout = useCallback(() => {
    clearTokens();
    setAuthUser(null);
    setAuthFlow('login');
  }, []);

  // Loading check
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-accent font-logo italic">Composed</h1>
          <p className="text-xs text-gray-400 mt-2">Loading...</p>
        </div>
      </div>
    );
  }

  // Step 0: Pre-auth intro flow (first-time visitors only)
  if (authFlow === 'intro') {
    return (
      <IntroFlow onComplete={() => {
        localStorage.setItem('composed_intro_seen', '1');
        setAuthFlow('login');
      }} />
    );
  }

  // Step 1: Login screen (existing users) with "I'm a New User" button
  if (authFlow === 'login') {
    return (
      <AuthScreen
        onAuthSuccess={(user) => { setAuthUser(user); setAuthFlow('done'); }}
        onNewUser={() => setAuthFlow('onboarding')}
      />
    );
  }

  // Step 2: Onboarding flow (new users — BEFORE signup)
  if (authFlow === 'onboarding') {
    return (
      <div className="min-h-screen bg-gray-50">
        <OnboardingFlow
          settings={{ distanceUnit: 'km' }}
          onComplete={(data) => {
            setOnboardingData(data);
            setAuthFlow('signup');
          }}
        />
      </div>
    );
  }

  // Step 3: Signup form (after onboarding, creates the account)
  if (authFlow === 'signup') {
    return (
      <div className="min-h-screen bg-gray-50">
        <SignupForm
          onSignupSuccess={async (user) => {
            setAuthUser(user);
            // Save onboarding data to settings now that we have a real account
            if (onboardingData) {
              const token = getToken();
              const { role, ...settingsData } = onboardingData;
              // Update role
              if (role && token) {
                try {
                  await fetch('/api/auth/role', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ role }),
                  });
                } catch { /* ignore */ }
              }
              // Save settings
              if (token) {
                try {
                  await fetch('/api/settings', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(settingsData),
                  });
                } catch { /* ignore */ }
              }
            }
            setAuthFlow('done');
          }}
          onBack={() => setAuthFlow('onboarding')}
        />
      </div>
    );
  }

  // Step 4: Main app (authenticated)
  if (authFlow === 'done' && authUser) {
    return <AppMain authUser={authUser} onLogout={handleLogout} />;
  }

  return null;
}

function AppMain({ authUser, onLogout }) {
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
  const [activeProgram, setActiveProgram] = useState(null);

  // Fetch coach info + active program
  useEffect(() => {
    fetch('/api/programs/active', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(d => setActiveProgram(d?.program ? d : null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/roster/my-coach', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(setMyCoach)
      .catch(() => {});
  }, []);

  // Role state
  const [userRole, setUserRole] = useState(authUser.role || 'player');

  // Role is now read from JWT token — no need for window global

  // Fetch assigned plans for players (poll every 30s for coach updates)
  useEffect(() => {
    if (userRole === 'coach') return;
    const fetchPlans = () => {
      fetch('/api/assigned-plans', { headers: { Authorization: `Bearer ${getToken()}` } })
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
  const [previousTab, setPreviousTab] = useState('dashboard');
  const [selectedCoachPlayer, setSelectedCoachPlayer] = useState(null);
  const [editSession, setEditSession] = useState(null);
  const [viewSession, setViewSession] = useState(null);
  const [toast, setToast] = useState({ show: false, message: '', variant: 'success' });
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);
  const [pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');
  const [pwError, setPwError] = useState('');
  const [pwLoading, setPwLoading] = useState(false);
  const [showClearDouble, setShowClearDouble] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef(null);

  // Parent-specific state
  const [parentChildren, setParentChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState(null);
  const [parentDashboard, setParentDashboard] = useState(null);
  const [parentAccessCode, setParentAccessCode] = useState(null);
  const [parentConnectedList, setParentConnectedList] = useState([]);
  const [parentVisibility, setParentVisibility] = useState({ showRatings: true, showCoachFeedback: true, showIdpGoals: true });

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

  // === Parent data fetching ===
  const isParent = userRole === 'parent';

  const fetchParentChildren = useCallback(() => {
    if (!isParent) return;
    fetch('/api/parent/children', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(kids => {
        setParentChildren(kids);
        if (kids.length > 0 && !selectedChildId) setSelectedChildId(kids[0].playerId);
      })
      .catch(() => {});
  }, [isParent, selectedChildId]);

  useEffect(() => { fetchParentChildren(); }, [fetchParentChildren]);

  useEffect(() => {
    if (!isParent || !selectedChildId) return;
    fetch(`/api/parent/dashboard/${selectedChildId}`, { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : null)
      .then(setParentDashboard)
      .catch(() => {});
  }, [isParent, selectedChildId]);

  // Fetch parent access data for player profile
  const fetchParentAccess = useCallback(() => {
    if (isParent || userRole === 'coach') return;
    fetch('/api/parent/my-parents', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : [])
      .then(setParentConnectedList)
      .catch(() => {});
    fetch('/api/parent/visibility-settings', { headers: { Authorization: `Bearer ${getToken()}` } })
      .then(r => r.ok ? r.json() : { showRatings: true, showCoachFeedback: true, showIdpGoals: true })
      .then(setParentVisibility)
      .catch(() => {});
  }, [isParent, userRole]);

  useEffect(() => { fetchParentAccess(); }, [fetchParentAccess]);

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

      const badge = badges.length > 0 ? badges[0] : null;

      if (editSession) {
        // Editing — just show toast
        if (badge) showToast(`${badge.icon} Badge unlocked: ${badge.name}!`);
        else if (newPRs.length > 0) showToast(`New PR: ${PR_LABELS[newPRs[0]]}!`);
        else showToast('Session updated!');
      } else {
        // New session — fetch with insights and compute completionData
        fetch(`/api/sessions/${session.id}`)
          .then(r => r.ok ? r.json() : session)
          .then(fullSession => {
            // Find previous training session
            const prevTraining = prevSessions
              .filter(s => s.session_type !== 'match' && s.id !== session.id)
              .sort((a, b) => b.date.localeCompare(a.date))[0] || null;

            const prevShot = prevTraining?.shooting;
            const prevPass = prevTraining?.passing;

            // XP breakdown
            const streak = getStreak(newSessions);
            const xpSession = 25;
            // Check if this session completed a daily plan (user plan or coach-assigned)
            const sessionDate = session.date;
            const hadPlan = trainingPlans.some(p => p.date === sessionDate) || assignedPlans.some(p => p.date === sessionDate);
            const xpDailyPlan = hadPlan ? 50 : 0;
            const xpStreak = streak > 0 ? 10 : 0;
            const xpDuration = (session.duration || 0) >= 60 ? 10 : 0;
            const xpPR = newPRs.length * 100;
            const totalXP = xpSession + xpDailyPlan + xpStreak + xpDuration + xpPR;

            const allXP = computeXP(newSessions);
            const level = getLevel(allXP);
            const prevLevel = getLevel(computeXP(prevSessions));
            const levelProgress = getLevelProgress(allXP);

            // Streak milestones
            const milestones = [30, 14, 7, 3];
            const hitMilestone = milestones.find(m => streak >= m && getStreak(prevSessions) < m);

            // Tomorrow's plan
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];
            const tPlan = trainingPlans.find(p => p.date === tomorrowStr)
              || assignedPlans.find(p => p.date === tomorrowStr);

            // Weekly goal
            const now = new Date();
            const dayOfWeek = now.getDay();
            const mondayOff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
            const monday = new Date(now);
            monday.setDate(now.getDate() + mondayOff);
            const mondayStr = monday.toISOString().split('T')[0];
            const weekCompleted = newSessions.filter(s => s.date >= mondayStr).length;
            const wGoal = settings.weeklyGoal ?? 3;

            // PR details
            const prDetails = newPRs.map(key => ({
              metric: PR_LABELS[key] || key,
              newValue: records[key]?.value != null ? String(records[key].value) : '—',
              previousValue: personalRecords?.[key]?.value != null ? String(personalRecords[key].value) : null,
            }));

            setCompletedSession(fullSession);
            setCompletedBadge(badge);
            setCompletionData({
              previousSession: prevTraining ? {
                duration: prevTraining.duration,
                shotAccuracy: prevShot?.shotsTaken > 0 ? Math.round((prevShot.goals / prevShot.shotsTaken) * 100) : null,
                passAccuracy: prevPass?.attempts > 0 ? Math.round((prevPass.completed / prevPass.attempts) * 100) : null,
                drillCount: (prevTraining.drills || []).length,
                date: prevTraining.date,
              } : null,
              isFirstSession: prevSessions.length === 0,
              xpBreakdown: {
                sessionLogged: xpSession,
                dailyPlan: xpDailyPlan,
                streakBonus: xpStreak,
                durationBonus: xpDuration,
                personalRecord: xpPR,
              },
              totalXP,
              newLevel: level > prevLevel ? level : null,
              levelProgress: { ...levelProgress, level },
              badgesUnlocked: badges,
              personalRecords: prDetails,
              streak: {
                current: streak,
                isNewMilestone: !!hitMilestone,
                milestone: hitMilestone || null,
              },
              tomorrowPlan: tPlan ? {
                exists: true,
                drills: tPlan.drills || [],
                duration: tPlan.targetDuration || 0,
              } : { exists: false, drills: [], duration: 0 },
              weeklyGoal: {
                target: wGoal,
                completed: weekCompleted,
                met: weekCompleted >= wGoal,
              },
            });
          })
          .catch(() => {
            if (badge) showToast(`${badge.icon} Badge unlocked: ${badge.name}!`);
            else showToast('Session saved!');
          });
      }
    }, 0);

    setEditSession(null);
    if (editSession) setActiveTab('dashboard');
  }, [setSessions, showToast, editSession, personalRecords, setPersonalRecords, trainingPlans, assignedPlans, settings.weeklyGoal]);

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
  const [completedSession, setCompletedSession] = useState(null);
  const [completionData, setCompletionData] = useState(null);
  const [showAIChat, setShowAIChat] = useState(false); // Session just saved, show complete screen
  const [completedBadge, setCompletedBadge] = useState(null);
  const [readinessCheckPlan, setReadinessCheckPlan] = useState(null); // Plan awaiting readiness check
  const [adaptedPlan, setAdaptedPlan] = useState(null); // Plan after readiness adaptation
  const [showCameraSetup, setShowCameraSetup] = useState(false);
  const [recordingMode, setRecordingMode] = useState(false);
  const [cameraStream, setCameraStream] = useState(null);

  const handleStartPlan = useCallback((plan) => {
    // Start readiness check flow → adapted confirmation → live mode
    setReadinessCheckPlan(plan);
  }, []);

  const handleReadinessComplete = useCallback((adapted, answers) => {
    setReadinessCheckPlan(null);
    setAdaptedPlan(adapted);
  }, []);

  const handleReadinessSkip = useCallback(() => {
    const plan = readinessCheckPlan;
    setReadinessCheckPlan(null);
    setLivePlan(plan);
    if (window.__SKIP_CAMERA__) {
      window.__SKIP_CAMERA__ = false;
      setShowCameraSetup(false);
      setRecordingMode(false);
    } else {
      setShowCameraSetup(true);
    }
  }, [readinessCheckPlan]);

  const handleAdaptedStart = useCallback(() => {
    const plan = adaptedPlan;
    setAdaptedPlan(null);
    setLivePlan(plan);
    // Check if user chose "Start without Recording"
    if (window.__SKIP_CAMERA__) {
      window.__SKIP_CAMERA__ = false;
      setShowCameraSetup(false);
      setRecordingMode(false);
    } else {
      setShowCameraSetup(true);
    }
  }, [adaptedPlan]);

  const handleAdaptedChange = useCallback(() => {
    // Go back to readiness check
    setAdaptedPlan(null);
    setReadinessCheckPlan(adaptedPlan);
  }, [adaptedPlan]);

  const handleStartManual = useCallback((plan) => {
    setEditSession(null);
    setActiveTab('log');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('prefill-session', { detail: plan }));
    }, 100);
  }, []);

  const handleUploadVideo = useCallback(() => {
    setEditSession(null);
    setActiveTab('log');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('show-video-upload'));
    }, 100);
  }, []);

  // Metric detail view
  const [selectedMetric, setSelectedMetric] = useState(null);
  const handleViewMetric = useCallback((metricId) => {
    setSelectedMetric(metricId);
    setPreviousTab(activeTab);
    setActiveTab('metric-detail');
  }, [activeTab]);

  // Quick save from video analysis (auto-save without full form)
  const handleQuickSaveFromVideo = useCallback((result) => {
    const session = {
      id: crypto.randomUUID(),
      date: new Date().toISOString().split('T')[0],
      duration: result.duration || 0,
      drills: result.drills || [],
      notes: result.notes || '',
      sessionType: result.sessionType || 'Training',
      position: settings.position || 'General',
      quickRating: result.quickRating || 3,
      shooting: result.shooting || null,
      passing: result.passing || null,
      fitness: result.fitness || null,
    };
    // Save via the existing session save flow
    handleSaveSession(session);
  }, [handleSaveSession, settings.position]);

  // Camera setup handlers
  const handleCameraStart = useCallback((stream, withRecording) => {
    setShowCameraSetup(false);
    setRecordingMode(withRecording);
    setCameraStream(stream);
  }, []);

  const handleCameraSkip = useCallback(() => {
    setShowCameraSetup(false);
    setRecordingMode(false);
    setCameraStream(null);
  }, []);

  const handleLiveComplete = useCallback((prefillData) => {
    setLivePlan(null);
    setRecordingMode(false);
    setShowCameraSetup(false);
    // Release camera stream
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
    setEditSession(null);
    setActiveTab('log');
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('prefill-session', { detail: prefillData }));
    }, 100);
  }, [cameraStream]);

  const handleLiveExit = useCallback(() => {
    setLivePlan(null);
    setRecordingMode(false);
    setShowCameraSetup(false);
    if (cameraStream) {
      cameraStream.getTracks().forEach(t => t.stop());
      setCameraStream(null);
    }
  }, [cameraStream]);

  // Navigate to a pseudo-tab (history, profile) — stores previous tab for back navigation
  const navigateToTab = useCallback((tabId) => {
    setPreviousTab(activeTab);
    setActiveTab(tabId);
    if (tabId !== 'log') setEditSession(null);
  }, [activeTab]);

  const handleTabClick = (tabId) => {
    setPreviousTab(activeTab);
    setActiveTab(tabId);
    if (tabId !== 'log') setEditSession(null);
    // Refresh assigned plans when going to dashboard
    if (tabId === 'dashboard' && userRole !== 'coach') {
      fetch('/api/assigned-plans', { headers: { Authorization: `Bearer ${getToken()}` } })
        .then(r => r.ok ? r.json() : [])
        .then(setAssignedPlans)
        .catch(() => {});
    }
  };

  const isOnboarding = false; // Onboarding now happens before signup in App()

  return (
    <div className={`min-h-screen bg-gray-50 ${isOnboarding ? '' : 'pb-20 md:pb-4'}`}>
      {/* Readiness Check → Adapted Plan → Live Session Mode */}
      {readinessCheckPlan && (
        <ReadinessCheck plan={readinessCheckPlan} onComplete={handleReadinessComplete} onSkip={handleReadinessSkip} />
      )}
      {adaptedPlan && (
        <AdaptedPlanConfirm plan={adaptedPlan} onStart={handleAdaptedStart} onChange={handleAdaptedChange} />
      )}
      <OfflineIndicator />
      {/* Header */}
      <header className={`bg-white border-b border-gray-100 shadow-card sticky top-0 z-30 ${isOnboarding ? 'hidden' : ''}`} role="banner">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="w-5" />
          <button onClick={() => navigateToTab('profile')} aria-label="Profile" className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent">
            {settings.playerName ? settings.playerName[0]?.toUpperCase() : '⚽'}
          </button>
        </div>
        <nav className={`hidden md:flex max-w-3xl mx-auto px-4 gap-1 ${isParent ? '!hidden' : ''}`} aria-label="Main navigation">
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
        {completedSession ? (
          <SessionCompleteScreen
            session={completedSession}
            completionData={completionData}
            onDone={() => { setCompletedSession(null); setCompletedBadge(null); setCompletionData(null); setActiveTab('dashboard'); }}
          />
        ) : isParent ? (
          activeTab === 'profile' ? (
            <div className="space-y-5 max-w-3xl mx-auto">
              {/* Back button */}
              <button
                onClick={() => setActiveTab(previousTab || 'parent-dashboard')}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </button>

              {/* Parent Profile Header */}
              <div className="text-center">
                <div className="w-20 h-20 rounded-full bg-accent/10 mx-auto flex items-center justify-center text-3xl">
                  {settings.playerName ? settings.playerName[0]?.toUpperCase() : '👤'}
                </div>
                <h2 className="text-lg font-bold text-gray-900 mt-3">{settings.playerName || 'Parent'}</h2>
                <p className="text-xs text-gray-400">Parent Account</p>
              </div>

              <hr className="border-gray-100" />

              {/* Connected Children */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Connected Children</p>
                {parentChildren.length === 0 ? (
                  <p className="text-xs text-gray-300">No children connected yet. Enter an invite code on your dashboard.</p>
                ) : (
                  <div className="space-y-2">
                    {parentChildren.map(child => (
                      <div key={child.playerId} className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{child.name}</p>
                          <p className="text-[10px] text-gray-400">Connected {child.acceptedAt ? new Date(child.acceptedAt).toLocaleDateString() : ''}</p>
                        </div>
                        <button
                          onClick={async () => {
                            try {
                              await fetch(`/api/parent/disconnect/${child.linkId}`, {
                                method: 'DELETE',
                                headers: { Authorization: `Bearer ${getToken()}` },
                              });
                              fetchParentChildren();
                              showToast('Disconnected');
                            } catch { showToast('Failed', 'error'); }
                          }}
                          className="text-xs text-red-500 hover:underline"
                        >
                          Disconnect
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {parentChildren.length < 3 && (
                  <p className="text-[10px] text-gray-300">You can connect up to 3 children.</p>
                )}
              </div>

              <hr className="border-gray-100" />

              {/* Notification Preferences */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Notifications</p>
                <label className="flex items-center justify-between">
                  <span className="text-sm text-gray-700">Weekly training digest</span>
                  <input
                    type="checkbox"
                    defaultChecked={true}
                    className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                  />
                </label>
                <p className="text-[10px] text-gray-400">Receive a weekly summary of your child's training every Sunday.</p>
              </div>

              <hr className="border-gray-100" />

              {/* Account Settings */}
              <div className="space-y-3">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Account</p>
                <div className="space-y-2">
                  {!showPasswordChange ? (
                    <Button variant="secondary" className="w-full" onClick={() => setShowPasswordChange(true)}>Change Password</Button>
                  ) : (
                    <div className="space-y-2 bg-gray-50 rounded-lg p-3">
                      <input type="password" placeholder="Current password" value={pwCurrent} onChange={e => setPwCurrent(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                      <input type="password" placeholder="New password (8+ chars)" value={pwNew} onChange={e => setPwNew(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                      <input type="password" placeholder="Confirm new password" value={pwConfirm} onChange={e => setPwConfirm(e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30" />
                      {pwError && <p className="text-xs text-red-500">{pwError}</p>}
                      <div className="flex gap-2">
                        <Button variant="secondary" className="flex-1" onClick={() => { setShowPasswordChange(false); setPwError(''); setPwCurrent(''); setPwNew(''); setPwConfirm(''); }}>Cancel</Button>
                        <Button className="flex-1" disabled={pwLoading} onClick={async () => {
                          setPwError('');
                          if (!pwCurrent || !pwNew) { setPwError('All fields required'); return; }
                          if (pwNew !== pwConfirm) { setPwError('Passwords do not match'); return; }
                          if (pwNew.length < 8) { setPwError('Min 8 characters'); return; }
                          setPwLoading(true);
                          try {
                            const token = getToken();
                            const res = await fetch('/api/auth/password', {
                              method: 'PUT',
                              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                              body: JSON.stringify({ currentPassword: pwCurrent, newPassword: pwNew }),
                            });
                            const data = await res.json();
                            if (!res.ok) { setPwError(data.error || 'Failed'); setPwLoading(false); return; }
                            showToast('Password changed');
                            setShowPasswordChange(false); setPwCurrent(''); setPwNew(''); setPwConfirm('');
                          } catch { setPwError('Failed to change password'); }
                          setPwLoading(false);
                        }}>{pwLoading ? '...' : 'Save'}</Button>
                      </div>
                    </div>
                  )}
                  <Button variant="secondary" className="w-full" onClick={onLogout}>Log Out</Button>
                  <Button variant="danger" className="w-full" onClick={() => setShowClearConfirm(true)}>Delete Account</Button>
                </div>
              </div>
            </div>
          ) : (
            <ParentDashboard
              dashboardData={parentDashboard}
              children={parentChildren}
              selectedChild={selectedChildId}
              onSelectChild={(id) => { setSelectedChildId(id); setParentDashboard(null); }}
              onConnectCode={() => { fetchParentChildren(); }}
            />
          )
        ) : (
        <>
        <div className={activeTab === 'dashboard' ? '' : 'hidden'}>
          <Dashboard sessions={sessions} personalRecords={personalRecords} onViewSession={handleViewSession} idpGoals={idpGoals} weeklyGoal={settings.weeklyGoal ?? 3} ageGroup={settings.ageGroup} skillLevel={settings.skillLevel} onOpenSettings={() => navigateToTab('profile')} onNavigateToLog={() => setActiveTab('log')} onStartPlan={handleStartPlan} onStartManual={handleStartManual} onUploadVideo={handleUploadVideo} onViewMetric={handleViewMetric} assignedPlans={assignedPlans} trainingPlans={trainingPlans} settings={settings} myCoach={myCoach} onNavigate={navigateToTab} onDismissGettingStarted={() => setSettings(prev => ({ ...prev, gettingStartedComplete: 1 }))} activeProgram={activeProgram} />
        </div>
        <div className={activeTab === 'log' ? '' : 'hidden'}>
          <SessionLogger onSave={handleSaveSession} onQuickSaveVideo={handleQuickSaveFromVideo} editSession={editSession} customDrills={customDrills} onAddCustomDrill={handleAddCustomDrill} distanceUnit={settings.distanceUnit} templates={templates} setTemplates={setTemplates} idpGoals={idpGoals} sessions={sessions} />
        </div>
        <div className={activeTab === 'history' ? '' : 'hidden'}>
          <SessionHistory sessions={sessions} customDrills={customDrills} onEdit={handleEditSession} onDelete={handleDeleteSession} onView={handleViewSession} onBack={() => setActiveTab(previousTab)} />
        </div>
        <div className={activeTab === 'plan' ? '' : 'hidden'}>
          <PlanWeekView
            plans={trainingPlans} sessions={sessions} assignedPlans={assignedPlans}
            activeProgram={activeProgram} weeklyGoal={settings.weeklyGoal ?? 3}
            onStartPlan={handleStartPlan} onStartManual={handleStartManual}
            onSavePlan={handleSavePlan} onDeletePlan={handleDeletePlan}
            customDrills={customDrills} onNavigatePrograms={() => navigateToTab('programs')}
            onNavigateScouting={() => navigateToTab('scouting')}
          />
        </div>
        <div className={activeTab === 'programs' ? '' : 'hidden'}>
          <div className="space-y-5 max-w-3xl mx-auto">
            <button onClick={() => setActiveTab(previousTab || 'plan')} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              Back
            </button>
            <h2 className="text-xl font-bold text-gray-900">Training Programs</h2>
            <ProgramsSection />
          </div>
        </div>
        {activeTab === 'metric-detail' && selectedMetric && (
          <div>
            <MetricTrendView
              title={({
                'shot-accuracy': 'Shot Accuracy',
                'pass-accuracy': 'Pass Accuracy',
                'duration': 'Session Duration',
                'rpe': 'RPE (Perceived Exertion)',
                'weekly-load': 'Weekly Training Load',
                'streak': 'Training Streak',
                'total-sessions': 'Total Sessions',
                'weekly-goal': 'Weekly Goal',
                'training-score': 'Training Score',
                'fatigue': 'Fatigue Level',
                'mental': 'Mental Trend',
                'weak-foot': 'Weak Foot Analysis',
                'personal-records': 'Personal Records',
              })[selectedMetric] || selectedMetric}
              sessions={sessions}
              metricFn={({
                'shot-accuracy': (s) => s.shooting?.shotsTaken > 0 ? Math.round((s.shooting.goals / s.shooting.shotsTaken) * 100) : null,
                'pass-accuracy': (s) => s.passing?.attempts > 0 ? Math.round((s.passing.completed / s.passing.attempts) * 100) : null,
                'duration': (s) => s.duration || null,
                'rpe': (s) => s.fitness?.rpe || null,
                'weekly-load': (s) => (s.duration || 0) * (s.fitness?.rpe || 5),
                'training-score': (s) => s.duration ? Math.min(100, Math.round(s.duration * 1.5)) : null,
                'mental': (s) => s.reflection?.confidence || null,
                'fatigue': (s) => s.fitness?.rpe || null,
                'weak-foot': (s) => {
                  const l = s.shooting?.leftFoot;
                  const r = s.shooting?.rightFoot;
                  const weaker = (l?.shots || 0) < (r?.shots || 0) ? l : r;
                  return weaker?.shots > 0 ? Math.round((weaker.goals / weaker.shots) * 100) : null;
                },
              })[selectedMetric]}
              chartType={selectedMetric === 'duration' || selectedMetric === 'weekly-load' ? 'bar' : 'line'}
              unit={selectedMetric.includes('accuracy') || selectedMetric === 'weak-foot' ? '%' : selectedMetric === 'duration' ? ' min' : selectedMetric === 'rpe' || selectedMetric === 'mental' || selectedMetric === 'fatigue' ? '/10' : ''}
              color={selectedMetric === 'shot-accuracy' ? '#1E3A5F' : selectedMetric === 'pass-accuracy' ? '#2563EB' : selectedMetric === 'rpe' || selectedMetric === 'fatigue' ? '#D97706' : '#1E3A5F'}
              onBack={() => { setSelectedMetric(null); setActiveTab(previousTab || 'dashboard'); }}
            />
          </div>
        )}
        <div className={activeTab === 'scouting' ? '' : 'hidden'}>
          <ScoutingPage onBack={() => setActiveTab(previousTab || 'plan')} />
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
        <div className={activeTab === 'profile' ? '' : 'hidden'}>
          <div className="space-y-5 max-w-3xl mx-auto">
            {/* Back button */}
            <button
              onClick={() => setActiveTab(previousTab)}
              className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-accent transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
              Back
            </button>

            {/* Profile Header */}
            <div className="text-center">
              <div className="w-20 h-20 rounded-full bg-accent/10 mx-auto flex items-center justify-center text-3xl">
                {settings.playerName ? settings.playerName[0]?.toUpperCase() : '⚽'}
              </div>
              <h2 className="text-lg font-bold text-gray-900 mt-3">{settings.playerName || 'Player'}</h2>
              <p className="text-xs text-gray-400">
                {settings.position && settings.position !== 'General' ? `${settings.position} · ` : ''}{settings.ageGroup && `${settings.ageGroup} · `}{settings.skillLevel || 'Set your profile'}
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

            {/* Development Plan (IDP) */}
            <div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Development Plan</p>
              <IDPModule goals={idpGoals} onSaveGoals={setIdpGoals} sessions={sessions} />
            </div>

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
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Position</span>
                <select
                  value={settings.position || 'General'}
                  onChange={e => setSettings(prev => ({ ...prev, position: e.target.value }))}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
                >
                  <option value="General">General</option>
                  <option value="Striker">Striker</option>
                  <option value="Winger">Winger</option>
                  <option value="CAM">CAM</option>
                  <option value="CDM">CDM</option>
                  <option value="CB">CB</option>
                  <option value="GK">GK</option>
                </select>
              </div>
            </div>

            <hr className="border-gray-100" />

            {/* Training Setup */}
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

            {/* Parent Access (player only — visible when not coach/parent) */}
            {userRole !== 'coach' && userRole !== 'parent' && (
            <div className="space-y-3">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Parent Access</p>

              {/* Generate code */}
              <div className="space-y-2">
                {parentAccessCode ? (
                  <div className="bg-accent/5 rounded-lg p-3 text-center">
                    <p className="text-[10px] text-gray-500 mb-1">Share this code with your parent</p>
                    <p className="text-2xl font-bold text-accent tracking-widest font-mono">{parentAccessCode}</p>
                    <p className="text-[10px] text-gray-400 mt-1">Expires in 7 days</p>
                    <Button variant="secondary" className="mt-2 !text-xs" onClick={() => { navigator.clipboard?.writeText(parentAccessCode); showToast('Code copied!'); }}>
                      Copy Code
                    </Button>
                  </div>
                ) : (
                  <Button variant="secondary" className="w-full" onClick={async () => {
                    try {
                      const res = await fetch('/api/parent/generate-code', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
                      });
                      const data = await res.json();
                      if (res.ok) setParentAccessCode(data.code);
                      else showToast(data.error || 'Failed', 'error');
                    } catch { showToast('Failed to generate code', 'error'); }
                  }}>
                    Generate Parent Code
                  </Button>
                )}
              </div>

              {/* Connected parents */}
              {parentConnectedList.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-500">Connected Parents</p>
                  {parentConnectedList.map(p => (
                    <div key={p.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-xs text-gray-700">{p.parentName}</span>
                      <button
                        onClick={async () => {
                          await fetch(`/api/parent/revoke/${p.id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${getToken()}` } });
                          fetchParentAccess();
                          showToast('Access revoked');
                        }}
                        className="text-[10px] text-red-500 hover:underline"
                      >
                        Revoke
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Privacy toggles */}
              <div className="space-y-2">
                <p className="text-xs text-gray-500">What parents can see</p>
                {[
                  { key: 'showRatings', label: 'Session ratings' },
                  { key: 'showCoachFeedback', label: 'Coach feedback' },
                  { key: 'showIdpGoals', label: 'Development goals' },
                ].map(toggle => (
                  <label key={toggle.key} className="flex items-center justify-between">
                    <span className="text-xs text-gray-700">{toggle.label}</span>
                    <input
                      type="checkbox"
                      checked={parentVisibility[toggle.key]}
                      onChange={async (e) => {
                        const newVis = { ...parentVisibility, [toggle.key]: e.target.checked };
                        setParentVisibility(newVis);
                        fetch('/api/parent/visibility-settings', {
                          method: 'PUT',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${getToken()}` },
                          body: JSON.stringify(newVis),
                        }).catch(() => {});
                      }}
                      className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent"
                    />
                  </label>
                ))}
              </div>
            </div>
            )}

            <hr className="border-gray-100" />

            {/* Data Management */}
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
      <nav className={`md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 shadow-card z-30 ${isOnboarding || isParent ? 'hidden' : ''}`} aria-label="Main navigation">
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


      {/* Settings Modal removed — now full-page profile tab */}

      <ConfirmModal open={showClearConfirm} onClose={() => setShowClearConfirm(false)} onConfirm={handleClearAll}
        title="Clear All Data" message="This will permanently delete all your data. This action cannot be undone." confirmText="Continue" danger />
      <ConfirmModal open={showClearDouble} onClose={() => setShowClearDouble(false)} onConfirm={handleClearConfirmed}
        title="Are you absolutely sure?" message="All sessions, matches, plans, IDP goals, decision journal, and settings will be permanently deleted." confirmText="Delete Everything" danger />

      <Toast message={toast.message} show={toast.show} onHide={hideToast} variant={toast.variant} />

      {/* Camera Setup + Live Session (rendered AFTER all content for proper z-index stacking) */}
      {showCameraSetup && livePlan && (
        <CameraSetup onStart={handleCameraStart} onSkipRecording={handleCameraSkip} />
      )}
      {livePlan && !showCameraSetup && (
        <LiveSessionMode plan={livePlan} onComplete={handleLiveComplete} onExit={handleLiveExit} withRecording={recordingMode} cameraStream={cameraStream} />
      )}

      {/* AI Chat floating button — hidden during onboarding */}
      {userRole !== 'coach' && !isOnboarding && (
        <button
          onClick={() => setShowAIChat(true)}
          className="fixed bottom-24 right-4 md:bottom-8 md:right-8 w-13 h-13 btn-warm rounded-full shadow-lg flex items-center justify-center text-xl font-heading font-bold transition-all hover:scale-105 z-20"
          aria-label="Ask Composed"
        >
          C
        </button>
      )}
      <AskComposed
        open={showAIChat}
        onClose={() => setShowAIChat(false)}
        sessionCount={sessions.length}
        hasProgram={!!activeProgram}
      />
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
      {session.sessionInsights?.length > 0 && (
        <div>
          <span className="text-gray-500 font-medium">Analysis</span>
          <div className="mt-1 space-y-1.5">
            {session.sessionInsights.map((insight, i) => (
              <div key={i} className="flex items-start gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-sm shrink-0">{insight.icon}</span>
                <p className="text-xs text-gray-600 leading-relaxed">{insight.text}</p>
              </div>
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
