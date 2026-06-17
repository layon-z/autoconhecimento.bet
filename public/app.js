// ============================================================
// AutoConhecimento.Bet — lógica do app (cliente)
// ============================================================
const $ = (id) => document.getElementById(id);
const api = async (url, opts) => {
  const r = await fetch(url, opts);
  if (r.status === 401) { window.location.href = '/'; throw new Error('login'); }
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Erro.');
  return data;
};

const money = (n) =>
  (Number(n) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
};

let ME = null;
let MATCHES = [];

// ---------- Boot ----------
(async function init() {
  try {
    const { user } = await api('/api/me');
    ME = user;
    $('hiName').textContent = user.name;
    $('balance').textContent = money(user.balance);
    if (user.is_admin) $('adminTab').classList.remove('hidden');
  } catch (_) { return; }
  loadToday();
})();

// ---------- Tabs ----------
document.querySelectorAll('.tab').forEach((t) => {
  t.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((x) => x.classList.remove('active'));
    t.classList.add('active');
    const tab = t.dataset.tab;
    ['today', 'games', 'groups', 'bets', 'ranking', 'admin'].forEach((v) =>
      $('view-' + v).classList.toggle('hidden', v !== tab)
    );
    if (tab === 'today') loadToday();
    if (tab === 'games') loadGames();
    if (tab === 'groups') loadGroups();
    if (tab === 'bets') loadBets();
    if (tab === 'ranking') loadRanking();
    if (tab === 'admin') loadAdmin();
  });
});

$('logout').addEventListener('click', async (e) => {
  e.preventDefault();
  await fetch('/api/logout', { method: 'POST' });
  window.location.href = '/';
});

// ============================================================
// JOGOS
// ============================================================
async function fetchMatches() {
  const { matches } = await api('/api/matches');
  MATCHES = matches;
  return matches;
}
function bindOdds(el) {
  el.querySelectorAll('.odd-btn').forEach((b) =>
    b.addEventListener('click', () => openBet(b.dataset.match, b.dataset.sel))
  );
}

// ---- Helpers de data (no fuso do navegador = horário do Brasil) ----
const dayKey = (iso) => new Date(iso).toLocaleDateString('pt-BR');
function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const tomorrow = new Date(); tomorrow.setDate(today.getDate() + 1);
  const k = dayKey(iso);
  if (k === today.toLocaleDateString('pt-BR')) return 'Hoje';
  if (k === tomorrow.toLocaleDateString('pt-BR')) return 'Amanhã';
  return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}
function untilLabel(iso) {
  const diff = new Date(iso) - new Date();
  if (diff <= 0) return '';
  const h = Math.floor(diff / 3600000), m = Math.floor((diff % 3600000) / 60000);
  if (h >= 24) return `em ${Math.floor(h / 24)}d`;
  if (h > 0) return `começa em ${h}h${m > 0 ? ' ' + m + 'min' : ''}`;
  return `começa em ${m}min`;
}

// ============================================================
// ⭐ HOJE (tela inicial)
// ============================================================
async function loadToday() {
  const el = $('view-today');
  el.innerHTML = '<div class="empty">Carregando... ⚽</div>';
  try {
    const matches = await fetchMatches();
    const tk = new Date().toLocaleDateString('pt-BR');
    const live = matches.filter((m) => m.phase === 'live');
    const todays = matches.filter((m) => m.phase !== 'live' && dayKey(m.utcDate) === tk);

    let html = '';
    if (live.length) html += section('🔴 AO VIVO AGORA', live);
    if (todays.length) html += section('📅 JOGOS DE HOJE', todays);
    if (!live.length && !todays.length) {
      const next = matches.filter((m) => m.phase === 'upcoming').slice(0, 6);
      html = '<div class="empty">Sem jogos hoje. 👀 Mas vem mais aí:</div>';
      if (next.length) html += section('📅 PRÓXIMOS JOGOS', next);
    }
    el.innerHTML = html || '<div class="empty">Nenhum jogo disponível.</div>';
    bindOdds(el);
  } catch (e) {
    el.innerHTML = `<div class="empty">Erro: ${e.message}</div>`;
  }
}

