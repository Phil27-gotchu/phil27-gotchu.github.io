(function () {
  "use strict";

  window.__swarmReady = true;

  const root = document.documentElement;
  const $ = (sel, scope = document) => scope.querySelector(sel);
  const $$ = (sel, scope = document) => Array.from(scope.querySelectorAll(sel));
  const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
  const rand = (min, max) => min + Math.random() * (max - min);
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const loadedAt = Date.now();

  /* ---------- dates ---------- */

  const now = new Date();
  $("#year").textContent = now.getFullYear();
  $("#today").textContent = [
    String(now.getDate()).padStart(2, "0"),
    now.toLocaleString("en", { month: "short" }).toUpperCase(),
    now.getFullYear(),
  ].join(" ");

  /* ---------- led dot-matrix name ---------- */

  // 5x7 bitmap font. Each glyph is seven rows, "#" = lit.
  const GLYPHS = {
    A: ".###.|#...#|#...#|#####|#...#|#...#|#...#",
    B: "####.|#...#|#...#|####.|#...#|#...#|####.",
    C: ".####|#....|#....|#....|#....|#....|.####",
    D: "####.|#...#|#...#|#...#|#...#|#...#|####.",
    E: "#####|#....|#....|####.|#....|#....|#####",
    F: "#####|#....|#....|####.|#....|#....|#....",
    G: ".####|#....|#....|#..##|#...#|#...#|.###.",
    H: "#...#|#...#|#...#|#####|#...#|#...#|#...#",
    I: "#####|..#..|..#..|..#..|..#..|..#..|#####",
    J: "..###|...#.|...#.|...#.|#..#.|#..#.|.##..",
    K: "#...#|#..#.|#.#..|##...|#.#..|#..#.|#...#",
    L: "#....|#....|#....|#....|#....|#....|#####",
    M: "#...#|##.##|#.#.#|#.#.#|#...#|#...#|#...#",
    N: "#...#|##..#|#.#.#|#..##|#...#|#...#|#...#",
    O: ".###.|#...#|#...#|#...#|#...#|#...#|.###.",
    P: "####.|#...#|#...#|####.|#....|#....|#....",
    Q: ".###.|#...#|#...#|#...#|#.#.#|#..#.|.##.#",
    R: "####.|#...#|#...#|####.|#.#..|#..#.|#...#",
    S: ".####|#....|#....|.###.|....#|....#|####.",
    T: "#####|..#..|..#..|..#..|..#..|..#..|..#..",
    U: "#...#|#...#|#...#|#...#|#...#|#...#|.###.",
    V: "#...#|#...#|#...#|#...#|#...#|.#.#.|..#..",
    W: "#...#|#...#|#...#|#.#.#|#.#.#|##.##|#...#",
    X: "#...#|#...#|.#.#.|..#..|.#.#.|#...#|#...#",
    Y: "#...#|#...#|.#.#.|..#..|..#..|..#..|..#..",
    Z: "#####|....#|...#.|..#..|.#...|#....|#####",
    0: ".###.|#...#|#..##|#.#.#|##..#|#...#|.###.",
    1: "..#..|.##..|..#..|..#..|..#..|..#..|.###.",
    2: ".###.|#...#|....#|...#.|..#..|.#...|#####",
    3: "####.|....#|....#|.###.|....#|....#|####.",
    4: "...#.|..##.|.#.#.|#..#.|#####|...#.|...#.",
    5: "#####|#....|####.|....#|....#|#...#|.###.",
    6: ".###.|#....|#....|####.|#...#|#...#|.###.",
    7: "#####|....#|...#.|..#..|.#...|.#...|.#...",
    8: ".###.|#...#|#...#|.###.|#...#|#...#|.###.",
    9: ".###.|#...#|#...#|.####|....#|....#|.###.",
    "-": ".....|.....|.....|.###.|.....|.....|.....",
    ".": ".....|.....|.....|.....|.....|.....|..#..",
  };
  Object.keys(GLYPHS).forEach((k) => { GLYPHS[k] = GLYPHS[k].split("|"); });

  const pixelName = (function () {
    const canvas = $("#pixel-name");
    if (!canvas || !canvas.getContext) return { hide() {}, assemble() {}, settle() {}, refresh() {} };

    const ctx = canvas.getContext("2d");
    const SUB = 2; // each font pixel is drawn as a 2x2 cluster of LED dots
    let parts = [];
    let glyphs = [];
    let cell = 6;
    let width = 0;
    let height = 0;
    let ink = "#000";
    let hot = "#f00";
    let state = "live";
    let visible = true;
    let raf = 0;
    let nextWave = performance.now() + 4000;
    let wave = null;
    let ghosts = [];
    const pointer = { x: -9999, y: -9999 };

    const colsOf = (s) => {
      let n = -1;
      for (const ch of s) n += (GLYPHS[ch] ? 5 : 3) + 1;
      return Math.max(n, 0);
    };

    function layout() {
      const text = (canvas.dataset.text || "HELLO").toUpperCase().trim();
      const avail = canvas.parentElement.clientWidth;
      let lines = [text];
      let cols = colsOf(text);
      if (avail / (cols * SUB) < 4 && text.includes(" ")) {
        lines = text.split(/\s+/);
        cols = Math.max(...lines.map(colsOf));
      }
      cell = clamp(Math.floor(avail / (cols * SUB)), 2, 9);
      const lineH = 7 * SUB * cell;
      const gapH = 2 * SUB * cell;
      width = cols * SUB * cell;
      height = lines.length * lineH + (lines.length - 1) * gapH;

      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = width + "px";
      canvas.style.height = height + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      parts = [];
      glyphs = [];
      ghosts = [];
      lines.forEach((line, li) => {
        const top = li * (lineH + gapH);
        let col = Math.floor((cols - colsOf(line)) / 2);
        for (const ch of line) {
          const rows = GLYPHS[ch];
          if (!rows) { col += 4; continue; }
          const gi = glyphs.length;
          glyphs.push({ cx: (col + 2.5) * SUB * cell, cy: top + lineH / 2 });
          rows.forEach((row, ry) => {
            for (let rx = 0; rx < 5; rx++) {
              if (row[rx] !== "#") {
                for (let sy = 0; sy < SUB; sy++) {
                  for (let sx = 0; sx < SUB; sx++) ghosts.push({ x: ((col + rx) * SUB + sx) * cell, y: top + (ry * SUB + sy) * cell });
                }
                continue;
              }
              for (let sy = 0; sy < SUB; sy++) {
                for (let sx = 0; sx < SUB; sx++) {
                  const hx = ((col + rx) * SUB + sx) * cell;
                  const hy = top + (ry * SUB + sy) * cell;
                  parts.push({ hx, hy, x: hx, y: hy, vx: 0, vy: 0, g: gi, on: true, at: 0, waved: false, spark: Math.random() < 0.035 });
                }
              }
            }
          });
          col += 6;
        }
      });
    }

    function step(t) {
      const radius = Math.max(50, cell * 11);
      const r2 = radius * radius;
      if (state === "live" && t > nextWave && parts.length) {
        nextWave = t + rand(5000, 9000);
        wave = { start: t, dir: Math.random() < 0.5 ? 1 : -1 };
        parts.forEach((p) => { p.waved = false; });
      }
      // A ripple runs across the name, lifting each column of dots as it passes.
      if (wave) {
        const front = ((t - wave.start) / 900) * (width + cell * 8);
        const x = wave.dir > 0 ? front : width - front;
        parts.forEach((p) => {
          if (!p.waved && Math.abs(p.hx - x) < cell * 1.5) { p.waved = true; p.vy -= cell * 0.55; }
        });
        if (front > width + cell * 8) wave = null;
      }
      for (const p of parts) {
        if (!p.on) {
          if (!p.at || t < p.at) continue;
          p.on = true;
        }
        let ax = (p.hx - p.x) * 0.085;
        let ay = (p.hy - p.y) * 0.085;
        // Magnetic pointer: dots lean toward the cursor, strongest up close.
        const dx = pointer.x - p.x;
        const dy = pointer.y - p.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < r2) {
          const d = Math.sqrt(d2) || 1;
          const f = Math.pow(1 - d / radius, 2) * 2.4;
          ax += (dx / d) * f;
          ay += (dy / d) * f;
        }
        p.vx = (p.vx + ax) * 0.8;
        p.vy = (p.vy + ay) * 0.8;
        p.x += p.vx;
        p.y += p.vy;
      }
    }

    function dot(x, y, r) {
      ctx.moveTo(x + r * 2, y + r);
      ctx.arc(x + r, y + r, r, 0, Math.PI * 2);
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);
      const r = Math.max(0.8, (cell - (cell > 3 ? 1.2 : 0.6)) / 2);
      ctx.fillStyle = ink;
      ctx.globalAlpha = 0.08;
      ctx.beginPath();
      for (const g of ghosts) dot(g.x, g.y, r);
      ctx.fill();
      ctx.globalAlpha = 1;
      const lit = [];
      ctx.beginPath();
      for (const p of parts) {
        if (!p.on) continue;
        const off = Math.abs(p.x - p.hx) + Math.abs(p.y - p.hy);
        if (p.spark || off > cell * 1.5) lit.push(p);
        else dot(p.x, p.y, r);
      }
      ctx.fill();
      ctx.fillStyle = hot;
      ctx.beginPath();
      for (const p of lit) dot(p.x, p.y, r);
      ctx.fill();
    }

    function frame(t) {
      raf = 0;
      step(t);
      draw();
      if (visible && !reducedMotion) raf = requestAnimationFrame(frame);
    }

    function kick() {
      if (reducedMotion) { draw(); return; }
      if (!raf && visible) raf = requestAnimationFrame(frame);
    }

    function refresh() {
      const cs = getComputedStyle(root);
      ink = cs.getPropertyValue("--ink").trim() || ink;
      hot = cs.getPropertyValue("--a2").trim() || hot;
      draw();
    }

    function hide() {
      state = "hidden";
      parts.forEach((p) => {
        p.on = false;
        p.at = 0;
        p.x = p.hx + rand(-cell, cell);
        p.y = height + rand(cell * 2, cell * 10);
        p.vx = p.vy = 0;
      });
      draw();
    }

    function assemble() {
      state = "live";
      const t = performance.now();
      parts.forEach((p) => { p.at = t + (p.hx / width) * 700 + rand(0, 250); });
      nextWave = t + 4500;
      kick();
    }

    function settle() {
      state = "live";
      parts.forEach((p) => {
        p.on = true;
        p.x = p.hx;
        p.y = p.hy;
        p.vx = p.vy = 0;
      });
      kick();
    }

    window.addEventListener("pointermove", (e) => {
      const r = canvas.getBoundingClientRect();
      pointer.x = e.clientX - r.left;
      pointer.y = e.clientY - r.top;
    }, { passive: true });
    document.addEventListener("pointerleave", () => { pointer.x = pointer.y = -9999; });

    if ("IntersectionObserver" in window) {
      new IntersectionObserver((entries) => {
        visible = entries[0].isIntersecting;
        if (visible) kick();
      }).observe(canvas);
    }

    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        const wasHidden = state === "hidden";
        layout();
        if (wasHidden) hide(); else settle();
      }, 150);
    });

    layout();
    refresh();
    settle();
    return { hide, assemble, settle, refresh };
  })();

  /* ---------- themes ---------- */

  const THEMES = ["paper", "fedora", "night", "ocean", "ink", "grape"];
  const themeButtons = $$("[data-theme-btn]");

  function setTheme(name) {
    if (!THEMES.includes(name)) return false;
    root.dataset.theme = name;
    try { localStorage.setItem("theme", name); } catch (_) { /* private mode */ }
    themeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.themeBtn === name)));
    pixelName.refresh();
    document.dispatchEvent(new Event("themechange"));
    return true;
  }

  themeButtons.forEach((b) => b.addEventListener("click", () => setTheme(b.dataset.themeBtn)));
  setTheme(THEMES.includes(root.dataset.theme) ? root.dataset.theme : "paper");

  /* ---------- mobile navigation ---------- */

  const navToggle = $(".nav__toggle");
  const navMenu = $("#nav-menu");

  function setMenuOpen(open) {
    navToggle.setAttribute("aria-expanded", String(open));
    navToggle.textContent = open ? "[close]" : "[menu]";
    navMenu.classList.toggle("is-open", open);
  }

  navToggle.addEventListener("click", () => setMenuOpen(navToggle.getAttribute("aria-expanded") !== "true"));
  navMenu.addEventListener("click", (e) => { if (e.target.closest("a")) setMenuOpen(false); });

  /* ---------- swarm of cursors ---------- */

  const swarm = (function () {
    const CREW = [
      ["Ada", "#0d99ff"], ["Linus", "#9747ff"], ["Grace", "#f24822"], ["Dennis", "#14ae5c"],
      ["Ken", "#f5a000"], ["Barbara", "#e5379b"], ["Alan", "#0aa5a5"], ["Margaret", "#5b5bd6"],
    ];
    const ARROW = '<svg class="sw-arrow" width="16" height="20" viewBox="0 0 16 20" aria-hidden="true"><path d="M1.5 1.2v14.6l3.9-3.6 2.6 5.9 2.6-1.1-2.6-5.8h5.4z" fill="currentColor" stroke="#fff" stroke-width="1.5" stroke-linejoin="round" paint-order="stroke"/></svg>';
    const IBEAM = '<svg class="sw-ibeam" width="12" height="22" viewBox="0 0 12 22" aria-hidden="true"><path d="M2.5 2.5h2.2c.6 0 1.3.4 1.3 1.2 0-.8.7-1.2 1.3-1.2h2.2M6 3.7v14.6M2.5 19.5h2.2c.6 0 1.3-.4 1.3-1.2 0 .8.7 1.2 1.3 1.2h2.2" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M2.5 2.5h2.2c.6 0 1.3.4 1.3 1.2 0-.8.7-1.2 1.3-1.2h2.2M6 3.7v14.6M2.5 19.5h2.2c.6 0 1.3-.4 1.3-1.2 0 .8.7 1.2 1.3 1.2h2.2" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
    const INTRO_MS = 1000;
    const ABORT = new Error("swarm aborted");

    const hud = $("#swarm-hud");
    const hudText = $("#swarm-hud-text");
    const skipBtn = $("#swarm-skip");
    const avatars = $("#swarm-avatars");
    const progress = $("#swarm-progress");

    let layer = null;
    let cursors = [];
    let tasks = [];
    let gen = 0;
    let running = false;
    let finishing = false;
    let startedAt = 0;
    let lastScroll = 0;
    let raf = 0;

    const pageRect = (el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left + scrollX, y: r.top + scrollY, w: r.width, h: r.height };
    };
    const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const ease = (p) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);
    const guard = (g) => { if (g !== gen) throw ABORT; };

    function collect() {
      const map = new Map();
      const list = $$("[data-build]").map((el) => {
        const t = { el, type: el.dataset.build, parent: null, state: "pending", restore: null };
        map.set(el, t);
        return t;
      });
      list.forEach((t) => {
        let p = t.el.parentElement;
        while (p && !map.has(p)) p = p.parentElement;
        t.parent = p ? map.get(p) : null;
      });
      return list;
    }

    function makeCursor([name, color], i, all) {
      const el = document.createElement("div");
      el.className = "sw-cursor";
      el.style.setProperty("--c", color);
      el.innerHTML = ARROW + IBEAM + '<span class="sw-tag">' + name + "</span>";
      const selEl = document.createElement("div");
      selEl.className = "sw-sel";
      selEl.style.setProperty("--c", color);
      selEl.innerHTML = '<i class="sw-h sw-h--tl"></i><i class="sw-h sw-h--tr"></i><i class="sw-h sw-h--bl"></i><i class="sw-h sw-h--br"></i><span class="sw-badge"></span>';
      const caretEl = document.createElement("div");
      caretEl.className = "sw-caret";
      caretEl.style.setProperty("--c", color);
      layer.append(selEl, caretEl, el);

      // Enter from a point just outside the viewport and glide to a spot in a loose arc.
      const a = (i / all.length) * Math.PI * 2 + rand(-0.2, 0.2);
      const cx = scrollX + innerWidth / 2;
      const cy = scrollY + innerHeight / 2;
      const reach = Math.hypot(innerWidth, innerHeight) / 2 + 40;
      const c = {
        el, selEl, caretEl, color, name,
        badge: selEl.querySelector(".sw-badge"),
        x: cx + Math.cos(a) * reach, y: cy + Math.sin(a) * reach,
        anchor: null, tween: null, follow: null, sel: null, caret: null,
        busy: false, down: false, text: false,
      };
      const spot = { x: cx + Math.cos(a) * innerWidth * 0.28, y: cy + Math.sin(a) * innerHeight * 0.26 };
      moveTo(c, spot, rand(800, 1100), rand(-0.15, 0.15)).then(() => { c.anchor = spot; });
      return c;
    }

    function ripple(c) {
      if (!layer) return;
      const r = document.createElement("span");
      r.className = "sw-ripple";
      r.style.setProperty("--c", c.color);
      r.style.transform = `translate3d(${c.x - scrollX}px, ${c.y - scrollY}px, 0)`;
      r.addEventListener("animationend", () => r.remove());
      layer.append(r);
    }

    function moveTo(c, target, dur, arc = rand(-0.2, 0.2)) {
      return new Promise((resolve) => {
        c.follow = null;
        c.tween = { fx: c.x, fy: c.y, target, start: performance.now(), dur: Math.max(16, dur), arc, resolve };
      });
    }

    const travelTime = (c, p) => clamp(Math.hypot(p.x - c.x, p.y - c.y) * 0.75, 260, 1000);

    async function runTask(c, t, g) {
      const el = t.el;
      const topLeft = () => { const r = pageRect(el); return { x: r.x, y: r.y }; };
      const bottomRight = () => { const r = pageRect(el); return { x: r.x + r.w, y: r.y + r.h }; };
      const quick = t.type === "chip";

      await moveTo(c, topLeft, travelTime(c, topLeft()));
      guard(g);
      await sleep(rand(40, 110));
      guard(g);
      c.down = true;
      ripple(c);
      c.sel = topLeft;
      const r = pageRect(el);
      await moveTo(c, bottomRight, quick ? 240 : clamp(260 + (r.w + r.h) * 0.4, 340, 860), 0);
      guard(g);
      c.down = false;

      if (t.type === "text") {
        c.sel = null;
        await typeText(c, t, g);
      } else {
        el.classList.add("sw-built");
        if (t.type === "pixels") pixelName.assemble();
        await sleep(quick ? 90 : 240);
        guard(g);
        c.sel = null;
      }
      t.state = "done";
    }

    async function typeText(c, t, g) {
      const el = t.el;
      const keepSpaces = getComputedStyle(el).whiteSpace.startsWith("pre");
      const nodes = [];
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        const node = walker.currentNode;
        nodes.push({ node, full: keepSpaces ? node.nodeValue : node.nodeValue.replace(/\s+/g, " ") });
      }
      const total = nodes.reduce((n, x) => n + x.full.length, 0);

      // Lock the height so typing doesn't shift everything below it.
      el.style.minHeight = el.getBoundingClientRect().height + "px";
      t.restore = () => {
        nodes.forEach((n) => { n.node.nodeValue = n.full; });
        el.style.minHeight = "";
      };
      nodes.forEach((n) => { n.node.nodeValue = ""; });
      el.classList.add("sw-built");
      c.text = true;

      const perChar = clamp(total * 20, 350, 2600) / Math.max(total, 1);
      const t0 = performance.now();
      const range = document.createRange();
      let shown = 0;
      while (shown < total) {
        await nextFrame();
        guard(g);
        shown = Math.min(total, Math.floor((performance.now() - t0) / perChar));
        let left = shown;
        let caretNode = null;
        let caretOffset = 0;
        for (const n of nodes) {
          const k = Math.min(n.full.length, left);
          if (n.node.nodeValue.length !== k) n.node.nodeValue = n.full.slice(0, k);
          left -= k;
          if (k > 0) { caretNode = n.node; caretOffset = k; }
        }
        if (caretNode) {
          range.setStart(caretNode, caretOffset - 1);
          range.setEnd(caretNode, caretOffset);
          const rects = range.getClientRects();
          const rr = rects[rects.length - 1];
          if (rr && rr.height) {
            c.caret = { x: rr.right + scrollX, y: rr.top + scrollY, h: rr.height };
            c.follow = { x: rr.right + scrollX + 3, y: rr.top + scrollY + rr.height / 2 };
          }
        }
      }
      t.restore();
      t.restore = null;
      c.caret = null;
      c.follow = null;
      c.text = false;
    }

    function finishInstantly(t) {
      if (t.restore) t.restore();
      t.el.classList.add("sw-built");
      if (t.type === "pixels") pixelName.settle();
      t.state = "done";
    }

    function assign() {
      const free = cursors.filter((c) => !c.busy);
      if (!free.length) return;
      const limit = scrollY + innerHeight * 1.05;
      for (const t of tasks) {
        if (!free.length) break;
        if (t.state !== "pending") continue;
        if (t.parent && t.parent.state !== "done") continue;
        if (!t.el.getClientRects().length) { finishInstantly(t); continue; }
        const r = pageRect(t.el);
        // Only build what's on screen so cursors stay visible; anything skipped waits until it's back in view.
        if (r.y + r.h < scrollY || r.y > limit) continue;

        let best = 0;
        let bestDist = Infinity;
        free.forEach((c, i) => {
          const d = Math.hypot(c.x - r.x, c.y - r.y);
          if (d < bestDist) { bestDist = d; best = i; }
        });
        const c = free.splice(best, 1)[0];
        const g = gen;
        t.state = "active";
        c.busy = true;
        c.tween = null;
        runTask(c, t, g)
          .catch((err) => {
            if (err === ABORT) return;
            finishInstantly(t);
            console.error(err);
          })
          .finally(() => {
            if (g !== gen) return;
            c.busy = false;
            c.down = false;
            c.sel = null;
            c.anchor = { x: c.x + rand(-30, 30), y: c.y + rand(20, 50) };
            updateHud();
          });
      }
    }

    function render(c) {
      const ox = c.text ? 6 : 2;
      const oy = c.text ? 11 : 1.5;
      c.el.style.transform = `translate3d(${c.x - scrollX - ox}px, ${c.y - scrollY - oy}px, 0)`;
      c.el.classList.toggle("is-down", c.down);
      c.el.classList.toggle("is-text", c.text);

      if (c.sel) {
        const s = c.sel();
        const x0 = Math.min(s.x, c.x);
        const y0 = Math.min(s.y, c.y);
        const w = Math.abs(c.x - s.x);
        const h = Math.abs(c.y - s.y);
        c.selEl.style.display = "block";
        c.selEl.style.transform = `translate3d(${x0 - scrollX}px, ${y0 - scrollY}px, 0)`;
        c.selEl.style.width = w + "px";
        c.selEl.style.height = h + "px";
        c.badge.textContent = Math.round(w) + " × " + Math.round(h);
        c.badge.style.display = w > 36 && h > 14 ? "" : "none";
      } else {
        c.selEl.style.display = "none";
      }

      if (c.caret) {
        c.caretEl.style.display = "block";
        c.caretEl.style.height = c.caret.h + "px";
        c.caretEl.style.transform = `translate3d(${c.caret.x - scrollX}px, ${c.caret.y - scrollY}px, 0)`;
      } else {
        c.caretEl.style.display = "none";
      }
    }

    function loop() {
      if (!running) return;
      const t = performance.now();
      const intro = t - startedAt < INTRO_MS;

      if (!intro && !finishing) {
        assign();
        if (tasks.every((x) => x.state === "done")) complete();
      }

      if (Math.abs(scrollY - lastScroll) > innerHeight * 0.3) {
        lastScroll = scrollY;
        cursors.forEach((c) => { if (c.tween && c.tween.idle) c.tween = null; });
      }

      for (const c of cursors) {
        if (c.follow) {
          c.x += (c.follow.x - c.x) * 0.35;
          c.y += (c.follow.y - c.y) * 0.35;
        } else if (c.tween) {
          const tw = c.tween;
          const p = clamp((t - tw.start) / tw.dur, 0, 1);
          const e = ease(p);
          const tg = typeof tw.target === "function" ? tw.target() : tw.target;
          const dx = tg.x - tw.fx;
          const dy = tg.y - tw.fy;
          const bend = Math.sin(Math.PI * e) * tw.arc;
          c.x = tw.fx + dx * e - dy * bend;
          c.y = tw.fy + dy * e + dx * bend;
          if (p >= 1) { c.tween = null; tw.resolve(); }
        } else if (!c.busy && !finishing) {
          // Idle cursors hover near where they last worked instead of roaming the page.
          const a = c.anchor;
          const inView = a && a.y > scrollY + 70 && a.y < scrollY + innerHeight - 70 && a.x > scrollX + 30 && a.x < scrollX + innerWidth - 30;
          if (!inView) c.anchor = { x: scrollX + rand(0.15, 0.85) * innerWidth, y: scrollY + rand(0.3, 0.8) * innerHeight };
          const target = { x: c.anchor.x + rand(-28, 28), y: c.anchor.y + rand(-18, 18) };
          c.tween = { fx: c.x, fy: c.y, target, start: t, dur: inView ? rand(1600, 2800) : rand(700, 1000), arc: rand(-0.1, 0.1), resolve() {}, idle: true };
        }
        render(c);
      }
      raf = requestAnimationFrame(loop);
    }

    function updateHud() {
      if (!running || finishing) return;
      const done = tasks.filter((t) => t.state === "done").length;
      const busy = cursors.filter((c) => c.busy).length;
      const pct = Math.round((done / Math.max(tasks.length, 1)) * 100);
      hudText.textContent = busy ? `${busy} editing · ${pct}%` : `waiting for scroll · ${pct}%`;
      progress.style.width = pct + "%";
      cursors.forEach((c) => c.avatar.classList.toggle("is-busy", c.busy));
    }

    function teardown() {
      running = false;
      cancelAnimationFrame(raf);
      if (layer) layer.remove();
      layer = null;
      cursors = [];
      root.classList.remove("swarm-on");
      $$(".sw-built").forEach((el) => el.classList.remove("sw-built"));
    }

    function complete() {
      finishing = true;
      const secs = ((performance.now() - startedAt) / 1000).toFixed(1);
      hudText.textContent = `built by ${cursors.length} cursors in ${secs}s`;
      progress.style.width = "100%";
      cursors.forEach((c) => c.avatar.classList.remove("is-busy"));
      skipBtn.hidden = true;
      cursors.forEach((c) => {
        const a = rand(0, Math.PI * 2);
        moveTo(c, { x: c.x + Math.cos(a) * innerWidth, y: c.y + Math.sin(a) * innerHeight }, rand(800, 1200));
        c.el.style.opacity = "0";
      });
      const g = gen;
      setTimeout(() => { if (g === gen) teardown(); }, 1300);
      setTimeout(() => { if (g === gen) hud.hidden = true; }, 3500);
    }

    function skip() {
      if (!running) return;
      gen++;
      tasks.forEach((t) => { if (t.restore) t.restore(); });
      pixelName.settle();
      teardown();
      hud.hidden = true;
    }

    function start() {
      if (running) skip();
      gen++;
      running = true;
      finishing = false;
      root.classList.add("swarm-on");
      $$(".sw-built").forEach((el) => el.classList.remove("sw-built"));
      tasks = collect();
      pixelName.hide();

      layer = document.createElement("div");
      layer.className = "sw-layer";
      layer.setAttribute("aria-hidden", "true");
      document.body.append(layer);
      const crew = innerWidth < 760 ? CREW.slice(0, 5) : CREW;
      cursors = crew.map(makeCursor);
      avatars.textContent = "";
      cursors.forEach((c) => {
        c.avatar = document.createElement("span");
        c.avatar.textContent = c.name[0];
        c.avatar.title = c.name;
        c.avatar.style.setProperty("--c", c.color);
        avatars.append(c.avatar);
      });

      hud.hidden = false;
      skipBtn.hidden = false;
      startedAt = performance.now();
      lastScroll = scrollY;
      updateHud();
      raf = requestAnimationFrame(loop);
    }

    skipBtn.addEventListener("click", skip);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") skip();
    });

    return { start, skip, isRunning: () => running };
  })();

  /* ---------- options lab ---------- */

  // Abramowitz & Stegun 7.1.26; error below 1.5e-7, plenty for display.
  function normCdf(x) {
    const z = Math.abs(x) / Math.SQRT2;
    const t = 1 / (1 + 0.3275911 * z);
    const poly = ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t;
    const erf = 1 - poly * Math.exp(-z * z);
    return x >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
  }

  const normPdf = (x) => Math.exp(-(x * x) / 2) / Math.sqrt(2 * Math.PI);

  // T in years; vol and r as decimals.
  function blackScholes(type, S, K, vol, T, r) {
    const sqrtT = Math.sqrt(T);
    const d1 = (Math.log(S / K) + (r + (vol * vol) / 2) * T) / (vol * sqrtT);
    const d2 = d1 - vol * sqrtT;
    const disc = K * Math.exp(-r * T);
    const call = type === "call";
    const price = call ? S * normCdf(d1) - disc * normCdf(d2) : disc * normCdf(-d2) - S * normCdf(-d1);
    const delta = call ? normCdf(d1) : normCdf(d1) - 1;
    const gamma = normPdf(d1) / (S * vol * sqrtT);
    const vega = (S * normPdf(d1) * sqrtT) / 100;
    const decay = -(S * normPdf(d1) * vol) / (2 * sqrtT);
    const theta = (call ? decay - r * disc * normCdf(d2) : decay + r * disc * normCdf(-d2)) / 365;
    return { price, delta, gamma, vega, theta };
  }

  function gaussian() {
    let u = 0;
    while (u === 0) u = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * Math.random());
  }

  const payoff = (type, S, K) => (type === "call" ? Math.max(S - K, 0) : Math.max(K - S, 0));

  (function () {
    const form = $("#lab-form");
    if (!form) return;
    const chart = $("#lab-chart");
    const hedgeChart = $("#hedge-chart");
    const freqSelect = $("#hedge-freq");
    const result = $("#hedge-result");
    const PATHS = 500;
    const X_MIN = 40;
    const X_MAX = 160;
    const colors = {};
    let lastSim = null;
    let simTimer = 0;

    function readColors() {
      const cs = getComputedStyle(root);
      ["bg", "ink", "muted", "line", "line-strong", "accent", "a2", "a3"].forEach((k) => {
        colors[k] = cs.getPropertyValue("--" + k).trim();
      });
    }

    function inputs() {
      const f = form.elements;
      return {
        type: f.type.value,
        S: +f.spot.value,
        K: +f.strike.value,
        vol: +f.vol.value / 100,
        days: +f.days.value,
        r: +f.rate.value / 100,
      };
    }

    function setupCanvas(canvas, height) {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.parentElement.clientWidth;
      canvas.width = Math.round(w * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.height = height + "px";
      const ctx = canvas.getContext("2d");
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = "10px " + getComputedStyle(document.body).fontFamily;
      return { ctx, w, h: height };
    }

    function drawValueChart(p, greeks) {
      const { ctx, w, h } = setupCanvas(chart, innerWidth < 760 ? 220 : 270);
      const pad = { l: 34, r: 10, t: 12, b: 24 };
      const T = p.days / 365;
      const samples = [];
      let yMax = 1;
      for (let i = 0; i <= 120; i++) {
        const s = X_MIN + ((X_MAX - X_MIN) * i) / 120;
        const v = blackScholes(p.type, s, p.K, p.vol, T, p.r).price;
        const po = payoff(p.type, s, p.K);
        samples.push({ s, v, po });
        yMax = Math.max(yMax, v, po);
      }
      yMax *= 1.1;
      const x = (s) => pad.l + ((s - X_MIN) / (X_MAX - X_MIN)) * (w - pad.l - pad.r);
      const y = (v) => h - pad.b - (v / yMax) * (h - pad.t - pad.b);

      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1;
      ctx.fillStyle = colors.muted;
      ctx.textAlign = "right";
      ctx.textBaseline = "middle";
      for (let i = 0; i <= 4; i++) {
        const v = (yMax / 4) * i;
        ctx.strokeStyle = colors.line;
        ctx.setLineDash(i === 0 ? [] : [2, 4]);
        ctx.beginPath();
        ctx.moveTo(pad.l, y(v));
        ctx.lineTo(w - pad.r, y(v));
        ctx.stroke();
        ctx.fillText(v.toFixed(0), pad.l - 6, y(v));
      }
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let s = 50; s <= 150; s += 25) ctx.fillText(String(s), x(s), h - pad.b + 7);

      ctx.strokeStyle = colors["line-strong"];
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x(p.K), pad.t);
      ctx.lineTo(x(p.K), h - pad.b);
      ctx.stroke();
      ctx.fillText("K", x(p.K) + 8, pad.t);

      ctx.strokeStyle = colors.muted;
      ctx.setLineDash([5, 4]);
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      samples.forEach((d, i) => (i ? ctx.lineTo(x(d.s), y(d.po)) : ctx.moveTo(x(d.s), y(d.po))));
      ctx.stroke();

      ctx.setLineDash([]);
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 2.25;
      ctx.beginPath();
      samples.forEach((d, i) => (i ? ctx.lineTo(x(d.s), y(d.v)) : ctx.moveTo(x(d.s), y(d.v))));
      ctx.stroke();

      const span = 14;
      ctx.save();
      ctx.beginPath();
      ctx.rect(pad.l, pad.t, w - pad.l - pad.r, h - pad.t - pad.b);
      ctx.clip();
      ctx.strokeStyle = colors.a3;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x(p.S - span), y(greeks.price - greeks.delta * span));
      ctx.lineTo(x(p.S + span), y(greeks.price + greeks.delta * span));
      ctx.stroke();
      ctx.restore();

      ctx.fillStyle = colors.a2;
      ctx.fillRect(x(p.S) - 4, y(greeks.price) - 4, 8, 8);
      const label = `S ${p.S.toFixed(1)} → ${greeks.price.toFixed(2)}`;
      const lw = ctx.measureText(label).width + 10;
      const lx = clamp(x(p.S) - lw / 2, pad.l, w - pad.r - lw);
      const ly = Math.max(pad.t, y(greeks.price) - 30);
      ctx.fillStyle = colors.ink;
      ctx.fillRect(lx, ly, lw, 17);
      ctx.fillStyle = colors.bg;
      ctx.textAlign = "left";
      ctx.textBaseline = "middle";
      ctx.fillText(label, lx + 5, ly + 9);
    }

    function simulate(p, freq) {
      const steps = Math.max(1, Math.round(p.days));
      const dt = 1 / 365;
      const T = steps * dt;
      const drift = (p.r - (p.vol * p.vol) / 2) * dt;
      const shock = p.vol * Math.sqrt(dt);
      const growth = Math.exp(p.r * dt);
      const start = blackScholes(p.type, p.S, p.K, p.vol, T, p.r);
      const hedged = [];
      const naked = [];
      for (let i = 0; i < PATHS; i++) {
        let S = p.S;
        let delta = start.delta;
        let cash = start.price - delta * S;
        for (let k = 1; k <= steps; k++) {
          S *= Math.exp(drift + shock * gaussian());
          cash *= growth;
          if (freq && k < steps && k % freq === 0) {
            const next = blackScholes(p.type, S, p.K, p.vol, (steps - k) * dt, p.r).delta;
            cash -= (next - delta) * S;
            delta = next;
          }
        }
        const owed = payoff(p.type, S, p.K);
        hedged.push(cash + delta * S - owed);
        naked.push(start.price * Math.exp(p.r * T) - owed);
      }
      return { hedged, naked, premium: start.price };
    }

    const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
    const stdev = (a) => {
      const m = mean(a);
      return Math.sqrt(a.reduce((s, v) => s + (v - m) * (v - m), 0) / a.length);
    };

    function drawHedgeChart(sim) {
      const { ctx, w, h } = setupCanvas(hedgeChart, innerWidth < 760 ? 150 : 170);
      const pad = { l: 10, r: 10, t: 8, b: 22 };
      const all = sim.naked.concat(sim.hedged).sort((a, b) => a - b);
      const lo = all[Math.floor(all.length * 0.01)];
      const hi = all[Math.ceil(all.length * 0.99) - 1];
      const bins = 44;
      const width = (hi - lo) / bins || 1;
      const count = (arr) => {
        const out = new Array(bins).fill(0);
        arr.forEach((v) => { out[clamp(Math.floor((v - lo) / width), 0, bins - 1)]++; });
        return out;
      };
      const nakedBins = count(sim.naked);
      const hedgedBins = count(sim.hedged);
      // Scale to the hedged distribution; a short option's unhedged p&l piles into one tall
      // "kept the premium" bar that would otherwise flatten everything else.
      const peak = Math.max(...hedgedBins) * 1.1;
      const bw = (w - pad.l - pad.r) / bins;
      const barH = (n) => Math.min(1, n / peak) * (h - pad.t - pad.b);

      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = colors["line-strong"];
      nakedBins.forEach((n, i) => ctx.fillRect(pad.l + i * bw + 1, h - pad.b - barH(n), bw - 2, barH(n)));
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = colors.accent;
      hedgedBins.forEach((n, i) => ctx.fillRect(pad.l + i * bw + 2, h - pad.b - barH(n), bw - 4, barH(n)));
      ctx.globalAlpha = 1;

      const zero = pad.l + ((0 - lo) / (hi - lo)) * (w - pad.l - pad.r);
      ctx.strokeStyle = colors.ink;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(zero, pad.t);
      ctx.lineTo(zero, h - pad.b);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = colors.muted;
      ctx.textBaseline = "top";
      ctx.textAlign = "left";
      ctx.fillText(lo.toFixed(1), pad.l, h - pad.b + 7);
      ctx.textAlign = "right";
      ctx.fillText(hi.toFixed(1), w - pad.r, h - pad.b + 7);
      ctx.textAlign = "center";
      ctx.fillText("0", zero, h - pad.b + 7);
    }

    function describe(sim, freq) {
      const hs = stdev(sim.hedged);
      const ns = stdev(sim.naked);
      const cut = Math.max(0, Math.round((1 - hs / ns) * 100));
      const how = freq === 1 ? "daily" : freq === 5 ? "every 5 days" : "once";
      const sign = (v) => (v >= 0 ? "+" : "") + v.toFixed(2);
      result.innerHTML =
        `sold for <b>${sim.premium.toFixed(2)}</b>, hedged ${how}, ${PATHS} paths. ` +
        `unhedged p&amp;l ${sign(mean(sim.naked))} ± ${ns.toFixed(2)} · hedged ${sign(mean(sim.hedged))} ± ${hs.toFixed(2)} ` +
        `→ hedging removed <b>${cut}%</b> of the risk.`;
    }

    function runSim() {
      const p = inputs();
      const freq = +freqSelect.value;
      lastSim = simulate(p, freq);
      drawHedgeChart(lastSim);
      describe(lastSim, freq);
    }

    const DECIMALS = { spot: 1, rate: 2 };

    function update() {
      const p = inputs();
      $$("output[data-for]", form).forEach((o) => {
        const key = o.dataset.for;
        const v = +form.elements[key].value;
        o.textContent = (key in DECIMALS ? v.toFixed(DECIMALS[key]) : v) + (o.dataset.suffix || "");
      });
      const g = blackScholes(p.type, p.S, p.K, p.vol, p.days / 365, p.r);
      $("#g-price").textContent = g.price.toFixed(2);
      $("#g-delta").textContent = g.delta.toFixed(3);
      $("#g-gamma").textContent = g.gamma.toFixed(4);
      $("#g-theta").textContent = g.theta.toFixed(3);
      $("#g-vega").textContent = g.vega.toFixed(3);
      drawValueChart(p, g);
      clearTimeout(simTimer);
      simTimer = setTimeout(runSim, 250);
    }

    form.addEventListener("input", update);
    freqSelect.addEventListener("change", runSim);
    $("#hedge-run").addEventListener("click", runSim);
    document.addEventListener("themechange", () => {
      readColors();
      update();
    });
    let resizeTimer = 0;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        update();
        if (lastSim) drawHedgeChart(lastSim);
      }, 150);
    });

    readColors();
    update();
  })();

  /* ---------- terminal ---------- */

  (function () {
    const out = $("#term-out");
    const form = $("#term-form");
    const input = $("#term-input");
    const body = $("#term-body");
    if (!form) return;

    const PROMPT = "visitor@fedora:~$";
    const KERNEL = "7.2.15-200.fc44.x86_64";
    const SECTIONS = ["about", "skills", "projects", "lab", "terminal", "contact"];
    const history = [];
    let historyIndex = 0;

    const text = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");

    function print(lines, className) {
      [].concat(lines).forEach((line) => {
        const p = document.createElement("p");
        if (className) p.className = className;
        p.textContent = line;
        out.append(p);
      });
      body.scrollTop = body.scrollHeight;
    }

    function open(name) {
      if (!SECTIONS.includes(name)) return `open: no such section '${name || ""}'. try: ${SECTIONS.join(", ")}`;
      document.getElementById(name).scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
      return `opening ${name}...`;
    }

    function fastfetch() {
      const mins = Math.max(1, Math.round((Date.now() - loadedAt) / 60000));
      const art = [
        "  ╭──────────╮ ",
        "  │    ╭───╴ │ ",
        "  │    │     │ ",
        "  │  ╶─┼──╴  │ ",
        "  │    │     │ ",
        "  │  ╶─╯     │ ",
        "  ╰──────────╯ ",
        "               ",
      ];
      const info = [
        "visitor@fedora",
        "──────────────",
        "os       fedora linux 44 x86_64",
        "kernel   " + KERNEL,
        "shell    bash",
        "uptime   " + mins + (mins === 1 ? " min" : " mins") + " (this tab)",
        "theme    " + root.dataset.theme,
        "screen   " + innerWidth + "x" + innerHeight,
      ];
      print(art.map((a, i) => a + "  " + (info[i] || "")), "term__art");
      return [];
    }

    const DNF_USAGE = "usage: dnf <install|remove|upgrade|search> [package]";

    function dnf(sub, ...pkgs) {
      const action = (sub || "").toLowerCase();
      const names = pkgs.map((p) => p.toLowerCase());
      if (action === "install" || action === "in") {
        if (!names.length) return "error: no package specified. try: dnf install coffee";
        if (names.includes("philip")) return ["package philip-2026-1.fc44.x86_64 is already installed.", "  to hire it, run: open contact"];
        return [
          "Updating and loading repositories:",
          " fedora   100% | done",
          " updates  100% | done",
          "Package                 Arch    Version      Repository   Size",
          ...names.map((n) => " " + n.padEnd(23) + " noarch  1.0-1.fc44   fedora       42.0 KiB"),
          "Is this ok [y/N]: y",
          "Complete! (in spirit. this is a portfolio, not a package manager.)",
        ];
      }
      if (action === "remove" || action === "rm") {
        if (!names.length) return "error: no package specified.";
        if (names.includes("philip")) return "error: cannot remove philip: package is protected.";
        return ["Removing: " + names.join(", "), "Complete!"];
      }
      if (action === "upgrade" || action === "update") {
        return ["Updating and loading repositories:", "Nothing to do. philip is already on the latest release."];
      }
      if (action === "search") {
        if (!names.length) return "error: no search term specified.";
        const hits = $$(".card").map((c) => text($(".card__title", c))).filter((t) => names.some((n) => t.includes(n)));
        return hits.length ? hits.map((t) => t + " : a project by philip") : `No matches found for '${names.join(" ")}'.`;
      }
      return DNF_USAGE;
    }

    const commands = {
      help: () => [
        "available commands:",
        "  whoami        who is this",
        "  about         the short version",
        "  projects      things i've built",
        "  skills        languages, tools, domains",
        "  contact       how to reach me",
        "  bs <call|put> <spot> <strike> <vol%> <days> [rate%]",
        "                price an option with black-scholes",
        "  fastfetch     system info, fedora edition",
        "  dnf install <pkg>   try it",
        "  uname -a      kernel info",
        "  cat /etc/os-release",
        "  open <name>   jump to a section (ls to list them)",
        "  theme [name]  " + THEMES.join(" | "),
        "  rebuild       let the swarm build the page again",
        "  date          what day it is",
        "  clear         clear the screen",
      ],
      whoami: () => [text($("#hero-title")), text($(".hero__tagline")).replace(/^>\s*/, "")],
      about: () => $$("#about .about__text p").map(text),
      projects: () => $$(".card").flatMap((card) => [
        "• " + text($(".card__title", card)),
        "  " + text($(".card__desc", card)),
        "  [" + $$(".tags li", card).map(text).join(", ") + "]",
      ]),
      skills: () => $$(".skills__group").map((g) => `${text($("h3", g))}: ${$$("li", g).map(text).join(", ")}`),
      contact: () => $$(".contact__list li").map((li) => `${text($(".contact__key", li)).padEnd(10)}${text($("a", li))}`),
      bs: (type, ...nums) => {
        const usage = "usage: bs <call|put> <spot> <strike> <vol%> <days> [rate%]   e.g. bs call 100 105 25 45";
        const [S, K, vol, days, rate = 6.5] = nums.map(Number);
        if (!["call", "put"].includes((type || "").toLowerCase())) return usage;
        if (![S, K, vol, days, rate].every(Number.isFinite) || S <= 0 || K <= 0 || vol <= 0 || days <= 0) return usage;
        const g = blackScholes(type.toLowerCase(), S, K, vol / 100, days / 365, rate / 100);
        return [
          `${type.toLowerCase()} S=${S} K=${K} σ=${vol}% T=${days}d r=${rate}%`,
          `  price  ${g.price.toFixed(4)}`,
          `  delta  ${g.delta.toFixed(4)}`,
          `  gamma  ${g.gamma.toFixed(5)}`,
          `  theta  ${g.theta.toFixed(4)} / day`,
          `  vega   ${g.vega.toFixed(4)} / 1% vol`,
        ];
      },
      fastfetch,
      neofetch: fastfetch,
      dnf,
      uname: (flag) => (flag === "-a" ? `Linux fedora ${KERNEL} #1 SMP PREEMPT_DYNAMIC x86_64 GNU/Linux` : flag === "-r" ? KERNEL : "Linux"),
      cat: (file) => {
        if (!file) return "usage: cat <file>";
        if (file === "/etc/os-release") return ['NAME="Fedora Linux"', 'VERSION="44"', "ID=fedora", "VERSION_ID=44", 'PRETTY_NAME="Fedora Linux 44"'];
        return `cat: ${file}: No such file or directory`;
      },
      ls: () => SECTIONS.join("  "),
      open,
      cd: open,
      theme: (name) => {
        if (!name) return `current: ${root.dataset.theme}. options: ${THEMES.join(", ")}`;
        return setTheme(name.toLowerCase()) ? `theme set to ${name.toLowerCase()}` : `theme: unknown theme '${name}'`;
      },
      rebuild: () => {
        if (reducedMotion) return "the swarm stays home when reduced motion is on.";
        setTimeout(() => {
          window.scrollTo({ top: 0, behavior: "auto" });
          swarm.start();
        }, 500);
        return "calling the swarm...";
      },
      date: () => new Date().toString(),
      echo: (...words) => words.join(" "),
      clear: () => { out.textContent = ""; return []; },
      sudo: (...args) => (args.length ? "visitor is not in the sudoers file. this incident will be reported." : "usage: sudo <command>"),
      exit: () => "there is no exit. try 'open contact' instead.",
    };

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const raw = input.value.trim();
      input.value = "";
      print(PROMPT + " " + raw, "term__echo");
      if (!raw) return;
      history.push(raw);
      historyIndex = history.length;
      const [name, ...args] = raw.split(/\s+/);
      const key = name.toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(commands, key)) {
        print(`bash: ${name}: command not found. type 'help'.`, "term__err");
        return;
      }
      const result = commands[key](...args);
      if (result && result.length) print(result);
    });

    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.isComposing) {
        e.preventDefault();
        form.requestSubmit();
      } else if (e.key === "ArrowUp" && historyIndex > 0) {
        historyIndex--;
        input.value = history[historyIndex];
        e.preventDefault();
      } else if (e.key === "ArrowDown") {
        historyIndex = Math.min(history.length, historyIndex + 1);
        input.value = history[historyIndex] || "";
        e.preventDefault();
      }
    });

    body.addEventListener("click", () => {
      if (!String(window.getSelection())) input.focus({ preventScroll: true });
    });

    $$("[data-open-terminal]").forEach((a) => a.addEventListener("click", () => {
      setTimeout(() => input.focus({ preventScroll: true }), reducedMotion ? 0 : 700);
    }));
  })();

  /* ---------- custom cursor ---------- */

  (function () {
    const dot = $(".cursor-dot");
    const ring = $(".cursor-ring");
    if (!finePointer || !dot || !ring) return;

    root.classList.add("has-custom-cursor");

    const HOVER_TARGETS = "a, button, input, select, label, [role='button']";
    const target = { x: innerWidth / 2, y: innerHeight / 2 };
    const pos = { x: target.x, y: target.y };
    let visible = false;

    function setVisible(on) {
      visible = on;
      dot.classList.toggle("is-active", on);
      ring.classList.toggle("is-active", on);
    }

    document.addEventListener("mousemove", (e) => {
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        pos.x = target.x;
        pos.y = target.y;
        setVisible(true);
      }
    });
    document.addEventListener("mouseleave", () => setVisible(false));
    document.addEventListener("mouseover", (e) => {
      ring.classList.toggle("is-hovering", Boolean(e.target.closest(HOVER_TARGETS)));
    });

    function tick() {
      // Lower values give a longer trail; reduced motion snaps the ring to the pointer.
      const k = reducedMotion ? 1 : 0.18;
      pos.x += (target.x - pos.x) * k;
      pos.y += (target.y - pos.y) * k;
      dot.style.transform = `translate3d(${target.x}px, ${target.y}px, 0)`;
      ring.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0)`;
      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  })();

  /* ---------- intro: split-flap greeting ---------- */

  function intro(done) {
    const el = $("#intro");
    const board = $("#intro-board");
    if (!el || !board || !root.classList.contains("intro-on")) return done();

    const FLAP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789',.-/_~";
    const STEP_MS = 65;
    const HOLD_MS = 1100;
    const randomChar = () => FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];

    const flaps = [...el.dataset.text].map((ch, i) => {
      const tile = document.createElement("span");
      tile.className = "flap";
      const c = document.createElement("span");
      c.className = "flap__c";
      c.textContent = randomChar();
      tile.append(c);
      board.append(tile);
      return { tile, c, target: ch, settleAt: 450 + i * 110 + Math.random() * 300, set: false };
    });

    let finished = false;
    let timer = 0;
    const t0 = performance.now();

    function show(f, ch) {
      f.c.textContent = ch === " " ? "" : ch;
      f.tile.classList.remove("is-flipping");
      void f.tile.offsetWidth;
      f.tile.classList.add("is-flipping");
    }

    function settle(f) {
      f.set = true;
      f.c.textContent = f.target === " " ? "" : f.target;
      f.tile.classList.remove("is-flipping");
      f.tile.classList.add("is-set", ...(f.target === " " ? ["is-space"] : []));
    }

    function finish(keepScroll) {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      flaps.forEach((f) => { if (!f.set) settle(f); });
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      el.classList.add("is-leaving");
      if (keepScroll !== true) window.scrollTo(0, 0);
      setTimeout(() => {
        root.classList.remove("intro-on");
        el.remove();
        done();
      }, 500);
    }

    function step() {
      const t = performance.now() - t0;
      flaps.forEach((f) => {
        if (f.set) return;
        if (t >= f.settleAt) settle(f);
        else show(f, randomChar());
      });
      timer = flaps.every((f) => f.set) ? setTimeout(finish, HOLD_MS) : setTimeout(step, STEP_MS);
    }

    function onClick(e) {
      if (e.target.closest("#intro")) finish();
      else if (e.target.closest(".site-header a")) finish(true);
    }

    function onKey(e) {
      if (e.key === "Tab" || e.key === "Shift") return;
      finish();
    }

    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    timer = setTimeout(step, 250);
  }

  /* ---------- go ---------- */

  intro(() => {
    if (root.classList.contains("swarm-on")) swarm.start();
  });
})();
