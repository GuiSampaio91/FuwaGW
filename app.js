import { SHEET_ID, API_KEY, RANGE_A1 } from "./config.js";
}
const wins = toNum(row["Wins"]);
const draws = toNum(row["Draws"]);
const losses = toNum(row["Losses"]);
const wr = row["W/R"];
const atks = toNum(row["Total Atks"]);
const mr = row["Miss Rate"];
const joined = row["Joined"] || "–";
const dead = toNum(row["DeadTower Total"]) || 0;


const goodWR = Number(wr) >= 0.85; // tweak if you want
const lowMR = Number(mr) <= 0.12;


$stats.innerHTML = `
<div class=\"stat\"><div class=\"k\">Wins</div><div class=\"v\">${wins}</div></div>
<div class=\"stat\"><div class=\"k\">Draws</div><div class=\"v\">${draws}</div></div>
<div class=\"stat\"><div class=\"k\">Losses</div><div class=\"v\">${losses}</div></div>


<div class=\"stat ${goodWR ? 'good' : ''}\"><div class=\"k\">W/R</div><div class=\"v\">${toPercent(wr)}</div></div>
<div class=\"stat ${lowMR ? 'good' : 'bad'}\"><div class=\"k\">Miss Rate</div><div class=\"v\">${toPercent(mr)}</div></div>
<div class=\"stat\"><div class=\"k\">Total Attacks</div><div class=\"v\">${atks}</div></div>


<div class=\"stat\"><div class=\"k\">DeadTower Total</div><div class=\"v\">${dead}</div></div>
<div class=\"stat\"><div class=\"k\">Joined</div><div class=\"v\">${joined}</div></div>
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


const { headers, rows } = parseRows(json.values);
if (!rows.length) throw new Error('No data found.');


buildPlayerOptions(rows);


// keep data in memory
window._guildRows = rows;
$last.textContent = `Loaded at ${new Date().toLocaleString()}`;


// URL preselect ?p=Name
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
