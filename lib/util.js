// ============================================================
// AutoConhecimento.Bet — biblioteca compartilhada (server-side)
// Sem dependências externas: usa só fetch + node:crypto.
// ============================================================
import crypto from 'node:crypto';

// ---------- Variáveis de ambiente ----------
export const ENV = {
  // Aceita tanto "https://x.supabase.co" quanto a forma com "/rest/v1" no fim
  SUPABASE_URL: (process.env.SUPABASE_URL || '')
    .trim()
    .replace(/\/+$/, '')
    .replace(/\/rest\/v1$/, '')
    .replace(/\/+$/, ''),
  SUPABASE_KEY: (process.env.SUPABASE_SERVICE_KEY || '').trim(),
  SESSION_SECRET: process.env.SESSION_SECRET || 'troque-este-segredo-em-producao',
  FOOTBALL_DATA_KEY: process.env.FOOTBALL_DATA_KEY || '',
  ADMIN_NAME: (process.env.ADMIN_NAME || 'edu').toLowerCase(),
  CRON_SECRET: process.env.CRON_SECRET || '',
  START_BALANCE: Number(process.env.START_BALANCE || 50),
};

export function hasDB() {
  return Boolean(ENV.SUPABASE_URL && ENV.SUPABASE_KEY);
}

// ============================================================
// SUPABASE (via REST, sem SDK)
// ============================================================
function sbHeaders(extra = {}) {
  return {
    apikey: ENV.SUPABASE_KEY,
    Authorization: `Bearer ${ENV.SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    ...extra,
  };
}

export async function sbSelect(table, query = '') {
  const url = `${ENV.SUPABASE_URL}/rest/v1/${table}?${query}`;
  const r = await fetch(url, { headers: sbHeaders() });
  if (!r.ok) throw new Error(`Supabase select ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function sbInsert(table, row, prefer = 'return=representation') {
  const r = await fetch(`${ENV.SUPABASE_URL}/rest/v1/${table}`, {
    method: 'POST',
    headers: sbHeaders({ Prefer: prefer }),
    body: JSON.stringify(row),
  });
  if (!r.ok) throw new Error(`Supabase insert ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

export async function sbUpdate(table, query, patch) {
  const r = await fetch(`${ENV.SUPABASE_URL}/rest/v1/${table}?${query}`, {
    method: 'PATCH',
    headers: sbHeaders({ Prefer: 'return=representation' }),
    body: JSON.stringify(patch),
  });
  if (!r.ok) throw new Error(`Supabase update ${table}: ${r.status} ${await r.text()}`);
  return r.json();
}

// ============================================================
// SESSÃO (cookie assinado por HMAC — sem libs)
// ============================================================
const COOKIE = 'ac_session';

function sign(value) {
  return crypto.createHmac('sha256', ENV.SESSION_SECRET).update(value).digest('base64url');
}

export function makeSessionCookie(userId) {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 dias
  const payload = `${userId}.${exp}`;
  const token = `${payload}.${sign(payload)}`;
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 30}`;
}

export function clearSessionCookie() {
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

export function getUserIdFromReq(req) {
  const raw = req.headers.cookie || '';
  const match = raw.split(';').map((c) => c.trim()).find((c) => c.startsWith(`${COOKIE}=`));
  if (!match) return null;
  const token = match.slice(COOKIE.length + 1);
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  if (sign(`${userId}.${exp}`) !== sig) return null;
  if (Number(exp) < Date.now()) return null;
  return userId;
}

export async function requireUser(req, res) {
  const id = getUserIdFromReq(req);
  if (!id) {
    res.status(401).json({ error: 'Faça login para continuar.' });
    return null;
  }
  if (!hasDB()) {
    res.status(503).json({ error: 'Banco de dados não configurado (veja SETUP.md).' });
    return null;
  }
  const rows = await sbSelect('users', `id=eq.${id}&select=*`);
  if (!rows.length) {
    res.status(401).json({ error: 'Sessão inválida.' });
    return null;
  }
  return rows[0];
}

// ---------- Senha/PIN ----------
export function hashPin(pin, salt) {
  const s = salt || crypto.randomBytes(8).toString('hex');
  const h = crypto.scryptSync(String(pin), s, 32).toString('hex');
  return `${s}:${h}`;
}
export function verifyPin(pin, stored) {
  const [salt] = String(stored).split(':');
  return hashPin(pin, salt) === stored;
}

// ============================================================
// FORÇA DOS TIMES (aprox. ranking FIFA) → base das odds
// ============================================================
const STRENGTH = {
  'Brazil': 92, 'Argentina': 93, 'France': 92, 'England': 90, 'Spain': 90,
  'Portugal': 88, 'Netherlands': 87, 'Belgium': 85, 'Germany': 86, 'Italy': 84,
  'Croatia': 82, 'Uruguay': 83, 'Colombia': 82, 'Morocco': 81, 'Switzerland': 79,
  'USA': 78, 'United States': 78, 'Mexico': 78, 'Senegal': 79, 'Japan': 79,
  'Denmark': 80, 'Korea Republic': 76, 'South Korea': 76, 'Australia': 74,
  'Poland': 75, 'Serbia': 75, 'Ecuador': 74, 'Ukraine': 76, 'Austria': 77,
  'Sweden': 75, 'Wales': 73, 'Peru': 72, 'Tunisia': 71, 'Nigeria': 75,
  'Ghana': 71, 'Cameroon': 72, 'Egypt': 73, 'Algeria': 74, 'Ivory Coast': 73,
  'Côte d\'Ivoire': 73, 'Canada': 74, 'Costa Rica': 70, 'Panama': 68,
  'Saudi Arabia': 69, 'Iran': 73, 'Qatar': 68, 'Iraq': 67, 'Jordan': 66,
  'Uzbekistan': 68, 'New Zealand': 64, 'Paraguay': 71, 'Chile': 74,
  'Venezuela': 70, 'Bolivia': 64, 'Scotland': 75, 'Norway': 78, 'Turkey': 76,
  'Greece': 74, 'Czech Republic': 74, 'Hungary': 75, 'Romania': 72,
  'Slovenia': 71, 'Slovakia': 71, 'South Africa': 69, 'Cape Verde': 67,
  'DR Congo': 68, 'Mali': 70, 'Burkina Faso': 68, 'Honduras': 66,
  'Jamaica': 68, 'Curaçao': 65, 'Haiti': 62, 'El Salvador': 62,
};

export function teamStrength(name) {
  if (!name) return 60;
  if (STRENGTH[name] != null) return STRENGTH[name];
  // tenta casar ignorando acentos/caixa
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const target = norm(name); // remove acentos p/ comparar
  for (const k of Object.keys(STRENGTH)) {
    if (norm(k) === target) return STRENGTH[k];
  }
  return 60; // desconhecido
}

// ============================================================
// CÁLCULO DAS ODDS (automático, a partir da força dos times)
// ============================================================
export function computeOdds(homeName, awayName) {
  const sh = teamStrength(homeName);
  const sa = teamStrength(awayName);
  const diff = sh - sa;

  // Probabilidade de empate: maior quando os times são parecidos
  let pDraw = 0.30 - Math.min(Math.abs(diff), 40) / 40 * 0.13; // ~0.17 a 0.30
  // Divide o restante entre casa e visitante pela força relativa (escala suave)
  const eloH = 1 / (1 + Math.pow(10, -diff / 50));
  let pHome = (1 - pDraw) * eloH;
  let pAway = (1 - pDraw) * (1 - eloH);

  // Margem da casa (overround ~8%)
  const margin = 1.08;
  const odd = (p) => Math.max(1.05, Math.round((1 / (p * margin)) * 100) / 100);
  return { home: odd(pHome), draw: odd(pDraw), away: odd(pAway) };
}

// ============================================================
// FONTE DOS JOGOS — football-data.org (ao vivo) ou exemplos
// ============================================================
function shape(m) {
  const odds = computeOdds(m.homeTeam, m.awayTeam);
  let phase = 'upcoming';
  if (['IN_PLAY', 'PAUSED', 'LIVE'].includes(m.status)) phase = 'live';
  else if (['FINISHED', 'AWARDED'].includes(m.status)) phase = 'done';
  return {
    id: String(m.id),
    utcDate: m.utcDate,
    phase,
    status: m.status,
    homeTeam: m.homeTeam,
    awayTeam: m.awayTeam,
    homeScore: m.homeScore,
    awayScore: m.awayScore,
    group: m.group || '',
    odds,
  };
}

export async function getMatches() {
  if (ENV.FOOTBALL_DATA_KEY) {
    try {
      const r = await fetch('https://api.football-data.org/v4/competitions/WC/matches', {
        headers: { 'X-Auth-Token': ENV.FOOTBALL_DATA_KEY },
      });
      if (r.ok) {
        const data = await r.json();
        return (data.matches || []).map((m) =>
          shape({
            id: m.id,
            utcDate: m.utcDate,
            status: m.status,
            homeTeam: m.homeTeam?.name,
            awayTeam: m.awayTeam?.name,
            homeScore: m.score?.fullTime?.home,
            awayScore: m.score?.fullTime?.away,
            group: m.group,
          })
        );
      }
    } catch (_) {
      // cai pros exemplos
    }
  }
  return SAMPLE_FIXTURES.map(shape);
}

export async function getMatchById(id) {
  const all = await getMatches();
  return all.find((m) => m.id === String(id)) || null;
}

// Classificação dos grupos (real, via football-data). Sem chave, retorna [].
export async function getStandings() {
  if (!ENV.FOOTBALL_DATA_KEY) return [];
  try {
    const r = await fetch('https://api.football-data.org/v4/competitions/WC/standings', {
      headers: { 'X-Auth-Token': ENV.FOOTBALL_DATA_KEY },
    });
    if (!r.ok) return [];
    const data = await r.json();
    const groups = (data.standings || []).filter((s) => s.type === 'TOTAL' && s.group);
    return groups.map((s) => ({
      group: s.group.replace(/GROUP[_ ]?/i, 'Grupo '),
      table: (s.table || []).map((row) => ({
        position: row.position,
        team: row.team?.name || '',
        code: flagCode(row.team?.name || ''),
        played: row.playedGames ?? 0,
        won: row.won ?? 0,
        draw: row.draw ?? 0,
        lost: row.lost ?? 0,
        gd: row.goalDifference ?? 0,
        points: row.points ?? 0,
      })),
    }));
  } catch (_) {
    return [];
  }
}

export function outcomeOf(match) {
  if (match.phase !== 'done' || match.homeScore == null || match.awayScore == null) return null;
  if (match.homeScore > match.awayScore) return 'HOME';
  if (match.homeScore < match.awayScore) return 'AWAY';
  return 'DRAW';
}

// Resolve as apostas em aberto de jogos já encerrados e paga os vencedores.
// Usado pelo cron diário E sob demanda (quando alguém abre o app).
export async function settleOpenBets(matches) {
  if (!hasDB()) return { settled: 0 };
  const open = await sbSelect('bets', `status=eq.OPEN&select=*`);
  if (!open.length) return { settled: 0, paidPlayers: 0 };

  const list = matches || (await getMatches());
  const byId = Object.fromEntries(list.map((m) => [m.id, m]));

  let settled = 0;
  const credit = {};
  for (const bet of open) {
    const match = byId[bet.match_id];
    if (!match) continue;
    const outcome = outcomeOf(match);
    if (!outcome) continue;

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

  for (const [userId, amount] of Object.entries(credit)) {
    const u = (await sbSelect('users', `id=eq.${userId}&select=balance`))[0];
    if (!u) continue;
    await sbUpdate('users', `id=eq.${userId}`, {
      balance: Math.round((u.balance + amount) * 100) / 100,
    });
  }
  return { settled, paidPlayers: Object.keys(credit).length };
}

// ---------- Jogos de exemplo (modo demonstração, sem API) ----------
// Datas em torno de 16/06/2026 para já mostrar jogo ao vivo e encerrados.
const SAMPLE_FIXTURES = [
  { id: 9001, utcDate: '2026-06-14T19:00:00Z', status: 'FINISHED', homeTeam: 'Brazil', awayTeam: 'Serbia', homeScore: 2, awayScore: 0, group: 'Grupo G' },
  { id: 9002, utcDate: '2026-06-15T16:00:00Z', status: 'FINISHED', homeTeam: 'Argentina', awayTeam: 'Mexico', homeScore: 1, awayScore: 1, group: 'Grupo C' },
  { id: 9003, utcDate: '2026-06-16T18:00:00Z', status: 'IN_PLAY', homeTeam: 'France', awayTeam: 'Croatia', homeScore: 1, awayScore: 0, group: 'Grupo D' },
  { id: 9004, utcDate: '2026-06-16T21:00:00Z', status: 'TIMED', homeTeam: 'Portugal', awayTeam: 'Morocco', homeScore: null, awayScore: null, group: 'Grupo H' },
  { id: 9005, utcDate: '2026-06-17T16:00:00Z', status: 'SCHEDULED', homeTeam: 'England', awayTeam: 'USA', homeScore: null, awayScore: null, group: 'Grupo B' },
  { id: 9006, utcDate: '2026-06-17T19:00:00Z', status: 'SCHEDULED', homeTeam: 'Spain', awayTeam: 'Germany', homeScore: null, awayScore: null, group: 'Grupo E' },
  { id: 9007, utcDate: '2026-06-18T18:00:00Z', status: 'SCHEDULED', homeTeam: 'Netherlands', awayTeam: 'Japan', homeScore: null, awayScore: null, group: 'Grupo F' },
  { id: 9008, utcDate: '2026-06-18T21:00:00Z', status: 'SCHEDULED', homeTeam: 'Uruguay', awayTeam: 'Senegal', homeScore: null, awayScore: null, group: 'Grupo A' },
];

// ---------- Códigos de país (ISO) p/ imagens de bandeira (flagcdn.com) ----------
const CODES = {
  'Brazil': 'br', 'Argentina': 'ar', 'France': 'fr', 'England': 'gb-eng', 'Spain': 'es',
  'Portugal': 'pt', 'Netherlands': 'nl', 'Belgium': 'be', 'Germany': 'de', 'Italy': 'it',
  'Croatia': 'hr', 'Uruguay': 'uy', 'Colombia': 'co', 'Morocco': 'ma', 'Switzerland': 'ch',
  'USA': 'us', 'United States': 'us', 'Mexico': 'mx', 'Senegal': 'sn', 'Japan': 'jp',
  'Denmark': 'dk', 'Korea Republic': 'kr', 'South Korea': 'kr', 'Australia': 'au',
  'Poland': 'pl', 'Serbia': 'rs', 'Ecuador': 'ec', 'Ukraine': 'ua', 'Austria': 'at',
  'Sweden': 'se', 'Wales': 'gb-wls', 'Peru': 'pe', 'Tunisia': 'tn', 'Nigeria': 'ng',
  'Ghana': 'gh', 'Cameroon': 'cm', 'Egypt': 'eg', 'Algeria': 'dz', 'Ivory Coast': 'ci',
  "Côte d'Ivoire": 'ci', 'Canada': 'ca', 'Costa Rica': 'cr', 'Panama': 'pa',
  'Saudi Arabia': 'sa', 'Iran': 'ir', 'Qatar': 'qa', 'Iraq': 'iq', 'Jordan': 'jo',
  'Uzbekistan': 'uz', 'New Zealand': 'nz', 'Paraguay': 'py', 'Chile': 'cl',
  'Venezuela': 've', 'Bolivia': 'bo', 'Scotland': 'gb-sct', 'Norway': 'no', 'Turkey': 'tr',
  'Türkiye': 'tr', 'Greece': 'gr', 'Czech Republic': 'cz', 'Czechia': 'cz', 'Hungary': 'hu',
  'Romania': 'ro', 'Slovenia': 'si', 'Slovakia': 'sk', 'South Africa': 'za',
  'Cape Verde': 'cv', 'DR Congo': 'cd', 'Mali': 'ml', 'Burkina Faso': 'bf',
  'Honduras': 'hn', 'Jamaica': 'jm', 'Curaçao': 'cw', 'Haiti': 'ht', 'El Salvador': 'sv',
  // Variações de nome usadas pelo football-data.org:
  'Congo DR': 'cd', 'DR Congo': 'cd', 'Bosnia-Herzegovina': 'ba',
  'Cape Verde Islands': 'cv', 'IR Iran': 'ir', 'Korea DPR': 'kp',
  'Trinidad and Tobago': 'tt', 'North Macedonia': 'mk', 'Republic of Ireland': 'ie',
  'Northern Ireland': 'gb-nir', 'United Arab Emirates': 'ae', 'New Caledonia': 'nc',
};

export function flagCode(name) {
  if (!name) return '';
  if (CODES[name]) return CODES[name];
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const target = norm(name);
  for (const k of Object.keys(CODES)) {
    if (norm(k) === target) return CODES[k];
  }
  return '';
}
