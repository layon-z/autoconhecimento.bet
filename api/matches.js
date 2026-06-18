// GET /api/matches  -> lista de jogos da Copa com odds calculadas
import { getMatches, flagCode, settleOpenBets, hasDB } from '../lib/util.js';

let _lastSettle = 0; // evita resolver apostas a cada request (por instância)

export default async function handler(req, res) {
  try {
    const matches = await getMatches();

    // Resolve apostas de jogos encerrados sob demanda (no máx. ~1x/25s por instância)
    if (hasDB() && Date.now() - _lastSettle > 25000) {
      _lastSettle = Date.now();
      try { await settleOpenBets(matches); } catch (_) { /* não trava a lista */ }
    }

    const withFlags = matches.map((m) => ({
      ...m,
      homeCode: flagCode(m.homeTeam),
      awayCode: flagCode(m.awayTeam),
    }));
    // ordena: ao vivo > próximos > encerrados, depois por data
    const order = { live: 0, upcoming: 1, done: 2 };
    withFlags.sort((a, b) =>
      order[a.phase] - order[b.phase] || new Date(a.utcDate) - new Date(b.utcDate)
    );
    // Não cachear na borda: garante dados sempre frescos e evita "exemplos" presos no cache
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ matches: withFlags });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
