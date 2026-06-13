# Real-time 3D contribution graph

By default the 3D graph regenerates **hourly** (`.github/workflows/profile-3d.yml`)
and instantly when you push to this repo. This guide adds **true real-time**:
a commit/PR/issue in **any** of your repos regenerates the graph within seconds.

## How it works

```
push to ANY repo  ──►  GitHub App webhook  ──►  api/github-webhook.js (Vercel)
                                                        │ verifies signature
                                                        ▼
                                          repository_dispatch: refresh-3d-graph
                                                        │
                                                        ▼
                                   .github/workflows/profile-3d.yml runs → new SVGs
```

## One-time setup

### 1. Deploy this repo to Vercel
If it isn't already linked, import the repo at https://vercel.com → it auto-detects
`api/github-webhook.js`. Your endpoint will be:

```
https://<your-vercel-project>.vercel.app/api/github-webhook
```

### 2. Create a Personal Access Token (to trigger the workflow)
- GitHub → **Settings → Developer settings → Personal access tokens**
- Classic token with the **`repo`** scope (or fine-grained: **Actions: Read/Write**
  + **Contents: Read/Write** on the `TinNK3/TinNK3` repo).
- Copy the token.

### 3. Generate a webhook secret
Any long random string, e.g.:

```bash
openssl rand -hex 32
```

### 4. Add env vars in Vercel
Project → **Settings → Environment Variables**:

| Name             | Value                          |
|------------------|--------------------------------|
| `GITHUB_TOKEN`   | the PAT from step 2            |
| `WEBHOOK_SECRET` | the random string from step 3  |
| `OWNER`          | `TinNK3` (optional, default)   |
| `REPO`           | `TinNK3` (optional, default)   |

Redeploy so the function picks them up.

### 5. Create a GitHub App (delivers events from ALL your repos)
GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**:

- **Webhook URL**: `https://<your-vercel-project>.vercel.app/api/github-webhook`
- **Webhook secret**: the same `WEBHOOK_SECRET` from step 3
- **Repository permissions**:
  - **Contents**: Read-only  (required to subscribe to push events)
  - **Metadata**: Read-only  (automatic)
- **Subscribe to events**: `Push`, and optionally `Pull request`, `Issues`, `Release`, `Create`
- **Where can this app be installed?**: Only this account

Create it, then **Install** it on your account → choose **All repositories**.
New repos are then covered automatically — no per-repo setup ever again.

## Verify it works
- After creating the webhook, GitHub sends a `ping` → the function replies `pong`
  (check **Advanced → Recent Deliveries** on the App for a green ✓).
- Push a commit to any repo → within seconds a run appears in this repo's
  **Actions** tab, and the graph updates.

## Safety notes
- Requests without a valid HMAC signature are rejected (`401`).
- The function ignores the workflow's own `github-actions[bot]` regeneration
  commit, so it never loops.
- The workflow uses `concurrency: cancel-in-progress`, so a burst of pushes
  collapses into one fresh run instead of stacking up.
