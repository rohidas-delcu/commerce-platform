import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Search } from 'lucide-react';
import { ErrorNotice, Loading, PageHead, Panel, Status } from '../../components/Ui';
import { useStoreContext } from '../../providers/StoreContext';
import { api } from '../../lib/api';
import { majorToMinor, minorToMoney, pageItems, type Coupon, type Page } from '../../lib/types';

const merchant = (id: string) => `/v1/merchant/stores/${id}`;

export function CouponsPage() {
  const { store } = useStoreContext(),
    qc = useQueryClient();
  const [code, setCode] = useState(''),
    [kind, setKind] = useState<'FIXED' | 'PERCENTAGE'>('PERCENTAGE'),
    [value, setValue] = useState(''),
    [maxUses, setMaxUses] = useState(''),
    [query, setQuery] = useState(''),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    setCode('');
    setKind('PERCENTAGE');
    setValue('');
    setMaxUses('');
    setQuery('');
    setError(null);
  }, [store.id]);
  const list = useQuery({
    queryKey: ['coupons', store.id, query],
    queryFn: () =>
      api.get<Page<Coupon>>(
        `${merchant(store.id)}/coupons?limit=100${query ? `&query=${encodeURIComponent(query)}` : ''}`,
      ),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['coupons', store.id] });
  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const raw = majorToMinor(value);
      if (kind === 'PERCENTAGE' && (BigInt(raw) < 1n || BigInt(raw) > 10000n))
        throw new Error('Enter a percentage between 0.01 and 100.');
      await api.post(`${merchant(store.id)}/coupons`, {
        code,
        kind,
        value: raw,
        maxUses: maxUses ? Number(maxUses) : null,
      });
      setCode('');
      setValue('');
      setMaxUses('');
      await refresh();
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="PROMOTIONS"
        title="Discounts"
        subtitle="Create coupons with server-enforced quotas, per-customer restrictions and expiry."
      />
      <div className="content-grid">
        <Panel title="New discount" subtitle="Codes are unique within this store.">
          <ErrorNotice error={error} />
          <form onSubmit={create} className="form-stack">
            <label>
              Coupon code
              <input
                required
                minLength={3}
                maxLength={40}
                pattern="[A-Za-z0-9_-]+"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="WELCOME10"
              />
            </label>
            <label>
              Type
              <select
                value={kind}
                onChange={(e) => setKind(e.target.value as 'FIXED' | 'PERCENTAGE')}
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FIXED">Fixed amount</option>
              </select>
            </label>
            <label>
              {kind === 'PERCENTAGE' ? 'Percent off' : 'Amount off (' + store.currencyCode + ')'}
              <input
                required
                inputMode="decimal"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={kind === 'PERCENTAGE' ? '10.00' : '250.00'}
              />
            </label>
            <label>
              Max redemptions (optional)
              <input
                type="number"
                min={1}
                value={maxUses}
                onChange={(e) => setMaxUses(e.target.value)}
              />
            </label>
            <button className="btn primary" disabled={busy}>
              {busy ? 'Saving…' : 'Create discount'}
            </button>
          </form>
        </Panel>
        <Panel title="Discount codes">
          <label className="search-input">
            <Search size={16} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by code"
            />
          </label>
          <ErrorNotice error={list.error} />
          {list.isPending ? (
            <Loading />
          ) : (
            <div className="item-list">
              {pageItems(list.data).map((c) => (
                <div className="list-item" key={c.id}>
                  <div>
                    <strong>{c.code}</strong>
                    <small>
                      {c.kind === 'PERCENTAGE'
                        ? `${Number(c.value) / 100}% off`
                        : minorToMoney(c.value, store.currencyCode)}
                      {c.maxUses ? ` · Max ${c.maxUses} redemptions` : ''}
                    </small>
                  </div>
                  <div className="button-row">
                    <Status value={c.active ? 'ACTIVE' : 'ARCHIVED'} />
                    {c.active && (
                      <button
                        className="btn small danger"
                        onClick={async () => {
                          if (!confirm(`Archive ${c.code}?`)) return;
                          try {
                            await api.post(`${merchant(store.id)}/coupons/${c.id}/archive`, {
                              expectedVersion: c.version,
                            });
                            await refresh();
                          } catch (e) {
                            setError(e);
                          }
                        }}
                      >
                        Archive
                      </button>
                    )}
                  </div>
                </div>
              ))}
              {!pageItems(list.data).length && <p className="empty-copy">No coupons found.</p>}
            </div>
          )}
        </Panel>
      </div>
    </>
  );
}
