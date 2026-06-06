import fetch from "node-fetch";

// Vercel serverless function: pings the stats endpoints so their
// cached SVGs are regenerated. Wired to a daily cron in vercel.json.
const USERNAME = process.env.USERNAME || "TinNK3";

const ENDPOINTS = [
  `https://github-readme-stats.vercel.app/api?username=${USERNAME}&show_icons=true&include_all_commits=true&count_private=true`,
  `https://github-readme-stats.vercel.app/api/top-langs/?username=${USERNAME}&layout=compact`,
  `https://streak-stats.demolab.com?user=${USERNAME}`,
  `https://github-profile-summary-cards.vercel.app/api/cards/profile-details?username=${USERNAME}`,
];

export default async function handler(req, res) {
  try {
    await Promise.all(ENDPOINTS.map((url) => fetch(url)));
    res.status(200).json({ message: "GitHub stats refreshed!", username: USERNAME });
  } catch (err) {
    res.status(500).json({ message: "Failed to refresh stats", error: String(err) });
  }
}
