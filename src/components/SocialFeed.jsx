import { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';

export function SocialFeed() {
  const [friends, setFriends] = useState([]);
  const [feed, setFeed] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [coachCode, setCoachCode] = useState('');
  const [coachError, setCoachError] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const [friendsRes, feedRes] = await Promise.all([
        fetch('/api/friends').then(r => r.ok ? r.json() : []),
        fetch('/api/friends/feed').then(r => r.ok ? r.json() : []),
      ]);
      setFriends(friendsRes);
      setFeed(feedRes);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Search with debounce
  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/friends/search?q=${encodeURIComponent(searchQuery)}`);
        if (res.ok) setSearchResults(await res.json());
      } catch { /* ignore */ }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const addFriend = async (userId) => {
    try {
      const res = await fetch('/api/friends/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        setSearchQuery('');
        setSearchResults([]);
        fetchData();
      }
    } catch { /* ignore */ }
  };

  const formatActivity = (item) => {
    const parts = [];
    if (item.duration) parts.push(`${item.duration} min`);
    if (item.drills?.length) parts.push(item.drills.slice(0, 2).join(', '));
    if (item.shotPct != null) parts.push(`${item.shotPct}% shooting`);
    if (item.passPct != null) parts.push(`${item.passPct}% passing`);
    return parts.join(' · ');
  };

  const ratingEmoji = (r) => r >= 8 ? '🔥' : r >= 6 ? '💪' : r >= 4 ? '⚡' : '🏃';

  if (loading) return null;

  const visibleFeed = showAll ? feed : feed.slice(0, 5);

  const joinCoach = async () => {
    if (!coachCode.trim()) return;
    setCoachError('');
    try {
      const res = await fetch('/api/roster/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: coachCode.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setCoachCode('');
        setCoachError('');
        alert(`Joined coach: ${data.coachName}`);
      } else {
        setCoachError(data.error || 'Invalid code');
      }
    } catch { setCoachError('Failed to join'); }
  };

  return (
    <>
    <Card>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Join a Coach</p>
        <div className="flex gap-2">
          <input
            type="text"
            value={coachCode}
            onChange={e => setCoachCode(e.target.value.toUpperCase())}
            placeholder="Enter coach invite code"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <Button onClick={joinCoach} disabled={!coachCode.trim()} className="!text-xs !py-1.5 !px-3">Join</Button>
        </div>
        {coachError && <p className="text-[10px] text-red-500">{coachError}</p>}
      </div>
    </Card>

    <Card>
      <div className="space-y-3">
        <p className="text-xs text-gray-400 uppercase tracking-wide font-medium">Activity Feed</p>

        {/* Search for friends */}
        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by username to add friends"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-accent/30"
          />

          {/* Search results dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-100 rounded-lg shadow-lg z-10 overflow-hidden">
              {searchResults.map(user => (
                <div key={user.userId} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50">
                  <span className="text-xs text-gray-700">@{user.username}</span>
                  {user.isFriend ? (
                    <span className="text-[10px] text-gray-400">Already friends</span>
                  ) : (
                    <button
                      onClick={() => addFriend(user.userId)}
                      className="text-[10px] text-accent font-medium hover:underline"
                    >
                      Add
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
          {searching && <p className="text-[10px] text-gray-300 mt-1">Searching...</p>}
        </div>

        {/* Feed */}
        {feed.length === 0 ? (
          <div className="text-center py-3">
            <p className="text-xs text-gray-400">Your friends' recent training will appear here once you're connected.</p>
            <p className="text-[10px] text-gray-300 mt-1">↑ Search by username above to add friends</p>
          </div>
        ) : (
          <div className="space-y-2">
            {visibleFeed.map((item, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-sm mt-0.5">{ratingEmoji(item.quickRating)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-gray-800">{item.username} trained</p>
                  <p className="text-[10px] text-gray-400 truncate">{formatActivity(item)}</p>
                </div>
                <span className="text-[10px] text-gray-300 shrink-0">{item.date}</span>
              </div>
            ))}
          </div>
        )}

        {feed.length > 5 && (
          <button onClick={() => setShowAll(!showAll)} className="text-[10px] text-accent hover:underline w-full text-center">
            {showAll ? 'Show Less' : `View All (${feed.length})`}
          </button>
        )}

        {friends.length > 0 && (
          <p className="text-[10px] text-gray-300 text-center">{friends.length} friend{friends.length !== 1 ? 's' : ''} connected</p>
        )}
      </div>
    </Card>
    </>
  );
}
