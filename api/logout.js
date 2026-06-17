// POST /api/logout
import { clearSessionCookie } from '../lib/util.js';

export default async function handler(req, res) {
  res.setHeader('Set-Cookie', clearSessionCookie());
  return res.status(200).json({ ok: true });
}
