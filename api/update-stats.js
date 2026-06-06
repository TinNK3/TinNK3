import fetch from "node-fetch";

// Vercel serverless function: pings the stats endpoints so their
// cached SVGs are regenerated. Wired to a daily cron in vercel.json.
const USERNAME = process.env.USERNAME || "TinNK3";

const ENDPOINTS = [
  `https://github-profile-summary-cards.vercel.app/api/cards/profile-details?username=${USERNAME}`,
  `https://github-profile-summary-cards.vercel.app/api/cards/stats?username=${USERNAME}`,
  `https://github-profile-summary-cards.vercel.app/api/cards/repos-per-language?username=${USERNAME}`,
  `https://github-profile-summary-cards.vercel.app/api/cards/most-commit-language?username=${USERNAME}`,
  `https://streak-stats.demolab.com?user=${USERNAME}`,
];

export default async function handler(req, res) {
  try {
    await Promise.all(ENDPOINTS.map((url) => fetch(url)));
    res.status(200).json({ message: "GitHub stats refreshed!", username: USERNAME });
  } catch (err) {
    res.status(500).json({ message: "Failed to refresh stats", error: String(err) });
  }
}
