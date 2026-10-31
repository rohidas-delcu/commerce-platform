import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Navigate, useLocation, useNavigate, useParams } from '@tanstack/react-router';
import { ArrowRight, LogOut, Package, UserRound } from 'lucide-react';
import { Empty, Loading, Notice } from '../../components/Feedback';
import { useShop } from '../../providers/ShopContext';
import { api } from '../../lib/api';
import { type Profile } from '../../lib/types';

function AuthFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="auth-page">
      <div className="auth-panel">
        <div className="auth-heading">
          <span className="round-icon">
            <UserRound size={24} />
          </span>
          <p className="eyebrow">YOUR STORE ACCOUNT</p>
          <h1>{title}</h1>
          <p>{subtitle}</p>
        </div>
        {children}
      </div>
      <aside className="auth-aside">
        <span className="eyebrow">THOUGHTFUL SHOPPING</span>
        <h2>
          Every order,
          <br />
          <em>all in one place.</em>
        </h2>
        <p>
          Track your purchases, update your account details and make your next checkout even
          simpler.
        </p>
        <div className="auth-aside-icon">
          <Package size={110} strokeWidth={0.7} />
        </div>
      </aside>
    </div>
  );
}
function AuthForm({
  children,
  onSubmit,
  busy,
  submit,
}: {
  children: ReactNode;
  onSubmit: (e: FormEvent) => void;
  busy: boolean;
  submit: string;
}) {
  return (
    <form className="auth-form" onSubmit={onSubmit}>
      {children}
      <button className="button primary full big" disabled={busy}>
        {busy ? 'Please wait…' : submit} <ArrowRight size={17} />
      </button>
    </form>
  );
}
function PasswordField({
  value,
  onChange,
  autoComplete = 'current-password',
  label = 'Password',
}: {
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  label?: string;
}) {
  return (
    <label>
      {label}
      <input
        type="password"
        minLength={label === 'Password' && autoComplete === 'current-password' ? 1 : 15}
        maxLength={128}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required
      />
    </label>
  );
}
export function AccountPage() {
  const { screen = 'login' } = useParams({ strict: false }),
    location = useLocation(),
    navigate = useNavigate(),
    qc = useQueryClient();
  const search = new URLSearchParams(location.searchStr);
  const { handle, profile, profileLoading, login, logout, store } = useShop();
  const [name, setName] = useState(''),
    [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [currentPassword, setCurrentPassword] = useState(''),
    [token, setToken] = useState('');
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState('');
  const next =
    search.get('next') === 'checkout' ? `/s/${handle}/checkout` : `/s/${handle}/account/orders`;
  useEffect(() => {
    setError(null);
    setNotice('');
    setPassword('');
    setToken('');
  }, [screen]);
  useEffect(() => {
    if (profile) {
      setName(profile.name);
      setEmail(profile.email);
    }
  }, [profile]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      if (screen === 'login') {
        await login(email, password);
        // The profile guard below performs the single post-login redirect.
        // Do not race it with a second imperative navigation.
      } else if (screen === 'signup') {
        await api.post(handle, '/customer/auth/signup', { name, email, password });
        setPassword('');
        navigate({
          to: `/s/${handle}/account/verify`,
          search: { email, ...(search.get('next') === 'checkout' ? { next: 'checkout' } : {}) },
        });
      } else if (screen === 'verify') {
        await api.post(handle, '/customer/auth/verification/confirm', { token });
        setNotice('Email verified. You can now sign in.');
        setPassword('');
        setToken('');
      } else if (screen === 'forgot') {
        await api.post(handle, '/customer/auth/password/forgot', { email });
        setNotice('If this email has an account, recovery instructions have been sent.');
      } else if (screen === 'reset') {
        await api.post(handle, '/customer/auth/password/reset', { token, password });
        setNotice('Password updated. Please sign in.');
        setPassword('');
        setToken('');
      } else if (screen === 'profile') {
        const p = await api.patch<Profile>(handle, '/customer/profile', { name });
        qc.setQueryData(['shop', handle, 'profile'], p);
        setNotice('Your name has been updated.');
      } else if (screen === 'security') {
        await api.post(handle, '/customer/auth/password/change', { currentPassword, password });
        setCurrentPassword('');
        setPassword('');
        setNotice('Password changed. Other sessions may be revoked by your account policy.');
      }
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  async function resend() {
    setBusy(true);
    setError(null);
    try {
      await api.post(handle, '/customer/auth/verification/resend', {
        email: email || search.get('email'),
      });
      setNotice('If an unverified account exists, another verification email has been sent.');
    } catch (err) {
      setError(err);
    } finally {
      setBusy(false);
    }
  }
  if (profileLoading) return <Loading label="Checking your account…" />;
  if (!profile && ['profile', 'security'].includes(screen))
    return <Navigate to={`/s/${handle}/account/login`} replace />;
  if (profile && ['login', 'signup'].includes(screen)) return <Navigate to={next} replace />;
  if (!store && screen === 'signup')
    return (
      <Empty
        title="Registration unavailable"
        description="This store is not accepting new accounts at the moment."
      />
    );
  const titles: Record<string, [string, string, string]> = {
    login: ['Welcome back', 'Sign in to see your orders and complete checkout.', 'Sign in'],
    signup: [
      'Create your account',
      'Use a 15-character or longer password. Verify your email to activate your account.',
      'Create account',
    ],
    verify: [
      'Verify your email',
      'Enter the verification token from the email sent to you.',
      'Verify email',
    ],
    forgot: [
      'Reset your password',
      'Enter your email to request a password reset link.',
      'Send reset instructions',
    ],
    reset: [
      'Set a new password',
      'Enter the recovery token from your email and a new 15-character or longer password.',
      'Reset password',
    ],
    profile: ['Your profile', 'Keep your customer details up to date.', 'Save changes'],
    security: [
      'Account security',
      'Choose a long, unique password for this store account.',
      'Change password',
    ],
  };
  const config = titles[screen];
  if (!config) return <Navigate to={`/s/${handle}/account/login`} replace />;
  return (
    <AuthFrame title={config[0]} subtitle={config[1]}>
      <Notice error={error} />
      {notice && <Notice>{notice}</Notice>}
      <AuthForm onSubmit={submit} busy={busy} submit={config[2]}>
        {['signup', 'profile'].includes(screen) && (
          <label>
            Full name
            <input
              required
              minLength={1}
              maxLength={100}
              value={name}
              autoComplete="name"
              onChange={(e) => setName(e.target.value)}
            />
          </label>
        )}
        {['login', 'signup', 'forgot'].includes(screen) && (
          <label>
            Email address
            <input
              required
              type="email"
              maxLength={254}
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        {['verify', 'reset'].includes(screen) && (
          <label>
            Email token
            <input
              required
              minLength={43}
              maxLength={43}
              autoComplete="one-time-code"
              value={token}
              onChange={(e) => setToken(e.target.value.trim())}
              placeholder="Paste the token from your email"
            />
          </label>
        )}
        {screen === 'security' && (
          <PasswordField
            label="Current password"
            value={currentPassword}
            onChange={setCurrentPassword}
          />
        )}
        {['login', 'signup', 'reset', 'security'].includes(screen) && (
          <PasswordField
            label={screen === 'login' ? 'Password' : 'New password'}
            autoComplete={screen === 'login' ? 'current-password' : 'new-password'}
            value={password}
            onChange={setPassword}
          />
        )}
      </AuthForm>
      <div className="auth-links">
        {screen === 'login' ? (
          <>
            <Link to={`/s/${handle}/account/forgot`}>Forgot password?</Link>
            {store && (
              <Link
                to={`/s/${handle}/account/signup`}
                search={search.get('next') === 'checkout' ? { next: 'checkout' } : {}}
              >
                Create an account
              </Link>
            )}
          </>
        ) : null}
        {screen === 'verify' && (
          <>
            <button className="text-button" disabled={busy} onClick={resend}>
              Resend verification email
            </button>
            <Link
              to={`/s/${handle}/account/login`}
              search={search.get('next') === 'checkout' ? { next: 'checkout' } : {}}
            >
              Sign in after verification
            </Link>
          </>
        )}
        {screen === 'forgot' && (
          <Link to={`/s/${handle}/account/reset`}>I already have a reset token</Link>
        )}
        {['signup', 'forgot', 'reset'].includes(screen) && (
          <Link to={`/s/${handle}/account/login`}>Back to sign in</Link>
        )}
        {['profile', 'security'].includes(screen) && (
          <>
            <Link to={`/s/${handle}/account/orders`}>Your orders</Link>
            <Link to={`/s/${handle}/account/${screen === 'profile' ? 'security' : 'profile'}`}>
              {screen === 'profile' ? 'Change password' : 'Edit profile'}
            </Link>
          </>
        )}
      </div>
      {profile && (
        <button
          className="text-button danger auth-logout"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await logout();
              navigate({ to: `/s/${handle}/account/login` });
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          <LogOut size={15} /> Sign out
        </button>
      )}
    </AuthFrame>
  );
}
