(() => {
  // Constants & Storage keys
  const STORAGE_KEY = 'jfw-luettringhausen-state-v1';
  const ADMIN_MODE_KEY = 'jfw-luettringhausen-admin-mode';
  const ADMIN_PIN_KEY  = 'jfw-luettringhausen-admin-pin';
  const DEFAULT_PIN    = '0000';

  const Status = {
    ANWESEND: 'Anwesend',
    ENTSCHULDIGT: 'Entschuldigt',
    ABWESEND: 'Abwesend'
  };

  // Utility functions
  function uid() {
    return '_' + Math.random().toString(36).substr(2, 9);
  }

  function fmtDate(d) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('de-DE');
  }

  function ageFromDob(dob) {
    if (!dob) return '';
    const now = new Date();
    const b = new Date(dob);
    let age = now.getFullYear() - b.getFullYear();
    const m = now.getMonth() - b.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < b.getDate())) {
      age--;
    }
    return age;
  }

  function monthsBetween(d1, d2) {
    // approximate months difference
    const date1 = new Date(d1);
    const date2 = new Date(d2);
    let months = (date2.getFullYear() - date1.getFullYear()) * 12;
    months += date2.getMonth() - date1.getMonth();
    if (date2.getDate() < date1.getDate()) months--;
    return months;
  }

  // Load & save state
  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('loadState error', e);
      return null;
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  // Global state
  let state = loadState() || { kinder: [], betreuer: [], dienste: [] };
  let isAdmin = localStorage.getItem(ADMIN_MODE_KEY) === 'true';

  function updateAdminUI() {
    const btn = document.getElementById('tab-admin');
    if (btn) btn.textContent = isAdmin ? 'Admin-Abmelden' : 'Admin-Login';
  }

  function setActiveTab(tab) {
    // update active class on nav buttons
    const nav = document.getElementById('nav');
    Array.from(nav.children).forEach(btn => {
      if (btn.id && btn.id.startsWith('tab-')) {
        btn.classList.toggle('active', btn.id === 'tab-' + tab);
      }
    });
    // render relevant content
    switch (tab) {
      case 'dienste': renderDienste(); break;
      case 'kinder': renderKinder(); break;
      case 'betreuer': renderBetreuer(); break;
      case 'statistik': renderStatistik(); break;
      case 'backup': renderBackup(); break;
    }
  }

  function adminLogin() {
    if (isAdmin) {
      isAdmin = false;
      localStorage.setItem(ADMIN_MODE_KEY, 'false');
      updateAdminUI();
      // re-render current tab to apply restrictions
      refreshCurrentTab();
      return;
    }
    const storedPin = localStorage.getItem(ADMIN_PIN_KEY) || DEFAULT_PIN;
    const entered = prompt('Bitte Admin-PIN eingeben:');
    if (entered === storedPin) {
      isAdmin = true;
      localStorage.setItem(ADMIN_MODE_KEY, 'true');
      updateAdminUI();
      refreshCurrentTab();
    } else if (entered !== null) {
      alert('Falsche PIN.');
    }
  }

  function refreshCurrentTab() {
    const nav = document.getElementById('nav');
    const activeBtn = Array.from(nav.children).find(btn => btn.classList.contains('active'));
    if (activeBtn) {
      const tab = activeBtn.id.replace('tab-', '');
      setActiveTab(tab);
    }
  }

  // Render functions
  function renderDienste() {
    const content = document.getElementById('content');
    content.innerHTML = '';
    const heading = document.createElement('h2');
    heading.textContent = 'Dienste';
    content.appendChild(heading);

    // New Dienst form
    const form = document.createElement('form');
    form.id = 'dienst-form';
    form.innerHTML = `
      <h3>Neuer Dienst</h3>
      <div class="inline">
        <div>
          <label>Datum<br><input type="date" id="dienst-date"></label>
        </div>
        <div>
          <label>Titel<br><input type="text" id="dienst-title"></label>
        </div>
        <div>
          <label>Notiz<br><input type="text" id="dienst-note"></label>
        </div>
      </div>
      <button type="button" class="btn" id="dienst-add">Hinzufügen</button>
    `;
    content.appendChild(form);

    form.querySelector('#dienst-add').onclick = () => {
      const date = form.querySelector('#dienst-date').value;
      const title = form.querySelector('#dienst-title').value.trim();
      const note = form.querySelector('#dienst-note').value.trim();
      if (!date || !title) {
        alert('Datum und Titel sind erforderlich.');
        return;
      }
      const newDienst = {
        id: uid(),
        date,
        title,
        note,
        attendance: {},
        betreuer: {}
      };
      state.dienste.push(newDienst);
      saveState();
      // Reset form
      form.querySelector('#dienst-date').value = '';
      form.querySelector('#dienst-title').value = '';
      form.querySelector('#dienst-note').value = '';
      renderDienste();
    };

    // List existing Dienste
    if (state.dienste.length > 0) {
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Datum</th><th>Titel</th><th>Notiz</th><th>Kinder (Anw./Ent./Abw.)</th><th>Betreuer</th><th>Aktionen</th></tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      state.dienste.forEach(d => {
        const row = document.createElement('tr');
        // Compute stats for this dienst
        let anwesend = 0, entschuldigt = 0, abwesend = 0;
        state.kinder.forEach(k => {
          const stat = d.attendance[k.id] || Status.ABWESEND;
          if (stat === Status.ANWESEND) anwesend++;
          else if (stat === Status.ENTSCHULDIGT) entschuldigt++;
          else abwesend++;
        });
        const betreuerCount = Object.keys(d.betreuer || {}).length;
        row.innerHTML = `
          <td>${fmtDate(d.date)}</td>
          <td>${d.title}</td>
          <td>${d.note || ''}</td>
          <td>${anwesend}/${entschuldigt}/${abwesend}</td>
          <td>${betreuerCount}</td>
          <td>
            <button class="btn btn-small" data-act="edit" data-id="${d.id}">Anwesenheit</button>
            <button class="btn btn-small" data-act="delete" data-id="${d.id}">Löschen</button>
          </td>`;
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      // Event delegation for edit/delete
      table.addEventListener('click', e => {
        const target = e.target;
        if (target.tagName === 'BUTTON') {
          const id = target.getAttribute('data-id');
          const act = target.getAttribute('data-act');
          const dienst = state.dienste.find(x => x.id === id);
          if (!dienst) return;
          if (act === 'edit') {
            openDienstModal(dienst);
          } else if (act === 'delete') {
            if (confirm('Dienst wirklich löschen?')) {
              state.dienste = state.dienste.filter(x => x.id !== id);
              saveState();
              renderDienste();
            }
          }
        }
      });
      content.appendChild(table);
    }
  }

  function openDienstModal(dienst) {
    const modal = document.getElementById('modal');
    modal.classList.remove('hidden');
    // build modal content
    const container = document.createElement('div');
    container.classList.add('modal-content');
    let html = `<h3>Anwesenheit erfassen für ${fmtDate(dienst.date)} - ${dienst.title}</h3>`;
    // Kinder table
    html += `<h4>Kinder</h4><table><thead><tr><th>Name</th><th>Status</th></tr></thead><tbody>`;
    state.kinder.forEach(k => {
      const current = dienst.attendance[k.id] || Status.ABWESEND;
      html += `<tr><td>${k.firstName} ${k.lastName}</td><td><select data-kid="${k.id}">`;
      Object.values(Status).forEach(st => {
        html += `<option value="${st}"${st === current ? ' selected' : ''}>${st}</option>`;
      });
      html += `</select></td></tr>`;
    });
    html += `</tbody></table>`;
    // Betreuer table
    html += `<h4>Betreuer (mind. 1 auswählen)</h4><table><thead><tr><th>Name</th><th>Anwesend</th></tr></thead><tbody>`;
    state.betreuer.forEach(b => {
      const checked = dienst.betreuer && dienst.betreuer[b.id] ? 'checked' : '';
      html += `<tr><td>${b.firstName} ${b.lastName}</td><td><input type="checkbox" data-bet="${b.id}" ${checked}></td></tr>`;
    });
    html += `</tbody></table>`;
    html += `<div style="margin-top:1rem;"><button class="btn" id="save-attendance">Speichern</button> <button class="btn" id="cancel-attendance">Abbrechen</button></div>`;
    container.innerHTML = html;
    modal.innerHTML = '';
    modal.appendChild(container);

    // Cancel handler
    container.querySelector('#cancel-attendance').onclick = () => {
      modal.classList.add('hidden');
      modal.innerHTML = '';
    };

    // Save handler
    container.querySelector('#save-attendance').onclick = () => {
      // gather statuses
      dienst.attendance = {};
      container.querySelectorAll('select[data-kid]').forEach(sel => {
        dienst.attendance[sel.getAttribute('data-kid')] = sel.value;
      });
      // gather betreuer
      dienst.betreuer = {};
      let selectedCount = 0;
      container.querySelectorAll('input[data-bet]').forEach(cb => {
        if (cb.checked) {
          dienst.betreuer[cb.getAttribute('data-bet')] = true;
          selectedCount++;
        }
      });
      if (selectedCount === 0) {
        alert('Mindestens ein Betreuer muss ausgewählt werden.');
        return;
      }
      saveState();
      modal.classList.add('hidden');
      modal.innerHTML = '';
      renderDienste();
    };
  }

  function renderKinder() {
    const content = document.getElementById('content');
    content.innerHTML = '';
    const heading = document.createElement('h2');
    heading.textContent = 'Kinder';
    content.appendChild(heading);
    if (isAdmin) {
      const form = document.createElement('form');
      form.id = 'kind-form';
      form.innerHTML = `
        <h3>Neues Kind</h3>
        <div class="inline">
          <div><label>Vorname<br><input type="text" id="kind-firstName"></label></div>
          <div><label>Nachname<br><input type="text" id="kind-lastName"></label></div>
          <div><label>Geburtsdatum<br><input type="date" id="kind-dob"></label></div>
        </div>
        <div class="inline">
          <div><label>Eintritt<br><input type="date" id="kind-entry"></label></div>
          <div><label>Austritt<br><input type="date" id="kind-exit"></label></div>
        </div>
        <div>
          <label><input type="checkbox" id="kind-jf1"> Jugendflamme 1</label>
          <label><input type="checkbox" id="kind-jf2"> Jugendflamme 2</label>
          <label><input type="checkbox" id="kind-jf3"> Jugendflamme 3</label>
          <label><input type="checkbox" id="kind-ls"> Leistungsspange</label>
        </div>
        <button type="button" class="btn" id="kind-add">Hinzufügen</button>
      `;
      content.appendChild(form);
      form.querySelector('#kind-add').onclick = () => {
        const firstName = form.querySelector('#kind-firstName').value.trim();
        const lastName = form.querySelector('#kind-lastName').value.trim();
        const dob = form.querySelector('#kind-dob').value;
        const entry = form.querySelector('#kind-entry').value;
        const exit = form.querySelector('#kind-exit').value;
        if (!firstName || !lastName) {
          alert('Vor- und Nachname sind erforderlich');
          return;
        }
        const kind = {
          id: uid(),
          firstName,
          lastName,
          dob,
          entryDate: entry,
          exitDate: exit,
          jf1: form.querySelector('#kind-jf1').checked,
          jf2: form.querySelector('#kind-jf2').checked,
          jf3: form.querySelector('#kind-jf3').checked,
          ls: form.querySelector('#kind-ls').checked
        };
        state.kinder.push(kind);
        saveState();
        renderKinder();
      };
    }
    // Table listing
    if (state.kinder.length > 0) {
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Name</th><th>Alter</th><th>Eintritt</th><th>Austritt</th><th>Abzeichen</th>' + (isAdmin ? '<th>Aktionen</th>' : '') + '</tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      state.kinder.forEach(k => {
        const row = document.createElement('tr');
        // probation: if entryDate within 6 months
        let probationHtml = '';
        if (k.entryDate) {
          const months = monthsBetween(k.entryDate, new Date());
          if (months < 6) probationHtml = ' <span class="probation">(Probe)</span>';
        }
        const badgeList = [];
        if (k.jf1) badgeList.push('JF1');
        if (k.jf2) badgeList.push('JF2');
        if (k.jf3) badgeList.push('JF3');
        if (k.ls) badgeList.push('LS');
        row.innerHTML = `<td>${k.firstName} ${k.lastName}${probationHtml}</td><td>${ageFromDob(k.dob)}</td><td>${fmtDate(k.entryDate)}</td><td>${fmtDate(k.exitDate)}</td><td>${badgeList.join(', ')}</td>`;
        if (isAdmin) {
          const td = document.createElement('td');
          const delBtn = document.createElement('button');
          delBtn.className = 'btn btn-small';
          delBtn.textContent = 'Löschen';
          delBtn.onclick = () => {
            if (confirm('Kind wirklich löschen?')) {
              // remove from state
              state.kinder = state.kinder.filter(x => x.id !== k.id);
              // remove attendance entries for this kid
              state.dienste.forEach(d => {
                if (d.attendance) delete d.attendance[k.id];
              });
              saveState();
              renderKinder();
            }
          };
          td.appendChild(delBtn);
          row.appendChild(td);
        }
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      content.appendChild(table);
    }
  }

  function renderBetreuer() {
    const content = document.getElementById('content');
    content.innerHTML = '';
    const heading = document.createElement('h2');
    heading.textContent = 'Betreuer';
    content.appendChild(heading);
    if (isAdmin) {
      const form = document.createElement('form');
      form.id = 'betreuer-form';
      form.innerHTML = `
        <h3>Neuer Betreuer</h3>
        <div class="inline">
          <div><label>Vorname<br><input type="text" id="bet-firstName"></label></div>
          <div><label>Nachname<br><input type="text" id="bet-lastName"></label></div>
        </div>
        <div>
          <label><input type="checkbox" id="bet-fs"> Führerschein Klasse C</label>
          <label><input type="checkbox" id="bet-jgl"> JGL</label>
        </div>
        <div class="inline">
          <div><label>Erste-Hilfe zuletzt<br><input type="date" id="bet-firstAid"></label></div>
          <div><label>Jugendbetreuer-Schulung zuletzt<br><input type="date" id="bet-jugendSchulung"></label></div>
        </div>
        <button type="button" class="btn" id="bet-add">Hinzufügen</button>
      `;
      content.appendChild(form);
      form.querySelector('#bet-add').onclick = () => {
        const firstName = form.querySelector('#bet-firstName').value.trim();
        const lastName = form.querySelector('#bet-lastName').value.trim();
        const fs = form.querySelector('#bet-fs').checked;
        const jgl = form.querySelector('#bet-jgl').checked;
        const firstAid = form.querySelector('#bet-firstAid').value;
        const jugendSchulung = form.querySelector('#bet-jugendSchulung').value;
        if (!firstName || !lastName) {
          alert('Vor- und Nachname sind erforderlich');
          return;
        }
        const bet = {
          id: uid(),
          firstName,
          lastName,
          fs,
          jgl,
          firstAidDate: firstAid,
          jugendDate: jugendSchulung
        };
        state.betreuer.push(bet);
        saveState();
        renderBetreuer();
      };
    }
    if (state.betreuer.length > 0) {
      const table = document.createElement('table');
      const thead = document.createElement('thead');
      thead.innerHTML = '<tr><th>Name</th><th>FS C</th><th>JGL</th><th>Erste-Hilfe</th><th>Jugend-Schulung</th>' + (isAdmin ? '<th>Aktionen</th>' : '') + '</tr>';
      table.appendChild(thead);
      const tbody = document.createElement('tbody');
      state.betreuer.forEach(b => {
        const row = document.createElement('tr');
        // Due checks
        const now = new Date();
        let faClass = '', jsClass = '';
        if (b.firstAidDate) {
          const m = monthsBetween(b.firstAidDate, now);
          if (m >= 24) faClass = 'overdue';
          else if (m >= 23) faClass = 'due-soon';
        }
        if (b.jugendDate) {
          const m2 = monthsBetween(b.jugendDate, now);
          if (m2 >= 24) jsClass = 'overdue';
          else if (m2 >= 23) jsClass = 'due-soon';
        }
        row.innerHTML = `<td>${b.firstName} ${b.lastName}</td><td>${b.fs ? '✓' : ''}</td><td>${b.jgl ? '✓' : ''}</td>` +
          `<td class="${faClass}">${fmtDate(b.firstAidDate)}</td><td class="${jsClass}">${fmtDate(b.jugendDate)}</td>`;
        if (isAdmin) {
          const td = document.createElement('td');
          const delBtn = document.createElement('button');
          delBtn.className = 'btn btn-small';
          delBtn.textContent = 'Löschen';
          delBtn.onclick = () => {
            if (confirm('Betreuer wirklich löschen?')) {
              // remove from state
              state.betreuer = state.betreuer.filter(x => x.id !== b.id);
              // remove attendance references
              state.dienste.forEach(d => {
                if (d.betreuer) delete d.betreuer[b.id];
              });
              saveState();
              renderBetreuer();
            }
          };
          td.appendChild(delBtn);
          row.appendChild(td);
        }
        tbody.appendChild(row);
      });
      table.appendChild(tbody);
      content.appendChild(table);
    }
  }

  function renderStatistik() {
    const content = document.getElementById('content');
    content.innerHTML = '';
    const heading = document.createElement('h2');
    heading.textContent = 'Statistik';
    content.appendChild(heading);
    // compute global stats
    const dienstCount = state.dienste.length;
    let totalKinderSum = 0;
    let totalPresentSum = 0;
    let totalBetreuerSum = 0;
    let minKinder = Infinity;
    let maxKinder = 0;
    state.dienste.forEach(d => {
      let present = 0;
      state.kinder.forEach(k => {
        const st = d.attendance[k.id] || Status.ABWESEND;
        if (st === Status.ANWESEND) present++;
      });
      const kinderAnzahl = state.kinder.length;
      totalKinderSum += kinderAnzahl;
      totalPresentSum += present;
      if (present < minKinder) minKinder = present;
      if (present > maxKinder) maxKinder = present;
      totalBetreuerSum += Object.keys(d.betreuer || {}).length;
    });
    if (dienstCount === 0) {
      content.innerHTML += '<p>Noch keine Dienste vorhanden.</p>';
      return;
    }
    const avgKinder = (totalKinderSum / dienstCount).toFixed(1);
    const avgAnwesenQuote = ((totalPresentSum / (state.kinder.length * dienstCount)) * 100).toFixed(1);
    const avgBetreuer = (totalBetreuerSum / dienstCount).toFixed(1);
    const statsDiv = document.createElement('div');
    statsDiv.innerHTML = `<p><strong>Anzahl Dienste:</strong> ${dienstCount}</p>
      <p><strong>Ø Kinder pro Dienst:</strong> ${avgKinder}</p>
      <p><strong>Ø Anwesenheitsquote Kinder:</strong> ${avgAnwesenQuote}%</p>
      <p><strong>Min anwesende Kinder:</strong> ${minKinder}, <strong>Max:</strong> ${maxKinder}</p>
      <p><strong>Ø Betreuer pro Dienst:</strong> ${avgBetreuer}</p>`;
    content.appendChild(statsDiv);
    // Tabelle je Kind
    const table = document.createElement('table');
    const thead = document.createElement('thead');
    thead.innerHTML = '<tr><th>Kind</th><th>Anwesend</th><th>Entschuldigt</th><th>Abwesend</th><th>Quote</th></tr>';
    table.appendChild(thead);
    const tbody = document.createElement('tbody');
    state.kinder.forEach(k => {
      let a = 0, e = 0, ab = 0;
      state.dienste.forEach(d => {
        const st = d.attendance[k.id] || Status.ABWESEND;
        if (st === Status.ANWESEND) a++;
        else if (st === Status.ENTSCHULDIGT) e++;
        else ab++;
      });
      const total = a + e + ab;
      const quote = total > 0 ? ((a / total) * 100).toFixed(1) : '0';
      const row = document.createElement('tr');
      row.innerHTML = `<td>${k.firstName} ${k.lastName}</td><td>${a}</td><td>${e}</td><td>${ab}</td><td>${quote}%</td>`;
      tbody.appendChild(row);
    });
    table.appendChild(tbody);
    content.appendChild(table);
  }

  function renderBackup() {
    const content = document.getElementById('content');
    content.innerHTML = '';
    const heading = document.createElement('h2');
    heading.textContent = 'Backup & Wiederherstellung';
    content.appendChild(heading);
    if (!isAdmin) {
      content.innerHTML += '<p>Nur im Admin-Modus verfügbar.</p>';
      return;
    }
    const exportBtn = document.createElement('button');
    exportBtn.className = 'btn';
    exportBtn.textContent = 'Backup als JSON kopieren';
    exportBtn.onclick = () => {
      const json = JSON.stringify(state, null, 2);
      navigator.clipboard.writeText(json).then(() => {
        alert('JSON im Clipboard.');
      }, () => {
        alert('Kopieren fehlgeschlagen.');
      });
    };
    content.appendChild(exportBtn);
    // Import section
    const importBtn = document.createElement('button');
    importBtn.className = 'btn';
    importBtn.style.marginLeft = '1rem';
    importBtn.textContent = 'JSON importieren';
    importBtn.onclick = () => {
      const json = prompt('Bitte JSON-String einfügen:');
      if (json) {
        try {
          const data = JSON.parse(json);
          if (data && typeof data === 'object') {
            state = data;
            saveState();
            alert('Daten importiert.');
            setActiveTab('dienste');
          }
        } catch (e) {
          alert('Ungültiges JSON');
        }
      }
    };
    content.appendChild(importBtn);
    content.innerHTML += '<p style="margin-top:1rem;">Hinweis: JSON manuell kopieren/einfügen.</p>';
  }

  // Event listeners for nav
  function initNav() {
    document.getElementById('tab-dienste').onclick = () => setActiveTab('dienste');
    document.getElementById('tab-kinder').onclick = () => setActiveTab('kinder');
    document.getElementById('tab-betreuer').onclick = () => setActiveTab('betreuer');
    document.getElementById('tab-statistik').onclick = () => setActiveTab('statistik');
    document.getElementById('tab-backup').onclick = () => setActiveTab('backup');
    document.getElementById('tab-admin').onclick = adminLogin;
  }

  document.addEventListener('DOMContentLoaded', () => {
    initNav();
    updateAdminUI();
    setActiveTab('dienste');
  });
})();
