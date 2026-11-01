import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { api, key } from '../lib/api';
import type { MerchantAccount } from '../lib/types';
import { ErrorNotice } from '../components/Ui';

export function Setup({
  accounts,
  onReload,
}: {
  accounts: MerchantAccount[];
  onReload: () => Promise<void>;
}) {
  const navigate = useNavigate(),
    [accountId, setAccountId] = useState(accounts[0]?.id || ''),
    [accountName, setAccountName] = useState(''),
    [name, setName] = useState(''),
    [handle, setHandle] = useState(''),
    [country, setCountry] = useState('IN'),
    [currency, setCurrency] = useState('INR');
  const [invitationToken, setInvitationToken] = useState(''),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(null);
  const createAttempt = useRef<{ payload: string; idempotencyKey: string } | null>(null);
  useEffect(() => {
    if (!accountId && accounts[0]) setAccountId(accounts[0].id);
  }, [accounts, accountId]);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      let id = accountId;
      if (!id) {
        const a = await api.post<MerchantAccount>('/v1/merchant/accounts', { name: accountName });
        id = a.id;
        // Account creation is not idempotent. Retain the newly created account if
        // the subsequent store request fails, so retry cannot create duplicates.
        setAccountId(id);
        await onReload();
      }
      const payload = {
        merchantId: id,
        name,
        handle,
        countryCode: country,
        currencyCode: currency,
      };
      const fingerprint = JSON.stringify(payload);
      if (createAttempt.current?.payload !== fingerprint) {
        createAttempt.current = { payload: fingerprint, idempotencyKey: key('store') };
      }
      await api.post('/v1/merchant/stores', payload, createAttempt.current.idempotencyKey);
      await onReload();
      navigate({ to: '/app/settings' });
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="setup-layout">
      <div className="setup-card">
        <span className="brand-mark">c.</span>
        <p className="eyebrow">LET'S GET YOUR BUSINESS READY</p>
        <h1>Set up a store</h1>
        <p>Start with the essentials. Configure payments and shipping before publishing.</p>
        <ErrorNotice error={error} />
        <form className="form-stack" onSubmit={submit}>
          {accounts.length ? (
            <label>
              Merchant account
              <select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
                <option value="">Create another account…</option>
              </select>
            </label>
          ) : null}
          {!accountId && (
            <label>
              Business / account name
              <input
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                required
                placeholder="My company"
              />
            </label>
          )}
          <label>
            Store name
            <input
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!handle)
                  setHandle(
                    e.target.value
                      .toLowerCase()
                      .trim()
                      .replace(/[^a-z0-9]+/g, '-')
                      .replace(/^-|-$/g, ''),
                  );
              }}
              maxLength={100}
              placeholder="My Store"
            />
          </label>
          <label>
            Store handle
            <input
              required
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
              minLength={3}
              maxLength={63}
              placeholder="my-store"
            />
          </label>
          <div className="two-col">
            <label>
              Market
              <select
                value={country}
                onChange={(e) => {
                  const next = e.target.value;
                  setCountry(next);
                  setCurrency(
                    (
                      { IN: 'INR', US: 'USD', GB: 'GBP', CA: 'CAD', AU: 'AUD' } as Record<
                        string,
                        string
                      >
                    )[next],
                  );
                }}
              >
                <option value="IN">India</option>
                <option value="US">United States</option>
                <option value="GB">United Kingdom</option>
                <option value="CA">Canada</option>
                <option value="AU">Australia</option>
              </select>
            </label>
            <label>
              Currency
              <input readOnly value={currency} />
            </label>
          </div>
          <button className="btn primary full" disabled={pending}>
            {pending ? 'Creating store…' : 'Create store & continue'}
          </button>
        </form>
        <div className="section-divider" />
        <h3>Joining an existing team?</h3>
        <p>Paste the token from your merchant invitation to join their account and store.</p>
        <form
          className="form-stack"
          onSubmit={async (e) => {
            e.preventDefault();
            setPending(true);
            setError(null);
            try {
              await api.post('/v1/merchant/invitations/accept', { token: invitationToken });
              await onReload();
              navigate({ to: '/app' });
            } catch (e) {
              setError(e);
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            Invitation token
            <input
              required
              minLength={43}
              maxLength={43}
              value={invitationToken}
              onChange={(e) => setInvitationToken(e.target.value)}
            />
          </label>
          <button className="btn" disabled={pending}>
            Accept invitation
          </button>
        </form>
      </div>
    </div>
  );
}