// ============================================================
// ⚽ JOGOS (todos, separados por data)
// ============================================================
async function loadGames() {
  const el = $('view-games');
  el.innerHTML = '<div class="empty">Carregando jogos da Copa... ⚽</div>';
  try {
    const matches = await fetchMatches();
    if (!matches.length) { el.innerHTML = '<div class="empty">Nenhum jogo disponível.</div>'; return; }

    const live = matches.filter((m) => m.phase === 'live');
    const upcoming = matches.filter((m) => m.phase === 'upcoming');
    const done = matches.filter((m) => m.phase === 'done');

    let html = '';
    if (live.length) html += section('🔴 AO VIVO', live);

    const byDay = {};
    upcoming.forEach((m) => { (byDay[dayKey(m.utcDate)] ||= []).push(m); });
    Object.values(byDay)
      .sort((a, b) => new Date(a[0].utcDate) - new Date(b[0].utcDate))
      .forEach((list) => { html += section('📅 ' + dayLabel(list[0].utcDate), list); });

    if (done.length) html += section('✅ ENCERRADOS', done.slice().reverse().slice(0, 30));
    el.innerHTML = html || '<div class="empty">Nenhum jogo.</div>';
    bindOdds(el);
  } catch (e) {
    el.innerHTML = `<div class="empty">Erro: ${e.message}</div>`;
  }
}

// ============================================================
// 📊 GRUPOS (classificação real)
// ============================================================
let GROUPS = [];
let selectedGroup = null;
const groupLetter = (s) => (String(s || '').toUpperCase().match(/([A-L])(?!.*[A-L])/) || [])[1] || '';

async function loadGroups() {
  const el = $('view-groups');
  el.innerHTML = '<div class="empty">Carregando classificações... 📊</div>';
  try {
    if (!MATCHES.length) await fetchMatches();
    const { standings } = await api('/api/standings');
    GROUPS = standings || [];
    if (!GROUPS.length) {
      el.innerHTML = '<div class="empty">A tabela dos grupos aparece quando a fase de grupos começar. ⚽</div>';
      return;
    }
    if (!selectedGroup || !GROUPS.find((g) => g.group === selectedGroup)) selectedGroup = GROUPS[0].group;
    renderGroups();
  } catch (e) {
    el.innerHTML = `<div class="empty">Erro: ${e.message}</div>`;
  }
}

function renderGroups() {
  const el = $('view-groups');
  const chips = GROUPS.map((g) =>
    `<div class="gchip ${g.group === selectedGroup ? 'active' : ''}" data-g="${g.group}">${g.group.replace('Grupo ', '')}</div>`
  ).join('');

  const g = GROUPS.find((x) => x.group === selectedGroup) || GROUPS[0];
  const rows = g.table.map((r) => `
    <tr class="${r.position <= 2 ? 'qualify' : ''}">
      <td class="pos">${r.position}</td>
      <td class="tname">${flagImg(r.code)}<span>${r.team}</span></td>
      <td><b>${r.points}</b></td><td>${r.played}</td><td>${r.won}</td>
      <td>${r.draw}</td><td>${r.lost}</td><td>${r.gd > 0 ? '+' : ''}${r.gd}</td>
    </tr>`).join('');

  const letter = groupLetter(selectedGroup);
  const gm = MATCHES.filter((m) => groupLetter(m.group) === letter);

  el.innerHTML = `
    <div class="gchips">${chips}</div>
    <div class="card" style="padding:0;overflow:hidden;margin-bottom:6px">
      <table class="standings">
        <thead><tr><th>#</th><th class="l">Time</th><th>Pts</th><th>J</th><th>V</th><th>E</th><th>D</th><th>SG</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
    <p class="muted" style="font-size:12px;text-align:center;margin:0 0 14px">🟢 Os 2 primeiros se classificam</p>
    ${gm.length ? '<div class="section-title">JOGOS DO GRUPO</div>' + gm.map(matchCard).join('') : ''}
  `;
  el.querySelectorAll('.gchip').forEach((c) =>
    c.addEventListener('click', () => { selectedGroup = c.dataset.g; renderGroups(); })
  );
  bindOdds(el);
}

function section(title, list) {
  return `<div class="section-title">${title}</div>` + list.map(matchCard).join('');
}

// Bandeira como imagem (flagcdn.com). Se faltar o código, mostra bandeira branca.
function flagImg(code) {
  if (!code) return '<span class="flag">🏳️</span>';
  return `<img class="flag-img" src="https://flagcdn.com/w80/${code}.png"
    srcset="https://flagcdn.com/w160/${code}.png 2x" alt="" loading="lazy"
    onerror="this.outerHTML='<span class=&quot;flag&quot;>🏳️</span>'">`;
}

