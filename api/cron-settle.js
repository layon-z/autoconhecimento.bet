// GET /api/cron-settle  -> roda a cada 10min (Vercel Cron):
// resolve apostas de jogos encerrados e paga os vencedores.
import { ENV, hasDB, sbSelect, sbUpdate, getMatches, outcomeOf } from '../lib/util.js';

export default async function handler(req, res) {
  // Proteção opcional: se CRON_SECRET estiver setado, exige o header da Vercel
  if (ENV.CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${ENV.CRON_SECRET}`)
      return res.status(401).json({ error: 'Não autorizado.' });
  }
  if (!hasDB()) return res.status(503).json({ error: 'Banco não configurado.' });

  try {
    const open = await sbSelect('bets', `status=eq.OPEN&select=*`);
    if (!open.length) return res.status(200).json({ settled: 0, message: 'Nada a resolver.' });

    const matches = await getMatches();
    const byId = Object.fromEntries(matches.map((m) => [m.id, m]));

    let settled = 0;
    const credit = {}; // user_id -> total a creditar

    for (const bet of open) {
      const match = byId[bet.match_id];
      if (!match) continue;
      const outcome = outcomeOf(match);
      if (!outcome) continue; // ainda não terminou

      const won = bet.selection === outcome;
      const payout = won ? Math.round(bet.stake * bet.odd * 100) / 100 : 0;
      await sbUpdate('bets', `id=eq.${bet.id}`, {
        status: won ? 'WON' : 'LOST',
        payout,
        result: outcome,
      });
      if (won) credit[bet.user_id] = (credit[bet.user_id] || 0) + payout;
      settled++;
    }

    // Credita os ganhos no saldo de cada vencedor
    for (const [userId, amount] of Object.entries(credit)) {
      const u = (await sbSelect('users', `id=eq.${userId}&select=balance`))[0];
      if (!u) continue;
      await sbUpdate('users', `id=eq.${userId}`, {
        balance: Math.round((u.balance + amount) * 100) / 100,
      });
    }

    return res.status(200).json({ settled, paidPlayers: Object.keys(credit).length });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
