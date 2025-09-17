// Dienstbuch Feuerwehr Lüttringhausen
// Datenmodell & Speicher
const LS_KEY = "jfw-luettringhausen-state-v1";

const Status = {
  ANWESEND: "Anwesend",
  ENTSCHULDIGT: "Entschuldigt",
  ABWESEND: "Abwesend",
};

const state = loadState() || {
  kinder: [],   // {id, firstName, lastName, dob, entryDate, exitDate, jf1, jf2, jf3, ls}
  betreuer: [], // {id, firstName, lastName, fsC, jgl, ehDate, jglDate}
  dienste: [],  // {id, date, title, note, attendance:{kidId:Status}, betreuerAnwesend:[betreuerId]}
};

function saveState(){ localStorage.setItem(LS_KEY, JSON.stringify(state)); }
function loadState(){ try{ return JSON.parse(localStorage.getItem(LS_KEY)); }catch(e){ return null; } }
function uid(){ return Math.random().toString(36).slice(2,10); }

// Helpers
function fmtDate(d){ if(!d) return ""; const dt=new Date(d); return dt.toLocaleDateString("de-DE"); }
function parseDate(v){ return v? new Date(v): null; }
function ageFromDob(dob){
  if(!dob) return "";
  const d=new Date(dob); const now=new Date();
  let age = now.getFullYear()-d.getFullYear();
  const m = now.getMonth()-d.getMonth();
  if(m<0 || (m===0 && now.getDate()<d.getDate())) age--;
  return age;
}
function monthsBetween(a,b){
  const d1=new Date(a), d2=new Date(b);
  let months = (d2.getFullYear()-d1.getFullYear())*12 + (d2.getMonth()-d1.getMonth());
  if(d2.getDate()<d1.getDate()) months--;
  return months;
}
function withinMonths(dateStr, months){
  if(!dateStr) return false;
  const now = new Date();
  const d = new Date(dateStr);
  return monthsBetween(d, now) <= months;
}
function overMonths(dateStr, months){
  if(!dateStr) return true;
  return !withinMonths(dateStr, months);
}
function dueSoon(dateStr, months, warnWindowDays=30){
  if(!dateStr) return true;
  const d = new Date(dateStr);
  const due = new Date(d); due.setMonth(due.getMonth()+months);
  const now = new Date();
  const diffDays = Math.floor((due - now)/(1000*60*60*24));
  return diffDays <= warnWindowDays;
}

// Views
const view = document.getElementById("view");
const modal = document.getElementById("modal");
const modalBody = document.getElementById("modal-body");
const modalTitle = document.getElementById("modal-title");
document.getElementById("modal-close").onclick=()=>modal.classList.add("hidden");

function setActiveTab(id){
  document.querySelectorAll(".tab-btn").forEach(b=>b.classList.remove("active"));
  document.getElementById(id).classList.add("active");
}
document.getElementById("nav-dienste").onclick=()=>{ setActiveTab("nav-dienste"); renderDienste(); };
document.getElementById("nav-kinder").onclick =()=>{ setActiveTab("nav-kinder"); renderKinder(); };
document.getElementById("nav-betreuer").onclick=()=>{ setActiveTab("nav-betreuer"); renderBetreuer(); };
document.getElementById("nav-statistik").onclick=()=>{ setActiveTab("nav-statistik"); renderStatistik(); };
document.getElementById("btn-backup").onclick=()=>showBackup();

