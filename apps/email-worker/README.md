# @hushletter/email-worker

Cloudflare Worker that receives incoming emails and forwards them to the Convex backend for processing.

## How It Works

1. Cloudflare Email Routing sends emails to this worker
2. The worker parses the email using `postal-mime`
3. Parsed content is sent to the Convex backend via HTTP action
4. Routing: `*-dev@domain` emails go to the dev backend, all others to production

## Secrets

Set via `wrangler secret put`:

- `CONVEX_URL` — Production Convex HTTP action URL
- `INTERNAL_API_KEY` — API key for authenticating with Convex
- `CONVEX_URL_DEV` — (Optional) Dev Convex URL
- `INTERNAL_API_KEY_DEV` — (Optional) Dev API key

## Development

```bash
bun run test       # Run tests
wrangler deploy    # Deploy to Cloudflare
```
