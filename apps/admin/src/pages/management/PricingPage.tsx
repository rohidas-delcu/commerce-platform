import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2 } from 'lucide-react';
import { ErrorNotice, InfoNotice, Loading, PageHead, Panel } from '../../components/Ui';
import { useStoreContext } from '../../providers/StoreContext';
import { api } from '../../lib/api';
import { majorToMinor, minorToMajor, minorToMoney, type Pricing } from '../../lib/types';

const storePath = (id: string) => `/v1/merchant/stores/${id}`;

const initialPolicy: Pricing = {
  version: 0,
  shipping: [],
  tax: { mode: 'NONE', shippingTaxable: false, rates: [] },
  payments: { cod: false, simulator: false },
};

export function PricingPage() {
  const { store } = useStoreContext(),
    qc = useQueryClient();
  const pricing = useQuery({
    queryKey: ['pricing', store.id],
    queryFn: () => api.get<Pricing>(`${storePath(store.id)}/pricing`),
  });
  const [policy, setPolicy] = useState<Pricing>(initialPolicy),
    [name, setName] = useState('Standard delivery'),
    [id, setId] = useState('standard'),
    [rate, setRate] = useState('79.00'),
    [freeAbove, setFreeAbove] = useState(''),
    [country, setCountry] = useState(store.countryCode),
    [taxRates, setTaxRates] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null),
    [notice, setNotice] = useState('');
  useEffect(() => {
    setPolicy(pricing.data ?? initialPolicy);
    setTaxRates(
      Object.fromEntries(
        (pricing.data?.tax.rates ?? []).map((r) => [
          r.countryCode,
          minorToMajor(String(r.basisPoints)),
        ]),
      ),
    );
    setCountry(store.countryCode);
    setError(null);
    setNotice('');
  }, [store.id, store.countryCode, pricing.data]);
  const shippingCountries = [
    ...new Set(policy.shipping.filter((m) => m.active).flatMap((m) => m.countries)),
  ];
  function addShipping() {
    try {
      const method = {
        id,
        name,
        countries: [country],
        rateMinor: majorToMinor(rate),
        freeAboveMinor: freeAbove ? majorToMinor(freeAbove) : null,
        active: true,
      };
      setPolicy((p) => ({ ...p, shipping: [...p.shipping.filter((m) => m.id !== id), method] }));
      setError(null);
    } catch (e) {
      setError(e);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice('');
    try {
      const rates =
        policy.tax.mode === 'NONE'
          ? []
          : shippingCountries.map((countryCode) => {
              if (!taxRates[countryCode])
                throw new Error(`Enter the tax percentage for ${countryCode}.`);
              const points = BigInt(majorToMinor(taxRates[countryCode]));
              if (points > 10000n) throw new Error(`Tax for ${countryCode} must not exceed 100%.`);
              return { countryCode, basisPoints: Number(points) };
            });
      const tax = { ...policy.tax, rates };
      await api.put(`${storePath(store.id)}/pricing`, { ...policy, tax });
      await qc.invalidateQueries({ queryKey: ['pricing', store.id] });
      setNotice('Shipping, tax and payment configuration saved.');
    } catch (e) {
      setError(e);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <PageHead
        eyebrow="COMMERCE POLICIES"
        title="Shipping & payments"
        subtitle="Set fulfillment methods, tax policy and allowed checkout methods before publishing."
      />
      {pricing.isPending ? (
        <Loading />
      ) : (
        <>
          <ErrorNotice error={pricing.error || error} />
          {notice && <div className="notice success">{notice}</div>}
          <form onSubmit={save} className="content-grid">
            <Panel
              title="Shipping methods"
              subtitle="Each destination must have an active supported shipping method."
            >
              <div className="item-list">
                {policy.shipping.map((m) => (
                  <div className="list-item" key={m.id}>
                    <div>
                      <strong>{m.name}</strong>
                      <small>
                        {m.countries.join(', ')} · {minorToMoney(m.rateMinor, store.currencyCode)}
                        {m.freeAboveMinor
                          ? ` · Free above ${minorToMoney(m.freeAboveMinor, store.currencyCode)}`
                          : ''}
                      </small>
                    </div>
                    <button
                      type="button"
                      className="icon-button"
                      aria-label={`Remove ${m.name}`}
                      onClick={() =>
                        setPolicy((p) => ({
                          ...p,
                          shipping: p.shipping.filter((x) => x.id !== m.id),
                        }))
                      }
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                ))}
                {!policy.shipping.length && (
                  <p className="empty-copy">No shipping methods configured.</p>
                )}
              </div>
              <div className="section-divider" />
              <div className="two-col">
                <label>
                  Shipping name
                  <input value={name} onChange={(e) => setName(e.target.value)} />
                </label>
                <label>
                  Method ID
                  <input
                    value={id}
                    onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                  />
                </label>
              </div>
              <div className="two-col">
                <label>
                  Country
                  <select value={country} onChange={(e) => setCountry(e.target.value)}>
                    <option value="IN">India</option>
                    <option value="US">United States</option>
                    <option value="GB">United Kingdom</option>
                    <option value="CA">Canada</option>
                    <option value="AU">Australia</option>
                  </select>
                </label>
                <label>
                  Fee ({store.currencyCode})
                  <input value={rate} onChange={(e) => setRate(e.target.value)} />
                </label>
              </div>
              <label>
                Free shipping threshold (optional)
                <input
                  value={freeAbove}
                  placeholder="2500.00"
                  onChange={(e) => setFreeAbove(e.target.value)}
                />
              </label>
              <button type="button" className="btn" onClick={addShipping}>
                <Plus size={15} /> Add method
              </button>
            </Panel>
            <Panel
              title="Tax and checkout"
              subtitle="No tax rate is assumed. Enter the correct local legal policy before selling."
            >
              <div className="form-stack">
                <label>
                  Tax calculation
                  <select
                    value={policy.tax.mode}
                    onChange={(e) =>
                      setPolicy((p) => ({
                        ...p,
                        tax: { ...p.tax, mode: e.target.value as Pricing['tax']['mode'] },
                      }))
                    }
                  >
                    <option value="NONE">No tax configured</option>
                    <option value="EXCLUSIVE">Exclusive of listed prices</option>
                    <option value="INCLUSIVE">Inclusive in listed prices</option>
                  </select>
                </label>
                {policy.tax.mode !== 'NONE' &&
                  shippingCountries.map((c) => (
                    <label key={c}>
                      Tax percentage for {c}
                      <input
                        required
                        value={taxRates[c] || ''}
                        onChange={(e) => setTaxRates((p) => ({ ...p, [c]: e.target.value }))}
                        inputMode="decimal"
                        placeholder="Enter applicable rate"
                      />
                    </label>
                  ))}
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={policy.tax.shippingTaxable}
                    onChange={(e) =>
                      setPolicy((p) => ({
                        ...p,
                        tax: { ...p.tax, shippingTaxable: e.target.checked },
                      }))
                    }
                  />{' '}
                  Tax applies to shipping
                </label>
                <div className="section-divider" />
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={policy.payments.cod}
                    onChange={(e) =>
                      setPolicy((p) => ({
                        ...p,
                        payments: { ...p.payments, cod: e.target.checked },
                      }))
                    }
                  />{' '}
                  Cash on delivery
                </label>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={policy.payments.simulator}
                    onChange={(e) =>
                      setPolicy((p) => ({
                        ...p,
                        payments: { ...p.payments, simulator: e.target.checked },
                      }))
                    }
                  />{' '}
                  Development simulator <small>(non-production only)</small>
                </label>
                <InfoNotice>
                  Real payment provider settlement is not enabled. Enable only the methods the
                  merchant can actually honor.
                </InfoNotice>
                <button disabled={busy} className="btn primary full">
                  {busy ? 'Saving…' : 'Save pricing policy'}
                </button>
              </div>
            </Panel>
          </form>
        </>
      )}
    </>
  );
}
