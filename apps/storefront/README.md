# Customer storefront

The customer storefront runs at `http://127.0.0.1:5174` and proxies API calls to
`http://127.0.0.1:3000` by default. Copy `.env.example` to ignored `.env` only
when targeting another trusted local API.

It requires the PostgreSQL-backed API described in
[`docs/LOCAL_DEVELOPMENT.md`](../../docs/LOCAL_DEVELOPMENT.md). Start it from the
repository root with `pnpm dev:storefront`. Customer accounts are store-scoped;
there is no shared demo username or password.