// ---------- Dienste ----------
function renderDienste(){
  view.innerHTML = `
    <div class="grid resp">
      <section class="card">
        <h2 class="section-title">Dienste</h2>
        <table class="table" id="services-table">
          <thead><tr>
            <th>Datum</th><th>Titel</th><th>Notiz</th>
            <th class="center">Kinder anwesend</th>
            <th class="center">Betreuer anwesend</th>
            <th></th>
          </tr></thead>
          <tbody></tbody>
        </table>
      </section>
      <section class="card">
        <h2 class="section-title">Neuer Dienst</h2>
        <div class="grid cols-2">
          <div>
            <label>Datum</label>
            <input class="input" type="date" id="svc-date">
          </div>
          <div>
            <label>Titel</label>
            <input class="input" type="text" id="svc-title" placeholder="Übungsdienst, Ausbildung…">
          </div>
        </div>
        <div style="margin-top:8px">
          <label>Notiz</label>
          <input class="input" type="text" id="svc-note" placeholder="Thema, Besonderheiten …">
        </div>
        <div style="margin-top:12px">
          <button class="btn primary" id="svc-create">Dienst anlegen</button>
        </div>
        <p class="help">Hinweis: Pro Dienst muss mindestens ein Betreuer anwesend sein.</p>
      </section>
    </div>
  `;

  document.getElementById("svc-create").onclick=()=>{
    const date = document.getElementById("svc-date").value;
    const title= document.getElementById("svc-title").value.trim();
    const note = document.getElementById("svc-note").value.trim();
    if(!date || !title){ alert("Bitte Datum und Titel angeben."); return; }
    const svc = { id: uid(), date, title, note, attendance:{}, betreuerAnwesend:[] };
    state.dienste.push(svc); saveState(); renderDienste();
    openDienst(svc.id);
  };

  const tbody = document.querySelector("#services-table tbody");
  tbody.innerHTML = "";
  const rows = [...state.dienste].sort((a,b)=> new Date(b.date)-new Date(a.date));
  rows.forEach(svc=>{
    const tr = document.getElementById("tmpl-service-row").content.firstElementChild.cloneNode(true);
    tr.querySelector(".date").textContent = fmtDate(svc.date);
    tr.querySelector(".title").textContent= svc.title;
    tr.querySelector(".note").textContent = svc.note||"";

    const kidCount = Object.values(svc.attendance||{}).filter(v=>v===Status.ANWESEND).length;
    tr.querySelector(".kids-count").textContent = kidCount;
    tr.querySelector(".betreuer-count").textContent = (svc.betreuerAnwesend||[]).length;

    tr.querySelector(".open").onclick = ()=> openDienst(svc.id);
    tr.querySelector(".del").onclick  = ()=>{
      if(confirm("Diesen Dienst löschen?")){ 
        state.dienste = state.dienste.filter(d=>d.id!==svc.id);
        saveState(); renderDienste();
      }
    };
    tr.querySelector(".pdf").onclick  = ()=> exportDienstPDF(svc.id);
    tbody.appendChild(tr);
  });
}

