/* ================================================
   GRABMART KPI DASHBOARD — script.js
   Mapped ke sheet: recap (single sheet)
   ================================================ */

"use strict";

// ─────────────────────────────────────────────────
//  KONFIGURASI — ganti dengan URL Apps Script Anda
// ─────────────────────────────────────────────────
const API_URL = "YOUR_GOOGLE_APPS_SCRIPT_URL";

// ─────────────────────────────────────────────────
//  STATE
// ─────────────────────────────────────────────────
let rawData        = null;
let filteredAMs    = [];
let charts         = {};
let refreshTimer   = null;
let countdownSecs  = 300;
let countdownTimer = null;

// ─────────────────────────────────────────────────
//  DEMO DATA — data aktual dari sheet recap Apr'26
// ─────────────────────────────────────────────────
function generateDemoData() {
  const amData = [
    { name:"Wido Kurniawan",  city:"Lampung",   alokasi:78,  achievement:46.2,  cpAch:89.7, adsAch:0,     mcaAch:0,     mcaActual:0,         mcaTarget:35774567, bsAch:154.6, bsActual:129759202, bsTarget:83912305,  kiosAch:19.5, kiosActual:4563382,  kiosTarget:23348641, ctaPct:0,   lastAcq:16 },
    { name:"Tomy Roynaldi",   city:"Bengkulu",  alokasi:62,  achievement:58.4,  cpAch:106.9,adsAch:0,     mcaAch:16.2,  mcaActual:5000000,    mcaTarget:30918706, bsAch:55.6,  bsActual:120900797, bsTarget:217444325, kiosAch:22.9, kiosActual:4316170,  kiosTarget:18842163, ctaPct:0,   lastAcq:13 },
    { name:"Yan Steven",      city:"Jambi",     alokasi:124, achievement:85.6,  cpAch:88.7, adsAch:154,   mcaAch:35.8,  mcaActual:23616234,   mcaTarget:65994011, bsAch:48.8,  bsActual:160286507, bsTarget:328308007, kiosAch:51.2, kiosActual:14219015, kiosTarget:27750758, ctaPct:0,   lastAcq:0  },
    { name:"M Ari Yamin",     city:"Palembang", alokasi:71,  achievement:79.2,  cpAch:88.0, adsAch:89,    mcaAch:80.6,  mcaActual:38706999,   mcaTarget:48000000, bsAch:64.7,  bsActual:116156605, bsTarget:179613072, kiosAch:5.5,  kiosActual:1984945,  kiosTarget:36000000, ctaPct:0,   lastAcq:0  },
    { name:"Herry Soleh",     city:"Palembang", alokasi:76,  achievement:147.8, cpAch:93.8, adsAch:221,   mcaAch:214.7, mcaActual:104999999,  mcaTarget:48912717, bsAch:68.1,  bsActual:226933001, bsTarget:333479733, kiosAch:16.1, kiosActual:6491201,  kiosTarget:40220721, ctaPct:0,   lastAcq:0  },
  ];
  // Isi field tambahan
  amData.forEach(d => {
    d.cpTarget      = 80;
    d.cpActual      = +(d.cpAch * 0.8).toFixed(1);
    d.adsTarget     = d.adsAch > 0 ? Math.round(d.adsActual / (d.adsAch/100)) : 0;
    d.adsActual     = d.adsAch > 0 ? Math.round(d.adsTarget * d.adsAch / 100) : 0;
    d.mcaWL         = Math.floor(d.mcaTarget / 1500000);
    d.contractSubmit= d.alokasi > 100 ? 11 : d.alokasi > 70 ? 8 : 5;
    d.contractKYB   = 2;
    d.contractWon   = d.contractSubmit - 4;
    d.contractPct   = d.contractSubmit > 0 ? +((d.contractWon / d.contractSubmit)*100).toFixed(1) : 0;
    d.ctaTarget     = 9;
    d.ctaActual     = 0;
  });
  return {
    lastUpdated: "19 Mei 2026, 19:16 (Demo)",
    kpiSummary: {
      totalAchievement: { value: 96.9,  target: 100 },
      cpAchievement:    { value: 92.5,  target: 100 },
      adsAchievement:   { value: 151.3, target: 100 },
      mcaAchievement:   { value: 75.1,  target: 100 },
      basketSize:       { value: 66.0,  target: 100 },
      kiosAchievement:  { value: 41.9,  target: 100 },
      totalAlokasi:     411,
    },
    amData,
    trends: {
      dates:       amData.map(d => d.name.split(" ")[0]),
      allocation:  amData.map(d => d.cpAch),
      achievement: amData.map(d => d.achievement),
      basketSize:  amData.map(d => d.bsActual),
      mcaAch:      amData.map(d => d.mcaAch),
    },
  };
}

