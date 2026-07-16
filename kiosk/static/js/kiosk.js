/**
 * McDonald's-style kiosk practice + step guide (yellow highlight)
 */

(() => {
  const state = {
    dining: null,
    menu: null,
    categorySlug: null,
    cart: [],
    selectedProduct: null,
    optionType: "single",
    setSide: null,
    setDrink: null,
    qty: 1,
    orderNumber: null,
    mission: null,
    guideStep: "dining", // dining | category | product | type | side | drink | add | pay | pay-method | qr | coupon | done
  };

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const els = {
    screens: $$(".screen"),
    welcome: $("#screen-welcome"),
    order: $("#screen-order"),
    pay: $("#screen-pay"),
    qr: $("#screen-qr"),
    coupon: $("#screen-coupon"),
    success: $("#screen-success"),
    nav: $("#kiosk-nav"),
    grid: $("#product-grid"),
    catTitle: $("#category-title"),
    diningPill: $("#dining-pill"),
    cartCount: $("#cart-count"),
    cartTotal: $("#cart-total"),
    cartItems: $("#cart-items-preview"),
    btnCart: $("#btn-cart"),
    btnPay: $("#btn-pay"),
    modalProduct: $("#modal-product"),
    modalCart: $("#modal-cart"),
    toast: $("#toast"),
    payAmount: $("#pay-amount"),
    successNum: $("#success-num"),
    successDining: $("#success-dining"),
    qrPayMount: $("#qr-pay-mount"),
    couponPayMount: $("#coupon-pay-mount"),
    guideBar: $("#guide-bar"),
    guideMission: $("#guide-mission"),
    guideStepText: $("#guide-step-text"),
    missionBoard: $("#mission-board"),
  };

  let payInstance = null;

  function destroyPay() {
    if (payInstance?.destroy) payInstance.destroy();
    payInstance = null;
  }

  function formatPrice(n) {
    return `${Number(n).toLocaleString("ko-KR")}원`;
  }

  function showScreen(name) {
    els.screens.forEach((s) => {
      s.classList.toggle("is-active", s.dataset.screen === name);
    });
    // guide after paint
    requestAnimationFrame(() => updateGuide());
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("is-show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => els.toast.classList.remove("is-show"), 2200);
  }

  function cartTotal() {
    return state.cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  }

  function cartCount() {
    return state.cart.reduce((sum, i) => sum + i.qty, 0);
  }

  function updateCartBar() {
    const count = cartCount();
    const total = cartTotal();
    els.cartCount.textContent = count ? `선택 ${count}개` : "메뉴를 골라 주세요";
    els.cartTotal.textContent = formatPrice(total);
    els.cartItems.textContent = state.cart.map((i) => i.name).join(", ");
    els.btnPay.disabled = count === 0;
    els.btnCart.disabled = count === 0;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function baseMenuName(name) {
    return (
      String(name || "")
        .replace(/\s*세트\s*$/u, "")
        .trim() || String(name || "")
    );
  }

  function canChooseSet(product) {
    if (!product) return false;
    const slug = product.categorySlug;
    if (["sides", "mc-cafe", "happy-snack"].includes(slug)) return false;
    return (
      ["burger", "mc-morning", "mc-lunch"].includes(slug) || !!product.hasSet
    );
  }

  function isSetMode() {
    return state.optionType === "set";
  }

  function productDisplayName(product, optionType) {
    const name = baseMenuName(product.name);
    return optionType === "set" ? `${name} 세트` : name;
  }

  function unitPriceFor(product, optionType) {
    const base = product.price || 0;
    const extra = state.menu.setDefaults?.setExtra || 2800;
    const pricedAsSet = !!product.hasSet;
    if (optionType === "set") return pricedAsSet ? base : base + extra;
    return pricedAsSet ? Math.max(base - extra, 1000) : base;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function buildItemMission(product, forceSet) {
    const name = baseMenuName(product.name);
    let asSet =
      forceSet != null
        ? forceSet && canChooseSet(product)
        : canChooseSet(product) && Math.random() > 0.4;
    let side = null;
    let drink = null;
    if (asSet) {
      const sides = state.menu.sides || [];
      const drinks = state.menu.drinks || [];
      const fries = sides.filter((s) => /후라이|너겟|치즈스틱/.test(s.name));
      const sodas = drinks.filter((d) =>
        /콜라|스프라이트|환타|사이다/.test(d.name)
      );
      side = pickRandom(fries.length ? fries : sides) || null;
      drink = pickRandom(sodas.length ? sodas : drinks) || null;
    }
    return {
      productId: product.id,
      productName: name,
      categorySlug: product.categorySlug,
      optionType: asSet ? "set" : "single",
      sideId: side?.id ?? null,
      sideName: side?.name ?? null,
      drinkId: drink?.id ?? null,
      drinkName: drink?.name ?? null,
    };
  }

  function itemLabel(it) {
    if (!it) return "";
    if (it.optionType === "set") {
      if (it.sideName && it.drinkName) {
        return `${it.productName} 세트`;
      }
      return `${it.productName} 세트`;
    }
    return it.productName;
  }

  /** 랜덤 주문 미션 (레벨에 따라 단품 / 세트 / 세트+사이드) */
  function createMission() {
    if (!state.menu?.products?.length) return null;
    const diff = window.IeumLevel ? IeumLevel.difficulty() : 1;

    const burgers = state.menu.products.filter((p) => {
      const slug = p.categorySlug;
      if (!["burger", "mc-morning", "mc-lunch"].includes(slug)) return false;
      return baseMenuName(p.name) && p.image;
    });
    const sidesCat = state.menu.products.filter(
      (p) => p.categorySlug === "sides" && p.image && /너겟|후라이|치즈스틱/.test(p.name)
    );
    const pool = burgers.length ? burgers : state.menu.products.filter((p) => p.image);
    const main = pickRandom(pool);
    // 난이도: 1 단품 위주, 2 세트, 3 세트+추가메뉴
    let forceSet = null;
    if (diff === 1) forceSet = Math.random() > 0.7;
    if (diff === 2) forceSet = Math.random() > 0.35;
    if (diff >= 3) forceSet = true;

    const items = [buildItemMission(main, forceSet)];

    // 레벨↑ → 메뉴 개수↑
    let extraCount = 0;
    if (diff === 2) extraCount = Math.random() > 0.5 ? 1 : 0;
    if (diff >= 3) extraCount = Math.random() > 0.35 ? 2 : 1;

    for (let i = 0; i < extraCount; i++) {
      const pool2 = i === 0 && sidesCat.length ? sidesCat : pool;
      const extra = pickRandom(pool2);
      if (extra && String(extra.id) !== String(main.id)) {
        items.push(buildItemMission(extra, false));
      }
    }

    // 수량: 레벨 따라 1~3
    items.forEach((it) => {
      let qty = 1;
      if (diff >= 2 && Math.random() > 0.55) qty = 2;
      if (diff >= 3 && Math.random() > 0.65) qty = Math.random() > 0.5 ? 2 : 3;
      it.qty = qty;
    });

    const dining = Math.random() > 0.5 ? "here" : "takeout";
    const label = items
      .map((it) => {
        const base = itemLabel(it);
        return it.qty > 1 ? `${base}×${it.qty}` : base;
      })
      .join(" + ");

    return {
      items,
      itemIndex: 0,
      dining,
      diningLabel: dining === "here" ? "매장에서 식사" : "포장하기",
      label,
      ...items[0],
    };
  }

  function currentItem() {
    if (!state.mission?.items?.length) return state.mission;
    return state.mission.items[state.mission.itemIndex] || state.mission.items[0];
  }

  function syncMissionCursor() {
    const it = currentItem();
    if (!state.mission || !it) return;
    Object.assign(state.mission, {
      productId: it.productId,
      productName: it.productName,
      categorySlug: it.categorySlug,
      optionType: it.optionType,
      sideId: it.sideId,
      sideName: it.sideName,
      drinkId: it.drinkId,
      drinkName: it.drinkName,
    });
  }

  function missionLabel(m) {
    if (!m) return "";
    return m.label || itemLabel(m);
  }

  function showMissionOnWelcome() {
    if (!els.missionBoard || !state.mission) return;
    els.missionBoard.hidden = false;
    els.missionBoard.innerHTML = `
      <div class="mission-board__label">오늘의 미션</div>
      <div class="mission-board__title">${escapeHtml(state.mission.label)} 주문</div>
      <div class="mission-board__sub">${escapeHtml(state.mission.diningLabel)}</div>
    `;
  }

  function setGuideStep(step) {
    state.guideStep = step;
    syncMissionCursor();
    updateGuide();
  }

  function clearHighlights() {
    $$(".guide-highlight").forEach((el) => el.classList.remove("guide-highlight"));
  }

  function highlight(el) {
    if (!el) return;
    el.classList.add("guide-highlight");
    try {
      el.scrollIntoView({ block: "nearest", behavior: "smooth", inline: "nearest" });
    } catch (_) {
      /* ignore */
    }
  }

  function guideInstruction() {
    const m = state.mission;
    const it = currentItem();
    if (!m) return "메뉴를 골라 주세요";
    const multi =
      m.items && m.items.length > 1
        ? ` (${m.itemIndex + 1}/${m.items.length})`
        : "";
    switch (state.guideStep) {
      case "dining":
        return `「${m.diningLabel}」 누르기`;
      case "category":
        return `「${categoryName(it.categorySlug)}」 누르기${multi}`;
      case "product":
        return `「${it.productName}」 누르기${multi}`;
      case "type":
        return it.optionType === "set" ? "「세트」 누르기" : "「단품」 누르기";
      case "side":
        return `「${it.sideName || "사이드"}」 고르기`;
      case "drink":
        return `「${it.drinkName || "음료"}」 고르기`;
      case "qty":
        return `수량 ${it.qty || 1}개로 맞추기`;
      case "add":
        return "「장바구니 담기」";
      case "pay":
        return "「결제하기」";
      case "pay-method":
        return "「QR 결제」 또는 「쿠폰 결제」";
      case "qr":
        return "휴대폰으로 QR 찍기";
      case "coupon":
        return "쿠폰 번호 입력 (키보드 가능)";
      case "done":
        return "미션 완료!";
      default:
        return "노란 칸을 누르세요";
    }
  }

  function categoryName(slug) {
    const c = state.menu?.categories?.find((x) => x.slug === slug);
    return c?.name || slug;
  }

  function updateGuideBar() {
    if (!els.guideBar) return;
    const m = state.mission;
    if (!m || state.guideStep === "done") {
      // keep visible on success with done text
    }
    if (m) {
      els.guideBar.hidden = false;
      if (els.guideMission) {
        els.guideMission.textContent = `미션: ${missionLabel(m)} 주문하기`;
      }
      if (els.guideStepText) {
        els.guideStepText.textContent = guideInstruction();
      }
    } else {
      els.guideBar.hidden = true;
    }
  }

  function updateGuide() {
    syncMissionCursor();
    clearHighlights();
    updateGuideBar();
    const m = state.mission;
    if (!m) return;

    const step = state.guideStep;
    if (step === "dining") {
      highlight($(`[data-dining="${m.dining}"]`));
      return;
    }
    if (step === "category") {
      highlight($(`.kiosk-nav__item[data-slug="${m.categorySlug}"]`));
      return;
    }
    if (step === "product") {
      // ensure right category
      if (state.categorySlug !== m.categorySlug) {
        selectCategory(m.categorySlug);
      }
      highlight($(`.product-card[data-id="${m.productId}"]`));
      return;
    }
    if (step === "type") {
      highlight($(`.option-btn[data-type="${m.optionType}"]`));
      return;
    }
    if (step === "side" && m.sideId != null) {
      highlight($(`.option-item[data-side="${m.sideId}"]`));
      return;
    }
    if (step === "drink" && m.drinkId != null) {
      highlight($(`.option-item[data-drink="${m.drinkId}"]`));
      return;
    }
    if (step === "qty") {
      const need = currentItem()?.qty || 1;
      if (state.qty < need) highlight($("#qty-plus"));
      else highlight($("#modal-product-add"));
      return;
    }
    if (step === "add") {
      highlight($("#modal-product-add"));
      return;
    }
    if (step === "pay") {
      highlight(els.btnPay);
      return;
    }
    if (step === "pay-method") {
      highlight($("#pay-qr"));
      highlight($("#pay-coupon"));
      return;
    }
    if (step === "qr") {
      highlight($("#qr-pay-mount"));
      return;
    }
    if (step === "coupon") {
      highlight($("#coupon-pay-input") || $("#coupon-pay-mount"));
    }
  }

  async function loadMenu() {
    els.grid.innerHTML = `<div class="loading-box">메뉴를 불러오는 중…</div>`;
    try {
      const res = await fetch("/api/kiosk/menu");
      if (!res.ok) throw new Error("menu load failed");
      state.menu = await res.json();
      if (!state.mission) {
        state.mission = createMission();
        showMissionOnWelcome();
        setGuideStep("dining");
      }
      renderNav();
      const first = state.menu.categories[0];
      if (first) selectCategory(first.slug);
    } catch (e) {
      console.error(e);
      els.grid.innerHTML = `<div class="loading-box">메뉴를 불러오지 못했습니다.</div>`;
    }
  }

  function renderNav() {
    const icons = {
      burger: "🍔",
      sides: "🍟",
      "mc-cafe": "🥤",
      "mc-morning": "🌅",
      "mc-lunch": "🍽️",
      "happy-snack": "🎁",
    };
    els.nav.innerHTML = state.menu.categories
      .map(
        (c) => `
      <button type="button" class="kiosk-nav__item" data-slug="${c.slug}">
        <span class="kiosk-nav__dot">${icons[c.slug] || "•"}</span>
        ${c.name}
      </button>`
      )
      .join("");

    // re-bind once: use event delegation on nav parent only once
    if (!els.nav.dataset.bound) {
      els.nav.dataset.bound = "1";
      els.nav.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-slug]");
        if (!btn) return;
        const slug = btn.dataset.slug;
        if (state.mission && state.guideStep === "category") {
          if (slug !== state.mission.categorySlug) {
            toast(
              `미션 메뉴는 「${categoryName(state.mission.categorySlug)}」에 있어요`
            );
            updateGuide();
            return;
          }
          selectCategory(slug);
          setGuideStep("product");
          return;
        }
        selectCategory(slug);
        if (state.mission && state.guideStep === "product") {
          updateGuide();
        }
      });
    }
  }

  function selectCategory(slug) {
    state.categorySlug = slug;
    $$(".kiosk-nav__item").forEach((el) => {
      el.classList.toggle("is-active", el.dataset.slug === slug);
    });
    const cat = state.menu.categories.find((c) => c.slug === slug);
    els.catTitle.textContent = cat ? cat.name : "메뉴";
    renderProducts();
    requestAnimationFrame(() => updateGuide());
  }

  function renderProducts() {
    const list = state.menu.products.filter(
      (p) => p.categorySlug === state.categorySlug
    );
    if (!list.length) {
      els.grid.innerHTML = `<div class="loading-box">이 카테고리에 표시할 메뉴가 없습니다.</div>`;
      return;
    }
    els.grid.innerHTML = list
      .map((p) => {
        const label = baseMenuName(p.name);
        return `
      <button type="button" class="product-card" data-id="${p.id}" title="${escapeHtml(label)}">
        <div class="product-card__img">
          ${
            p.image
              ? `<img src="${p.image}" alt="${escapeHtml(label)}" loading="lazy"
            onerror="this.style.opacity=0.3" />`
              : `<div class="product-card__ph">이미지 없음</div>`
          }
        </div>
        <div class="product-card__body">
          <div class="product-card__name">${escapeHtml(label)}</div>
          ${p.calorie ? `<div class="product-card__kcal">${escapeHtml(String(p.calorie))}kcal</div>` : ""}
          <div class="product-card__price">${formatPrice(p.price)}</div>
        </div>
      </button>`;
      })
      .join("");
    requestAnimationFrame(() => updateGuide());
  }

  function openProductModal(product) {
    state.selectedProduct = product;
    state.optionType = "single";
    state.setSide = null;
    state.setDrink = null;
    state.qty = 1;
    renderProductModal();
    els.modalProduct.classList.add("is-open");

    if (state.mission && String(product.id) === String(state.mission.productId)) {
      const it = currentItem();
      if (canChooseSet(product) && it?.optionType) {
        setGuideStep("type");
      } else if ((it?.qty || 1) > 1) {
        setGuideStep("qty");
      } else {
        setGuideStep("add");
      }
    } else {
      requestAnimationFrame(() => updateGuide());
    }
  }

  function calcModalPrice() {
    const p = state.selectedProduct;
    if (!p) return 0;
    return unitPriceFor(p, state.optionType) * state.qty;
  }

  function renderProductModal() {
    const p = state.selectedProduct;
    const body = $("#modal-product-body");
    const showType = canChooseSet(p);
    const setMode = showType && isSetMode();
    const shownName = productDisplayName(
      p,
      showType ? state.optionType : "single"
    );

    body.innerHTML = `
      <div class="modal__product">
        <img src="${p.image || ""}" alt="" />
        <div>
          <div class="modal__product-name">${escapeHtml(shownName)}</div>
          ${p.calorie ? `<div class="modal__product-meta">${escapeHtml(String(p.calorie))}kcal</div>` : ""}
          <div class="modal__product-price">${formatPrice(calcModalPrice())}</div>
        </div>
      </div>

      ${
        showType
          ? `<div class="option-group">
              <div class="option-group__label">① 구성을 고르세요</div>
              <div class="option-row">
                <button type="button" class="option-btn ${state.optionType === "single" ? "is-selected" : ""}" data-type="single">단품</button>
                <button type="button" class="option-btn ${state.optionType === "set" ? "is-selected" : ""}" data-type="set">세트</button>
              </div>
            </div>`
          : ""
      }

      ${
        setMode && state.menu.sides?.length
          ? `<div class="option-group">
              <div class="option-group__label">② 사이드를 고르세요</div>
              <div class="option-scroll" id="side-options">
                ${state.menu.sides
                  .map(
                    (s) => `
                  <button type="button" class="option-item ${state.setSide?.id === s.id ? "is-selected" : ""}" data-side="${s.id}">
                    <img src="${s.image}" alt="" onerror="this.style.opacity=0.3" />
                    <span>${escapeHtml(s.name)}</span>
                  </button>`
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }

      ${
        setMode && state.menu.drinks?.length
          ? `<div class="option-group">
              <div class="option-group__label">③ 음료를 고르세요</div>
              <div class="option-scroll" id="drink-options">
                ${state.menu.drinks
                  .map(
                    (d) => `
                  <button type="button" class="option-item ${state.setDrink?.id === d.id ? "is-selected" : ""}" data-drink="${d.id}">
                    <img src="${d.image}" alt="" onerror="this.style.opacity=0.3" />
                    <span>${escapeHtml(d.name)}</span>
                  </button>`
                  )
                  .join("")}
              </div>
            </div>`
          : ""
      }

      <div class="qty-row">
        <div class="option-group__label" style="margin:0">수량</div>
        <div class="qty-controls">
          <button type="button" class="qty-btn" id="qty-minus">−</button>
          <span class="qty-val">${state.qty}</span>
          <button type="button" class="qty-btn" id="qty-plus">+</button>
        </div>
      </div>
    `;

    body.querySelectorAll("[data-type]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const t = btn.dataset.type;
        if (state.mission && state.guideStep === "type") {
          if (t !== state.mission.optionType) {
            toast(
              state.mission.optionType === "set"
                ? "미션은 세트예요. 「세트」를 누르세요"
                : "미션은 단품이에요. 「단품」을 누르세요"
            );
            updateGuide();
            return;
          }
        }
        state.optionType = t;
        if (state.optionType === "single") {
          state.setSide = null;
          state.setDrink = null;
        }
        renderProductModal();
        if (state.mission && String(state.selectedProduct?.id) === String(state.mission.productId)) {
          const it = currentItem();
          if (state.optionType === "set" && it?.optionType === "set") {
            setGuideStep(it.sideId != null ? "side" : (it.qty > 1 ? "qty" : "add"));
          } else if (state.optionType === "single") {
            setGuideStep((it?.qty || 1) > 1 ? "qty" : "add");
          }
        }
      });
    });

    body.querySelectorAll("[data-side]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.side;
        const it = currentItem();
        if (state.mission && state.guideStep === "side" && it?.sideId != null) {
          if (String(id) !== String(it.sideId)) {
            toast(`사이드는 「${it.sideName}」`);
            updateGuide();
            return;
          }
        }
        state.setSide = state.menu.sides.find((s) => String(s.id) === String(id));
        renderProductModal();
        if (state.mission && state.guideStep === "side") {
          const cur = currentItem();
          if (cur?.drinkId != null) setGuideStep("drink");
          else setGuideStep((cur?.qty || 1) > 1 ? "qty" : "add");
        }
      });
    });

    body.querySelectorAll("[data-drink]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.drink;
        const it = currentItem();
        if (state.mission && state.guideStep === "drink" && it?.drinkId != null) {
          if (String(id) !== String(it.drinkId)) {
            toast(`음료는 「${it.drinkName}」`);
            updateGuide();
            return;
          }
        }
        state.setDrink = state.menu.drinks.find((d) => String(d.id) === String(id));
        renderProductModal();
        if (state.mission && state.guideStep === "drink") {
          const cur = currentItem();
          setGuideStep((cur?.qty || 1) > 1 ? "qty" : "add");
        }
      });
    });

    $("#qty-minus")?.addEventListener("click", () => {
      state.qty = Math.max(1, state.qty - 1);
      renderProductModal();
    });
    $("#qty-plus")?.addEventListener("click", () => {
      state.qty = Math.min(9, state.qty + 1);
      renderProductModal();
      const need = currentItem()?.qty || 1;
      if (state.mission && state.qty >= need && state.guideStep === "qty") {
        setGuideStep("add");
      }
    });

    requestAnimationFrame(() => updateGuide());
  }

  function addToCart() {
    const p = state.selectedProduct;
    if (!p) return;

    if (state.mission) {
      const it = currentItem();
      if (String(p.id) !== String(it.productId)) {
        toast(`「${it.productName}」 입니다`);
        return;
      }
      if (state.optionType !== it.optionType && canChooseSet(p)) {
        toast(it.optionType === "set" ? "세트예요" : "단품이에요");
        setGuideStep("type");
        return;
      }
      if (state.optionType === "set") {
        if (it.sideId != null && String(state.setSide?.id) !== String(it.sideId)) {
          toast(`사이드 「${it.sideName}」`);
          setGuideStep("side");
          return;
        }
        if (it.drinkId != null && String(state.setDrink?.id) !== String(it.drinkId)) {
          toast(`음료 「${it.drinkName}」`);
          setGuideStep("drink");
          return;
        }
      }
      if ((it.qty || 1) !== state.qty) {
        toast(`수량 ${it.qty}개로 맞추세요 (지금 ${state.qty})`);
        setGuideStep("qty");
        return;
      }
    }

    const canSet = canChooseSet(p);
    const isSet = canSet && state.optionType === "set";

    if (isSet) {
      if (!state.setSide) {
        toast("세트 사이드를 골라 주세요");
        return;
      }
      if (!state.setDrink) {
        toast("세트 음료를 골라 주세요");
        return;
      }
    }

    const unitPrice = unitPriceFor(p, isSet ? "set" : "single");
    const opts = [];
    if (isSet) {
      opts.push("세트");
      opts.push(state.setSide.name);
      opts.push(state.setDrink.name);
    } else {
      opts.push("단품");
    }

    state.cart.push({
      uid: `${p.id}-${Date.now()}`,
      id: p.id,
      name: productDisplayName(p, isSet ? "set" : "single"),
      image: p.image,
      price: unitPrice,
      qty: state.qty,
      options: opts.join(" · "),
    });

    els.modalProduct.classList.remove("is-open");
    updateCartBar();
    toast("담았습니다");

    // 다음 미션 메뉴가 있으면 이어서 안내
    if (state.mission?.items && state.mission.itemIndex < state.mission.items.length - 1) {
      state.mission.itemIndex += 1;
      syncMissionCursor();
      setGuideStep("category");
      return;
    }
    setGuideStep("pay");
  }

  function openCartModal() {
    const body = $("#modal-cart-body");
    if (!state.cart.length) {
      body.innerHTML = `<div class="cart-empty">담긴 메뉴가 없습니다.</div>`;
    } else {
      body.innerHTML = `<div class="cart-list">${state.cart
        .map(
          (i) => `
        <div class="cart-item" data-uid="${i.uid}">
          <img src="${i.image}" alt="" />
          <div class="cart-item__info">
            <div class="cart-item__name">${escapeHtml(i.name)} × ${i.qty}</div>
            <div class="cart-item__opt">${escapeHtml(i.options || "")}</div>
          </div>
          <div class="cart-item__price">${formatPrice(i.price * i.qty)}</div>
          <button type="button" class="cart-item__remove" data-remove="${i.uid}" aria-label="삭제">×</button>
        </div>`
        )
        .join("")}</div>
        <p style="margin-top:16px;text-align:right;font-weight:800;font-size:1.15rem">
          합계 ${formatPrice(cartTotal())}
        </p>`;
      body.querySelectorAll("[data-remove]").forEach((btn) => {
        btn.addEventListener("click", () => {
          state.cart = state.cart.filter((i) => i.uid !== btn.dataset.remove);
          updateCartBar();
          openCartModal();
        });
      });
    }
    els.modalCart.classList.add("is-open");
  }

  function goPay() {
    if (!state.cart.length) return;
    els.modalCart.classList.remove("is-open");
    els.payAmount.textContent = formatPrice(cartTotal());
    showScreen("pay");
    setGuideStep("pay-method");
  }

  function startQrPay() {
    destroyPay();
    showScreen("qr");
    const amt = $("#qr-pay-amount");
    if (amt) amt.textContent = formatPrice(cartTotal());
    if (window.IeumQrPay && els.qrPayMount) {
      payInstance = IeumQrPay.mount({
        mount: els.qrPayMount,
        onSuccess: () => completeOrder(),
        onError: (msg) => toast(msg),
      });
    }
    setGuideStep("qr");
  }

  function startCouponPay() {
    destroyPay();
    showScreen("coupon");
    const amt = $("#coupon-pay-amount");
    if (amt) amt.textContent = formatPrice(cartTotal());
    if (window.IeumCouponPay && els.couponPayMount) {
      payInstance = IeumCouponPay.mount({
        mount: els.couponPayMount,
        onSuccess: () => completeOrder(),
        onError: (msg) => toast(msg),
      });
    }
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
    if (metaEl) {
      metaEl.textContent = receiptDateTime();
    }
    if (itemsEl) {
      if (!state.cart.length) {
        itemsEl.innerHTML = `<div class="receipt__row"><span class="receipt__row-name">(메뉴 없음)</span></div>`;
      } else {
        itemsEl.innerHTML = state.cart
          .map((i) => {
            const line = formatPrice(i.price * i.qty);
            const opt = i.options
              ? `<div class="receipt__row-opt">${escapeHtml(i.options)}</div>`
              : "";
            return `<div class="receipt__row">
              <div>
                <div class="receipt__row-name">${escapeHtml(i.name)}</div>
                ${opt}
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
    state.orderNumber = String(Math.floor(100 + Math.random() * 900));
    if (els.successNum) els.successNum.textContent = state.orderNumber;
    if (els.successDining) {
      els.successDining.textContent =
        state.dining === "here" ? "매장 식사" : "포장";
    }
    renderReceipt();

    const ok = missionSucceeded();
    const resultEl = $("#mission-result");
    const itemCount =
      state.mission?.items?.length || state.cart?.length || 1;
    let xpLine = "";
    if (window.IeumLevel) {
      const r = IeumLevel.awardPractice
        ? IeumLevel.awardPractice(itemCount, ok)
        : IeumLevel.addWin(200 + itemCount * 80);
      xpLine = r.leveled
        ? `경험치 +${r.gained} · 레벨 ${r.level}!`
        : `경험치 +${r.gained} (레벨 ${r.level})`;
    }
    if (resultEl) {
      if (ok) {
        resultEl.innerHTML = `✓ 미션 성공<br/>${escapeHtml(state.mission.label)}${
          xpLine ? `<br/><span style="color:#1f8a4c">${escapeHtml(xpLine)}</span>` : ""
        }`;
        resultEl.className = "mission-result mission-result--ok";
      } else {
        resultEl.innerHTML = `결제 완료${
          xpLine ? `<br/><span style="color:#1f8a4c">${escapeHtml(xpLine)}</span>` : ""
        }`;
        resultEl.className = "mission-result";
      }
    }
    setGuideStep("done");
    showScreen("success");
  }

  function missionSucceeded() {
    if (!state.mission || !state.cart.length) return false;
    const need = state.mission.items || [state.mission];
    return need.every((req) => {
      const hit = state.cart.find((i) => String(i.id) === String(req.productId));
      if (!hit) return false;
      if ((req.qty || 1) !== hit.qty) return false;
      if (req.optionType === "set") return hit.options.includes("세트");
      return true;
    });
  }

  function finishPractice() {
    window.location.href = "/practice?done=kiosk";
  }

  function resetOrder() {
    state.cart = [];
    state.dining = null;
    state.selectedProduct = null;
    state.mission = state.menu ? createMission() : null;
    state.guideStep = "dining";
    showMissionOnWelcome();
    updateCartBar();
    showScreen("welcome");
    setGuideStep("dining");
  }

  function bindEvents() {
    $$("[data-dining]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const dining = btn.dataset.dining;
        if (state.mission && dining !== state.mission.dining) {
          toast(`미션은 「${state.mission.diningLabel}」 이에요`);
          updateGuide();
          return;
        }
        state.dining = dining;
        els.diningPill.textContent =
          state.dining === "here" ? "매장 식사" : "포장";
        showScreen("order");
        const go = () => {
          if (state.mission) {
            // 카테고리부터 노란 가이드 (사용자가 직접 누르게)
            setGuideStep("category");
          }
        };
        if (!state.menu) {
          loadMenu().then(go);
        } else {
          go();
        }
      });
    });

    $("#btn-exit-welcome")?.addEventListener("click", () => {
      window.location.href = "/practice";
    });
    $("#btn-home")?.addEventListener("click", () => {
      if (confirm("주문을 취소하고 처음 화면으로 갈까요?")) {
        resetOrder();
      }
    });

    els.grid.addEventListener("click", (e) => {
      const card = e.target.closest("[data-id]");
      if (!card || !state.menu) return;
      const product = state.menu.products.find(
        (p) => String(p.id) === card.dataset.id
      );
      if (!product) return;

      if (state.mission && state.guideStep === "product") {
        if (String(product.id) !== String(state.mission.productId)) {
          toast(`「${state.mission.productName}」 을(를) 눌러 주세요`);
          updateGuide();
          return;
        }
      } else if (
        state.mission &&
        String(product.id) !== String(state.mission.productId) &&
        ["product", "type", "side", "drink", "add"].includes(state.guideStep)
      ) {
        toast(`미션 메뉴는 「${state.mission.productName}」 입니다`);
        updateGuide();
        return;
      }

      openProductModal(product);
    });

    $("#modal-product-close")?.addEventListener("click", () => {
      els.modalProduct.classList.remove("is-open");
      if (state.mission && !state.cart.length) setGuideStep("product");
    });
    $("#modal-product-cancel")?.addEventListener("click", () => {
      els.modalProduct.classList.remove("is-open");
      if (state.mission && !state.cart.length) setGuideStep("product");
    });
    $("#modal-product-add")?.addEventListener("click", addToCart);
    els.modalProduct.addEventListener("click", (e) => {
      if (e.target === els.modalProduct) {
        els.modalProduct.classList.remove("is-open");
        if (state.mission && !state.cart.length) setGuideStep("product");
      }
    });

    els.btnCart.addEventListener("click", openCartModal);
    $("#modal-cart-close")?.addEventListener("click", () => {
      els.modalCart.classList.remove("is-open");
    });
    $("#modal-cart-more")?.addEventListener("click", () => {
      els.modalCart.classList.remove("is-open");
    });
    $("#modal-cart-pay")?.addEventListener("click", goPay);
    els.modalCart.addEventListener("click", (e) => {
      if (e.target === els.modalCart) els.modalCart.classList.remove("is-open");
    });

    els.btnPay.addEventListener("click", goPay);
    $("#pay-qr")?.addEventListener("click", startQrPay);
    $("#pay-coupon")?.addEventListener("click", startCouponPay);
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

    $("#btn-finish")?.addEventListener("click", finishPractice);
    $("#btn-again")?.addEventListener("click", resetOrder);
  }

  document.addEventListener("DOMContentLoaded", () => {
    bindEvents();
    updateCartBar();
    showScreen("welcome");
    // 메뉴 미리 로드 → 랜덤 미션 표시
    loadMenu();
  });
})();
