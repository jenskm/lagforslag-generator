// =============================================================
// Lagforslag-generator
// All data lagres i localStorage. Algoritmen er randomisert
// grådig tilordning + skåring; vi prøver mange ganger og
// returnerer de beste, distinkte forslagene.
// =============================================================

const LAGRINGSNOEKKEL = 'fotball_data_v1';

let data = lastData();

function lastData() {
  const raa = localStorage.getItem(LAGRINGSNOEKKEL);
  if (!raa) return startData();
  try {
    const d = JSON.parse(raa);
    return migrer(Object.assign(startData(), d));
  } catch {
    return startData();
  }
}

function startData() {
  return {
    spillere: [],     // {id, nr, navn, gruppeId, ferdighet}
    grupper: [],      // {id, navn}
    trenere: [],      // {id, navn, barnNr: [number]}
    sisteOppsett: null,
    sisteForslag: null  // { inputSnapshot, forslag: [{lag, skaar, brudd}] }
  };
}

function migrer(d) {
  // Eldre format: spiller.gruppe (fritekst). Konverter til grupper-liste + gruppeId.
  if (!Array.isArray(d.grupper)) d.grupper = [];
  const trengerMigrasjon = d.spillere.some(s => 'gruppe' in s && !('gruppeId' in s));
  if (trengerMigrasjon) {
    const navnTilId = new Map();
    for (const g of d.grupper) navnTilId.set(g.navn, g.id);
    for (const s of d.spillere) {
      const navn = (s.gruppe || '').trim();
      if (!navn) {
        s.gruppeId = null;
      } else if (navnTilId.has(navn)) {
        s.gruppeId = navnTilId.get(navn);
      } else {
        const id = nyId();
        d.grupper.push({ id, navn });
        navnTilId.set(navn, id);
        s.gruppeId = id;
      }
      delete s.gruppe;
    }
  }
  return d;
}

let lagringFeilet = false;
function lagre() {
  try {
    localStorage.setItem(LAGRINGSNOEKKEL, JSON.stringify(data));
  } catch (e) {
    if (!lagringFeilet) {
      lagringFeilet = true;
      alert(
        'Klarte ikke lagre data i nettleseren: ' + e.message +
        '\nEndringer i denne økten beholdes, men forsvinner ved refresh.' +
        '\nFor sikkerhetskopi, bruk Eksporter alle data (JSON) i Data-fanen.'
      );
    }
  }
}

function nyId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  );
}

// =============================================================
// Faner
// =============================================================
function settOppFaner() {
  document.querySelectorAll('#faner button').forEach(btn => {
    btn.addEventListener('click', () => {
      const navn = btn.dataset.fane;
      document.querySelectorAll('#faner button').forEach(b =>
        b.classList.toggle('aktiv', b === btn));
      document.querySelectorAll('section.fane').forEach(s =>
        s.classList.toggle('aktiv', s.id === navn));
      if (navn === 'generer') byggGenererUI();
    });
  });
}

// =============================================================
// Spillere
// =============================================================
function gruppeAlternativer(valgtId) {
  const opt = ['<option value="">(ingen)</option>'];
  for (const g of data.grupper) {
    const sel = g.id === valgtId ? 'selected' : '';
    opt.push(`<option value="${g.id}" ${sel}>${escapeHtml(g.navn)}</option>`);
  }
  return opt.join('');
}

function gruppeNavnFor(id) {
  if (!id) return '';
  const g = data.grupper.find(x => x.id === id);
  return g ? g.navn : '';
}

function tegnSpillere() {
  data.spillere.sort((a, b) => a.nr - b.nr);
  const tbody = document.querySelector('#spillereTabell tbody');
  tbody.innerHTML = '';
  for (const s of data.spillere) {
    const tr = document.createElement('tr');
    tr.dataset.id = s.id;
    tr.innerHTML = `
      <td><input type="number" data-felt="nr" value="${s.nr}" min="1"></td>
      <td><input type="text" data-felt="navn" value="${escapeHtml(s.navn)}" placeholder="Navn"></td>
      <td>
        <select data-felt="gruppeId">
          ${gruppeAlternativer(s.gruppeId)}
        </select>
      </td>
      <td>
        <select data-felt="ferdighet">
          ${[1,2,3,4,5].map(n => `<option value="${n}" ${s.ferdighet == n ? 'selected' : ''}>${n}</option>`).join('')}
        </select>
      </td>
      <td><button class="slett" title="Slett">×</button></td>
    `;
    tbody.appendChild(tr);
  }
  document.getElementById('spillereTomTekst').style.display =
    data.spillere.length ? 'none' : 'block';

  tbody.querySelectorAll('input, select').forEach(el => {
    el.addEventListener('change', e => {
      const tr = e.target.closest('tr');
      const sp = data.spillere.find(s => s.id === tr.dataset.id);
      if (!sp) return;
      const felt = e.target.dataset.felt;
      let v = e.target.value;
      if (felt === 'nr') {
        const nyttNr = parseInt(v, 10);
        if (!Number.isFinite(nyttNr) || nyttNr < 1) {
          alert('Spiller-nr må være et positivt heltall.');
          e.target.value = sp.nr;
          return;
        }
        if (nyttNr !== sp.nr && data.spillere.some(s => s.id !== sp.id && s.nr === nyttNr)) {
          alert(`Spiller-nr ${nyttNr} er allerede i bruk.`);
          e.target.value = sp.nr;
          return;
        }
        v = nyttNr;
      } else if (felt === 'ferdighet') {
        v = parseInt(v, 10);
      } else if (felt === 'gruppeId' && v === '') {
        v = null;
      }
      sp[felt] = v;
      lagre();
    });
  });
  tbody.querySelectorAll('.slett').forEach(b => {
    b.addEventListener('click', e => {
      const tr = e.target.closest('tr');
      const id = tr.dataset.id;
      if (!confirm('Slett denne spilleren?')) return;
      const slettet = data.spillere.find(s => s.id === id);
      const slettetNr = slettet ? slettet.nr : null;
      data.spillere = data.spillere.filter(s => s.id !== id);
      // Fjern fra trener-koblinger
      for (const t of data.trenere) {
        t.barnNr = (t.barnNr || []).filter(n => {
          const fortsattFinnes = data.spillere.some(s => s.nr === n);
          return fortsattFinnes;
        });
      }
      // Rydd evt. referanse i sisteOppsett.
      if (slettetNr !== null && data.sisteOppsett?.spillere) {
        delete data.sisteOppsett.spillere[slettetNr];
      }
      lagre();
      tegnSpillere();
      tegnTrenere();
    });
  });
}

