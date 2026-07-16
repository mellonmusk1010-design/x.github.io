/**
 * 메가MGC커피 키오스크 — 노랑·블랙 UI, 랜덤 미션·수량·가이드
 */
(() => {
  const state = {
    dining: null,
    menu: null,
    categorySlug: null,
    cart: [],
    selectedProduct: null,
    qty: 1,
    mission: null,
    guideStep: "dining",
    orderNumber: null,
  };

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  let payInstance = null;

  function destroyPay() {
    if (payInstance?.destroy) payInstance.destroy();
    payInstance = null;
  }

  function toast(msg) {
    const el = $("#toast");
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("is-show"), 2000);
  }

  function formatPrice(n) {
    return `${Number(n).toLocaleString("ko-KR")}원`;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function showScreen(name) {
    $$(".screen").forEach((s) => s.classList.toggle("is-active", s.dataset.screen === name));
    requestAnimationFrame(updateGuide);
  }

  function clearHL() {
    $$(".guide-highlight").forEach((e) => e.classList.remove("guide-highlight"));
  }

  function hl(el) {
    if (!el) return;
    el.classList.add("guide-highlight");
    try {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" });
    } catch (_) {}
  }

  function currentItem() {
    if (!state.mission?.items?.length) return null;
    return state.mission.items[state.mission.itemIndex] || state.mission.items[0];
  }

  function createMission() {
    if (!state.menu?.products?.length) return null;
    const diff = window.IeumLevel ? IeumLevel.difficulty() : 1;
    const drinks = state.menu.products.filter((p) => p.categorySlug === "drink" && p.image);
    const foods = state.menu.products.filter((p) => p.categorySlug === "food" && p.image);
    const pool = drinks.length ? drinks : state.menu.products.filter((p) => p.image);

    let count = 1;
    if (diff === 2) count = Math.random() > 0.4 ? 2 : 1;
    if (diff >= 3) count = Math.random() > 0.3 ? 3 : 2;

    const items = [];
    const used = new Set();
    for (let i = 0; i < count; i++) {
      let src = i === 0 ? pool : (foods.length && Math.random() > 0.5 ? foods : pool);
      if (!src.length) src = pool;
      let p = pickRandom(src);
      let tries = 0;
      while (used.has(p.id) && tries < 10) {
        p = pickRandom(src);
        tries++;
      }
      used.add(p.id);
      let qty = 1;
      if (diff >= 2 && Math.random() > 0.55) qty = 2;
      if (diff >= 3 && Math.random() > 0.7) qty = 3;
      items.push({
        productId: p.id,
        productName: p.name,
        categorySlug: p.categorySlug,
        qty,
      });
    }

    const dining = Math.random() > 0.5 ? "here" : "takeout";
    return {
      items,
      itemIndex: 0,
      dining,
      diningLabel: dining === "here" ? "매장" : "포장",
      label: items.map((it) => (it.qty > 1 ? `${it.productName}×${it.qty}` : it.productName)).join(" + "),
    };
  }

  function showMissionBoard() {
    const el = $("#mission-board");
    if (!el || !state.mission) return;
    el.hidden = false;
    el.innerHTML = `
      <div class="mission-board__label">오늘의 미션</div>
      <div class="mission-board__title">${escapeHtml(state.mission.label)} 주문</div>
    `;
  }

  function setGuideStep(step) {
    state.guideStep = step;
    updateGuide();
  }

  function guideText() {
    const m = state.mission;
    const it = currentItem();
    if (!m) return "따라 하세요";
    const multi =
      m.items.length > 1 ? ` (${m.itemIndex + 1}/${m.items.length})` : "";
    switch (state.guideStep) {
      case "dining":
        return `「${m.diningLabel}」 누르기`;
      case "category":
        return `위 탭 「${categoryName(it.categorySlug)}」${multi}`;
      case "product":
        return `「${it.productName}」 누르기`;
      case "qty":
        return `수량을 ${it.qty}개로`;
      case "add":
        return "「담기」 누르기";
      case "pay":
        return "「결제」 누르기";
      case "pay-method":
        return "「QR」 또는 「쿠폰」";
      case "qr":
        return "휴대폰으로 QR 찍기";
      case "coupon":
        return "쿠폰 번호 입력 (키보드 가능)";
      case "done":
        return "완료!";
      default:
        return "노란 칸 누르기";
    }
  }

  function categoryName(slug) {
    return state.menu?.categories?.find((c) => c.slug === slug)?.name || slug;
  }

  function updateGuideBar() {
    const bar = $("#guide-bar");
    if (!bar) return;
    if (!state.mission) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    $("#guide-mission").textContent = `미션: ${state.mission.label}`;
    $("#guide-step").textContent = guideText();
  }

  function updateGuide() {
    clearHL();
    updateGuideBar();
    const m = state.mission;
    const it = currentItem();
    if (!m) return;
    const step = state.guideStep;
    if (step === "dining") hl($(`[data-dining="${m.dining}"]`));
    else if (step === "category" && it) hl($(`.mega-tab[data-slug="${it.categorySlug}"]`));
    else if (step === "product" && it) {
      if (state.categorySlug !== it.categorySlug) selectCategory(it.categorySlug);
      hl($(`.product-card[data-id="${it.productId}"]`));
    } else if (step === "qty") {
      if (state.qty < (it?.qty || 1)) hl($("#qty-plus"));
      else hl($("#modal-add"));
    } else if (step === "add") hl($("#modal-add"));
    else if (step === "pay") hl($("#btn-pay"));
    else if (step === "pay-method") {
      hl($("#btn-qr"));
      hl($("#btn-coupon"));
    } else if (step === "qr") hl($("#qr-pay-mount"));
    else if (step === "coupon") hl($("#coupon-pay-input") || $("#coupon-pay-mount"));
  }

  async function loadMenu() {
    $("#product-grid").innerHTML = `<div class="loading-box">메뉴 불러오는 중…</div>`;
    try {
      const res = await fetch("/api/kiosk/menu/mega");
      state.menu = await res.json();
      if (!state.menu.products?.length) throw new Error("empty");
      state.mission = createMission();
      showMissionBoard();
      renderTabs();
      selectCategory(state.menu.categories[0]?.slug || "drink");
      setGuideStep("dining");
    } catch (e) {
      console.error(e);
      $("#product-grid").innerHTML = `<div class="loading-box">메뉴를 불러오지 못했습니다</div>`;
    }
  }

  function renderTabs() {
    const tabs = $("#mega-tabs");
    tabs.innerHTML = (state.menu.categories || [])
      .map(
        (c) =>
          `<button type="button" class="mega-tab" data-slug="${c.slug}">${escapeHtml(c.name)}</button>`
      )
      .join("");
    if (!tabs.dataset.bound) {
      tabs.dataset.bound = "1";
      tabs.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-slug]");
        if (!btn) return;
        const slug = btn.dataset.slug;
        const it = currentItem();
        if (state.mission && state.guideStep === "category" && it) {
          if (slug !== it.categorySlug) {
            toast(`「${categoryName(it.categorySlug)}」 탭이에요`);
            updateGuide();
            return;
          }
          selectCategory(slug);
          setGuideStep("product");
          return;
        }
        selectCategory(slug);
      });
    }
  }

  function selectCategory(slug) {
    state.categorySlug = slug;
    $$(".mega-tab").forEach((t) => t.classList.toggle("is-active", t.dataset.slug === slug));
    const cat = state.menu.categories.find((c) => c.slug === slug);
    $("#cat-title").textContent = cat ? cat.name : "메뉴";
    renderProducts();
  }

  function renderProducts() {
    const list = state.menu.products.filter((p) => p.categorySlug === state.categorySlug);
    const grid = $("#product-grid");
    if (!list.length) {
      grid.innerHTML = `<div class="loading-box">메뉴 없음</div>`;
      return;
    }
    grid.innerHTML = list
      .map(
        (p) => `
      <button type="button" class="product-card" data-id="${p.id}">
        <div class="product-card__img">
          <img src="${p.image}" alt="" loading="lazy" onerror="this.style.opacity=0.3" />
        </div>
        <div class="product-card__body">
          <div class="product-card__name">${escapeHtml(p.name)}</div>
          ${p.label ? `<div class="product-card__meta">${escapeHtml(p.label)}</div>` : ""}
          <div class="product-card__price">${formatPrice(p.price)}</div>
        </div>
      </button>`
      )
      .join("");
    requestAnimationFrame(updateGuide);
  }

  function cartTotal() {
    return state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  }

  function updateCartBar() {
    const n = state.cart.reduce((s, i) => s + i.qty, 0);
    $("#cart-count").textContent = n ? `${n}개` : "비어 있음";
    $("#cart-total").textContent = formatPrice(cartTotal());
    $("#btn-pay").disabled = n === 0;
  }

  function openModal(product) {
    state.selectedProduct = product;
    state.qty = 1;
    const it = currentItem();
    $("#modal-body").innerHTML = `
      <div class="modal__product">
        <img src="${product.image || ""}" alt="" />
        <div>
          <div class="modal__product-name">${escapeHtml(product.name)}</div>
          <div class="modal__product-price">${formatPrice(product.price)}</div>
        </div>
      </div>
      <div class="qty-row">
        <div style="font-weight:900;font-size:1.2rem">수량</div>
        <div class="qty-controls">
          <button type="button" class="qty-btn" id="qty-minus">−</button>
          <span class="qty-val" id="qty-val">1</span>
          <button type="button" class="qty-btn" id="qty-plus">+</button>
        </div>
      </div>
    `;
    $("#qty-minus").onclick = () => {
      state.qty = Math.max(1, state.qty - 1);
      $("#qty-val").textContent = state.qty;
      updateGuide();
    };
    $("#qty-plus").onclick = () => {
      state.qty = Math.min(9, state.qty + 1);
      $("#qty-val").textContent = state.qty;
      const need = it?.qty || 1;
      if (state.mission && state.qty >= need) setGuideStep("add");
      else updateGuide();
    };
    $("#modal").classList.add("is-open");
    if (it && String(product.id) === String(it.productId)) {
      setGuideStep(it.qty > 1 ? "qty" : "add");
    } else updateGuide();
  }

  function addToCart() {
    const p = state.selectedProduct;
    if (!p) return;
    const it = currentItem();
    if (state.mission && it) {
      if (String(p.id) !== String(it.productId)) {
        toast(`「${it.productName}」 을 고르세요`);
        return;
      }
      if (state.qty !== it.qty) {
        toast(`수량 ${it.qty}개로 맞춰 주세요 (지금 ${state.qty}개)`);
        setGuideStep("qty");
        return;
      }
    }
    state.cart.push({
      uid: `${p.id}-${Date.now()}`,
      id: p.id,
      name: p.name,
      image: p.image,
      price: p.price,
      qty: state.qty,
    });
    $("#modal").classList.remove("is-open");
    updateCartBar();
    toast("담았습니다");

    if (state.mission && state.mission.itemIndex < state.mission.items.length - 1) {
      state.mission.itemIndex += 1;
      setGuideStep("category");
      return;
    }
    setGuideStep("pay");
  }

  function startQrPay() {
    destroyPay();
    showScreen("qr");
    $("#qr-pay-amount").textContent = formatPrice(cartTotal());
    payInstance = window.IeumQrPay?.mount({
      mount: $("#qr-pay-mount"),
      onSuccess: completeOrder,
      onError: (m) => toast(m),
    });
    setGuideStep("qr");
  }

  function startCouponPay() {
    destroyPay();
    showScreen("coupon");
    $("#coupon-pay-amount").textContent = formatPrice(cartTotal());
    payInstance = window.IeumCouponPay?.mount({
      mount: $("#coupon-pay-mount"),
      onSuccess: completeOrder,
      onError: (m) => toast(m),
    });
    setGuideStep("coupon");
  }

  function receiptDateTime() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}  ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function renderReceipt() {
    const itemsEl = $("#receipt-items");
    const totalEl = $("#receipt-total");
    const metaEl = $("#receipt-meta");
    if (metaEl) metaEl.textContent = receiptDateTime();
    if (itemsEl) {
      if (!state.cart.length) {
        itemsEl.innerHTML = `<div class="receipt__row"><span class="receipt__row-name">(메뉴 없음)</span></div>`;
      } else {
        itemsEl.innerHTML = state.cart
          .map((i) => {
            const line = formatPrice(i.price * i.qty);
            return `<div class="receipt__row">
              <div>
                <div class="receipt__row-name">${escapeHtml(i.name)}</div>
                <div class="receipt__row-qty">× ${i.qty}</div>
              </div>
              <div class="receipt__row-price">${line}</div>
            </div>`;
          })
          .join("");
      }
    }
    if (totalEl) totalEl.textContent = formatPrice(cartTotal());
  }

  function completeOrder() {
    destroyPay();
    const ok = missionOk();
    const itemCount = state.mission?.items?.length || state.cart?.length || 1;
    let xp = "";
    if (window.IeumLevel) {
      const r = IeumLevel.awardPractice
        ? IeumLevel.awardPractice(itemCount, ok)
        : IeumLevel.addWin(200 + itemCount * 80);
      xp = r.leveled
        ? `경험치 +${r.gained} · 레벨 ${r.level}!`
        : `경험치 +${r.gained} (레벨 ${r.level})`;
    }
    const resultEl = $("#mission-result");
    if (resultEl) {
      resultEl.className =
        "mission-result" + (ok ? " mission-result--ok" : "");
      resultEl.innerHTML = ok
        ? `✓ 미션 성공<br/>${escapeHtml(state.mission.label)}${xp ? `<br/><span style="color:#1f8a4c">${escapeHtml(xp)}</span>` : ""}`
        : `결제 완료${xp ? `<br/><span style="color:#1f8a4c">${escapeHtml(xp)}</span>` : ""}`;
    }
    const orderEl = $("#order-num");
    if (orderEl) orderEl.textContent = String(Math.floor(100 + Math.random() * 900));
    renderReceipt();
    setGuideStep("done");
    showScreen("success");
  }

  function missionOk() {
    if (!state.mission) return false;
    return state.mission.items.every((req) => {
      const hit = state.cart.find((c) => String(c.id) === String(req.productId));
      return hit && hit.qty === req.qty;
    });
  }

  function resetAll() {
    state.cart = [];
    state.dining = null;
    state.mission = state.menu ? createMission() : null;
    showMissionBoard();
    updateCartBar();
    showScreen("welcome");
    setGuideStep("dining");
  }

  function bind() {
    $$("[data-dining]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (state.mission && btn.dataset.dining !== state.mission.dining) {
          toast(`「${state.mission.diningLabel}」 이에요`);
          updateGuide();
          return;
        }
        state.dining = btn.dataset.dining;
        showScreen("order");
        setGuideStep("category");
      });
    });

    $("#btn-exit")?.addEventListener("click", () => {
      location.href = "/practice";
    });
    $("#btn-home")?.addEventListener("click", () => {
      if (confirm("처음으로 갈까요?")) resetAll();
    });

    $("#product-grid").addEventListener("click", (e) => {
      const card = e.target.closest("[data-id]");
      if (!card || !state.menu) return;
      const p = state.menu.products.find((x) => String(x.id) === card.dataset.id);
      if (!p) return;
      const it = currentItem();
      if (state.mission && state.guideStep === "product" && it) {
        if (String(p.id) !== String(it.productId)) {
          toast(`「${it.productName}」 을 누르세요`);
          updateGuide();
          return;
        }
      }
      openModal(p);
    });

    $("#modal-close")?.addEventListener("click", () => {
      $("#modal").classList.remove("is-open");
      if (state.mission && !state.cart.length) setGuideStep("product");
    });
    $("#modal-cancel")?.addEventListener("click", () => {
      $("#modal").classList.remove("is-open");
    });
    $("#modal-add")?.addEventListener("click", addToCart);

    $("#btn-pay")?.addEventListener("click", () => {
      if (!state.cart.length) return;
      $("#pay-amount").textContent = formatPrice(cartTotal());
      showScreen("pay");
      setGuideStep("pay-method");
    });
    $("#btn-qr")?.addEventListener("click", startQrPay);
    $("#btn-coupon")?.addEventListener("click", startCouponPay);
    $("#pay-back")?.addEventListener("click", () => {
      destroyPay();
      showScreen("order");
      setGuideStep("pay");
    });
    $("#qr-back")?.addEventListener("click", () => {
      destroyPay();
      showScreen("pay");
      setGuideStep("pay-method");
    });
    $("#coupon-back")?.addEventListener("click", () => {
      destroyPay();
      showScreen("pay");
      setGuideStep("pay-method");
    });
    $("#btn-finish")?.addEventListener("click", () => {
      location.href = "/practice?done=mega";
    });
    $("#btn-again")?.addEventListener("click", resetAll);
  }

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    updateCartBar();
    showScreen("welcome");
    loadMenu();
  });
})();
