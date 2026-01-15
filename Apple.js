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
