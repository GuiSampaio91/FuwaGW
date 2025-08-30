const VER = document.querySelector('meta[name="build"]')?.content || Date.now().toString();
const { SHEET_ID, API_KEY, RANGE_A1 } = await import(`./config.js?v=${VER}`);

const $sel        = document.querySelector('#playerSelect');
const $stats      = document.querySelector('#stats');
const $err        = document.querySelector('#error');
const $last       = document.querySelector('#lastUpdated');
const $guildTitle = document.querySelector('#guildTitle');
const $guildStats = document.querySelector('#guildStats');

const endpoint = (sheetId, rangeA1) =>
  `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${encodeURIComponent(rangeA1)}?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=FORMATTED_STRING&key=${API_KEY}`;

function toPercent(x, digits = 1) {
  if (x == null || x === "") return "–";
  const n = Number(x);
  if (!isFinite(n)) return "–";
  return (n * 100).toFixed(digits) + "%";
}
function toNum(x) {
  if (x == null || x === "") return 0;
  const n = Number(x);
  return isFinite(n) ? n : 0;
}
function escHTML(s) {
  return String(s).replace(/[&<>]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
}
function escAttr(s) {
  return String(s).replace(/"/g, '&quot;');
}
function pick(obj, ...keys) {
  for (const k of keys) if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] !== undefined) return obj[k];
  return undefined;
}

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

function extractGuildStats(values) {
  if (!Array.isArray(values) || !values.length) return null;

  let col = -1, row = -1;
  for (let r = 0; r < Math.min(values.length, 5); r++) {
    const rowArr = values[r] || [];
    for (let c = 0; c < rowArr.length; c++) {
      if (String(rowArr[c]).trim().toLowerCase() === "guild stats") {
        col = c; row = r; break;
      }
    }
    if (col !== -1) break;
  }
  if (col === -1) return null;

  const title  = values[row]?.[col] || "Guild Stats";
  const label1 = values[row + 1]?.[col] || "Avg. W/R";
  const value1 = values[row + 1]?.[col + 1];
  const label2 = values[row + 2]?.[col] || "Avg. Miss Rate";
  const value2 = values[row + 2]?.[col + 1];

  return { title, label1, value1, label2, value2 };
}

function buildPlayerOptions(rows) {
  const names = Array.from(new Set(rows.map(r => (r["Player"] || "").toString().trim())))
    .filter(Boolean)
    .sort((a,b)=>a.localeCompare(b));

  $sel.innerHTML = `<option value="">Select...</option>` +
    names.map(n => `<option value="${escAttr(n)}">${escHTML(n)}</option>`).join("");
}

function renderStats(row) {
  if (!row) {
    $stats.innerHTML = `<div class="placeholder">Pick a player to see data.</div>`;
    return;
  }
  const wins   = toNum(row["Wins"]);
  const draws  = toNum(row["Draws"]);
  const losses = toNum(row["Losses"]);
  const wr     = row["W/R"];
  const atks   = toNum(row["Total Atks"]);
  const mr     = row["Miss Rate"];

  const joinedRaw = pick(row, "Joined", "Season Join Date");
  const joined    = joinedRaw ?? "–";

  // Sheet column "D/T Hits" (fallback to old "DeadTower Total")
  const dead = toNum(pick(row, "D/T Hits", "DeadTower Total")) || 0;

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

function renderGuildStats(gs) {
  if (!gs) {
    $guildTitle.textContent = "Guild Stats";
    $guildStats.innerHTML = `<div class="placeholder">Guild stats unavailable.</div>`;
    return;
  }
  $guildTitle.textContent = String(gs.title || "Guild Stats");

  const v1 = toPercent(gs.value1);
  const v2 = toPercent(gs.value2);

  $guildStats.innerHTML = `
    <div class="stat"><div class="k">${escHTML(gs.label1 || "Avg. W/R")}</div><div class="v">${v1}</div></div>
    <div class="stat"><div class="k">${escHTML(gs.label2 || "Avg. Miss Rate")}</div><div class="v">${v2}</div></div>
  `;
}

async function load() {
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

    renderGuildStats(extractGuildStats(values));

    const pre = new URLSearchParams(location.search).get('p');
    if (pre) {
      $sel.value = pre;
      const row = rows.find(r => (r["Player"] || "").toString().trim() === pre);
      renderStats(row || null);
    } else {
      renderStats(null);
    }
  } catch (e) {
    console.error(e);
    $err.textContent = `Failed to load data: ${e.message}`;
    $err.classList.remove('hidden');
  }
}

$sel.addEventListener('change', () => {
  const name = $sel.value;
  if (!name) return renderStats(null);
  const rows = window._guildRows || [];
  const row = rows.find(r => (r["Player"] || "").toString().trim() === name);
  renderStats(row || null);
});

load();
