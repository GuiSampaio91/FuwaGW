// Cache-busting with GitHub Pages build hash (no renames)
const VER = document.querySelector('meta[name="build"]')?.content || Date.now().toString();
const cfg = await import(`./config.js?v=${VER}`);
const { SHEET_ID, API_KEY, RANGE_A1, APPS_SCRIPT } = cfg;

const $sel        = document.querySelector('#playerSelect');
const $stats      = document.querySelector('#stats');
const $err        = document.querySelector('#error');
const $last       = document.querySelector('#lastUpdated');
const $guildTitle = document.querySelector('#guildTitle');
const $guildStats = document.querySelector('#guildStats');
const $addBtn     = document.querySelector('#addBtn');

// Insights DOM
const $tblHeroStats = document.querySelector('#tblHeroStats tbody');
const $tblEnemy     = document.querySelector('#tblEnemy tbody');
const $tblMatchups  = document.querySelector('#tblMatchups tbody');

const $busy = document.querySelector('#busy');

function showBusy(msg = 'Loading…') {
  if ($busy) {
    const m = $busy.querySelector('.msg');
    if (m) m.textContent = msg;
    $busy.classList.remove('hidden');
  }
  // Bloqueia scroll e interações básicas
  document.body.style.overflow = 'hidden';
  if ($sel) $sel.disabled = true;
  if ($addBtn) $addBtn.setAttribute('aria-disabled','true');
}

function hideBusy() {
  if ($busy) $busy.classList.add('hidden');
  document.body.style.overflow = '';
  if ($sel) $sel.disabled = false;
  if ($addBtn) $addBtn.removeAttribute('aria-disabled');
}

const endpoint = (sheetId, rangeA1) =>
  `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(rangeA1)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING&key=${API_KEY}`;

// helpers
function toPercent(x, digits = 1) {
  if (x == null || x === "") return "–";
  if (typeof x === "string" && x.includes("%")) return x.trim();
  const n = Number(x);
  if (!isFinite(n)) return "–";
  const val = n > 1 ? n : n * 100;
  return val.toFixed(digits) + "%";
}
function toNum(x) { const n = Number(x); return Number.isFinite(n) ? n : 0; }
function escHTML(s) { return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c])); }
function escAttr(s) { return String(s).replace(/"/g, '&quot;'); }
function pick(obj, ...keys) { for (const k of keys) if (Object.hasOwn(obj,k) && obj[k]!==undefined) return obj[k]; }

function parseRows(values) {
  if (!values || values.length < 2) return { headers: [], rows: [], values };
  const headers = values[0].map(h => String(h).trim());
  const rows = values.slice(1)
    .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])))
    .filter(obj => {
      const p = (obj["Player"] || "").toString().trim();
      if (!p) return false;
      if (p.toLowerCase() === "guild stats") return false;
      return true;
    });
  return { headers, rows, values };
}

// Guild mini-table (robusto)
function extractGuildStats(values) {
  if (!Array.isArray(values) || !values.length) return null;
  let col = -1, row = -1;
  outer:
  for (let r = 0; r < values.length; r++) {
    const rowArr = values[r] || [];
    for (let c = 0; c < rowArr.length; c++) {
      const cell = String(rowArr[c] ?? "").trim().toLowerCase();
      if (cell === "guild stats") { row = r; col = c; break outer; }
    }
  }
  if (col !== -1) {
    return {
      title:  values[row]?.[col] || "Guild Stats",
      label1: values[row + 1]?.[col] || "Avg. W/R",
      value1: values[row + 1]?.[col + 1],
      label2: values[row + 2]?.[col] || "Avg. Miss Rate",
      value2: values[row + 2]?.[col + 1],
    };
  }
  let r1=-1,c1=-1,r2=-1,c2=-1;
  for (let r = 0; r < values.length; r++) {
    const rowArr = values[r] || [];
    for (let c = 0; c < rowArr.length; c++) {
      const cell = String(rowArr[c] ?? "").trim().toLowerCase();
      if (cell === "avg. w/r")       { r1 = r; c1 = c; }
      if (cell === "avg. miss rate") { r2 = r; c2 = c; }
    }
  }
  if (c1 !== -1 || c2 !== -1) {
    return {
      title:  "Guild Stats",
      label1: r1 !== -1 ? values[r1]?.[c1] : "Avg. W/R",
      value1: r1 !== -1 ? values[r1]?.[c1 + 1] : undefined,
      label2: r2 !== -1 ? values[r2]?.[c2] : "Avg. Miss Rate",
      value2: r2 !== -1 ? values[r2]?.[c2 + 1] : undefined,
    };
  }
  return null;
}