function leggTilSpiller() {
  const nesteNr = data.spillere.reduce((m, s) => Math.max(m, s.nr), 0) + 1;
  data.spillere.push({
    id: nyId(),
    nr: nesteNr,
    navn: '',
    gruppeId: null,
    ferdighet: 3
  });
  lagre();
  tegnSpillere();
}

// =============================================================
// CSV import / eksport
// =============================================================
function eksporterSpillereCsv() {
  const rader = ['nr,navn,gruppe,ferdighet'];
  const sortert = [...data.spillere].sort((a, b) => a.nr - b.nr);
  for (const s of sortert) {
    rader.push([s.nr, csvEsc(s.navn), csvEsc(gruppeNavnFor(s.gruppeId)), s.ferdighet].join(','));
  }
  lastNed('spillere.csv', '﻿' + rader.join('\r\n'), 'text/csv;charset=utf-8');
}

function finnEllerLagGruppe(navn) {
  navn = (navn || '').trim();
  if (!navn) return null;
  const eks = data.grupper.find(g => g.navn.toLowerCase() === navn.toLowerCase());
  if (eks) return eks.id;
  const id = nyId();
  data.grupper.push({ id, navn });
  return id;
}

function csvEsc(v) {
  v = String(v ?? '');
  if (/[",\n\r]/.test(v)) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

function parseCsv(tekst) {
  // Fjern UTF-8 BOM hvis filen starter med det.
  if (tekst.charCodeAt(0) === 0xFEFF) tekst = tekst.slice(1);
  const linjer = tekst.replace(/\r\n/g, '\n').split('\n').filter(l => l.length);
  if (linjer.length === 0) return [];
  const header = parseCsvLinje(linjer[0]).map(h => h.trim().toLowerCase());
  const rader = [];
  for (let i = 1; i < linjer.length; i++) {
    const celler = parseCsvLinje(linjer[i]);
    const obj = {};
    header.forEach((h, j) => obj[h] = (celler[j] ?? '').trim());
    rader.push(obj);
  }
  return rader;
}

function parseCsvLinje(linje) {
  const ut = [];
  let cur = '';
  let i = 0;
  let iSitat = false;
  while (i < linje.length) {
    const c = linje[i];
    if (iSitat) {
      if (c === '"' && linje[i + 1] === '"') { cur += '"'; i += 2; continue; }
      if (c === '"') { iSitat = false; i++; continue; }
      cur += c; i++;
    } else {
      if (c === ',') { ut.push(cur); cur = ''; i++; continue; }
      if (c === '"' && cur === '') { iSitat = true; i++; continue; }
      cur += c; i++;
    }
  }
  ut.push(cur);
  return ut;
}

function importerSpillereCsv(tekst) {
  const rader = parseCsv(tekst);
  if (rader.length === 0) {
    alert('Tom CSV.');
    return;
  }
  const obligatoriske = ['nr', 'navn', 'gruppe', 'ferdighet'];
  const finnesAlle = obligatoriske.every(f => f in rader[0]);
  if (!finnesAlle) {
    alert('CSV-en må ha kolonnene: ' + obligatoriske.join(', '));
    return;
  }
  let lagtTil = 0, oppdatert = 0, hoppetOver = 0;
  const duplikatNr = new Set();
  const settINNCsv = new Set();
  for (const r of rader) {
    const nr = parseInt(r.nr, 10);
    const ferdighet = parseInt(r.ferdighet, 10);
    if (!Number.isFinite(nr) || nr < 1 || !r.navn) {
      hoppetOver++;
      continue;
    }
    if (settINNCsv.has(nr)) {
      duplikatNr.add(nr);
      hoppetOver++;
      continue;
    }
    settINNCsv.add(nr);
    const ferdighetGyldig = Number.isFinite(ferdighet) && ferdighet >= 1 && ferdighet <= 5
      ? ferdighet : 3;
    const gruppeId = finnEllerLagGruppe(r.gruppe);
    const eksisterende = data.spillere.find(s => s.nr === nr);
    if (eksisterende) {
      eksisterende.navn = r.navn;
      eksisterende.gruppeId = gruppeId;
      eksisterende.ferdighet = ferdighetGyldig;
      oppdatert++;
    } else {
      data.spillere.push({
        id: nyId(),
        nr,
        navn: r.navn,
        gruppeId,
        ferdighet: ferdighetGyldig
      });
      lagtTil++;
    }
  }
  lagre();
  tegnSpillere();
  tegnGrupper();
  const deler = [
    `${lagtTil} ny${lagtTil === 1 ? '' : 'e'}`,
    `${oppdatert} oppdatert`
  ];
  if (hoppetOver > 0) deler.push(`${hoppetOver} hoppet over`);
  let melding = 'Importert: ' + deler.join(', ') + '.';
  if (duplikatNr.size > 0) {
    melding += `\nDuplikat-nr i CSV (kun første beholdt): ${[...duplikatNr].join(', ')}.`;
  }
  alert(melding);
}

function lastNed(filnavn, innhold, mime) {
  const blob = new Blob([innhold], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filnavn;
  a.click();
  URL.revokeObjectURL(url);
}

// =============================================================
// Grupper
// =============================================================
function tegnGrupper() {
  const tbody = document.querySelector('#grupperTabell tbody');
  tbody.innerHTML = '';
  const tellPerGruppe = new Map();
  for (const s of data.spillere) {
    if (!s.gruppeId) continue;
    tellPerGruppe.set(s.gruppeId, (tellPerGruppe.get(s.gruppeId) || 0) + 1);
  }
  const sortert = [...data.grupper].sort((a, b) => a.navn.localeCompare(b.navn, 'no'));
  for (const g of sortert) {
    const tr = document.createElement('tr');
    tr.dataset.id = g.id;
    tr.innerHTML = `
      <td><input type="text" data-felt="navn" value="${escapeHtml(g.navn)}" placeholder="Navn"></td>
      <td>${tellPerGruppe.get(g.id) || 0}</td>
      <td><button class="slett" title="Slett">×</button></td>
    `;
    tbody.appendChild(tr);
  }
  document.getElementById('grupperTomTekst').style.display =
    data.grupper.length ? 'none' : 'block';

  tbody.querySelectorAll('input').forEach(el => {
    el.addEventListener('change', e => {
      const tr = e.target.closest('tr');
      const g = data.grupper.find(x => x.id === tr.dataset.id);
      if (!g) return;
      g.navn = e.target.value;
      lagre();
      tegnSpillere(); // dropdown må oppdateres
    });
  });
  tbody.querySelectorAll('.slett').forEach(b => {
    b.addEventListener('click', e => {
      const tr = e.target.closest('tr');
      const id = tr.dataset.id;
      const tilknyttet = data.spillere.filter(s => s.gruppeId === id).length;
      const advarsel = tilknyttet > 0
        ? `Slett denne gruppen? ${tilknyttet} spiller(e) mister gruppetilhørighet.`
        : 'Slett denne gruppen?';
      if (!confirm(advarsel)) return;
      data.grupper = data.grupper.filter(g => g.id !== id);
      for (const s of data.spillere) {
        if (s.gruppeId === id) s.gruppeId = null;
      }
      lagre();
      tegnGrupper();
      tegnSpillere();
    });
  });
}

function leggTilGruppe() {
  data.grupper.push({ id: nyId(), navn: '' });
  lagre();
  tegnGrupper();
  tegnSpillere();
}

// =============================================================
// Trenere
// =============================================================
function tegnTrenere() {
  const tbody = document.querySelector('#trenereTabell tbody');
  tbody.innerHTML = '';
  for (const t of data.trenere) {
    const tr = document.createElement('tr');
    tr.dataset.id = t.id;
    tr.innerHTML = `
      <td><input type="text" data-felt="navn" value="${escapeHtml(t.navn)}" placeholder="Navn"></td>
      <td><input type="text" data-felt="barnNr" value="${(t.barnNr || []).join(', ')}" placeholder="f.eks. 5, 12"></td>
      <td><button class="slett">×</button></td>
    `;
    tbody.appendChild(tr);
  }
  document.getElementById('trenereTomTekst').style.display =
    data.trenere.length ? 'none' : 'block';

  tbody.querySelectorAll('input').forEach(el => {
    el.addEventListener('change', e => {
      const tr = e.target.closest('tr');
      const t = data.trenere.find(x => x.id === tr.dataset.id);
      if (!t) return;
      const felt = e.target.dataset.felt;
      if (felt === 'barnNr') {
        t.barnNr = e.target.value.split(/[,\s]+/)
          .map(s => parseInt(s, 10))
          .filter(n => !isNaN(n));
      } else {
        t[felt] = e.target.value;
      }
      lagre();
    });
  });
  tbody.querySelectorAll('.slett').forEach(b => {
    b.addEventListener('click', e => {
      const tr = e.target.closest('tr');
      if (!confirm('Slett denne treneren?')) return;
      data.trenere = data.trenere.filter(t => t.id !== tr.dataset.id);
      lagre();
      tegnTrenere();
    });
  });
}

function leggTilTrener() {
  data.trenere.push({ id: nyId(), navn: '', barnNr: [] });
  lagre();
  tegnTrenere();
}

// =============================================================
// Generer-UI
// =============================================================
function byggGenererUI() {
  const o = data.sisteOppsett;
  if (o?.antallLag) document.getElementById('antallLag').value = o.antallLag;
  if (o?.minSpillere) document.getElementById('minSpillere').value = o.minSpillere;
  if (o?.maksSpillere) document.getElementById('maksSpillere').value = o.maksSpillere;
  if (o?.varighet) document.getElementById('varighet').value = o.varighet;
  byggLagTider();
  byggDeltakerListe();
  byggTrenerListe();
  validerAlleTidsfelt();
  gjenopprettForslag();
}

function autoLagreOppsett() {
  data.sisteOppsett = lesGenererInput();
  lagre();
}

function settUgyldighet(el, ugyldige, format) {
  if (ugyldige.length > 0) {
    el.classList.add('ugyldig');
    el.title = `Ugyldig format på: ${ugyldige.join(', ')}\nForventet: ${format}`;
    return false;
  }
  el.classList.remove('ugyldig');
  el.title = '';
  return true;
}

function validerStarttider(el) {
  const tekst = el.value || '';
  const ugyldige = tekst.split(/[,;]/).map(s => s.trim()).filter(Boolean)
    .filter(t => parseHHMM(t) === null);
  return settUgyldighet(el, ugyldige, 'HH:MM (f.eks. 10:00)');
}

function validerIntervaller(el) {
  const tekst = el.value || '';
  const ugyldige = tekst.split(',').map(s => s.trim()).filter(Boolean)
    .filter(t => parseInterval(t) === null);
  return settUgyldighet(el, ugyldige, 'HH:MM - HH:MM (f.eks. 10:00 - 15:30)');
}

function validerInput(el) {
  if (el.closest('#lagTider')) return validerStarttider(el);
  if (el.dataset.felt === 'tider') return validerIntervaller(el);
  return true;
}

function validerAlleTidsfelt() {
  document.querySelectorAll('#lagTider input[type="text"]').forEach(validerStarttider);
  document.querySelectorAll('#deltakereTabell [data-felt="tider"]').forEach(validerIntervaller);
}

function dataSignatur() {
  return JSON.stringify({
    s: data.spillere.map(s => `${s.nr}|${s.navn}|${s.gruppeId}|${s.ferdighet}`),
    g: data.grupper.map(g => `${g.id}|${g.navn}`),
    t: data.trenere.map(t => `${t.id}|${t.navn}|${(t.barnNr || []).join(',')}`)
  });
}

function gjenopprettForslag() {
  const out = document.getElementById('resultater');
  const tom = document.getElementById('tomForslag');
  if (!data.sisteForslag) {
    out.innerHTML = '';
    tom.hidden = true;
    return;
  }
  const ktx = bygKontekst(data.sisteForslag.inputSnapshot);
  const erUtdatert = data.sisteForslag.dataSig
    && data.sisteForslag.dataSig !== dataSignatur();
  tegnResultater({
    forslag: data.sisteForslag.forslag.map(f => ({ ...f, ktx })),
    utdatert: erUtdatert
  });
  tom.hidden = false;
}

function byggLagTider() {
  const antall = parseInt(document.getElementById('antallLag').value, 10) || 1;
  const div = document.getElementById('lagTider');
  div.innerHTML = '';
  for (let i = 0; i < antall; i++) {
    const lagrede = data.sisteOppsett?.lagTider?.[i] || '';
    const rad = document.createElement('div');
    rad.className = 'lagRad';
    rad.innerHTML = `
      <label>Lag ${i + 1}</label>
      <input type="text" data-lag="${i}" value="${escapeHtml(lagrede)}" placeholder="HH:MM, kommaseparert. F.eks. 10:00, 11:30">
    `;
    div.appendChild(rad);
  }
}

function byggDeltakerListe() {
  const tbody = document.querySelector('#deltakereTabell tbody');
  tbody.innerHTML = '';
  const sorterte = [...data.spillere].sort((a, b) => a.nr - b.nr);
  const lagretSpillere = data.sisteOppsett?.spillere || {};

  for (const s of sorterte) {
    const lagret = lagretSpillere[s.nr];
    const deltar = lagret?.deltar !== false;
    const tider = lagret?.tider || '';
    const tr = document.createElement('tr');
    tr.dataset.nr = s.nr;
    tr.innerHTML = `
      <td><input type="checkbox" data-felt="deltar" ${deltar ? 'checked' : ''}></td>
      <td>${s.nr}</td>
      <td>${escapeHtml(s.navn)}</td>
      <td>${escapeHtml(gruppeNavnFor(s.gruppeId))}</td>
      <td>${s.ferdighet}</td>
      <td><input type="text" data-felt="tider" value="${escapeHtml(tider)}" placeholder="alle (eller HH:MM - HH:MM)"></td>
    `;
    tbody.appendChild(tr);
  }
  oppdaterAntallValgte();

  tbody.querySelectorAll('input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', oppdaterAntallValgte);
  });
}

function oppdaterAntallValgte() {
  const n = document.querySelectorAll('#deltakereTabell tbody input[type="checkbox"]:checked').length;
  document.getElementById('antallValgte').textContent = n;
}

function byggTrenerListe() {
  const tbody = document.querySelector('#trenereDeltagereTabell tbody');
  tbody.innerHTML = '';
  const lagrede = data.sisteOppsett?.trenere || {};
  for (const t of data.trenere) {
    const lagret = lagrede[t.id];
    const deltar = lagret?.deltar !== false;
    const navnBarn = (t.barnNr || [])
      .map(nr => {
        const sp = data.spillere.find(s => s.nr === nr);
        return sp ? `#${nr} ${sp.navn}` : `#${nr}`;
      })
      .join(', ');
    const tr = document.createElement('tr');
    tr.dataset.id = t.id;
    tr.innerHTML = `
      <td><input type="checkbox" data-felt="deltar" ${deltar ? 'checked' : ''}></td>
      <td>${escapeHtml(t.navn)}</td>
      <td>${escapeHtml(navnBarn)}</td>
    `;
    tbody.appendChild(tr);
  }
}

function lesGenererInput() {
  const antallLag = parseInt(document.getElementById('antallLag').value, 10) || 1;
  let minSpillere = parseInt(document.getElementById('minSpillere').value, 10);
  let maksSpillere = parseInt(document.getElementById('maksSpillere').value, 10);
  if (!Number.isFinite(minSpillere) || minSpillere < 3) minSpillere = 3;
  if (!Number.isFinite(maksSpillere) || maksSpillere < 3) maksSpillere = Math.max(3, minSpillere);
  const varighet = parseInt(document.getElementById('varighet').value, 10) || 40;

  const lagTider = [];
  for (let i = 0; i < antallLag; i++) {
    const inp = document.querySelector(`#lagTider input[data-lag="${i}"]`);
    const tider = (inp?.value || '').split(/[,;]/).map(s => s.trim()).filter(Boolean);
    lagTider.push(tider);
  }

  const spillere = {};
  document.querySelectorAll('#deltakereTabell tbody tr').forEach(tr => {
    const nr = parseInt(tr.dataset.nr, 10);
    const deltar = tr.querySelector('[data-felt="deltar"]').checked;
    const tider = tr.querySelector('[data-felt="tider"]').value
      .split(/[,;]/).map(s => s.trim()).filter(Boolean);
    spillere[nr] = { deltar, tider: tider.join(', ') };
  });

  const trenere = {};
  document.querySelectorAll('#trenereDeltagereTabell tbody tr').forEach(tr => {
    const id = tr.dataset.id;
    const deltar = tr.querySelector('[data-felt="deltar"]').checked;
    trenere[id] = { deltar };
  });

  return { antallLag, minSpillere, maksSpillere, varighet, lagTider, spillere, trenere };
}

// =============================================================
// Generator (algoritme)
// =============================================================
const ANTALL_FORSOEK = 60;
const ANTALL_FORSLAG = 5;

function parseHHMM(s) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*$/.exec(s);
  if (!m) return null;
  const h = parseInt(m[1], 10);
  const mn = parseInt(m[2], 10);
  if (h > 23 || mn > 59) return null;
  return h * 60 + mn;
}

function parseInterval(s) {
  const m = /^\s*(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*$/.exec(s);
  if (!m) return null;
  const h1 = parseInt(m[1], 10), mn1 = parseInt(m[2], 10);
  const h2 = parseInt(m[3], 10), mn2 = parseInt(m[4], 10);
  if (h1 > 23 || mn1 > 59 || h2 > 23 || mn2 > 59) return null;
  const start = h1 * 60 + mn1;
  const slutt = h2 * 60 + mn2;
  if (slutt <= start) return null;
  return [start, slutt];
}

function parseIntervaller(tekst) {
  const deler = (tekst || '').split(',').map(s => s.trim()).filter(Boolean);
  const ut = [];
  for (const d of deler) {
    const r = parseInterval(d);
    if (!r) return null;
    ut.push(r);
  }
  return ut;
}

function tiderKonflikter(t1, t2, varighet) {
  const a = parseHHMM(t1);
  const b = parseHHMM(t2);
  if (a === null || b === null) return t1 === t2;
  return Math.abs(a - b) < varighet;
}

function gameWithinIntervaller(start, slutt, intervaller) {
  if (start === null) return false;
  return intervaller.some(([a, b]) => a <= start && b >= slutt);
}

function rng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, r) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function bygKontekst(input) {
  const spillerVedNr = new Map();
  for (const s of data.spillere) spillerVedNr.set(s.nr, s);

  const varighet = input.varighet;
  const aktive = [];
  // nr -> intervaller [[start, slutt]] | null (=alle tider)
  const spillerIntervaller = new Map();
  for (const [nrStr, v] of Object.entries(input.spillere)) {
    const nr = parseInt(nrStr, 10);
    if (!v.deltar) continue;
    if (!spillerVedNr.has(nr)) continue;
    aktive.push(nr);
    const tekst = (v.tider || '').trim();
    const intervaller = tekst ? (parseIntervaller(tekst) || []) : null;
    spillerIntervaller.set(nr, intervaller);
  }

  // id -> { aktiv: bool }
  const trenerTilg = new Map();
  for (const [id, v] of Object.entries(input.trenere)) {
    trenerTilg.set(id, { aktiv: !!v.deltar });
  }

  function tilgjengeligeTrenereForBarn(nr) {
    const ut = [];
    for (const t of data.trenere) {
      if (!(t.barnNr || []).includes(nr)) continue;
      const tilg = trenerTilg.get(t.id);
      if (!tilg || !tilg.aktiv) continue;
      ut.push({ trener: t });
    }
    return ut;
  }

  function spillerKanLagIdx(nr, lagIdx) {
    const intervaller = spillerIntervaller.get(nr);
    if (intervaller === null) return true; // alle tider OK
    const lagT = input.lagTider[lagIdx];
    if (!lagT.length) return true;
    // Spilleren må kunne delta på ALLE GYLDIGE kamper for laget.
    // Ugyldige kamptider hoppes over (de rapporteres som brudd separat).
    const gyldige = lagT.map(parseHHMM).filter(t => t !== null);
    if (gyldige.length === 0) return true;
    return gyldige.every(start => gameWithinIntervaller(start, start + varighet, intervaller));
  }

  function spillerKanPaaTid(nr, tid) {
    const intervaller = spillerIntervaller.get(nr);
    if (intervaller === null) return true;
    const start = parseHHMM(tid);
    if (start === null) return false;
    return gameWithinIntervaller(start, start + varighet, intervaller);
  }

  function spillerHarTilgjengeligTrener(nr) {
    // Trener er "tilstede" så lenge barnet er på laget (tidsmessig følger
    // foreldren barnet) og treneren er markert som deltakende.
    return tilgjengeligeTrenereForBarn(nr).length > 0;
  }

  // Gjennomsnittlig ferdighet i hele deltakerpoolen. Algoritmen prøver å
  // bringe hvert lags ferdighetssnitt så nært dette tallet som mulig.
  let totalFerdighet = 0;
  for (const nr of aktive) totalFerdighet += spillerVedNr.get(nr).ferdighet;
  const snittFerdighet = aktive.length > 0 ? totalFerdighet / aktive.length : 0;

  return {
    input,
    aktive,
    spillerVedNr,
    spillerIntervaller,
    trenerTilg,
    tilgjengeligeTrenereForBarn,
    spillerKanLagIdx,
    spillerKanPaaTid,
    spillerHarTilgjengeligTrener,
    snittFerdighet
  };
}

function graadigTilordne(ktx, seed) {
  const r = rng(seed);
  const lag = Array.from({ length: ktx.input.antallLag }, () => []);
  const uplassert = [];

  // Sortér: mest begrenset først (færrest lag de kan spille for),
  // deretter spillere med tilgjengelig trenerforelder (vil spres ut)
  const aktive = shuffle(ktx.aktive, r);
  aktive.sort((a, b) => {
    let kanA = 0, kanB = 0;
    for (let i = 0; i < ktx.input.antallLag; i++) {
      if (ktx.spillerKanLagIdx(a, i)) kanA++;
      if (ktx.spillerKanLagIdx(b, i)) kanB++;
    }
    const trenerA = ktx.spillerHarTilgjengeligTrener(a);
    const trenerB = ktx.spillerHarTilgjengeligTrener(b);
    if (kanA !== kanB) return kanA - kanB;
    if (trenerA !== trenerB) return trenerA ? -1 : 1;
    return 0;
  });

  const maks = ktx.input.maksSpillere;
  for (const nr of aktive) {
    const kandidater = [];
    for (let i = 0; i < ktx.input.antallLag; i++) {
      if (lag[i].length >= maks) continue;
      if (!ktx.spillerKanLagIdx(nr, i)) continue;
      kandidater.push(i);
    }
    let plassering;
    if (kandidater.length === 0) {
      // Ingen plass som passer både tid og størrelse — prøv tid uten størrelse
      const t = [];
      for (let i = 0; i < ktx.input.antallLag; i++) {
        if (ktx.spillerKanLagIdx(nr, i)) t.push(i);
      }
      if (t.length === 0) {
        uplassert.push(nr); // ingen lag matcher spillerens tilgjengelighet
        continue;
      }
      t.sort((a, b) => lag[a].length - lag[b].length);
      plassering = t[0];
    } else {
      const skaar = kandidater.map(i => ({
        i,
        s: deltaSkaar(lag[i], nr, i, ktx) + r() * 0.4
      }));
      skaar.sort((a, b) => a.s - b.s);
      plassering = skaar[0].i;
    }
    lag[plassering].push(nr);
  }

  return { lag, uplassert };
}

// Skår-bidrag av å legge nr inn i et lag
function deltaSkaar(lagListe, nyNr, lagIdx, ktx) {
  const ny = ktx.spillerVedNr.get(nyNr);
  let s = 0;

  // Ferdighetsbalanse: dytt lagets ferdighetssnitt mot pool-snittet.
  // Bruker kvadratisk avvik så store avvik straffes mye mer enn små.
  let lagSum = 0;
  for (const n of lagListe) lagSum += ktx.spillerVedNr.get(n).ferdighet;
  const snitt = ktx.snittFerdighet;
  const c = lagListe.length;
  const foerAvvik = c > 0 ? Math.pow(lagSum / c - snitt, 2) : 0;
  const etterAvvik = Math.pow((lagSum + ny.ferdighet) / (c + 1) - snitt, 2);
  s += (etterAvvik - foerAvvik) * 6.0;

  // Group: belønning for samme gruppe finnes (kun hvis spilleren faktisk har en gruppe)
  if (ny.gruppeId) {
    const sammeGruppe = lagListe.some(n => ktx.spillerVedNr.get(n).gruppeId === ny.gruppeId);
    if (sammeGruppe) s -= 1.0;
  }

  // Trener-forelder spredning
  const harTrener = lagListe.some(n => ktx.spillerHarTilgjengeligTrener(n));
  if (!harTrener && ktx.spillerHarTilgjengeligTrener(nyNr)) {
    s -= 3.0; // sterk preferanse: gi laget en trener-forelder
  }

  // Foretrekk laveste lagstørrelse
  s += lagListe.length * 0.25;

  return s;
}

function skaarLoesning(lag, ktx) {
  let s = 0;
  const min = ktx.input.minSpillere;
  const maks = ktx.input.maksSpillere;
  for (let i = 0; i < lag.length; i++) {
    const team = lag[i];
    if (team.length < min) s += 1000 * (min - team.length);
    if (team.length > maks) s += 1000 * (team.length - maks);

    // Ferdighetsbalanse: kvadratisk avvik mellom lagets snitt og pool-snittet.
    if (team.length > 0) {
      let lagSum = 0;
      for (const n of team) lagSum += ktx.spillerVedNr.get(n).ferdighet;
      const lagSnitt = lagSum / team.length;
      s += Math.pow(lagSnitt - ktx.snittFerdighet, 2) * 15;
    }

    // Group overlap (kun spillere som har en gruppe regnes)
    let utenGruppe = 0;
    for (const n of team) {
      const g = ktx.spillerVedNr.get(n).gruppeId;
      if (!g) continue;
      const harSamme = team.some(o => o !== n && ktx.spillerVedNr.get(o).gruppeId === g);
      if (!harSamme) utenGruppe++;
    }
    s += utenGruppe * 8;

    // Trener
    const harTrener = team.some(n => ktx.spillerHarTilgjengeligTrener(n));
    if (!harTrener) s += 25;
  }

  // Ulikhet i lagstørrelse
  const stoerrelser = lag.map(l => l.length);
  const minSt = Math.min(...stoerrelser);
  const maxSt = Math.max(...stoerrelser);
  s += (maxSt - minSt) * 1.5;

  return s;
}

function identifiserBrudd(lag, ktx, uplassert = []) {
  const brudd = [];
  const min = ktx.input.minSpillere;
  const maks = ktx.input.maksSpillere;
  if (uplassert.length > 0) {
    brudd.push(`⚠ ${uplassert.length} spiller(e) kunne ikke plasseres på noe lag — tilgjengelige tider matcher ingen kamptider: ${uplassert.map(n => '#' + n).join(', ')}.`);
  }
  for (let i = 0; i < lag.length; i++) {
    const team = lag[i];
    const navn = `Lag ${i + 1}`;

    // Ugyldige kamptider rapporteres så brukeren ser at de er hoppet over.
    const ugyldigeTider = (ktx.input.lagTider[i] || []).filter(t => parseHHMM(t) === null);
    if (ugyldigeTider.length > 0) {
      brudd.push(`${navn}: ugyldig(e) kamptid(er) ble ignorert: ${ugyldigeTider.join(', ')}.`);
    }

    if (team.length < min)
      brudd.push(`${navn}: bare ${team.length} spillere (minimum ${min}).`);
    if (team.length > maks)
      brudd.push(`${navn}: ${team.length} spillere (over maksimum ${maks}).`);

    // Ferdighetssnitt: avvik fra pool-snittet
    if (team.length > 0) {
      let lagSum = 0;
      for (const n of team) lagSum += ktx.spillerVedNr.get(n).ferdighet;
      const lagSnitt = lagSum / team.length;
      if (Math.abs(lagSnitt - ktx.snittFerdighet) > 0.5) {
        brudd.push(`${navn}: ferdighetssnitt ${lagSnitt.toFixed(2)} avviker fra pool-snittet ${ktx.snittFerdighet.toFixed(2)}.`);
      }
    }

    // Group
    const utenGruppe = team.filter(n => {
      const g = ktx.spillerVedNr.get(n).gruppeId;
      if (!g) return false;
      return !team.some(o => o !== n && ktx.spillerVedNr.get(o).gruppeId === g);
    });
    if (utenGruppe.length > 0) {
      brudd.push(`${navn}: spiller(e) uten lagkamerat fra samme gruppe — ${utenGruppe.map(n => '#' + n).join(', ')}.`);
    }

    // Trener — bare relevant hvis det finnes deltakende trenere i det hele tatt
    const finnesDeltakendeTrenere = [...ktx.trenerTilg.values()].some(t => t.aktiv);
    if (finnesDeltakendeTrenere) {
      const trenerNavn = trenerForLag(team, ktx);
      if (trenerNavn.length === 0)
        brudd.push(`${navn}: ingen spiller med tilgjengelig forelder-trener.`);
    }
  }
  return brudd;
}

function trenerForLag(team, ktx) {
  const ut = new Set();
  for (const nr of team) {
    if (ktx.spillerHarTilgjengeligTrener(nr)) {
      const trenere = ktx.tilgjengeligeTrenereForBarn(nr);
      for (const { trener } of trenere) ut.add(trener.navn || '(uten navn)');
    }
  }
  return [...ut];
}

function lagSignatur(lag, uplassert = []) {
  return lag.map(l => [...l].sort((a, b) => a - b).join(',')).join('|')
    + '||U:' + [...uplassert].sort((a, b) => a - b).join(',');
}

function generer(input) {
  const ktx = bygKontekst(input);
  if (ktx.aktive.length === 0) return { feil: 'Ingen valgte spillere.' };
  if (input.antallLag < 1) return { feil: 'Antall lag må være minst 1.' };

  const sett = new Map();
  for (let i = 0; i < ANTALL_FORSOEK; i++) {
    const { lag, uplassert } = graadigTilordne(ktx, i * 7919 + 13);
    const sig = lagSignatur(lag, uplassert);
    if (sett.has(sig)) continue;
    const skaar = skaarLoesning(lag, ktx) + uplassert.length * 500;
    sett.set(sig, { lag, skaar, uplassert });
  }
  const liste = [...sett.values()];
  liste.sort((a, b) => a.skaar - b.skaar);
  const valgt = liste.slice(0, ANTALL_FORSLAG);

  return {
    forslag: valgt.map(v => ({
      lag: v.lag,
      skaar: v.skaar,
      uplassert: v.uplassert,
      brudd: identifiserBrudd(v.lag, ktx, v.uplassert),
      ktx
    }))
  };
}

// =============================================================
// Resultater
// =============================================================
function tegnResultater(res) {
  const out = document.getElementById('resultater');
  out.innerHTML = '';
  if (res.feil) {
    out.innerHTML = `<div class="brudd"><strong>Kunne ikke generere:</strong> ${escapeHtml(res.feil)}</div>`;
    return;
  }
  if (!res.forslag.length) {
    out.innerHTML = `<p class="info">Ingen forslag funnet.</p>`;
    return;
  }

  if (res.utdatert) {
    const banner = document.createElement('div');
    banner.className = 'brudd';
    banner.innerHTML = `<strong>Utdaterte forslag:</strong> spillere, grupper eller trenere er endret etter at disse forslagene ble generert. Generer på nytt for å reflektere endringene.`;
    out.appendChild(banner);
  }

  res.forslag.forEach((f, idx) => {
    const div = document.createElement('div');
    div.className = 'forslag';
    div.innerHTML = `
      <h3>
        Forslag ${idx + 1}
        <span class="skaar">skår: ${f.skaar.toFixed(1)} (lavere = bedre)</span>
        <button class="eksporterForslag" data-forslag-idx="${idx}">Eksporter til CSV</button>
      </h3>
      <div class="lagrutenett">
        ${f.lag.map((team, i) => tegnLag(team, i, f.ktx, f.lag)).join('')}
      </div>
      ${f.brudd.length === 0
        ? `<div class="ingenBrudd">Ingen brudd på krav.</div>`
        : `<div class="brudd"><strong>Brudd / merknader:</strong>
            <ul>${f.brudd.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul>
          </div>`
      }
    `;
    out.appendChild(div);
  });
}

function eksporterForslagCsv(forslag, idx, ktx) {
  const rader = [];
  rader.push(`Forslag ${idx + 1}`);
  rader.push(`Skår,${forslag.skaar.toFixed(1)}`);
  rader.push('');

  forslag.lag.forEach((team, i) => {
    const tider = (ktx.input.lagTider[i] || []).join(', ');
    rader.push(`Lag ${i + 1}`);
    if (tider) rader.push(`Kamptider,${csvEsc(tider)}`);
    rader.push('Spillernr,Navn,Gruppe,Ferdighet,Forelder-trener');
    const sortert = [...team].sort((a, b) => a - b);
    for (const nr of sortert) {
      const s = ktx.spillerVedNr.get(nr);
      if (!s) continue;
      const trenerNavn = ktx.tilgjengeligeTrenereForBarn(nr)
        .map(x => x.trener.navn || '')
        .filter(Boolean)
        .join(', ');
      rader.push([
        nr,
        csvEsc(s.navn),
        csvEsc(gruppeNavnFor(s.gruppeId)),
        s.ferdighet,
        csvEsc(trenerNavn)
      ].join(','));
    }

    const laan = laaneKandidaterPerTid(team, i, ktx, forslag.lag);
    if (laan.length > 0) {
      rader.push('Mulige lånespillere');
      rader.push('Kamptid,Spillere');
      for (const { tid, kandidater } of laan) {
        const liste = kandidater.map(n => '#' + n).join(', ');
        rader.push(`${csvEsc(tid)},${csvEsc(liste)}`);
      }
    }
    rader.push(''); // tom rad mellom lag
  });

  if (forslag.uplassert && forslag.uplassert.length > 0) {
    rader.push('Uplasserte spillere');
    rader.push('Spillernr,Navn,Gruppe,Ferdighet');
    for (const nr of forslag.uplassert) {
      const s = ktx.spillerVedNr.get(nr);
      if (!s) continue;
      rader.push([
        nr,
        csvEsc(s.navn),
        csvEsc(gruppeNavnFor(s.gruppeId)),
        s.ferdighet
      ].join(','));
    }
  }

  // UTF-8 BOM for at Excel skal vise norske tegn riktig.
  lastNed(`forslag-${idx + 1}.csv`, '﻿' + rader.join('\r\n'), 'text/csv;charset=utf-8');
}

function tegnLag(team, i, ktx, alleLag) {
  const lagT = ktx.input.lagTider[i];
  const trenere = trenerForLag(team, ktx);
  let lagSum = 0;
  for (const nr of team) lagSum += ktx.spillerVedNr.get(nr).ferdighet;
  const snitt = team.length > 0 ? (lagSum / team.length).toFixed(2) : '–';
  const sortert = [...team].sort((a, b) => a - b);

  // Mulige lånespillere fra andre lag (informativt)
  const laanInfo = laaneForslag(team, i, ktx, alleLag);

  return `
    <div class="lagBoks">
      <h4>Lag ${i + 1} <span class="meta">${team.length} sp · snitt ${snitt}</span></h4>
      <div class="tider">${lagT.length ? 'Tider: ' + escapeHtml(lagT.join(', ')) : '(ingen kamptider satt)'}</div>
      <ul>
        ${sortert.map(nr => {
          const s = ktx.spillerVedNr.get(nr);
          if (!s) return `<li><span>#${nr} <em>(slettet)</em></span></li>`;
          const erBarn = ktx.tilgjengeligeTrenereForBarn(nr).length > 0;
          return `<li>
            <span>#${nr} ${escapeHtml(s.navn)}${erBarn ? ' ★' : ''}</span>
            <span class="spillerMeta">${escapeHtml(gruppeNavnFor(s.gruppeId))} · F${s.ferdighet}</span>
          </li>`;
        }).join('')}
      </ul>
      ${trenere.length
        ? `<div class="trener">Trener tilstede: ${escapeHtml(trenere.join(', '))}</div>`
        : ([...ktx.trenerTilg.values()].some(t => t.aktiv)
            ? `<div class="trener ingenTrener">Ingen tilgjengelig forelder-trener på dette laget</div>`
            : '')}
      ${laanInfo}
    </div>
  `;
}

function laaneKandidaterPerTid(team, lagIdx, ktx, alleLag) {
  // For hver kamptid på dette laget, identifiser spillere fra andre lag
  // hvis lag IKKE har kamp på samme tid, og som selv er tilgjengelige.
  const lagT = ktx.input.lagTider[lagIdx];
  if (!lagT.length) return [];
  const varighet = ktx.input.varighet;
  const ut = [];
  for (const tid of lagT) {
    const kandidater = [];
    for (let i = 0; i < ktx.input.antallLag; i++) {
      if (i === lagIdx) continue;
      const harKonflikt = ktx.input.lagTider[i]
        .some(t => tiderKonflikter(t, tid, varighet));
      if (harKonflikt) continue;
      for (const nr of alleLag[i]) {
        if (ktx.spillerKanPaaTid(nr, tid)) kandidater.push(nr);
      }
    }
    if (kandidater.length > 0) ut.push({ tid, kandidater });
  }
  return ut;
}

function laaneForslag(team, lagIdx, ktx, alleLag) {
  const linjer = laaneKandidaterPerTid(team, lagIdx, ktx, alleLag).map(({ tid, kandidater }) => {
    const navn = kandidater.slice(0, 6).map(nr => '#' + nr).join(', ');
    const merOver = kandidater.length > 6 ? ` (+${kandidater.length - 6})` : '';
    return `<div><strong>${escapeHtml(tid)}:</strong> kan låne ${navn}${merOver}</div>`;
  });
  if (!linjer.length) return '';
  return `<div class="laaneBoks">${linjer.join('')}</div>`;
}

// =============================================================
// Eksport / import / nullstill
// =============================================================
function eksporterAlt() {
  lastNed('fotball-data.json', JSON.stringify(data, null, 2), 'application/json');
}

function importerAlt(tekst) {
  try {
    const ny = JSON.parse(tekst);
    if (!ny || typeof ny !== 'object') {
      throw new Error('Filen er ikke et JSON-objekt.');
    }
    const krav = ['spillere', 'trenere'];
    for (const f of krav) {
      if (!Array.isArray(ny[f])) throw new Error(`Feltet "${f}" mangler eller er ikke en liste.`);
    }
    // grupper er valgfritt (migrer() lager det hvis det mangler), men hvis det finnes
    // må det være en liste.
    if ('grupper' in ny && !Array.isArray(ny.grupper)) {
      throw new Error('Feltet "grupper" må være en liste hvis det finnes.');
    }
    if (!confirm('Dette overskriver eksisterende data. Fortsette?')) return;
    data = migrer(Object.assign(startData(), ny));
    lagre();
    tegnSpillere();
    tegnGrupper();
    tegnTrenere();
    alert('Data importert.');
  } catch (e) {
    alert('Kunne ikke lese JSON: ' + e.message);
  }
}

function nullstillAlt() {
  if (!confirm('Slette ALL data? Dette kan ikke angres.')) return;
  if (!confirm('Helt sikker?')) return;
  data = startData();
  lagre();
  tegnSpillere();
  tegnGrupper();
  tegnTrenere();
}

// =============================================================
// Init
// =============================================================
function init() {
  settOppFaner();
  tegnSpillere();
  tegnGrupper();
  tegnTrenere();

  document.getElementById('leggTilSpiller').addEventListener('click', leggTilSpiller);
  document.getElementById('leggTilGruppe').addEventListener('click', leggTilGruppe);
  document.getElementById('leggTilTrener').addEventListener('click', leggTilTrener);

  document.getElementById('importerSpillereCsv').addEventListener('click', () => {
    document.getElementById('csvFil').click();
  });
  document.getElementById('csvFil').addEventListener('change', e => {
    const fil = e.target.files[0];
    if (!fil) return;
    const r = new FileReader();
    r.onload = () => importerSpillereCsv(r.result);
    r.readAsText(fil);
    e.target.value = '';
  });
  document.getElementById('eksporterSpillereCsv').addEventListener('click', eksporterSpillereCsv);

  document.getElementById('antallLag').addEventListener('change', byggLagTider);

  // Auto-lagring av Generer-fanen: én listener på hele seksjonen
  document.getElementById('generer').addEventListener('change', e => {
    if (e.target.matches('button')) return;
    autoLagreOppsett();
  });
  // Validering av tidsfelt på hver tastetrykk
  document.getElementById('generer').addEventListener('input', e => {
    if (e.target.matches('input[type="text"]')) validerInput(e.target);
  });

  document.getElementById('velgAlleSpillere').addEventListener('click', () => {
    document.querySelectorAll('#deltakereTabell tbody input[type="checkbox"]')
      .forEach(cb => cb.checked = true);
    oppdaterAntallValgte();
  });
  document.getElementById('velgIngenSpillere').addEventListener('click', () => {
    document.querySelectorAll('#deltakereTabell tbody input[type="checkbox"]')
      .forEach(cb => cb.checked = false);
    oppdaterAntallValgte();
  });

  document.getElementById('genererKnapp').addEventListener('click', () => {
    validerAlleTidsfelt();
    const ugyldige = document.querySelectorAll('#generer input.ugyldig');
    if (ugyldige.length > 0) {
      const fortsett = confirm(
        `${ugyldige.length} felt har ugyldig tidsformat (rødmerket).\n\n` +
        `Disse vil bli ignorert i beregningen og kan gi gale resultater. Fortsett likevel?`
      );
      if (!fortsett) return;
    }
    const minRaw = parseInt(document.getElementById('minSpillere').value, 10);
    const maksRaw = parseInt(document.getElementById('maksSpillere').value, 10);
    if (!Number.isFinite(minRaw) || minRaw < 3 || !Number.isFinite(maksRaw) || maksRaw < 3) {
      alert('Min. og maks. spillere per lag må begge være minst 3.');
      return;
    }
    if (maksRaw < minRaw) {
      alert(`Maks. spillere per lag (${maksRaw}) kan ikke være mindre enn min. (${minRaw}).`);
      return;
    }
    const input = lesGenererInput();
    data.sisteOppsett = input;
    const status = document.getElementById('genererStatus');
    status.textContent = 'Genererer …';
    setTimeout(() => {
      const res = generer(input);
      if (res.feil) {
        data.sisteForslag = null;
        lagre();
        tegnResultater(res);
        document.getElementById('tomForslag').hidden = true;
        status.textContent = '';
        return;
      }
      data.sisteForslag = {
        inputSnapshot: input,
        dataSig: dataSignatur(),
        forslag: res.forslag.map(f => ({
          lag: f.lag,
          skaar: f.skaar,
          uplassert: f.uplassert,
          brudd: f.brudd
        }))
      };
      lagre();
      tegnResultater(res);
      document.getElementById('tomForslag').hidden = false;
      status.textContent = `${res.forslag.length} forslag.`;
    }, 30);
  });

  document.getElementById('resultater').addEventListener('click', e => {
    const btn = e.target.closest('[data-forslag-idx]');
    if (!btn || !data.sisteForslag) return;
    const idx = parseInt(btn.dataset.forslagIdx, 10);
    const f = data.sisteForslag.forslag[idx];
    if (!f) return;
    const ktx = bygKontekst(data.sisteForslag.inputSnapshot);
    eksporterForslagCsv(f, idx, ktx);
  });

  document.getElementById('tomForslag').addEventListener('click', () => {
    data.sisteForslag = null;
    lagre();
    document.getElementById('resultater').innerHTML = '';
    document.getElementById('tomForslag').hidden = true;
    document.getElementById('genererStatus').textContent = 'Endringer i oppsettet lagres automatisk.';
  });

  document.getElementById('eksporterAlt').addEventListener('click', eksporterAlt);
  document.getElementById('importerAlt').addEventListener('click', () => {
    document.getElementById('jsonFil').click();
  });
  document.getElementById('jsonFil').addEventListener('change', e => {
    const fil = e.target.files[0];
    if (!fil) return;
    const r = new FileReader();
    r.onload = () => importerAlt(r.result);
    r.readAsText(fil);
    e.target.value = '';
  });
  document.getElementById('nullstillAlt').addEventListener('click', nullstillAlt);
}

init();