function matchCard(m) {
  const until = m.phase === 'upcoming' ? untilLabel(m.utcDate) : '';
  const statusHtml =
    m.phase === 'live' ? '<span class="status-live">● AO VIVO</span>'
    : m.phase === 'done' ? '<span class="status-done">Encerrado</span>'
    : `${fmtDate(m.utcDate)}${until ? ` · ${until}` : ''}`;

  const score = (m.phase === 'live' || m.phase === 'done')
    ? `${m.homeScore ?? 0} <span class="vs">x</span> ${m.awayScore ?? 0}`
    : '<span class="vs">x</span>';

  const odds = m.phase === 'upcoming' ? `
    <div class="odds">
      <div class="odd-btn" data-match="${m.id}" data-sel="HOME">
        <span class="lbl">Casa</span><span class="val">${m.odds.home.toFixed(2)}</span></div>
      <div class="odd-btn" data-match="${m.id}" data-sel="DRAW">
        <span class="lbl">Empate</span><span class="val">${m.odds.draw.toFixed(2)}</span></div>
      <div class="odd-btn" data-match="${m.id}" data-sel="AWAY">
        <span class="lbl">Fora</span><span class="val">${m.odds.away.toFixed(2)}</span></div>
    </div>` : '<p class="muted" style="text-align:center;font-size:13px">Apostas encerradas</p>';

  return `
  <div class="match">
    <div class="head"><span>${m.group || 'Copa 2026'}</span><span>${statusHtml}</span></div>
    <div class="teams">
      <div class="team">${flagImg(m.homeCode)}<span class="name">${m.homeTeam}</span></div>
      <div class="score">${score}</div>
      <div class="team">${flagImg(m.awayCode)}<span class="name">${m.awayTeam}</span></div>
    </div>
    ${odds}
  </div>`;
}

// ============================================================
// MODAL DE APOSTA
// ============================================================
let betCtx = null;
function openBet(matchId, sel) {
  const m = MATCHES.find((x) => x.id === matchId);
  if (!m) return;
  const odd = sel === 'HOME' ? m.odds.home : sel === 'AWAY' ? m.odds.away : m.odds.draw;
  const pick = sel === 'HOME' ? m.homeTeam : sel === 'AWAY' ? m.awayTeam : 'Empate';
  betCtx = { matchId, sel, odd };

  $('modalTitle').textContent = `${m.homeTeam} x ${m.awayTeam}`;
  $('modalSub').textContent = `Seu palpite: ${pick} · odd ${odd.toFixed(2)}`;
  $('stake').value = '';
  $('potential').textContent = money(0);
  $('modalErr').textContent = '';
  $('modal').classList.remove('hidden');
}

$('stake').addEventListener('input', () => {
  const v = Number($('stake').value) || 0;
  $('potential').textContent = money(v * (betCtx?.odd || 0));
});
$('cancelBet').addEventListener('click', () => $('modal').classList.add('hidden'));

$('confirmBet').addEventListener('click', async () => {
  const stake = Number($('stake').value);
  if (!(stake > 0)) return ($('modalErr').textContent = 'Digite um valor válido.');
  if (stake > ME.balance) return ($('modalErr').textContent = 'Saldo insuficiente.');
  $('confirmBet').disabled = true;
  try {
    const { balance } = await api('/api/bet', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ matchId: betCtx.matchId, selection: betCtx.sel, stake }),
    });
    ME.balance = balance;
    $('balance').textContent = money(balance);
    $('modal').classList.add('hidden');
  } catch (e) {
    $('modalErr').textContent = e.message;
  } finally {
    $('confirmBet').disabled = false;
  }
});

// ============================================================
// MINHAS APOSTAS
// ============================================================
async function loadBets() {
  const el = $('view-bets');
  el.innerHTML = '<div class="empty">Carregando...</div>';
  try {
    const { bets } = await api('/api/mybets');
    if (!bets.length) { el.innerHTML = '<div class="empty">Você ainda não fez apostas. Bora? ⚽</div>'; return; }
    el.innerHTML = '<div class="card">' + bets.map(betRow).join('') + '</div>';
  } catch (e) {
    el.innerHTML = `<div class="empty">Erro: ${e.message}</div>`;
  }
}

function betRow(b) {
  const pick = b.selection === 'HOME' ? b.home_team : b.selection === 'AWAY' ? b.away_team : 'Empate';
  const badge = b.status === 'WON' ? `<span class="badge-win">✓ Ganhou ${money(b.payout)}</span>`
    : b.status === 'LOST' ? '<span class="badge-lost">✗ Perdeu</span>'
    : '<span class="badge-open">⏳ Em aberto</span>';
  return `
  <div class="row">
    <div>
      <div style="font-weight:700">${b.home_team} x ${b.away_team}</div>
      <div class="muted" style="font-size:13px">Palpite: ${pick} · ${money(b.stake)} @ ${b.odd.toFixed(2)}</div>
    </div>
    <div style="text-align:right">${badge}</div>
  </div>`;
}

