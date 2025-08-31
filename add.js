import { APPS_SCRIPT } from '../config.js';

const $ = (id) => document.getElementById(id);
const qp = new URLSearchParams(location.search);

async function fetchHeroes() {
  const url = `${APPS_SCRIPT.BASE_URL}?route=heroes`;
  const res = await fetch(url);
  const js = await res.json();
  if (!js.ok) throw new Error(js.error || 'Failed to load heroes');
  return js.heroes || [];
}

function fillDatalist(list) {
  const dl = $('heroes');
  dl.innerHTML = '';
  list.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h;
    dl.appendChild(opt);
  });
}

function status(msg, ok = true) {
  const el = $('status');
  el.textContent = msg;
  el.className = ok ? 'ok' : 'err';
}

function heroInput(id) {
  return `<input list="heroes" id="${id}" required/>`;
}
function diedChk(id) {
  return `<label class="chk"><input type="checkbox" id="${id}"/> died</label>`;
}
function winChk(id) {
  return `<label class="chk win"><input type="checkbox" id="${id}"/> Won this round?</label>`;
}

function renderRounds() {
  const host = $('rounds');
  host.innerHTML = '';
  for (let attack = 1; attack <= 3; attack++) {
    for (let round = 1; round <= 2; round++) {
      const blockId = `A${attack}R${round}`;
      const div = document.createElement('fieldset');
      div.className = 'round-block';
      div.innerHTML = `
        <legend>Attack ${attack} — Round ${round}</legend>

        <div class="trio myteam">
          <div>
            <label>My Hero 1</label>
            ${heroInput(`${blockId}_my1`)}
            ${diedChk(`${blockId}_my1Died`)}
          </div>
          <div>
            <label>My Hero 2</label>
            ${heroInput(`${blockId}_my2`)}
            ${diedChk(`${blockId}_my2Died`)}
          </div>
          <div>
            <label>My Hero 3</label>
            ${heroInput(`${blockId}_my3`)}
            ${diedChk(`${blockId}_my3Died`)}
          </div>
        </div>

        <div class="trio enemy">
          <div>
            <label>Enemy Hero 1</label>
            ${heroInput(`${blockId}_e1`)}
          </div>
          <div>
            <label>Enemy Hero 2</label>
            ${heroInput(`${blockId}_e2`)}
          </div>
          <div>
            <label>Enemy Hero 3</label>
            ${heroInput(`${blockId}_e3`)}
          </div>
        </div>

        <div class="row">${winChk(`${blockId}_win`)}</div>
      `;
      host.appendChild(div);
    }
  }
}

function payloadFromForm() {
  const rounds = [];
  for (let attack = 1; attack <= 3; attack++) {
    for (let round = 1; round <= 2; round++) {
      const id = (s) => $(`A${attack}R${round}_${s}`);
      rounds.push({
        attack, round,
        win: id('win').querySelector('input').checked,

        myHero1: id('my1').value.trim(),
        myHero1Died: id('my1Died').querySelector('input').checked,
        myHero2: id('my2').value.trim(),
        myHero2Died: id('my2Died').querySelector('input').checked,
        myHero3: id('my3').value.trim(),
        myHero3Died: id('my3Died').querySelector('input').checked,

        enemyHero1: id('e1').value.trim(),
        enemyHero2: id('e2').value.trim(),
        enemyHero3: id('e3').value.trim(),
      });
    }
  }
  return {
    action: 'addRecord',
    clientToken: APPS_SCRIPT.CLIENT_TOKEN,
    warIdOrDate: $('warId').value.trim(),
    player: $('player').value.trim(),
    passcode: $('passcode').value,
    rounds,
    notes: $('notes').value.trim()
  };
}

async function submitForm(ev) {
  ev.preventDefault();
  try {
    status('Submitting...');
    const body = JSON.stringify(payloadFromForm());

    const res = await fetch(APPS_SCRIPT.BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita preflight
      body
    });
    const js = await res.json();
    if (!js.ok) return status(js.error || 'Error', false);

    status('OK! Saved #' + js.submissionId);
    $('passcode').value = '';
    $('notes').value = '';
  } catch {
    status('Network or server error', false);
  }
}

async function main() {
  $('player').value = qp.get('p') || '';
  renderRounds();

  try {
    const heroes = await fetchHeroes();
    fillDatalist(heroes);
  } catch {
    status('Failed to load heroes', false);
  }

  $('gw-form').addEventListener('submit', submitForm);
}

main();
