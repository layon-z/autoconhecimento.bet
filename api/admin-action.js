// POST /api/admin-action  { action, userId, amount? }
// Ações restritas ao admin: ajustar saldo e remover usuário.
import { requireUser, sbSelect, sbUpdate, sbDelete, deleteAuthUser } from '../lib/util.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método inválido.' });
  const me = await requireUser(req, res);
  if (!me) return;
  if (!me.is_admin) return res.status(403).json({ error: 'Acesso restrito ao admin.' });

  const b = req.body || {};
  const action = String(b.action || '');
  const userId = String(b.userId || '');
  if (!userId) return res.status(400).json({ error: 'Usuário não informado.' });

  try {
    const rows = await sbSelect('users', `id=eq.${userId}&select=*`);
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const target = rows[0];

    if (action === 'removeUser') {
      if (target.id === me.id) return res.status(400).json({ error: 'Você não pode remover a si mesmo.' });
      await sbDelete('users', `id=eq.${userId}`); // apaga também as apostas (cascade)
      await deleteAuthUser(userId);
      return res.status(200).json({ ok: true, removed: target.name });
    }

    if (action === 'addBalance' || action === 'setBalance') {
      const amount = Number(b.amount);
      if (!isFinite(amount)) return res.status(400).json({ error: 'Valor inválido.' });
      const newBal = action === 'addBalance' ? target.balance + amount : amount;
      const rounded = Math.round(newBal * 100) / 100;
      if (rounded < 0) return res.status(400).json({ error: 'O saldo não pode ficar negativo.' });
      const updated = (await sbUpdate('users', `id=eq.${userId}`, { balance: rounded }))[0];
      return res.status(200).json({ ok: true, name: target.name, balance: updated.balance });
    }

    return res.status(400).json({ error: 'Ação desconhecida.' });
  } catch (e) {
    return res.status(500).json({ error: 'Erro: ' + e.message });
  }
}
