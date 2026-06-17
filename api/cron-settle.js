// GET /api/cron-settle  -> roda 1x/dia (Vercel Cron, plano grátis) como reforço,
// e também pode ser aberto manualmente no navegador pra forçar o pagamento.
import { ENV, hasDB, settleOpenBets } from '../lib/util.js';

export default async function handler(req, res) {
  // Proteção opcional: se CRON_SECRET estiver setado, exige o header da Vercel
  if (ENV.CRON_SECRET) {
    const auth = req.headers.authorization || '';
    if (auth !== `Bearer ${ENV.CRON_SECRET}`)
      return res.status(401).json({ error: 'Não autorizado.' });
  }
  if (!hasDB()) return res.status(503).json({ error: 'Banco não configurado.' });

  try {
    const result = await settleOpenBets();
    return res.status(200).json({ ok: true, ...result });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