function buildPlayerOptions(rows) {
  const names = Array.from(new Set(rows.map(r => (r["Player"] || "").toString().trim())))
    .filter(Boolean)
    .sort((a,b)=>a.localeCompare(b));
  $sel.innerHTML = `<option value="">Select...</option>` +
    names.map(n => `<option value="${escAttr(n)}">${escHTML(n)}</option>`).join("");
}

function renderStats(row) {
  if (!row) { $stats.innerHTML = `<div class="placeholder">Pick a player to see data.</div>`; return; }
  const wins   = toNum(row["Wins"]);
  const draws  = toNum(row["Draws"]);
  const losses = toNum(row["Losses"]);
  const wr     = row["W/R"];
  const atks   = toNum(row["Total Atks"]);
  const mr     = row["Miss Rate"];
  const joined = pick(row, "Joined", "Season Join Date") ?? "–";
  const dead   = toNum(pick(row, "D/T Hits", "DeadTower Total")) || 0;
  const goodWR = Number(wr) >= 0.85;
  const lowMR  = Number(mr) <= 0.12;

  $stats.innerHTML = `
    <div class="stat"><div class="k">Wins</div><div class="v">${wins}</div></div>
    <div class="stat"><div class="k">Draws</div><div class="v">${draws}</div></div>
    <div class="stat"><div class="k">Losses</div><div class="v">${losses}</div></div>
    <div class="stat ${goodWR ? 'good' : ''}"><div class="k">W/R</div><div class="v">${toPercent(wr)}</div></div>
    <div class="stat ${lowMR ? 'good' : 'bad'}"><div class="k">Miss Rate</div><div class="v">${toPercent(mr)}</div></div>
    <div class="stat"><div class="k">Total Attacks</div><div class="v">${atks}</div></div>
    <div class="stat"><div class="k">Dead Tower Atks</div><div class="v">${dead}</div></div>
    <div class="stat"><div class="k">Season Join Date</div><div class="v">${escHTML(joined)}</div></div>
  `;
}

