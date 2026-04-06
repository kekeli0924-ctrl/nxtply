import { useState } from 'react';
import { Button } from './ui/Button';
import { setTokens } from '../hooks/useApi';

export function AuthScreen({ onAuthSuccess, onNewUser }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Invalid credentials.');
        setLoading(false);
        return;
      }
      setTokens(data.token, data.refreshToken);
      onAuthSuccess({ userId: data.userId, username: username.trim(), role: data.role || 'player' });
    } catch {
      setError('Connection failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl text-accent tracking-tight font-logo italic">Composed</h1>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="Enter your username"
              autoComplete="username"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              autoComplete="current-password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{error}</div>
          )}

          <Button type="submit" disabled={loading} className="w-full py-3">
            {loading ? 'Logging in...' : 'Log In'}
          </Button>
        </form>

        <div className="mt-6">
          <Button variant="secondary" onClick={onNewUser} className="w-full py-3">
            I'm a New User
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Signup form shown at the END of onboarding (after role/name/settings are collected).
 */
export function SignupForm({ onSignupSuccess, onBack }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignup = async (e) => {
    e.preventDefault();
    setError('');

    if (!username.trim() || !password) {
      setError('Username and password are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong.');
        setLoading(false);
        return;
      }
      setTokens(data.token, data.refreshToken);
      onSignupSuccess({ userId: data.userId, username: username.trim(), role: data.role || 'player' });
    } catch {
      setError('Connection failed. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto py-8 px-4">
      <div className="text-center mb-6">
        <h2 className="text-3xl text-gray-900 tracking-tight font-logo italic">stay composed</h2>
      </div>

      <div className="text-center mb-6">
        <p className="text-sm font-semibold text-gray-900">Create your account</p>
        <p className="text-xs text-gray-400 mt-1">This saves your training data securely.</p>
      </div>

      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Username</label>
          <input
            type="text"
            value={username}
            onChange={e => setUsername(e.target.value)}
            placeholder="Choose a username"
            autoComplete="username"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            autoComplete="new-password"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Confirm Password</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="Re-enter password"
            autoComplete="new-password"
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">{error}</div>
        )}

        <p className="text-[10px] text-gray-300 text-center">
          Letters, numbers, hyphens, underscores. Password: 8+ characters with a letter and a number.
        </p>

        <div className="flex items-center justify-center gap-3">
          <Button variant="secondary" onClick={onBack}>Back</Button>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Account'}
          </Button>
        </div>
      </form>
    </div>
  );
}
