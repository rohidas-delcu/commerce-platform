import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ErrorNotice, InfoNotice, Loading, PageHead, Panel, Status } from '../../components/Ui';
import { useStoreContext } from '../../providers/StoreContext';
import { api } from '../../lib/api';
import { minorToMoney, pageItems, type Page } from '../../lib/types';

const merchant = (id: string) => `/v1/merchant/stores/${id}`;

interface Payment {
  id: string;
  orderId?: string;
  status?: string;
  state?: string;
  amountMinor?: string;
  currencyCode?: string;
  provider?: string;
  method?: string;
  createdAt?: string;
}
export function FinancePage() {
  const { store } = useStoreContext(),
    [offset, setOffset] = useState(0);
  const payments = useQuery({
    queryKey: ['finance', store.id, offset],
    queryFn: () =>
      api.get<Page<Payment>>(`${merchant(store.id)}/payments?limit=25&offset=${offset}`),
  });
  return (
    <>
      <PageHead
        eyebrow="FINANCIAL OPERATIONS"
        title="Payments & refunds"
        subtitle="Track confirmed payments, uncertain outcomes and financial adjustments."
      />
      <InfoNotice>
        Gateway activation is disabled. Simulator records are development-only and are not bank
        settlements. COD collection is confirmed from the order detail screen.
      </InfoNotice>
      <Panel title="Payment attempts" subtitle="Payment records are scoped to the selected store.">
        <ErrorNotice error={payments.error} />
        {payments.isPending ? (
          <Loading />
        ) : (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>PAYMENT</th>
                    <th>METHOD</th>
                    <th>STATUS</th>
                    <th>AMOUNT</th>
                    <th>CREATED</th>
                  </tr>
                </thead>
                <tbody>
                  {pageItems(payments.data).map((p) => (
                    <tr key={p.id}>
                      <td>
                        <span className="code-label">{p.id.slice(0, 12)}</span>
                      </td>
                      <td>{p.method || p.provider || '—'}</td>
                      <td>
                        <Status value={p.state || p.status} />
                      </td>
                      <td>{minorToMoney(p.amountMinor, store.currencyCode)}</td>
                      <td>{p.createdAt ? new Date(p.createdAt).toLocaleString() : '—'}</td>
                    </tr>
                  ))}
                  {!pageItems(payments.data).length && (
                    <tr>
                      <td className="empty-table" colSpan={5}>
                        No payments found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="pagination">
              <button
                className="btn small"
                disabled={!offset}
                onClick={() => setOffset(Math.max(0, offset - 25))}
              >
                Previous
              </button>
              <button
                className="btn small"
                disabled={payments.data?.nextOffset == null}
                onClick={() => setOffset(payments.data!.nextOffset!)}
              >
                Next
              </button>
            </div>
          </>
        )}
      </Panel>
    </>
  );
}
