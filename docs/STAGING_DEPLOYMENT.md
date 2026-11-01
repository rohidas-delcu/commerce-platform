# Staging deployment foundation

This repository now produces a Docker image candidate and an OCI image tarball as a
GitHub Actions artifact. It does **not** publish an image, create infrastructure,
provision credentials, run migrations against a remote database, or deploy anything.
Those steps require a separately approved staging environment and operator action.

## What is included

- `Dockerfile` builds the NestJS API and exposes a container readiness health check
  at `GET /health/ready`.
- `deploy/staging/compose.yml` is a hardened single-service launch template for an
  approved immutable image. It binds only to localhost; a reviewed reverse proxy or
  platform ingress must terminate TLS and route traffic.
- `.github/workflows/container.yml` builds, smoke-tests `/health`, and uploads an
  image artifact. Its permissions are read-only and it never pushes to a registry.
- `NODE_ENV=staging` is explicit and fails closed unless PostgreSQL, disabled demo
  authentication, S3 object storage, SES notifications, HTTPS CORS origins, and a
  container network host are configured. Production still refuses to start.

## Before operator deployment

1. Obtain the reviewed image artifact, load it into an approved private registry or
   runtime, and set `COMMERCE_IMAGE` to an immutable digest reference. This workflow
   does not perform either operation.
2. Copy `deploy/staging/.env.example` to `deploy/staging/.env` in the deployment
   secret store or host. Replace every placeholder with staging-only values; never
   commit the copied file or real `DATABASE_URL`/`AUTH_OUTBOX_KEY` values.
3. Use a dedicated least-privilege PostgreSQL application role and a separately
   controlled migration role. Back up and test restoration before applying migrations.
   Run `pnpm db:deploy` from a reviewed release job only; the container never runs
   migrations automatically.
4. Provide private S3 and verified SES staging configuration through the platform's
   workload identity or secret mechanism. Confirm least privilege, encryption,
   version/lifecycle policy, sender ownership, and no production resource reuse.
5. Configure TLS at the ingress and exact HTTPS merchant/storefront origins. Do not
   expose the localhost compose port directly to the internet.

## Launch and verify

After the prerequisites are approved and the runtime host has the private image:

```sh
cd deploy/staging
cp .env.example .env
# Populate .env through the approved secret mechanism; do not use the placeholders.
COMMERCE_IMAGE=registry.example/commerce-api@sha256:replace-with-approved-digest \
  docker compose --env-file .env up -d
docker compose ps
curl --fail --show-error http://127.0.0.1:3000/health
curl --fail --show-error http://127.0.0.1:3000/health/ready
```

`/health` confirms that the process is alive. `/health/ready` also exercises the
configured repositories and database schema and must be used for deployment
readiness. Treat a readiness failure as a rollout failure; inspect bounded service
logs without printing credentials, cookies, tokens, request bodies, or connection
URLs.

## Explicit non-goals

This foundation does not authorize production startup, production deployment, cloud
resource creation, registry publishing, DNS/TLS changes, live provider activation,
payment settlement, or real customer data. The existing production block and release
gates in `docs/setup-and-deployment.md` remain in force.
