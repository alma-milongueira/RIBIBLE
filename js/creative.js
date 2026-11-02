/* Gerador de artes para Post (1080x1350) e Stories (1080x1920) */
const Creative = (() => {
  // cores da marca (personalizáveis)
  const hexRgb = (h) => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map((c) => c + c).join(''); const n = parseInt(h, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
  const rgbHex = (r) => '#' + r.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
  const mix = (a, b, t) => { const x = hexRgb(a), y = hexRgb(b); return rgbHex(x.map((v, i) => v + (y[i] - v) * t)); };
  const C = {};
  function setAccent(hex) {
    C.a = hex; C.l = mix(hex, '#ffffff', 0.45); C.d = mix(hex, '#000000', 0.38);
    C.rgb = hexRgb(hex).join(','); C.lrgb = hexRgb(C.l).join(',');
    C.deep = mix(hex, '#000000', 0.84); C.mid = mix(hex, '#000000', 0.55); C.dark2 = mix(hex, '#000000', 0.9);
    C.ink = mix(hex, '#000000', 0.45);
  }
  setAccent('#d4af37');

  function mulberry32(seed) {
    return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function goldGrad(ctx, x0, y0, x1, y1) {
    const g = ctx.createLinearGradient(x0, y0, x1, y1);
    g.addColorStop(0, C.l);
    g.addColorStop(0.5, C.a);
    g.addColorStop(1, C.d);
    return g;
  }

  function vignette(ctx, W, H, strength = 0.75) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.25, W / 2, H / 2, Math.max(W, H) * 0.75);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${strength})`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  }

  // ---------- Fundos ----------
  const backgrounds = [
    {
      id: 'ouro', name: 'Ouro Real',
      draw(ctx, W, H) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        let g = ctx.createRadialGradient(W / 2, H * 0.12, 10, W / 2, H * 0.12, H * 0.8);
        g.addColorStop(0, `rgba(${C.rgb},.42)`); g.addColorStop(0.45, `rgba(${hexRgb(C.d).join(',')},.14)`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = goldGrad(ctx, 0, 0, W, H); ctx.lineWidth = 3;
        ctx.strokeRect(40, 40, W - 80, H - 80);
        ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${C.rgb},.45)`;
        ctx.strokeRect(56, 56, W - 112, H - 112);
      },
    },
    {
      id: 'skyline', name: 'Skyline',
      draw(ctx, W, H, rng) {
        let g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#000'); g.addColorStop(0.65, C.dark2); g.addColorStop(1, C.deep);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        // estrelas
        for (let i = 0; i < 120; i++) {
          ctx.fillStyle = `rgba(${C.lrgb},${rng() * 0.5})`;
          ctx.fillRect(rng() * W, rng() * H * 0.55, 2, 2);
        }
        // prédios
        const base = H;
        let x = -20;
        while (x < W + 20) {
          const w = 50 + rng() * 90;
          const h = H * (0.12 + rng() * 0.28);
          ctx.fillStyle = '#050505';
          ctx.fillRect(x, base - h, w, h);
          ctx.strokeStyle = `rgba(${C.rgb},.35)`; ctx.lineWidth = 1.5;
          ctx.strokeRect(x, base - h, w, h);
          for (let wy = base - h + 14; wy < base - 10; wy += 22) {
            for (let wx = x + 10; wx < x + w - 12; wx += 18) {
              if (rng() > 0.55) { ctx.fillStyle = `rgba(${C.lrgb},${0.25 + rng() * 0.55})`; ctx.fillRect(wx, wy, 7, 10); }
            }
          }
          x += w + 4;
        }
        g = ctx.createLinearGradient(0, H * 0.45, 0, H);
        g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      },
    },
    {
      id: 'crescimento', name: 'Crescimento',
      draw(ctx, W, H, rng) {
        ctx.fillStyle = '#030303'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = `rgba(${C.rgb},.07)`; ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        const n = 9, bw = W / (n * 1.6), gap = (W - n * bw) / (n + 1);
        const pts = [];
        for (let i = 0; i < n; i++) {
          const h = H * (0.08 + (i / n) * 0.42 + rng() * 0.06);
          const x = gap + i * (bw + gap);
          const g = ctx.createLinearGradient(0, H - h, 0, H);
          g.addColorStop(0, `rgba(${C.rgb},.32)`); g.addColorStop(1, `rgba(${C.rgb},.02)`);
          ctx.fillStyle = g; ctx.fillRect(x, H - h, bw, h);
          pts.push([x + bw / 2, H - h - 30]);
        }
        ctx.strokeStyle = `rgba(${C.lrgb},.55)`; ctx.lineWidth = 4; ctx.lineJoin = 'round';
        ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        const [lx, ly] = pts[pts.length - 1];
        ctx.fillStyle = `rgba(${C.lrgb},.7)`;
        ctx.beginPath(); ctx.moveTo(lx + 34, ly - 26); ctx.lineTo(lx - 6, ly - 22); ctx.lineTo(lx + 20, ly + 10); ctx.fill();
        vignette(ctx, W, H, 0.8);
      },
    },
    {
      id: 'marmore', name: 'Mármore Negro',
      draw(ctx, W, H, rng) {
        let g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#0a0a0a'); g.addColorStop(1, '#151515');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        for (let i = 0; i < 26; i++) {
          const gold = rng() > 0.55;
          ctx.strokeStyle = gold ? `rgba(${C.rgb},${0.12 + rng() * 0.35})` : `rgba(255,255,255,${0.03 + rng() * 0.07})`;
          ctx.lineWidth = 0.6 + rng() * (gold ? 2.4 : 5);
          ctx.beginPath();
          let x = rng() * W, y = -50;
          ctx.moveTo(x, y);
          while (y < H + 50) {
            const nx = x + (rng() - 0.5) * 260, ny = y + 60 + rng() * 180;
            ctx.quadraticCurveTo(x + (rng() - 0.5) * 200, (y + ny) / 2, nx, ny);
            x = nx; y = ny;
          }
          ctx.stroke();
        }
        vignette(ctx, W, H, 0.7);
      },
    },
    {
      id: 'amanhecer', name: 'Amanhecer',
      draw(ctx, W, H, rng) {
        let g = ctx.createLinearGradient(0, 0, 0, H);
        g.addColorStop(0, '#000'); g.addColorStop(0.55, C.deep); g.addColorStop(0.78, C.mid); g.addColorStop(1, C.dark2);
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const sy = H * 0.76;
        g = ctx.createRadialGradient(W / 2, sy, 10, W / 2, sy, W * 0.7);
        g.addColorStop(0, `rgba(${C.lrgb},.9)`); g.addColorStop(0.12, `rgba(${C.rgb},.55)`); g.addColorStop(0.5, `rgba(${C.rgb},.08)`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        const layer = (yb, amp, col) => {
          ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(0, H);
          for (let x = 0; x <= W; x += 40) ctx.lineTo(x, yb - Math.abs(Math.sin(x / (180 + rng() * 40))) * amp - rng() * amp * 0.3);
          ctx.lineTo(W, H); ctx.fill();
        };
        layer(H * 0.8, H * 0.08, 'rgba(20,14,4,.92)');
        layer(H * 0.88, H * 0.06, '#050402');
      },
    },
    {
      id: 'geometrico', name: 'Geométrico',
      draw(ctx, W, H) {
        ctx.fillStyle = '#020202'; ctx.fillRect(0, 0, W, H);
        const s = 90;
        ctx.lineWidth = 1.2;
        for (let y = -s; y < H + s; y += s * 0.866) {
          const row = Math.round(y / (s * 0.866));
          for (let x = -s; x < W + s; x += s * 1.5) {
            const cx = x + (row % 2 ? s * 0.75 : 0);
            const d = Math.hypot(cx - W / 2, y - H / 2) / Math.max(W, H);
            ctx.strokeStyle = `rgba(${C.rgb},${Math.max(0.03, 0.28 - d * 0.45)})`;
            ctx.beginPath();
            for (let k = 0; k < 6; k++) {
              const a = (Math.PI / 3) * k;
              const px = cx + (s / 2) * Math.cos(a), py = y + (s / 2) * Math.sin(a);
              k ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.closePath(); ctx.stroke();
          }
        }
        vignette(ctx, W, H, 0.9);
      },
    },
    {
      id: 'esmeralda', name: 'Luxo Esmeralda',
      draw(ctx, W, H) {
        let g = ctx.createLinearGradient(0, 0, W, H);
        g.addColorStop(0, '#02140e'); g.addColorStop(0.5, '#000'); g.addColorStop(1, '#021a12');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        g = ctx.createRadialGradient(W * 0.85, H * 0.1, 10, W * 0.85, H * 0.1, W);
        g.addColorStop(0, `rgba(${C.rgb},.25)`); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = goldGrad(ctx, 0, 0, W, H); ctx.lineWidth = 2;
        const m = 50, c = 70;
        ctx.beginPath();
        ctx.moveTo(m + c, m); ctx.lineTo(W - m - c, m); ctx.lineTo(W - m, m + c); ctx.lineTo(W - m, H - m - c);
        ctx.lineTo(W - m - c, H - m); ctx.lineTo(m + c, H - m); ctx.lineTo(m, H - m - c); ctx.lineTo(m, m + c); ctx.closePath();
        ctx.stroke();
      },
    },
    {
      id: 'luz', name: 'Raios de Luz',
      draw(ctx, W, H, rng) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        const ox = W / 2, oy = -H * 0.08;
        for (let i = 0; i < 22; i++) {
          const a = Math.PI / 2 + (rng() - 0.5) * 1.5;
          const spread = 0.02 + rng() * 0.05;
          const len = H * 1.4;
          const g = ctx.createLinearGradient(ox, oy, ox + Math.cos(a) * len, oy + Math.sin(a) * len);
          g.addColorStop(0, `rgba(${C.lrgb},${0.12 + rng() * 0.18})`); g.addColorStop(1, `rgba(${C.rgb},0)`);
          ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(ox, oy);
          ctx.lineTo(ox + Math.cos(a - spread) * len, oy + Math.sin(a - spread) * len);
          ctx.lineTo(ox + Math.cos(a + spread) * len, oy + Math.sin(a + spread) * len);
          ctx.fill();
        }
        for (let i = 0; i < 80; i++) {
          ctx.fillStyle = `rgba(${C.lrgb},${rng() * 0.6})`;
          ctx.beginPath(); ctx.arc(rng() * W, rng() * H, rng() * 2.4, 0, Math.PI * 2); ctx.fill();
        }
        vignette(ctx, W, H, 0.6);
      },
    },
    {
      id: 'minimal', name: 'Preto Minimal',
      draw(ctx, W, H) {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = goldGrad(ctx, 0, 0, W, 0); ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(W * 0.38, H * 0.08); ctx.lineTo(W * 0.62, H * 0.08); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(W * 0.38, H * 0.92); ctx.lineTo(W * 0.62, H * 0.92); ctx.stroke();
      },
    },
    {
      id: 'branco', name: 'Branco Elegante', light: true,
      draw(ctx, W, H) {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, W, H);
        const g = ctx.createRadialGradient(W / 2, 0, 10, W / 2, 0, H * 0.9);
        g.addColorStop(0, `rgba(${C.rgb},.14)`); g.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = goldGrad(ctx, 0, 0, W, H); ctx.lineWidth = 3;
        ctx.strokeRect(40, 40, W - 80, H - 80);
        ctx.lineWidth = 1; ctx.strokeStyle = `rgba(${C.rgb},.5)`;
        ctx.strokeRect(56, 56, W - 112, H - 112);
      },
    },
    {
      id: 'papel', name: 'Papel & Grade', light: true,
      draw(ctx, W, H) {
        ctx.fillStyle = '#f7f4ec'; ctx.fillRect(0, 0, W, H);
        ctx.strokeStyle = `rgba(${C.rgb},.12)`; ctx.lineWidth = 1;
        for (let x = 0; x < W; x += 54) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
        for (let y = 0; y < H; y += 54) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
        ctx.strokeStyle = `rgba(${C.rgb},.45)`; ctx.lineWidth = 5; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(W * 0.08, H * 0.94);
        [[0.25, 0.9], [0.4, 0.92], [0.58, 0.84], [0.72, 0.86], [0.9, 0.76]].forEach(([x, y]) => ctx.lineTo(W * x, H * y));
        ctx.stroke();
      },
    },
  ];

  // ---------- Texto ----------
  function wrap(ctx, text, maxW) {
    const words = text.split(/\s+/);
    const lines = [];
    let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }

  function fitText(ctx, text, maxW, maxH, { max = 86, min = 34, lh = 1.28, font = (s) => `600 ${s}px "Cormorant Garamond"` } = {}) {
    for (let size = max; size >= min; size -= 2) {
      ctx.font = font(size);
      const lines = wrap(ctx, text, maxW);
      if (lines.length * size * lh <= maxH) return { size, lines, lh: size * lh };
    }
    ctx.font = font(min);
    return { size: min, lines: wrap(ctx, text, maxW), lh: min * lh };
  }

  function ornament(ctx, cx, y, w) {
    ctx.strokeStyle = C.orn || C.a; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(cx - w / 2, y); ctx.lineTo(cx - 22, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 22, y); ctx.lineTo(cx + w / 2, y); ctx.stroke();
    ctx.fillStyle = C.orn || C.a;
    ctx.beginPath(); ctx.moveTo(cx, y - 12); ctx.lineTo(cx + 10, y); ctx.lineTo(cx, y + 12); ctx.lineTo(cx - 10, y); ctx.closePath(); ctx.fill();
  }

  function spaced(ctx, text, x, y, spacing) {
    // texto com espaçamento entre letras, centralizado em x
    const chars = [...text];
    const total = chars.reduce((s, c) => s + ctx.measureText(c).width, 0) + spacing * (chars.length - 1);
    let cx = x - total / 2;
    ctx.textAlign = 'left';
    for (const c of chars) { ctx.fillText(c, cx, y); cx += ctx.measureText(c).width + spacing; }
    ctx.textAlign = 'center';
  }

  async function ensureFonts() {
    if (!document.fonts) return;
    try {
      await Promise.all([
        document.fonts.load('700 40px "Cinzel"'),
        document.fonts.load('900 40px "Cinzel"'),
        document.fonts.load('600 40px "Cormorant Garamond"'),
        document.fonts.load('italic 600 40px "Cormorant Garamond"'),
        document.fonts.load('400 40px "Patrick Hand SC"'),
      ]);
    } catch (e) { /* segue com fontes padrão */ }
  }

  /**
   * opts: { format: 'post'|'story', bg: id, seed, quote, ref, tag, handle, date }
   */
  function render(canvas, opts) {
    const story = opts.format === 'story';
    const W = 1080, H = story ? 1920 : 1350;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    const bg = backgrounds.find((b) => b.id === opts.bg) || backgrounds[0];
    bg.draw(ctx, W, H, mulberry32(opts.seed || 7));
    const light = !!bg.light;
    C.orn = light ? C.ink : C.a;

    // leve escurecimento central para leitura
    if (!light) {
      const shade = ctx.createRadialGradient(W / 2, H / 2, 50, W / 2, H / 2, W * 0.75);
      shade.addColorStop(0, 'rgba(0,0,0,.45)'); shade.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = shade; ctx.fillRect(0, 0, W, H);
    }

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = W / 2;
    const top = story ? 300 : 170;

    // Tag superior
    ctx.fillStyle = light ? C.ink : C.l;
    ctx.font = '700 30px "Cinzel"';
    spaced(ctx, (opts.tag || 'PALAVRA DO DIA').toUpperCase(), cx, top, 8);
    if (opts.date) {
      ctx.font = '600 26px "Cinzel"'; ctx.fillStyle = light ? C.ink : `rgba(${C.rgb},.75)`;
      spaced(ctx, opts.date.toUpperCase(), cx, top + 50, 4);
    }
    ornament(ctx, cx, top + (opts.date ? 105 : 62), 300);

    // Citação
    const boxTop = top + (story ? 190 : 150);
    const boxBottom = H - (story ? 520 : 300);
    const quote = opts.ref ? `“${opts.quote}”` : opts.quote;
    const fit = fitText(ctx, quote, W - (story ? 180 : 200), boxBottom - boxTop, {
      max: story ? 92 : 80, min: 36,
      font: (s) => `${opts.ref ? '600' : 'italic 600'} ${s}px "Cormorant Garamond"`,
    });
    ctx.font = `${opts.ref ? '600' : 'italic 600'} ${fit.size}px "Cormorant Garamond"`;
    ctx.fillStyle = light ? '#111111' : '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,.6)'; ctx.shadowBlur = light ? 0 : 18;
    const blockH = fit.lines.length * fit.lh;
    let y = boxTop + (boxBottom - boxTop - blockH) / 2 + fit.lh / 2;
    for (const line of fit.lines) { ctx.fillText(line, cx, y); y += fit.lh; }
    ctx.shadowBlur = 0;

    // Referência
    if (opts.ref) {
      ctx.font = '700 40px "Cinzel"';
      ctx.fillStyle = light ? C.ink : goldGrad(ctx, cx - 200, 0, cx + 200, 0);
      spaced(ctx, opts.ref.toUpperCase(), cx, y + 36, 3);
    }

    // Rodapé / marca
    const fy = H - (story ? 300 : 130);
    ctx.fillStyle = light ? C.ink : C.a;
    ctx.font = '900 30px "Cinzel"';
    spaced(ctx, (opts.brand || 'BÍBLIA DO EMPREENDEDOR').toUpperCase(), cx, fy, 6);
    if (opts.handle) {
      ctx.font = '600 26px "Inter", sans-serif'; ctx.fillStyle = light ? '#333' : `rgba(${C.lrgb},.8)`;
      ctx.fillText(opts.handle, cx, fy + 46);
    }
    return canvas;
  }

  // ---------- Estilo "foto + manuscrito" (foto cinematográfica com frase escrita à mão) ----------
  const HAND = '"Patrick Hand SC", "Comic Sans MS", cursive';
  function wrapSpaced(ctx, text, maxW, sp) {
    const words = text.split(/\s+/);
    const width = (t) => ctx.measureText(t).width + sp * Math.max(0, [...t].length - 1);
    const lines = []; let line = '';
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (width(test) > maxW && line) { lines.push(line); line = w; } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  }
  function drawCover(ctx, img, W, H) {
    const r = Math.max(W / img.width, H / img.height);
    const w = img.width * r, h = img.height * r;
    ctx.drawImage(img, (W - w) / 2, (H - h) / 2, w, h);
  }
  function renderPhoto(canvas, opts) {
    const story = opts.format === 'story';
    const W = 1080, H = story ? 1920 : 1350;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (opts.photo) drawCover(ctx, opts.photo, W, H);
    else {
      const g = ctx.createLinearGradient(0, 0, 0, H);
      g.addColorStop(0, '#1b1712'); g.addColorStop(1, '#050505');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    // escurece para leitura (mais forte no topo, onde fica o texto) + vinheta
    ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(0, 0, W, H);
    let g = ctx.createLinearGradient(0, 0, 0, H * 0.65);
    g.addColorStop(0, 'rgba(0,0,0,.6)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    vignette(ctx, W, H, 0.55);

    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const cx = W / 2;
    const text = (opts.quote || '').toUpperCase();
    const maxW = W * 0.74;
    let size = story ? 70 : 64, lines, lh, sp;
    for (; size >= 32; size -= 2) {
      ctx.font = `400 ${size}px ${HAND}`;
      sp = size * 0.14;
      lines = wrapSpaced(ctx, text, maxW, sp);
      lh = size * 1.6;
      if (lines.length * lh <= H * (story ? 0.3 : 0.34)) break;
    }
    const centerY = H * (story ? 0.3 : 0.32);
    let y = centerY - ((lines.length - 1) * lh) / 2;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,.75)'; ctx.shadowBlur = 16;
    if (opts.tag) {
      ctx.font = `400 ${Math.round(size * 0.55)}px ${HAND}`;
      ctx.fillStyle = C.l;
      spaced(ctx, opts.tag.toUpperCase(), cx, y - lh * 1.05, size * 0.12);
      ctx.fillStyle = '#ffffff';
    }
    ctx.font = `400 ${size}px ${HAND}`;
    for (const l of lines) { spaced(ctx, l, cx, y, sp); y += lh; }
    if (opts.ref) {
      ctx.font = `400 ${Math.round(size * 0.6)}px ${HAND}`;
      ctx.fillStyle = C.l;
      spaced(ctx, opts.ref.toUpperCase(), cx, y + lh * 0.1, size * 0.1);
    }
    ctx.shadowBlur = 6;
    // assinatura discreta
    const sig = (opts.handle || opts.brand || '').toUpperCase();
    if (sig) {
      ctx.font = `400 24px ${HAND}`; ctx.fillStyle = 'rgba(255,255,255,.62)';
      ctx.textAlign = 'left';
      ctx.fillText(sig, W * 0.08, H - (story ? 300 : 120));
    }
    ctx.shadowBlur = 0;
    return canvas;
  }

  function thumb(canvas, bgId) {
    canvas.width = 120; canvas.height = 120;
    const ctx = canvas.getContext('2d');
    ctx.save(); ctx.scale(120 / 1080, 120 / 1080);
    (backgrounds.find((b) => b.id === bgId) || backgrounds[0]).draw(ctx, 1080, 1080, mulberry32(3));
    ctx.restore();
  }

  return { backgrounds, render, renderPhoto, thumb, ensureFonts, mulberry32, setAccent, mix, hexRgb };
})();
