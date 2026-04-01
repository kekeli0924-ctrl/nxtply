import { useState, useEffect } from 'react';
import { Button } from './ui/Button';

export function SessionComments({ sessionId }) {
  const [comments, setComments] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!sessionId) return;
    fetch(`/api/messages/session-comments/${sessionId}`)
      .then(r => r.ok ? r.json() : [])
      .then(setComments)
      .finally(() => setLoading(false));
  }, [sessionId]);

  const addComment = async () => {
    if (!input.trim()) return;
    try {
      const res = await fetch(`/api/messages/session-comments/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: input.trim() }),
      });
      if (res.ok) {
        const comment = await res.json();
        setComments(prev => [...prev, comment]);
        setInput('');
      }
    } catch { /* ignore */ }
  };

  if (loading) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-gray-500">Comments</p>

      {comments.length > 0 && (
        <div className="space-y-2">
          {comments.map(c => (
            <div key={c.id} className="bg-gray-50 rounded-lg px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium text-accent">{c.username}</span>
                <span className="text-[9px] text-gray-300">
                  {new Date(c.createdAt).toLocaleDateString()}
                </span>
              </div>
              <p className="text-xs text-gray-700 mt-0.5">{c.body}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addComment(); }}
          placeholder="Add a comment..."
          className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <Button onClick={addComment} disabled={!input.trim()} className="!text-xs !py-1.5 !px-3">
          Post
        </Button>
      </div>
    </div>
  );
}
