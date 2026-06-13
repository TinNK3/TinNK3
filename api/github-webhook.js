// Vercel serverless function: receives GitHub webhook events from ANY of the
// user's repositories (delivered via a GitHub App installed account-wide) and
// triggers the "GitHub Profile 3D Contrib" workflow via repository_dispatch.
//
// This is what makes the 3D graph update in (near) real time: instead of
// waiting for the hourly cron, every push/PR/issue across all your repos
// fires this endpoint, which kicks the workflow within seconds.
//
// Required Vercel env vars:
//   WEBHOOK_SECRET  - the secret you set on the GitHub App webhook (HMAC key)
//   GITHUB_TOKEN    - a PAT with permission to dispatch on OWNER/REPO
//                     (classic: "repo" scope; fine-grained: Actions read/write
//                      + Contents read/write on the profile repo)
// Optional:
//   OWNER           - profile repo owner (default: TinNK3)
//   REPO            - profile repo name  (default: TinNK3)

import crypto from "crypto";

// We need the raw request bytes to verify GitHub's HMAC signature, so disable
// Vercel's automatic body parsing for this function.
export const config = { api: { bodyParser: false } };

const OWNER = process.env.OWNER || "TinNK3";
const REPO = process.env.REPO || "TinNK3";
const EVENT_TYPE = "refresh-3d-graph";

// Events that change the contribution graph and are worth a regeneration.
const TRIGGER_EVENTS = ["push", "pull_request", "issues", "create", "release"];

async function readRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader) return false;
  const expected =
    "sha256=" +
    crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  const received = Buffer.from(signatureHeader);
  const computed = Buffer.from(expected);
  return (
    received.length === computed.length &&
    crypto.timingSafeEqual(received, computed)
  );
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ message: "Method not allowed" });
  }

  const secret = process.env.WEBHOOK_SECRET;
  const token = process.env.GITHUB_TOKEN;
  if (!secret || !token) {
    return res
      .status(500)
      .json({ message: "Missing WEBHOOK_SECRET or GITHUB_TOKEN env var" });
  }

  const rawBody = await readRawBody(req);

  // 1. Confirm the request genuinely came from GitHub.
  if (!verifySignature(rawBody, req.headers["x-hub-signature-256"], secret)) {
    return res.status(401).json({ message: "Invalid signature" });
  }

  const event = req.headers["x-github-event"];

  // GitHub sends a one-off "ping" right after the webhook is created.
  if (event === "ping") {
    return res.status(200).json({ message: "pong" });
  }

  if (!TRIGGER_EVENTS.includes(event)) {
    return res.status(200).json({ message: `Ignored event: ${event}` });
  }

  // Avoid an infinite loop: the workflow itself pushes a regenerated SVG commit
  // to the profile repo as github-actions[bot]. Don't re-trigger on that.
  let payload = {};
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    /* non-JSON payloads can't be a push we care about */
  }
  const isProfileRepo = payload?.repository?.name === REPO;
  const senderIsBot =
    payload?.sender?.type === "Bot" ||
    (payload?.pusher?.name || "").includes("github-actions") ||
    (payload?.sender?.login || "").includes("github-actions");
  if (isProfileRepo && senderIsBot) {
    return res
      .status(200)
      .json({ message: "Skipped self-regeneration bot commit" });
  }

  // 2. Trigger the workflow (matches `repository_dispatch: types: [refresh-3d-graph]`).
  const resp = await fetch(
    `https://api.github.com/repos/${OWNER}/${REPO}/dispatches`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": `${OWNER}-profile-webhook`,
        "X-GitHub-Api-Version": "2022-11-28",
      },
      body: JSON.stringify({ event_type: EVENT_TYPE }),
    }
  );

  if (!resp.ok) {
    const text = await resp.text();
    return res
      .status(502)
      .json({ message: "Failed to trigger workflow", status: resp.status, error: text });
  }

  return res.status(202).json({ message: "3D graph refresh triggered", event });
}