// === paint helpers ===
function fmtPct(x) { return (x*100).toFixed(1) + '%'; }
function fillTable(tbody, rows, cols) {
  tbody.innerHTML = '';
  if (!rows || !rows.length) {
    const tr = document.createElement('tr');
    tr.className = 'placeholder';
    const td = document.createElement('td');
    td.colSpan = cols.length;
    td.textContent = 'No data.';
    tr.appendChild(td);
    tbody.appendChild(tr);
    return;
  }
  rows.forEach(r => {
    const tr = document.createElement('tr');
    cols.forEach(c => {
      const td = document.createElement('td');
      td.textContent = (typeof c === 'function') ? c(r) : r[c];
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

async function loadGuildAggregates() {
  if (!APPS_SCRIPT || !APPS_SCRIPT.BASE_URL) return null;
  const url = `${APPS_SCRIPT.BASE_URL}?route=guild`;
  try {
    const r = await fetch(url);
    const j = await r.json();
    if (!j.ok) return null;
    return j.guild || null;
  } catch { return null; }
}

// MVP: maior W/R; empate resolve por menor Miss Rate, depois Wins, depois Draws, depois ordem alfabética
function computeMVP(rows) {
  const norm = v => Number(v ?? 0);
  const has = (r,k) => r[k] !== undefined && r[k] !== null && r[k] !== '';

  const candidates = rows
    .map(r => ({
      name: (r['Player']||'').toString().trim(),
      wr:   norm(r['W/R']),
      mr:   norm(('Miss Rate' in r) ? r['Miss Rate'] : r['MR']),
      wins: norm(r['Wins']),
      draws:norm(r['Draws']),
    }))
    .filter(x => x.name && Number.isFinite(x.wr));

  if (!candidates.length) return null;

  candidates.sort((a,b) =>
    (b.wr - a.wr) ||
    (a.mr - b.mr) ||
    (b.wins - a.wins) ||
    (b.draws - a.draws) ||
    a.name.localeCompare(b.name)
  );

  return candidates[0];
}

// === sort infra ===
function parsePercentCell(s) {
  if (s == null || s === "") return NaN;
  if (typeof s === "string") {
    const t = s.replace('%','').replace(',','.').trim();
    const n = Number(t);
    if (Number.isFinite(n)) return n;
  }
  const n = Number(s);
  if (!Number.isFinite(n)) return NaN;
  return n > 1 ? n : n * 100; // 0.5 -> 50
}
function attachSortable(tableEl, getRows, paint, types){
  const ths = tableEl.querySelectorAll('thead th');

  // Limpa bindings antigos (se existirem) e estado visual
  ths.forEach(th => {
    if (th._sortHandler) {
      th.removeEventListener('click', th._sortHandler);
    }
    th._sortHandler = null;
    th.dataset.dir = '';
    th.removeAttribute('aria-sort');
  });

  const cmpText = (a,b) => String(a).localeCompare(String(b));
  const cmpNum  = (a,b) => (Number(a)||0) - (Number(b)||0);
  const cmpPct  = (a,b) => {
    const av = parsePercentCell(a); const bv = parsePercentCell(b);
    if (!Number.isFinite(av) && !Number.isFinite(bv)) return 0;
    if (!Number.isFinite(av)) return -1;
    if (!Number.isFinite(bv)) return 1;
    return av - bv;
  };

  // Captura a ordem base para permitir "3º clique" (limpar sort)
  const baseOrder = getRows().slice();

  ths.forEach((th, idx) => {
    const type = th.dataset.type || types[idx] || 'text';
    const comp = (type === 'number') ? cmpNum : (type === 'percent') ? cmpPct : cmpText;
    th.style.cursor = 'pointer';

    th._sortHandler = () => {
      const prev = th.dataset.dir || '';
      // alternância de 3 estados: '' -> asc -> desc -> ''
      const dir = prev === '' ? 'asc' : (prev === 'asc' ? 'desc' : '');

      // limpa estado dos outros th
      ths.forEach(h => { if (h!==th) { h.dataset.dir=''; h.removeAttribute('aria-sort'); }});

      const rows = getRows();
      if (dir === '') {
        // restaura ordem base
        rows.length = 0;
        rows.push(...baseOrder);
        th.dataset.dir = '';
        th.removeAttribute('aria-sort');
        paint(rows);
        return;
      }

      th.dataset.dir = dir;
      th.setAttribute('aria-sort', dir === 'asc' ? 'ascending' : 'descending');

      rows.sort((a,b) => {
        const r = comp(a[idx], b[idx]);
        const safe = Number.isFinite(r) ? r : 0;
        return dir === 'asc' ? safe : -safe;
      });

      paint(rows);
    };

    th.addEventListener('click', th._sortHandler);
  });
}


// === render insights (3 tabelas) ===
function renderInsights(stats) {
  // Hero Stats
  let hs = (stats?.heroStats || []).map(r => [r.hero, (r.wr*100).toFixed(1)+'%', r.battles, r.deaths]);
  const paintHero = (rows = hs) => fillTable($tblHeroStats, rows, [0,1,2,3].map(i => r => r[i]));
  paintHero(hs);
  attachSortable(document.querySelector('#tblHeroStats'), () => hs, paintHero, ['text','percent','number','number']);

  // Enemy loss rate
  let enemy = (stats?.enemyLossrate || []).map(r => [r.enemyHero, (r.lossRate*100).toFixed(1)+'%', r.battles]);
  enemy.sort((a,b)=> parsePercentCell(b[1]) - parsePercentCell(a[1]) || (b[2]-a[2]));
  const paintEnemy = (rows = enemy) => fillTable($tblEnemy, rows, [0,1,2].map(i => r=>r[i]));
  paintEnemy(enemy);
  attachSortable(document.querySelector('#tblEnemy'), () => enemy, paintEnemy, ['text','percent','number']);

  // Matchups
  let mus = (stats?.matchups || []).map(r => [r.team, (r.wr*100).toFixed(1)+'%', r.battles]);
  mus.sort((a,b)=> parsePercentCell(b[1]) - parsePercentCell(a[1]) || (b[2]-a[2]));
  const paintMu = (rows = mus) => fillTable($tblMatchups, rows, [0,1,2].map(i => r=>r[i]));
  paintMu(mus);
  attachSortable(document.querySelector('#tblMatchups'), () => mus, paintMu, ['text','percent','number']);
}

// app.js — substitua a versão atual de renderGuildStats por esta:
function renderGuildStats(gs, mvp, agg) {
  $guildTitle.textContent = String(gs?.title || "Guild Stats");

  const v1 = toPercent(gs?.value1);
  const v2 = toPercent(gs?.value2);

const mvpHtml = mvp
  ? `<div class="stat">
       <div class="k">MVP</div>
       <div class="v">${escHTML(mvp.name)}</div>
     </div>`
  : `<div class="stat"><div class="k">MVP</div><div class="v">–</div></div>`;

  const usedHtml = agg?.mostUsedHero
    ? `<div class="stat">
         <div class="k">Most Used Hero</div>
         <div class="v">${escHTML(agg.mostUsedHero.hero)}</div>
         <div class="k">Uses</div>
         <div class="v">${agg.mostUsedHero.uses}</div>
       </div>`
    : `<div class="stat"><div class="k">Most Used Hero</div><div class="v">–</div></div>`;

  const intHtml = agg?.intbringer
    ? `<div class="stat">
         <div class="k">Intbringer</div>
         <div class="v">${escHTML(agg.intbringer.hero)}</div>
         <div class="k">Enemy W/R vs us</div>
         <div class="v">${toPercent(agg.intbringer.enemyWinRate)}</div>
       </div>`
    : `<div class="stat"><div class="k">Intbringer</div><div class="v">–</div></div>`;

  $guildStats.innerHTML = `
    <div class="stat"><div class="k">${escHTML(gs?.label1 || "Avg. W/R")}</div><div class="v">${v1}</div></div>
    <div class="stat"><div class="k">${escHTML(gs?.label2 || "Avg. Miss Rate")}</div><div class="v">${v2}</div></div>
    ${mvpHtml}
    ${usedHtml}
    ${intHtml}
  `;
}

async function loadProfileStats(player) {
  if (!APPS_SCRIPT || !APPS_SCRIPT.BASE_URL) return null;
  const url = `${APPS_SCRIPT.BASE_URL}?route=profile&player=${encodeURIComponent(player)}`;
  try {
    const res = await fetch(url);
    const js  = await res.json();
    if (!js.ok) { console.error('profile error:', js); return null; }
    return js.stats;
  } catch (e) {
    console.error('profile fetch failed', e);
    return null;
  }
}

async function load() {
  showBusy('Loading data…');
  try {
    $err.classList.add('hidden'); 
    $err.textContent = '';

    const url = endpoint(SHEET_ID, RANGE_A1) + `&t=${Date.now()}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const { rows, values } = parseRows(json.values);
    if (!rows.length) throw new Error('No data found.');

    buildPlayerOptions(rows);
    window._guildRows = rows;
    $last.textContent = `Loaded at ${new Date().toLocaleString()}`;

    // Guild mini-cards + agregados
    const guildCells = extractGuildStats(values);
    const mvp = computeMVP(rows);
    const agg = await loadGuildAggregates();
    renderGuildStats(guildCells, mvp, agg);

    // Pré-selecionado via ?p=Nome
    const pre = new URLSearchParams(location.search).get('p');
    if (pre) {
      $sel.value = pre;
      const row = rows.find(r => (r["Player"] || "").toString().trim() === pre);
      renderStats(row || null);
      if (row) {
        $addBtn.href = `add.html?p=${encodeURIComponent(pre)}`;
        $addBtn.hidden = false;
        const stats = await loadProfileStats(pre);
        renderInsights(stats || {});
      }
    } else {
      // estado “vazio” inicial
      renderStats(null);
      $addBtn.hidden = true;
      renderInsights({ heroStats: [], enemyLossrate: [], matchups: [] });
    }
  } catch (e) {
    console.error(e);
    $err.textContent = `Failed to load data: ${e.message}`;
    $err.classList.remove('hidden');
  } finally {
    hideBusy();
  }
}

$sel.addEventListener('change', async () => {
  showBusy('Loading player stats…');
  try {
    const name = $sel.value;
    const rows = window._guildRows || [];
    const row = rows.find(r => (r["Player"] || "").toString().trim() === name);

    if (!name || !row) {
      renderStats(null);
      $addBtn.hidden = true;
      renderInsights({ heroStats: [], enemyLossrate: [], matchups: [] });
      return;
    }

    // pinta card “Stats” imediatamente com dados tabulares
    renderStats(row);
    $addBtn.href = `add.html?p=${encodeURIComponent(name)}`;
    $addBtn.hidden = false;

    // busca perfil detalhado (3 tabelas)
    const stats = await loadProfileStats(name);
    renderInsights(stats || {});
  } finally {
    hideBusy();
  }
});
);

load();
