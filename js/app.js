(function () {
  'use strict';
  const D = window.DATA;
  const runs = D.runs.slice().sort((a, b) => a.date.localeCompare(b.date));
  const $ = (s, r) => (r || document).querySelector(s);
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

  // ---------- formatters ----------
  const p2 = n => String(n).padStart(2, '0');
  const fmtPace = s => { if (!isFinite(s) || s <= 0) return '–'; s = Math.round(s); return Math.floor(s / 60) + ':' + p2(s % 60); };
  const fmtDur = s => {
    s = Math.round(s);
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h ? h + ':' + p2(m) + ':' + p2(x) : m + ':' + p2(x);
  };
  const fmtDate = d => { const [y, m, j] = d.split('-'); return j + '/' + m; };
  const fmtDateL = d => new Date(d + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  const nf = (n, d = 1) => n.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d });
  const pace = r => r.sec / r.km;

  // ---------- classification ----------
  const isQuality = r => r.laps.some(l => l[0] >= 900 && l[2] >= 165);
  runs.forEach(r => { r.q = isQuality(r); r.eff = (r.km * 1000 / (r.sec / 60)) / r.hr; });
  const efRuns = runs.filter(r => !r.q && r.km >= 5);

  // ---------- zones (estimated from lap avg HR) ----------
  const ZB = [131, 151, 166, 179];
  const ZN = ['Z1 récup', 'Z2 endurance', 'Z3 tempo', 'Z4 seuil', 'Z5 VO2'];
  const zoneOf = h => ZB.filter(b => h >= b).length;

  // ---------- weeks ----------
  const monday = d => {
    const t = new Date(d + 'T12:00:00'); const w = (t.getDay() + 6) % 7; t.setDate(t.getDate() - w);
    return t.getFullYear() + '-' + p2(t.getMonth() + 1) + '-' + p2(t.getDate());
  };
  const weeks = {};
  runs.forEach(r => {
    const k = monday(r.date);
    const w = weeks[k] = weeks[k] || { km: 0, eff: 0, n: 0, z: [0, 0, 0, 0, 0] };
    w.km += r.km; w.eff += r.effort || 0; w.n++;
    r.laps.forEach(l => { if (l[2]) w.z[zoneOf(l[2])] += l[1] / 60; });
  });
  const wKeys = Object.keys(weeks).sort();

  // ---------- header / KPIs ----------
  $('#since').textContent = fmtDateL(D.since);
  $('#asof').textContent = $('#asof2').textContent = fmtDateL(runs[runs.length - 1].date);
  const totKm = runs.reduce((a, r) => a + r.km, 0);
  const totSec = runs.reduce((a, r) => a + r.sec, 0);
  const nWeeks = (new Date(runs[runs.length - 1].date) - new Date(wKeys[0])) / 6048e5;
  const mean = a => a.reduce((x, y) => x + y, 0) / a.length;
  const f3 = mean(efRuns.slice(0, 3).map(r => r.eff)), l3 = mean(efRuns.slice(-3).map(r => r.eff));
  const dEff = (l3 / f3 - 1) * 100;
  const last4 = wKeys.slice(-5, -1).map(k => weeks[k].km);
  const kpis = [
    ['Séances de course', runs.length, nf(totKm, 0) + ' km au total'],
    ['Volume total', nf(totKm, 1) + ' km', fmtDur(totSec) + ' en mouvement'],
    ['Moyenne hebdo', nf(totKm / nWeeks, 1) + ' km', 'dernières 4 sem. complètes : ' + nf(mean(last4), 1) + ' km'],
    ['5 km test (18/10)', '24:06', 'soit ' + fmtPace(1446 / 5) + ' /km · FC moy 182'],
    ['Efficacité endurance', nf(l3, 3), '<span class="d ' + (dEff >= 0 ? 'up' : 'down') + '">' + (dEff >= 0 ? '▲ +' : '▼ ') + nf(dEff, 1) + ' % vs. 3 premières</span>'],
    ['FC max observée', Math.max(...runs.map(r => r.hmax)) + ' bpm', 'atteinte le ' + fmtDate(runs.find(r => r.hmax === Math.max(...runs.map(x => x.hmax))).date)]
  ];
  $('#kpis').innerHTML = kpis.map(k => '<div class="kpi"><div class="l">' + k[0] + '</div><div class="v">' + k[1] + '</div><div class="d">' + k[2] + '</div></div>').join('');

  // ---------- charts ----------
  const charts = [];
  function mk(id, cfg) { const c = new Chart($('#' + id), cfg); charts.push(c); return c; }
  function base(extra) {
    const grid = css('--grid'), mut = css('--muted');
    return Object.assign({
      responsive: true, maintainAspectRatio: false, animation: { duration: 350 },
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: mut, boxWidth: 12, usePointStyle: true } }, tooltip: { padding: 10 } },
      scales: {}
    }, extra || {});
  }
  function ax(title, o) {
    return Object.assign({ grid: { color: css('--grid') }, ticks: { color: css('--muted') }, border: { display: false }, title: title ? { display: true, text: title, color: css('--muted') } : undefined }, o || {});
  }
  function build() {
    charts.splice(0).forEach(c => c.destroy());
    const A = css('--accent'), O = css('--accent2'), G = css('--good'), M = css('--muted');
    Chart.defaults.color = M; Chart.defaults.font.family = 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif';
    const labels = runs.map(r => fmtDate(r.date));

    // weekly
    mk('cWeekly', {
      type: 'bar',
      data: {
        labels: wKeys.map(k => 'S. ' + fmtDate(k)),
        datasets: [
          { label: 'Km', data: wKeys.map(k => +weeks[k].km.toFixed(1)), backgroundColor: A, borderRadius: 4, yAxisID: 'y', order: 2 },
          { type: 'line', label: 'Effort relatif', data: wKeys.map(k => weeks[k].eff), borderColor: O, backgroundColor: O, tension: .3, pointRadius: 3, yAxisID: 'y1', order: 1 }
        ]
      },
      options: base({ scales: { x: ax(null, { grid: { display: false } }), y: ax('km', { beginAtZero: true }), y1: ax('effort', { position: 'right', grid: { drawOnChartArea: false }, beginAtZero: true }) } })
    });

    // cumulative
    let cum = 0;
    mk('cCum', {
      type: 'line',
      data: { labels, datasets: [{ label: 'Km cumulés', data: runs.map(r => +(cum += r.km).toFixed(1)), borderColor: G, backgroundColor: G + '33', fill: true, tension: .2, pointRadius: 2 }] },
      options: base({ plugins: { legend: { display: false } }, scales: { x: ax(null, { ticks: { color: M, maxTicksLimit: 10 }, grid: { display: false } }), y: ax('km', { beginAtZero: true }) } })
    });

    // efficiency
    mk('cEF', {
      type: 'line',
      data: { labels: efRuns.map(r => fmtDate(r.date)), datasets: [{ label: 'Indice d\'efficacité', data: efRuns.map(r => +r.eff.toFixed(3)), borderColor: A, backgroundColor: A, tension: .25, pointRadius: 4 },
        { label: 'Tendance', data: trend(efRuns.map(r => r.eff)), borderColor: O, borderDash: [6, 4], pointRadius: 0, borderWidth: 2 }] },
      options: base({ scales: { x: ax(null, { grid: { display: false } }), y: ax(null, { ticks: { color: M, callback: v => v.toFixed(2) } }) } })
    });

    // EF pace & HR
    mk('cEFpace', {
      type: 'line',
      data: { labels: efRuns.map(r => fmtDate(r.date)), datasets: [
        { label: 'Allure (min/km)', data: efRuns.map(r => Math.round(pace(r))), borderColor: A, backgroundColor: A, tension: .25, pointRadius: 3, yAxisID: 'y' },
        { label: 'FC moyenne (bpm)', data: efRuns.map(r => r.hr), borderColor: O, backgroundColor: O, tension: .25, pointRadius: 3, yAxisID: 'y1' }] },
      options: base({
        plugins: { tooltip: { callbacks: { label: c => c.dataset.yAxisID === 'y' ? ' Allure ' + fmtPace(c.parsed.y) + ' /km' : ' FC ' + c.parsed.y + ' bpm' } }, legend: { labels: { color: M, boxWidth: 12, usePointStyle: true } } },
        scales: { x: ax(null, { grid: { display: false } }), y: ax(null, { reverse: true, ticks: { color: M, callback: v => fmtPace(v) } }), y1: ax(null, { position: 'right', grid: { drawOnChartArea: false }, suggestedMin: 135, suggestedMax: 165 }) }
      })
    });

    // zones
    const zc = ['#94a3b8', '#38bdf8', '#4ade80', '#fb923c', '#ef4444'];
    mk('cZones', {
      type: 'bar',
      data: { labels: wKeys.map(k => 'S. ' + fmtDate(k)), datasets: ZN.map((n, i) => ({ label: n, data: wKeys.map(k => +weeks[k].z[i].toFixed(1)), backgroundColor: zc[i], stack: 's' })) },
      options: base({ scales: { x: ax(null, { stacked: true, grid: { display: false } }), y: ax('minutes', { stacked: true }) } })
    });
    const zt = [0, 0, 0, 0, 0]; wKeys.forEach(k => weeks[k].z.forEach((v, i) => zt[i] += v));
    const ztot = zt.reduce((a, b) => a + b, 0);
    $('#zoneNote').textContent = 'Répartition totale : ' + ZN.map((n, i) => n + ' ' + Math.round(zt[i] / ztot * 100) + ' %').join(' · ') + '. Zones : Z1 < 131, Z2 131–150, Z3 151–165, Z4 166–178, Z5 ≥ 179 bpm.';

    // scatter
    const grp = { 'Août–sept.': [], 'Octobre': [], 'Novembre': [] };
    const gcol = { 'Août–sept.': '#94a3b8', 'Octobre': A, 'Novembre': O };
    runs.forEach(r => r.laps.forEach(l => {
      if (l[0] < 900 || !l[2]) return;
      const m = +r.date.slice(5, 7); const g = m >= 11 ? 'Novembre' : m === 10 ? 'Octobre' : 'Août–sept.';
      grp[g].push({ x: l[2], y: l[1] / l[0] * 1000, d: r.date });
    }));
    mk('cScatter', {
      type: 'scatter',
      data: { datasets: Object.keys(grp).map(g => ({ label: g, data: grp[g], backgroundColor: gcol[g] + 'bb', pointRadius: 3.5 })) },
      options: base({
        interaction: { mode: 'nearest', intersect: true },
        plugins: { tooltip: { callbacks: { label: c => ' ' + fmtDate(c.raw.d) + ' · ' + c.raw.x + ' bpm · ' + fmtPace(c.raw.y) + ' /km' } } },
        scales: { x: ax('FC moyenne du km (bpm)', { min: 125 }), y: ax(null, { reverse: true, ticks: { color: M, callback: v => fmtPace(v) } }) }
      })
    });

    // best efforts
    mk('cBest', {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Meilleur 1 km', data: runs.map(r => r.k1), borderColor: O, backgroundColor: O, tension: .2, pointRadius: 3 },
        { label: 'Meilleur 5 km (allure)', data: runs.map(r => r.k5 && r.km >= 5 ? Math.round(r.k5 / 5) : null), borderColor: A, backgroundColor: A, tension: .2, pointRadius: 3, spanGaps: true }] },
      options: base({
        plugins: { tooltip: { callbacks: { label: c => ' ' + c.dataset.label + ' : ' + fmtPace(c.parsed.y) + ' /km' } }, legend: { labels: { color: M, boxWidth: 12, usePointStyle: true } } },
        scales: { x: ax(null, { ticks: { color: M, maxTicksLimit: 10 }, grid: { display: false } }), y: ax(null, { reverse: true, ticks: { color: M, callback: v => fmtPace(v) } }) }
      })
    });

    // HR
    mk('cHR', {
      type: 'line',
      data: { labels, datasets: [
        { label: 'FC max', data: runs.map(r => r.hmax), borderColor: O, backgroundColor: O, tension: .2, pointRadius: 3 },
        { label: 'FC moyenne', data: runs.map(r => r.hr), borderColor: A, backgroundColor: A, tension: .2, pointRadius: 3 }] },
      options: base({ scales: { x: ax(null, { ticks: { color: M, maxTicksLimit: 10 }, grid: { display: false } }), y: ax('bpm', { suggestedMin: 130 }) } })
    });
    drawLaps();
  }

  function trend(y) {
    const n = y.length, xs = y.map((_, i) => i), mx = mean(xs), my = mean(y);
    let num = 0, den = 0; xs.forEach((x, i) => { num += (x - mx) * (y[i] - my); den += (x - mx) ** 2; });
    const b = num / den, a = my - b * mx; return xs.map(x => +(a + b * x).toFixed(4));
  }

  // ---------- test 5k card ----------
  (function () {
    const r = runs.find(x => x.date === '2026-10-18');
    if (!r) return;
    const t = r.laps.filter(l => l[0] >= 900 && l[2] >= 172).slice(0, 5);
    $('#test5k').innerHTML = '<h3>5 km test du 18/10 — 24:06</h3><div class="splits">' + t.map((l, i) =>
      '<div class="split"><b>' + fmtPace(l[1]) + '</b><span>km ' + (i + 1) + ' · ' + Math.round(l[2]) + ' bpm</span></div>').join('') +
      '<div class="split"><b>' + fmtPace(1446 / 5) + '</b><span>moyenne · FC max ' + r.hmax + '</span></div></div>' +
      '<p class="note">Allure très régulière (4:46 à 4:52 au km) ; la FC monte de 176 à 185 bpm sur la durée, ce qui est normal à cette intensité.</p>';
  })();

  // ---------- sessions table ----------
  let sortK = 'date', sortD = -1, sel = runs[runs.length - 1].id;
  const val = (r, k) => k === 'pace' ? pace(r) : k === 'eff' ? r.eff : r[k];
  function table() {
    const ft = $('#fType').value, fd = +$('#fDist').value;
    let rows = runs.filter(r => (ft === 'all' || (ft === 'q') === r.q) && r.km >= fd);
    rows.sort((a, b) => { const x = val(a, sortK), y = val(b, sortK); return (x > y ? 1 : x < y ? -1 : 0) * sortD; });
    $('#fCount').textContent = rows.length + ' séance' + (rows.length > 1 ? 's' : '');
    $('#tbl tbody').innerHTML = rows.map(r => '<tr data-id="' + r.id + '" class="' + (r.id === sel ? 'sel' : '') + '"><td>' + fmtDate(r.date) + '</td><td>' + esc(r.name) + '<span class="tag' + (r.q ? ' q' : '') + '">' + (r.q ? 'qualité' : 'EF') + '</span></td><td class="r">' + nf(r.km, 2) + '</td><td class="r">' + fmtDur(r.sec) + '</td><td class="r">' + fmtPace(pace(r)) + '</td><td class="r">' + nf(r.hr, 0) + '</td><td class="r">' + r.hmax + '</td><td class="r">' + Math.round(r.elev) + '</td><td class="r">' + nf(r.eff, 3) + '</td></tr>').join('');
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
  document.querySelectorAll('#tbl th').forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.k; if (sortK === k) sortD *= -1; else { sortK = k; sortD = k === 'name' ? 1 : -1; } table();
  }));
  ['fType', 'fDist'].forEach(i => $('#' + i).addEventListener('change', table));
  $('#tbl tbody').addEventListener('click', e => { const tr = e.target.closest('tr'); if (!tr) return; sel = tr.dataset.id; table(); drawLaps(); $('#detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' }); });

  // ---------- detail ----------
  let lapChart;
  function drawLaps() {
    const r = runs.find(x => x.id === sel); if (!r) return;
    const M = css('--muted'), A = css('--accent'), O = css('--accent2');
    $('#dTitle').textContent = r.name + ' — ' + fmtDateL(r.date);
    $('#dMeta').textContent = nf(r.km, 2) + ' km · ' + fmtDur(r.sec) + ' · ' + fmtPace(pace(r)) + ' /km · FC ' + nf(r.hr, 0) + '/' + r.hmax + ' bpm · D+ ' + Math.round(r.elev) + ' m' + (r.temp != null ? ' · ' + Math.round(r.temp) + ' °C' : '');
    const L = r.laps.filter(l => l[1] > 0);
    const lab = L.map((l, i) => l[0] >= 900 ? 'km ' + (i + 1) : (i + 1) + ' (' + Math.round(l[0]) + ' m)');
    if (lapChart) { lapChart.destroy(); }
    lapChart = new Chart($('#cLaps'), {
      type: 'bar',
      data: { labels: lab, datasets: [
        { type: 'line', label: 'Allure', data: L.map(l => Math.round(l[1] / l[0] * 1000)), borderColor: A, backgroundColor: A, yAxisID: 'y', tension: .2, pointRadius: 4, order: 1 },
        { label: 'FC moyenne', data: L.map(l => l[2]), backgroundColor: O + '99', yAxisID: 'y1', borderRadius: 4, order: 3 },
        { type: 'line', label: 'FC max', data: L.map(l => l[3]), borderColor: O, borderDash: [4, 4], pointRadius: 2, yAxisID: 'y1', order: 2 }] },
      options: base({
        plugins: { tooltip: { callbacks: { label: c => c.dataset.label === 'Allure' ? ' Allure ' + fmtPace(c.parsed.y) + ' /km' : ' ' + c.dataset.label + ' ' + c.parsed.y + ' bpm' } }, legend: { labels: { color: M, boxWidth: 12, usePointStyle: true } } },
        scales: { x: ax(null, { grid: { display: false } }), y: ax(null, { reverse: true, ticks: { color: M, callback: v => fmtPace(v) } }), y1: ax(null, { position: 'right', grid: { drawOnChartArea: false }, suggestedMin: 110, suggestedMax: 195 }) }
      })
    });
    $('#lapTbl').innerHTML = '<thead><tr><th>#</th><th class="r">Dist.</th><th class="r">Temps</th><th class="r">Allure</th><th class="r">FC moy</th><th class="r">FC max</th><th class="r">D+</th></tr></thead><tbody>' +
      L.map((l, i) => '<tr><td>' + (i + 1) + '</td><td class="r">' + nf(l[0] / 1000, 2) + '</td><td class="r">' + fmtDur(l[1]) + '</td><td class="r">' + fmtPace(l[1] / l[0] * 1000) + '</td><td class="r">' + (l[2] != null ? nf(l[2], 0) : '–') + '</td><td class="r">' + (l[3] || '–') + '</td><td class="r">' + nf(l[4], 0) + '</td></tr>').join('') + '</tbody>';
  }

  // ---------- objectives ----------
  (function () {
    const t0 = 1446, d0 = 5;
    const rg = (d) => t0 * Math.pow(d / d0, 1.06);
    const rows = [[6, 1800], [7, 2100], [8, 2400], [9, 2700], [10, 3000]];
    $('#riegel').innerHTML = '<thead><tr><th>Distance</th><th class="r">Estimation</th><th class="r">Allure</th><th class="r">Objectif test</th><th class="r">Marge</th></tr></thead><tbody>' +
      rows.map(([d, g]) => { const e = rg(d), ec = g - e; return '<tr><td>' + d + ' km</td><td class="r">' + fmtDur(e) + '</td><td class="r">' + fmtPace(e / d) + '</td><td class="r">' + fmtDur(g) + '</td><td class="r" style="color:var(' + (ec >= 0 ? '--good' : '--bad') + ')">' + (ec >= 0 ? '+' : '−') + fmtDur(Math.abs(ec)) + '</td></tr>'; }).join('') +
      '<tr><td>Semi (21,1 km)</td><td class="r">' + fmtDur(rg(21.0975)) + '</td><td class="r">' + fmtPace(rg(21.0975) / 21.0975) + '</td><td class="r">–</td><td class="r">–</td></tr></tbody>';
    const plan = [['Sam. 07/11', '6 km', '30:00', '5:00'], ['Sam. 21/11', '7 km', '35:00', '5:00'], ['Sam. 05/12', '8 km', '40:00', '5:00'], ['Sam. 19/12', '9 km', '45:00', '5:00'], ['Sam. 02/01', '10 km', '50:00', '5:00']];
    $('#plan').innerHTML = '<thead><tr><th>Date indicative</th><th>Test</th><th class="r">Temps visé</th><th class="r">Allure</th></tr></thead><tbody>' +
      plan.map(p => '<tr><td>' + p[0] + '</td><td>' + p[1] + '</td><td class="r">' + p[2] + '</td><td class="r">' + p[3] + '</td></tr>').join('') + '</tbody>';
  })();

  // ---------- next sessions ----------
  const NEXT = [
    ['2026-11-05', 'Endurance facile', '6–7 km, allure libre autour de 7:00/km', 'FC 146–150', ''],
    ['2026-11-06', 'Repos', 'Veille de test : marche ou rien', '–', 'rest'],
    ['2026-11-07', 'TEST 6 km en 30:00', '2 km échauffement + 6 km à 5:00/km + 1 km retour au calme', 'FC attendue ≈ 178–182', 'q'],
    ['2026-11-10', 'Endurance', '7 km tranquilles', 'FC 146–150', ''],
    ['2026-11-12', 'Seuil', '2 km échauffement + 3 × 8 min à ~5:20–5:25/km (récup 2 min trot) + 1 km retour au calme', 'FC 172–178', 'q'],
    ['2026-11-14', 'Sortie longue', '10 km en endurance, finir sans forcer', 'FC 146–152', ''],
    ['2026-11-17', 'Endurance', '8 km', 'FC 146–150', ''],
    ['2026-11-19', 'Endurance facile', '6 km très tranquilles (veille de repos)', 'FC ≤ 148', ''],
    ['2026-11-21', 'TEST 7 km en 35:00', '2 km échauffement + 7 km à 5:00/km + 1 km retour au calme', 'FC attendue ≈ 178–183', 'q']
  ];
  $('#next').innerHTML = '<thead><tr><th>Date</th><th>Séance</th><th>Contenu</th><th>Intensité</th></tr></thead><tbody>' +
    NEXT.map(n => '<tr><td>' + fmtDateL(n[0]) + '</td><td><b>' + n[1] + '</b></td><td style="white-space:normal;min-width:260px">' + n[2] + '</td><td>' + n[3] + '</td></tr>').join('') + '</tbody>';

  // ---------- other activities ----------
  $('#other').innerHTML = '<thead><tr><th>Date</th><th>Type</th><th>Activité</th><th class="r">Km</th><th class="r">Durée</th><th class="r">D+</th><th class="r">Effort</th></tr></thead><tbody>' +
    D.other.slice().reverse().map(o => '<tr><td>' + fmtDate(o.date) + '</td><td>' + ({ Ride: 'Vélo', Hike: 'Rando' }[o.type] || o.type) + '</td><td>' + esc(o.name) + '</td><td class="r">' + nf(o.km, 1) + '</td><td class="r">' + fmtDur(o.sec) + '</td><td class="r">' + Math.round(o.elev) + '</td><td class="r">' + (o.effort || '–') + '</td></tr>').join('') + '</tbody>';

  // ---------- theme ----------
  $('#theme').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme || (matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark'; document.documentElement.dataset.theme = nx;
    try { localStorage.setItem('theme', nx); } catch (e) { }
    build();
  });
  try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; } catch (e) { }

  table(); build();
})();
