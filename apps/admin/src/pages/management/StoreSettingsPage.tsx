import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { Link } from '@tanstack/react-router';
import { ErrorNotice, InfoNotice, PageHead, Panel, Status } from '../../components/Ui';
import { useStoreContext } from '../../providers/StoreContext';
import { api, uploadAsset } from '../../lib/api';
import { type Store } from '../../lib/types';

const storePath = (id: string) => `/v1/merchant/stores/${id}`;

export function StoreSettingsPage() {
  const { store, reload } = useStoreContext(),
    qc = useQueryClient(),
    details = useQuery({
      queryKey: ['store-detail', store.id],
      queryFn: () => api.get<Store>(`${storePath(store.id)}`),
    });
  const latest = details.data || store;
  const [name, setName] = useState(store.name),
    [brandingName, setBrandingName] = useState(store.brandingName || store.name),
    [contactEmail, setContactEmail] = useState(store.contactEmail || ''),
    [timezone, setTimezone] = useState(store.timezone || 'Asia/Kolkata'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState('');
  const [logo, setLogo] = useState<File | null>(null);
  useEffect(() => {
    setName(latest.name);
    setBrandingName(latest.brandingName || latest.name);
    setContactEmail(latest.contactEmail || '');
    setTimezone(latest.timezone || 'Asia/Kolkata');
  }, [
    latest.id,
    latest.settingsVersion,
    latest.name,
    latest.brandingName,
    latest.contactEmail,
    latest.timezone,
  ]);
  async function act(operation: () => Promise<unknown>, success: string) {
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      await operation();
      await details.refetch();
      await reload();
      await qc.invalidateQueries({ queryKey: ['dashboard'] });
      setNotice(success);
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  async function uploadLogo() {
    if (!logo) return;
    await act(async () => {
      if (!['image/jpeg', 'image/png'].includes(logo.type) || logo.size > 5242880)
        throw new Error('Choose a JPEG/PNG image up to 5 MiB.');
      const hash = await crypto.subtle.digest('SHA-256', await logo.arrayBuffer());
      const checksum = Array.from(new Uint8Array(hash))
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
      const reservation = await api.post<{
        assetId: string;
        upload: { url: string; headers: Record<string, string> };
      }>(`${storePath(store.id)}/media/reservations`, {
        contentType: logo.type,
        size: logo.size,
        checksum,
      });
      await uploadAsset(reservation.upload.url, logo, reservation.upload.headers);
      await api.post(`${storePath(store.id)}/media/${reservation.assetId}/complete`);
      await api.patch(`${storePath(store.id)}/settings`, {
        expectedVersion: latest.settingsVersion,
        logoAssetId: reservation.assetId,
      });
      setLogo(null);
    }, 'Logo uploaded and saved.');
  }
  return (
    <>
      <PageHead
        eyebrow="YOUR BRAND"
        title="Store settings"
        subtitle="Configure identity, contact information and your publishing status."
      >
        <Status value={latest.status || 'DRAFT'} />
        <Link className="btn" to="/setup">
          Create another store
        </Link>
      </PageHead>
      <div className="content-grid">
        <Panel
          title="Store identity"
          subtitle="Brand name and contact details are used across your storefront."
        >
          <ErrorNotice error={details.error || error} />
          {notice && <div className="notice success">{notice}</div>}
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              void act(
                () =>
                  api.patch(`${storePath(store.id)}/settings`, {
                    expectedVersion: latest.settingsVersion,
                    name,
                    brandingName,
                    contactEmail,
                    timezone,
                  }),
                'Settings saved.',
              );
            }}
          >
            <label>
              Store name
              <input required value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label>
              Public brand name
              <input
                required
                value={brandingName}
                onChange={(e) => setBrandingName(e.target.value)}
              />
            </label>
            <label>
              Contact email
              <input
                required
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </label>
            <label>
              Timezone
              <input
                required
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Kolkata"
              />
            </label>
            <div className="two-col">
              <label>
                Market
                <input disabled value={latest.countryCode} />
              </label>
              <label>
                Currency
                <input disabled value={latest.currencyCode} />
              </label>
            </div>
            <button className="btn primary" disabled={busy}>
              Save store settings
            </button>
          </form>
        </Panel>
        <Panel
          title="Publishing checklist"
          subtitle="An incomplete policy cannot publish. This is enforced by the server."
        >
          <div className="item-list">
            <div className="list-item">
              <span>Store identity and contact</span>
              <CheckCircle2 size={19} />
            </div>
            <div className="list-item">
              <span>Products & product images</span>
              <Link className="link" to="/app/products">
                Manage →
              </Link>
            </div>
            <div className="list-item">
              <span>Shipping, taxes and payment methods</span>
              <Link className="link" to="/app/pricing">
                Configure →
              </Link>
            </div>
          </div>
          <div className="section-divider" />
          <div className="form-stack">
            <h3>Store logo</h3>
            {latest.logoAssetId &&
              (latest.status === 'PUBLISHED' ? (
                <img
                  style={{ width: 120, height: 120, objectFit: 'contain', borderRadius: 12 }}
                  src={`/v1/media/${latest.logoAssetId}`}
                  alt="Current store logo"
                />
              ) : (
                <InfoNotice>
                  Logo is uploaded and verified. Public image preview becomes available once the
                  store is published.
                </InfoNotice>
              ))}
            <label>
              Upload JPEG/PNG (up to 5 MiB)
              <input
                type="file"
                accept="image/jpeg,image/png"
                onChange={(e) => setLogo(e.target.files?.[0] || null)}
              />
            </label>
            <div className="button-row">
              <button className="btn" disabled={busy || !logo} onClick={uploadLogo}>
                Upload logo
              </button>
              {latest.logoAssetId && (
                <button
                  className="btn danger"
                  disabled={busy}
                  onClick={() => {
                    if (confirm('Remove current store logo?'))
                      void act(
                        () =>
                          api.patch(`${storePath(store.id)}/settings`, {
                            expectedVersion: latest.settingsVersion,
                            logoAssetId: null,
                          }),
                        'Logo removed from store settings.',
                      );
                  }}
                >
                  Remove logo
                </button>
              )}
            </div>
            <div className="section-divider" />
            {latest.onboardingState !== 'COMPLETED' && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  act(
                    () =>
                      api.post(`${storePath(store.id)}/onboarding/complete`, {
                        expectedVersion: latest.settingsVersion,
                      }),
                    'Onboarding complete; you can now publish.',
                  )
                }
              >
                Complete onboarding
              </button>
            )}
            {latest.status !== 'PUBLISHED' ? (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  act(() => api.post(`${storePath(store.id)}/publish`), 'Store is published.')
                }
              >
                Publish storefront
              </button>
            ) : (
              <button
                className="btn danger"
                disabled={busy}
                onClick={() => {
                  if (
                    confirm(
                      'Unpublish this store? Existing customers will still retain their order receipts.',
                    )
                  )
                    void act(
                      () => api.post(`${storePath(store.id)}/unpublish`),
                      'Store unpublished.',
                    );
                }}
              >
                Unpublish storefront
              </button>
            )}
            <InfoNotice>
              A published store is accessible through the public catalog API. The consumer
              storefront UI is a separate upcoming phase.
            </InfoNotice>
          </div>
        </Panel>
      </div>
    </>
  );
}
