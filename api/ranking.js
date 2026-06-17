// GET /api/ranking  -> jogadores ordenados por saldo
import { requireUser, sbSelect } from '../lib/util.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const rows = await sbSelect('users', 'select=id,name,balance&order=balance.desc');
    return res.status(200).json({ ranking: rows });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
