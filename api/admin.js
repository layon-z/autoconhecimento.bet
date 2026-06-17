// GET /api/admin  -> painel do dono: saldo e estatísticas de todos
import { requireUser, sbSelect, ENV } from '../lib/util.js';

export default async function handler(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  if (!user.is_admin) return res.status(403).json({ error: 'Acesso restrito ao admin.' });

  try {
    const users = await sbSelect('users', 'select=id,name,balance,is_admin,created_at&order=balance.desc');
    const bets = await sbSelect('bets', 'select=user_id,stake,payout,status');

    const stats = {};
    for (const u of users) stats[u.id] = { bets: 0, open: 0, won: 0, lost: 0, staked: 0, payout: 0 };
    for (const b of bets) {
      const s = stats[b.user_id];
      if (!s) continue;
      s.bets++;
      s.staked += b.stake;
      s.payout += b.payout || 0;
      if (b.status === 'OPEN') s.open++;
      else if (b.status === 'WON') s.won++;
      else if (b.status === 'LOST') s.lost++;
    }

    const players = users.map((u) => ({
      ...u,
      ...stats[u.id],
      profit: Math.round((u.balance - ENV.START_BALANCE) * 100) / 100,
    }));

    const totals = {
      players: users.length,
      totalBalance: Math.round(users.reduce((a, u) => a + u.balance, 0) * 100) / 100,
      totalBets: bets.length,
      totalStaked: Math.round(bets.reduce((a, b) => a + b.stake, 0) * 100) / 100,
    };

    return res.status(200).json({ players, totals, startBalance: ENV.START_BALANCE });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