function openDienst(id){
  const svc = state.dienste.find(d=>d.id===id);
  if(!svc) return;
  modalTitle.textContent = `Dienst • ${fmtDate(svc.date)} • ${svc.title}`;
  modalBody.innerHTML = "";
  const kidsSorted = [...state.kinder].sort((a,b)=> (a.lastName||"").localeCompare(b.lastName||""));
  const betreuerSorted = [...state.betreuer].sort((a,b)=> (a.lastName||"").localeCompare(b.lastName||""));

  const wrap = document.createElement("div");
  wrap.className="grid cols-2";

  // Kids block
  const kidsCard = document.createElement("section");
  kidsCard.className="card";
  kidsCard.innerHTML = `<h3 class="section-title">Kinder</h3>
    <table class="table"><thead>
      <tr><th>Name</th><th>Alter</th><th>Status</th><th>Probezeit</th></tr>
    </thead><tbody></tbody></table>`;
  const ktbody = kidsCard.querySelector("tbody");
  kidsSorted.forEach(kid=>{
    const tr = document.createElement("tr"); tr.className="kid-row";
    const age = ageFromDob(kid.dob);
    const inProb = kid.entryDate ? monthsBetween(kid.entryDate, new Date()) < 6 : false;
    tr.innerHTML = `
      <td>${kid.lastName||""}, ${kid.firstName||""}</td>
      <td class="age">${age? age+" Jahre": "-"}</td>
      <td>
        <select class="input status-select" data-kid="${kid.id}">
          ${Object.values(Status).map(s=> `<option value="${s}">${s}</option>`).join("")}
        </select>
      </td>
      <td>${inProb ? '<span class="badge warn">Probezeit</span>' : '<span class="badge ok">Bestanden</span>'}</td>
    `;
    ktbody.appendChild(tr);
    const sel = tr.querySelector("select");
    sel.value = (svc.attendance && svc.attendance[kid.id]) || Status.ABWESEND;
    sel.oninput = (e)=>{ svc.attendance[kid.id] = e.target.value; saveState(); /* no re-render here */ };
  });

  // Betreuer block
  const betCard = document.createElement("section");
  betCard.className="card";
  betCard.innerHTML = `<h3 class="section-title">Betreuer (mind. 1 erforderlich)</h3>
    <div class="grid"> </div>`;
  const betGrid = betCard.querySelector(".grid");
  betreuerSorted.forEach(b=>{
    const lastEHOver = overMonths(b.ehDate, 24);
    const lastEHWarn = dueSoon(b.ehDate, 24);
    const lastJGLOver= overMonths(b.jglDate, 24);
    const lastJGLWarn= dueSoon(b.jglDate, 24);
    const id=`bet-${b.id}`;
    const container = document.createElement("label");
    container.className="check";
    container.innerHTML = `
      <input type="checkbox" id="${id}">
      <span>${b.lastName||""}, ${b.firstName||""}</span>
      ${b.fsC? '<span class="badge info">Kl. C</span>': ''}
      ${b.jgl? '<span class="badge info">JGL</span>': ''}
      ${lastEHOver? '<span class="badge due">EH überfällig</span>': (lastEHWarn? '<span class="badge warn">EH fällig bald</span>':'<span class="badge ok">EH ok</span>')}
      ${lastJGLOver? '<span class="badge due">JGL überfällig</span>': (lastJGLWarn? '<span class="badge warn">JGL fällig bald</span>':'<span class="badge ok">JGL ok</span>')}
    `;
    betGrid.appendChild(container);
    const cb = container.querySelector("input");
    cb.checked = (svc.betreuerAnwesend||[]).includes(b.id);
    cb.onchange = (e)=>{
      const arr = new Set(svc.betreuerAnwesend||[]);
      if(e.target.checked) arr.add(b.id); else arr.delete(b.id);
      svc.betreuerAnwesend = [...arr]; saveState();
    };
  });

  // Actions
  const actions = document.createElement("div");
  actions.className="inline-actions";
  const saveBtn = document.createElement("button"); saveBtn.className="btn primary"; saveBtn.textContent="Speichern";
  const pdfBtn  = document.createElement("button"); pdfBtn.className="btn secondary"; pdfBtn.textContent="PDF export";
  saveBtn.onclick = ()=>{
    if(!svc.betreuerAnwesend || svc.betreuerAnwesend.length===0){ alert("Es muss mindestens ein Betreuer anwesend sein."); return; }
    saveState(); modal.classList.add("hidden"); renderDienste();
  };
  pdfBtn.onclick = ()=> exportDienstPDF(svc.id);
  actions.appendChild(saveBtn); actions.appendChild(pdfBtn);

  wrap.appendChild(kidsCard); wrap.appendChild(betCard);
  modalBody.appendChild(wrap);
  modalBody.appendChild(document.createElement("hr")).className="sep";
  modalBody.appendChild(actions);

  modal.classList.remove("hidden");
}

