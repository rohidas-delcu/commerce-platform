import { useEffect, useState, type FormEvent } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { api } from '../lib/api';
import { ErrorNotice } from '../components/Ui';

export function Authentication({ onAuthenticated }: { onAuthenticated: () => void }) {
  const navigate = useNavigate(),
    location = useLocation();
  const [mode, setMode] = useState<'login' | 'signup' | 'verify' | 'forgot' | 'reset'>(() =>
    location.pathname.includes('signup')
      ? 'signup'
      : location.pathname.includes('verify')
        ? 'verify'
        : location.pathname.includes('forgot')
          ? 'forgot'
          : location.pathname.includes('reset')
            ? 'reset'
            : 'login',
  );
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [confirm, setConfirm] = useState(''),
    [token, setToken] = useState(new URLSearchParams(location.searchStr).get('token') || '');
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState('');
  useEffect(() => {
    const next = location.pathname.includes('signup')
      ? 'signup'
      : location.pathname.includes('verify')
        ? 'verify'
        : location.pathname.includes('forgot')
          ? 'forgot'
          : location.pathname.includes('reset')
            ? 'reset'
            : 'login';
    setMode(next);
    setError(null);
  }, [location.pathname]);
  const changeMode = (screen: typeof mode) => {
    setMode(screen);
    setError(null);
    setNotice('');
    navigate({ to: `/${screen}` });
  };
  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setNotice('');
    try {
      if (mode === 'login') {
        await api.post('/v1/auth/login', { email, password });
        onAuthenticated();
        navigate({ to: '/app' });
      }
      if (mode === 'signup') {
        if (password !== confirm) throw new Error('Passwords do not match.');
        await api.post('/v1/auth/signup', { email, password, name });
        changeMode('verify');
        setNotice('Check your email for a one-time verification link or token.');
      }
      if (mode === 'verify') {
        await api.post('/v1/auth/verification/confirm', { token });
        changeMode('login');
        setNotice('Email verified. Sign in to continue.');
      }
      if (mode === 'forgot') {
        await api.post('/v1/auth/password/forgot', { email });
        changeMode('reset');
        setNotice('If the address is registered, a password reset email will arrive.');
      }
      if (mode === 'reset') {
        if (password !== confirm) throw new Error('Passwords do not match.');
        await api.post('/v1/auth/password/reset', { token, password });
        changeMode('login');
        setNotice('Password reset. Sign in to continue.');
      }
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  const title = {
    login: 'Welcome back',
    signup: 'Start your own store',
    verify: 'Verify your email',
    forgot: 'Forgot your password?',
    reset: 'Choose a new password',
  }[mode];
  return (
    <div className="auth-layout">
      <div className="auth-visual">
        <div className="auth-logo">
          <span className="brand-mark">c.</span>
          <span>
            commerce<strong>studio</strong>
          </span>
        </div>
        <div>
          <span className="auth-kicker">THE MERCHANT WORKSPACE</span>
          <h2>Everything your business needs, in one beautiful place.</h2>
          <p>Build a store, curate your catalog, manage every order and keep moving.</p>
          <div className="auth-art">
            <span>Live store insights</span>
            <div className="auth-art-bars">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
          </div>
        </div>
        <span className="auth-footnote">Your products. Your customers. Your brand.</span>
      </div>
      <main className="auth-main">
        <div className="auth-card">
          <div className="mobile-logo">
            <span className="brand-mark">c.</span> Commerce Studio
          </div>
          <p className="eyebrow">SECURE MERCHANT ACCESS</p>
          <h1>{title}</h1>
          <p className="page-desc">
            {mode === 'login'
              ? 'Sign in to manage your store and keep business moving.'
              : mode === 'signup'
                ? 'Create your merchant account. Verify your email to get started.'
                : mode === 'verify'
                  ? 'Use the single-use token delivered by email.'
                  : mode === 'forgot'
                    ? 'We will send reset instructions if the address exists.'
                    : 'Enter the token from your reset email and a strong new password.'}
          </p>
          {notice && (
            <div className="notice success" role="status">
              {notice}
            </div>
          )}
          <ErrorNotice error={error} />
          <form onSubmit={submit} className="form-stack">
            {mode === 'signup' && (
              <label>
                Full name
                <input
                  required
                  minLength={2}
                  maxLength={100}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  placeholder="Your full name"
                />
              </label>
            )}
            {['signup', 'login', 'forgot'].includes(mode) && (
              <label>
                Email address
                <input
                  required
                  type="email"
                  maxLength={254}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="you@business.com"
                />
              </label>
            )}
            {['verify', 'reset'].includes(mode) && (
              <label>
                One-time email token
                <input
                  required
                  value={token}
                  onChange={(e) => setToken(e.target.value.trim())}
                  autoComplete="off"
                  placeholder="Paste your email token"
                />
              </label>
            )}
            {['login', 'signup', 'reset'].includes(mode) && (
              <label>
                {mode === 'reset' ? 'New password' : 'Password'}
                <input
                  required
                  type="password"
                  minLength={mode === 'login' ? 1 : 15}
                  maxLength={128}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder={mode === 'login' ? 'Enter your password' : 'At least 15 characters'}
                />
              </label>
            )}
            {['signup', 'reset'].includes(mode) && (
              <label>
                Confirm password
                <input
                  required
                  minLength={15}
                  maxLength={128}
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Repeat your password"
                />
              </label>
            )}
            <button className="btn primary full" disabled={pending} type="submit">
              {pending
                ? 'Please wait…'
                : {
                    login: 'Sign in to workspace',
                    signup: 'Create account',
                    verify: 'Verify email',
                    forgot: 'Send reset instructions',
                    reset: 'Update password',
                  }[mode]}
            </button>
          </form>
          <div className="auth-links">
            {mode === 'login' ? (
              <>
                <button className="link" onClick={() => changeMode('forgot')}>
                  Forgot password?
                </button>
                <span>
                  New here?{' '}
                  <button className="link" onClick={() => changeMode('signup')}>
                    Create an account
                  </button>
                </span>
              </>
            ) : (
              <>
                <button className="link" onClick={() => changeMode('login')}>
                  Back to sign in
                </button>
                {mode === 'verify' && (
                  <button
                    className="link"
                    onClick={async () => {
                      try {
                        await api.post('/v1/auth/verification/resend', { email });
                        setNotice('If eligible, a new verification email will be sent.');
                      } catch (e) {
                        setError(e);
                      }
                    }}
                  >
                    Resend verification
                  </button>
                )}
              </>
            )}
          </div>
          <p className="auth-small">
            Real verification and password recovery are email-based. This UI never uses demo
            credentials.
          </p>
        </div>
      </main>
    </div>
  );
}
