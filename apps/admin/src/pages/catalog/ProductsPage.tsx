import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Archive, Boxes, ImagePlus, Plus, Search, X } from 'lucide-react';
import { ErrorNotice, Loading, PageHead, Panel, Status } from '../../components/Ui';
import { useStoreContext } from '../../providers/StoreContext';
import { api, uploadAsset } from '../../lib/api';
import {
  majorToMinor,
  minorToMajor,
  minorToMoney,
  pageItems,
  type Page,
  type Product,
  type Variant,
} from '../../lib/types';

const base = (id: string) => `/v1/merchant/stores/${id}`;
const slug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function ProductsPage() {
  const { store } = useStoreContext(),
    qc = useQueryClient();
  const [query, setQuery] = useState(''),
    [filter, setFilter] = useState(''),
    [offset, setOffset] = useState(0);
  const [selected, setSelected] = useState<string | null>(null),
    [newOpen, setNewOpen] = useState(false);
  useEffect(() => {
    setSelected(null);
    setNewOpen(false);
    setQuery('');
    setFilter('');
    setOffset(0);
  }, [store.id]);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ['products', store.id, query, filter, offset],
    queryFn: () =>
      api.get<Page<Product>>(
        `${base(store.id)}/products?limit=25&offset=${offset}${query ? `&query=${encodeURIComponent(query)}` : ''}${filter ? `&status=${filter}` : ''}`,
      ),
  });
  const details = useQuery({
    queryKey: ['product', store.id, selected],
    queryFn: () => api.get<Product>(`${base(store.id)}/products/${selected}`),
    enabled: !!selected,
  });
  const invalidate = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['products', store.id] }),
      qc.invalidateQueries({ queryKey: ['product', store.id] }),
    ]);
  };
  return (
    <>
      <PageHead
        eyebrow="YOUR CATALOG"
        title="Products"
        subtitle="Everything you sell, organized for every connected storefront."
      >
        <button className="btn primary" onClick={() => setNewOpen(true)}>
          <Plus size={16} /> Add product
        </button>
      </PageHead>
      <Panel>
        <div className="table-tools">
          <label className="search-input">
            <Search size={16} />
            <input
              aria-label="Search products"
              placeholder="Search products"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setOffset(0);
              }}
            />
          </label>
          <select
            aria-label="Filter status"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value);
              setOffset(0);
            }}
          >
            <option value="">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <button className="btn small" onClick={() => refetch()}>
            Refresh
          </button>
        </div>
        <ErrorNotice error={error} />
        {isPending ? (
          <Loading text="Loading products…" />
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PRODUCT</th>
                    <th>STATUS</th>
                    <th>VARIANTS</th>
                    <th>PRICE</th>
                    <th>COLLECTION</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems(data).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <div className="product-cell">
                          {p.images?.[0]?.url ? (
                            <img src={p.images[0].url} alt="" />
                          ) : (
                            <span className="product-placeholder">
                              <Boxes size={20} />
                            </span>
                          )}
                          <strong>{p.name}</strong>
                        </div>
                      </td>
                      <td>
                        <Status value={p.status} />
                      </td>
                      <td>{p.variants?.length ?? 0}</td>
                      <td>{minorToMoney(p.priceMinor, store.currencyCode)}</td>
                      <td>{p.collection || '—'}</td>
                      <td>
                        <button className="link" onClick={() => setSelected(p.id)}>
                          Edit details
                        </button>
                      </td>
                    </tr>
                  ))}
                  {!pageItems(data).length && (
                    <tr>
                      <td colSpan={6} className="empty-table">
                        No products found. Add your first product to begin.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <span>
                Showing {offset + 1}–{offset + pageItems(data).length} (bounded results)
              </span>
              <button
                className="btn small"
                disabled={offset === 0}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                Previous
              </button>
              <button
                className="btn small"
                disabled={data?.nextOffset == null}
                onClick={() => setOffset(data!.nextOffset!)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </Panel>
      {newOpen && (
        <ProductDialog
          storeId={store.id}
          currency={store.currencyCode}
          close={() => setNewOpen(false)}
          done={invalidate}
        />
      )}
      {selected && (
        <div
          className="overlay"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setSelected(null);
          }}
        >
          <section className="drawer" role="dialog" aria-modal="true" aria-label="Edit product">
            <header>
              <h2>Edit product</h2>
              <button className="icon-button" aria-label="Close" onClick={() => setSelected(null)}>
                <X size={20} />
              </button>
            </header>
            {details.isPending ? (
              <Loading />
            ) : details.error ? (
              <ErrorNotice error={details.error} />
            ) : (
              details.data && (
                <EditProduct
                  storeId={store.id}
                  currency={store.currencyCode}
                  product={details.data}
                  done={invalidate}
                  close={() => setSelected(null)}
                />
              )
            )}
          </section>
        </div>
      )}
    </>
  );
}

