// POST /api/login  { username, password }  -> entra com usuário + senha
import { hasDB, hasAuth, sbSelect, sbUpdate, gotruePasswordLogin, makeSessionCookie } from '../lib/util.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método inválido.' });
  if (!hasDB()) return res.status(503).json({ error: 'Banco de dados não configurado. Veja o SETUP.md.' });
  if (!hasAuth()) return res.status(503).json({ error: 'Falta configurar a variável SUPABASE_ANON_KEY na Vercel.' });

  const b = req.body || {};
  const username = String(b.username || '').trim();
  const password = String(b.password || '');
  if (!username || !password) return res.status(400).json({ error: 'Preencha usuário e senha.' });

  const nameKey = username.toLowerCase();

  try {
    const rows = await sbSelect('users', `name_key=eq.${encodeURIComponent(nameKey)}&select=*`);
    if (!rows.length) return res.status(404).json({ error: 'Usuário não encontrado.' });
    const user = rows[0];
    if (!user.email) return res.status(400).json({ error: 'Essa conta não tem e-mail. Crie uma conta nova.' });

    const login = await gotruePasswordLogin(user.email, password);
    if (!login.ok) {
      const txt = JSON.stringify(login.data || {}).toLowerCase();
      if (/not.?confirmed|confirm/.test(txt))
        return res.status(403).json({ error: 'Confirme seu e-mail antes de entrar (olhe sua caixa de entrada/spam).' });
      return res.status(401).json({ error: 'Usuário ou senha incorretos.' });
    }

    // Logou = e-mail já confirmado. Marca como confirmado p/ aparecer no ranking/admin.
    if (user.confirmed === false) {
      try { await sbUpdate('users', `id=eq.${user.id}`, { confirmed: true }); } catch (_) { /* coluna ainda não existe */ }
    }

    res.setHeader('Set-Cookie', makeSessionCookie(user.id));
    return res.status(200).json({
      ok: true,
      user: { id: user.id, name: user.name, balance: user.balance, is_admin: user.is_admin },
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro no servidor: ' + e.message });
  }
}