// ============================================================
// RANKING
// ============================================================
async function loadRanking() {
  const el = $('view-ranking');
  el.innerHTML = '<div class="empty">Carregando...</div>';
  try {
    const { ranking } = await api('/api/ranking');
    const medals = ['🥇', '🥈', '🥉'];
    el.innerHTML = '<div class="card">' + ranking.map((u, i) => `
      <div class="row">
        <div style="display:flex;align-items:center;gap:10px">
          <span class="rank-num">${medals[i] || i + 1}</span>
          <span style="font-weight:700">${u.name}${u.id === ME.id ? ' <span class="muted">(você)</span>' : ''}</span>
        </div>
        <div style="font-weight:800;color:var(--gold)">${money(u.balance)}</div>
      </div>`).join('') + '</div>';
  } catch (e) {
    el.innerHTML = `<div class="empty">Erro: ${e.message}</div>`;
  }
}

// ============================================================
// ADMIN
// ============================================================
async function adminAction(act, id, name) {
  try {
    if (act === 'add') {
      const v = prompt(`Quanto ADICIONAR ao saldo de ${name}?\n(use número negativo pra TIRAR, ex: -10)`, '10');
      if (v === null) return;
      const amount = Number(String(v).replace(',', '.'));
      if (!isFinite(amount)) return alert('Valor inválido.');
      const r = await api('/api/admin-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'addBalance', userId: id, amount }),
      });
      alert(`✅ Saldo de ${r.name} agora: ${money(r.balance)}`);
    } else if (act === 'set') {
      const v = prompt(`DEFINIR o saldo de ${name} para quanto?`, '50');
      if (v === null) return;
      const amount = Number(String(v).replace(',', '.'));
      if (!isFinite(amount)) return alert('Valor inválido.');
      const r = await api('/api/admin-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'setBalance', userId: id, amount }),
      });
      alert(`✅ Saldo de ${r.name} definido para ${money(r.balance)}`);
    } else if (act === 'remove') {
      if (!confirm(`Remover ${name}?\nIsso apaga a conta e TODAS as apostas dele. Não dá pra desfazer.`)) return;
      const r = await api('/api/admin-action', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'removeUser', userId: id }),
      });
      alert(`🗑️ ${r.removed} removido.`);
    }
    loadAdmin();
  } catch (e) {
    alert('Erro: ' + e.message);
  }
}

async function loadAdmin() {
  const el = $('view-admin');
  el.innerHTML = '<div class="empty">Carregando painel...</div>';
  try {
    const { players, totals, startBalance } = await api('/api/admin');
    let html = `
      <div class="card">
        <div class="section-title" style="margin-top:0">📊 Resumo da casa</div>
        <div class="row"><span class="muted">Jogadores</span><b>${totals.players}</b></div>
        <div class="row"><span class="muted">Saldo total em jogo</span><b>${money(totals.totalBalance)}</b></div>
        <div class="row"><span class="muted">Total de apostas</span><b>${totals.totalBets}</b></div>
        <div class="row"><span class="muted">Total apostado</span><b>${money(totals.totalStaked)}</b></div>
      </div>
      <div class="section-title">👥 Jogadores (saldo inicial ${money(startBalance)})</div>
      <div class="card">`;
    html += players.map((p) => {
      const prof = p.profit >= 0 ? `<span class="badge-win">+${money(p.profit)}</span>` : `<span class="badge-lost">${money(p.profit)}</span>`;
      return `
      <div class="row">
        <div>
          <div style="font-weight:700">${p.name}${p.is_admin ? ' 👑' : ''}</div>
          <div class="muted" style="font-size:12px">${p.bets} apostas · ${p.won}V/${p.lost}D · ${p.open} em aberto</div>
          <div class="admin-actions">
            <button class="mini" data-act="add" data-id="${p.id}" data-name="${p.name}">💰 Saldo</button>
            <button class="mini" data-act="set" data-id="${p.id}" data-name="${p.name}">✏️ Definir</button>
            ${p.is_admin ? '' : `<button class="mini danger" data-act="remove" data-id="${p.id}" data-name="${p.name}">🗑️ Remover</button>`}
          </div>
        </div>
        <div style="text-align:right">
          <div style="font-weight:800;color:var(--gold)">${money(p.balance)}</div>
          <div style="font-size:12px">${prof}</div>
        </div>
      </div>`;
    }).join('') + '</div>';
    el.innerHTML = html;

    el.querySelectorAll('.mini').forEach((btn) =>
      btn.addEventListener('click', () => adminAction(btn.dataset.act, btn.dataset.id, btn.dataset.name))
    );
  } catch (e) {
    el.innerHTML = `<div class="empty">Erro: ${e.message}</div>`;
  }
}
