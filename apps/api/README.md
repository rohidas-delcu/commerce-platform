# Commerce API — Milestone 1

Copy `.env.example` to `apps/api/.env`, run `pnpm install --frozen-lockfile` and `pnpm db:generate`, then `pnpm --filter @commerce/api dev` from the repository root. Swagger documentation is available at `http://localhost:3000/docs`.

The API is deliberately **development only** until real merchant identity and authorization are integrated. Demo auth requires `DEMO_AUTH_ENABLED=true`, `NODE_ENV=development`, and an explicit `x-demo-subject-id` header. This header is an **impersonation convenience**, not authentication. Production mode refuses to start.

## Demo flow

The memory adapter seeds a published `northline-goods` store and one active product under the `demo-merchant` subject. The sample is available from:

```sh
curl http://localhost:3000/v1/storefront/northline-goods/products
curl -H 'x-demo-subject-id: demo-merchant' http://localhost:3000/v1/admin/stores
```

To create a new store and catalog, use the following endpoints (all `/v1/admin` routes require the demo header):

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/admin/stores` | Create draft store `{name,handle,countryCode?,currencyCode?}` |
| GET | `/v1/admin/stores` | List merchant's stores |
| POST | `/v1/admin/stores/:storeId/publish` | Publish store |
| POST | `/v1/admin/stores/:storeId/products` | Create draft product and variants |
| GET | `/v1/admin/stores/:storeId/products` | List products |
| PATCH | `/v1/admin/stores/:storeId/products/:productId` | Edit product metadata/prices |
| POST | `/v1/admin/stores/:storeId/products/:productId/activate` | Make product public |
| POST | `/v1/admin/stores/:storeId/variants/:variantId/stock-adjustments` | Set absolute stock and record movement |
| GET | `/v1/admin/stores/:storeId/inventory-movements` | List last 200 movements |
| GET | `/v1/storefront/:handle/products` | Public published+active product catalog |
| GET | `/health` | Liveness |

Example product body:

```json
{
  "name":"Everyday Backpack",
  "handle":"everyday-backpack",
  "description":"A practical everyday bag.",
  "collection":"Bags",
  "priceMinor":"199900",
  "compareMinor":"249900",
  "variants":[{"name":"Black","sku":"BAG-BLK-001","stock":10}]
}
```

`priceMinor` and `compareMinor` are integer **strings** in the smallest currency unit (199900 = ₹1,999.00 for INR); stock adjustment uses `{ "quantity": 15, "reason": "RECEIVED", "note": "New delivery" }`. New stores and products start in DRAFT, so publish/activate to expose them publicly. Never expose SKUs or merchant-only attributes through the storefront endpoint.

## Persistent data

Use PostgreSQL and `DATA_DRIVER=postgres`. Set `DATABASE_URL` in `apps/api/.env`, run `pnpm db:generate`, `pnpm db:migrate`, then start API. The PostgreSQL adapter provides unique constraints, ownership-scoped reads, and transactional optimistic stock updates with movement history.

## Deferred security and business features

Identity/password recovery, memberships/RBAC, payments, checkout, reservations, orders, shipments, taxes, media, rate limiting, idempotency keys, webhooks and data export are **not** implemented yet. Do not use these endpoints to sell goods or deploy the merchant admin publicly. Fulfillment tracking can be manual dispatch/delivered in a later phase.

## Verification

From the repository root:

```sh
pnpm db:generate
pnpm test
pnpm typecheck
pnpm build
pnpm test:integration
```

The integration suite starts its own loopback API, exercises store publication,
product activation and editing, inventory adjustments/history, cross-merchant
isolation, storefront privacy, and demo-auth restrictions. It uses memory by
default. To exercise PostgreSQL, migrate a disposable database first, then run
`TEST_DATA_DRIVER=postgres pnpm test:integration` with `DATABASE_URL` set.
PostgreSQL tests leave their uniquely named stores in that disposable database.
Demo authentication requires explicit development mode and is rejected in test,
staging, unset, and production modes. Production startup always refuses to run.
