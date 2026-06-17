// POST /api/auth  { name, pin }  -> cria conta na 1ª vez ou faz login
import {
  ENV, hasDB, sbSelect, sbInsert, hashPin, verifyPin, makeSessionCookie,
} from '../lib/util.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método inválido.' });
  if (!hasDB()) return res.status(503).json({ error: 'Banco de dados não configurado. Veja o SETUP.md.' });

  const body = req.body || {};
  const name = String(body.name || '').trim();
  const pin = String(body.pin || '').trim();

  if (name.length < 2 || name.length > 20) return res.status(400).json({ error: 'Nome inválido.' });
  if (!/^\d{4}$/.test(pin)) return res.status(400).json({ error: 'O PIN precisa ter 4 números.' });

  const nameKey = name.toLowerCase();

  try {
    const existing = await sbSelect('users', `name_key=eq.${encodeURIComponent(nameKey)}&select=*`);

    let user;
    if (existing.length) {
      user = existing[0];
      if (!verifyPin(pin, user.pin_hash)) {
        return res.status(401).json({ error: 'PIN incorreto para esse nome.' });
      }
    } else {
      const rows = await sbInsert('users', {
        name,
        name_key: nameKey,
        pin_hash: hashPin(pin),
        balance: ENV.START_BALANCE,
        is_admin: nameKey === ENV.ADMIN_NAME,
      });
      user = rows[0];
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