// ─────────────────────────────────────────────────
//  FETCH DATA
// ─────────────────────────────────────────────────
async function loadData() {
  setStatus("loading", "Mengambil data…");
  updateLoaderProgress(10);
  try {
    let data;
    if (!API_URL || API_URL === "YOUR_GOOGLE_APPS_SCRIPT_URL") {
      await new Promise(r => setTimeout(r, 800));
      data = generateDemoData();
      setStatus("live", "Demo · data Apr'26");
    } else {
      const resp = await fetch(API_URL, { cache: "no-store" });
      if (!resp.ok) throw new Error("HTTP " + resp.status);
      data = await resp.json();
      if (data.error) throw new Error(data.error);
      setStatus("live", "Live · " + (data.lastUpdated || ""));
    }
    updateLoaderProgress(75);
    rawData = data;
    populateCityFilter(data.amData);
    filteredAMs = applyFilters(data.amData);
    updateLoaderProgress(92);
    renderAll(data, filteredAMs);
    updateLoaderProgress(100);
    setTimeout(hideLoader, 350);
    resetCountdown();
  } catch (err) {
    console.error(err);
    setStatus("error", "Gagal konek");
    showErrorBanner(err.message);
    hideLoader();
  }
}

function renderAll(data, ams) {
  renderKPICards(data.kpiSummary, data.kpiSummary.totalAlokasi);
  renderPerformanceTables(ams);
  renderCharts(data, ams);
  renderHeatmap(ams);
  renderInsights(data, ams);
  updateLastUpdatedTag(data.lastUpdated);
}