function ProductDialog({
  storeId,
  currency,
  close,
  done,
}: {
  storeId: string;
  currency: string;
  close: () => void;
  done: () => Promise<void>;
}) {
  const [name, setName] = useState(''),
    [handle, setHandle] = useState(''),
    [price, setPrice] = useState(''),
    [compare, setCompare] = useState(''),
    [sku, setSku] = useState(''),
    [stock, setStock] = useState('0'),
    [collection, setCollection] = useState(''),
    [description, setDescription] = useState('');
  const [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(null);
  async function submit(e: FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);
    try {
      const priceMinor = majorToMinor(price);
      await api.post(`${base(storeId)}/products`, {
        name,
        handle,
        description,
        collection,
        priceMinor,
        compareMinor: compare ? majorToMinor(compare) : null,
        variants: [{ name: 'Default', sku, stock: Number(stock) }],
      });
      await done();
      close();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <section className="drawer" role="dialog" aria-modal="true" aria-label="Create product">
        <header>
          <h2>Add product</h2>
          <button className="icon-button" onClick={close} aria-label="Close">
            <X size={20} />
          </button>
        </header>
        <form className="form-stack drawer-form" onSubmit={submit}>
          <ErrorNotice error={error} />
          <label>
            Product name
            <input
              required
              value={name}
              maxLength={150}
              onChange={(e) => {
                setName(e.target.value);
                if (!handle) setHandle(slug(e.target.value));
              }}
              placeholder="Everyday watch"
            />
          </label>
          <label>
            URL handle
            <input
              required
              value={handle}
              maxLength={63}
              onChange={(e) => setHandle(e.target.value)}
              pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
            />
          </label>
          <label>
            Description
            <textarea
              rows={4}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
          <div className="two-col">
            <label>
              Price ({currency})
              <input
                required
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="2499.00"
                inputMode="decimal"
              />
            </label>
            <label>
              Compare at ({currency})
              <input
                value={compare}
                onChange={(e) => setCompare(e.target.value)}
                placeholder="2999.00"
                inputMode="decimal"
              />
            </label>
          </div>
          <label>
            Collection / category
            <input
              value={collection}
              onChange={(e) => setCollection(e.target.value)}
              maxLength={150}
            />
          </label>
          <div className="two-col">
            <label>
              SKU
              <input
                required
                minLength={2}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="WATCH-01"
              />
            </label>
            <label>
              Initial stock
              <input
                type="number"
                required
                min={0}
                max={2000000000}
                value={stock}
                onChange={(e) => setStock(e.target.value)}
              />
            </label>
          </div>
          <p className="form-hint">
            Products begin in draft. Upload images and activate when ready.
          </p>
          <button className="btn primary full" disabled={pending}>
            {pending ? 'Saving…' : 'Create draft product'}
          </button>
        </form>
      </section>
    </div>
  );
}

function EditProduct({
  storeId,
  currency,
  product,
  close,
  done,
}: {
  storeId: string;
  currency: string;
  product: Product;
  close: () => void;
  done: () => Promise<void>;
}) {
  const [name, setName] = useState(product.name),
    [description, setDescription] = useState(product.description || ''),
    [price, setPrice] = useState(minorToMajor(product.priceMinor)),
    [pending, setPending] = useState(false),
    [error, setError] = useState<unknown>(null);
  const [file, setFile] = useState<File | null>(null),
    [variantName, setVariantName] = useState(''),
    [variantSku, setVariantSku] = useState(''),
    [variantPrice, setVariantPrice] = useState('');
  useEffect(() => {
    setName(product.name);
    setDescription(product.description || '');
    setPrice(minorToMajor(product.priceMinor));
  }, [product.id, product.version, product.name, product.description, product.priceMinor]);
  async function act(work: () => Promise<unknown>) {
    setPending(true);
    setError(null);
    try {
      await work();
      await done();
    } catch (e) {
      setError(e);
    } finally {
      setPending(false);
    }
  }
  async function upload() {
    if (!file) return;
    await act(async () => {
      if (file.size > 5_242_880) throw new Error('Maximum image size is 5 MiB.');
      if (!['image/jpeg', 'image/png'].includes(file.type))
        throw new Error('Only JPEG/PNG are accepted.');
      const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
      const checksum = Array.from(new Uint8Array(digest))
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
      const r = await api.post<{
        assetId: string;
        upload: { url: string; headers: Record<string, string> };
      }>(`${base(storeId)}/media/reservations`, {
        contentType: file.type,
        size: file.size,
        checksum,
      });
      await uploadAsset(r.upload.url, file, r.upload.headers);
      await api.post(`${base(storeId)}/media/${r.assetId}/complete`);
      const latest = await api.get<Product>(`${base(storeId)}/products/${product.id}`);
      const existing = latest.images || [];
      await api.put(`${base(storeId)}/products/${product.id}/images`, {
        expectedVersion: latest.version,
        assetIds: [...existing.map((i) => i.id), r.assetId],
        primaryAssetId: existing.find((i) => i.primary)?.id || r.assetId,
        altTexts: { [r.assetId]: name },
      });
      setFile(null);
    });
  }
  return (
    <div className="drawer-form form-stack">
      <ErrorNotice error={error} />
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void act(() =>
            api.patch(`${base(storeId)}/products/${product.id}`, {
              name,
              description,
              priceMinor: majorToMinor(price),
            }),
          );
        }}
      >
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>
        <label>
          Description
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
        </label>
        <label>
          Price ({currency})
          <input value={price} onChange={(e) => setPrice(e.target.value)} required />
        </label>
        <button className="btn primary" disabled={pending}>
          Save changes
        </button>
      </form>
      <div className="section-divider" />
      <h3>Images</h3>
      {(product.images || []).length ? (
        <div className="image-grid">
          {product.images!.map((i) => (
            <img key={i.id} src={i.url} alt={i.altText || ''} />
          ))}
        </div>
      ) : (
        <p className="form-hint">No images yet.</p>
      )}
      <label>
        Upload PNG/JPEG (5 MiB max)
        <input
          type="file"
          accept="image/png,image/jpeg"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
        />
      </label>
      <button className="btn" disabled={pending || !file} onClick={upload}>
        <ImagePlus size={16} /> Upload image
      </button>
      <div className="section-divider" />
      <h3>Variants and inventory</h3>
      {(product.variants || []).map((v) => (
        <VariantEditor key={v.id} storeId={storeId} variant={v} currency={currency} done={done} />
      ))}
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          void act(async () => {
            await api.post(`${base(storeId)}/products/${product.id}/variants`, {
              name: variantName,
              sku: variantSku,
              ...(variantPrice ? { priceMinor: majorToMinor(variantPrice) } : {}),
            });
            setVariantName('');
            setVariantSku('');
            setVariantPrice('');
          });
        }}
      >
        <h3>Add a variant</h3>
        <div className="two-col">
          <label>
            Variant name
            <input
              value={variantName}
              onChange={(e) => setVariantName(e.target.value)}
              minLength={1}
              maxLength={100}
              required
              placeholder="Medium / Blue"
            />
          </label>
          <label>
            SKU
            <input
              value={variantSku}
              onChange={(e) => setVariantSku(e.target.value)}
              minLength={2}
              maxLength={80}
              required
              placeholder="TSHIRT-M-BLUE"
            />
          </label>
        </div>
        <label>
          Price override ({currency}, optional)
          <input
            value={variantPrice}
            onChange={(e) => setVariantPrice(e.target.value)}
            placeholder="Leave blank to inherit product price"
          />
        </label>
        <button className="btn" disabled={pending}>
          <Plus size={15} /> Add variant
        </button>
      </form>
      <div className="section-divider" />
      <h3>Publication</h3>
      <Status value={product.status} />
      <div className="button-row">
        {product.status === 'DRAFT' && (
          <button
            className="btn primary"
            disabled={pending}
            onClick={() => act(() => api.post(`${base(storeId)}/products/${product.id}/activate`))}
          >
            Activate
          </button>
        )}
        {product.status === 'ACTIVE' && (
          <button
            className="btn"
            disabled={pending}
            onClick={() =>
              act(() => api.post(`${base(storeId)}/products/${product.id}/deactivate`))
            }
          >
            Move to draft
          </button>
        )}
        {product.status !== 'ARCHIVED' && (
          <button
            className="btn danger"
            disabled={pending}
            onClick={() => {
              if (confirm('Archive this product?'))
                void act(() => api.post(`${base(storeId)}/products/${product.id}/archive`));
            }}
          >
            <Archive size={15} /> Archive
          </button>
        )}
      </div>
      <button className="btn" onClick={close}>
        Close
      </button>
    </div>
  );
}

