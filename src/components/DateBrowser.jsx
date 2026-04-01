import { useState, useMemo, useRef, useEffect } from 'react';

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getDateStr(offset) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().split('T')[0];
}

function formatDateLabel(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return { day: DAY_SHORT[d.getDay()], date: d.getDate(), month: MONTH_SHORT[d.getMonth()] };
}

export function DateBrowser({ assignedPlans = [], trainingPlans = [], sessions = [], onSelectDate }) {
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState(today);
  const scrollRef = useRef(null);

  // Generate 14 days back + today + 14 days forward = 29 dates
  const dates = useMemo(() => {
    const arr = [];
    for (let i = -14; i <= 14; i++) {
      arr.push(getDateStr(i));
    }
    return arr;
  }, []);

  // Build lookup maps
  const assignedByDate = useMemo(() => {
    const map = {};
    for (const p of assignedPlans) map[p.date] = p;
    return map;
  }, [assignedPlans]);

  const planByDate = useMemo(() => {
    const map = {};
    for (const p of trainingPlans) map[p.date] = p;
    return map;
  }, [trainingPlans]);

  const sessionByDate = useMemo(() => {
    const map = {};
    for (const s of sessions) map[s.date] = s;
    return map;
  }, [sessions]);

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) {
      const todayEl = scrollRef.current.querySelector('[data-today="true"]');
      if (todayEl) {
        todayEl.scrollIntoView({ inline: 'center', behavior: 'instant' });
      }
    }
  }, []);

  const selected = useMemo(() => {
    const assigned = assignedByDate[selectedDate];
    const planned = planByDate[selectedDate];
    const session = sessionByDate[selectedDate];
    return { assigned, planned, session, date: selectedDate };
  }, [selectedDate, assignedByDate, planByDate, sessionByDate]);

  const handleSelect = (date) => {
    setSelectedDate(date);
    onSelectDate?.(date);
  };

  return (
    <div className="bg-surface rounded-xl border border-gray-100 shadow-card px-3 py-2">
      <div className="space-y-2">
        {/* Date strip */}
        <div ref={scrollRef} className="flex gap-0.5 overflow-x-auto scrollbar-hide">
          {dates.map(date => {
            const label = formatDateLabel(date);
            const isToday = date === today;
            const isSelected = date === selectedDate;
            const hasAssigned = !!assignedByDate[date];
            const hasPlanned = !!planByDate[date];
            const hasSession = !!sessionByDate[date];
            const isPast = date < today;

            return (
              <button
                key={date}
                data-today={isToday ? 'true' : undefined}
                onClick={() => handleSelect(date)}
                className={`shrink-0 w-11 py-0.5 rounded-md text-center transition-all ${
                  isSelected
                    ? 'bg-accent text-white shadow-sm'
                    : isToday
                    ? 'bg-accent/10 text-accent'
                    : isPast
                    ? 'text-gray-300'
                    : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <p className="text-[9px] font-medium">{label.day}</p>
                <p className={`text-sm font-bold ${isSelected ? 'text-white' : ''}`}>{label.date}</p>
                {/* Dots indicating activity */}
                {(hasAssigned || hasSession) && (
                  <span className={`block mx-auto mt-0.5 w-1 h-1 rounded-full ${hasSession ? 'bg-green-400' : 'bg-blue-400'}`} />
                )}
              </button>
            );
          })}
        </div>

        {/* Selected date detail — only show for non-today dates */}
        {selected.date !== today && (
        <div>
          {selected.assigned ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Coach's Plan</p>
                <span className="text-[9px] font-medium text-blue-500 bg-blue-50 px-1.5 py-0.5 rounded-full">Assigned</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {selected.assigned.drills?.map(d => (
                  <span key={d} className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">{d}</span>
                ))}
              </div>
              {selected.assigned.targetDuration > 0 && (
                <p className="text-[10px] text-gray-400">{selected.assigned.targetDuration} min</p>
              )}
              {selected.assigned.notes && (
                <p className="text-[10px] text-gray-400 italic">{selected.assigned.notes}</p>
              )}
            </div>
          ) : selected.planned ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-700">Your Plan</p>
              <div className="flex flex-wrap gap-1">
                {selected.planned.drills?.map(d => (
                  <span key={d} className="text-[10px] bg-accent/10 text-accent px-1.5 py-0.5 rounded-full">{d}</span>
                ))}
              </div>
              {selected.planned.targetDuration > 0 && (
                <p className="text-[10px] text-gray-400">{selected.planned.targetDuration} min</p>
              )}
            </div>
          ) : selected.session ? (
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-gray-700">Session Logged</p>
                <span className="text-green-500 text-xs">✓ Completed</span>
              </div>
              <p className="text-[10px] text-gray-400">
                {selected.session.duration} min — {(selected.session.drills || []).slice(0, 3).join(', ')}
              </p>
            </div>
          ) : (
            <p className="text-[10px] text-gray-300 text-center py-2">
              {selected.date < today ? 'No session logged' : 'No plan scheduled'}
            </p>
          )}
        </div>
        )}
      </div>
    </div>
  );
}
