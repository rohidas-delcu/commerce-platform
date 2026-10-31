import { useQuery } from '@tanstack/react-query';
import { ErrorNotice, Loading, PageHead, Panel } from '../../components/Ui';
import { useStoreContext } from '../../providers/StoreContext';
import { api } from '../../lib/api';
import { pageItems, type Page, type Product } from '../../lib/types';

const base = (id: string) => `/v1/merchant/stores/${id}`;
export function InventoryPage() {
  const { store } = useStoreContext();
  const { data, isPending, error } = useQuery({
    queryKey: ['products', 'inventory', store.id],
    queryFn: () => api.get<Page<Product>>(`${base(store.id)}/products?limit=100`),
  });
  const movements = useQuery({
    queryKey: ['inventory-movements', store.id],
    queryFn: () => api.get<unknown>(`${base(store.id)}/inventory-movements`),
  });
  return (
    <>
      <PageHead
        eyebrow="STOCK CONTROL"
        title="Inventory"
        subtitle="On-hand and available stock are server-authoritative. Adjustments generate immutable movements."
      />
      <Panel>
        <ErrorNotice error={error} />
        {isPending ? (
          <Loading />
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PRODUCT</th>
                  <th>VARIANT</th>
                  <th>SKU</th>
                  <th>ON HAND</th>
                  <th>AVAILABLE</th>
                </tr>
              </thead>
              <tbody>
                {pageItems(data).flatMap((p) =>
                  (p.variants || []).map((v) => (
                    <tr key={v.id}>
                      <td>{p.name}</td>
                      <td>{v.name}</td>
                      <td>{v.sku}</td>
                      <td>{v.onHand ?? v.stock ?? '—'}</td>
                      <td>{v.available ?? '—'}</td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
      <Panel
        title="Recent stock movements"
        subtitle="The ledger is read-only; perform stock counts from product detail."
      >
        <ErrorNotice error={movements.error} />
        <pre className="json-panel">
          {movements.isPending ? 'Loading…' : JSON.stringify(movements.data || [], null, 2)}
        </pre>
      </Panel>
    </>
  );
}