// ─────────────────────────────────────────────────
//  LOADER / BANNER
// ─────────────────────────────────────────────────
function updateLoaderProgress(pct) {
  const b = document.getElementById("loader-bar");
  if (b) b.style.width = pct + "%";
}
function hideLoader() {
  document.getElementById("loading-overlay")?.classList.add("hidden");
}
function showErrorBanner(msg) {
  document.getElementById("error-banner")?.remove();
  const el = document.createElement("div");
  el.id = "error-banner"; el.className = "error-banner";
  el.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>&nbsp;Gagal memuat: ${msg || ""}. Menampilkan data demo.`;
  document.getElementById("filters")?.before(el);
}

// ─────────────────────────────────────────────────
//  STATUS DOT
// ─────────────────────────────────────────────────
function setStatus(type, text) {
  const dot = document.getElementById("status-dot");
  const sp  = document.getElementById("status-text");
  if (dot) dot.className = "status-dot " + type;
  if (sp)  sp.textContent = text;
}
function updateLastUpdatedTag(ts) {
  const el = document.getElementById("last-updated-tag");
  if (el) el.textContent = "Update: " + (ts || "—");
}

// ─────────────────────────────────────────────────
//  FILTERS
// ─────────────────────────────────────────────────
function populateCityFilter(amData) {
  const sel = document.getElementById("filter-area");
  if (!sel) return;
  const cities = [...new Set(amData.map(d => d.city).filter(Boolean))].sort();
  while (sel.options.length > 1) sel.remove(1);
  cities.forEach(c => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c; sel.appendChild(o);
  });
}
function applyFilters(amData) {
  const s = (document.getElementById("search-am")?.value||"").toLowerCase().trim();
  const c = document.getElementById("filter-area")?.value||"";
  return amData.filter(d => {
    if (s && !d.name.toLowerCase().includes(s)) return false;
    if (c && d.city !== c) return false;
    return true;
  });
}
function onFilterChange() {
  if (!rawData) return;
  filteredAMs = applyFilters(rawData.amData);
  renderAll(rawData, filteredAMs);
}

// ─────────────────────────────────────────────────
//  ANIMATED COUNTER
// ─────────────────────────────────────────────────
function animateCounter(el, target, suffix, duration) {
  const t0 = performance.now();
  (function tick(now) {
    const p = Math.min((now - t0) / duration, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = (target * e).toFixed(1) + suffix;
    if (p < 1) requestAnimationFrame(tick);
  })(performance.now());
}

// ─────────────────────────────────────────────────
//  COLOR HELPERS
// ─────────────────────────────────────────────────
const cc  = p => p >= 100 ? "card-green"    : p >= 80 ? "card-yellow"  : "card-red";
const bc  = p => p >= 100 ? "badge-green"   : p >= 80 ? "badge-yellow" : "badge-red";
const bl  = p => p >= 100 ? "✓ On Target"   : p >= 80 ? "⚡ Close"     : "✗ Behind";
const hmc = p => (p==null||p==="") ? "hm-empty" : p>=100 ? "hm-green" : p>=80 ? "hm-yellow" : "hm-red";
const pc  = p => p >= 100 ? "var(--accent-green)" : p >= 80 ? "var(--accent-yellow)" : "var(--accent-red)";

// ─────────────────────────────────────────────────
//  KPI CARDS
// ─────────────────────────────────────────────────
const KPI_DEFS = [
  { key:"totalAchievement", label:"Final Achievement",    icon:"📊" },
  { key:"cpAchievement",    label:"Campaign Part. (CP)",  icon:"🎯" },
  { key:"adsAchievement",   label:"ADS / JBP",            icon:"📢" },
  { key:"mcaAchievement",   label:"MCA Achievement",      icon:"🏪" },
  { key:"basketSize",       label:"Basket Size",          icon:"🛒" },
  { key:"kiosAchievement",  label:"Kios B2M",             icon:"🏬" },
];

function renderKPICards(kpi, alokasi) {
  const grid = document.getElementById("kpi-grid");
  if (!grid) return;
  grid.innerHTML = "";
  KPI_DEFS.forEach((def, i) => {
    const item = kpi[def.key] || { value:0, target:100 };
    const pct  = item.value;
    const fill = Math.min(pct/130*100, 100);
    const card = document.createElement("div");
    card.className = `kpi-card ${cc(pct)}`;
    card.style.animationDelay = `${0.04+i*0.05}s`;
    card.innerHTML = `
      <div class="kpi-card-icon">${def.icon}</div>
      <div class="kpi-card-label">${def.label}</div>
      <div class="kpi-card-value" id="kv-${def.key}">0.0%</div>
      <div class="kpi-progress-bar">
        <div class="kpi-progress-fill" style="width:0%" id="kb-${def.key}"></div>
      </div>
      <div class="kpi-card-meta">
        <div class="kpi-card-sub">Target: ${item.target}%</div>
        <div class="kpi-card-badge ${bc(pct)}">${bl(pct)}</div>
      </div>`;
    grid.appendChild(card);
    requestAnimationFrame(() => {
      const v = document.getElementById(`kv-${def.key}`);
      const b = document.getElementById(`kb-${def.key}`);
      if (v) animateCounter(v, pct, "%", 1100+i*80);
      if (b) setTimeout(() => b.style.width = fill+"%", 70+i*50);
    });
  });
  const tag = document.getElementById("last-updated-tag");
  if (tag && alokasi) tag.textContent += " · Alokasi: " + alokasi.toLocaleString("id-ID");
}

// ─────────────────────────────────────────────────
//  PERFORMANCE TABLES
// ─────────────────────────────────────────────────
function renderPerformanceTables(amData) {
  const s = [...amData].sort((a,b) => b.achievement - a.achievement);
  fillTable("top-table-body",  s.slice(0, 5),    true);
  fillTable("attn-table-body", s.slice(-5).reverse(), false);
}
function fillTable(id, rows, isTop) {
  const tb = document.getElementById(id);
  if (!tb) return;
  tb.innerHTML = "";
  if (!rows.length) {
    tb.innerHTML = `<tr><td colspan="3" style="text-align:center;color:var(--text-muted);padding:18px;font-family:var(--font-data);font-size:0.74rem">Tidak ada data</td></tr>`;
    return;
  }
  rows.forEach((am, i) => {
    const rc = i===0?"rank-1":i===1?"rank-2":i===2?"rank-3":"rank-n";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><span class="rank-badge ${rc}">${isTop?i+1:"!"}</span></td>
      <td>
        <span style="font-weight:500">${am.name}</span>
        <span style="display:block;font-size:0.65rem;color:var(--text-muted);font-family:var(--font-data)">${am.city||""}</span>
      </td>
      <td class="pct-cell" style="color:${pc(am.achievement)}">${am.achievement.toFixed(1)}%</td>`;
    tb.appendChild(tr);
  });
}

