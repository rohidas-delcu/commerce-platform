import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorNotice, Loading, PageHead, Panel } from '../../components/Ui';
import { api } from '../../lib/api';

interface Profile {
  id: string;
  name: string;
  email: string;
}
interface Session {
  id: string;
  createdAt?: string;
  lastSeenAt?: string;
  expiresAt?: string;
}
export function ProfilePage() {
  const qc = useQueryClient(),
    [name, setName] = useState(''),
    [currentPassword, setCurrentPassword] = useState(''),
    [newPassword, setNewPassword] = useState(''),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState('');
  const profile = useQuery({
    queryKey: ['merchant', 'me'],
    queryFn: () => api.get<Profile>('/v1/auth/me'),
  });
  const sessions = useQuery({
    queryKey: ['merchant', 'sessions'],
    queryFn: () => api.get<Session[]>('/v1/auth/sessions'),
  });
  useEffect(() => {
    if (profile.data) setName(profile.data.name);
  }, [profile.data]);
  return (
    <>
      <PageHead
        eyebrow="YOUR ACCOUNT"
        title="Profile & security"
        subtitle="Keep your merchant identity and active sessions under control."
      />
      {notice && <div className="notice success">{notice}</div>}
      <ErrorNotice error={error || sessions.error} />
      <div className="content-grid">
        <Panel title="Your profile">
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.patch('/v1/auth/me', { name });
                await qc.invalidateQueries({ queryKey: ['merchant', 'me'] });
                setNotice('Profile saved.');
              } catch (e) {
                setError(e);
              }
            }}
          >
            <label>
              Name
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Email
              <input disabled value={profile.data?.email || ''} />
            </label>
            <button className="btn primary">Save profile</button>
          </form>
        </Panel>
        <Panel title="Change password">
          <form
            className="form-stack"
            onSubmit={async (e) => {
              e.preventDefault();
              try {
                await api.post('/v1/auth/password/change', {
                  currentPassword,
                  password: newPassword,
                });
                api.clearSession();
                qc.clear();
                location.assign('/login');
              } catch (e) {
                setError(e);
              }
            }}
          >
            <label>
              Current password
              <input
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
            </label>
            <label>
              New password
              <input
                type="password"
                autoComplete="new-password"
                minLength={15}
                maxLength={128}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
            </label>
            <button className="btn danger">Change password & sign out</button>
          </form>
        </Panel>
      </div>
      <Panel title="Active sessions" subtitle="Revoking a session logs out that device.">
        {sessions.isPending ? (
          <Loading />
        ) : (
          <div className="item-list">
            {(Array.isArray(sessions.data) ? sessions.data : []).map((s) => (
              <div className="list-item" key={s.id}>
                <div>
                  <strong>Session {s.id.slice(0, 8)}</strong>
                  <small>
                    {s.createdAt ? `Started ${new Date(s.createdAt).toLocaleString()}` : ''}
                  </small>
                </div>
                <button
                  className="btn small danger"
                  onClick={async () => {
                    try {
                      await api.delete(`/v1/auth/sessions/${s.id}`);
                      await qc.invalidateQueries({ queryKey: ['merchant', 'sessions'] });
                    } catch (e) {
                      setError(e);
                    }
                  }}
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </>
  );
}
