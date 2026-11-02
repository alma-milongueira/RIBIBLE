/* Bíblia do Empreendedor — app */
(() => {
  'use strict';

  // ================= Estado =================
  const KEY = 'bde:v1';
  const TOTAL_CHAPTERS = BOOKS.reduce((s, b) => s + b.c, 0);
  const TRANSLATIONS = {
    kjv: { short: 'KJV', name: 'King James Version (1611)' },
    almeida: { short: 'ALM', name: 'João Ferreira de Almeida' },
  };
  const defaults = {
    settings: { apiKey: '', model: 'gemini-flash-latest', translation: 'kjv', goal: 3, handle: '', aiPosts: true, fontSize: 21, theme: 'dark', accent: '#d4af37' },
    read: {},          // { GEN: [1,2,3] }
    readLog: {},       // { '2026-11-02': 3 }
    last: { book: 'GEN', ch: 1 },
    tasksDone: {},     // { '2026-11-02': ['t1'] }
    chat: [],          // [{ role: 'user'|'model', text }]
    creative: null,    // { date, quote, ref, tag, caption, source, bg }
  };
  let S = load();

  function load() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
      return { ...structuredClone(defaults), ...raw, settings: { ...defaults.settings, ...(raw.settings || {}) } };
    } catch { return structuredClone(defaults); }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn(e); }
  }

  // ================= Utilidades =================
  const $ = (sel, el = document) => el.querySelector(sel);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const bookById = (id) => BOOKS.find((b) => b.id === id);
  const pad = (n) => String(n).padStart(2, '0');
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dayNum = (d = new Date()) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
  const weekNum = () => Math.floor((dayNum() + 3) / 7);
  const pick = (arr, n) => arr[((n % arr.length) + arr.length) % arr.length];
  const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const WEEKDAYS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  const longDate = (d = new Date()) => `${WEEKDAYS[d.getDay()]}, ${d.getDate()} de ${MONTHS[d.getMonth()]}`;
  const shortDate = (d = new Date()) => `${d.getDate()} de ${MONTHS[d.getMonth()]}`;

  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove('show'), 2200);
  }

  // ================= Tema e cores =================
  const ACCENTS = [
    { c: '#d4af37', n: 'Dourado' }, { c: '#c0c0c0', n: 'Prata' }, { c: '#e8a59a', n: 'Rosé' },
    { c: '#cd7f32', n: 'Bronze' }, { c: '#3fa7ff', n: 'Azul' }, { c: '#2ecc71', n: 'Esmeralda' },
    { c: '#e0115f', n: 'Rubi' }, { c: '#9b6dff', n: 'Roxo' },
  ];
  function lum(hex) {
    const [r, g, b] = Creative.hexRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }
  function applyTheme() {
    const acc = /^#[0-9a-f]{6}$/i.test(S.settings.accent) ? S.settings.accent : '#d4af37';
    const light = S.settings.theme === 'light';
    const root = document.documentElement;
    root.dataset.theme = light ? 'light' : 'dark';
    let text = acc;
    if (light) { for (let t = 0.2; lum(text) > 0.16 && t < 0.95; t += 0.08) text = Creative.mix(acc, '#000000', t); }
    else { for (let t = 0.15; lum(text) < 0.28 && t < 0.95; t += 0.08) text = Creative.mix(acc, '#ffffff', t); }
    const lightV = Creative.mix(acc, '#ffffff', 0.45), darkV = Creative.mix(acc, '#000000', 0.38);
    root.style.setProperty('--gold', text);
    root.style.setProperty('--acc-rgb', Creative.hexRgb(text).join(', '));
    root.style.setProperty('--grad', `linear-gradient(135deg, ${lightV} 0%, ${acc} 45%, ${darkV} 100%)`);
    root.style.setProperty('--on-acc', lum(acc) > 0.35 ? '#111' : '#fff');
    document.querySelector('meta[name=theme-color]')?.setAttribute('content', light ? '#ffffff' : '#000000');
    Creative.setAccent(acc);
  }
  applyTheme();
  document.getElementById('theme-toggle')?.addEventListener('click', () => {
    S.settings.theme = S.settings.theme === 'light' ? 'dark' : 'light';
    save(); applyTheme(); go(current, { keepScroll: true });
  });

  // ================= Compartilhar =================
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  function waText(text) {
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener');
  }

  function openSheet(html) {
    $('#sheet').innerHTML = `<div class="grabber"></div>${html}`;
    $('#sheet').classList.add('open');
    $('#sheet-backdrop').classList.add('open');
  }
  function closeSheet() {
    $('#sheet').classList.remove('open');
    $('#sheet-backdrop').classList.remove('open');
  }
  $('#sheet-backdrop').addEventListener('click', closeSheet);

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast('Copiado!'); }
    catch {
      const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); ta.remove(); toast('Copiado!');
    }
  }

  function md(text) {
    // Markdown simples e seguro
    const lines = esc(text).split('\n');
    let html = '', list = null;
    const inline = (s) => s.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
    const closeList = () => { if (list) { html += `</${list}>`; list = null; } };
    for (const raw of lines) {
      const l = raw.trim();
      if (!l) { closeList(); continue; }
      let m;
      if ((m = l.match(/^[-*•]\s+(.*)/))) { if (list !== 'ul') { closeList(); html += '<ul>'; list = 'ul'; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = l.match(/^\d+[.)]\s+(.*)/))) { if (list !== 'ol') { closeList(); html += '<ol>'; list = 'ol'; } html += `<li>${inline(m[1])}</li>`; }
      else if ((m = l.match(/^&gt;\s?(.*)/))) { closeList(); html += `<blockquote>${inline(m[1])}</blockquote>`; }
      else if ((m = l.match(/^#{1,4}\s+(.*)/))) { closeList(); html += `<p><strong>${inline(m[1])}</strong></p>`; }
      else { closeList(); html += `<p>${inline(l)}</p>`; }
    }
    closeList();
    return html;
  }

  // ================= Progresso =================
  const readCount = () => Object.values(S.read).reduce((s, a) => s + a.length, 0);
  const isRead = (book, ch) => (S.read[book] || []).includes(ch);
  function markRead(book, ch) {
    if (isRead(book, ch)) return false;
    (S.read[book] = S.read[book] || []).push(ch);
    const k = dateKey();
    S.readLog[k] = (S.readLog[k] || 0) + 1;
    save();
    return true;
  }
  function unmarkRead(book, ch) {
    S.read[book] = (S.read[book] || []).filter((c) => c !== ch);
    save();
  }
  function streak() {
    let n = 0;
    const d = new Date();
    if (!S.readLog[dateKey(d)]) d.setDate(d.getDate() - 1);
    while (S.readLog[dateKey(d)]) { n++; d.setDate(d.getDate() - 1); }
    return n;
  }
  function nextChapter(book, ch) {
    const i = BOOKS.findIndex((b) => b.id === book);
    if (ch < BOOKS[i].c) return { book, ch: ch + 1 };
    if (i < BOOKS.length - 1) return { book: BOOKS[i + 1].id, ch: 1 };
    return null;
  }
  function prevChapter(book, ch) {
    const i = BOOKS.findIndex((b) => b.id === book);
    if (ch > 1) return { book, ch: ch - 1 };
    if (i > 0) return { book: BOOKS[i - 1].id, ch: BOOKS[i - 1].c };
    return null;
  }
  function continueTarget() {
    // último capítulo aberto; se já lido, o próximo não lido
    let p = { ...S.last };
    let guard = 0;
    while (p && isRead(p.book, p.ch) && guard++ < TOTAL_CHAPTERS) p = nextChapter(p.book, p.ch);
    return p || { book: 'GEN', ch: 1 };
  }

  function ring(pct) {
    const r = 40, c = 2 * Math.PI * r;
    return `<svg class="ring" viewBox="0 0 100 100">
      <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" style="stop-color:var(--gold-light)"/><stop offset="1" style="stop-color:var(--gold)"/></linearGradient></defs>
      <circle cx="50" cy="50" r="${r}" fill="none" style="stroke:rgba(var(--acc-rgb),.14)" stroke-width="8"/>
      <circle cx="50" cy="50" r="${r}" fill="none" stroke="url(#rg)" stroke-width="8" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct / 100)}" transform="rotate(-90 50 50)"/>
      <text x="50" y="55" text-anchor="middle" style="fill:var(--gold-light)" font-size="18" font-weight="700">${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%</text>
    </svg>`;
  }

  // ================= Tarefas =================
  function todaysTasks() {
    const rng = Creative.mulberry32(dayNum() * 13 + 5);
    const pool = [...TASKS];
    const out = [];
    const cats = new Set();
    while (out.length < 3 && pool.length) {
      const i = Math.floor(rng() * pool.length);
      const t = pool.splice(i, 1)[0];
      if (cats.has(t.cat) && pool.length > 10) continue;
      cats.add(t.cat); out.push(t);
    }
    return out;
  }
  const doneToday = () => S.tasksDone[dateKey()] || [];
  function toggleTask(id) {
    const k = dateKey();
    const arr = S.tasksDone[k] || [];
    S.tasksDone[k] = arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id];
    save();
    if (!arr.includes(id)) toast('Boa obra registrada! 🙌');
  }
  const totalGoodWorks = () => Object.values(S.tasksDone).reduce((s, a) => s + a.length, 0);
  function taskHTML(t) {
    const done = doneToday().includes(t.id);
    return `<div class="task ${done ? 'done' : ''}" data-task="${t.id}">
      <div class="check"></div>
      <div><div class="task-text">${esc(t.t)}</div><div class="task-cat">${esc(t.cat)}</div></div>
    </div>`;
  }

  // ================= Router =================
  const views = ['home', 'bible', 'business', 'create', 'mentor', 'tasks', 'settings'];
  let current = 'home';
  function go(view, opts = {}) {
    if (!views.includes(view)) view = 'home';
    current = view;
    closeSheet();
    document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.go === view));
    $('.composer')?.remove();
    closeDrawer();
    renderers[view](opts);
    updateDrawer();
    if (!opts.keepScroll) window.scrollTo({ top: 0 });
    if (location.hash !== `#${view}`) history.replaceState(null, '', `#${view}`);
  }
  // ---- Menu lateral ----
  function openDrawer() { updateDrawer(); $('#drawer').classList.add('open'); $('#drawer-backdrop').classList.add('open'); }
  function closeDrawer() { $('#drawer')?.classList.remove('open'); $('#drawer-backdrop')?.classList.remove('open'); }
  $('#menu-btn').addEventListener('click', openDrawer);
  $('#drawer-backdrop').addEventListener('click', closeDrawer);
  function updateDrawer() {
    document.querySelectorAll('.drawer-item').forEach((d) => d.classList.toggle('active', d.dataset.go === current));
    const left = Math.max(0, (S.settings.goal || 3) - (S.readLog[dateKey()] || 0));
    const pend = todaysTasks().filter((t) => !doneToday().includes(t.id)).length;
    const badges = { bible: left, tasks: pend, create: S.creativeSeen === dateKey() ? 0 : 1 };
    document.querySelectorAll('[data-badge]').forEach((b) => {
      const n = badges[b.dataset.badge];
      b.hidden = !n; b.textContent = n;
    });
  }
  function pageHead(icon, title, sub) {
    const ICONS = {
      home: '<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
      business: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
      create: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/>',
      mentor: '<path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
      tasks: '<path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/>',
      settings: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
    };
    return `<div class="page-head"><div class="ph-icon"><svg viewBox="0 0 24 24">${ICONS[icon]}</svg></div>
      <div><h1 class="page-title">${title}</h1><p class="page-sub">${sub}</p></div></div>`;
  }

  document.addEventListener('click', (e) => {
    const g = e.target.closest('[data-go]');
    if (g) { e.preventDefault(); closeSheet(); go(g.dataset.go); }
  });

  // ================= INÍCIO =================
  function renderHome() {
    const el = $('#view-home');
    const h = new Date().getHours();
    const greet = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite';
    const d = pick(DAILY, dayNum());
    const w = pick(WEEKLY, weekNum());
    const read = readCount();
    const pct = (read / TOTAL_CHAPTERS) * 100;
    const todayRead = S.readLog[dateKey()] || 0;
    const goal = S.settings.goal || 3;
    const cont = continueTarget();
    const cb = bookById(cont.book);
    const tasks = todaysTasks();
    const q = pick(DAILY_QUESTIONS, dayNum());
    const daysLeft = Math.ceil((TOTAL_CHAPTERS - read) / goal);

    el.innerHTML = `
      ${pageHead('home', 'Visão Geral', `${greet}! Resumo espiritual de ${esc(longDate())}.`)}
      <div class="row wrap" style="margin-bottom:18px">
        <button class="btn primary" data-act="open-ch" data-book="${cont.book}" data-ch="${cont.ch}"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg> Ler agora</button>
        <button class="btn" data-go="create"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg> Post do dia</button>
        <button class="btn ghost" data-go="mentor"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3l1.8 4.6L18 9l-4.2 1.4L12 15l-1.8-4.6L6 9l4.2-1.4z"/></svg> Mentor</button>
      </div>

      <div class="card glow">
        <div class="eyebrow">✦ Mensagem do dia</div>
        <p class="verse-text">“${esc(d.texto)}”</p>
        <div class="verse-ref">${esc(d.ref)}</div>
        <div class="divider"></div>
        <p style="margin:0 0 10px;color:var(--gold-light)">${esc(d.reflexao)}</p>
        <p class="small" style="margin:0"><b>Ação de hoje:</b> <span class="muted">${esc(d.acao)}</span></p>
        <div class="row wrap" style="margin-top:14px">
          <button class="btn sm" data-act="open-ch" data-book="${d.book}" data-ch="${d.ch}">Ler capítulo</button>
          <button class="btn sm" data-act="post-daily">Criar post</button>
          <button class="btn sm wa" data-act="wa-daily">WhatsApp</button>
          <button class="btn sm" data-act="copy-daily">Copiar</button>
        </div>
      </div>

      <div class="section-title">Progresso de leitura</div>
      <div class="card glow">
        <div class="row" style="align-items:flex-start">
          <div style="flex:1">
            <div style="font-size:16px;color:var(--gold-light)">Leitura hoje</div>
            <div class="big-num" style="margin-top:10px">${todayRead} <span style="font-size:20px;color:var(--gold-dim);font-weight:700">capítulo${todayRead === 1 ? '' : 's'}</span></div>
          </div>
          <div style="text-align:right">
            <div class="muted" style="font-size:14px">Meta diária</div>
            <div class="acc" style="font-family:var(--display);font-weight:800;font-size:24px;margin-top:4px">${goal} cap.</div>
          </div>
        </div>
        <div class="progress" style="margin:20px 0 12px"><i style="width:${Math.min(100, (todayRead / goal) * 100)}%"></i></div>
        <div class="muted">${todayRead >= goal ? '<b class="acc">Meta concluída hoje!</b> Deus honra a constância.' : `Faltam <b class="acc">${goal - todayRead} capítulo${goal - todayRead === 1 ? '' : 's'}</b> para a meta.`}</div>
        <div class="divider"></div>
        <div class="row" style="align-items:center">
          <div style="flex:1">
            <div style="font-size:16px;color:var(--gold-light)">Bíblia completa</div>
            <div class="big-num acc" style="margin-top:10px">${pct < 10 ? pct.toFixed(1) : Math.round(pct)}%</div>
          </div>
          <span class="pill green">🔥 ${streak()} dia${streak() === 1 ? '' : 's'} seguido${streak() === 1 ? '' : 's'}</span>
        </div>
        <div class="muted small" style="margin-top:10px">${read} de ${TOTAL_CHAPTERS} capítulos lidos na King James.</div>
        <div class="stats">
          <div class="stat"><b>${read}</b><span>capítulos</span></div>
          <div class="stat"><b>${Object.keys(S.read).filter((k) => (S.read[k] || []).length === bookById(k)?.c).length}</b><span>livros lidos</span></div>
          <div class="stat"><b>${read >= TOTAL_CHAPTERS ? '🏆' : daysLeft}</b><span>${read >= TOTAL_CHAPTERS ? 'concluída' : 'dias p/ concluir'}</span></div>
        </div>
        <button class="btn primary block" style="margin-top:14px" data-act="open-ch" data-book="${cont.book}" data-ch="${cont.ch}">Continuar: ${esc(cb.pt)} ${cont.ch}</button>
      </div>

      <div class="section-title">Mensagem da semana</div>
      <div class="card glow">
        <div class="eyebrow">✦ ${esc(w.titulo)}</div>
        <p class="verse-text" style="font-size:20px">“${esc(w.texto)}”</p>
        <div class="verse-ref">${esc(w.ref)}</div>
        <div class="divider"></div>
        <p style="margin:0;color:var(--gold-light)">${esc(w.mensagem)}</p>
        <div class="row wrap" style="margin-top:14px">
          <button class="btn sm" data-act="open-ch" data-book="${w.book}" data-ch="${w.ch}">Ler capítulo</button>
          <button class="btn sm wa" data-act="wa-weekly">WhatsApp</button>
        </div>
      </div>

      <div class="section-title">Tarefas para um mundo melhor</div>
      <div class="card">
        <div class="row"><div class="eyebrow">Boas obras de hoje</div><span class="spacer"></span><span class="small muted">${doneToday().filter((id) => tasks.some((t) => t.id === id)).length}/3</span></div>
        <div id="home-tasks">${tasks.map(taskHTML).join('')}</div>
        <button class="btn sm ghost" data-go="tasks" style="margin-top:8px">Ver todas as tarefas →</button>
      </div>

      <div class="section-title">Pergunta do dia</div>
      <div class="card">
        <div class="eyebrow">✦ Para refletir com o Mentor IA</div>
        <p style="color:var(--gold-light);font-size:17px;margin:10px 0 14px;font-weight:500">${esc(q)}</p>
        <button class="btn primary" data-act="ask" data-q="${esc(q)}">Perguntar ao Mentor</button>
      </div>

      <div class="section-title">Post do dia</div>
      <div class="card" style="text-align:center">
        <canvas id="home-post" style="width:100%;max-width:260px;border-radius:12px;border:1px solid var(--line)"></canvas>
        <div class="row" style="justify-content:center;margin-top:12px"><button class="btn primary sm" data-go="create">Abrir estúdio de posts</button></div>
      </div>
    `;
    const c = getDailyCreative();
    Creative.ensureFonts().then(() => {
      const cv = $('#home-post');
      if (cv) Creative.render(cv, { ...c, format: 'post', seed: dayNum(), date: shortDate(), handle: S.settings.handle });
    });
  }

  $('#view-home').addEventListener('click', (e) => {
    const t = e.target.closest('[data-task]');
    if (t) { toggleTask(t.dataset.task); renderHome(); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const d = pick(DAILY, dayNum());
    switch (a.dataset.act) {
      case 'open-ch': openChapter(a.dataset.book, +a.dataset.ch); break;
      case 'wa-daily': waText(`✦ *Mensagem do dia*\n\n“${d.texto}”\n— ${d.ref}\n\n${d.reflexao}\n\n👉 ${d.acao}\n\n_Bíblia do Empreendedor_`); break;
      case 'wa-weekly': { const w = pick(WEEKLY, weekNum()); waText(`✦ *${w.titulo}*\n\n“${w.texto}”\n— ${w.ref}\n\n${w.mensagem}\n\n_Bíblia do Empreendedor_`); break; }
      case 'copy-daily': copy(`“${d.texto}” — ${d.ref}\n\n${d.reflexao}\n\n— Bíblia do Empreendedor`); break;
      case 'post-daily': setCreative({ quote: d.texto, ref: d.ref, tag: 'Palavra do Dia', caption: buildCaption(d.texto, d.ref, d.reflexao), source: 'diaria' }); go('create'); break;
      case 'ask': askMentor(a.dataset.q); break;
    }
  });

  // ================= BÍBLIA =================
  let reader = { verses: null, loading: false, error: null, sel: null };

  function openChapter(book, ch) {
    S.last = { book, ch };
    save();
    reader = { verses: null, loading: false, error: null, sel: null };
    go('bible');
  }

  async function fetchChapter(book, ch, tr) {
    const ck = `bde:ch:${tr}:${book}:${ch}`;
    const cached = localStorage.getItem(ck);
    if (cached) return JSON.parse(cached);
    const b = bookById(book);
    const url = `https://bible-api.com/${encodeURIComponent(`${b.en} ${ch}`)}?translation=${tr}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status === 429 ? 'Muitas requisições. Aguarde alguns segundos.' : `Erro ${res.status} ao carregar o capítulo.`);
    const data = await res.json();
    const verses = (data.verses || []).map((v) => ({ v: v.verse, t: v.text.replace(/\s+/g, ' ').trim() }));
    if (!verses.length) throw new Error('Capítulo não encontrado.');
    try { localStorage.setItem(ck, JSON.stringify(verses)); } catch { /* armazenamento cheio */ }
    return verses;
  }

  function renderBible() {
    const el = $('#view-bible');
    const { book, ch } = S.last;
    const b = bookById(book);
    const tr = S.settings.translation;
    const done = isRead(book, ch);
    const bookRead = (S.read[book] || []).length;

    let body;
    if (reader.error) {
      body = `<div class="loader"><p>${esc(reader.error)}</p><p class="small">Verifique sua conexão com a internet.</p><button class="btn" data-act="retry">Tentar novamente</button></div>`;
    } else if (!reader.verses) {
      body = `<div class="loader"><div class="spinner"></div>Carregando ${esc(b.pt)} ${ch}…</div>`;
    } else {
      body = `<div class="verses" style="--reader-size:${S.settings.fontSize}px">${reader.verses
        .map((v) => `<span class="verse ${reader.sel === v.v ? 'sel' : ''}" data-v="${v.v}"><sup>${v.v}</sup>${esc(v.t)}</span> `)
        .join('')}</div>
        <div class="read-done">
          ${done
            ? `<p class="verse-ref" style="margin-bottom:12px">✓ CAPÍTULO LIDO</p>
               <div class="row" style="justify-content:center"><button class="btn sm ghost" data-act="unmark">Desmarcar</button>${nextChapter(book, ch) ? '<button class="btn primary" data-act="next">Próximo capítulo →</button>' : ''}</div>`
            : `<button class="btn primary block" data-act="mark">✓ Marcar capítulo como lido</button>`}
          <p class="small muted" style="margin-top:14px">${esc(b.pt)}: ${bookRead}/${b.c} capítulos lidos</p>
        </div>`;
    }

    el.innerHTML = `
      <div class="reader-bar">
        <button class="reader-title" data-act="books"><span>${esc(b.pt)} ${ch}</span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg></button>
        <button class="trans-toggle" data-act="trans" title="Trocar tradução">${TRANSLATIONS[tr].short}</button>
        <button class="nav-btn" data-act="font" title="Tamanho da letra" style="font-family:var(--serif);font-weight:700">Aa</button>
        <button class="nav-btn" data-act="prev" aria-label="Anterior">‹</button>
        <button class="nav-btn" data-act="next" aria-label="Próximo">›</button>
      </div>
      <div class="chapter-head">
        <div class="book">${esc(b.pt)}</div>
        <div class="num">${ch}</div>
        <div class="tname">${esc(TRANSLATIONS[tr].name)}</div>
      </div>
      ${body}
    `;

    if (!reader.verses && !reader.loading && !reader.error) {
      reader.loading = true;
      const key = `${book}:${ch}:${tr}`;
      fetchChapter(book, ch, tr)
        .then((v) => { if (`${S.last.book}:${S.last.ch}:${S.settings.translation}` === key) { reader.verses = v; reader.loading = false; if (current === 'bible') renderBible(); } })
        .catch((err) => { reader.loading = false; reader.error = err.message || 'Falha ao carregar.'; if (current === 'bible') renderBible(); });
    }
  }

  function moveTo(p) {
    if (!p) return;
    S.last = p; save();
    reader = { verses: null, loading: false, error: null, sel: null };
    renderBible();
    window.scrollTo({ top: 0 });
  }

  $('#view-bible').addEventListener('click', (e) => {
    const v = e.target.closest('.verse');
    if (v) { verseActions(+v.dataset.v); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const { book, ch } = S.last;
    switch (a.dataset.act) {
      case 'prev': moveTo(prevChapter(book, ch)); break;
      case 'next': moveTo(nextChapter(book, ch)); break;
      case 'retry': reader.error = null; renderBible(); break;
      case 'books': bookPicker(bookById(book).t); break;
      case 'font': {
        const sizes = [18, 21, 24, 27, 30];
        S.settings.fontSize = sizes[(sizes.indexOf(S.settings.fontSize) + 1) % sizes.length] || 21;
        save(); renderBible(); toast(`Letra ${S.settings.fontSize}px`); break;
      }
      case 'trans':
        S.settings.translation = S.settings.translation === 'kjv' ? 'almeida' : 'kjv';
        save(); reader = { verses: null, loading: false, error: null, sel: null }; renderBible();
        toast(TRANSLATIONS[S.settings.translation].name); break;
      case 'mark': {
        markRead(book, ch);
        const todayRead = S.readLog[dateKey()] || 0;
        toast(todayRead === S.settings.goal ? '🏆 Meta diária concluída!' : 'Capítulo lido ✓');
        renderBible(); break;
      }
      case 'unmark': unmarkRead(book, ch); renderBible(); break;
    }
  });

  function verseActions(vn) {
    const { book, ch } = S.last;
    const b = bookById(book);
    const verse = reader.verses.find((x) => x.v === vn);
    if (!verse) return;
    reader.sel = vn;
    document.querySelectorAll('.verse').forEach((el) => el.classList.toggle('sel', +el.dataset.v === vn));
    const ref = `${b.pt} ${ch}:${vn}`;
    openSheet(`
      <div class="mini-verse"><p>${esc(verse.t)}</p><div class="verse-ref">${esc(ref)} · ${TRANSLATIONS[S.settings.translation].short}</div></div>
      <div class="action-list">
        <button data-va="copy">📋 Copiar versículo</button>
        <button data-va="wa">🟢 Enviar no WhatsApp</button>
        <button data-va="post">🖼️ Criar post / stories com este versículo</button>
        <button data-va="explain">✨ Explicar com o Mentor IA</button>
        <button data-va="business">💼 Como aplicar no meu negócio?</button>
      </div>`);
    $('#sheet').onclick = (e) => {
      const btn = e.target.closest('[data-va]');
      if (!btn) return;
      closeSheet();
      $('#sheet').onclick = null;
      const trName = TRANSLATIONS[S.settings.translation].name;
      switch (btn.dataset.va) {
        case 'copy': copy(`“${verse.t}” — ${ref} (${TRANSLATIONS[S.settings.translation].short})`); break;
        case 'wa': waText(`“${verse.t}”\n— *${ref}* (${TRANSLATIONS[S.settings.translation].short})\n\n_Bíblia do Empreendedor_`); break;
        case 'post': setCreative({ quote: verse.t, ref, tag: 'Palavra do Dia', caption: buildCaption(verse.t, ref), source: 'versiculo' }); go('create'); break;
        case 'explain': askMentor(`Explique ${ref} (${trName}): "${verse.t}". Traga o contexto, o significado e uma aplicação prática.`); break;
        case 'business': askMentor(`Como aplicar ${ref} ("${verse.t}") na minha vida de empreendedor? Dê passos práticos.`); break;
      }
    };
  }

  function bookPicker(testament = 'AT', showBook = null) {
    if (showBook) {
      const b = bookById(showBook);
      const readList = S.read[b.id] || [];
      openSheet(`
        <div class="row" style="margin-bottom:12px"><button class="btn sm" data-bp="back" data-t="${b.t}">‹ Livros</button><span class="spacer"></span><span class="small muted">${readList.length}/${b.c} lidos</span></div>
        <h3>${esc(b.pt)}</h3>
        <div class="ch-grid">${Array.from({ length: b.c }, (_, i) => i + 1)
          .map((c) => `<button class="ch ${readList.includes(c) ? 'read' : ''} ${S.last.book === b.id && S.last.ch === c ? 'current' : ''}" data-bp="ch" data-book="${b.id}" data-ch="${c}">${c}</button>`)
          .join('')}</div>`);
    } else {
      const list = BOOKS.filter((b) => b.t === testament);
      const tRead = list.reduce((s, b) => s + (S.read[b.id] || []).length, 0);
      const tTotal = list.reduce((s, b) => s + b.c, 0);
      openSheet(`
        <div class="seg" style="margin-bottom:12px">
          <button class="${testament === 'AT' ? 'active' : ''}" data-bp="t" data-t="AT">Antigo Testamento</button>
          <button class="${testament === 'NT' ? 'active' : ''}" data-bp="t" data-t="NT">Novo Testamento</button>
        </div>
        <div class="small muted" style="margin:0 2px 8px">${tRead}/${tTotal} capítulos · ${((tRead / tTotal) * 100).toFixed(1)}%</div>
        <div class="progress" style="margin-bottom:14px"><i style="width:${(tRead / tTotal) * 100}%"></i></div>
        <div class="book-grid">${list
          .map((b) => {
            const r = (S.read[b.id] || []).length;
            return `<button class="book-item ${S.last.book === b.id ? 'current' : ''}" data-bp="book" data-book="${b.id}">
              <b>${esc(b.pt)} ${r === b.c ? '✓' : ''}</b><span class="small muted">${r}/${b.c}</span>
              <div class="progress"><i style="width:${(r / b.c) * 100}%"></i></div></button>`;
          })
          .join('')}</div>`);
    }
    $('#sheet').onclick = (e) => {
      const btn = e.target.closest('[data-bp]');
      if (!btn) return;
      const k = btn.dataset.bp;
      if (k === 't' || k === 'back') bookPicker(btn.dataset.t);
      else if (k === 'book') bookPicker(null, btn.dataset.book);
      else if (k === 'ch') { closeSheet(); $('#sheet').onclick = null; moveTo({ book: btn.dataset.book, ch: +btn.dataset.ch }); }
    };
  }

  // ================= NEGÓCIOS =================
  function renderBusiness() {
    $('#view-business').innerHTML = `
      ${pageHead('business', 'Decisões', 'Princípios bíblicos para escolhas de negócio.')}
      <div class="card glow">
        <div class="eyebrow">✦ Estou diante de uma decisão</div>
        <p class="small muted" style="margin:8px 0 10px">Descreva a situação. O Mentor IA vai analisar sob a ótica bíblica: princípios, perguntas, riscos, próximo passo e uma oração.</p>
        <textarea id="decision" rows="4" placeholder="Ex.: Recebi uma proposta para abrir uma segunda loja, mas precisaria de um empréstimo..."></textarea>
        <button class="btn primary block" style="margin-top:10px" data-act="decide">Analisar com sabedoria bíblica</button>
      </div>
      <div class="section-title">Temas</div>
      <div class="topic-grid">${BUSINESS.map((t) => `
        <button class="topic" data-topic="${t.id}"><span class="ic">${t.icone}</span><b>${esc(t.titulo)}</b><span>${esc(t.resumo)}</span></button>`).join('')}
      </div>`;
  }
  $('#view-business').addEventListener('click', (e) => {
    const t = e.target.closest('[data-topic]');
    if (t) { topicSheet(t.dataset.topic); return; }
    const a = e.target.closest('[data-act="decide"]');
    if (a) {
      const txt = $('#decision').value.trim();
      if (!txt) { toast('Descreva sua decisão primeiro'); return; }
      askMentor(`Estou diante desta decisão no meu negócio:\n\n${txt}\n\nAnalise sob a ótica bíblica com: 1) princípios bíblicos envolvidos (com versículos), 2) perguntas que devo me fazer, 3) riscos e cuidados, 4) um próximo passo prático, 5) uma oração curta.`);
    }
  });
  function topicSheet(id) {
    const t = BUSINESS.find((x) => x.id === id);
    openSheet(`
      <div style="font-size:30px">${t.icone}</div>
      <h3>${esc(t.titulo)}</h3>
      <p class="muted" style="margin-top:-6px">${esc(t.resumo)}</p>
      <div class="section-title" style="margin-top:16px">Princípios</div>
      ${t.principios.map((p) => `<div class="principle">${esc(p)}</div>`).join('')}
      <div class="section-title">O que a Palavra diz</div>
      ${t.versiculos.map((v) => `<div class="mini-verse"><p>“${esc(v.texto)}”</p><div class="verse-ref">${esc(v.ref)}</div></div>`).join('')}
      <div class="section-title">Pergunta para o coração</div>
      <p style="color:var(--gold-light);font-family:var(--serif);font-size:19px;font-weight:600;margin:0 0 16px">${esc(t.pergunta)}</p>
      <button class="btn primary block" data-ta="ask">Conversar com o Mentor sobre isso</button>`);
    $('#sheet').onclick = (e) => {
      if (!e.target.closest('[data-ta]')) return;
      closeSheet(); $('#sheet').onclick = null;
      askMentor(`Quero conselho bíblico sobre o tema "${t.titulo}" no meu negócio. Considere os princípios: ${t.principios.join(' ')} Me ajude com perguntas para entender minha situação e passos práticos.`);
    };
  }

  // ================= MENTOR IA (Gemini) =================
  const SYSTEM_MENTOR = `Você é o Mentor da "Bíblia do Empreendedor": um conselheiro cristão sábio, acolhedor e prático para empreendedores.
