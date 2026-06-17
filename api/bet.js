// POST /api/bet  { matchId, selection, stake }  -> registra a aposta
import { requireUser, sbInsert, sbUpdate, getMatchById } from '../lib/util.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método inválido.' });
  const user = await requireUser(req, res);
  if (!user) return;

  const body = req.body || {};
  const matchId = String(body.matchId || '');
  const selection = String(body.selection || '').toUpperCase();
  const stake = Math.round(Number(body.stake) * 100) / 100;

  if (!['HOME', 'DRAW', 'AWAY'].includes(selection))
    return res.status(400).json({ error: 'Palpite inválido.' });
  if (!(stake > 0)) return res.status(400).json({ error: 'Valor da aposta inválido.' });
  if (stake > user.balance)
    return res.status(400).json({ error: 'Saldo insuficiente.' });

  try {
    const match = await getMatchById(matchId);
    if (!match) return res.status(404).json({ error: 'Jogo não encontrado.' });
    if (match.phase !== 'upcoming')
      return res.status(400).json({ error: 'Esse jogo já começou — apostas encerradas.' });

    const odd = selection === 'HOME' ? match.odds.home
      : selection === 'AWAY' ? match.odds.away
      : match.odds.draw;

    // Debita o saldo (lê de novo p/ reduzir corrida)
    const fresh = (await sbUpdate('users', `id=eq.${user.id}`, {
      balance: Math.round((user.balance - stake) * 100) / 100,
    }))[0];

    const bet = (await sbInsert('bets', {
      user_id: user.id,
      match_id: match.id,
      home_team: match.homeTeam,
      away_team: match.awayTeam,
      selection,
      stake,
      odd,
      status: 'OPEN',
      payout: 0,
    }))[0];

    return res.status(200).json({ ok: true, bet, balance: fresh.balance });
  } catch (e) {
    return res.status(500).json({ error: 'Erro ao apostar: ' + e.message });
  }
}