function VariantEditor({
  storeId,
  variant,
  currency,
  done,
}: {
  storeId: string;
  variant: Variant;
  currency: string;
  done: () => Promise<void>;
}) {
  const [quantity, setQuantity] = useState(String(variant.stock ?? variant.onHand ?? 0)),
    [reason, setReason] = useState('STOCK_COUNT'),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>(null);
  useEffect(
    () => setQuantity(String(variant.stock ?? variant.onHand ?? 0)),
    [variant.stock, variant.onHand],
  );
  return (
    <div className="variant-row">
      <div>
        <strong>{variant.name}</strong>
        <small>
          {variant.sku} · {minorToMoney(variant.priceMinor ?? 0, currency)} override
        </small>
      </div>
      <label>
        Count
        <input
          type="number"
          min={0}
          max={2000000000}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
        />
      </label>
      <label>
        Reason
        <select value={reason} onChange={(e) => setReason(e.target.value)}>
          <option>STOCK_COUNT</option>
          <option>RECEIVED</option>
          <option>DAMAGED</option>
          <option>RETURNED</option>
          <option>OTHER</option>
        </select>
      </label>
      <button
        className="btn small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await api.post(`${base(storeId)}/variants/${variant.id}/stock-adjustments`, {
              quantity: Number(quantity),
              reason,
            });
            await done();
          } catch (e) {
            setError(e);
          } finally {
            setBusy(false);
          }
        }}
      >
        Update
      </button>
      <ErrorNotice error={error} />
    </div>
  );
}
