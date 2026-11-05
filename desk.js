/* Draggable "desk" hero: moving pieces, the split-flap card and visitor sticky notes. */

(function () {
  "use strict";

  const root = document.documentElement;
  const desk = document.getElementById("desk");
  if (!desk) return;

  const wide = window.matchMedia("(min-width: 901px)");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const rand = (a, b) => a + Math.random() * (b - a);
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  // Hidden until the swarm builds it (or there is no swarm).
  const isShown = (el) => !root.classList.contains("swarm-on") || el.classList.contains("sw-built");

  /* ---------- dragging ---------- */

  let topZ = 10;
  let drag = null;
  let justDragged = null;

  desk.addEventListener("pointerdown", (e) => {
    if (!wide.matches || e.button !== 0) return;
    const item = e.target.closest("[data-drag]");
    if (!item || e.target.closest("[contenteditable], .note__close")) return;
    const r = item.getBoundingClientRect();
    const d = desk.getBoundingClientRect();
    const dx = parseFloat(item.style.getPropertyValue("--dx")) || 0;
    const dy = parseFloat(item.style.getPropertyValue("--dy")) || 0;
    drag = {
      item, id: e.pointerId, sx: e.clientX, sy: e.clientY, dx, dy, moved: false,
      // Keep at least half of the piece on the desk.
      minX: d.left - r.left - r.width / 2, maxX: d.right - r.right + r.width / 2,
      minY: d.top - r.top - r.height / 2, maxY: d.bottom - r.bottom + r.height / 2,
    };
    item.style.zIndex = ++topZ;
  });

  window.addEventListener("pointermove", (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const mx = clamp(e.clientX - drag.sx, drag.minX, drag.maxX);
    const my = clamp(e.clientY - drag.sy, drag.minY, drag.maxY);
    if (!drag.moved) {
      if (Math.hypot(mx, my) < 4) return;
      drag.moved = true;
      drag.item.classList.add("is-dragging");
    }
    e.preventDefault();
    drag.item.style.setProperty("--dx", drag.dx + mx + "px");
    drag.item.style.setProperty("--dy", drag.dy + my + "px");
  });

  function endDrag(e) {
    if (!drag || e.pointerId !== drag.id) return;
    if (drag.moved) justDragged = drag.item;
    drag.item.classList.remove("is-dragging");
    drag = null;
  }
  window.addEventListener("pointerup", endDrag);
  window.addEventListener("pointercancel", endDrag);

  // A drag that ends on a link shouldn't also follow it.
  desk.addEventListener("click", (e) => {
    if (justDragged && e.target.closest("[data-drag]") === justDragged) {
      e.preventDefault();
      e.stopPropagation();
    }
    justDragged = null;
  }, true);

  desk.addEventListener("dragstart", (e) => e.preventDefault());

  /* ---------- split-flap card ---------- */

  const flapcard = document.getElementById("flapcard");
  const rows = flapcard ? [...flapcard.querySelectorAll(".flapcard__row")] : [];
  const PHRASES = [["PRICING", "OPTIONS"], ["HEDGING", "DELTAS"], ["READING", "HANDS"], ["BUILDING", "ON FEDORA"]];
  const FLAP_CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const COLS = 10;

  const tiles = rows.map((row) => Array.from({ length: COLS }, () => {
    const tile = document.createElement("span");
    tile.className = "flap is-set is-space";
    const c = document.createElement("span");
    c.className = "flap__c";
    tile.append(c);
    row.append(tile);
    return { tile, c };
  }));

  function flipRow(row, word) {
    const target = word.padEnd(COLS, " ");
    const t0 = performance.now();
    row.forEach((f, i) => {
      const ch = target[i];
      const wasBlank = f.c.textContent === "";
      // Blank tiles that stay blank don't flip; it keeps the board calm.
      if (wasBlank && ch === " ") return;
      const settleAt = t0 + 120 + i * 70 + rand(0, 220);
      f.tile.classList.remove("is-set", "is-space");
      (function spin() {
        f.tile.classList.remove("is-flipping");
        void f.tile.offsetWidth;
        f.tile.classList.add("is-flipping");
        if (performance.now() >= settleAt) {
          f.c.textContent = ch === " " ? "" : ch;
          f.tile.classList.add("is-set");
          if (ch === " ") f.tile.classList.add("is-space");
          return;
        }
        f.c.textContent = FLAP_CHARS[Math.floor(Math.random() * FLAP_CHARS.length)];
        setTimeout(spin, 65);
      })();
    });
  }

  function setRow(row, word) {
    const target = word.padEnd(COLS, " ");
    row.forEach((f, i) => {
      f.c.textContent = target[i] === " " ? "" : target[i];
      f.tile.className = "flap is-set" + (target[i] === " " ? " is-space" : "");
    });
  }

  if (tiles.length === 2) {
    let phrase = 0;
    const show = () => {
      const [a, b] = PHRASES[phrase];
      if (reducedMotion) { setRow(tiles[0], a); setRow(tiles[1], b); }
      else { flipRow(tiles[0], a); setTimeout(() => flipRow(tiles[1], b), 260); }
      phrase = (phrase + 1) % PHRASES.length;
    };
    (function waitForCard() {
      if (!isShown(flapcard)) { setTimeout(waitForCard, 300); return; }
      show();
      setInterval(() => { if (!document.hidden) show(); }, 4200);
    })();
  }

  /* ---------- visitor sticky notes ---------- */

  const addBtn = document.getElementById("desk-add");
  const COLORS = ["yellow", "pink", "blue", "green", "violet"];
  let added = 0;

  if (addBtn) {
    addBtn.addEventListener("click", () => {
      const note = document.createElement("div");
      note.className = `note note--${COLORS[added++ % COLORS.length]} note--new`;
      note.setAttribute("data-drag", "");
      note.style.setProperty("--x", Math.round(rand(0.32, 0.56) * desk.clientWidth) + "px");
      note.style.setProperty("--y", Math.round(rand(150, 420)) + "px");
      note.style.setProperty("--r", rand(-6, 6).toFixed(1) + "deg");
      note.style.zIndex = ++topZ;
      note.innerHTML =
        '<button type="button" class="note__close" aria-label="Remove note">×</button>' +
        '<p class="note__edit" contenteditable="true" spellcheck="false" aria-label="Your note">write something…</p>' +
        '<p class="note__sign">— a visitor</p>';
      desk.insertBefore(note, addBtn);
      const edit = note.querySelector(".note__edit");
      edit.focus({ preventScroll: true });
      const range = document.createRange();
      range.selectNodeContents(edit);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });

    desk.addEventListener("click", (e) => {
      const close = e.target.closest(".note__close");
      if (close) close.closest(".note").remove();
    });
  }
})();