function exportDienstPDF(id){
  const svc = state.dienste.find(d=>d.id===id);
  if(!svc) return;
  // Print-friendly window
  const w = window.open("", "_blank");
  const kids = [...state.kinder].sort((a,b)=> (a.lastName||"").localeCompare(b.lastName||""));
  const betreuer = state.betreuer.filter(b=> (svc.betreuerAnwesend||[]).includes(b.id));
  const rows = kids.map(k=>{
    const st = (svc.attendance && svc.attendance[k.id]) || Status.ABWESEND;
    const inProb = k.entryDate ? monthsBetween(k.entryDate, new Date()) < 6 : false;
    const age = ageFromDob(k.dob);
    return `<tr>
      <td>${k.lastName||""}, ${k.firstName||""}</td>
      <td>${age? age+" Jahre":"-"}</td>
      <td>${st}</td>
      <td>${inProb? "Probezeit": ""}</td>
      <td></td>
    </tr>`;
  }).join("");

  const betreuerList = betreuer.map(b=> `${b.lastName||""}, ${b.firstName||""}`).join(", ");

  w.document.write(`<!doctype html><html lang="de"><head>
    <meta charset="utf-8">
    <title>PDF • ${fmtDate(svc.date)} • ${svc.title}</title>
    <style>
      body{font:14px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial; color:#111; padding:24px}
      h1{font-size:20px; margin:0 0 4px 0}
      h2{font-size:16px; margin:0 0 10px 0; color:#374151}
      table{width:100%; border-collapse:collapse; margin-top:8px}
      th,td{border:1px solid #e5e7eb; padding:8px; text-align:left}
      th{background:#f8fafc; font-size:12px; text-transform:uppercase; letter-spacing:.04em}
      .meta{display:flex; gap:16px; margin:8px 0 12px 0}
      .meta div{font-size:13px}
      .footer{margin-top:24px; display:flex; justify-content:space-between}
      .sign{width:45%}
      @media print {.noprint{display:none}}
    </style>
  </head><body>
    <h1>Dienstbuch Feuerwehr Lüttringhausen</h1>
    <div class="meta">
      <div><strong>Datum:</strong> ${fmtDate(svc.date)}</div>
      <div><strong>Titel:</strong> ${svc.title}</div>
    </div>
    <div class="meta"><div><strong>Betreuer anwesend:</strong> ${betreuerList||"-"}</div></div>
    <h2>Anwesenheitsliste</h2>
    <table>
      <thead><tr><th>Name</th><th>Alter</th><th>Status</th><th>Hinweis</th><th>Unterschrift</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <div class="footer">
      <div class="sign">Unterschrift verantwortliche/r Betreuer/in: ___________________________</div>
      <div class="sign">Unterschrift Wehrführung: ___________________________</div>
    </div>
    <button class="noprint" onclick="window.print()">Als PDF speichern</button>
  </body></html>`);
  w.document.close();
  w.focus();
}


