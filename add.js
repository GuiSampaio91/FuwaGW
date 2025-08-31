const VER = document.querySelector('meta[name="build"]')?.content || Date.now().toString();
const cfg = await import(`./config.js?v=${VER}`);
const { APPS_SCRIPT } = cfg;

const $ = (id) => document.getElementById(id);
const qp = new URLSearchParams(location.search);

async function fetchHeroes() {
  const url = `${APPS_SCRIPT.BASE_URL}?route=heroes`;
  const res = await fetch(url);
  const raw = await res.text();
  let js;
  try { js = JSON.parse(raw); }
  catch (e) {
  console.error('POST raw (non-JSON):', raw);
  throw new Error(`Non-JSON response (HTTP ${res.status})`);
}

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

function heroInput(id, required = false) {
  return `<input list="heroes" id="${id}" class="input"${required ? ' required' : ''}/>`;
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
      const fs = document.createElement('fieldset');
      fs.className = 'round-block';
      fs.innerHTML = `
        <legend>Attack ${attack} — Round ${round}</legend>

        <div class="trio myteam">
          <div>
            <label>My Hero 1</label>
            ${heroInput(`${blockId}_my1`, attack === 1 && round === 1)}
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

        <div class="trio enemy" style="margin-top:8px;">
          <div>
            <label>Enemy Hero 1</label>
            ${heroInput(`${blockId}_e1`, attack === 1 && round === 1)}
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

        <div class="row" style="margin-top:8px;">${winChk(`${blockId}_win`)}</div>
      `;
      host.appendChild(fs);
    }
  }
}

/** exige ao menos 1 MyHero e 1 EnemyHero preenchidos (em qualquer round) */
function hasMinHeroes() {
  const my = Array.from(document.querySelectorAll('input[id$="_my1"],input[id$="_my2"],input[id$="_my3"]'))
    .some(el => el.value.trim().length > 0);

  const enemy = Array.from(document.querySelectorAll('input[id$="_e1"],input[id$="_e2"],input[id$="_e3"]'))
    .some(el => el.value.trim().length > 0);

  return my && enemy;
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
    rounds
  };
}

async function submitForm(ev) {
  ev.preventDefault();
  try {
    if (!hasMinHeroes()) {
      status('Fill at least 1 My Hero and 1 Enemy Hero in any round.', false);
      return;
    }

    status('Submitting...');
    const body = JSON.stringify(payloadFromForm());

    const res = await fetch(APPS_SCRIPT.BASE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body
    });
    const js = await res.json();
    if (!js.ok) return status(js.error || 'Error', false);

    status('OK! Saved #' + js.submissionId);
    $('passcode').value = '';
  } catch {
    status('Network or server error', false);
  }
}

async function main() {
  // preenche o nome vindo do botão do index: add.html?p=<PlayerName>
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
