/**
 * 이음 — 가벼운 레벨/경험치 (어르신용, localStorage)
 * 레벨 상한 없음(안전 상한 99), 미션 성공 시 XP 적립
 * 레벨업 시 중앙 대형 연출 + 폭죽
 * 종료 후 실습 선택 화면에서 획득 경험치를 토스트로 안내
 */
(function (global) {
  const KEY = "ieum_progress_v1";
  const LAST_GAIN_KEY = "ieum_last_gain_v1";
  /** 레벨 1 기준 필요 XP. 레벨이 오를수록 더 많이 필요 */
  const XP_BASE = 100;
  const XP_GROWTH = 55;
  /** 안전 상한 (실질적으로 계속 레벨업 가능) */
  const MAX_LEVEL = 99;

  const FIREWORK_COLORS = [
    "#ff4d6d",
    "#ffd60a",
    "#4cc9f0",
    "#7b2cbf",
    "#06d6a0",
    "#ff9f1c",
    "#4361ee",
    "#f72585",
    "#80ffdb",
    "#fff",
  ];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { xp: 0, level: 1, wins: 0 };
      const d = JSON.parse(raw);
      return {
        xp: Number(d.xp) || 0,
        level: Math.min(MAX_LEVEL, Math.max(1, Number(d.level) || 1)),
        wins: Number(d.wins) || 0,
      };
    } catch {
      return { xp: 0, level: 1, wins: 0 };
    }
  }

  function save(data) {
    localStorage.setItem(KEY, JSON.stringify(data));
  }

  /**
   * 해당 레벨 → 다음 레벨에 필요한 경험치
   * Lv1: 100, Lv2: 155, Lv3: 210 … (레벨 올라갈수록 +55)
   */
  function xpForLevel(level) {
    const lv = Math.max(1, Number(level) || 1);
    return XP_BASE + (lv - 1) * XP_GROWTH;
  }

  function getProgress() {
    const d = load();
    const need = xpForLevel(d.level);
    return {
      ...d,
      need,
      percent: Math.min(100, Math.round((d.xp / need) * 100)),
      maxLevel: MAX_LEVEL,
    };
  }

  /**
   * 실습 완료 경험치
   * 미션 성공: 200 + 품목×80  → 1개 280, 2개 360, 3개 440
   * 결제만 완료: 성공의 약 70% (최소 160)
   */
  function rewardXp(itemCount, fullSuccess) {
    const n = Math.max(1, Number(itemCount) || 1);
    const full = 200 + n * 80;
    if (fullSuccess === false) return Math.max(160, Math.round(full * 0.7));
    return full;
  }

  /** 결제/실습 종료 시 호출. fullSuccess 기본 true */
  function awardPractice(itemCount, fullSuccess) {
    return addWin(rewardXp(itemCount, fullSuccess !== false));
  }

  function saveLastGain(info) {
    try {
      sessionStorage.setItem(LAST_GAIN_KEY, JSON.stringify(info));
    } catch {
      /* ignore */
    }
  }

  function patchLastGain(patch) {
    try {
      const raw = sessionStorage.getItem(LAST_GAIN_KEY);
      if (!raw) return;
      const g = JSON.parse(raw);
      sessionStorage.setItem(LAST_GAIN_KEY, JSON.stringify({ ...g, ...patch }));
    } catch {
      /* ignore */
    }
  }

  /** 저장된 최근 획득을 읽고 지움 (한 번만 표시) */
  function consumeLastGain() {
    try {
      const raw = sessionStorage.getItem(LAST_GAIN_KEY);
      if (!raw) return null;
      sessionStorage.removeItem(LAST_GAIN_KEY);
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  /** 경험치 직접 적립. gain 기본 = 1품목 미션 성공량 */
  function addWin(gain) {
    const d = load();
    const prevLevel = d.level;
    const add = gain == null ? rewardXp(1, true) : gain;
    d.xp += add;
    d.wins += 1;
    let leveled = false;
    // 10레벨 이후에도 계속 레벨업 (MAX_LEVEL까지)
    while (d.level < MAX_LEVEL && d.xp >= xpForLevel(d.level)) {
      d.xp -= xpForLevel(d.level);
      d.level += 1;
      leveled = true;
    }
    if (d.level >= MAX_LEVEL) {
      d.level = MAX_LEVEL;
      d.xp = Math.min(d.xp, xpForLevel(MAX_LEVEL) - 1);
    }
    save(d);
    const result = {
      ...getProgress(),
      leveled,
      gained: add,
      prevLevel,
    };
    saveLastGain({
      gained: result.gained,
      level: result.level,
      prevLevel,
      leveled: result.leveled,
      xp: result.xp,
      need: result.need,
      percent: result.percent,
      celebrated: false,
      at: Date.now(),
    });

    // 레벨업 즉시 중앙 폭죽 (성공 화면에서도)
    if (leveled) {
      setTimeout(() => {
        celebrateLevelUp(result);
        patchLastGain({ celebrated: true });
      }, 350);
    }
    return result;
  }

  /** 난이도 힌트: 1 쉬움 ~ 3 조금 어려움 */
  function difficulty() {
    const lv = load().level;
    if (lv <= 2) return 1;
    if (lv <= 5) return 2;
    return 3;
  }

  function renderBadge(el) {
    if (!el) return;
    const p = getProgress();
    el.innerHTML = `
      <span class="level-badge__lv">레벨 ${p.level}</span>
      <span class="level-badge__bar"><i style="width:${p.percent}%"></i></span>
      <span class="level-badge__xp">${p.xp}/${p.need}</span>
    `;
  }

  function ensureToastRoot() {
    let root = document.getElementById("ieum-xp-toast");
    if (root) return root;
    root = document.createElement("div");
    root.id = "ieum-xp-toast";
    root.className = "xp-toast";
    root.setAttribute("role", "status");
    root.setAttribute("aria-live", "polite");
    root.hidden = true;
    document.body.appendChild(root);
    return root;
  }

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function pickColor() {
    return FIREWORK_COLORS[Math.floor(Math.random() * FIREWORK_COLORS.length)];
  }

  /** 키오스크/쿠팡 등 메인 CSS 없는 페이지에서도 연출 가능하도록 스타일 주입 */
  function ensureLevelupStyles() {
    if (document.getElementById("ieum-levelup-css")) return;
    const style = document.createElement("style");
    style.id = "ieum-levelup-css";
    style.textContent = `
      body.is-levelup-open{overflow:hidden}
      .levelup-overlay{position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:24px;background:rgba(8,18,40,.55);opacity:0;transition:opacity .35s ease;cursor:pointer;-webkit-tap-highlight-color:transparent}
      .levelup-overlay.is-show{opacity:1}
      .levelup-overlay__canvas{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
      .levelup-overlay__burst{position:absolute;inset:0;pointer-events:none;overflow:hidden}
      .levelup-overlay__ring{position:absolute;width:20px;height:20px;margin:-10px 0 0 -10px;border-radius:50%;border:3px solid var(--ring-color,#ffd60a);box-shadow:0 0 24px var(--ring-color,#ffd60a);animation:levelup-ring .85s ease-out forwards;pointer-events:none}
      @keyframes levelup-ring{0%{transform:scale(.3);opacity:1}100%{transform:scale(18);opacity:0}}
      .levelup-overlay__card{position:relative;z-index:2;text-align:center;padding:36px 40px 32px;max-width:min(480px,calc(100vw - 32px));background:linear-gradient(165deg,#fff 0%,#f0f9ff 55%,#ecfdf5 100%);border:3px solid #22c55e;border-radius:28px;box-shadow:0 0 0 6px rgba(34,197,94,.18),0 24px 60px rgba(8,20,50,.35);transform:scale(.55);opacity:0;transition:transform .55s cubic-bezier(.22,1.35,.36,1),opacity .4s ease}
      .levelup-overlay.is-show .levelup-overlay__card{transform:scale(1);opacity:1;animation:levelup-card-bounce .7s cubic-bezier(.22,1.35,.36,1) both}
      @keyframes levelup-card-bounce{0%{transform:scale(.4)}55%{transform:scale(1.08)}75%{transform:scale(.96)}100%{transform:scale(1)}}
      .levelup-overlay__eyebrow{margin:0 0 6px;font-size:.95rem;font-weight:800;letter-spacing:.22em;color:#2563eb}
      .levelup-overlay__stars{margin:0 0 4px;font-size:1.6rem;letter-spacing:.35em;color:#f59e0b;animation:levelup-stars 1.2s ease-in-out infinite alternate}
      @keyframes levelup-stars{from{transform:scale(1)}to{transform:scale(1.12);filter:brightness(1.25)}}
      .levelup-overlay__title{margin:0;font-size:clamp(2.4rem,9vw,3.4rem);font-weight:900;line-height:1.1;color:#0f172a}
      .levelup-overlay__level{margin:12px 0 4px;font-size:clamp(3.2rem,14vw,5rem);font-weight:900;line-height:1;background:linear-gradient(120deg,#2563eb 0%,#16a34a 55%,#eab308 100%);-webkit-background-clip:text;background-clip:text;color:transparent;animation:levelup-level-pulse 1.1s ease-in-out infinite alternate}
      @keyframes levelup-level-pulse{from{transform:scale(1)}to{transform:scale(1.06)}}
      .levelup-overlay__from{margin:8px 0 0;font-size:1.35rem;font-weight:800;color:#64748b}
      .levelup-overlay__xp{margin:14px 0 0;display:inline-block;padding:8px 18px;border-radius:999px;background:#dbeafe;color:#1d4ed8;font-size:1.25rem;font-weight:800}
      .levelup-overlay__hint{margin:18px 0 0;font-size:1rem;font-weight:600;color:#94a3b8}
    `;
    document.head.appendChild(style);
  }

  /**
   * 중앙 대형 레벨업 + 폭죽/꽃가루
   * @param {{ level:number, prevLevel?:number, gained?:number }} info
   */
  function celebrateLevelUp(info) {
    if (!info || !info.level) return;
    if (document.getElementById("ieum-levelup-overlay")) return;
    ensureLevelupStyles();

    const level = info.level;
    const prev = info.prevLevel != null ? info.prevLevel : Math.max(1, level - 1);
    const gained = info.gained || 0;

    const overlay = document.createElement("div");
    overlay.id = "ieum-levelup-overlay";
    overlay.className = "levelup-overlay";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", `레벨 ${level}로 올랐습니다`);
    overlay.innerHTML = `
      <canvas class="levelup-overlay__canvas" aria-hidden="true"></canvas>
      <div class="levelup-overlay__burst" aria-hidden="true"></div>
      <div class="levelup-overlay__card">
        <p class="levelup-overlay__eyebrow">LEVEL UP</p>
        <p class="levelup-overlay__stars" aria-hidden="true">✦ ★ ✦</p>
        <p class="levelup-overlay__title">레벨 업!</p>
        <p class="levelup-overlay__level">레벨 ${level}</p>
        <p class="levelup-overlay__from">${prev} → ${level}</p>
        ${
          gained
            ? `<p class="levelup-overlay__xp">경험치 +${gained}</p>`
            : ""
        }
        <p class="levelup-overlay__hint">화면을 누르면 닫혀요</p>
      </div>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add("is-levelup-open");

    const canvas = overlay.querySelector(".levelup-overlay__canvas");
    const burst = overlay.querySelector(".levelup-overlay__burst");
    runFireworks(canvas, burst);

    requestAnimationFrame(() => overlay.classList.add("is-show"));

    let closed = false;
    const close = () => {
      if (closed) return;
      closed = true;
      overlay.classList.remove("is-show");
      document.body.classList.remove("is-levelup-open");
      setTimeout(() => overlay.remove(), 420);
    };

    overlay.addEventListener("click", close);
    setTimeout(close, 5200);

    return close;
  }

  function runFireworks(canvas, burstEl) {
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rockets = [];
    const sparks = [];
    let confetti = [];
    let running = true;
    let start = performance.now();

    function resize() {
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    function spawnRocket() {
      const x = rand(w * 0.12, w * 0.88);
      rockets.push({
        x,
        y: h + 10,
        vx: rand(-1.2, 1.2),
        vy: rand(-16, -11),
        color: pickColor(),
        targetY: rand(h * 0.18, h * 0.45),
        trail: [],
      });
    }

    function explode(x, y, color, big) {
      const n = big ? 90 : 55;
      for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 * i) / n + rand(-0.1, 0.1);
        const sp = big ? rand(3, 11) : rand(2, 8);
        sparks.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 1,
          decay: rand(0.012, 0.025),
          color: Math.random() > 0.35 ? color : pickColor(),
          size: rand(2, 4.5),
        });
      }
      // 중앙 플래시 링
      if (burstEl) {
        const ring = document.createElement("span");
        ring.className = "levelup-overlay__ring";
        ring.style.left = x + "px";
        ring.style.top = y + "px";
        ring.style.setProperty("--ring-color", color);
        burstEl.appendChild(ring);
        setTimeout(() => ring.remove(), 900);
      }
    }

    function spawnConfetti() {
      for (let i = 0; i < 48; i++) {
        confetti.push({
          x: rand(0, w),
          y: rand(-h * 0.2, -10),
          w: rand(6, 12),
          h: rand(8, 16),
          vx: rand(-1.5, 1.5),
          vy: rand(2.5, 6),
          rot: rand(0, Math.PI * 2),
          vr: rand(-0.2, 0.2),
          color: pickColor(),
          life: 1,
        });
      }
    }

    // 초기 폭죽 연타
    spawnRocket();
    spawnRocket();
    spawnConfetti();
    setTimeout(spawnRocket, 180);
    setTimeout(spawnRocket, 360);
    setTimeout(() => {
      spawnRocket();
      spawnConfetti();
    }, 700);
    setTimeout(spawnRocket, 1100);
    setTimeout(spawnRocket, 1600);
    setTimeout(() => {
      spawnRocket();
      spawnConfetti();
    }, 2100);

    function tick(now) {
      if (!running) return;
      if (now - start > 5000) {
        running = false;
        window.removeEventListener("resize", resize);
        return;
      }

      ctx.clearRect(0, 0, w, h);

      // rockets
      for (let i = rockets.length - 1; i >= 0; i--) {
        const r = rockets[i];
        r.x += r.vx;
        r.y += r.vy;
        r.vy += 0.18;
        r.trail.push({ x: r.x, y: r.y });
        if (r.trail.length > 8) r.trail.shift();

        for (let t = 0; t < r.trail.length; t++) {
          const p = r.trail[t];
          ctx.globalAlpha = (t / r.trail.length) * 0.6;
          ctx.fillStyle = r.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(r.x, r.y, 3.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = r.color;
        ctx.beginPath();
        ctx.arc(r.x, r.y, 2, 0, Math.PI * 2);
        ctx.fill();

        if (r.vy >= 0 || r.y <= r.targetY) {
          explode(r.x, r.y, r.color, true);
          rockets.splice(i, 1);
        }
      }

      // sparks
      for (let i = sparks.length - 1; i >= 0; i--) {
        const s = sparks[i];
        s.x += s.vx;
        s.y += s.vy;
        s.vy += 0.06;
        s.vx *= 0.99;
        s.life -= s.decay;
        if (s.life <= 0) {
          sparks.splice(i, 1);
          continue;
        }
        ctx.globalAlpha = Math.max(0, s.life);
        ctx.fillStyle = s.color;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.size * s.life, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // confetti
      for (let i = confetti.length - 1; i >= 0; i--) {
        const c = confetti[i];
        c.x += c.vx;
        c.y += c.vy;
        c.rot += c.vr;
        c.vy += 0.04;
        if (c.y > h + 30) {
          confetti.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
        ctx.restore();
      }

      requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);

    // overlay 제거 시 정지
    const obs = new MutationObserver(() => {
      if (!document.body.contains(canvas)) {
        running = false;
        window.removeEventListener("resize", resize);
        obs.disconnect();
      }
    });
    obs.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * 실습 종료 후 돌아왔을 때 호출.
   * sessionStorage에 남은 획득 정보를 토스트 + 배지 애니메이션으로 보여줌.
   * 레벨업인데 아직 축하를 안 봤으면 중앙 폭죽.
   */
  function showPendingGain(badgeEl) {
    const gain = consumeLastGain();
    if (!gain || !gain.gained) {
      if (badgeEl) renderBadge(badgeEl);
      return null;
    }

    if (badgeEl) {
      renderBadge(badgeEl);
      badgeEl.classList.remove("level-badge--gain");
      void badgeEl.offsetWidth;
      badgeEl.classList.add("level-badge--gain");
      if (gain.leveled) badgeEl.classList.add("level-badge--levelup");
      setTimeout(() => {
        badgeEl.classList.remove("level-badge--gain", "level-badge--levelup");
      }, 2200);
    }

    if (gain.leveled && !gain.celebrated) {
      setTimeout(() => celebrateLevelUp(gain), 200);
      return gain;
    }

    // 레벨업은 이미 봤으면 작은 토스트만, 일반 경험치도 토스트
    const toast = ensureToastRoot();
    const title = gain.leveled ? "레벨이 올랐어요!" : "경험치를 얻었어요!";
    const detail = gain.leveled
      ? `경험치 +${gain.gained} · 레벨 ${gain.level}`
      : `경험치 +${gain.gained} · 지금 레벨 ${gain.level}`;
    toast.innerHTML = `
      <div class="xp-toast__card">
        <div class="xp-toast__icon" aria-hidden="true">${gain.leveled ? "★" : "+"}</div>
        <div class="xp-toast__body">
          <p class="xp-toast__title">${title}</p>
          <p class="xp-toast__detail">${detail}</p>
          <p class="xp-toast__bar-wrap">
            <span class="xp-toast__bar"><i style="width:0%"></i></span>
            <span class="xp-toast__nums">${gain.xp}/${gain.need}</span>
          </p>
        </div>
      </div>
    `;
    toast.hidden = false;
    requestAnimationFrame(() => {
      toast.classList.add("is-show");
      const bar = toast.querySelector(".xp-toast__bar i");
      if (bar) {
        requestAnimationFrame(() => {
          bar.style.width = `${gain.percent}%`;
        });
      }
    });

    const hide = () => {
      toast.classList.remove("is-show");
      setTimeout(() => {
        toast.hidden = true;
        toast.innerHTML = "";
      }, 350);
    };
    setTimeout(hide, 4200);
    toast.addEventListener("click", hide, { once: true });

    return gain;
  }

  global.IeumLevel = {
    getProgress,
    addWin,
    awardPractice,
    rewardXp,
    difficulty,
    renderBadge,
    load,
    showPendingGain,
    consumeLastGain,
    celebrateLevelUp,
  };
})(window);
