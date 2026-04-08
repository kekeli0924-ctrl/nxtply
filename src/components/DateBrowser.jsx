import { useState, useMemo } from 'react';
import { generateDailyPlan } from '../utils/dailyPlan';

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDateStr(date) {
  return date.toISOString().split('T')[0];
}

export function DateBrowser({ assignedPlans = [], trainingPlans = [], sessions = [], idpGoals = [], onSelectDate }) {
  const today = new Date();
  const todayStr = getDateStr(today);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());

  // Lookup maps
  const sessionDates = useMemo(() => new Set(sessions.map(s => s.date)), [sessions]);
  const assignedDates = useMemo(() => new Set(assignedPlans.map(p => p.date)), [assignedPlans]);
  const plannedDates = useMemo(() => new Set(trainingPlans.map(p => p.date)), [trainingPlans]);

  // Calendar grid for current view month
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const grid = [];
    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) grid.push(null);
    // Day cells
    for (let d = 1; d <= daysInMonth; d++) grid.push(d);
    return grid;
  }, [viewMonth, viewYear]);

  const isToday = selectedDate === todayStr;
  const selectedLabel = isToday ? 'TODAY' : (() => {
    const d = new Date(selectedDate + 'T00:00:00');
    return `${MONTH_NAMES[d.getMonth()].slice(0, 3).toUpperCase()} ${d.getDate()}`;
  })();

  const handleDayClick = (day) => {
    if (!day) return;
    const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    setSelectedDate(dateStr);
    setCalendarOpen(false);
    onSelectDate?.(dateStr);
  };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };

  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const goToToday = () => {
    setSelectedDate(todayStr);
    setViewMonth(today.getMonth());
    setViewYear(today.getFullYear());
    setCalendarOpen(false);
    onSelectDate?.(todayStr);
  };

  // Selected date detail
  const selectedSession = sessions.find(s => s.date === selectedDate);
  const selectedAssigned = assignedPlans.find(p => p.date === selectedDate);
  const selectedPlan = trainingPlans.find(p => p.date === selectedDate);

  return (
    <div className="space-y-2">
      {/* TODAY button — tappable to expand calendar */}
      <div className="flex items-center justify-center">
        <button
          onClick={() => setCalendarOpen(!calendarOpen)}
          className="flex items-center gap-2 bg-surface rounded-full border border-gray-200 px-4 py-1.5 shadow-sm hover:shadow-card transition-shadow"
        >
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-xs font-bold text-gray-700 tracking-wider">{selectedLabel}</span>
          <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      {/* Expandable Calendar */}
      {calendarOpen && (
        <div className="bg-surface rounded-xl border border-gray-100 shadow-card p-3 max-w-sm mx-auto" style={{ animation: 'fadeSlideUp 0.2s ease-out' }}>
          {/* Month header */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="text-gray-400 hover:text-accent p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-bold text-gray-700 uppercase tracking-wider">
              {MONTH_NAMES[viewMonth]} {viewYear !== today.getFullYear() ? viewYear : ''}
            </span>
            <button onClick={nextMonth} className="text-gray-400 hover:text-accent p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Day names */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {DAY_NAMES.map(d => (
              <div key={d} className="text-center text-[10px] font-medium text-gray-400">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const dateStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const isDayToday = dateStr === todayStr;
              const isDaySelected = dateStr === selectedDate;
              const hasSession = sessionDates.has(dateStr);
              const hasAssigned = assignedDates.has(dateStr);
              const isPast = dateStr < todayStr;

              return (
                <button
                  key={dateStr}
                  onClick={() => handleDayClick(day)}
                  className={`relative w-full h-9 flex items-center justify-center rounded-full text-xs font-medium transition-colors ${
                    isDaySelected
                      ? 'bg-accent text-white'
                      : isDayToday
                      ? 'border-2 border-accent text-accent font-bold'
                      : hasSession
                      ? 'text-green-600 font-bold'
                      : hasAssigned
                      ? 'text-blue-600 font-bold'
                      : isPast
                      ? 'text-gray-300'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Go to today button */}
          {!isToday && (
            <button onClick={goToToday} className="w-full text-center text-xs text-accent font-medium mt-3 hover:underline">
              Go to Today
            </button>
          )}
        </div>
      )}

      {/* Selected date detail (non-today) */}
      {selectedDate !== todayStr && (
        <div className="bg-surface rounded-xl border border-gray-100 shadow-card px-4 py-3">
          {selectedSession ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Session Logged</p>
                <span className="text-green-500 text-xs">Completed</span>
              </div>
              <p className="text-[10px] text-gray-400">
                {selectedSession.duration} min — {(selectedSession.drills || []).slice(0, 3).join(', ')}
              </p>
            </div>
          ) : selectedAssigned ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Coach's Plan</p>
                <span className="text-[9px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">Assigned</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {selectedAssigned.drills?.slice(0, 4).map(d => (
                  <span key={d} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{d}</span>
                ))}
              </div>
            </div>
          ) : selectedPlan ? (
            <div className="space-y-1">
              <p className="text-xs font-semibold text-gray-700">Your Plan</p>
              <div className="flex flex-wrap gap-1">
                {selectedPlan.drills?.slice(0, 4).map(d => (
                  <span key={d} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">{d}</span>
                ))}
              </div>
            </div>
          ) : selectedDate > todayStr ? (
            <FuturePlanPreview sessions={sessions} idpGoals={idpGoals} />
          ) : (
            <p className="text-[10px] text-gray-300 text-center py-1">No session logged</p>
          )}
        </div>
      )}
    </div>
  );
}

function FuturePlanPreview({ sessions, idpGoals }) {
  const preview = useMemo(() => {
    const plan = generateDailyPlan(sessions, idpGoals, 'General');
    if (!plan || plan.type === 'completed') return null;
    return plan;
  }, [sessions, idpGoals]);

  if (!preview) return null;

  const drills = preview.drills || preview.timeline?.filter(t => !t.isWarmup && !t.isCooldown).map(t => t.name) || [];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-700">{preview.focus}</p>
        <span className="text-[9px] font-medium text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">Preview</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {drills.slice(0, 4).map(d => (
          <span key={d} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">{d}</span>
        ))}
      </div>
    </div>
  );
}
