// Pasta do Emagrecimento • Premium
// Tudo offline, sem bibliotecas externas.
// Dados ficam no localStorage (com backup/restore).

// ===== PWA offline =====
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js');
}

// ===== Helpers =====
const $ = (id) => document.getElementById(id);

function toast(msg){
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(()=> t.classList.remove('show'), 1400);
}

function todayISO(){
  const d = new Date();
  const off = d.getTimezoneOffset();
  const local = new Date(d.getTime() - off*60*1000);
  return local.toISOString().slice(0,10);
}

function fmtBR(iso){
  const [y,m,d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function clamp(n, a, b){
  return Math.max(a, Math.min(b, n));
}

// ===== Storage keys =====
const LS_ENTRIES = 'emag.entries.v2';
const LS_DOSES   = 'emag.doses.v2';
const LS_GOALS   = 'emag.goals.v2';
const LS_THEME   = 'emag.theme.v1';

// ===== Default goals =====
const DEFAULT_GOALS = {
  stepsGoal: 10000,
  cardioGoal: 60,
  sleepGoal: 7,
  cleanMealsGoal: 3,
  neutralStrength: true,
  penalizeSnacks: false
};

function loadGoals(){
  try{
    return Object.assign({}, DEFAULT_GOALS, JSON.parse(localStorage.getItem(LS_GOALS) || '{}'));
  }catch{
    return {...DEFAULT_GOALS};
  }
}
function saveGoals(g){
  localStorage.setItem(LS_GOALS, JSON.stringify(g));
}

// Entries
function loadEntries(){
  try{ return JSON.parse(localStorage.getItem(LS_ENTRIES) || '{}'); }
  catch{ return {}; }
}
function saveEntries(obj){
  localStorage.setItem(LS_ENTRIES, JSON.stringify(obj));
}

// Doses
function loadDoses(){
  try{ return JSON.parse(localStorage.getItem(LS_DOSES) || '{}'); }
  catch{ return {}; }
}
function saveDoses(obj){
  localStorage.setItem(LS_DOSES, JSON.stringify(obj));
}

// ===== Score engine =====
function computeScore(data, goals){
  const cardioMin = Number(data.cardioMin || 0);
  const steps = Number(data.steps || 0);
  const sleep = Number(data.sleep || 0);
  const cleanMeals = Number(data.cleanMeals || 0);

  // Cardio (25)
  let pCardio = 0;
  if (cardioMin >= goals.cardioGoal) pCardio = 25;
  else if (cardioMin >= goals.cardioGoal * 0.75) pCardio = 20;
  else if (cardioMin >= goals.cardioGoal * 0.5) pCardio = 15;
  else if (cardioMin > 0) pCardio = 10;

  // Steps (15)
  let pSteps = 0;
  if (steps >= goals.stepsGoal) pSteps = 15;
  else if (steps >= goals.stepsGoal * 0.7) pSteps = 10;
  else if (steps > 0) pSteps = 5;

  // Protein (20)
  const pProt = data.protein ? 20 : 0;

  // Water (10)
  const pWater = data.water ? 10 : 0;

  // Strength (20)
  let pStrength = 0;
  if (!data.strengthDay) pStrength = goals.neutralStrength ? 20 : 0;
  else pStrength = data.strengthDone ? 20 : 0;

  // Sleep (10)
  let pSleep = 0;
  if (sleep >= goals.sleepGoal) pSleep = 10;
  else if (sleep >= goals.sleepGoal - 1) pSleep = 5;

  // Meals clean bonus (5)
  let pMeals = 0;
  if (cleanMeals >= goals.cleanMealsGoal) pMeals = 5;
  else if (cleanMeals >= goals.cleanMealsGoal - 1) pMeals = 3;

  // Snack penalty (optional)
  let pPenalty = 0;
  if (goals.penalizeSnacks && data.snacks) pPenalty = -5;

  const total = clamp(pCardio + pSteps + pProt + pWater + pStrength + pSleep + pMeals + pPenalty, 0, 100);

  return { total, pCardio, pSteps, pProt, pWater, pStrength, pSleep, pMeals, pPenalty };
}

function badgeForScore(score){
  if (score >= 90) return { txt:'Elite', emo:'🏅' };
  if (score >= 80) return { txt:'Meta batida', emo:'✅' };
  if (score >= 65) return { txt:'Quase lá', emo:'🟡' };
  if (score >= 45) return { txt:'Ajustar rota', emo:'🛠️' };
  return { txt:'Reorganizar', emo:'🚨' };
}

// ===== Form IO =====
function readDashboardForm(){
  return {
    date: $('d_date').value,
    weight: $('d_weight').value,
    sleep: $('d_sleep').value,
    energy: $('d_energy').value,
    hunger: $('d_hunger').value,
    pain: $('d_pain').value,
    cardioMin: $('d_cardioMin').value,
    steps: $('d_steps').value,
    intensity: $('d_intensity').value,
    protein: $('d_protein').checked,
    water: $('d_water').checked,
    strengthDay: $('d_strengthDay').checked,
    strengthDone: $('d_strengthDone').checked,
    mobilityDone: $('d_mobilityDone').checked,
    snacks: $('d_snacks').checked,
    cleanMeals: $('d_cleanMeals').value,
    mobilityMin: $('d_mobilityMin').value,
    win: $('d_win').value,
    fix: $('d_fix').value,
  };
}

function fillDashboardForm(data){
  $('d_date').value = data.date || todayISO();
  $('d_weight').value = data.weight ?? '';
  $('d_sleep').value = data.sleep ?? '';
  $('d_energy').value = data.energy ?? '';
  $('d_hunger').value = data.hunger ?? '';
  $('d_pain').value = data.pain ?? '';
  $('d_cardioMin').value = data.cardioMin ?? '';
  $('d_steps').value = data.steps ?? '';
  $('d_intensity').value = data.intensity || 'moderada';
  $('d_protein').checked = !!data.protein;
  $('d_water').checked = !!data.water;
  $('d_strengthDay').checked = !!data.strengthDay;
  $('d_strengthDone').checked = !!data.strengthDone;
  $('d_mobilityDone').checked = !!data.mobilityDone;
  $('d_snacks').checked = !!data.snacks;
  $('d_cleanMeals').value = data.cleanMeals ?? 0;
  $('d_mobilityMin').value = data.mobilityMin ?? '';
  $('d_win').value = data.win ?? '';
  $('d_fix').value = data.fix ?? '';
}

function updateScoreUI(){
  const goals = loadGoals();
  const data = readDashboardForm();
  const s = computeScore(data, goals);

  $('scoreValue').textContent = `${s.total}/100`;
  $('scoreBreakdown').textContent =
    `Cardio ${s.pCardio} • Passos ${s.pSteps} • Prot ${s.pProt} • Água ${s.pWater} • Força ${s.pStrength} • Sono ${s.pSleep} • Refeições ${s.pMeals}${s.pPenalty ? ' • Penalidade ' + s.pPenalty : ''}`;

  const b = badgeForScore(s.total);
  $('scoreBadge').textContent = `${b.emo} ${b.txt}`;
}

// ===== History & KPIs =====
function computeStreak(entries){
  const dates = Object.keys(entries).sort((a,b)=> b.localeCompare(a));
  if (dates.length === 0) return 0;
  let streak = 0;
  let prev = dates[0];
  const dayMs = 24*60*60*1000;

  for (let i=0; i<dates.length; i++){
    const d = dates[i];
    const e = entries[d];
    const sc = e.score?.total ?? 0;
    if (sc < 80) break;
    if (i === 0){
      streak++;
      prev = d;
      continue;
    }
    const prevDate = new Date(prev + 'T12:00:00');
    const curDate = new Date(d + 'T12:00:00');
    const diff = Math.round((prevDate - curDate)/dayMs);
    if (diff === 1){
      streak++;
      prev = d;
    } else {
      break;
    }
  }
  return streak;
}

function refreshHistory(){
  const entries = loadEntries();
  const datesDesc = Object.keys(entries).sort((a,b)=> b.localeCompare(a));
  const list = $('historyList');
  list.innerHTML = '';

  if (datesDesc.length === 0){
    list.innerHTML = `<div class="item"><div class="left"><b>Sem registros ainda</b><span>Salve seu primeiro dia ✅</span></div><div class="right">—</div></div>`;
    $('kpi_weight').textContent = '-- kg';
    $('kpi_delta').textContent = '--';
    $('kpi_avgScore').textContent = '--';
    $('kpi_cardioDays').textContent = '--/7';
    $('streakTag').textContent = 'Streak: 0';
    drawChart([]);
    return;
  }

  const newest = entries[datesDesc[0]];
  $('kpi_weight').textContent = `${newest.weight || '--'} kg`;

  const last14Dates = datesDesc.slice(0,14).sort((a,b)=> a.localeCompare(b));
  const series = last14Dates.map(d => ({
    date: d,
    weight: Number(entries[d].weight || 0),
    score: Number(entries[d].score?.total || 0)
  }));
  drawChart(series);

  const w0 = series.length ? series[0].weight : 0;
  const w1 = series.length ? series[series.length-1].weight : 0;
  if (w0 && w1){
    const delta = (w1 - w0);
    const sign = delta > 0 ? '+' : '';
    $('kpi_delta').textContent = `${sign}${delta.toFixed(1)} kg`;
  } else {
    $('kpi_delta').textContent = '--';
  }

  const last7 = datesDesc.slice(0,7).map(d => entries[d]);
  const avgScore = Math.round(last7.reduce((acc,e)=> acc + (e.score?.total || 0), 0) / last7.length);
  const cardioDays = last7.filter(e => Number(e.cardioMin||0) > 0).length;
  $('kpi_avgScore').textContent = `${isNaN(avgScore) ? '--' : avgScore}/100`;
  $('kpi_cardioDays').textContent = `${cardioDays}/${last7.length}`;

  const st = computeStreak(entries);
  $('streakTag').textContent = `Streak: ${st}`;

  const dates10 = datesDesc.slice(0,10);
  for (const d of dates10){
    const e = entries[d];
    const line = document.createElement('div');
    line.className = 'item';
    line.innerHTML = `
      <div class="left">
        <b>${fmtBR(d)} • ${e.score?.total ?? 0}/100</b>
        <span>Peso: ${e.weight || '--'} kg • Cardio: ${e.cardioMin || 0} min • Passos: ${e.steps || 0}</span>
      </div>
      <div class="right">📌 Abrir</div>
    `;
    line.addEventListener('click', () => {
      fillDashboardForm(e);
      updateScoreUI();
      toast('📌 Registro carregado');
    });
    list.appendChild(line);
  }
}

// ===== Charts =====
function drawChart(series){
  const canvas = $('chart');
  const ctx = canvas.getContext('2d');

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.clientWidth || 900;
  const cssH = 240;
  canvas.width = Math.floor(cssW * dpr);
  canvas.height = Math.floor(cssH * dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);

  ctx.clearRect(0,0,cssW,cssH);

  $('chartCaption').textContent = series.length
    ? `De ${fmtBR(series[0].date)} até ${fmtBR(series[series.length-1].date)} • ${series.length} registros`
    : 'Sem dados para gráfico ainda';

  const pad = 26;
  const w = cssW, h = cssH;

  const cs = getComputedStyle(document.documentElement);
  const border = cs.getPropertyValue('--border').trim();
  const muted = cs.getPropertyValue('--muted').trim();
  const accent = cs.getPropertyValue('--accent').trim();

  ctx.strokeStyle = border;
  ctx.lineWidth = 1;
  ctx.globalAlpha = 0.7;
  for (let i=0;i<5;i++){
    const y = pad + (h - pad*2) * (i/4);
    ctx.beginPath();
    ctx.moveTo(pad, y);
    ctx.lineTo(w-pad, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  if (!series.length) return;

  const weights = series.map(s => s.weight).filter(x => x>0);
  let wMin = Math.min(...weights);
  let wMax = Math.max(...weights);
  if (wMin === wMax){ wMin -= 1; wMax += 1; }

  ctx.fillStyle = muted;
  ctx.font = '12px ui-sans-serif, system-ui';
  ctx.fillText('Peso (kg)', pad, 14);
  ctx.fillText('Score', w-pad-40, 14);

  const xFor = (i) => pad + (w - pad*2) * (i/(series.length-1 || 1));
  const yWeight = (val) => pad + (h - pad*2) * (1 - (val - wMin)/(wMax - wMin));
  const yScore = (val) => pad + (h - pad*2) * (1 - (val - 0)/(100 - 0));

  ctx.lineWidth = 2.6;
  ctx.strokeStyle = accent;
  ctx.beginPath();
  series.forEach((p, i)=>{
    if (p.weight <= 0) return;
    const x = xFor(i);
    const y = yWeight(p.weight);
    if (i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.stroke();

  ctx.lineWidth = 2.2;
  ctx.strokeStyle = 'rgba(140,180,255,.85)';
  ctx.beginPath();
  series.forEach((p, i)=>{
    const x = xFor(i);
    const y = yScore(p.score);
    if (i===0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  });
  ctx.stroke();

  const last = series[series.length-1];
  if (last.weight > 0){
    const x = xFor(series.length-1);
    const y = yWeight(last.weight);
    ctx.fillStyle = accent;
    ctx.beginPath(); ctx.arc(x,y,4.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = muted;
    ctx.fillText(`${last.weight.toFixed(1)} kg`, x-52, y-10);
  }
  {
    const x = xFor(series.length-1);
    const y = yScore(last.score);
    ctx.fillStyle = 'rgba(140,180,255,.95)';
    ctx.beginPath(); ctx.arc(x,y,4.2,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = muted;
    ctx.fillText(`${last.score}/100`, x-52, y+18);
  }
}

// ===== Export CSV =====
function exportCSV(){
  const entries = loadEntries();
  const dates = Object.keys(entries).sort((a,b)=> a.localeCompare(b));
  const header = [
    'date','weight','sleep','energy','hunger','pain',
    'cardioMin','steps','intensity','protein','water','strengthDay','strengthDone',
    'mobilityDone','snacks','cleanMeals','mobilityMin','score',
    'win','fix'
  ];
  const rows = [header.join(',')];

  for (const d of dates){
    const e = entries[d];
    const row = [
      d,
      e.weight ?? '',
      e.sleep ?? '',
      e.energy ?? '',
      e.hunger ?? '',
      e.pain ?? '',
      e.cardioMin ?? '',
      e.steps ?? '',
      e.intensity ?? '',
      e.protein ?? false,
      e.water ?? false,
      e.strengthDay ?? false,
      e.strengthDone ?? false,
      e.mobilityDone ?? false,
      e.snacks ?? false,
      e.cleanMeals ?? '',
      e.mobilityMin ?? '',
      e.score?.total ?? 0,
      (e.win ?? '').replaceAll(',', ' '),
      (e.fix ?? '').replaceAll(',', ' ')
    ];
    rows.push(row.join(','));
  }

  const blob = new Blob([rows.join('\n')], {type:'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pasta_emagrecimento.csv';
  a.click();
  URL.revokeObjectURL(url);
}

// ===== Weekly report =====
function generateWeeklyReport(){
  const entries = loadEntries();
  const datesDesc = Object.keys(entries).sort((a,b)=> b.localeCompare(a));
  if (datesDesc.length === 0){
    toast('Sem dados ainda');
    return;
  }
  const last7Dates = datesDesc.slice(0,7).sort((a,b)=> a.localeCompare(b));
  const last7 = last7Dates.map(d => entries[d]);

  const wStart = Number(last7[0].weight || 0);
  const wEnd   = Number(last7[last7.length-1].weight || 0);
  const delta = (wEnd && wStart) ? (wEnd - wStart) : null;

  const avgScore = Math.round(last7.reduce((acc,e)=> acc + (e.score?.total || 0), 0) / last7.length);
  const cardioDays = last7.filter(e => Number(e.cardioMin||0) >= 1).length;
  const strengthDays = last7.filter(e => e.strengthDay && e.strengthDone).length;
  const proteinDays = last7.filter(e => e.protein).length;
  const waterDays = last7.filter(e => e.water).length;

  const sign = delta !== null ? (delta > 0 ? '+' : '') : '';
  const deltaTxt = delta !== null ? `${sign}${delta.toFixed(1)} kg` : '—';

  const report =
`📌 RELATÓRIO SEMANAL (últimos ${last7.length} dias)
📅 ${fmtBR(last7Dates[0])} → ${fmtBR(last7Dates[last7Dates.length-1])}

⚖️ Peso: ${wStart || '--'} → ${wEnd || '--'} (${deltaTxt})
📈 Score médio: ${isNaN(avgScore) ? '--' : avgScore}/100

🚶 Cardio: ${cardioDays}/${last7.length} dias
🏋️ Força: ${strengthDays} treinos
🥩 Proteína batida: ${proteinDays}/${last7.length}
💧 Água batida: ${waterDays}/${last7.length}

✅ Vitória da semana: ${last7[last7.length-1].win || '—'}
⚠️ Ajuste prioritário: ${last7[last7.length-1].fix || '—'}

“Consistência vence. O corpo aceita rotina, não desculpa.”`;

  navigator.clipboard.writeText(report).then(()=>{
    toast('Relatório copiado ✅');
    alert(report);
  }).catch(()=>{
    alert(report);
  });
}

// ===== Backup / Restore =====
function backupJSON(){
  const payload = {
    version: 2,
    createdAt: new Date().toISOString(),
    goals: loadGoals(),
    entries: loadEntries(),
    doses: loadDoses(),
    theme: localStorage.getItem(LS_THEME) || 'dark'
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:'application/json;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pasta_emagrecimento_backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

function restoreJSON(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const payload = JSON.parse(reader.result);
      if (!payload || !payload.entries) throw new Error('Arquivo inválido');
      localStorage.setItem(LS_ENTRIES, JSON.stringify(payload.entries || {}));
      localStorage.setItem(LS_DOSES, JSON.stringify(payload.doses || {}));
      if (payload.goals) saveGoals(payload.goals);
      if (payload.theme) localStorage.setItem(LS_THEME, payload.theme);
      applyTheme();
      refreshHistory();
      updateScoreUI();
      buildSchedule();
      toast('Backup restaurado ✅');
    }catch(e){
      alert('Erro ao restaurar: ' + e.message);
    }
  };
  reader.readAsText(file);
}

// ===== Schedule =====
function nextFridays(startISO, count){
  const start = new Date(startISO + 'T12:00:00');
  const out = [];
  let d = new Date(start);

  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);

  for (let i=0; i<count; i++){
    out.push(d.toISOString().slice(0,10));
    d.setDate(d.getDate() + 7);
  }
  return out;
}

function doseLabel(index){
  const w = index + 1;
  if (w <= 4) return '0,25 mg';
  if (w <= 8) return '0,5 mg';
  if (w <= 12) return '1,0 mg';
  if (w <= 16) return '1,7 mg';
  return '2,4 mg';
}

function buildSchedule(){
  const start = $('s_start').value;
  const count = Number($('s_count').value || 16);
  const dates = nextFridays(start, count);
  const doses = loadDoses();

  const list = $('doseList');
  list.innerHTML = '';

  dates.forEach((iso, idx) => {
    const done = !!doses[iso];
    const label = doseLabel(idx);

    const div = document.createElement('div');
    div.className = 'item';
    div.innerHTML = `
      <div class="left">
        <b>${idx+1}ª dose • ${fmtBR(iso)} • ${label}</b>
        <span>Status: ${done ? '✅ aplicada' : '⏳ pendente'}</span>
      </div>
      <div class="right">
        <input type="checkbox" ${done ? 'checked' : ''} />
      </div>
    `;
    div.querySelector('input').addEventListener('change', (ev) => {
      const dosesNow = loadDoses();
      dosesNow[iso] = ev.target.checked;
      saveDoses(dosesNow);
      buildSchedule();
      toast(ev.target.checked ? 'Dose marcada ✅' : 'Dose desmarcada');
    });
    list.appendChild(div);
  });
}

// ===== Tabs =====
function show(screen){
  $('screenDashboard').style.display = (screen==='dash') ? 'block' : 'none';
  $('screenSchedule').style.display = (screen==='sched') ? 'block' : 'none';
  $('tabDashboard').classList.toggle('active', screen==='dash');
  $('tabSchedule').classList.toggle('active', screen==='sched');
}

// ===== Goals modal =====
function openSettings(){
  const g = loadGoals();
  $('g_steps').value = g.stepsGoal;
  $('g_cardio').value = g.cardioGoal;
  $('g_sleep').value = g.sleepGoal;
  $('g_meals').value = g.cleanMealsGoal;
  $('g_neutralStrength').checked = !!g.neutralStrength;
  $('g_penalizeSnacks').checked = !!g.penalizeSnacks;
  $('settingsOverlay').classList.add('show');
}
function closeSettings(){
  $('settingsOverlay').classList.remove('show');
}
function saveGoalsFromModal(){
  const g = {
    stepsGoal: Number($('g_steps').value || DEFAULT_GOALS.stepsGoal),
    cardioGoal: Number($('g_cardio').value || DEFAULT_GOALS.cardioGoal),
    sleepGoal: Number($('g_sleep').value || DEFAULT_GOALS.sleepGoal),
    cleanMealsGoal: Number($('g_meals').value || DEFAULT_GOALS.cleanMealsGoal),
    neutralStrength: $('g_neutralStrength').checked,
    penalizeSnacks: $('g_penalizeSnacks').checked
  };
  saveGoals(g);
  updateScoreUI();
  refreshHistory();
  toast('Metas salvas ✅');
  closeSettings();
}
function resetGoals(){
  saveGoals({...DEFAULT_GOALS});
  openSettings();
  updateScoreUI();
  refreshHistory();
  toast('Metas resetadas');
}

// ===== Theme =====
function applyTheme(){
  const saved = localStorage.getItem(LS_THEME) || 'dark';
  document.documentElement.setAttribute('data-theme', saved === 'light' ? 'light' : 'dark');
}
function toggleTheme(){
  const cur = localStorage.getItem(LS_THEME) || 'dark';
  const next = (cur === 'light') ? 'dark' : 'light';
  localStorage.setItem(LS_THEME, next);
  applyTheme();
  drawChart(getSeriesForChart());
  toast(next === 'light' ? 'Tema claro ☀️' : 'Tema escuro 🌙');
}

function getSeriesForChart(){
  const entries = loadEntries();
  const datesDesc = Object.keys(entries).sort((a,b)=> b.localeCompare(a));
  const last14Dates = datesDesc.slice(0,14).sort((a,b)=> a.localeCompare(b));
  return last14Dates.map(d => ({
    date: d,
    weight: Number(entries[d].weight || 0),
    score: Number(entries[d].score?.total || 0)
  }));
}

// ===== Quick buttons =====
function addCardio(minutes){
  const cur = Number($('d_cardioMin').value || 0);
  $('d_cardioMin').value = cur + minutes;
  updateScoreUI();
  toast(`+${minutes} min cardio`);
}
function setStepsToGoal(){
  const g = loadGoals();
  $('d_steps').value = g.stepsGoal;
  updateScoreUI();
  toast('Passos na meta ✅');
}

// ===== Init =====
function init(){
  applyTheme();

  $('todayPill').textContent = `📅 ${fmtBR(todayISO())}`;
  $('d_date').value = todayISO();
  $('tagSprint').textContent = 'Férias (desde 16/01/2026)';

  $('s_start').value = '2026-01-16';

  const inputs = [
    'd_date','d_weight','d_sleep','d_energy','d_hunger','d_pain',
    'd_cardioMin','d_steps','d_intensity','d_cleanMeals','d_mobilityMin',
    'd_win','d_fix'
  ];
  inputs.forEach(id => $(id).addEventListener('input', updateScoreUI));

  const checks = [
    'd_protein','d_water','d_strengthDay','d_strengthDone','d_mobilityDone','d_snacks'
  ];
  checks.forEach(id => $(id).addEventListener('change', updateScoreUI));

  $('btnSaveDay').addEventListener('click', () => {
    const goals = loadGoals();
    const data = readDashboardForm();
    const score = computeScore(data, goals);
    data.score = score;

    const entries = loadEntries();
    entries[data.date] = data;
    saveEntries(entries);

    refreshHistory();
    updateScoreUI();
    toast('Dia salvo ✅');
  });

  $('btnLoadDay').addEventListener('click', () => {
    const entries = loadEntries();
    const date = $('d_date').value;
    if (entries[date]){
      fillDashboardForm(entries[date]);
      updateScoreUI();
      toast('Registro carregado 📌');
    } else {
      toast('Sem registro nessa data');
    }
  });

  $('btnExportCSV').addEventListener('click', exportCSV);
  $('btnWeeklyReport').addEventListener('click', generateWeeklyReport);

  $('btnResetAll').addEventListener('click', () => {
    if(confirm('Tem certeza que quer zerar TUDO?')){
      localStorage.removeItem(LS_ENTRIES);
      localStorage.removeItem(LS_DOSES);
      fillDashboardForm({date: todayISO()});
      updateScoreUI();
      refreshHistory();
      buildSchedule();
      toast('Tudo zerado 🧹');
    }
  });

  $('btnBackup').addEventListener('click', backupJSON);
  $('btnRestore').addEventListener('click', () => $('restoreFile').click());
  $('restoreFile').addEventListener('change', (ev) => {
    const f = ev.target.files && ev.target.files[0];
    if (f) restoreJSON(f);
    ev.target.value = '';
  });

  $('btnPlus15').addEventListener('click', ()=> addCardio(15));
  $('btnPlus30').addEventListener('click', ()=> addCardio(30));
  $('btnStepsGoal').addEventListener('click', setStepsToGoal);

  $('btnBuildSchedule').addEventListener('click', buildSchedule);
  $('btnClearScheduleChecks').addEventListener('click', () => {
    if(confirm('Limpar todas as marcações de doses?')){
      localStorage.removeItem(LS_DOSES);
      buildSchedule();
      toast('Doses limpas');
    }
  });

  $('tabDashboard').addEventListener('click', ()=> show('dash'));
  $('tabSchedule').addEventListener('click', ()=> { show('sched'); buildSchedule(); });

  $('btnOpenSettings').addEventListener('click', openSettings);
  $('btnCloseSettings').addEventListener('click', closeSettings);
  $('settingsOverlay').addEventListener('click', (ev)=>{
    if (ev.target.id === 'settingsOverlay') closeSettings();
  });
  $('btnSaveGoals').addEventListener('click', saveGoalsFromModal);
  $('btnResetGoals').addEventListener('click', resetGoals);

  $('btnToggleTheme').addEventListener('click', toggleTheme);

  updateScoreUI();
  refreshHistory();
  buildSchedule();
  window.addEventListener('resize', () => drawChart(getSeriesForChart()));
}

init();
