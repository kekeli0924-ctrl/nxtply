import { useState, useEffect, useRef } from 'react';
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';

const SUGGESTED_QUESTIONS = {
  new: [
    "What's the best way to start training?",
    "How often should I train per week?",
    "What should I focus on first?",
  ],
  active: [
    "How has my shooting improved this month?",
    "What's my biggest weakness right now?",
    "Am I training enough for my goals?",
    "What should I focus on next session?",
  ],
  program: [
    "How am I doing in my program?",
  ],
};

export function AskComposed({ open, onClose, sessionCount = 0, hasProgram = false }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [available, setAvailable] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    fetch('/api/ai/available').then(r => r.json()).then(d => setAvailable(d.available)).catch(() => setAvailable(false));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async (text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;

    const role = window.__COMPOSED_ROLE__ || 'player';
    setMessages(prev => [...prev, { role: 'user', text: msg }]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`/api/ai/chat?_role=${role}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Dev-Role': role },
        body: JSON.stringify({ message: msg }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', text: data.error || 'Something went wrong. Try again.' }]);
      }
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', text: 'Connection error. Try again.' }]);
    }
    setLoading(false);
  };

  // Build suggested questions
  const suggestions = [];
  if (sessionCount < 5) suggestions.push(...SUGGESTED_QUESTIONS.new);
  else suggestions.push(...SUGGESTED_QUESTIONS.active);
  if (hasProgram) suggestions.push(...SUGGESTED_QUESTIONS.program);

  if (available === false) return null;

  return (
    <Modal open={open} onClose={onClose} title="" actions={null}>
      <div className="flex flex-col h-[70vh] -m-5">
        {/* Header */}
        <div className="px-5 py-3 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-gray-900 font-heading">Ask Composed</h2>
              <p className="text-[10px] text-gray-400">Your personal training analyst</p>
            </div>
            <button onClick={onClose} className="text-gray-300 hover:text-gray-500 text-lg">&times;</button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3">
          {messages.length === 0 && (
            <div className="py-8 space-y-4">
              <div className="text-center">
                <div className="text-3xl mb-2">🧠</div>
                <p className="text-xs text-gray-400">Ask me anything about your training</p>
              </div>
              <div className="space-y-2">
                {suggestions.slice(0, 4).map((q, i) => (
                  <button
                    key={i}
                    onClick={() => send(q)}
                    className="w-full text-left bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 text-xs text-gray-600 transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.role === 'user'
                  ? 'bg-accent text-white rounded-br-sm'
                  : 'bg-gray-50 text-gray-700 rounded-bl-sm'
              }`}>
                <p className="text-xs leading-relaxed whitespace-pre-wrap">{msg.text}</p>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-50 rounded-2xl rounded-bl-sm px-4 py-2.5">
                <p className="text-xs text-gray-400 animate-pulse">Composed is thinking...</p>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-3 border-t border-gray-100">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') send(); }}
              placeholder="Ask about your training..."
              className="flex-1 border border-gray-200 rounded-full px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
              maxLength={500}
              disabled={loading}
            />
            <Button onClick={() => send()} disabled={!input.trim() || loading} className="!rounded-full !px-4">
              Ask
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
