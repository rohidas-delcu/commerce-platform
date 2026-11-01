import { useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ErrorNotice, InfoNotice, Loading, PageHead, Panel, Status } from '../../components/Ui';
import { useStoreContext } from '../../providers/StoreContext';
import { api } from '../../lib/api';
import { pageItems, type Page } from '../../lib/types';

interface Member {
  identityId: string;
  name?: string;
  email?: string;
  role: string;
}
interface Invitation {
  id: string;
  email: string;
  role: string;
  storeId?: string | null;
  status?: string;
}
export function TeamPage() {
  const { store, accounts } = useStoreContext(),
    qc = useQueryClient();
  const accountId = store.merchantId || accounts[0]?.id;
  const [email, setEmail] = useState(''),
    [role, setRole] = useState('MEMBER'),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const members = useQuery({
    queryKey: ['team', accountId],
    queryFn: () => api.get<Page<Member>>(`/v1/merchant/accounts/${accountId}/members?limit=100`),
    enabled: !!accountId,
  });
  const invitations = useQuery({
    queryKey: ['invites', accountId],
    queryFn: () =>
      api.get<Page<Invitation>>(`/v1/merchant/accounts/${accountId}/invitations?limit=100`),
    enabled: !!accountId,
  });
  async function invite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post(`/v1/merchant/accounts/${accountId}/invitations`, {
        email,
        role,
        ...(role === 'MEMBER' ? {} : { storeId: store.id }),
      });
      setEmail('');
      await qc.invalidateQueries({ queryKey: ['invites', accountId] });
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="ACCESS CONTROL"
        title="Team & invitations"
        subtitle="Invite colleagues with explicit account or store roles. Permissions are enforced by the API."
      />
      <div className="content-grid">
        <Panel
          title="Invite a teammate"
          subtitle="Account owners can manage membership and invitations."
        >
          <ErrorNotice error={error} />
          <form onSubmit={invite} className="form-stack">
            <label>
              Email
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Role
              <select value={role} onChange={(e) => setRole(e.target.value)}>
                <option value="MEMBER">Account member (no store access)</option>
                <option value="STORE_ADMIN">Store admin</option>
                <option value="STORE_EDITOR">Store editor</option>
                <option value="STORE_VIEWER">Store viewer</option>
              </select>
            </label>
            <InfoNotice>
              Account-owner rights cannot be granted through invitations. The backend protects the
              last account owner.
            </InfoNotice>
            <button disabled={busy} className="btn primary">
              Send invitation
            </button>
          </form>
        </Panel>
        <Panel title="Account members">
          <ErrorNotice error={members.error} />
          {members.isPending ? (
            <Loading />
          ) : (
            <div className="item-list">
              {pageItems(members.data).map((m, index) => (
                <div className="list-item" key={m.identityId || index}>
                  <div>
                    <strong>{m.name || m.email || m.identityId}</strong>
                    <small>{m.email || ''}</small>
                  </div>
                  <Status value={m.role} />
                </div>
              ))}
              {!pageItems(members.data).length && <p className="empty-copy">No members found.</p>}
            </div>
          )}
        </Panel>
      </div>
      <Panel
        title="Pending invitations"
        subtitle="Revoking an invitation does not affect any already accepted membership."
      >
        <ErrorNotice error={invitations.error} />
        {invitations.isPending ? (
          <Loading />
        ) : (
          <div className="item-list">
            {pageItems(invitations.data).map((i) => (
              <div className="list-item" key={i.id}>
                <div>
                  <strong>{i.email}</strong>
                  <small>
                    {i.role} · {i.status || 'Pending'}
                  </small>
                </div>
                <button
                  className="btn small danger"
                  onClick={async () => {
                    if (!confirm('Revoke this invitation?')) return;
                    try {
                      await api.delete(`/v1/merchant/accounts/${accountId}/invitations/${i.id}`);
                      await qc.invalidateQueries({ queryKey: ['invites', accountId] });
                    } catch (e) {
                      setError(e);
                    }
                  }}
                >
                  Revoke
                </button>
              </div>
            ))}
            {!pageItems(invitations.data).length && (
              <p className="empty-copy">No invitations found.</p>
            )}
          </div>
        )}
      </Panel>
    </>
  );
}
