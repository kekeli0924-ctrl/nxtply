import { useState, useEffect, useRef, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

// Adaptive polling intervals — chat activity pulses fast, idle chat polls slowly.
const POLL_MIN_MS = 10_000;   // 10s when there's fresh activity
const POLL_MAX_MS = 60_000;   // 60s when the chat has been quiet

export function CoachChat({ coachId, coachName, label = 'Coach Chat' }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);
  const bottomRef = useRef(null);
  const lastMessageCountRef = useRef(0);
  const pollIntervalRef = useRef(POLL_MIN_MS);

  const fetchMessages = useCallback(async () => {
    if (!coachId) return;
    try {
      const res = await fetch(`/api/messages/${coachId}`);
      if (res.ok) {
        const newMessages = await res.json();
        // Adaptive backoff: if we got new messages, reset to min interval.
        // If no new messages, double the interval up to the max.
        if (newMessages.length > lastMessageCountRef.current) {
          pollIntervalRef.current = POLL_MIN_MS;
        } else {
          pollIntervalRef.current = Math.min(pollIntervalRef.current * 2, POLL_MAX_MS);
        }
        lastMessageCountRef.current = newMessages.length;
        setMessages(newMessages);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [coachId]);

  useEffect(() => { fetchMessages(); }, [fetchMessages]);

  // Adaptive polling loop with tab visibility pause.
  // Uses a recursive setTimeout so each tick reads the current backoff interval,
  // and the Page Visibility API stops polls when the tab isn't visible.
  useEffect(() => {
    if (!coachId) return;
    let timer = null;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      if (document.visibilityState === 'visible') {
        await fetchMessages();
      }
      if (!cancelled) {
        timer = setTimeout(tick, pollIntervalRef.current);
      }
    };

    // Start after the initial interval so we don't double-fetch the first load.
    timer = setTimeout(tick, pollIntervalRef.current);

    // Reset backoff and fetch immediately when the tab becomes visible.
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        pollIntervalRef.current = POLL_MIN_MS;
        fetchMessages();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [coachId, fetchMessages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    if (!input.trim() || !coachId) return;
    try {
      const res = await fetch(`/api/messages/${coachId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: input.trim() }),
      });
      if (res.ok) {
        const msg = await res.json();
        setMessages(prev => [...prev, msg]);
        setInput('');
        // Just sent a message — reset polling to fast so we catch a quick reply.
        pollIntervalRef.current = POLL_MIN_MS;
      }
    } catch { /* ignore */ }
  };

  if (!coachId) {
    return (
      <Card>
        <div className="text-center py-6">
          <div className="text-2xl mb-2">💬</div>
          <p className="text-xs text-gray-400">Connect with a coach to start chatting.</p>
          <p className="text-[10px] text-gray-300 mt-1">Go to Settings → Join a Coach</p>
        </div>
      </Card>
    );
  }

  const formatTime = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const formatDate = (ts) => {
    const d = new Date(ts);
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'Today';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString();
  };

  // Group messages by date
  let lastDate = '';

  return (
    <Card>
      <div className="space-y-2">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">{label}</p>
            <p className="text-sm font-semibold text-gray-900">{coachName}</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-green-400" title="Connected" />
        </div>

        {/* Messages */}
        <div className="h-64 overflow-y-auto space-y-2 bg-gray-50 rounded-lg p-3">
          {loading && <p className="text-xs text-gray-300 text-center py-8">Loading...</p>}
          {!loading && messages.length === 0 && (
            <p className="text-xs text-gray-300 text-center py-8">No messages yet. Say hello!</p>
          )}
          {messages.map((msg, i) => {
            const dateStr = formatDate(msg.createdAt);
            const showDate = dateStr !== lastDate;
            lastDate = dateStr;

            return (
              <div key={msg.id || i}>
                {showDate && (
                  <p className="text-[10px] text-gray-300 text-center my-2">{dateStr}</p>
                )}
                <div className={`flex ${msg.isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                    msg.isMine
                      ? 'bg-accent text-white rounded-br-sm'
                      : 'bg-white border border-gray-100 text-gray-800 rounded-bl-sm'
                  }`}>
                    {!msg.isMine && (
                      <p className="text-[10px] font-medium text-accent mb-0.5">{msg.fromUsername}</p>
                    )}
                    <p className="text-xs leading-relaxed">{msg.body}</p>
                    <p className={`text-[9px] mt-0.5 ${msg.isMine ? 'text-white/60' : 'text-gray-300'}`}>
                      {formatTime(msg.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(); }}
            placeholder="Type a message..."
            className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
            maxLength={1000}
          />
          <Button onClick={send} disabled={!input.trim()} className="!rounded-full !px-4">
            Send
          </Button>
        </div>
      </div>
    </Card>
  );
}