Regras:
- Responda sempre em português do Brasil.
- Baseie-se na Bíblia. Ao citar, prefira a King James (KJV) traduzida fielmente para o português e sempre informe a referência (livro capítulo:versículo).
- Nunca invente versículos. Se não tiver certeza da referência exata, diga isso.
- Diferencie princípio bíblico de aplicação pessoal; seja honesto quando a Bíblia não fala diretamente sobre o assunto.
- Conecte a Palavra a passos práticos de negócio e de vida.
- Incentive oração, comunhão e o conselho de pastores e mentores. Para questões jurídicas, contábeis, médicas ou de saúde emocional, recomende também um profissional.
- Seja conciso (até ~250 palavras), use parágrafos curtos, listas e **negrito** quando ajudar. Termine, quando fizer sentido, com uma oração curta.`;

  async function gemini(contents, { system = SYSTEM_MENTOR, json = false, temperature = 0.8 } = {}) {
    const key = S.settings.apiKey.trim();
    if (!key) throw new Error('NO_KEY');
    const call = async (model) => {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: { temperature, ...(json ? { responseMimeType: 'application/json' } : {}) },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { const err = new Error(data.error?.message || `Erro ${res.status}`); err.status = res.status; throw err; }
      const text = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('').trim();
      if (!text) throw new Error('A IA não retornou resposta. Tente reformular.');
      return text;
    };
    const model = S.settings.model.trim() || 'gemini-flash-latest';
    try { return await call(model); }
    catch (e) {
      // modelo indisponível → tenta um modelo gratuito alternativo
      if (e.status === 404 && model !== 'gemini-2.5-flash') return call('gemini-2.5-flash');
      throw e;
    }
  }

  let mentorBusy = false;
  function askMentor(text) {
    go('mentor');
    if (!S.settings.apiKey) { $('#mentor-input') && ($('#mentor-input').value = text); return; }
    sendMentor(text);
  }

  async function sendMentor(text) {
    if (mentorBusy || !text.trim()) return;
    S.chat.push({ role: 'user', text: text.trim() });
    S.chat = S.chat.slice(-40);
    save();
    mentorBusy = true;
    renderMentor({ keepScroll: true });
    scrollChat();
    try {
      const contents = S.chat.slice(-16).map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
      const reply = await gemini(contents);
      S.chat.push({ role: 'model', text: reply });
    } catch (e) {
      S.chat.push({ role: 'model', text: `⚠️ ${e.message === 'NO_KEY' ? 'Configure sua chave gratuita do Gemini em Ajustes.' : 'Não consegui responder agora: ' + e.message}`, error: true });
    }
    mentorBusy = false;
    save();
    if (current === 'mentor') { renderMentor({ keepScroll: true }); scrollChat(); }
  }
  function scrollChat() { requestAnimationFrame(() => window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' })); }

  function renderMentor() {
    const el = $('#view-mentor');
    const hasKey = !!S.settings.apiKey;
    const chips = [pick(DAILY_QUESTIONS, dayNum()), 'Um devocional curto para começar o dia', 'Como lidar com a ansiedade nos negócios?', 'Me dê um versículo para uma reunião difícil', 'Como orar pelo meu negócio?'];
    el.innerHTML = `
      ${pageHead('mentor', 'Mentor IA', 'Pergunte como agir ou tire dúvidas sobre a Bíblia.')}
      ${!hasKey ? `
      <div class="card glow">
        <div class="eyebrow">✦ Ative o Mentor gratuitamente</div>
        <ol class="steps">
          <li>Acesse <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a> com sua conta Google.</li>
          <li>Clique em <b>Create API key</b> (é gratuito).</li>
          <li>Cole a chave abaixo.</li>
        </ol>
        <input id="quick-key" type="password" placeholder="Cole aqui sua chave do Gemini (AIza...)" autocomplete="off">
        <button class="btn primary block" style="margin-top:10px" data-act="save-key">Ativar Mentor</button>
        <p class="small muted" style="margin:10px 0 0">A chave fica salva só neste aparelho.</p>
      </div>` : ''}
      <div class="chips" style="margin-bottom:14px">${S.chat.length ? '<button class="chip" data-act="clear">🗑 Nova conversa</button>' : ''}${chips.map((c) => `<button class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="chat" id="chat">
        ${S.chat.length === 0 ? `<div class="msg ai"><p>Paz, empreendedor! Sou seu mentor bíblico. Pergunte sobre <strong>decisões, liderança, finanças, propósito</strong> ou peça a explicação de qualquer passagem. 🙏</p></div>` : ''}
        ${S.chat.map((m, i) => `<div class="msg ${m.role === 'user' ? 'user' : 'ai'}">${m.role === 'user' ? esc(m.text).replace(/\n/g, '<br>') : md(m.text) + (m.error ? '' : `<div style="margin-top:8px"><button class="chip" data-wa-msg="${i}" style="padding:5px 10px;font-size:12px">Enviar no WhatsApp</button></div>`)}</div>`).join('')}
        ${mentorBusy ? '<div class="msg ai typing"><span></span><span></span><span></span></div>' : ''}
      </div>
    `;
    const prevDraft = $('#mentor-input')?.value || '';
    $('.composer')?.remove();
    const comp = document.createElement('div');
    comp.className = 'composer';
    comp.innerHTML = `<div class="composer-inner">
      <textarea id="mentor-input" rows="1" placeholder="Escreva sua pergunta…"></textarea>
      <button class="send-btn" id="mentor-send" aria-label="Enviar"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
    </div>`;
    document.body.appendChild(comp);
    const input = $('#mentor-input');
    input.value = prevDraft;
    const autosize = () => { input.style.height = 'auto'; input.style.height = Math.min(140, input.scrollHeight) + 'px'; };
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !('ontouchstart' in window)) { e.preventDefault(); submit(); } });
    const submit = () => {
      const v = input.value.trim();
      if (!v) return;
      if (!S.settings.apiKey) { toast('Ative o Mentor com sua chave gratuita'); return; }
      input.value = ''; autosize(); sendMentor(v);
    };
    $('#mentor-send').onclick = submit;
  }
  $('#view-mentor').addEventListener('click', (e) => {
    const wm = e.target.closest('[data-wa-msg]');
    if (wm) { waText(`${S.chat[+wm.dataset.waMsg].text}\n\n_Mentor · Bíblia do Empreendedor_`); return; }
    const c = e.target.closest('[data-q]');
    if (c) { if (S.settings.apiKey) sendMentor(c.dataset.q); else { $('#mentor-input').value = c.dataset.q; toast('Ative o Mentor com sua chave gratuita'); } return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'clear') { S.chat = []; save(); renderMentor(); }
    if (a.dataset.act === 'save-key') {
      const k = $('#quick-key').value.trim();
      if (!k) { toast('Cole sua chave'); return; }
      S.settings.apiKey = k; save(); toast('Mentor ativado ✨');
      const draft = $('#mentor-input')?.value.trim();
      renderMentor();
      if (draft) { $('#mentor-input').value = ''; sendMentor(draft); }
    }
  });

  // ================= POSTS / STORIES =================
  const THEMES = ['processo', 'fé no meio da incerteza', 'diligência', 'propósito', 'liderança servidora', 'generosidade', 'recomeço', 'descanso em Deus', 'visão', 'integridade', 'coragem', 'gratidão', 'paciência', 'sabedoria nas finanças', 'constância'];
  const REFLECTIONS = [
    'Deus está trabalhando no seu processo, mesmo quando você não vê resultado.',
    'Construa com fidelidade hoje; a colheita tem o tempo certo.',
    'Seu negócio pode ser um altar onde Deus é honrado todos os dias.',
    'Não troque princípios por atalhos. O que é firme permanece.',
    'Comece pequeno, permaneça fiel e confie em Quem sustenta o seu caminho.',
    'Sucesso de verdade é crescer em resultado sem perder o caráter.',
  ];
  const HASHTAGS = '#bibliadoempreendedor #empreendedorcristao #empreendedorismo #fe #proposito #proverbios #palavradodia #deusnocontrole #sabedoria #negocioscomproposito';

  function buildCaption(quote, ref, reflection) {
    const r = reflection || pick(REFLECTIONS, dayNum());
    return `${ref ? `“${quote}”\n— ${ref}` : quote}\n\n${r}\n\n💬 Comente "AMÉM" se essa palavra é para você.\n🔁 Envie para um empreendedor que precisa ler isso hoje.\n\n${HASHTAGS}`;
  }

  function localDaily() {
    const n = dayNum();
    const useProverb = n % 2 === 0;
    if (useProverb) {
      const p = pick(PROVERBS, Math.floor(n / 2) * 7);
      return { quote: p.texto, ref: p.ref, tag: 'Palavra do Dia', caption: buildCaption(p.texto, p.ref), source: 'local' };
    }
    const f = pick(FRASES, Math.floor(n / 2) * 5);
    return { quote: f, ref: '', tag: 'Reflexão do Dia', caption: buildCaption(f, ''), source: 'local' };
  }

  function getDailyCreative() {
    if (!S.creative || S.creative.date !== dateKey()) {
      S.creative = { date: dateKey(), bg: pick(Creative.backgrounds, dayNum()).id, aiTried: false, ...localDaily() };
      save();
    }
    return S.creative;
  }
  function setCreative(c) {
    getDailyCreative();
    Object.assign(S.creative, c);
    save();
  }

  async function aiCreative() {
    const theme = pick(THEMES, dayNum() + Math.floor(Math.random() * 5));
    const prompt = `Crie o conteúdo do post de hoje (${longDate()}) para o perfil cristão "Bíblia do Empreendedor". Tema: ${theme}.
Escolha UM formato:
(a) um versículo ou provérbio bíblico, com tradução fiel da King James (KJV) para o português, e a referência exata; OU
(b) uma frase original, curta e marcante, sobre processo, Deus, fé e empreender (sem referência).
Responda SOMENTE em JSON: {"texto": "no máximo 170 caracteres", "referencia": "Livro cap:vers ou vazio", "tag": "2 a 3 palavras para o topo, ex: Palavra do Dia", "legenda": "legenda para Instagram com 3 a 5 frases curtas sobre o tema, uma chamada para ação e 8 hashtags, incluindo #bibliadoempreendedor"}`;
    const txt = await gemini([{ role: 'user', parts: [{ text: prompt }] }], {
      system: 'Você cria conteúdo cristão inspirador e fiel à Bíblia para empreendedores. Nunca invente versículos.', json: true, temperature: 1,
    });
    const j = JSON.parse(txt.replace(/^```(json)?|```$/g, '').trim());
    if (!j.texto) throw new Error('Resposta inválida');
    return { quote: j.texto.replace(/^["“]|["”]$/g, ''), ref: j.referencia || '', tag: j.tag || 'Palavra do Dia', caption: j.legenda || buildCaption(j.texto, j.referencia), source: 'ia' };
  }

  let createState = { format: 'post', busy: false };

  function renderCreate() {
    const c = getDailyCreative();
    if (S.creativeSeen !== dateKey()) { S.creativeSeen = dateKey(); save(); }
    const el = $('#view-create');
    el.innerHTML = `
      ${pageHead('create', 'Estúdio de Posts', 'Post e stories novos todos os dias.')}
      <div class="seg" style="margin-bottom:14px">
        <button class="${createState.format === 'post' ? 'active' : ''}" data-fmt="post">Post 4:5</button>
        <button class="${createState.format === 'story' ? 'active' : ''}" data-fmt="story">Stories 9:16</button>
      </div>
      <div class="preview-wrap ${createState.format === 'story' ? 'story' : ''}"><canvas id="cv"></canvas></div>
      <div class="row" style="justify-content:center;margin-bottom:6px">
        <span class="chip">${c.source === 'ia' ? '✨ Criado por IA' : c.ref ? '📖 Versículo' : '💡 Reflexão'}</span>
      </div>
      <div class="section-title">Fundo</div>
      <div class="bg-picker">${Creative.backgrounds.map((b) => `<button class="bg-thumb ${c.bg === b.id ? 'active' : ''}" data-bg="${b.id}" title="${esc(b.name)}"><canvas data-thumb="${b.id}"></canvas></button>`).join('')}</div>
      <div class="row wrap" style="margin-top:6px">
        <button class="btn ig" data-act="story" style="flex:1">📲 Postar no Stories</button>
        <button class="btn wa" data-act="wa" style="flex:1"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.8 14.1c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.1.1.3 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3.1.1.1.7-.1 1.4z"/></svg> WhatsApp</button>
      </div>
      <div class="row wrap" style="margin-top:10px">
        <button class="btn" data-act="share" style="flex:1">Compartilhar</button>
        <button class="btn" data-act="download" style="flex:1">Baixar ${createState.format === 'post' ? 'post' : 'stories'}</button>
      </div>
      <button class="btn block ghost" data-act="download-both" style="margin-top:10px">⬇ Baixar post + stories</button>
      <div class="section-title">Texto</div>
      <div class="row wrap">
        <button class="btn sm" data-act="ai" ${createState.busy ? 'disabled' : ''}>${createState.busy ? 'Criando…' : '✨ Gerar com IA'}</button>
        <button class="btn sm" data-act="proverb">📖 Provérbio</button>
        <button class="btn sm" data-act="frase">💡 Frase</button>
        <button class="btn sm" data-act="edit">✏️ Editar</button>
      </div>
      <div class="section-title">Legenda</div>
      <div class="caption-box">${esc(c.caption)}</div>
      <button class="btn sm" style="margin-top:10px" data-act="copy-caption">Copiar legenda</button>
      ${!S.settings.apiKey ? '<p class="notice" style="margin-top:16px">Dica: adicione sua chave gratuita do Gemini em Ajustes para que a IA crie um texto novo e exclusivo todos os dias.</p>' : ''}
    `;
    Creative.ensureFonts().then(() => {
      drawPreview();
      el.querySelectorAll('[data-thumb]').forEach((cv) => Creative.thumb(cv, cv.dataset.thumb));
    });
    // IA cria automaticamente uma vez por dia
    if (S.settings.apiKey && S.settings.aiPosts && !c.aiTried && c.source === 'local') {
      c.aiTried = true; save();
      runAI(true);
    }
  }

  function renderOpts(format) {
    const c = getDailyCreative();
    return { format, bg: c.bg, seed: dayNum(), quote: c.quote, ref: c.ref, tag: c.tag, date: shortDate(), handle: S.settings.handle };
  }
  function drawPreview() {
    const cv = $('#cv');
    if (cv) Creative.render(cv, renderOpts(createState.format));
  }

  async function runAI(auto = false) {
    createState.busy = true;
    if (current === 'create') renderCreate();
    try {
      const r = await aiCreative();
      setCreative(r);
      if (!auto) toast('Novo texto criado ✨');
    } catch (e) {
      if (!auto) toast(e.message === 'NO_KEY' ? 'Configure a chave do Gemini em Ajustes' : 'IA indisponível agora');
    }
    createState.busy = false;
    if (current === 'create') renderCreate();
  }

  function canvasBlob(format) {
    const cv = document.createElement('canvas');
    Creative.render(cv, renderOpts(format));
    return new Promise((res) => cv.toBlob(res, 'image/png'));
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const fileName = (format) => `biblia-do-empreendedor-${format === 'post' ? 'post' : 'stories'}-${dateKey()}.png`;

  $('#view-create').addEventListener('click', async (e) => {
    const f = e.target.closest('[data-fmt]');
    if (f) { createState.format = f.dataset.fmt; renderCreate(); return; }
    const bgb = e.target.closest('[data-bg]');
    if (bgb) {
      setCreative({ bg: bgb.dataset.bg });
      document.querySelectorAll('.bg-thumb').forEach((x) => x.classList.toggle('active', x === bgb));
      drawPreview(); return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    await Creative.ensureFonts();
    const c = getDailyCreative();
    switch (a.dataset.act) {
      case 'download': download(await canvasBlob(createState.format), fileName(createState.format)); toast('Imagem salva'); break;
      case 'download-both':
        download(await canvasBlob('post'), fileName('post'));
        setTimeout(async () => download(await canvasBlob('story'), fileName('story')), 600);
        toast('Post e stories salvos'); break;
      case 'share': {
        const blob = await canvasBlob(createState.format);
        const file = new File([blob], fileName(createState.format), { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          try { await copy(c.caption); } catch { /* ok */ }
          try { await navigator.share({ files: [file], text: c.caption }); } catch { /* cancelado */ }
        } else { download(blob, file.name); copy(c.caption); toast('Imagem salva e legenda copiada'); }
        break;
      }
      case 'story': {
        // gera sempre no formato 9:16 e abre o compartilhamento (Instagram → Stories)
        const blob = await canvasBlob('story');
        const file = new File([blob], fileName('story'), { type: 'image/png' });
        await copy(c.caption);
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          toast('Escolha Instagram → Stories');
          try { await navigator.share({ files: [file] }); } catch { /* cancelado */ }
        } else {
          download(blob, file.name);
          toast('Stories salvo! Abra o Instagram e poste');
          if (isMobile) setTimeout(() => { location.href = 'instagram://story-camera'; }, 900);
        }
        break;
      }
      case 'wa': {
        const blob = await canvasBlob(createState.format);
        const file = new File([blob], fileName(createState.format), { type: 'image/png' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          toast('Escolha o WhatsApp');
          try { await navigator.share({ files: [file], text: c.caption }); } catch { /* cancelado */ }
        } else {
          download(blob, file.name);
          waText(c.caption);
          toast('Imagem salva — anexe no WhatsApp');
        }
        break;
      }
      case 'copy-caption': copy(c.caption); break;
      case 'ai': runAI(false); break;
      case 'proverb': {
        const p = PROVERBS[Math.floor(Math.random() * PROVERBS.length)];
        setCreative({ quote: p.texto, ref: p.ref, tag: 'Palavra do Dia', caption: buildCaption(p.texto, p.ref), source: 'local' });
        renderCreate(); break;
      }
      case 'frase': {
        const fr = FRASES[Math.floor(Math.random() * FRASES.length)];
        setCreative({ quote: fr, ref: '', tag: 'Reflexão do Dia', caption: buildCaption(fr, ''), source: 'local' });
        renderCreate(); break;
      }
      case 'edit': editSheet(); break;
    }
  });

  function editSheet() {
    const c = getDailyCreative();
    openSheet(`
      <h3>Editar texto</h3>
      <div class="field"><label>Tag do topo</label><input id="ed-tag" value="${esc(c.tag)}"></div>
      <div class="field"><label>Mensagem</label><textarea id="ed-quote" rows="4">${esc(c.quote)}</textarea></div>
      <div class="field"><label>Referência (opcional)</label><input id="ed-ref" value="${esc(c.ref)}" placeholder="Ex.: Provérbios 16:3"></div>
      <div class="field"><label>Legenda</label><textarea id="ed-cap" rows="6">${esc(c.caption)}</textarea></div>
      <button class="btn primary block" id="ed-save">Aplicar</button>`);
    $('#ed-save').onclick = () => {
      setCreative({ tag: $('#ed-tag').value.trim(), quote: $('#ed-quote').value.trim() || c.quote, ref: $('#ed-ref').value.trim(), caption: $('#ed-cap').value });
      closeSheet(); renderCreate();
    };
  }

  // ================= TAREFAS =================
  function renderTasks() {
    const today = todaysTasks();
    const cats = [...new Set(TASKS.map((t) => t.cat))];
    $('#view-tasks').innerHTML = `
      ${pageHead('tasks', 'Tarefas cristãs', 'Pequenas obras que tornam o mundo melhor.')}
      <div class="stats" style="margin-top:0;margin-bottom:12px">
        <div class="stat"><b>${doneToday().length}</b><span>hoje</span></div>
        <div class="stat"><b>${totalGoodWorks()}</b><span>boas obras</span></div>
        <div class="stat"><b>${Object.values(S.tasksDone).filter((a) => a.length).length}</b><span>dias ativos</span></div>
      </div>
      <div class="card glow"><div class="eyebrow">✦ Desafios de hoje</div>${today.map(taskHTML).join('')}</div>
      ${cats.map((cat) => `<div class="section-title">${esc(cat)}</div><div class="card">${TASKS.filter((t) => t.cat === cat).map(taskHTML).join('')}</div>`).join('')}
    `;
  }
  $('#view-tasks').addEventListener('click', (e) => {
    const t = e.target.closest('[data-task]');
    if (t) { toggleTask(t.dataset.task); renderTasks(); }
  });

  // ================= AJUSTES =================
  function renderSettings() {
    const s = S.settings;
    $('#view-settings').innerHTML = `
      ${pageHead('settings', 'Ajustes', 'Tudo fica salvo apenas neste aparelho.')}

      <div class="section-title">Aparência</div>
      <div class="card">
        <div class="field"><label>Tema</label>
          <div class="theme-pick">
            <button class="theme-opt ${s.theme !== 'light' ? 'active' : ''}" data-theme-opt="dark"><div class="pv" style="background:#000;color:#fff;border:1px solid #333">Aa</div>Preto</button>
            <button class="theme-opt ${s.theme === 'light' ? 'active' : ''}" data-theme-opt="light"><div class="pv" style="background:#fff;color:#111;border:1px solid #ddd">Aa</div>Branco</button>
          </div>
        </div>
        <div class="field" style="margin:0"><label>Cor do app e dos posts</label>
          <div class="swatches">
            ${ACCENTS.map((a) => `<button class="swatch ${s.accent.toLowerCase() === a.c ? 'active' : ''}" data-accent="${a.c}" title="${a.n}" style="background:${a.c}"></button>`).join('')}
            <label class="swatch swatch-custom ${ACCENTS.some((a) => a.c === s.accent.toLowerCase()) ? '' : 'active'}" title="Cor personalizada"><input type="color" id="st-color" value="${esc(s.accent)}"></label>
          </div>
        </div>
      </div>

      <div class="section-title">Inteligência artificial</div>
      <div class="card">
        <div class="field">
          <label>Chave da API do Google Gemini (gratuita)</label>
          <input id="st-key" type="password" value="${esc(s.apiKey)}" placeholder="AIza..." autocomplete="off">
          <p class="small muted" style="margin:6px 0 0">Crie grátis em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>.</p>
        </div>
        <div class="field">
          <label>Modelo</label>
          <input id="st-model" value="${esc(s.model)}" placeholder="gemini-flash-latest">
        </div>
        <label class="switch">Criar o post do dia com IA automaticamente<input type="checkbox" id="st-aiposts" ${s.aiPosts ? 'checked' : ''}></label>
        <button class="btn sm" data-act="test">Testar conexão</button>
      </div>

      <div class="section-title">Leitura</div>
      <div class="card">
        <div class="field">
          <label>Tradução</label>
          <select id="st-tr">${Object.entries(TRANSLATIONS).map(([k, v]) => `<option value="${k}" ${s.translation === k ? 'selected' : ''}>${esc(v.name)}${k === 'kjv' ? ' — inglês' : ' — português'}</option>`).join('')}</select>
        </div>
        <div class="field">
          <label>Meta diária de capítulos</label>
          <select id="st-goal">${[1, 2, 3, 4, 5, 7, 10].map((n) => `<option value="${n}" ${s.goal === n ? 'selected' : ''}>${n} por dia · Bíblia em ~${Math.ceil(TOTAL_CHAPTERS / n / 30)} meses</option>`).join('')}</select>
        </div>
      </div>

      <div class="section-title">Posts</div>
      <div class="card">
        <div class="field"><label>Seu @ no Instagram (aparece nas artes)</label><input id="st-handle" value="${esc(s.handle)}" placeholder="@seuperfil"></div>
      </div>

      <button class="btn primary block" data-act="save">Salvar ajustes</button>

      <div class="section-title">Dados</div>
      <div class="card">
        <div class="row wrap">
          <button class="btn sm" data-act="export">Exportar backup</button>
          <button class="btn sm" data-act="import">Importar backup</button>
          <button class="btn sm" data-act="reset" style="border-color:#7a2a2a;color:#e0a0a0">Zerar progresso</button>
        </div>
        <input type="file" id="st-file" accept="application/json" hidden>
      </div>
      <p class="small muted" style="text-align:center;margin-top:20px">Bíblia do Empreendedor · Texto bíblico KJV (domínio público) via bible-api.com</p>
    `;
  }
  $('#view-settings').addEventListener('input', (e) => {
    if (e.target.id !== 'st-color') return;
    S.settings.accent = e.target.value; save(); applyTheme();
    document.querySelectorAll('.swatch').forEach((x) => x.classList.toggle('active', x.classList.contains('swatch-custom')));
  });
  $('#view-settings').addEventListener('click', async (e) => {
    const th = e.target.closest('[data-theme-opt]');
    if (th) { S.settings.theme = th.dataset.themeOpt; save(); applyTheme(); renderSettings(); return; }
    const ac = e.target.closest('[data-accent]');
    if (ac) { S.settings.accent = ac.dataset.accent; save(); applyTheme(); renderSettings(); toast('Cor aplicada'); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const s = S.settings;
    const collect = () => {
      s.apiKey = $('#st-key').value.trim();
      s.model = $('#st-model').value.trim() || 'gemini-flash-latest';
      s.aiPosts = $('#st-aiposts').checked;
      if (s.translation !== $('#st-tr').value) { s.translation = $('#st-tr').value; reader = { verses: null, loading: false, error: null, sel: null }; }
      s.goal = +$('#st-goal').value;
      s.handle = $('#st-handle').value.trim();
      if (s.handle && !s.handle.startsWith('@')) s.handle = '@' + s.handle;
      save();
    };
    switch (a.dataset.act) {
      case 'save': collect(); toast('Ajustes salvos'); break;
      case 'test':
        collect();
        a.textContent = 'Testando…';
        try { const r = await gemini([{ role: 'user', parts: [{ text: 'Responda apenas: Conectado! e um versículo curto com referência.' }] }]); toast('✓ IA conectada'); a.textContent = '✓ ' + r.slice(0, 60); }
        catch (err) { a.textContent = 'Testar conexão'; toast(err.message === 'NO_KEY' ? 'Cole a chave primeiro' : 'Falhou: ' + err.message.slice(0, 50)); }
        break;
      case 'export': {
        const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
        download(blob, `biblia-do-empreendedor-backup-${dateKey()}.json`); break;
      }
      case 'import': $('#st-file').click(); break;
      case 'reset':
        if (confirm('Zerar todo o progresso de leitura e tarefas? Esta ação não pode ser desfeita.')) {
          S.read = {}; S.readLog = {}; S.tasksDone = {}; S.last = { book: 'GEN', ch: 1 }; save(); toast('Progresso zerado');
        }
        break;
    }
  });
  $('#view-settings').addEventListener('change', async (e) => {
    if (e.target.id !== 'st-file' || !e.target.files[0]) return;
    try {
      const data = JSON.parse(await e.target.files[0].text());
      if (!data.settings) throw new Error();
      localStorage.setItem(KEY, JSON.stringify(data));
      S = load(); applyTheme(); toast('Backup importado'); renderSettings();
    } catch { toast('Arquivo inválido'); }
  });

  // ================= Inicialização =================
  const renderers = { home: renderHome, bible: renderBible, business: renderBusiness, create: renderCreate, mentor: renderMentor, tasks: renderTasks, settings: renderSettings };
  go((location.hash || '#home').slice(1));
  window.addEventListener('hashchange', () => {
    const v = location.hash.slice(1);
    if (v && v !== current) go(v);
  });

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
