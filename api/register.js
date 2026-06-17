// POST /api/register  { username, email, password }
// Cria a conta no Supabase Auth (que envia o e-mail de confirmação) + perfil.
import { ENV, hasDB, hasAuth, sbSelect, sbInsert, gotrueSignup } from '../lib/util.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método inválido.' });
  if (!hasDB()) return res.status(503).json({ error: 'Banco de dados não configurado. Veja o SETUP.md.' });
  if (!hasAuth()) return res.status(503).json({ error: 'Falta configurar a variável SUPABASE_ANON_KEY na Vercel.' });

  const b = req.body || {};
  const username = String(b.username || '').trim();
  const email = String(b.email || '').trim().toLowerCase();
  const password = String(b.password || '');

  if (username.length < 2 || username.length > 20)
    return res.status(400).json({ error: 'Usuário deve ter de 2 a 20 caracteres.' });
  if (!/^[a-zA-Z0-9_.]+$/.test(username))
    return res.status(400).json({ error: 'Usuário: use só letras, números, _ ou ponto.' });
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email))
    return res.status(400).json({ error: 'E-mail inválido.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'A senha precisa de ao menos 6 caracteres.' });

  const nameKey = username.toLowerCase();

  try {
    const existing = await sbSelect('users', `name_key=eq.${encodeURIComponent(nameKey)}&select=id`);
    if (existing.length)
      return res.status(409).json({ error: 'Esse nome de usuário já existe. Escolha outro.' });

    const proto = req.headers['x-forwarded-proto'] || 'https';
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const siteUrl = `${proto}://${host}/`;

    const signup = await gotrueSignup(email, password, username, siteUrl);
    if (!signup.ok) {
      const msg = signup.data?.msg || signup.data?.error_description || signup.data?.error || 'Erro ao criar conta.';
      return res.status(400).json({
        error: /registered|already/i.test(msg) ? 'Esse e-mail já está cadastrado.' : msg,
      });
    }
    const authId = signup.data?.user?.id || signup.data?.id;
    if (!authId) return res.status(500).json({ error: 'Não foi possível criar a conta.' });

    await sbInsert('users', {
      id: authId,
      name: username,
      name_key: nameKey,
      email,
      balance: ENV.START_BALANCE,
      is_admin: nameKey === ENV.ADMIN_NAME,
    });

    return res.status(200).json({
      ok: true,
      needsConfirm: true,
      message: 'Conta criada! 📧 Enviamos um e-mail de confirmação — confirme e depois faça login.',
    });
  } catch (e) {
    return res.status(500).json({ error: 'Erro no servidor: ' + e.message });
  }
}
