// GET /api/me  -> dados do usuário logado
import { requireUser } from '../lib/util.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  return res.status(200).json({
    user: { id: user.id, name: user.name, balance: user.balance, is_admin: user.is_admin },
  });
}
