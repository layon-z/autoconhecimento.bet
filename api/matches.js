// GET /api/matches  -> lista de jogos da Copa com odds calculadas
import { getMatches, flagOf, settleOpenBets, hasDB } from '../lib/util.js';

export default async function handler(req, res) {
  try {
    const matches = await getMatches();

    // Resolve apostas de jogos encerrados sob demanda (substitui o cron frequente)
    if (hasDB()) {
      try { await settleOpenBets(matches); } catch (_) { /* não trava a lista */ }
    }

    const withFlags = matches.map((m) => ({
      ...m,
      homeFlag: flagOf(m.homeTeam),
      awayFlag: flagOf(m.awayTeam),
    }));
    // ordena: ao vivo > próximos > encerrados, depois por data
    const order = { live: 0, upcoming: 1, done: 2 };
    withFlags.sort((a, b) =>
      order[a.phase] - order[b.phase] || new Date(a.utcDate) - new Date(b.utcDate)
    );
    res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');
    return res.status(200).json({ matches: withFlags });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
