/* Bíblia do Empreendedor — app */
(() => {
  'use strict';
  const SCRIPT_URL = document.currentScript?.src || location.href;

  // ================= Estado =================
  const KEY = 'bde:v1';
  const TOTAL_CHAPTERS = BOOKS.reduce((s, b) => s + b.c, 0);
  const TRANSLATIONS = {
    kjv: { short: 'KJV', name: 'King James Version (1611)' },
    almeida: { short: 'ALM', name: 'João Ferreira de Almeida' },
  };
  const defaults = {
    settings: { apiKey: '', claudeKey: '', provider: 'gemini', model: 'gemini-flash-latest', translation: 'kjv', goal: 3, handle: '', aiPosts: true, fontSize: 21, theme: 'dark', accent: '#d4af37' },
    read: {},          // { GEN: [1,2,3] }
    readLog: {},       // { '2026-11-02': 3 }
    last: { book: 'GEN', ch: 1 },
    tasksDone: {},     // { '2026-11-02': ['t1'] }
    chat: [],          // [{ role: 'user'|'model', text }]
    creative: null,    // { date, quote, ref, tag, caption, source, bg }
  };
  let S = load();
  // versões antigas usavam o modelo mais lento como padrão
  if (!S.settings.styleAutoSet) { S.settings.postStyle = 'auto'; S.settings.styleAutoSet = true; delete S.settings.textPos; }
  if (!S.settings.storeName) S.settings.storeName = 'RB Tech Celulares';
  // família Gemini 2.5 foi desativada pelo Google → migra para os apelidos atuais
  if (/^gemini-2\.5-flash-lite/.test(S.settings.model)) S.settings.model = 'gemini-flash-lite-latest';
  else if (/^gemini-2\.5/.test(S.settings.model)) S.settings.model = 'gemini-flash-latest';

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

  // Modelos gratuitos do Gemini (mais rápido → mais elaborado)
  const MODELS = [
    // apelidos "-latest" sempre apontam para a versão atual do Google (não quebram quando uma versão é desativada)
    { id: 'gemini-flash-lite-latest', name: '⚡ Ultra rápido — Flash-Lite' },
    { id: 'gemini-flash-latest', name: '🚀 Rápido e inteligente — Flash (recomendado)' },
  ];
  const DEFAULT_MODEL = 'gemini-flash-latest';

  // Desliga/reduz o "raciocínio" do modelo, que é o que deixa a resposta lenta
  function thinkingFor(model) {
    if (/pro/i.test(model)) return null;
    if (/2\.5/.test(model)) return { thinkingBudget: 0 };
    return { thinkingLevel: 'minimal' };
  }

  // Se um modelo for desativado pelo Google, descobre o Flash mais novo disponível para a chave
  async function discoverModel(key, lite) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`);
      if (!res.ok) return null;
      const list = ((await res.json()).models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m) => m.name.replace(/^models\//, ''))
        .filter((n) => /^gemini-[\d.]+-flash(-lite)?$/.test(n) && n.includes('lite') === lite);
      const ver = (n) => parseFloat(n.match(/gemini-([\d.]+)/)[1]);
      list.sort((a, b) => ver(b) - ver(a));
      return list[0] || null;
    } catch { return null; }
  }

  // ---------- Claude Haiku 5.5 (Anthropic, SDK oficial) ----------
  let anthropicMod = null;
  async function claudeChat(contents, { system = SYSTEM_MENTOR, onChunk = null, schema = null, maxTokens = 4096 } = {}) {
    const key = (S.settings.claudeKey || '').trim();
    if (!key) throw new Error('NO_KEY');
    if (!anthropicMod) anthropicMod = await import(new URL('vendor/anthropic-sdk.mjs', SCRIPT_URL).href);
    const Anthropic = anthropicMod.default;
    // chave fica só no aparelho do usuário (app pessoal, sem servidor)
    const client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
    const params = {
      model: 'claude-haiku-5-5',
      max_tokens: maxTokens,
      system,
      // respostas rápidas: sem raciocínio estendido e esforço baixo
      thinking: { type: 'disabled' },
      output_config: { effort: 'low', ...(schema ? { format: { type: 'json_schema', schema } } : {}) },
      messages: contents.map((c) => ({ role: c.role === 'model' ? 'assistant' : 'user', content: c.parts.map((p) => p.text).join('\n') })),
    };
    try {
      let msg;
      if (onChunk) {
        const stream = client.messages.stream(params);
        let text = '';
        for await (const event of stream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') { text += event.delta.text; onChunk(text); }
        }
        msg = await stream.finalMessage();
      } else {
        msg = await client.messages.create(params);
      }
      if (msg.stop_reason === 'refusal') throw new Error('A IA não pôde responder a esse pedido. Tente reformular.');
      const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      if (!text) throw new Error('A IA não retornou resposta. Tente reformular.');
      return text;
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) throw new Error('Chave do Claude inválida. Confira em Ajustes.');
      if (e instanceof Anthropic.RateLimitError) throw new Error('Muitas perguntas seguidas. Aguarde alguns segundos.');
      if (e instanceof Anthropic.BadRequestError && /credit/i.test(e.message)) throw new Error('Sua conta Anthropic está sem créditos (console.anthropic.com → Billing).');
      if (e instanceof Anthropic.APIConnectionError) throw new Error('Sem conexão com a Anthropic. Verifique a internet.');
      if (e instanceof Anthropic.APIError) throw new Error(e.message || 'Erro na API do Claude.');
      throw e;
    }
  }

  async function gemini(contents, { system = SYSTEM_MENTOR, json = false, temperature = 0.8, onChunk = null, maxTokens = 1200, schema = null } = {}) {
    if (S.settings.provider === 'claude') return claudeChat(contents, { system, onChunk, schema });
    const key = S.settings.apiKey.trim();
    if (!key) throw new Error('NO_KEY');
    const call = async (model, useThinking = true) => {
      const think = useThinking ? thinkingFor(model) : null;
      const stream = !!onChunk;
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:${stream ? 'streamGenerateContent?alt=sse&' : 'generateContent?'}key=${encodeURIComponent(key)}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents,
          generationConfig: {
            temperature, maxOutputTokens: maxTokens, seed: Math.floor(Math.random() * 2147483647),
            ...(json ? { responseMimeType: 'application/json' } : {}),
            ...(think ? { thinkingConfig: think } : {}),
          },
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const err = new Error(data.error?.message || `Erro ${res.status}`); err.status = res.status; throw err;
      }
      const partsText = (d) => (d.candidates?.[0]?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text || '').join('');
      let text = '';
      if (stream && res.body) {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
            if (!line.startsWith('data:')) continue;
            try { text += partsText(JSON.parse(line.slice(5))); onChunk(text); } catch { /* linha parcial */ }
          }
        }
      } else {
        text = partsText(await res.json());
      }
      text = text.trim();
      if (!text) throw new Error('A IA não retornou resposta. Tente reformular.');
      return text;
    };
    const callSafe = async (m) => {
      try { return await call(m); }
      catch (e) {
        // modelo não aceita a configuração de raciocínio → tenta sem ela
        if (e.status === 400 && /think/i.test(e.message)) return call(m, false);
        throw e;
      }
    };
    const model = S.settings.model.trim() || DEFAULT_MODEL;
    try { return await callSafe(model); }
    catch (e) {
      const gone = e.status === 404 || /no longer available|not found|not supported|deprecated|retired/i.test(e.message);
      if (!gone) throw e;
      // modelo desativado → usa o apelido atual ou descobre o mais novo disponível
      const lite = /lite/.test(model);
      const candidates = [lite ? 'gemini-flash-lite-latest' : 'gemini-flash-latest'];
      const found = await discoverModel(key, lite);
      if (found) candidates.push(found);
      for (const alt of candidates) {
        if (alt === model) continue;
        try {
          const r = await callSafe(alt);
          S.settings.model = alt; save();
          return r;
        } catch (e2) { /* tenta o próximo */ }
      }
      throw new Error('O modelo do Gemini escolhido foi desativado pelo Google e nenhum substituto respondeu. Tente outro modelo em Ajustes.');
    }
  }

  const hasAI = () => (S.settings.provider === 'claude' ? !!S.settings.claudeKey : !!S.settings.apiKey);

  let mentorBusy = false;
  function askMentor(text) {
    go('mentor');
    if (!hasAI()) { $('#mentor-input') && ($('#mentor-input').value = text); return; }
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
      const contents = S.chat.slice(-10).map((m) => ({ role: m.role, parts: [{ text: m.text }] }));
      let last = 0;
      const reply = await gemini(contents, {
        onChunk: (t) => {
          const el = document.getElementById('stream-msg');
          if (!el || Date.now() - last < 60) return;
          last = Date.now();
          el.classList.remove('typing'); el.innerHTML = md(t);
          if (window.innerHeight + window.scrollY > document.body.scrollHeight - 220) window.scrollTo({ top: document.body.scrollHeight });
        },
      });
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
    const hasKey = hasAI();
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
        <input id="quick-key" type="password" placeholder="Chave do Gemini (AIza...) ou do Claude (sk-ant...)" autocomplete="off">
        <button class="btn primary block" style="margin-top:10px" data-act="save-key">Ativar Mentor</button>
        <p class="small muted" style="margin:10px 0 0">A chave fica salva só neste aparelho.</p>
      </div>` : ''}
      <div class="chips" style="margin-bottom:14px">${S.chat.length ? '<button class="chip" data-act="clear">🗑 Nova conversa</button>' : ''}${chips.map((c) => `<button class="chip" data-q="${esc(c)}">${esc(c)}</button>`).join('')}</div>
      <div class="chat" id="chat">
        ${S.chat.length === 0 ? `<div class="msg ai"><p>Paz, empreendedor! Sou seu mentor bíblico. Pergunte sobre <strong>decisões, liderança, finanças, propósito</strong> ou peça a explicação de qualquer passagem. 🙏</p></div>` : ''}
        ${S.chat.map((m, i) => `<div class="msg ${m.role === 'user' ? 'user' : 'ai'}">${m.role === 'user' ? esc(m.text).replace(/\n/g, '<br>') : md(m.text) + (m.error ? '' : `<div style="margin-top:8px"><button class="chip" data-wa-msg="${i}" style="padding:5px 10px;font-size:12px">Enviar no WhatsApp</button></div>`)}</div>`).join('')}
        ${mentorBusy ? '<div class="msg ai typing" id="stream-msg"><span></span><span></span><span></span></div>' : ''}
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
      if (!hasAI()) { toast('Ative o Mentor com sua chave gratuita'); return; }
      input.value = ''; autosize(); sendMentor(v);
    };
    $('#mentor-send').onclick = submit;
  }
  $('#view-mentor').addEventListener('click', (e) => {
    const wm = e.target.closest('[data-wa-msg]');
    if (wm) { waText(`${S.chat[+wm.dataset.waMsg].text}\n\n_Mentor · Bíblia do Empreendedor_`); return; }
    const c = e.target.closest('[data-q]');
    if (c) { if (hasAI()) sendMentor(c.dataset.q); else { $('#mentor-input').value = c.dataset.q; toast('Ative o Mentor com sua chave gratuita'); } return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    if (a.dataset.act === 'clear') { S.chat = []; save(); renderMentor(); }
    if (a.dataset.act === 'save-key') {
      const k = $('#quick-key').value.trim();
      if (!k) { toast('Cole sua chave'); return; }
      if (k.startsWith('sk-ant')) { S.settings.claudeKey = k; S.settings.provider = 'claude'; }
      else { S.settings.apiKey = k; S.settings.provider = 'gemini'; }
      save(); toast('Mentor ativado ✨');
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
      S.creative = { date: dateKey(), bg: pick(Creative.backgrounds, dayNum()).id, aiTried: false, scene: pick(PHOTO_SCENES.palavra, dayNum()), ...localDaily() };
      save();
    }
    return S.creative;
  }
  function setCreative(c) {
    getDailyCreative();
    Object.assign(S.creative, c);
    save();
  }

  // ---------- Variedade: cada pedido à IA sai diferente ----------
  const ANGLES = [
    'gratidão', 'uma metáfora do dia a dia do comércio', 'um desafio prático para hoje', 'uma pergunta que faz pensar',
    'coragem para recomeçar', 'humor leve e acolhedor', 'esperança no processo', 'disciplina e constância', 'servir bem as pessoas',
    'família e propósito', 'fé no meio da pressão', 'pequenas vitórias', 'sabedoria para decidir', 'paz e confiança em Deus',
    'trabalho em equipe', 'excelência no atendimento', 'semear hoje para colher amanhã', 'descanso e equilíbrio',
  ];
  const BOOKS_HINT = ['Provérbios', 'Salmos', 'Eclesiastes', 'Isaías', 'Mateus', 'Lucas', 'João', 'Romanos', 'Filipenses', 'Colossenses', 'Tiago', 'Josué', 'Gálatas', '1 Coríntios', 'Hebreus', 'Deuteronômio', '2 Coríntios', 'Efésios'];
  const rnd = (arr) => arr[Math.floor(Math.random() * arr.length)];
  function aiHistory(kind) { S.aiHistory = S.aiHistory || {}; return (S.aiHistory[kind] = S.aiHistory[kind] || []); }
  function rememberAI(kind, text) {
    const h = aiHistory(kind);
    if (text) { h.push(text.slice(0, 160)); while (h.length > 25) h.shift(); save(); }
  }
  function avoidBlock(kind, extra = []) {
    const list = [...new Set([...aiHistory(kind), ...extra].filter(Boolean))].slice(-15);
    return list.length ? `\nNÃO repita nem reescreva de forma parecida nenhuma destas frases já usadas:\n${list.map((t) => `- ${t}`).join('\n')}` : '';
  }

  async function aiCreative() {
    const theme = rnd(THEMES);
    const prompt = `Crie o conteúdo do post de hoje (${longDate()}) para o perfil cristão "Bíblia do Empreendedor". Tema: ${theme}. Ângulo: ${rnd(ANGLES)}. Se escolher versículo, prefira um de ${rnd(BOOKS_HINT)} ou ${rnd(BOOKS_HINT)}, evitando os mais batidos.${avoidBlock('palavra', [getDailyCreative().quote])}
Escolha UM formato:
(a) um versículo ou provérbio bíblico, com tradução fiel da King James (KJV) para o português, e a referência exata; OU
(b) uma frase original, curta e marcante, sobre processo, Deus, fé e empreender (sem referência).
Responda SOMENTE em JSON: {"texto": "no máximo 170 caracteres", "referencia": "Livro cap:vers ou vazio", "tag": "2 a 3 palavras para o topo, ex: Palavra do Dia", "legenda": "legenda para Instagram com 3 a 5 frases curtas sobre o tema, uma chamada para ação e 8 hashtags, incluindo #bibliadoempreendedor", "cena": "descrição EM INGLÊS de uma foto cinematográfica e emocionante para o fundo da arte, ligada à mensagem (ex.: criança orando ao lado da cama, luz quente), sem texto"}`;
    const txt = await gemini([{ role: 'user', parts: [{ text: prompt }] }], {
      system: 'Você cria conteúdo cristão inspirador e fiel à Bíblia para empreendedores. Nunca invente versículos.', json: true, temperature: 1,
      schema: {
        type: 'object', additionalProperties: false, required: ['texto', 'referencia', 'tag', 'legenda', 'cena'],
        properties: { texto: { type: 'string' }, referencia: { type: 'string' }, tag: { type: 'string' }, legenda: { type: 'string' }, cena: { type: 'string' } },
      },
    });
    const j = JSON.parse(txt.replace(/^```(json)?|```$/g, '').trim());
    if (!j.texto) throw new Error('Resposta inválida');
    rememberAI('palavra', j.texto);
    return { quote: j.texto.replace(/^["“]|["”]$/g, ''), ref: j.referencia || '', tag: j.tag || 'Palavra do Dia', caption: j.legenda || buildCaption(j.texto, j.referencia), scene: j.cena || '', source: 'ia' };
  }

  // ---------- Bom dia da loja (um por dia da semana) ----------
  const WEEKDAY_NAMES = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
  const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const WEEKDAY_THEMES = ['gratidão e descanso em família', 'recomeço, foco e planejamento', 'persistência e constância', 'ânimo no meio da semana', 'confiança e fé no resultado', 'gratidão pela semana e celebração', 'atendimento, alegria e boas escolhas'];
  const BOMDIA_LOCAL = [
    ['Bom domingo! Dia de descansar, agradecer e recarregar a fé.', 'Domingo é dia de gratidão: Deus cuidou de cada detalhe da semana.'],
    ['Bom dia! Segunda é página em branco: escreva com fé e atitude.', 'Nova semana, novas bênçãos. Comece com Deus e o resto se alinha.'],
    ['Bom dia! Constância vence pressa. Bora fazer a terça valer.', 'Terça de foco: um passo de cada vez, sempre com Deus.'],
    ['Bom dia! Metade da semana, o dobro de fé.', 'Quarta-feira: o que Deus começou, Ele termina. Bom dia!'],
    ['Bom dia! Quem confia em Deus e trabalha certo não para no meio do caminho.', 'Quinta de confiança: o melhor ainda está por vir.'],
    ['Sextou com gratidão! Bom dia e uma ótima sexta para você.', 'Bom dia! Sexta é dia de agradecer cada conquista da semana.'],
    ['Bom sábado! Que hoje sobre sorriso, paz e boas notícias.', 'Sábado abençoado! Aproveite o dia e conte com a gente.'],
  ];
  const PHOTO_SCENES = {
    palavra: [
      'a small child kneeling beside a bed praying with folded hands, dim warm lamp light, cozy bedroom at night',
      'hands of a man folded in prayer over an open bible on a wooden desk, warm window light, dust particles in the air',
      'a businessman praying alone in a dark office at night, city lights through the window',
      'a woman reading a bible by a window at sunrise, golden hour light',
      'old empty wooden church interior with light rays through tall windows',
      'a man standing on a mountain top at sunrise with open arms, silhouette, epic sky',
      'father and son praying together at a dinner table, warm candle light',
      'an entrepreneur opening the door of a small shop at dawn, warm hopeful light',
    ],
    bomdia: [
      'cozy modern cell phone repair shop in the morning, technician repairing a smartphone with precision tools on a workbench, warm sunlight',
      'storefront of a modern smartphone store at sunrise, glass display with phones, warm golden light',
      'a cup of coffee next to a smartphone on a wooden counter of a phone store, morning sunlight, bokeh',
      'close up of hands holding a new smartphone, soft morning light, shallow depth of field',
      'a friendly phone store owner smiling behind the counter in the morning, warm light',
    ],
  };
  const PHOTO_STYLE = ', cinematic photography, moody warm light, film grain, shallow depth of field, emotional, photorealistic, vertical 9:16 composition with empty space at the top, no text, no letters, no logos, no watermark';

  const storeName = () => (S.settings.storeName || '').trim();
  function bomdiaCaption(day, frase) {
    const loja = storeName() || 'nossa loja';
    const tag = (storeName() || 'loja').toLowerCase().replace(/[^a-z0-9]/g, '');
    return `☀️ ${frase}\n\nAqui na ${loja} a gente começa o dia pedindo a bênção de Deus e pronto para cuidar de você e do seu celular. 📲\n\nPrecisa de assistência técnica, acessórios ou de um aparelho novo? Chama no direct ou no WhatsApp! 💬\n\n#bomdia #${WEEKDAY_NAMES[day].toLowerCase().replace(/[^a-zà-ú]/g, '')} #${tag} #assistenciatecnica #celular #iphone #acessorios #fe`;
  }
  function getBomDia(day) {
    S.bomdia = S.bomdia || {};
    const wk = weekNum();
    if (!S.bomdia[day] || S.bomdia[day].week !== wk) {
      const frase = pick(BOMDIA_LOCAL[day], wk);
      S.bomdia[day] = { week: wk, quote: frase, ref: '', tag: WEEKDAY_NAMES[day], caption: bomdiaCaption(day, frase), scene: pick(PHOTO_SCENES.bomdia, wk + day), source: 'local', bg: pick(Creative.backgrounds, wk + day).id };
      save();
    }
    return S.bomdia[day];
  }
  async function aiBomDia(day) {
    const loja = storeName() || 'uma loja de celulares';
    const prompt = `Crie uma mensagem de BOM DIA para ${WEEKDAY_NAMES[day]} para o Instagram da ${loja} (${S.settings.storeNiche || 'loja de celulares e assistência técnica'}${S.settings.storeCity ? ', em ' + S.settings.storeCity : ''}).
Tom: motivacional, positivo, com fé cristã leve e natural (sem pregação), ligado ao tema do dia: ${WEEKDAY_THEMES[day]}. Ângulo desta vez: ${rnd(ANGLES)}. Seja original e evite clichês como "página em branco" e "novo ciclo".${avoidBlock('bomdia', [getBomDia(day).quote])}
Responda SOMENTE em JSON: {"frase": "mensagem de bom dia curta e marcante para a arte, no máximo 110 caracteres", "legenda": "legenda para Instagram com 3 a 4 frases, citando a loja de forma natural, uma chamada para ação (assistência técnica, acessórios ou aparelhos) e 8 hashtags em português", "cena": "descrição EM INGLÊS de uma foto cinematográfica para o fundo da arte, ligada a celulares/loja/manhã/fé, sem texto"}`;
    const txt = await gemini([{ role: 'user', parts: [{ text: prompt }] }], {
      system: 'Você é um social media brasileiro especialista em conteúdo para lojas de celular, com valores cristãos.', json: true, temperature: 1,
      schema: { type: 'object', additionalProperties: false, required: ['frase', 'legenda', 'cena'], properties: { frase: { type: 'string' }, legenda: { type: 'string' }, cena: { type: 'string' } } },
    });
    const j = JSON.parse(txt.replace(/^```(json)?|```$/g, '').trim());
    if (!j.frase) throw new Error('Resposta inválida');
    rememberAI('bomdia', j.frase);
    return { quote: j.frase.replace(/^["“]|["”]$/g, ''), caption: j.legenda || bomdiaCaption(day, j.frase), scene: j.cena || pick(PHOTO_SCENES.bomdia, Date.now()), source: 'ia' };
  }

  // ---------- Foto de fundo (IA ou galeria) ----------
  const photos = { palavra: null, bomdia: null };
  const photoKey = (mode) => `bde:photo:${mode}`;
  function loadPhoto(mode) {
    if (photos[mode]) return Promise.resolve(photos[mode]);
    let data = null;
    try { data = localStorage.getItem(photoKey(mode)); } catch { /* sem armazenamento */ }
    if (!data) return Promise.resolve(null);
    return imgFrom(data).then((img) => (photos[mode] = img)).catch(() => null);
  }
  function imgFrom(src) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  }
  async function storePhoto(mode, src) {
    const img = await imgFrom(src);
    // normaliza para 1080x1920 JPEG (cabe no armazenamento do aparelho)
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1920;
    const ctx = cv.getContext('2d');
    const r = Math.max(1080 / img.width, 1920 / img.height);
    ctx.drawImage(img, (1080 - img.width * r) / 2, (1920 - img.height * r) / 2, img.width * r, img.height * r);
    const data = cv.toDataURL('image/jpeg', 0.84);
    try { localStorage.setItem(photoKey(mode), data); } catch { /* sem espaço: fica só na memória */ }
    photos[mode] = await imgFrom(data);
  }
  const blobToDataURL = (b) => new Promise((res) => { const r = new FileReader(); r.onload = () => res(r.result); r.readAsDataURL(b); });

  async function geminiImage(prompt) {
    const key = (S.settings.apiKey || '').trim();
    if (!key) throw new Error('sem chave do Gemini');
    const list = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=200&key=${encodeURIComponent(key)}`).then((r) => r.json());
    const names = (list.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => m.name.replace(/^models\//, ''))
      .filter((n) => /image/.test(n) && /gemini/.test(n));
    names.sort((a, b) => (/flash/.test(b) - /flash/.test(a)) || b.localeCompare(a));
    for (const model of names.slice(0, 3)) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(key)}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'], imageConfig: { aspectRatio: '9:16' } } }),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const part = (data.candidates?.[0]?.content?.parts || []).find((p) => p.inlineData?.data);
      if (part) return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
    }
    throw new Error('Gemini sem geração de imagem disponível');
  }
  async function freeImage(prompt) {
    // serviço gratuito Pollinations (sem chave)
    const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1080&height=1920&nologo=true&seed=${Math.floor(Math.random() * 1e6)}`;
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 90000);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok || !(res.headers.get('content-type') || '').startsWith('image')) throw new Error('falhou');
      return await blobToDataURL(await res.blob());
    } finally { clearTimeout(t); }
  }
  async function generatePhoto(mode) {
    const c = cur();
    const prompt = (c.scene || pick(PHOTO_SCENES[mode], Date.now())) + PHOTO_STYLE;
    let src = null;
    if (S.settings.provider !== 'claude' && S.settings.apiKey) { try { src = await geminiImage(prompt); } catch { /* tenta o gratuito */ } }
    if (!src) src = await freeImage(prompt);
    await storePhoto(mode, src);
  }

  // ---------- Estado do estúdio ----------
  let createState = { format: 'post', busy: false, photoBusy: false, mode: 'palavra', day: new Date().getDay() };
  const cur = () => (createState.mode === 'bomdia' ? getBomDia(createState.day) : getDailyCreative());
  function setCur(obj) {
    if (createState.mode === 'bomdia') { Object.assign(getBomDia(createState.day), obj); save(); } else setCreative(obj);
  }
  const style = () => S.settings.postStyle || 'auto';
  // "Variar": alterna o estilo a cada dia (Cartão, Foto quando houver foto, Fundos)
  function effStyle() {
    const st = style();
    if (st !== 'auto') return st;
    const opts = photos[createState.mode] ? ['card', 'photo', 'classic'] : ['card', 'classic'];
    const n = createState.mode === 'bomdia' ? weekNum() + createState.day : dayNum();
    return pick(opts, n);
  }
  const CARD_TITLES = [(m, r) => `Que ${m} seja o que Deus diz em ${r}`, (m, r) => `O que Deus diz hoje em ${r}`, (m, r) => `Uma palavra para o seu dia: ${r}`];
  function cardTitle(c) {
    if (c.title) return c.title;
    if (createState.mode === 'bomdia') return `Bom dia, ${WEEKDAY_NAMES[createState.day].toLowerCase()}!`;
    if (c.ref) return pick(CARD_TITLES, dayNum())(MONTHS[new Date().getMonth()], c.ref);
    return c.tag || 'Reflexão do dia';
  }
  const tint = () => 'dark'; // película sempre escura
  const tintAmount = () => (S.settings.photoTintAmount ?? 35);
  const textScale = () => (S.settings.textScale ?? 100);
  const textFont = () => S.settings.textFont || (effStyle() === 'photo' ? 'hand' : 'serif');
  const cardTint = () => (S.settings.cardTint ?? 10);
  const cardBlur = () => (S.settings.cardBlur ?? 40);
  const cardOpacity = () => (S.settings.cardOpacity ?? 93);
  const textPos = () => S.settings.textPos ?? (effStyle() === 'photo' ? 32 : 50);

  function renderCreate() {
    getDailyCreative();
    const c = cur();
    if (S.creativeSeen !== dateKey()) { S.creativeSeen = dateKey(); save(); }
    const bomdia = createState.mode === 'bomdia';
    const photoStyle = effStyle() === 'photo';
    const cardStyle = effStyle() === 'card';
    const el = $('#view-create');
    const WA_ICON = '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm5.8 14.1c-.2.7-1.4 1.3-2 1.4-.5.1-1.2.1-1.9-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3.1s.8-2.2 1-2.5c.3-.3.6-.4.8-.4h.6c.2 0 .4 0 .6.5l.9 2.1c.1.1.1.3 0 .5l-.3.5-.4.5c-.1.1-.3.3-.1.6.2.3.8 1.3 1.7 2.1 1.2 1 2.1 1.4 2.4 1.5.3.1.5.1.6-.1l.9-1.1c.2-.3.4-.2.6-.1l2 .9c.3.1.5.2.5.3.1.1.1.7-.1 1.4z"/></svg>';
    const slider = (id, label, min, max, val, unit = '%') => `
      <div class="sl-row"><span class="sl-label">${label}</span>
        <input type="range" data-slider="${id}" min="${min}" max="${max}" step="1" value="${val}">
        <span class="sl-val" data-slval="${id}">${val}${unit}</span></div>`;
    el.innerHTML = `
      <div class="studio-top">
        <div class="mini-seg">
          <button class="${!bomdia ? 'active' : ''}" data-mode="palavra">📖 Palavra</button>
          <button class="${bomdia ? 'active' : ''}" data-mode="bomdia">☀️ Bom dia loja</button>
        </div>
        <div class="mini-seg">
          <button class="${createState.format === 'post' ? 'active' : ''}" data-fmt="post">4:5</button>
          <button class="${createState.format === 'story' ? 'active' : ''}" data-fmt="story">9:16</button>
        </div>
      </div>
      ${bomdia ? `<div class="chips mini" style="margin-bottom:8px">${WEEKDAY_SHORT.map((d, i) => `<button class="chip ${createState.day === i ? 'active' : ''}" data-day="${i}">${d}${i === new Date().getDay() ? '•' : ''}</button>`).join('')}</div>` : ''}

      <div class="studio-preview ${createState.format === 'story' ? 'story' : ''}"><canvas id="cv"></canvas></div>

      <div class="studio-scroll">
      <div class="studio-panel">
        <button class="btn primary block magic" data-act="ai-art" ${createState.artBusy ? 'disabled' : ''}>${createState.artBusy ? `⏳ ${esc(createState.artStep || 'Criando arte…')}` : '🪄 Arte com IA'}</button>
        <div class="ctl-row">
          <div class="mini-seg">
            ${[['auto', '🔀 Variar'], ['card', 'Cartão'], ['photo', 'Foto'], ['classic', 'Fundos']].map(([k, n]) => `<button class="${style() === k ? 'active' : ''}" data-style="${k}">${n}</button>`).join('')}
          </div>
        </div>
        <div class="ctl-row">
          <label class="mbtn accent" title="Foto da galeria">🖼️ Galeria<input type="file" accept="image/*" id="photo-file" hidden></label>
          <button class="mbtn" data-act="gen-photo" ${createState.photoBusy ? 'disabled' : ''}>${createState.photoBusy ? '⏳ Gerando…' : '✨ Foto IA'}</button>
        </div>
        ${photoStyle ? `
          ${slider('tint', 'Película', 0, 85, tintAmount())}`
        : cardStyle ? `
          ${slider('cardtint', 'Película', 0, 85, cardTint())}
          ${slider('blur', 'Desfoque', 0, 100, cardBlur())}
          ${slider('cardop', 'Cartão', 20, 100, cardOpacity())}`
        : `<div class="bg-picker mini">${Creative.backgrounds.map((b) => `<button class="bg-thumb ${c.bg === b.id ? 'active' : ''}" data-bg="${b.id}" title="${esc(b.name)}"><canvas data-thumb="${b.id}"></canvas></button>`).join('')}</div>`}
        ${!cardStyle ? `<div class="ctl-row"><span class="sl-label">Letra</span><div class="chips mini" style="flex:1;min-width:0;padding:0">${Object.entries(Creative.FONTS).map(([k, f]) => `<button class="chip ${textFont() === k ? 'active' : ''}" data-font="${k}" style="font-family:${esc(f.css)}">${f.name}</button>`).join('')}</div></div>` : ''}
        ${slider('size', 'Tamanho', 60, 150, textScale())}
        ${slider('pos', 'Posição', 10, 85, textPos())}

        <div class="ctl-row" style="margin-top:4px">
          <button class="mbtn" data-act="ai" ${createState.busy ? 'disabled' : ''}>${createState.busy ? '⏳ Criando…' : '✨ Texto IA'}</button>
          ${bomdia ? '<button class="mbtn" data-act="bomdia-local">🔄 Outra</button>' : '<button class="mbtn" data-act="proverb">📖 Provérbio</button><button class="mbtn" data-act="frase">💡 Frase</button>'}
          <button class="mbtn" data-act="edit">✏️ Editar</button>
        </div>
        <div class="ctl-row share-row">
          <button class="mbtn ig" data-act="story">📲 Stories</button>
          <button class="mbtn wa" data-act="wa">${WA_ICON} WhatsApp</button>
          <button class="mbtn" data-act="share">↗ Enviar</button>
          <button class="mbtn" data-act="download">⬇ Baixar</button>
        </div>
      </div>

      ${bomdia && !storeName() ? '<p class="notice" style="margin:12px 0 0">Coloque o nome da sua loja em <b>Ajustes → Sua empresa</b> para a IA citar a loja nas mensagens.</p>' : ''}
      <div class="section-title">Legenda</div>
      <div class="caption-box">${esc(c.caption)}</div>
      <div class="row wrap" style="margin-top:10px">
        <button class="mbtn" data-act="copy-caption">📋 Copiar legenda</button>
        <button class="mbtn" data-act="download-both">⬇ Post + stories</button>
      </div>
      ${!hasAI() ? '<p class="notice" style="margin-top:16px">Dica: adicione sua chave gratuita do Gemini em Ajustes para que a IA crie textos e fotos novos todos os dias.</p>' : ''}
      <div style="height:24px"></div>
      </div>
    `;
    Creative.ensureFonts().then(async () => {
      if (photoStyle) await loadPhoto(createState.mode);
      drawPreview();
      el.querySelectorAll('[data-thumb]').forEach((cv) => Creative.thumb(cv, cv.dataset.thumb));
    });
    // IA cria automaticamente o texto da Palavra uma vez por dia
    const daily = getDailyCreative();
    if (!bomdia && hasAI() && S.settings.aiPosts && !daily.aiTried && daily.source === 'local') {
      daily.aiTried = true; save();
      runAI(true);
    }
  }

  function renderOpts(format) {
    const c = cur();
    const bomdia = createState.mode === 'bomdia';
    return {
      format, bg: c.bg, seed: bomdia ? weekNum() + createState.day : dayNum(), quote: c.quote, ref: c.ref, tag: c.tag,
      date: bomdia ? '' : shortDate(), handle: S.settings.handle,
      brand: bomdia && storeName() ? storeName() : 'Bíblia do Empreendedor',
      photo: photos[createState.mode], tint: tint(), tintAmount: tintAmount(),
      textScale: textScale() / 100, textPos: textPos() / 100, font: textFont(),
      month: MONTHS[new Date().getMonth()].replace(/^./, (x) => x.toUpperCase()),
      title: cardTitle(c),
      cardQuote: bomdia ? c.quote.replace(/^bom (dia|domingo|s[áa]bado)[!,.]?\s*/i, '') || c.quote : c.quote,
      cardBrand: storeName() || 'Bíblia do Empreendedor',
    };
  }
  function paint(cv, format) {
    const o = renderOpts(format);
    const st = effStyle();
    if (st === 'card') return Creative.renderCard(cv, { ...o, quote: o.cardQuote, brand: o.cardBrand, tintAmount: cardTint(), blur: cardBlur(), cardOpacity: cardOpacity() });
    return st === 'photo' ? Creative.renderPhoto(cv, o) : Creative.render(cv, o);
  }
  function drawPreview() {
    const cv = $('#cv');
    if (cv) paint(cv, createState.format);
  }

  async function runAI(auto = false) {
    const mode = createState.mode, day = createState.day;
    createState.busy = true;
    if (current === 'create') renderCreate();
    try {
      if (mode === 'bomdia') { Object.assign(getBomDia(day), await aiBomDia(day)); save(); }
      else setCreative(await aiCreative());
      if (!auto) toast('Novo texto criado ✨');
    } catch (e) {
      if (!auto) toast(e.message === 'NO_KEY' ? 'Configure a IA em Ajustes' : `IA não respondeu: ${String(e.message || '').slice(0, 70)}`);
    }
    createState.busy = false;
    if (current === 'create') renderCreate();
  }

  // ---------- 🪄 Arte com IA: a IA monta a combinação completa ----------
  const ART_STYLES = { cartao: 'card', foto: 'photo', fundos: 'classic' };
  function applyArt(a) {
    const st = S.settings;
    st.postStyle = ART_STYLES[a.estilo] || 'card';
    if (Creative.FONTS[a.letra]) st.textFont = a.letra; else delete st.textFont;
    st.photoTint = 'dark';
    const amt = Math.max(0, Math.min(80, Math.round(+a.intensidade || 35)));
    if (st.postStyle === 'card') st.cardTint = Math.min(amt, 50); else st.photoTintAmount = amt;
    st.textScale = Math.max(70, Math.min(140, Math.round(+a.tamanho || 100)));
    st.textPos = Math.max(15, Math.min(80, Math.round(+a.posicao || (st.postStyle === 'photo' ? 32 : 50))));
    const content = { quote: (a.frase || '').replace(/^["“]|["”]$/g, ''), caption: a.legenda || '', scene: a.cena || '', title: a.titulo || '', source: 'ia' };
    if (createState.mode !== 'bomdia') Object.assign(content, { ref: a.referencia || '', tag: a.tag || 'Palavra do Dia' });
    if (Creative.backgrounds.some((b) => b.id === a.fundo)) content.bg = a.fundo;
    if (!content.quote) delete content.quote;
    if (!content.caption) delete content.caption;
    setCur(content);
    save();
  }
  function localArt() {
    const r = (arr) => arr[Math.floor(Math.random() * arr.length)];
    const bomdia = createState.mode === 'bomdia';
    const p = r(PROVERBS);
    return {
      estilo: r(['cartao', 'foto', 'fundos']), letra: r(Object.keys(Creative.FONTS)), fundo: r(Creative.backgrounds).id,
      intensidade: 30 + Math.floor(Math.random() * 30), tamanho: 100, posicao: 0,
      frase: bomdia ? r(BOMDIA_LOCAL[createState.day]) : p.texto, referencia: bomdia ? '' : p.ref, tag: 'Palavra do Dia', titulo: '',
      cena: r(PHOTO_SCENES[bomdia ? 'bomdia' : 'palavra']), legenda: bomdia ? bomdiaCaption(createState.day, r(BOMDIA_LOCAL[createState.day])) : buildCaption(p.texto, p.ref),
    };
  }
  async function aiArt() {
    const bomdia = createState.mode === 'bomdia';
    const bgs = Creative.backgrounds.map((b) => `${b.id} (${b.name})`).join(', ');
    const fonts = Object.entries(Creative.FONTS).map(([k, f]) => `${k} (${f.name})`).join(', ');
    const tema = bomdia
      ? `uma mensagem de BOM DIA para ${WEEKDAY_NAMES[createState.day]} da ${storeName() || 'loja'} (${S.settings.storeNiche || 'loja de celulares e assistência técnica'}), motivacional com fé cristã leve, tema do dia: ${WEEKDAY_THEMES[createState.day]}`
      : `a Palavra do dia do perfil cristão "Bíblia do Empreendedor": um versículo/provérbio (tradução fiel da King James para o português, com referência exata) OU uma frase original curta sobre processo, Deus e empreender`;
    const kind = bomdia ? 'bomdia' : 'palavra';
    const prompt = `Você é diretor de arte de Instagram. Crie UMA arte completa e harmoniosa para ${tema}. Ângulo desta vez: ${rnd(ANGLES)}.${avoidBlock(kind, [cur().quote])}
Escolha a combinação que combina melhor com a mensagem:
- estilo: "cartao" (foto desfocada + cartão claro com título e frase com marca-texto, delicado), "foto" (foto cinematográfica + frase grande por cima, emocionante) ou "fundos" (fundo gráfico elegante preto e dourado, sóbrio).
- fundo (só para "fundos"): um destes ids: ${bgs}.
- letra (para "foto" e "fundos"): um destes ids: ${fonts}.
- intensidade da película escura sobre a foto: 0 a 80.
- tamanho do texto: 80 a 130 (100 = normal); posicao vertical do texto: 15 a 80 (% da altura).
- cena: descrição EM INGLÊS de uma foto cinematográfica para o fundo, ligada à mensagem, sem texto.
Responda SOMENTE em JSON: {"estilo": "", "fundo": "", "letra": "", "intensidade": 0, "tamanho": 100, "posicao": 50, "frase": "no máximo 130 caracteres", "referencia": "Livro cap:vers ou vazio", "tag": "2 a 3 palavras", "titulo": "título curto para o estilo cartão", "cena": "", "legenda": "legenda de Instagram com 3 a 5 frases, chamada para ação e 8 hashtags"}`;
    const str = { type: 'string' }, num = { type: 'number' };
    const txt = await gemini([{ role: 'user', parts: [{ text: prompt }] }], {
      system: 'Você é um diretor de arte cristão, criativo e com bom gosto. Nunca invente versículos.', json: true, temperature: 1,
      schema: { type: 'object', additionalProperties: false, required: ['estilo', 'fundo', 'letra', 'intensidade', 'tamanho', 'posicao', 'frase', 'referencia', 'tag', 'titulo', 'cena', 'legenda'],
        properties: { estilo: { type: 'string', enum: ['cartao', 'foto', 'fundos'] }, fundo: str, letra: str, intensidade: num, tamanho: num, posicao: num, frase: str, referencia: str, tag: str, titulo: str, cena: str, legenda: str } },
    });
    const art = JSON.parse(txt.replace(/^```(json)?|```$/g, '').trim());
    rememberAI(kind, art.frase);
    return art;
  }
  async function runArt() {
    const mode = createState.mode;
    createState.artBusy = true; createState.artStep = 'A IA está montando a arte…'; renderCreate();
    let art, usedAI = false;
    try { if (hasAI()) { art = await aiArt(); usedAI = true; } } catch { /* usa combinação local */ }
    if (!art) art = localArt();
    applyArt(art);
    if (S.settings.postStyle !== 'classic') {
      createState.artStep = 'Criando a foto de fundo… (até 1 min)'; renderCreate();
      try { await generatePhoto(mode); } catch { toast('Arte criada, mas a foto não pôde ser gerada. Use a Galeria se quiser.'); }
    }
    createState.artBusy = false; createState.artStep = '';
    if (current === 'create') renderCreate();
    toast(usedAI ? 'Arte criada pela IA 🪄' : 'Combinação surpresa criada 🪄');
  }

  async function runPhoto() {
    const mode = createState.mode;
    createState.photoBusy = true; renderCreate();
    try { await generatePhoto(mode); toast('Foto criada ✨'); }
    catch { toast('Não consegui gerar a foto agora. Tente de novo ou use uma foto sua.'); }
    createState.photoBusy = false;
    if (current === 'create') renderCreate();
  }

  function canvasBlob(format) {
    const cv = document.createElement('canvas');
    paint(cv, format);
    return new Promise((res) => cv.toBlob(res, 'image/png'));
  }
  function download(blob, name) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  const fileName = (format) => `${createState.mode === 'bomdia' ? 'bom-dia' : 'palavra'}-${format === 'post' ? 'post' : 'stories'}-${dateKey()}.png`;

  $('#view-create').addEventListener('input', (e) => {
    const id = e.target.dataset?.slider;
    if (!id) return;
    const v = +e.target.value;
    if (id === 'tint') S.settings.photoTintAmount = v;
    if (id === 'size') S.settings.textScale = v;
    if (id === 'pos') S.settings.textPos = v;
    if (id === 'cardtint') S.settings.cardTint = v;
    if (id === 'blur') S.settings.cardBlur = v;
    if (id === 'cardop') S.settings.cardOpacity = v;
    const lab = document.querySelector(`[data-slval="${id}"]`);
    if (lab) lab.textContent = `${v}%`;
    drawPreview();
  });
  $('#view-create').addEventListener('change', (e) => { if (e.target.dataset?.slider) save(); });
  $('#view-create').addEventListener('change', async (e) => {
    if (e.target.id !== 'photo-file' || !e.target.files[0]) return;
    try { await storePhoto(createState.mode, await blobToDataURL(e.target.files[0])); S.settings.postStyle = 'photo'; save(); toast('Foto aplicada'); }
    catch { toast('Não consegui abrir essa imagem'); }
    renderCreate();
  });

  $('#view-create').addEventListener('click', async (e) => {
    const m = e.target.closest('[data-mode]');
    if (m) { createState.mode = m.dataset.mode; renderCreate(); return; }
    const d = e.target.closest('[data-day]');
    if (d) { createState.day = +d.dataset.day; renderCreate(); return; }
    const fb = e.target.closest('[data-font]');
    if (fb) { S.settings.textFont = fb.dataset.font; save(); renderCreate(); return; }
    const tb = e.target.closest('[data-tint]');
    if (tb) {
      S.settings.photoTint = tb.dataset.tint;
      // ponto de partida agradável para cada tipo de película
      if (S.settings.photoTintAmount == null || (tb.dataset.tint === 'light' && tintAmount() < 30)) S.settings.photoTintAmount = tb.dataset.tint === 'light' ? 45 : 35;
      save(); renderCreate(); return;
    }
    const st = e.target.closest('[data-style]');
    if (st) { S.settings.postStyle = st.dataset.style; delete S.settings.textPos; save(); renderCreate(); return; }
    const f = e.target.closest('[data-fmt]');
    if (f) { createState.format = f.dataset.fmt; renderCreate(); return; }
    const bgb = e.target.closest('[data-bg]');
    if (bgb) {
      setCur({ bg: bgb.dataset.bg });
      document.querySelectorAll('.bg-thumb').forEach((x) => x.classList.toggle('active', x === bgb));
      drawPreview(); return;
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    await Creative.ensureFonts();
    const c = cur();
    switch (a.dataset.act) {
      case 'gen-photo': runPhoto(); break;
      case 'ai-art': runArt(); break;
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
      case 'bomdia-local': {
        const day = createState.day;
        const opts = BOMDIA_LOCAL[day].filter((x) => x !== c.quote);
        const fr = opts[Math.floor(Math.random() * opts.length)] || BOMDIA_LOCAL[day][0];
        setCur({ quote: fr, caption: bomdiaCaption(day, fr), source: 'local' });
        renderCreate(); break;
      }
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
    const c = cur();
    openSheet(`
      <h3>Editar texto</h3>
      <div class="field"><label>Tag do topo</label><input id="ed-tag" value="${esc(c.tag)}"></div>
      <div class="field"><label>Título do cartão (opcional)</label><input id="ed-title" value="${esc(c.title || '')}" placeholder="${esc(cardTitle({ ...c, title: '' }))}"></div>
      <div class="field"><label>Mensagem</label><textarea id="ed-quote" rows="4">${esc(c.quote)}</textarea></div>
      <div class="field"><label>Referência (opcional)</label><input id="ed-ref" value="${esc(c.ref)}" placeholder="Ex.: Provérbios 16:3"></div>
      <div class="field"><label>Legenda</label><textarea id="ed-cap" rows="6">${esc(c.caption)}</textarea></div>
      <div class="field"><label>Cena da foto (para a IA, em inglês)</label><textarea id="ed-scene" rows="2" placeholder="ex.: child praying by the bed, warm lamp light">${esc(c.scene || '')}</textarea></div>
      <button class="btn primary block" id="ed-save">Aplicar</button>`);
    $('#ed-save').onclick = () => {
      setCur({ tag: $('#ed-tag').value.trim(), quote: $('#ed-quote').value.trim() || c.quote, ref: $('#ed-ref').value.trim(), caption: $('#ed-cap').value, scene: $('#ed-scene').value.trim(), title: $('#ed-title').value.trim() });
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
        <div class="field"><label>Provedor da IA</label>
          <div class="seg" id="st-provider">
            <button type="button" class="${s.provider !== 'claude' ? 'active' : ''}" data-provider="gemini">Google Gemini · grátis</button>
            <button type="button" class="${s.provider === 'claude' ? 'active' : ''}" data-provider="claude">Claude Haiku 5.5 · pago</button>
          </div>
        </div>
        <div class="field" ${s.provider === 'claude' ? '' : 'hidden'}>
          <label>Chave da API da Anthropic (Claude)</label>
          <input id="st-ckey" type="password" value="${esc(s.claudeKey || '')}" placeholder="sk-ant-..." autocomplete="off">
          <p class="small muted" style="margin:6px 0 0">Crie em <a href="https://console.anthropic.com/settings/keys" target="_blank" rel="noopener">console.anthropic.com</a> e adicione créditos (a partir de US$ 5). Custo do Haiku 5.5: cerca de US$ 0,0005 por resposta.</p>
        </div>
        <div ${s.provider === 'claude' ? 'hidden' : ''}>
        <div class="field">
          <label>Chave da API do Google Gemini (gratuita)</label>
          <input id="st-key" type="password" value="${esc(s.apiKey)}" placeholder="AIza..." autocomplete="off">
          <p class="small muted" style="margin:6px 0 0">Crie grátis em <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">aistudio.google.com/apikey</a>.</p>
        </div>
        <div class="field">
          <label>Modelo</label>
          <select id="st-model">${MODELS.map((m) => `<option value="${m.id}" ${s.model === m.id ? 'selected' : ''}>${esc(m.name)}</option>`).join('')}
            ${MODELS.some((m) => m.id === s.model) ? '' : `<option value="${esc(s.model)}" selected>${esc(s.model)}</option>`}</select>
        </div>
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

      <div class="section-title">Sua empresa</div>
      <div class="card">
        <div class="field"><label>Nome da loja / empresa</label><input id="st-store" value="${esc(s.storeName || '')}" placeholder="Ex.: RB Tech Celulares"></div>
        <div class="field"><label>Segmento</label><input id="st-niche" value="${esc(s.storeNiche || 'loja de celulares e assistência técnica')}"></div>
        <div class="field"><label>Cidade (opcional)</label><input id="st-city" value="${esc(s.storeCity || '')}" placeholder="Ex.: Florianópolis"></div>
        <div class="field" style="margin:0"><label>Seu @ no Instagram (aparece nas artes)</label><input id="st-handle" value="${esc(s.handle)}" placeholder="@seuperfil"></div>
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
    const pv = e.target.closest('[data-provider]');
    if (pv) {
      const st = S.settings;
      st.apiKey = $('#st-key').value.trim(); st.claudeKey = $('#st-ckey').value.trim();
      st.provider = pv.dataset.provider; save(); renderSettings(); return;
    }
    const th = e.target.closest('[data-theme-opt]');
    if (th) { S.settings.theme = th.dataset.themeOpt; save(); applyTheme(); renderSettings(); return; }
    const ac = e.target.closest('[data-accent]');
    if (ac) { S.settings.accent = ac.dataset.accent; save(); applyTheme(); renderSettings(); toast('Cor aplicada'); return; }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const s = S.settings;
    const collect = () => {
      s.apiKey = $('#st-key').value.trim();
      s.claudeKey = $('#st-ckey').value.trim();
      if (s.model !== $('#st-model').value) s.modelChosen = true;
      s.model = $('#st-model').value || DEFAULT_MODEL;
      s.aiPosts = $('#st-aiposts').checked;
      if (s.translation !== $('#st-tr').value) { s.translation = $('#st-tr').value; reader = { verses: null, loading: false, error: null, sel: null }; }
      s.goal = +$('#st-goal').value;
      s.handle = $('#st-handle').value.trim();
      s.storeName = $('#st-store').value.trim();
      s.storeNiche = $('#st-niche').value.trim();
      s.storeCity = $('#st-city').value.trim();
      S.bomdia = {}; // regenera os bons dias com o nome novo
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