// ---------- Kinder ----------
function renderKinder(){
  view.innerHTML = `
    <section class="card">
      <h2 class="section-title">Kinder verwalten</h2>
      <div class="grid cols-3">
        <div><label>Vorname</label><input class="input" id="k-first"></div>
        <div><label>Nachname</label><input class="input" id="k-last"></div>
        <div><label>Geburtsdatum</label><input type="date" class="input" id="k-dob"></div>
        <div><label>Eintritt</label><input type="date" class="input" id="k-entry"></div>
        <div><label>Austritt</label><input type="date" class="input" id="k-exit"></div>
        <div class="grid">
          <label>Abzeichen</label>
          <label class="check"><input type="checkbox" id="k-jf1"> Jugendflamme 1</label>
          <label class="check"><input type="checkbox" id="k-jf2"> Jugendflamme 2</label>
          <label class="check"><input type="checkbox" id="k-jf3"> Jugendflamme 3</label>
          <label class="check"><input type="checkbox" id="k-ls"> Leistungsspange</label>
        </div>
      </div>
      <div style="margin-top:10px">
        <button class="btn primary" id="k-add">Hinzufügen</button>
      </div>

      <table class="table" style="margin-top:14px">
        <thead><tr>
          <th>Name</th><th>Geburtsdatum</th><th>Alter</th><th>Eintritt</th><th>Austritt</th><th>Abzeichen</th><th></th>
        </tr></thead>
        <tbody id="kids-tbody"></tbody>
      </table>
    </section>
  `;

  document.getElementById("k-add").onclick=()=>{
    const first = document.getElementById("k-first").value.trim();
    const last  = document.getElementById("k-last").value.trim();
    const dob   = document.getElementById("k-dob").value;
    const entry = document.getElementById("k-entry").value;
    const exit  = document.getElementById("k-exit").value;
    if(!first || !last){ alert("Vor- und Nachname sind erforderlich."); return; }
    state.kinder.push({
      id: uid(), firstName:first, lastName:last, dob, entryDate:entry, exitDate:exit,
      jf1: document.getElementById("k-jf1").checked,
      jf2: document.getElementById("k-jf2").checked,
      jf3: document.getElementById("k-jf3").checked,
      ls:  document.getElementById("k-ls").checked,
    });
    saveState(); renderKinder();
  };

  const tbody = document.getElementById("kids-tbody");
  tbody.innerHTML="";
  [...state.kinder].sort((a,b)=> (a.lastName||"").localeCompare(b.lastName||"")).forEach(k=>{
    const tr = document.createElement("tr");
    const age = ageFromDob(k.dob);
    const inProb = k.entryDate ? monthsBetween(k.entryDate, new Date()) < 6 : false;
    tr.innerHTML = `
      <td>${k.lastName||""}, ${k.firstName||""} ${inProb? '<span class="badge warn probation">Probezeit</span>':''}</td>
      <td>${k.dob? fmtDate(k.dob): "-"}</td>
      <td>${age? age+" Jahre":"-"}</td>
      <td>${k.entryDate? fmtDate(k.entryDate): "-"}</td>
      <td>${k.exitDate? fmtDate(k.exitDate): "-"}</td>
      <td>
        ${k.jf1? '<span class="badge ok">JF1</span>':''}
        ${k.jf2? '<span class="badge ok">JF2</span>':''}
        ${k.jf3? '<span class="badge ok">JF3</span>':''}
        ${k.ls?  '<span class="badge ok">Leistungssp.</span>':''}
      </td>
      <td class="nowrap">
        <button class="btn small secondary edit">Bearbeiten</button>
        <button class="btn small danger del">Löschen</button>
      </td>
    `;
    tr.querySelector(".edit").onclick=()=> editKind(k.id);
    tr.querySelector(".del").onclick =()=>{
      if(confirm("Kind löschen?")){ 
        state.kinder = state.kinder.filter(x=>x.id!==k.id);
        // auch aus Diensten entfernen
        state.dienste.forEach(d=>{ if(d.attendance) delete d.attendance[k.id]; });
        saveState(); renderKinder();
      }
    };
    tbody.appendChild(tr);
  });
}