// ─────────────────────────────────────────────────
//  CHARTS
// ─────────────────────────────────────────────────
const MONO = "'JetBrains Mono',monospace";
const tc   = () => getComputedStyle(document.documentElement).getPropertyValue("--chart-text").trim()||"#6b7a99";
const gc   = () => getComputedStyle(document.documentElement).getPropertyValue("--chart-grid").trim()||"rgba(255,255,255,0.05)";
const kill = k => { if(charts[k]){charts[k].destroy();charts[k]=null;} };

const scX = () => ({ grid:{color:gc(),drawBorder:false}, ticks:{color:tc(),font:{family:MONO,size:10},maxRotation:30} });
const scY = u => ({ grid:{color:gc(),drawBorder:false}, beginAtZero:true, ticks:{color:tc(),font:{family:MONO,size:10},callback:v=>v+(u?" "+u:"")} });
const tip = () => ({ backgroundColor:"rgba(13,18,32,0.96)", borderColor:"rgba(255,255,255,0.1)", borderWidth:1, titleFont:{family:MONO,size:11}, bodyFont:{family:MONO,size:11}, padding:10 });
const leg = () => ({ labels:{color:tc(),font:{family:MONO,size:10},boxWidth:10,padding:12} });

function renderCharts(data, amData) {
  renderC1(amData);
  renderC2(amData);
  renderC3(amData);
  renderC4(amData);
  renderC5(amData);
}

// C1: Final Achievement per AM — Horizontal Bar
function renderC1(amData) {
  kill("c1");
  const ctx = document.getElementById("chart-achievement-am");
  if (!ctx||!amData.length) return;
  const s  = [...amData].sort((a,b)=>b.achievement-a.achievement);
  const cl = s.map(d=>d.achievement>=100?"#00e5a0":d.achievement>=80?"#f5c518":"#ff4d6d");
  charts.c1 = new Chart(ctx, {
    type:"bar",
    data:{ labels:s.map(d=>d.name),
      datasets:[{ label:"Final Achievement %", data:s.map(d=>d.achievement),
        backgroundColor:cl.map(c=>c+"22"), borderColor:cl, borderWidth:1.5, borderRadius:5, borderSkipped:false }]},
    options:{
      indexAxis:"y", responsive:true, maintainAspectRatio:false,
      plugins:{ legend:{display:false},
        datalabels:{anchor:"end",align:"end",color:cl,font:{family:MONO,size:10,weight:"600"},formatter:v=>v.toFixed(1)+"%"},
        tooltip:tip() },
      scales:{x:scX(),y:{grid:{display:false},ticks:{color:tc(),font:{family:MONO,size:10}}}},
      animation:{duration:900} },
    plugins:[ChartDataLabels] });
}

