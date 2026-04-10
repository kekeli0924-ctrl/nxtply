import { useState } from 'react';
import { promptGoogleSignIn, getGoogleClientId } from '../hooks/useGoogleSignIn';

/**
 * "Continue with Google" button. Self-contained — handles the GSI popup,
 * forwards the returned credential to /api/auth/google/verify, then dispatches
 * either onSuccess (returning user) or onNewUser (first-time Google user).
 *
 * Renders nothing if VITE_GOOGLE_CLIENT_ID isn't set, so the UI stays clean in
 * dev environments without Google configured.
 *
 * Props:
 *   onSuccess({ token, refreshToken, userId, role }) — called for Case A/B
 *   onNewUser({ pendingToken, email, name })         — called for Case C
 *   onError(message)                                  — optional error sink
 *   label — override default button text
 */
export function GoogleSignInButton({ onSuccess, onNewUser, onError, label = 'Continue with Google' }) {
  const [loading, setLoading] = useState(false);
  const clientId = getGoogleClientId();

  // Hide the button entirely when the client ID isn't configured. Keeps the
  // login screen uncluttered in dev before Google is set up, and matches the
  // backend's 503 behavior so users never see a broken button.
  if (!clientId) return null;

  const handleClick = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { credential } = await promptGoogleSignIn(clientId);

      const res = await fetch('/api/auth/google/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
      });
      const data = await res.json();
      if (!res.ok) {
        const msg = data.error || 'Google sign-in failed';
        if (onError) onError(msg);
        else console.error('Google sign-in failed:', msg);
        setLoading(false);
        return;
      }

      if (data.isNewUser) {
        // Case C — new user. Hand off to parent so it can stash pendingToken
        // and route into the onboarding flow.
        onNewUser?.(data);
      } else {
        // Case A or B — returning user or auto-linked. Parent stores tokens
        // and transitions to the main app.
        onSuccess?.(data);
      }
    } catch (err) {
      // User cancelled, popup blocked, or GSI script failed to load.
      // Only surface a real error — user cancellation is silent.
      const msg = err?.message || '';
      if (msg && !msg.toLowerCase().includes('cancel')) {
        if (onError) onError(msg);
        else console.error('Google sign-in error:', msg);
      }
    }
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2 py-3 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 active:bg-gray-100 text-sm font-medium text-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-accent/30"
      aria-label={label}
    >
      {/* Google "G" logo — official multicolor mark */}
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
        <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 16.1 19 13 24 13c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.6 8.3 6.3 14.7z"/>
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.3 35 26.8 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
        <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.2 5.6l6.2 5.2C41 35 44 29.9 44 24c0-1.3-.1-2.4-.4-3.5z"/>
      </svg>
      {loading ? 'Opening Google…' : label}
    </button>
  );
}
