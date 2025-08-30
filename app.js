// app.js (ESM). Make sure you ALSO have a 'config.js' file in the same folder.
import { SHEET_ID, API_KEY, RANGE_A1 } from "./config.js";

const $sel  = document.querySelector('#playerSelect');
const $stats= document.querySelector('#stats');
const $err  = document.querySelector('#error');
const $last = document.querySelector('#lastUpdated');

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

function parseRows(values) {
  if (!values || values.length < 2) return { headers: [], rows: [] };
  const headers = values[0].map(h => String(h).trim());
  const rows = values.slice(1)
    .map(r => Object.fromEntries(headers.map((h, i) => [h, r[i]])))
    .filter(obj => {
      const p = (obj["Player"] || "").toString().trim();
      if (!p) return false;
      if (p.toLowerCase() === "guild stats") return false;
      return true;
    });
  return { headers, rows };
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
  const joined = row["Joined"] || "–";
  const dead   = toNum(row["DeadTower Total"]) || 0;

  const goodWR = Number(wr) >= 0.85;
  const lowMR  = Number(mr) <= 0.12;

  $stats.innerHTML = `
    <div class="stat"><div class="k">Wins</div><div class="v">${wins}</div></div>
    <div class="stat"><div class="k">Draws</div><div class="v">${draws}</div></div>
    <div class="stat"><div class="k">Losses</div><div class="v">${losses}</div></div>

    <div class="stat ${goodWR ? 'good' : ''}"><div class="k">W/R</div><div class="v">${toPercent(wr)}</div></div>
    <div class="stat ${lowMR ? 'good' : 'bad'}"><div class="k">Miss Rate</div><div class="v">${toPercent(mr)}</div></div>
    <div class="stat"><div class="k">Total Attacks</div><div class="v">${atks}</div></div>

    <div class="stat"><div class="k">DeadTower Total</div><div class="v">${dead}</div></div>
    <div class="stat"><div class="k">Joined</div><div class="v">${escHTML(joined)}</div></div>
  `;
}

async function load() {
  try {
    $err.classList.add('hidden');
    $err.textContent = '';

    const url = endpoint(SHEET_ID, RANGE_A1) + `&t=${Date.now()}`; // anti-cache
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();

    const { rows } = parseRows(json.values);
    if (!rows.length) throw new Error('No data found.');

    buildPlayerOptions(rows);
    window._guildRows = rows;
    $last.textContent = `Loaded at ${new Date().toLocaleString()}`;

    // Optional preselect via ?p=Name
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

$se