// C2: MCA Actual vs Target — Grouped Bar
function renderC2(amData) {
  kill("c2");
  const ctx = document.getElementById("chart-mca");
  if (!ctx||!amData.length) return;
  charts.c2 = new Chart(ctx, {
    type:"bar",
    data:{ labels:amData.map(d=>d.name.split(" ")[0]),
      datasets:[
        { label:"MCA Actual (Jt)", data:amData.map(d=>+(d.mcaActual/1e6).toFixed(1)),
          backgroundColor:"rgba(0,229,160,0.2)", borderColor:"#00e5a0", borderWidth:1.5, borderRadius:4 },
        { label:"MCA Target (Jt)", data:amData.map(d=>+(d.mcaTarget/1e6).toFixed(1)),
          backgroundColor:"rgba(79,158,255,0.15)", borderColor:"#4f9eff", borderWidth:1.5, borderRadius:4 }
      ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:leg(),
        datalabels:{anchor:"end",align:"end",color:tc(),font:{family:MONO,size:9},formatter:v=>v>0?v.toFixed(0):""},
        tooltip:tip()},
      scales:{x:scX(),y:scY("Jt")},animation:{duration:900}},
    plugins:[ChartDataLabels] });
}

// C3: CP Ach vs Final Achievement — Line
function renderC3(amData) {
  kill("c3");
  const ctx = document.getElementById("chart-allocation");
  if (!ctx||!amData.length) return;
  const lb = amData.map(d=>d.name.split(" ")[0]);
  charts.c3 = new Chart(ctx, {
    type:"line",
    data:{ labels:lb,
      datasets:[
        { label:"CP Ach %", data:amData.map(d=>d.cpAch),
          borderColor:"#4f9eff", backgroundColor:"rgba(79,158,255,0.08)",
          pointBackgroundColor:"#4f9eff", pointRadius:5, borderWidth:2, tension:0.4, fill:true },
        { label:"Final Ach %", data:amData.map(d=>d.achievement),
          borderColor:"#00e5a0", backgroundColor:"rgba(0,229,160,0.06)",
          pointBackgroundColor:"#00e5a0", pointRadius:5, borderWidth:2, tension:0.4, fill:true }
      ]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:leg(), datalabels:{display:false},
        tooltip:{...tip(),callbacks:{label:c=>` ${c.dataset.label}: ${c.parsed.y.toFixed(1)}%`}}},
      scales:{x:scX(),y:scY("%")},animation:{duration:1000}},
    plugins:[ChartDataLabels] });
}

// C4: Basket Size per AM — Area
function renderC4(amData) {
  kill("c4");
  const ctx = document.getElementById("chart-basket");
  if (!ctx||!amData.length) return;
  charts.c4 = new Chart(ctx, {
    type:"line",
    data:{ labels:amData.map(d=>d.name.split(" ")[0]),
      datasets:[{ label:"Basket Size (Rp)", data:amData.map(d=>d.bsActual),
        borderColor:"#a78bfa", backgroundColor:"rgba(167,139,250,0.12)",
        pointBackgroundColor:"#a78bfa", pointRadius:5, borderWidth:2, tension:0.5, fill:true }]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false}, datalabels:{display:false},
        tooltip:{...tip(),callbacks:{label:c=>` Rp ${c.parsed.y.toLocaleString("id-ID")}`}}},
      scales:{x:scX(), y:{grid:{color:gc(),drawBorder:false},beginAtZero:false,
        ticks:{color:tc(),font:{family:MONO,size:10},callback:v=>"Rp"+(v/1e6).toFixed(0)+"M"}}},
      animation:{duration:1000}},
    plugins:[ChartDataLabels] });
}

// C5: MCA Progress — Donut
function renderC5(amData) {
  kill("c5");
  const ctx = document.getElementById("chart-merchant");
  if (!ctx||!amData.length) return;
  const tot    = amData.reduce((s,d)=>s+d.mcaActual,0);
  const target = amData.reduce((s,d)=>s+d.mcaTarget,0);
  const pct    = target>0?(tot/target*100):0;
  const pctEl  = document.getElementById("donut-pct");
  if (pctEl) pctEl.textContent = pct.toFixed(1)+"%";
  const accent = pct>=100?"#00e5a0":pct>=80?"#f5c518":"#ff4d6d";
  charts.c5 = new Chart(ctx, {
    type:"doughnut",
    data:{ labels:["Tercapai","Sisa"],
      datasets:[{ data:[Math.min(tot,target),Math.max(target-tot,0)],
        backgroundColor:[accent+"bb","rgba(255,255,255,0.05)"],
        borderColor:[accent,"rgba(255,255,255,0.08)"], borderWidth:[2,1], hoverOffset:6 }]},
    options:{
      responsive:true, maintainAspectRatio:false, cutout:"72%",
      plugins:{
        legend:{position:"bottom",labels:{color:tc(),font:{family:MONO,size:10},boxWidth:10,padding:10}},
        datalabels:{display:false},
        tooltip:{...tip(),callbacks:{label:c=>` ${c.label}: Rp ${c.parsed.toLocaleString("id-ID")}`}}},
      animation:{animateRotate:true,duration:1200}},
    plugins:[ChartDataLabels] });
}

