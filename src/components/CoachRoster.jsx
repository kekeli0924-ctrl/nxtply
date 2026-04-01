import { useState, useEffect, useCallback } from 'react';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Modal } from './ui/Modal';

export function CoachRoster({ onSelectPlayer }) {
  const [roster, setRoster] = useState([]);
  const [invites, setInvites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [newCode, setNewCode] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchRoster = useCallback(async () => {
    try {
      const res = await fetch('/api/roster', { headers: { 'X-Dev-Role': window.__COMPOSED_ROLE__ || 'coach' } });
      if (res.ok) setRoster(await res.json());
    } catch { /* ignore */ }
  }, []);

  const fetchInvites = useCallback(async () => {
    try {
      const res = await fetch('/api/roster/invites', { headers: { 'X-Dev-Role': window.__COMPOSED_ROLE__ || 'coach' } });
      if (res.ok) setInvites(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchRoster(), fetchInvites()]).finally(() => setLoading(false));
  }, [fetchRoster, fetchInvites]);

  const generateInvite = async () => {
    try {
      const res = await fetch('/api/roster/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Dev-Role': window.__COMPOSED_ROLE__ || 'coach' },
      });
      if (res.ok) {
        const data = await res.json();
        setNewCode(data.code);
        setCopied(false);
        setShowInviteModal(true);
        fetchInvites();
      }
    } catch { /* ignore */ }
  };

  const copyCode = () => {
    if (newCode) {
      navigator.clipboard.writeText(newCode);
      setCopied(true);
    }
  };

  const removePlayer = async (playerId) => {
    try {
      await fetch(`/api/roster/${playerId}`, {
        method: 'DELETE',
        headers: { 'X-Dev-Role': 'coach' },
      });
      setRoster(prev => prev.filter(p => p.playerId !== playerId));
    } catch { /* ignore */ }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Loading roster...</div>;
  }

  return (
    <div className="space-y-5 max-w-3xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">Your Roster</h2>
        <Button onClick={generateInvite}>Invite Player</Button>
      </div>

      {roster.length === 0 ? (
        <Card>
          <div className="text-center py-8">
            <div className="text-4xl mb-3">👥</div>
            <p className="text-sm font-medium text-gray-700">No players yet</p>
            <p className="text-xs text-gray-400 mt-1">Tap "Invite Player" above to generate a code and share it with your players.</p>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {roster.map(player => (
            <Card key={player.playerId}>
              <button
                type="button"
                className="w-full text-left"
                onClick={() => onSelectPlayer(player)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{player.playerName}</p>
                    <p className="text-xs text-gray-400">@{player.username}</p>
                  </div>
                  <div className="text-right">
                    {player.compliancePercent != null ? (
                      <div className={`text-lg font-bold ${
                        player.compliancePercent >= 80 ? 'text-green-600' :
                        player.compliancePercent >= 50 ? 'text-amber-500' : 'text-red-500'
                      }`}>
                        {player.compliancePercent}%
                      </div>
                    ) : (
                      <span className="text-xs text-gray-300">No plans</span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-400">This week</p>
                    <p className="text-sm font-semibold">{player.sessionsLast7d}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-400">30 days</p>
                    <p className="text-sm font-semibold">{player.sessionsLast30d}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <p className="text-xs text-gray-400">Assigned</p>
                    <p className="text-sm font-semibold">{player.completedThisWeek}/{player.assignedThisWeek}</p>
                  </div>
                </div>
              </button>

              <div className="flex justify-end mt-2 pt-2 border-t border-gray-50">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); removePlayer(player.playerId); }}
                  className="text-[10px] text-red-400 hover:text-red-600"
                >
                  Remove
                </button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Active invite codes */}
      {invites.filter(c => !c.used).length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-gray-400 uppercase mb-2">Active Invite Codes</h3>
          <div className="space-y-2">
            {invites.filter(c => !c.used).map(code => (
              <div key={code.code} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <code className="text-sm font-mono font-semibold text-accent">{code.code}</code>
                <span className="text-[10px] text-gray-400">
                  Expires {new Date(code.expiresAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Invite Modal */}
      <Modal
        open={showInviteModal}
        onClose={() => setShowInviteModal(false)}
        title="Invite Code Generated"
        actions={<Button variant="secondary" onClick={() => setShowInviteModal(false)}>Done</Button>}
      >
        <div className="text-center py-4">
          <p className="text-sm text-gray-500 mb-4">Share this code with your player. It expires in 7 days.</p>
          <div className="bg-gray-50 rounded-xl p-4 mb-4">
            <code className="text-2xl font-mono font-bold text-accent tracking-widest">{newCode}</code>
          </div>
          <Button onClick={copyCode} variant="secondary">
            {copied ? 'Copied!' : 'Copy Code'}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
