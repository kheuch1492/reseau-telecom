/* ============================================================
   Logique du site — navigation, recherche, filtres,
   commandes MML copiables, arbres de décision interactifs.
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {

  /* ---------- Barre de progression de lecture + retour en haut ---------- */
  const progressBar = document.getElementById('readingProgress');
  const backToTop = document.getElementById('backToTop');
  function onScroll() {
    const h = document.documentElement;
    const scrolled = h.scrollTop;
    const max = h.scrollHeight - h.clientHeight;
    if (progressBar) progressBar.style.width = max > 0 ? (scrolled / max * 100) + '%' : '0%';
    if (backToTop) backToTop.classList.toggle('show', scrolled > 500);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();
  if (backToTop) backToTop.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

  /* ---------- Service Worker (mode hors-ligne / PWA) ---------- */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => { /* ignore si non dispo */ });
    });
  }

  /* ---------- Menu mobile ---------- */
  const sidebar = document.getElementById('sidebar');
  const menuToggle = document.getElementById('menuToggle');
  menuToggle.addEventListener('click', () => sidebar.classList.toggle('open'));

  /* ---------- Thème sombre ---------- */
  const themeToggle = document.getElementById('themeToggle');
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
    themeToggle.textContent = '☀️ Mode clair';
  }
  themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('dark');
    const dark = document.body.classList.contains('dark');
    themeToggle.textContent = dark ? '☀️ Mode clair' : '🌙 Mode sombre';
    localStorage.setItem('theme', dark ? 'dark' : 'light');
  });

  /* ---------- Navigation : scroll-spy + clic ---------- */
  const navLinks = document.querySelectorAll('.nav-link');
  const sections = document.querySelectorAll('.section');

  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      if (window.innerWidth <= 900) sidebar.classList.remove('open');
    });
  });

  function markVisited(id) {
    const visited = new Set(JSON.parse(localStorage.getItem('visited') || '[]'));
    if (!visited.has(id)) {
      visited.add(id);
      localStorage.setItem('visited', JSON.stringify([...visited]));
    }
  }

  const spy = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(l => l.classList.toggle('active', l.getAttribute('href') === '#' + e.target.id));
        markVisited(e.target.id);
      }
    });
  }, { rootMargin: '-30% 0px -60% 0px' });
  sections.forEach(s => spy.observe(s));

  /* ---------- Recherche globale ---------- */
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) { searchResults.classList.remove('show'); return; }
    const matches = SEARCH_INDEX.filter(item => item.t.toLowerCase().includes(q) || item.c.toLowerCase().includes(q));
    if (matches.length === 0) {
      searchResults.innerHTML = '<div class="sr-empty">Aucun résultat</div>';
    } else {
      searchResults.innerHTML = matches.map(m =>
        `<a href="${m.h}"><span class="sr-cat">${m.c}</span><br>${m.t}</a>`
      ).join('');
    }
    searchResults.classList.add('show');
  });

  searchResults.addEventListener('click', e => {
    if (e.target.closest('a')) {
      searchResults.classList.remove('show');
      searchInput.value = '';
    }
  });
  document.addEventListener('click', e => {
    if (!e.target.closest('.search-box')) searchResults.classList.remove('show');
  });

  /* ---------- Toast ---------- */
  const toast = document.getElementById('toast');
  let toastTimer;
  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 1800);
  }

  /* ---------- Copie des commandes MML ---------- */
  document.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.copy;
      navigator.clipboard.writeText(cmd).then(
        () => showToast('Copié : ' + cmd),
        () => showToast('Copie impossible')
      );
    });
  });

  /* ---------- Filtre MML (catégorie + recherche) ---------- */
  const mmlRows = document.querySelectorAll('#mmlTable tbody tr');
  const mmlSearch = document.getElementById('mmlSearch');
  const fbtns = document.querySelectorAll('.fbtn');
  let mmlCat = 'all';

  function applyMmlFilter() {
    const q = mmlSearch.value.trim().toLowerCase();
    mmlRows.forEach(row => {
      const matchCat = mmlCat === 'all' || row.dataset.cat === mmlCat;
      const matchText = row.textContent.toLowerCase().includes(q);
      row.style.display = (matchCat && matchText) ? '' : 'none';
    });
  }
  fbtns.forEach(b => b.addEventListener('click', () => {
    fbtns.forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    mmlCat = b.dataset.cat;
    applyMmlFilter();
  }));
  mmlSearch.addEventListener('input', applyMmlFilter);

  /* ---------- Filtre alarmes par sévérité ---------- */
  const alarmCards = document.querySelectorAll('.alarm-card');
  document.querySelectorAll('.sbtn').forEach(b => {
    b.addEventListener('click', () => {
      document.querySelectorAll('.sbtn').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      const sev = b.dataset.sev;
      alarmCards.forEach(c => {
        c.classList.toggle('hidden', !(sev === 'all' || c.dataset.sev === sev));
      });
    });
  });

  /* ---------- Arbres de décision interactifs ---------- */
  const picker = document.getElementById('treePicker');
  const player = document.getElementById('treePlayer');
  const nodeEl = document.getElementById('treeNode');
  const breadcrumb = document.getElementById('treeBreadcrumb');
  const restartBtn = document.getElementById('treeRestart');
  const sevEmoji = { critical: '🔴', major: '🟠', minor: '🟡' };
  let currentTree = null;
  let path = [];

  // Construire les boutons de choix d'arbre
  DECISION_TREES.forEach(tree => {
    const btn = document.createElement('button');
    btn.className = 'tree-pick-btn';
    btn.style.borderLeftColor =
      tree.severity === 'critical' ? 'var(--critical)' :
      tree.severity === 'major' ? 'var(--major)' : 'var(--minor)';
    btn.innerHTML = `<strong>${sevEmoji[tree.severity]} ${tree.title}</strong><span>${tree.subtitle}</span>`;
    btn.addEventListener('click', () => startTree(tree));
    picker.appendChild(btn);
  });

  function startTree(tree) {
    currentTree = tree;
    path = [];
    picker.hidden = true;
    player.hidden = false;
    renderNode(tree.start);
    player.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderNode(nodeId) {
    const node = currentTree.nodes[nodeId];
    renderBreadcrumb();

    if (node.result) {
      nodeEl.innerHTML = `
        <div class="tree-result cause">
          <span class="res-label res-cause">🎯 Cause racine identifiée</span>
          <h4>${node.cause}</h4>
          <div class="res-action">
            <span class="res-label res-action-label">✅ Action à mener</span>
            <p>${node.action}</p>
          </div>
          <span class="res-escalade">👥 Escalade : ${node.escalade}</span>
        </div>`;
      return;
    }

    const opts = node.options.map((o, i) =>
      `<button class="tree-opt" data-next="${o.next}" data-label="${o.label.replace(/"/g, '&quot;')}">${o.label}</button>`
    ).join('');
    nodeEl.innerHTML = `
      <div class="tree-question">❓ ${node.question}</div>
      <div class="tree-options">${opts}</div>`;

    nodeEl.querySelectorAll('.tree-opt').forEach(b => {
      b.addEventListener('click', () => {
        path.push(b.dataset.label);
        renderNode(b.dataset.next);
      });
    });
  }

  function renderBreadcrumb() {
    const crumbs = [`<span class="crumb">${sevEmoji[currentTree.severity]} ${currentTree.title}</span>`]
      .concat(path.map(p => `<span class="crumb">${p}</span>`));
    breadcrumb.innerHTML = crumbs.join('');
  }

  restartBtn.addEventListener('click', () => {
    player.hidden = true;
    picker.hidden = false;
    picker.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });

  /* ---------- Stepper : processus de résolution d'incident ---------- */
  const stepper = document.getElementById('stepper');
  const stepDetail = document.getElementById('stepDetail');
  if (stepper && typeof INCIDENT_PROCESS !== 'undefined') {
    let activeStep = 0;

    INCIDENT_PROCESS.forEach((s, i) => {
      const b = document.createElement('button');
      b.className = 'step-btn' + (i === 0 ? ' active' : '');
      b.innerHTML = `<span class="step-ico">${s.icon}</span><span class="step-num">ÉTAPE ${s.phase}</span><span class="step-name">${s.title}</span>`;
      b.addEventListener('click', () => { activeStep = i; renderStep(); });
      stepper.appendChild(b);
    });

    function renderStep() {
      const s = INCIDENT_PROCESS[activeStep];
      stepper.querySelectorAll('.step-btn').forEach((b, i) => b.classList.toggle('active', i === activeStep));
      stepDetail.innerHTML = `
        <h3>${s.icon} Étape ${s.phase} — ${s.title}</h3>
        <p class="step-goal">🎯 ${s.goal}</p>
        <h5>Actions</h5>
        <ul>${s.actions.map(a => `<li>${a}</li>`).join('')}</ul>
        <div class="step-meta">
          <div class="step-meta-item">
            <div class="smi-label">🧰 Outils</div>
            <div class="step-tools">${s.tools.map(t => `<span class="step-tool">${t}</span>`).join('')}</div>
          </div>
          <div class="step-meta-item">
            <div class="smi-label">👥 Acteurs</div>
            <div class="smi-val">${s.actors}</div>
          </div>
          <div class="step-meta-item">
            <div class="smi-label">⏱️ Repère / SLA</div>
            <div class="smi-val">${s.sla}</div>
          </div>
        </div>
        <div class="step-output">➡️ <strong>Résultat :</strong> ${s.output}</div>
        <div class="step-nav">
          <button id="stepPrev" ${activeStep === 0 ? 'disabled' : ''}>← Étape précédente</button>
          <button id="stepNext" ${activeStep === INCIDENT_PROCESS.length - 1 ? 'disabled' : ''}>Étape suivante →</button>
        </div>`;
      const prev = document.getElementById('stepPrev');
      const next = document.getElementById('stepNext');
      if (prev) prev.addEventListener('click', () => { if (activeStep > 0) { activeStep--; renderStep(); } });
      if (next) next.addEventListener('click', () => { if (activeStep < INCIDENT_PROCESS.length - 1) { activeStep++; renderStep(); } });
    }
    renderStep();
  }

  /* ---------- Niveaux d'escalade ---------- */
  const escEl = document.getElementById('escalation');
  if (escEl && typeof ESCALATION !== 'undefined') {
    escEl.innerHTML = ESCALATION.map(e => `
      <div class="esc-card">
        <span class="esc-lvl">${e.lvl}</span>
        <h4>${e.name}</h4>
        <p>${e.role}</p>
        <div class="esc-ex"><strong>Ex :</strong> ${e.examples}</div>
      </div>`).join('');
  }

  /* ---------- Glossaire ---------- */
  const glossGrid = document.getElementById('glossaryGrid');
  const glossSearch = document.getElementById('glossarySearch');
  if (glossGrid && typeof GLOSSARY !== 'undefined') {
    glossGrid.innerHTML = GLOSSARY.map(g => `
      <div class="gloss-item" data-text="${(g.term + ' ' + g.def + ' ' + g.cat).toLowerCase()}">
        <span class="gloss-term">${g.term}</span><span class="gloss-cat">${g.cat}</span>
        <div class="gloss-def">${g.def}</div>
      </div>`).join('') + '<div class="gloss-empty" id="glossEmpty" style="display:none">Aucun terme trouvé.</div>';

    const glossItems = glossGrid.querySelectorAll('.gloss-item');
    const glossEmpty = document.getElementById('glossEmpty');
    glossSearch.addEventListener('input', () => {
      const q = glossSearch.value.trim().toLowerCase();
      let visible = 0;
      glossItems.forEach(it => {
        const show = it.dataset.text.includes(q);
        it.classList.toggle('hidden', !show);
        if (show) visible++;
      });
      glossEmpty.style.display = visible === 0 ? 'block' : 'none';
    });
  }

  /* ---------- Checklist (persistance localStorage) ---------- */
  const checklists = document.querySelectorAll('.checklist');
  checklists.forEach(list => {
    const key = 'cl-' + list.dataset.key;
    const saved = JSON.parse(localStorage.getItem(key) || '[]');
    const boxes = list.querySelectorAll('input[type="checkbox"]');
    boxes.forEach((box, i) => {
      if (saved[i]) box.checked = true;
      box.addEventListener('change', () => {
        const state = Array.from(boxes).map(b => b.checked);
        localStorage.setItem(key, JSON.stringify(state));
      });
    });
  });
  const resetCl = document.getElementById('resetChecklist');
  if (resetCl) resetCl.addEventListener('click', () => {
    checklists.forEach(list => {
      localStorage.removeItem('cl-' + list.dataset.key);
      list.querySelectorAll('input[type="checkbox"]').forEach(b => b.checked = false);
    });
    showToast('Cases réinitialisées');
  });

  /* ---------- Cas pratiques (accordéon) ---------- */
  const casesEl = document.getElementById('cases');
  if (casesEl && typeof CASE_STUDIES !== 'undefined') {
    const kpiLines = arr => arr.map(x =>
      `<div class="kpi-line"><span>${x.k}</span><span class="kv ${x.ok ? 'good' : 'bad'}">${x.v}</span></div>`
    ).join('');

    casesEl.innerHTML = CASE_STUDIES.map(c => `
      <div class="case-card ${c.sev}" data-id="${c.id}">
        <div class="case-head">
          <span class="case-tag">${c.tag}</span>
          <span class="case-title">${c.title}</span>
          <span class="case-toggle">▼</span>
        </div>
        <div class="case-body">
          <div class="case-section-label">📍 Contexte</div>
          <p class="case-context">${c.context}</p>
          <div class="case-section-label">⚠️ Symptôme</div>
          <div class="case-symptom">${c.symptom}</div>
          <div class="case-section-label">📊 KPI avant / après</div>
          <div class="kpi-compare">
            <div class="kpi-col before"><h6>🔴 Avant</h6>${kpiLines(c.kpisBefore)}</div>
            <div class="kpi-col after"><h6>🟢 Après</h6>${kpiLines(c.kpisAfter)}</div>
          </div>
          <div class="case-section-label">🔍 Démarche de diagnostic</div>
          <ul class="case-steps">${c.steps.map(s => `<li>${s}</li>`).join('')}</ul>
          <div class="case-section-label">🎯 Cause racine</div>
          <div class="case-cause">${c.cause}</div>
          <div class="case-section-label">✅ Action</div>
          <div class="case-action">${c.action}</div>
          <div class="case-footer">
            <span class="case-chip">⏱️ ${c.duration}</span>
            <span class="case-chip">👥 ${c.escalade}</span>
          </div>
        </div>
      </div>`).join('');

    casesEl.querySelectorAll('.case-head').forEach(head => {
      head.addEventListener('click', () => head.parentElement.classList.toggle('open'));
    });
  }

  /* ---------- Générations & 5G ---------- */
  const genBody = document.querySelector('#genTable tbody');
  if (genBody && typeof GENERATIONS !== 'undefined') {
    const cls = { '2G': 'gen-2g', '3G': 'gen-3g', '4G / LTE': 'gen-4g', '5G': 'gen-5g' };
    genBody.innerHTML = GENERATIONS.map(g => `
      <tr>
        <td><span class="gen-badge ${cls[g.gen] || 'gen-4g'}">${g.gen}</span></td>
        <td>${g.years}</td><td>${g.usage}</td><td>${g.debit}</td>
        <td><code>${g.station}</code></td><td>${g.core}</td>
      </tr>`).join('');
    const note = document.getElementById('genNote');
    if (note) note.innerHTML = '💡 ' + GENERATIONS.map(g => `<strong>${g.gen}</strong> : ${g.note}`).join(' · ');
  }
  const fivegGrid = document.getElementById('fivegGrid');
  if (fivegGrid && typeof FIVEG_FOCUS !== 'undefined') {
    fivegGrid.innerHTML = FIVEG_FOCUS.map(f => `
      <div class="fiveg-item"><h4>${f.t}</h4><p>${f.d}</p></div>`).join('');
  }

  /* ---------- Commandes MML détaillées ---------- */
  const mmlDetailed = document.getElementById('mmlDetailed');
  if (mmlDetailed && typeof MML_DETAILED !== 'undefined') {
    mmlDetailed.innerHTML = MML_DETAILED.map(m => `
      <div class="mml-d-item">
        <div class="mml-d-cmd"><code>${m.cmd}</code><button class="copy-btn" data-copy="${m.cmd.replace(/"/g, '&quot;')}">📋</button></div>
        <div class="mml-d-desc">${m.desc}</div>
        <span class="mml-d-out-label">Exemple de sortie</span>
        <div class="mml-d-out">${m.output}</div>
      </div>`).join('');
    mmlDetailed.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        navigator.clipboard.writeText(btn.dataset.copy).then(
          () => showToast('Copié : ' + btn.dataset.copy),
          () => showToast('Copie impossible')
        );
      });
    });
  }

  /* ---------- Correspondance alarmes Huawei/Nokia ---------- */
  const mappingBody = document.querySelector('#mappingTable tbody');
  if (mappingBody && typeof ALARM_MAPPING !== 'undefined') {
    mappingBody.innerHTML = ALARM_MAPPING.map(m => `
      <tr>
        <td><strong>${m.type}</strong></td>
        <td>${m.huawei}</td><td>${m.nokia}</td>
        <td><span class="map-sev ${m.sev}">${m.sev}</span></td>
      </tr>`).join('');
  }

  /* ---------- KPI enrichi ---------- */
  const kpiBody = document.querySelector('#kpiTable tbody');
  if (kpiBody && typeof KPI_LIST !== 'undefined') {
    kpiBody.innerHTML = KPI_LIST.map(k => `
      <tr>
        <td><strong>${k.kpi}</strong></td>
        <td>${k.name}</td>
        <td><code>${k.formula}</code></td>
        <td><span class="kpi-target">${k.target}</span></td>
        <td>${k.reveals}</td>
      </tr>`).join('');
  }

  /* ---------- Optimisation radio ---------- */
  const optimGrid = document.getElementById('optimGrid');
  if (optimGrid && typeof OPTIM !== 'undefined') {
    optimGrid.innerHTML = OPTIM.map(o => `
      <div class="optim-card">
        <h4>🎚️ ${o.lever}</h4>
        <div class="optim-row"><span class="or-label">Quoi :</span> ${o.what}</div>
        <div class="optim-row"><span class="or-label">Quand :</span> ${o.when}</div>
        <div class="optim-row risk"><span class="or-label">⚠️ Risque :</span> ${o.risk}</div>
      </div>`).join('');
  }

  /* ---------- Préparation entretien ---------- */
  const ivList = document.getElementById('interviewList');
  const ivFilter = document.getElementById('interviewFilter');
  if (ivList && typeof INTERVIEW !== 'undefined') {
    const cats = ['Toutes', ...Array.from(new Set(INTERVIEW.map(i => i.cat)))];
    ivFilter.innerHTML = cats.map((c, i) =>
      `<button class="iv-fbtn ${i === 0 ? 'active' : ''}" data-cat="${c}">${c}</button>`
    ).join('');

    ivList.innerHTML = INTERVIEW.map(i => `
      <div class="iv-item" data-cat="${i.cat}">
        <div class="iv-q">
          <span class="iv-cat">${i.cat}</span>
          <span class="iv-qtext">${i.q}</span>
          <span class="iv-toggle">▼</span>
        </div>
        <div class="iv-a">
          <div class="iv-a-inner"><span class="iv-a-label">💬 Réponse modèle</span>${i.a}</div>
        </div>
      </div>`).join('');

    ivList.querySelectorAll('.iv-q').forEach(q => {
      q.addEventListener('click', () => q.parentElement.classList.toggle('open'));
    });
    ivFilter.querySelectorAll('.iv-fbtn').forEach(b => {
      b.addEventListener('click', () => {
        ivFilter.querySelectorAll('.iv-fbtn').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        const c = b.dataset.cat;
        ivList.querySelectorAll('.iv-item').forEach(it => {
          it.classList.toggle('hidden', !(c === 'Toutes' || it.dataset.cat === c));
        });
      });
    });
  }

  /* ---------- Impression / PDF d'une section ---------- */
  document.querySelectorAll('.print-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.dataset.print);
      if (!target) { window.print(); return; }
      document.body.classList.add('printing');
      target.classList.add('print-target');
      window.print();
      setTimeout(() => {
        document.body.classList.remove('printing');
        target.classList.remove('print-target');
      }, 500);
    });
  });

  /* ---------- Quiz de révision ---------- */
  if (typeof QUIZ !== 'undefined') {
    const quizStart = document.getElementById('quizStart');
    const quizPlay = document.getElementById('quizPlay');
    const quizResult = document.getElementById('quizResult');
    const quizCount = document.getElementById('quizCount');
    const quizStartBtn = document.getElementById('quizStartBtn');
    const quizBar = document.getElementById('quizBar');
    const quizPos = document.getElementById('quizPos');
    const quizScore = document.getElementById('quizScore');
    const quizQuestion = document.getElementById('quizQuestion');
    const quizOptions = document.getElementById('quizOptions');
    const quizFeedback = document.getElementById('quizFeedback');
    const quizNext = document.getElementById('quizNext');

    quizCount.textContent = QUIZ.length;
    let qIndex = 0, score = 0, answered = false;

    quizStartBtn.addEventListener('click', () => {
      qIndex = 0; score = 0;
      quizStart.hidden = true;
      quizResult.hidden = true;
      quizPlay.hidden = false;
      renderQuestion();
    });

    function renderQuestion() {
      answered = false;
      const item = QUIZ[qIndex];
      quizBar.style.width = ((qIndex) / QUIZ.length * 100) + '%';
      quizPos.textContent = `Question ${qIndex + 1} / ${QUIZ.length}`;
      quizScore.textContent = `Score : ${score}`;
      quizQuestion.textContent = item.q;
      quizFeedback.hidden = true;
      quizNext.hidden = true;
      quizOptions.innerHTML = item.options.map((o, i) =>
        `<button class="quiz-opt" data-i="${i}">${o}</button>`
      ).join('');
      quizOptions.querySelectorAll('.quiz-opt').forEach(btn => {
        btn.addEventListener('click', () => selectAnswer(parseInt(btn.dataset.i)));
      });
    }

    function selectAnswer(i) {
      if (answered) return;
      answered = true;
      const item = QUIZ[qIndex];
      const opts = quizOptions.querySelectorAll('.quiz-opt');
      opts.forEach((b, idx) => {
        b.disabled = true;
        if (idx === item.correct) b.classList.add('correct');
        else if (idx === i) b.classList.add('wrong');
      });
      const ok = i === item.correct;
      if (ok) score++;
      quizScore.textContent = `Score : ${score}`;
      quizFeedback.className = 'quiz-feedback ' + (ok ? 'ok' : 'ko');
      quizFeedback.innerHTML = (ok ? '✅ <strong>Correct !</strong> ' : '❌ <strong>Incorrect.</strong> ') + item.explain;
      quizFeedback.hidden = false;
      quizNext.hidden = false;
      quizNext.textContent = (qIndex === QUIZ.length - 1) ? 'Voir mon résultat 🏁' : 'Question suivante →';
    }

    quizNext.addEventListener('click', () => {
      if (qIndex < QUIZ.length - 1) { qIndex++; renderQuestion(); }
      else showResult();
    });

    function showResult() {
      quizPlay.hidden = true;
      quizResult.hidden = false;
      const pct = Math.round(score / QUIZ.length * 100);
      let badge, label, msg;
      if (pct >= 80) { badge = 'gold'; label = '🏆 Excellent'; msg = "Tu maîtrises les bases — prêt pour aller plus loin (HCIP) !"; }
      else if (pct >= 50) { badge = 'silver'; label = '👍 Bien'; msg = "Bonne base ! Revois les sections où tu as hésité."; }
      else { badge = 'bronze'; label = '📚 À revoir'; msg = "Reprends les sections Alarmes, MML et Processus, puis retente."; }
      quizResult.innerHTML = `
        <h3>Résultat du quiz</h3>
        <div class="quiz-score-big">${score}/${QUIZ.length}</div>
        <div class="quiz-badge ${badge}">${label} — ${pct}%</div>
        <p>${msg}</p>
        <button class="btn btn-primary" id="quizRetry">↺ Recommencer</button>`;
      document.getElementById('quizRetry').addEventListener('click', () => {
        quizStartBtn.click();
        document.getElementById('quiz').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      const best = parseInt(localStorage.getItem('quizBest') || '0');
      if (score > best) localStorage.setItem('quizBest', String(score));
    }
  }

  /* ---------- Marché détaillé (chiffres clés) ---------- */
  const figuresGrid = document.getElementById('figuresGrid');
  if (figuresGrid && typeof KEY_FIGURES !== 'undefined') {
    figuresGrid.innerHTML = KEY_FIGURES.map(f => `
      <div class="figure-card">
        <div class="figure-value">${f.value}</div>
        <div class="figure-label">${f.label}</div>
        <div class="figure-sub">${f.sub}</div>
      </div>`).join('');
  }

  /* ---------- Comparatif opérateurs ---------- */
  const opMarketBody = document.querySelector('#opMarketTable tbody');
  if (opMarketBody && typeof OP_MARKET !== 'undefined') {
    opMarketBody.innerHTML = OP_MARKET.map(o => `
      <tr>
        <td><span class="op-dot" style="background:${o.color}"></span><strong>${o.op}</strong></td>
        <td>${o.share}</td><td>${o.traffic}</td>
      </tr>`).join('');
    const bars = document.getElementById('opMarketBars');
    if (bars) {
      bars.innerHTML = OP_MARKET.map(o => {
        const pct = parseFloat(o.share.replace(',', '.')) || 0;
        return `<div class="op-bar-row">
          <span class="op-bar-label">${o.op}</span>
          <div class="op-bar-track"><div class="op-bar-fill" style="width:${pct}%;background:${o.color}">${o.share}</div></div>
        </div>`;
      }).join('');
    }
  }
  const opQosBody = document.querySelector('#opQosTable tbody');
  if (opQosBody && typeof OP_QOS !== 'undefined') {
    const cell = v => v === 'ok' ? '<span class="qos-ok">✅</span>' : '<span class="qos-ko">❌</span>';
    opQosBody.innerHTML = OP_QOS.map(o => `
      <tr>
        <td><strong>${o.op}</strong></td>
        <td>${cell(o.reussite)}</td><td>${cell(o.delai)}</td><td>${cell(o.mos)}</td>
        <td>${cell(o.sms)}</td><td>${cell(o.data)}</td>
      </tr>`).join('');
  }

  /* ---------- Seuils Drive Test par techno ---------- */
  const dtServiceBody = document.querySelector('#dtServiceTable tbody');
  if (dtServiceBody && typeof DT_SERVICE !== 'undefined') {
    dtServiceBody.innerHTML = DT_SERVICE.map(d => `
      <tr>
        <td><span class="gen-badge ${d.cls}">${d.gen}</span></td>
        <td><span class="kpi-target">${d.cssr}</span></td>
        <td><span class="kpi-target">${d.dcr}</span></td>
        <td>${d.setup}</td><td>${d.mos}</td><td>${d.dl}</td>
      </tr>`).join('');
  }
  const dtRadioBody = document.querySelector('#dtRadioTable tbody');
  if (dtRadioBody && typeof DT_RADIO !== 'undefined') {
    dtRadioBody.innerHTML = DT_RADIO.map(d => `
      <tr>
        <td><span class="gen-badge ${d.cls}">${d.gen}</span></td>
        <td><code>${d.covName}</code></td>
        <td style="color:#2ea043;font-weight:600">${d.covGood}</td>
        <td style="color:var(--critical);font-weight:600">${d.covBad}</td>
        <td><code>${d.qualName}</code></td>
        <td style="color:#2ea043;font-weight:600">${d.qualGood}</td>
        <td style="color:var(--critical);font-weight:600">${d.qualBad}</td>
      </tr>`).join('');
  }

  /* ---------- Simulateur NOC (tri d'alarmes chronométré) ---------- */
  if (typeof SIM_ALARMS !== 'undefined') {
    const simStart = document.getElementById('simStart');
    const simPlay = document.getElementById('simPlay');
    const simResult = document.getElementById('simResult');
    const simStartBtn = document.getElementById('simStartBtn');
    const simAlarmsEl = document.getElementById('simAlarms');
    const simOrderEl = document.getElementById('simOrder');
    const simTimeEl = document.getElementById('simTime');
    const simRoundEl = document.getElementById('simRound');
    const simScoreEl = document.getElementById('simScore');
    const simBest = document.getElementById('simBest');
    const sevEmojiS = { critical: '🔴', major: '🟠', minor: '🟡' };
    const TOTAL_ROUNDS = 3;
    let round, score, errors, timer, t0, remaining;

    function showBest() {
      const b = localStorage.getItem('simBest');
      simBest.textContent = b ? `🏅 Meilleur temps : ${b}s` : '';
    }
    showBest();

    simStartBtn.addEventListener('click', () => {
      round = 1; score = 0; errors = 0;
      simStart.hidden = true; simResult.hidden = true; simPlay.hidden = false;
      t0 = Date.now();
      clearInterval(timer);
      timer = setInterval(() => { simTimeEl.textContent = ((Date.now() - t0) / 1000).toFixed(1); }, 100);
      startRound();
    });

    function startRound() {
      simRoundEl.textContent = round;
      simScoreEl.textContent = score;
      simOrderEl.innerHTML = '';
      // choisir 5 alarmes aléatoires
      const pool = [...SIM_ALARMS].sort(() => Math.random() - 0.5).slice(0, 5);
      remaining = [...pool].sort((a, b) => b.weight - a.weight); // ordre attendu
      renderAlarms(pool);
    }

    function renderAlarms(list) {
      simAlarmsEl.innerHTML = '';
      list.forEach(a => {
        const btn = document.createElement('button');
        btn.className = 'sim-alarm';
        btn.innerHTML = `<span class="sim-dot">${sevEmojiS[a.sev]}</span> ${a.name}`;
        btn.addEventListener('click', () => pick(a, btn, list));
        simAlarmsEl.appendChild(btn);
      });
    }

    function pick(a, btn, list) {
      const expected = remaining[0];
      if (a.name === expected.name) {
        score++;
        simScoreEl.textContent = score;
        remaining.shift();
        const chip = document.createElement('span');
        chip.className = 'sim-order-chip';
        chip.textContent = `${sevEmojiS[a.sev]} ${a.name}`;
        simOrderEl.appendChild(chip);
        btn.remove();
        if (remaining.length === 0) {
          if (round < TOTAL_ROUNDS) { round++; startRound(); }
          else endSim();
        }
      } else {
        errors++;
        btn.classList.add('flash-wrong');
        setTimeout(() => btn.classList.remove('flash-wrong'), 300);
      }
    }

    function endSim() {
      clearInterval(timer);
      const total = ((Date.now() - t0) / 1000).toFixed(1);
      simPlay.hidden = true; simResult.hidden = false;
      const prevBest = parseFloat(localStorage.getItem('simBest') || '99999');
      let record = '';
      if (parseFloat(total) < prevBest) { localStorage.setItem('simBest', total); record = '🎉 Nouveau record !'; }
      simResult.innerHTML = `
        <h3>Simulation terminée</h3>
        <div class="sim-time-big">${total}s</div>
        <p>✅ ${score} alarmes bien triées · ❌ ${errors} erreur(s) · ${TOTAL_ROUNDS} manches</p>
        <p>${record || 'Continue à t&rsquo;entraîner pour battre ton record !'}</p>
        <button class="btn btn-primary" id="simRetry">↺ Rejouer</button>`;
      document.getElementById('simRetry').addEventListener('click', () => simStartBtn.click());
      showBest();
    }
  }

  /* ---------- Calculateur de KPI ---------- */
  const calcGrid = document.getElementById('calcGrid');
  if (calcGrid) {
    const CALCS = [
      { id: 'cssr', name: 'CSSR — Call Setup Success Rate', formula: '(établis / tentatives) × 100', a: 'Appels établis', b: 'Tentatives d\'appel', target: 98, dir: 'min', unit: '%', targetTxt: '> 98 %' },
      { id: 'dcr', name: 'DCR — Drop Call Rate', formula: '(coupés / établis) × 100', a: 'Appels coupés', b: 'Appels établis', target: 2, dir: 'max', unit: '%', targetTxt: '< 2 %' },
      { id: 'hosr', name: 'HOSR — Handover Success Rate', formula: '(réussis / tentés) × 100', a: 'Handovers réussis', b: 'Handovers tentés', target: 97, dir: 'min', unit: '%', targetTxt: '> 97 %' },
      { id: 'avail', name: 'Availability — Disponibilité', formula: '(temps en service / total) × 100', a: 'Minutes en service', b: 'Minutes totales', target: 99.5, dir: 'min', unit: '%', targetTxt: '> 99,5 %' }
    ];
    calcGrid.innerHTML = CALCS.map(c => `
      <div class="calc-card" data-id="${c.id}">
        <h4>${c.name}</h4>
        <div class="calc-formula">${c.formula} · cible ${c.targetTxt}</div>
        <div class="calc-inputs">
          <label>${c.a}<input type="number" min="0" data-role="a" placeholder="ex. 970"></label>
          <label>${c.b}<input type="number" min="0" data-role="b" placeholder="ex. 1000"></label>
        </div>
        <div class="calc-result">
          <div class="calc-value neutral" data-role="val">—</div>
          <div class="calc-verdict" data-role="verdict">Entre les valeurs</div>
          <div class="calc-target">Seuil : ${c.targetTxt}</div>
        </div>
      </div>`).join('');

    CALCS.forEach(c => {
      const card = calcGrid.querySelector(`[data-id="${c.id}"]`);
      const inA = card.querySelector('[data-role="a"]');
      const inB = card.querySelector('[data-role="b"]');
      const val = card.querySelector('[data-role="val"]');
      const verdict = card.querySelector('[data-role="verdict"]');
      function compute() {
        const a = parseFloat(inA.value), b = parseFloat(inB.value);
        if (isNaN(a) || isNaN(b) || b <= 0) { val.textContent = '—'; val.className = 'calc-value neutral'; verdict.textContent = 'Entre les valeurs'; return; }
        const pct = (a / b) * 100;
        const ok = c.dir === 'min' ? pct >= c.target : pct <= c.target;
        val.textContent = pct.toFixed(2) + c.unit;
        val.className = 'calc-value ' + (ok ? 'good' : 'bad');
        verdict.textContent = ok ? '✅ Conforme à la cible' : '❌ Hors cible — à traiter';
      }
      inA.addEventListener('input', compute);
      inB.addEventListener('input', compute);
    });
  }

  /* ---------- Flashcards ---------- */
  const flashcard = document.getElementById('flashcard');
  if (flashcard && typeof GLOSSARY !== 'undefined') {
    const decks = {
      glossaire: GLOSSARY.map(g => ({ front: g.term, back: g.def, hint: g.cat })),
      mml: (typeof MML_DETAILED !== 'undefined' ? MML_DETAILED : []).map(m => ({ front: m.cmd, back: m.desc, hint: 'Commande MML' }))
    };
    const flashFront = document.getElementById('flashFront');
    const flashBack = document.getElementById('flashBack');
    const flashCounter = document.getElementById('flashCounter');
    let deck = 'glossaire', cards = decks.glossaire.slice(), idx = 0;

    function renderCard() {
      flashcard.classList.remove('flipped');
      const c = cards[idx];
      flashFront.innerHTML = `<div class="fc-term">${c.front}</div><div class="fc-hint">${c.hint} · clique pour retourner</div>`;
      flashBack.innerHTML = `<div class="fc-def">${c.back}</div>`;
      flashCounter.textContent = `${idx + 1} / ${cards.length}`;
    }
    flashcard.addEventListener('click', () => flashcard.classList.toggle('flipped'));
    document.getElementById('flashNext').addEventListener('click', () => { idx = (idx + 1) % cards.length; renderCard(); });
    document.getElementById('flashPrev').addEventListener('click', () => { idx = (idx - 1 + cards.length) % cards.length; renderCard(); });
    document.getElementById('flashShuffle').addEventListener('click', () => { cards.sort(() => Math.random() - 0.5); idx = 0; renderCard(); showToast('Cartes mélangées'); });
    document.querySelectorAll('.flash-deck').forEach(b => {
      b.addEventListener('click', () => {
        document.querySelectorAll('.flash-deck').forEach(x => x.classList.remove('active'));
        b.classList.add('active');
        deck = b.dataset.deck;
        cards = decks[deck].slice(); idx = 0; renderCard();
      });
    });
    renderCard();
  }

  /* ---------- Ressources & progression ---------- */
  const resourcesGrid = document.getElementById('resourcesGrid');
  if (resourcesGrid && typeof RESOURCES !== 'undefined') {
    resourcesGrid.innerHTML = RESOURCES.map(r => `
      <a class="res-card" href="${r.url}" target="_blank" rel="noopener noreferrer">
        <span class="res-cat">${r.cat}</span>
        <h4>${r.title}</h4>
        <p>${r.desc}</p>
        <span class="res-link">${r.url} ↗</span>
      </a>`).join('');
  }

  const progressDash = document.getElementById('progressDash');
  if (progressDash) {
    function renderProgress() {
      const totalSections = document.querySelectorAll('.section').length;
      const visited = JSON.parse(localStorage.getItem('visited') || '[]').length;
      const pct = Math.round(visited / totalSections * 100);
      const quizBest = localStorage.getItem('quizBest');
      const quizTotal = (typeof QUIZ !== 'undefined') ? QUIZ.length : 12;
      const simBest = localStorage.getItem('simBest');
      progressDash.innerHTML = `
        <div class="prog-card">
          <div class="prog-num">${pct}%</div>
          <div class="prog-label">Sections explorées (${visited}/${totalSections})</div>
          <div class="prog-bar"><div class="prog-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="prog-card">
          <div class="prog-num">${quizBest ? quizBest + '/' + quizTotal : '—'}</div>
          <div class="prog-label">Meilleur score au quiz</div>
        </div>
        <div class="prog-card">
          <div class="prog-num">${simBest ? simBest + 's' : '—'}</div>
          <div class="prog-label">Meilleur temps simulateur</div>
        </div>`;
      const rst = document.createElement('button');
      rst.className = 'btn btn-ghost prog-reset';
      rst.style.cssText = 'color:var(--text);border-color:var(--border)';
      rst.textContent = '↺ Réinitialiser ma progression';
      rst.addEventListener('click', () => {
        ['visited', 'quizBest', 'simBest'].forEach(k => localStorage.removeItem(k));
        renderProgress(); showToast('Progression réinitialisée');
      });
      progressDash.appendChild(rst);
    }
    renderProgress();
    document.querySelector('.nav-link[href="#ressources"]')?.addEventListener('click', () => setTimeout(renderProgress, 300));
  }

});