function editKind(id){
  const k = state.kinder.find(x=>x.id===id); if(!k) return;
  modalTitle.textContent = "Kind bearbeiten";
  modalBody.innerHTML = `
    <div class="grid cols-3">
      <div><label>Vorname</label><input class="input" id="ek-first" value="${k.firstName||""}"></div>
      <div><label>Nachname</label><input class="input" id="ek-last" value="${k.lastName||""}"></div>
      <div><label>Geburtsdatum</label><input type="date" class="input" id="ek-dob" value="${k.dob||""}"></div>
      <div><label>Eintritt</label><input type="date" class="input" id="ek-entry" value="${k.entryDate||""}"></div>
      <div><label>Austritt</label><input type="date" class="input" id="ek-exit" value="${k.exitDate||""}"></div>
      <div class="grid">
        <label>Abzeichen</label>
        <label class="check"><input type="checkbox" id="ek-jf1" ${k.jf1?'checked':''}> Jugendflamme 1</label>
        <label class="check"><input type="checkbox" id="ek-jf2" ${k.jf2?'checked':''}> Jugendflamme 2</label>
        <label class="check"><input type="checkbox" id="ek-jf3" ${k.jf3?'checked':''}> Jugendflamme 3</label>
        <label class="check"><input type="checkbox" id="ek-ls" ${k.ls?'checked':''}> Leistungsspange</label>
      </div>
    </div>
    <div style="margin-top:10px" class="inline-actions">
      <button class="btn primary" id="ek-save">Speichern</button>
    </div>
  `;
  document.getElementById("ek-save").onclick=()=>{
    k.firstName = document.getElementById("ek-first").value.trim();
    k.lastName  = document.getElementById("ek-last").value.trim();
    k.dob       = document.getElementById("ek-dob").value;
    k.entryDate = document.getElementById("ek-entry").value;
    k.exitDate  = document.getElementById("ek-exit").value;
    k.jf1 = document.getElementById("ek-jf1").checked;
    k.jf2 = document.getElementById("ek-jf2").checked;
    k.jf3 = document.getElementById("ek-jf3").checked;
    k.ls  = document.getElementById("ek-ls").checked;
    saveState(); modal.classList.add("hidden"); renderKinder();
  };
  modal.classList.remove("hidden");
}

