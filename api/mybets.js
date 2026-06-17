// GET /api/mybets  -> apostas do usuário logado
import { requireUser, sbSelect } from '../lib/util.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const bets = await sbSelect(
      'bets',
      `user_id=eq.${user.id}&select=*&order=created_at.desc`
    );
    return res.status(200).json({ bets });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
