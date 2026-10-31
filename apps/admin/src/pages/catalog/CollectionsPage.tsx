import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil } from 'lucide-react';
import { ErrorNotice, Loading, PageHead, Panel } from '../../components/Ui';
import { useStoreContext } from '../../providers/StoreContext';
import { api } from '../../lib/api';
import { pageItems, type Collection, type Page, type Product } from '../../lib/types';

const base = (id: string) => `/v1/merchant/stores/${id}`;
const slug = (s: string) =>
  s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function CollectionsPage() {
  const { store } = useStoreContext(),
    qc = useQueryClient();
  const [name, setName] = useState(''),
    [handle, setHandle] = useState(''),
    [description, setDescription] = useState(''),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false),
    [editing, setEditing] = useState<Collection | null>(null);
  useEffect(() => {
    setName('');
    setHandle('');
    setDescription('');
    setEditing(null);
    setError(null);
  }, [store.id]);
  const {
    data,
    isPending,
    error: loadError,
  } = useQuery({
    queryKey: ['collections', store.id],
    queryFn: () => api.get<Page<Collection>>(`${base(store.id)}/collections?limit=100`),
  });
  const refresh = () => qc.invalidateQueries({ queryKey: ['collections', store.id] });
  async function save(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (editing)
        await api.patch(`${base(store.id)}/collections/${editing.id}`, {
          expectedVersion: editing.version,
          name,
          handle,
          description,
        });
      else await api.post(`${base(store.id)}/collections`, { name, handle, description });
      setEditing(null);
      setName('');
      setHandle('');
      setDescription('');
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
        eyebrow="MERCHANDISING"
        title="Collections"
        subtitle="Group products into featured categories for the storefront."
      />
      <div className="content-grid">
        <Panel
          title={editing ? 'Edit collection' : 'New collection'}
          subtitle="Use a unique, shareable handle."
        >
          <ErrorNotice error={error} />
          <form className="form-stack" onSubmit={save}>
            <label>
              Name
              <input
                required
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (!handle) setHandle(slug(e.target.value));
                }}
                maxLength={150}
              />
            </label>
            <label>
              Handle
              <input
                required
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                maxLength={63}
              />
            </label>
            <label>
              Description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </label>
            <div className="button-row">
              <button disabled={busy} className="btn primary">
                {editing ? 'Save changes' : 'Create collection'}
              </button>
              {editing && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setEditing(null);
                    setName('');
                    setHandle('');
                    setDescription('');
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        </Panel>
        <Panel
          title="Your collections"
          subtitle="Edit details or assign products to each collection."
        >
          <ErrorNotice error={loadError} />
          {isPending ? (
            <Loading />
          ) : (
            <div className="item-list">
              {pageItems(data).map((c) => (
                <div className="list-item" key={c.id}>
                  <div>
                    <strong>{c.name}</strong>
                    <small>
                      /{c.handle} · {c.status || 'ACTIVE'} {c.featured ? '· Featured' : ''}
                    </small>
                  </div>
                  <div className="button-row">
                    <button
                      className="btn small"
                      onClick={() => {
                        setEditing(c);
                        setName(c.name);
                        setHandle(c.handle);
                        setDescription(c.description || '');
                      }}
                    >
                      <Pencil size={14} /> Edit
                    </button>
                    <button
                      className="btn small"
                      onClick={() => {
                        setEditing(c);
                        setName(c.name);
                        setHandle(c.handle);
                        setDescription(c.description || '');
                      }}
                    >
                      Products
                    </button>
                    <button
                      className="btn small danger"
                      onClick={async () => {
                        if (!confirm('Archive this collection?')) return;
                        try {
                          await api.post(`${base(store.id)}/collections/${c.id}/archive`, {
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
                  </div>
                </div>
              ))}
              {!pageItems(data).length && <p className="empty-copy">No collections yet.</p>}
            </div>
          )}
        </Panel>
      </div>
      {editing && <CollectionProducts storeId={store.id} collectionId={editing.id} />}
    </>
  );
}

function CollectionProducts({ storeId, collectionId }: { storeId: string; collectionId: string }) {
  const qc = useQueryClient(),
    [productId, setProductId] = useState(''),
    [error, setError] = useState<unknown>(null),
    [busy, setBusy] = useState(false);
  const detail = useQuery({
    queryKey: ['collection', storeId, collectionId],
    queryFn: () => api.get<Collection>(`${base(storeId)}/collections/${collectionId}`),
  });
  const assigned = useQuery({
    queryKey: ['collection-products', storeId, collectionId],
    queryFn: () =>
      api.get<Page<Product>>(`${base(storeId)}/collections/${collectionId}/products?limit=100`),
  });
  const catalog = useQuery({
    queryKey: ['collection-catalog', storeId],
    queryFn: () => api.get<Page<Product>>(`${base(storeId)}/products?limit=100`),
  });
  const refresh = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ['collection', storeId, collectionId] }),
      qc.invalidateQueries({ queryKey: ['collection-products', storeId, collectionId] }),
    ]);
  };
  const selected = pageItems(assigned.data),
    available = pageItems(catalog.data).filter((p) => !selected.some((s) => s.id === p.id));
  return (
    <Panel
      title={`Products in ${detail.data?.name || 'collection'}`}
      subtitle="Manage the first 100 products shown in the selector; the server enforces collection versioning."
    >
      <ErrorNotice error={error || assigned.error || detail.error} />
      <div className="item-list">
        {selected.map((p) => (
          <div className="list-item" key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <small>{p.handle}</small>
            </div>
            <button
              className="btn small danger"
              disabled={busy}
              onClick={async () => {
                if (!detail.data) return;
                setBusy(true);
                try {
                  await api.delete(
                    `${base(storeId)}/collections/${collectionId}/products/${p.id}`,
                    { expectedVersion: detail.data.version },
                  );
                  await refresh();
                } catch (e) {
                  setError(e);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Remove
            </button>
          </div>
        ))}
        {!selected.length && <p className="empty-copy">No products linked yet.</p>}
      </div>
      <div className="two-col">
        <label>
          Product
          <select value={productId} onChange={(e) => setProductId(e.target.value)}>
            <option value="">Choose product…</option>
            {available.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          className="btn primary"
          disabled={!productId || busy || !detail.data}
          onClick={async () => {
            if (!detail.data) return;
            setBusy(true);
            setError(null);
            try {
              await api.put(`${base(storeId)}/collections/${collectionId}/products/${productId}`, {
                expectedVersion: detail.data.version,
                position: selected.length,
              });
              setProductId('');
              await refresh();
            } catch (e) {
              setError(e);
            } finally {
              setBusy(false);
            }
          }}
        >
          Add to collection
        </button>
      </div>
    </Panel>
  );
}