// ---------- Betreuer ----------
function renderBetreuer(){
  view.innerHTML = `
    <section class="card">
      <h2 class="section-title">Betreuer verwalten</h2>
      <div class="grid cols-3">
        <div><label>Vorname</label><input class="input" id="b-first"></div>
        <div><label>Nachname</label><input class="input" id="b-last"></div>
        <div class="check"><input type="checkbox" id="b-fsc"> <label for="b-fsc">Führerschein Klasse C</label></div>
        <div class="check"><input type="checkbox" id="b-jgl"> <label for="b-jgl">Jugendgruppenleiter (JGL)</label></div>
        <div><label>Letzte Erste-Hilfe-Schulung</label><input type="date" class="input" id="b-eh"></div>
        <div><label>Letzte Jugendbetreuer-Schulung</label><input type="date" class="input" id="b-jgld"></div>
      </div>
      <div style="margin-top:10px">
        <button class="btn primary" id="b-add">Hinzufügen</button>
      </div>

      <table class="table" style="margin-top:14px">
        <thead><tr>
          <th>Name</th><th>Kl. C</th><th>JGL</th><th>Erste Hilfe</th><th>JBetreuerschulung</th><th></th>
        </tr></thead>
        <tbody id="bet-tbody"></tbody>
      </table>
      <p class="help">Hinweis: Erste Hilfe und Jugendbetreuer-Schulung müssen spätestens alle zwei Jahre erneuert werden. Fälligkeiten werden visuell markiert.</p>
    </section>
  `;

  document.getElementById("b-add").onclick=()=>{
    const first = document.getElementById("b-first").value.trim();
    const last  = document.getElementById("b-last").value.trim();
    const fsc   = document.getElementById("b-fsc").checked;
    const jgl   = document.getElementById("b-jgl").checked;
    const eh    = document.getElementById("b-eh").value;
    const jgld  = document.getElementById("b-jgld").value;
    if(!first || !last){ alert("Vor- und Nachname sind erforderlich."); return; }
    state.betreuer.push({ id:uid(), firstName:first, lastName:last, fsC:fsc, jgl, ehDate:eh, jglDate:jgld });
    saveState(); renderBetreuer();
  };

  const tbody = document.getElementById("bet-tbody"); tbody.innerHTML="";
  [...state.betreuer].sort((a,b)=> (a.lastName||"").localeCompare(b.lastName||"")).forEach(b=>{
    const lastEHOver = overMonths(b.ehDate, 24);
    const lastEHWarn = dueSoon(b.ehDate, 24);
    const lastJGLOver= overMonths(b.jglDate, 24);
    const lastJGLWarn= dueSoon(b.jglDate, 24);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${b.lastName||""}, ${b.firstName||""}</td>
      <td class="center">${b.fsC? "✔️": ""}</td>
      <td class="center">${b.jgl? "✔️": ""}</td>
      <td>
        ${b.ehDate? fmtDate(b.ehDate): "-"}
        ${lastEHOver? '<span class="badge due">überfällig</span>': (lastEHWarn? '<span class="badge warn">bald fällig</span>':'<span class="badge ok">ok</span>')}
      </td>
      <td>
        ${b.jglDate? fmtDate(b.jglDate): "-"}
        ${lastJGLOver? '<span class="badge due">überfällig</span>': (lastJGLWarn? '<span class="badge warn">bald fällig</span>':'<span class="badge ok">ok</span>')}
      </td>
      <td class="nowrap">
        <button class="btn small secondary edit">Bearbeiten</button>
        <button class="btn small danger del">Löschen</button>
      </td>
    `;
    tr.querySelector(".edit").onclick=()=> editBetreuer(b.id);
    tr.querySelector(".del").onclick =()=>{
      if(confirm("Betreuer löschen?")){
        state.betreuer = state.betreuer.filter(x=>x.id!==b.id);
        state.dienste.forEach(d=>{
          d.betreuerAnwesend = (d.betreuerAnwesend||[]).filter(i=>i!==b.id);
        });
        saveState(); renderBetreuer();
      }
    };
    tbody.appendChild(tr);
  });
}

function editBetreuer(id){
  const b = state.betreuer.find(x=>x.id===id); if(!b) return;
  modalTitle.textContent = "Betreuer bearbeiten";
  modalBody.innerHTML = `
    <div class="grid cols-3">
      <div><label>Vorname</label><input class="input" id="eb-first" value="${b.firstName||""}"></div>
      <div><label>Nachname</label><input class="input" id="eb-last" value="${b.lastName||""}"></div>
      <div class="check"><input type="checkbox" id="eb-fsc" ${b.fsC?'checked':''}> <label for="eb-fsc">Führerschein Klasse C</label></div>
      <div class="check"><input type="checkbox" id="eb-jgl" ${b.jgl?'checked':''}> <label for="eb-jgl">Jugendgruppenleiter (JGL)</label></div>
      <div><label>Letzte Erste-Hilfe-Schulung</label><input type="date" class="input" id="eb-eh" value="${b.ehDate||""}"></div>
      <div><label>Letzte Jugendbetreuer-Schulung</label><input type="date" class="input" id="eb-jgld" value="${b.jglDate||""}"></div>
    </div>
    <div style="margin-top:10px" class="inline-actions">
      <button class="btn primary" id="eb-save">Speichern</button>
    </div>
  `;
  document.getElementById("eb-save").onclick=()=>{
    b.firstName = document.getElementById("eb-first").value.trim();
    b.lastName  = document.getElementById("eb-last").value.trim();
    b.fsC       = document.getElementById("eb-fsc").checked;
    b.jgl       = document.getElementById("eb-jgl").checked;
    b.ehDate    = document.getElementById("eb-eh").value;
    b.jglDate   = document.getElementById("eb-jgld").value;
    saveState(); modal.classList.add("hidden"); renderBetreuer();
  };
  modal.classList.remove("hidden");
}

// ---------- Statistik ----------
function renderStatistik(){
  // Kennzahlen
  const totalDienste = state.dienste.length;
  let sumAnwesend=0, maxAnwes=0, minAnwes=Infinity, sumBet=0;
  state.dienste.forEach(d=>{
    const an = Object.values(d.attendance||{}).filter(v=>v===Status.ANWESEND).length;
    const bt = (d.betreuerAnwesend||[]).length;
    sumAnwesend+=an; sumBet+=bt;
    if(an>maxAnwes) maxAnwes=an;
    if(an<minAnwes) minAnwes=an;
  });
  const avgAn = totalDienste? (sumAnwesend/totalDienste).toFixed(1):"0.0";
  const avgBt = totalDienste? (sumBet/totalDienste).toFixed(1):"0.0";
  if(minAnwes===Infinity) minAnwes=0;

  view.innerHTML = `
    <section class="card">
      <h2 class="section-title">Statistik</h2>
      <div class="grid cols-3">
        <div class="stat"><div class="value">${totalDienste}</div><div class="label">Dienste gesamt</div></div>
        <div class="stat"><div class="value">${avgAn}</div><div class="label">Ø anwesende Kinder</div></div>
        <div class="stat"><div class="value">${avgBt}</div><div class="label">Ø anwesende Betreuer</div></div>
        <div class="stat"><div class="value">${minAnwes}—${maxAnwes}</div><div class="label">Min—Max Kinder anwesend</div></div>
        <div class="stat"><div class="value">${state.kinder.length}</div><div class="label">Kinder (aktiv+inaktiv)</div></div>
        <div class="stat"><div class="value">${state.betreuer.length}</div><div class="label">Betreuer gesamt</div></div>
      </div>
      <hr class="sep">
      <h3 class="section-title">Auswertung je Kind</h3>
      <table class="table">
        <thead><tr><th>Name</th><th>Alter</th><th>Dienste</th><th>Anwesend</th><th>Entschuldigt</th><th>Abwesend</th><th>Anwesenheitsquote</th></tr></thead>
        <tbody id="stat-kids"></tbody>
      </table>
    </section>
  `;

  const tbody = document.getElementById("stat-kids");
  const stats = state.kinder.map(k=>{
    let d=0,a=0,e=0,ab=0;
    state.dienste.forEach(svc=>{
      const v = svc.attendance && svc.attendance[k.id];
      if(v){ d++; if(v===Status.ANWESEND) a++; else if(v===Status.ENTSCHULDIGT) e++; else ab++; }
    });
    const quote = d? Math.round((a/d)*100):0;
    return {k, d,a,e,ab,quote};
  }).sort((x,y)=> y.quote - x.quote);

  stats.forEach(({k,d,a,e,ab,quote})=>{
    const tr = document.createElement("tr");
    const age = ageFromDob(k.dob);
    tr.innerHTML = `
      <td>${k.lastName||""}, ${k.firstName||""}</td>
      <td>${age? age+" Jahre":"-"}</td>
      <td>${d}</td><td>${a}</td><td>${e}</td><td>${ab}</td><td>${quote}%</td>
    `;
    tbody.appendChild(tr);
  });
}

// ---------- Backup/Restore ----------
function showBackup(){
  modalTitle.textContent="Backup / Restore";
  modalBody.innerHTML=`
    <div class="grid cols-2">
      <section class="card">
        <h3 class="section-title">Backup herunterladen</h3>
        <p class="help">Erstellt eine JSON-Datei deiner aktuellen Daten.</p>
        <button class="btn" id="bk-export">Backup speichern</button>
      </section>
      <section class="card">
        <h3 class="section-title">Backup wiederherstellen</h3>
        <input type="file" id="bk-file" accept="application/json">
        <p class="help">Wählt eine zuvor gespeicherte JSON-Datei.</p>
      </section>
    </div>
  `;
  document.getElementById("bk-export").onclick=()=>{
    const blob = new Blob([JSON.stringify(state,null,2)], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "dienstbuch-backup.json";
    a.click();
  };
  document.getElementById("bk-file").onchange=(e)=>{
    const file = e.target.files[0]; if(!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      try{
        const data = JSON.parse(reader.result);
        Object.assign(state, data);
        saveState(); alert("Backup erfolgreich eingespielt."); modal.classList.add("hidden"); renderDienste();
      }catch(err){ alert("Ungültige Datei."); }
    };
    reader.readAsText(file);
  };
  modal.classList.remove("hidden");
}

// Init
renderDienste();
