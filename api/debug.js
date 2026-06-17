// GET /api/debug  -> diagnóstico de conexão (NÃO expõe a chave secreta)
import { ENV, hasDB } from '../lib/util.js';

export default async function handler(req, res) {
  const out = {
    buildMarker: 'v2-debug',
    hasDB: hasDB(),
    supabaseUrl: ENV.SUPABASE_URL || '(vazio)',
    urlEndsWithSlash: /\/$/.test(process.env.SUPABASE_URL || ''),
    serviceKeyLength: (ENV.SUPABASE_KEY || '').length,
    serviceKeyLooksJWT: (ENV.SUPABASE_KEY || '').startsWith('eyJ'),
    adminName: ENV.ADMIN_NAME,
    startBalance: ENV.START_BALANCE,
  };

  // Limpeza do usuário de teste (uso único, protegido por token)
  if (hasDB() && req.query && req.query.kill === 'limpa-teste-9z') {
    try {
      const r = await fetch(`${ENV.SUPABASE_URL}/rest/v1/users?name_key=eq.teste_diag`, {
        method: 'DELETE',
        headers: { apikey: ENV.SUPABASE_KEY, Authorization: `Bearer ${ENV.SUPABASE_KEY}` },
      });
      out.cleanup = `deletou teste_diag (HTTP ${r.status})`;
    } catch (e) {
      out.cleanupError = e.message;
    }
  }

  // Teste real de leitura na tabela users
  if (hasDB()) {
    try {
      const url = `${ENV.SUPABASE_URL}/rest/v1/users?select=id&limit=1`;
      const r = await fetch(url, {
        headers: {
          apikey: ENV.SUPABASE_KEY,
          Authorization: `Bearer ${ENV.SUPABASE_KEY}`,
        },
      });
      out.testStatus = r.status;
      out.testBody = (await r.text()).slice(0, 300);
      out.testUrlShape = url.replace(ENV.SUPABASE_URL, '<URL>');
    } catch (e) {
      out.testError = e.message;
    }
  }

  return res.status(200).json(out);
}