// ─────────────────────────────────────────────────
//  HEATMAP
// ─────────────────────────────────────────────────
function renderHeatmap(amData) {
  const thead = document.getElementById("heatmap-thead");
  const tbody = document.getElementById("heatmap-tbody");
  if (!thead||!tbody) return;
  const cols = [
    {key:"achievement",label:"Final Ach"},
    {key:"cpAch",      label:"CP"},
    {key:"adsAch",     label:"ADS"},
    {key:"mcaAch",     label:"MCA"},
    {key:"bsAch",      label:"Basket Size"},
    {key:"kiosAch",    label:"Kios B2M"},
  ];
  thead.innerHTML = `<tr><th>AM Name</th><th>Kota</th>${cols.map(c=>`<th>${c.label}</th>`).join("")}</tr>`;
  tbody.innerHTML = "";
  if (!amData.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:20px;font-family:var(--font-data);font-size:0.75rem">Tidak ada data</td></tr>`;
    return;
  }
  amData.forEach(am => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${am.name}</td>
      <td style="color:var(--text-muted);font-size:0.72rem">${am.city||"—"}</td>
      ${cols.map(c=>`<td class="${hmc(am[c.key])}">${am[c.key]!=null?am[c.key].toFixed(1)+"%":"—"}</td>`).join("")}`;
    tbody.appendChild(tr);
  });
}

// ─────────────────────────────────────────────────
//  EXECUTIVE INSIGHTS
// ─────────────────────────────────────────────────
function renderInsights(data, amData) {
  const grid = document.getElementById("insights-grid");
  if (!grid||!amData.length) return;
  const s    = [...amData].sort((a,b)=>b.achievement-a.achievement);
  const top  = s[0];
  const low  = s[s.length-1];
  const avg  = s.reduce((a,d)=>a+d.achievement,0)/s.length;
  const mcaT = amData.reduce((a,d)=>a+d.mcaTarget,0);
  const mcaA = amData.reduce((a,d)=>a+d.mcaActual,0);
  const mcaP = mcaT>0?(mcaA/mcaT*100):0;
  const total= data.kpiSummary.totalAchievement.value;
  const half = Math.ceil(s.length/2);
  const t50  = s.slice(0,half).reduce((a,d)=>a+d.achievement,0)/half;
  const b50  = s.slice(half).reduce((a,d)=>a+d.achievement,0)/Math.max(s.length-half,1);
  const trend= t50>b50+5?"Improving 📈":t50<b50-5?"Declining 📉":"Stable ➡";

  const ins = [
    { icon:"🏆", label:"Top Performer",    value:top.name,
      desc:`Ach ${top.achievement.toFixed(1)}% · ${top.city}`,
      tag:"Champion", tc:"badge-green", col:"var(--accent-green)" },
    { icon:"⚠️", label:"Perlu Perhatian",  value:low.name,
      desc:`Ach ${low.achievement.toFixed(1)}% · ${low.city}`,
      tag:"Action needed", tc:"badge-red", col:"var(--accent-red)" },
    { icon:"📈", label:"Achievement Trend", value:trend,
      desc:`Team avg: ${avg.toFixed(1)}% · TOTAL SOUTH: ${total}%`,
      tag:total>=100?"On Target":total>=80?"Near Target":"Below Target",
      tc:total>=100?"badge-green":total>=80?"badge-yellow":"badge-red",
      col:total>=100?"var(--accent-green)":total>=80?"var(--accent-yellow)":"var(--accent-red)" },
    { icon:"🏪", label:"MCA Status",       value:mcaP.toFixed(1)+"% of target",
      desc:`Rp ${(mcaA/1e9).toFixed(2)}M dari Rp ${(mcaT/1e9).toFixed(2)}M`,
      tag:mcaP>=100?"Good":mcaP>=80?"On Track":"Attention",
      tc:mcaP>=100?"badge-green":mcaP>=80?"badge-yellow":"badge-red",
      col:mcaP>=100?"var(--accent-green)":mcaP>=80?"var(--accent-yellow)":"var(--accent-red)" },
  ];
  grid.innerHTML = "";
  ins.forEach((x,i) => {
    const el = document.createElement("div");
    el.className = "insight-card";
    el.style.setProperty("--insight-color", x.col);
    el.style.animationDelay = `${0.05+i*0.07}s`;
    el.innerHTML = `
      <div class="insight-icon">${x.icon}</div>
      <div class="insight-label">${x.label}</div>
      <div class="insight-value">${x.value}</div>
      <div class="insight-desc">${x.desc}</div>
      <span class="insight-tag ${x.tc}">${x.tag}</span>`;
    grid.appendChild(el);
  });
}

// ─────────────────────────────────────────────────
//  CLOCK & COUNTDOWN
// ─────────────────────────────────────────────────
function updateDateTime() {
  const now = new Date();
  const d = document.getElementById("current-date");
  const t = document.getElementById("current-time");
  if (d) d.textContent = now.toLocaleDateString("id-ID",{weekday:"long",year:"numeric",month:"long",day:"numeric"});
  if (t) t.textContent = now.toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit",second:"2-digit"});
}
function resetCountdown() {
  countdownSecs = 300;
  if (countdownTimer) clearInterval(countdownTimer);
  countdownTimer = setInterval(() => {
    if (--countdownSecs <= 0) clearInterval(countdownTimer);
    const el = document.getElementById("countdown");
    if (el) el.textContent = Math.floor(countdownSecs/60)+":"+String(countdownSecs%60).padStart(2,"0");
  }, 1000);
}

// ─────────────────────────────────────────────────
//  THEME
// ─────────────────────────────────────────────────
function initTheme() {
  document.documentElement.setAttribute("data-theme", localStorage.getItem("gm-theme")||"dark");
}
function toggleTheme() {
  const n = document.documentElement.getAttribute("data-theme")==="dark"?"light":"dark";
  document.documentElement.setAttribute("data-theme",n);
  localStorage.setItem("gm-theme",n);
  if (rawData) setTimeout(()=>renderCharts(rawData,filteredAMs),150);
}

// ─────────────────────────────────────────────────
//  EVENTS & BOOT
// ─────────────────────────────────────────────────
const debounce = (fn,ms) => { let t; return (...a)=>{ clearTimeout(t); t=setTimeout(()=>fn(...a),ms); }; };

document.addEventListener("DOMContentLoaded", () => {
  initTheme();

  document.getElementById("theme-toggle")?.addEventListener("click", toggleTheme);
  document.getElementById("manual-refresh")?.addEventListener("click", () => {
    const b = document.getElementById("manual-refresh");
    if (b) { b.disabled=true; setTimeout(()=>b.disabled=false,5000); }
    loadData();
  });
  const df = debounce(onFilterChange, 280);
  document.getElementById("search-am")?.addEventListener("input", df);
  document.getElementById("filter-date")?.addEventListener("change", onFilterChange);
  document.getElementById("filter-area")?.addEventListener("change", onFilterChange);
  document.getElementById("clear-filters")?.addEventListener("click", () => {
    ["search-am","filter-date"].forEach(id=>{ const e=document.getElementById(id); if(e) e.value=""; });
    const s=document.getElementById("filter-area"); if(s) s.value="";
    onFilterChange();
  });
  window.addEventListener("scroll", ()=>{
    document.getElementById("navbar")?.classList.toggle("scrolled", window.scrollY>20);
  }, {passive:true});

  Chart.register(ChartDataLabels);
  Chart.defaults.font.family = MONO;
  Chart.defaults.animation   = { duration:900, easing:"easeOutQuart" };

  updateDateTime();
  setInterval(updateDateTime, 1000);
  loadData();
  refreshTimer = setInterval(loadData, 300000);
});
