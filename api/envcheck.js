// GET /api/envcheck  -> diagnóstico de variáveis (NÃO mostra valores secretos)
import { ENV } from '../lib/util.js';

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({
    SUPABASE_URL_ok: Boolean(ENV.SUPABASE_URL),
    SUPABASE_SERVICE_KEY_len: (ENV.SUPABASE_KEY || '').length,
    SUPABASE_ANON_KEY_len: (ENV.SUPABASE_ANON_KEY || '').length,
    SUPABASE_ANON_KEY_ok: Boolean(ENV.SUPABASE_ANON_KEY),
    FOOTBALL_DATA_KEY_ok: Boolean(ENV.FOOTBALL_DATA_KEY),
    ADMIN_NAME: ENV.ADMIN_NAME,
  });
}
