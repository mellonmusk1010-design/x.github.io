/**
 * 쿠팡 생필품 구매 실습 — 랜덤 미션 · 노란 가이드 · QR/쿠폰 결제
 */
(() => {
  const state = {
    ship: null,
    catalog: null,
    categorySlug: null,
    cart: [],
    selectedProduct: null,
    qty: 1,
    mission: null,
    guideStep: "ship",
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
    if (!el) return;
    el.textContent = msg;
    el.classList.add("is-show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove("is-show"), 2200);
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
    $$(".screen").forEach((s) =>
      s.classList.toggle("is-active", s.dataset.screen === name)
    );
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
    if (!state.catalog?.products?.length) return null;
    const diff = window.IeumLevel ? IeumLevel.difficulty() : 1;
    const pool = state.catalog.products;

    let count = 1;
    if (diff === 2) count = Math.random() > 0.4 ? 2 : 1;
    if (diff >= 3) count = Math.random() > 0.35 ? 3 : 2;

    const items = [];
    const used = new Set();
    for (let i = 0; i < count; i++) {
      let p = pickRandom(pool);
      let tries = 0;
      while (used.has(p.id) && tries < 12) {
        p = pickRandom(pool);
        tries++;
      }
      used.add(p.id);
      let qty = 1;
      if (diff >= 2 && Math.random() > 0.55) qty = 2;
      if (diff >= 3 && Math.random() > 0.75) qty = 3;
      items.push({
        productId: p.id,
        productName: p.name,
        categorySlug: p.categorySlug,
        qty,
      });
    }

    const ship = Math.random() > 0.45 ? "rocket" : "normal";
    return {
      items,
      itemIndex: 0,
      ship,
      shipLabel: ship === "rocket" ? "로켓배송" : "일반배송",
      label: items
        .map((it) => (it.qty > 1 ? `${it.productName}×${it.qty}` : it.productName))
        .join(" + "),
    };
  }

  function showMissionBoard() {
    const el = $("#mission-board");
    if (!el || !state.mission) return;
    el.hidden = false;
    el.innerHTML = `
      <div class="mission-board__label">오늘의 미션</div>
      <div class="mission-board__title">${escapeHtml(state.mission.label)} 구매</div>
      <div class="mission-board__sub">${escapeHtml(state.mission.shipLabel)} 선택</div>
    `;
  }

  function setGuideStep(step) {
    state.guideStep = step;
    updateGuide();
  }

  function categoryName(slug) {
    return (
      state.catalog?.categories?.find((c) => c.slug === slug)?.name || slug
    );
  }

  function guideText() {
    const m = state.mission;
    const it = currentItem();
    if (!m) return "따라 하세요";
    const multi =
      m.items.length > 1 ? ` (${m.itemIndex + 1}/${m.items.length})` : "";
    switch (state.guideStep) {
      case "ship":
        return `「${m.shipLabel}」 누르기`;
      case "category":
        return `「${categoryName(it?.categorySlug)}」 탭${multi}`;
      case "product":
        return `「${it?.productName}」 누르기`;
      case "qty":
        return `수량을 ${it?.qty || 1}개로`;
      case "add":
        return "「담기」 누르기";
      case "pay":
        return "「결제하기」 누르기";
      case "pay-method":
        return "「QR」 또는 「카드 결제」";
      case "qr":
        return "QR을 눌러 결제 완료";
      case "card":
        return "카드 번호 입력";
      case "done":
        return "완료!";
      default:
        return "노란 칸 누르기";
    }
  }

  function updateGuideBar() {
    const bar = $("#guide-bar");
    if (!bar) return;
    if (!state.mission || state.guideStep === "done") {
      if (state.guideStep === "done" && state.mission) {
        bar.hidden = false;
        $("#guide-mission").textContent = `미션: ${state.mission.label}`;
        $("#guide-step").textContent = "완료!";
        return;
      }
      if (!state.mission) {
        bar.hidden = true;
        return;
      }
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
    if (step === "ship") hl($(`.welcome__btn[data-ship="${m.ship}"]`));
    else if (step === "category" && it) {
      hl($(`.cp-tab[data-slug="${it.categorySlug}"]`));
    } else if (step === "product" && it) {
      if (state.categorySlug !== it.categorySlug) selectCategory(it.categorySlug);
      requestAnimationFrame(() => {
        hl($(`.product-card[data-id="${it.productId}"]`));
      });
    } else if (step === "qty") {
      if (state.qty < (it?.qty || 1)) hl($("#qty-plus"));
      else hl($("#modal-add"));
    } else if (step === "add") hl($("#modal-add"));
    else if (step === "pay") hl($("#btn-pay"));
    else if (step === "pay-method") {
      hl($("#btn-qr"));
      hl($("#btn-card"));
    } else if (step === "qr") hl($("#qr-pay-mount"));
    else if (step === "card") hl($("#card-pay-input") || $("#card-pay-mount"));
  }

  async function loadCatalog() {
    $("#product-grid").innerHTML =
      `<div class="loading-box">상품 불러오는 중…</div>`;
    try {
      const res = await fetch("assets/data/coupang_products.json");
      state.catalog = await res.json();
      if (!state.catalog.products?.length) throw new Error("empty");
      state.mission = createMission();
      showMissionBoard();
      renderTabs();
      selectCategory(state.catalog.categories[0]?.slug || "tissue");
      setGuideStep("ship");
    } catch (e) {
      $("#product-grid").innerHTML =
        `<div class="loading-box">상품을 불러오지 못했어요</div>`;
      toast("상품 로드 실패");
    }
  }

  function renderTabs() {
    const tabs = $("#cp-tabs");
    if (!tabs) return;
    tabs.innerHTML = (state.catalog.categories || [])
      .map(
        (c) =>
          `<button type="button" class="cp-tab" data-slug="${c.slug}">${escapeHtml(
            c.name
          )}</button>`
      )
      .join("");
    tabs.querySelectorAll(".cp-tab").forEach((btn) => {
      btn.addEventListener("click", () => {
        const slug = btn.dataset.slug;
        const it = currentItem();
        if (state.mission && state.guideStep === "category" && it) {
          if (slug !== it.categorySlug) {
            toast(`미션은 「${categoryName(it.categorySlug)}」 이에요`);
            updateGuide();
            return;
          }
          selectCategory(slug);
          setGuideStep("product");
          return;
        }
        selectCategory(slug);
      });
    });
  }

  function selectCategory(slug) {
    state.categorySlug = slug;
    $$(".cp-tab").forEach((t) =>
      t.classList.toggle("is-on", t.dataset.slug === slug)
    );
    const cat = state.catalog.categories.find((c) => c.slug === slug);
    $("#cat-title").textContent = cat?.name || "상품";
    const list = state.catalog.products.filter((p) => p.categorySlug === slug);
    const grid = $("#product-grid");
    if (!list.length) {
      grid.innerHTML = `<div class="loading-box">상품이 없어요</div>`;
      return;
    }
    const countEl = $("#cat-count");
    if (countEl) countEl.textContent = `${list.length}개`;

    grid.innerHTML = list
      .map((p) => {
        const isRocket = String(p.badge || "").includes("로켓");
        const badgeClass = isRocket
          ? "product-card__badge is-rocket"
          : "product-card__badge";
        const badgeText = isRocket ? "로켓배송" : escapeHtml(p.badge || "");
        const priceNum = Number(p.price).toLocaleString("ko-KR");
        return `
      <button type="button" class="product-card" data-id="${p.id}">
        <div class="product-card__img">
          ${
            p.image
              ? `<img src="${p.image}" alt="" loading="lazy" onerror="this.parentElement.innerHTML='<div class=product-card__ph>이미지</div>'" />`
              : `<div class="product-card__ph">이미지</div>`
          }
        </div>
        <div class="product-card__body">
          ${p.badge ? `<span class="${badgeClass}">${badgeText}</span>` : ""}
          <div class="product-card__name">${escapeHtml(p.name)}</div>
          <div class="product-card__price">${priceNum}<span class="unit">원</span></div>
        </div>
      </button>`;
      })
      .join("");
    requestAnimationFrame(updateGuide);
  }

  function cartTotal() {
    return state.cart.reduce((s, i) => s + i.price * i.qty, 0);
  }

  function updateCartBar() {
    const n = state.cart.reduce((s, i) => s + i.qty, 0);
    $("#cart-count").textContent = n
      ? `장바구니 ${n}개`
      : "장바구니 비어 있음";
    $("#cart-total").textContent = formatPrice(cartTotal());
    $("#btn-pay").disabled = n === 0;
    const headerN = $("#header-cart-n");
    if (headerN) headerN.textContent = String(n);
  }

  function openModal(product) {
    state.selectedProduct = product;
    state.qty = 1;
    const it = currentItem();
    $("#modal-body").innerHTML = `
      <div class="modal__product-name">${escapeHtml(product.name)}</div>
      <div class="modal__product-price">${formatPrice(product.price)}</div>
      <div class="qty-row">
        <span>수량</span>
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
    if (state.mission && it && String(product.id) === String(it.productId)) {
      setGuideStep(it.qty > 1 ? "qty" : "add");
    }
  }

  function addToCart() {
    const p = state.selectedProduct;
    if (!p) return;
    const it = currentItem();
    if (state.mission && it && String(p.id) === String(it.productId)) {
      if (state.qty !== it.qty) {
        toast(`수량을 ${it.qty}개로 맞춰 주세요`);
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

  function startCardPay() {
    destroyPay();
    showScreen("card");
    $("#card-pay-amount").textContent = formatPrice(cartTotal());
    payInstance = window.IeumCardPay?.mount({
      mount: $("#card-pay-mount"),
      onSuccess: completeOrder,
      onError: (m) => toast(m),
    });
    setGuideStep("card");
  }

  function receiptDateTime() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}  ${p(
      d.getHours()
    )}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
  }

  function renderReceipt() {
    const itemsEl = $("#receipt-items");
    const totalEl = $("#receipt-total");
    const metaEl = $("#receipt-meta");
    if (metaEl) metaEl.textContent = receiptDateTime();
    if (itemsEl) {
      itemsEl.innerHTML = state.cart.length
        ? state.cart
            .map(
              (i) => `<div class="receipt__row">
              <div>
                <div class="receipt__row-name">${escapeHtml(i.name)}</div>
                <div class="receipt__row-qty">× ${i.qty}</div>
              </div>
              <div class="receipt__row-price">${formatPrice(i.price * i.qty)}</div>
            </div>`
            )
            .join("")
        : `<div class="receipt__row"><span class="receipt__row-name">(상품 없음)</span></div>`;
    }
    if (totalEl) totalEl.textContent = formatPrice(cartTotal());
  }

  function cartQty(productId) {
    return state.cart
      .filter((c) => String(c.id) === String(productId))
      .reduce((s, c) => s + (c.qty || 0), 0);
  }

  function missionOk() {
    if (!state.mission?.items?.length) return false;
    const itemsOk = state.mission.items.every(
      (req) => cartQty(req.productId) === req.qty
    );
    const shipOk = !state.mission.ship || state.ship === state.mission.ship;
    return itemsOk && shipOk;
  }

  function completeOrder() {
    destroyPay();
    const ok = missionOk();
    const itemCount =
      state.mission?.items?.length ||
      state.cart.length ||
      1;
    let xp = "";
    let awardResult = null;
    // 쿠팡: 결제 완료만 해도 경험치 (미션 성공 시 더 많이) + 레벨업 폭죽
    try {
      if (window.IeumLevel) {
        awardResult = IeumLevel.awardPractice
          ? IeumLevel.awardPractice(itemCount, ok)
          : IeumLevel.addWin(200 + itemCount * 80);
        if (awardResult) {
          xp = awardResult.leveled
            ? `경험치 +${awardResult.gained} · 레벨 ${awardResult.level}!`
            : `경험치 +${awardResult.gained} (레벨 ${awardResult.level})`;
        }
      }
    } catch (err) {
      console.warn("IeumLevel award failed", err);
    }
    const resultEl = $("#mission-result");
    if (resultEl) {
      resultEl.className =
        "mission-result" + (ok ? " mission-result--ok" : "");
      resultEl.innerHTML = ok
        ? `✓ 미션 성공<br/>${escapeHtml(state.mission?.label || "")}${
            xp ? `<br/><span style="color:#059669">${escapeHtml(xp)}</span>` : ""
          }`
        : `결제 완료${
            xp ? `<br/><span style="color:#059669">${escapeHtml(xp)}</span>` : ""
          }<br/><span style="font-size:0.95em;opacity:.85">미션과 달라도 연습 완료예요</span>`;
    }
    const orderEl = $("#order-num");
    if (orderEl) orderEl.textContent = String(Math.floor(100 + Math.random() * 900));
    const shipEl = $("#success-ship");
    if (shipEl) {
      shipEl.textContent =
        state.ship === "rocket" ? "로켓배송" : "일반배송";
    }
    renderReceipt();
    setGuideStep("done");
    showScreen("success");

    // 레벨업 연출 — addWin 타이머와 별도로 한 번 더 보장 (쿠팡 전용)
    if (awardResult?.leveled && window.IeumLevel?.celebrateLevelUp) {
      setTimeout(() => {
        try {
          IeumLevel.celebrateLevelUp(awardResult);
        } catch (e) {
          console.warn(e);
        }
      }, 500);
    }
  }

  function resetAll() {
    destroyPay();
    state.cart = [];
    state.ship = null;
    state.mission = state.catalog ? createMission() : null;
    showMissionBoard();
    updateCartBar();
    showScreen("welcome");
    setGuideStep("ship");
  }

  function bind() {
    $$("[data-ship]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (state.mission && btn.dataset.ship !== state.mission.ship) {
          toast(`미션은 「${state.mission.shipLabel}」 이에요`);
          updateGuide();
          return;
        }
        state.ship = btn.dataset.ship;
        showScreen("shop");
        setGuideStep("category");
      });
    });

    $("#btn-exit")?.addEventListener("click", () => {
      location.href = "practice.html";
    });
    $("#btn-home")?.addEventListener("click", () => {
      if (confirm("처음으로 갈까요?")) resetAll();
    });

    $("#product-grid")?.addEventListener("click", (e) => {
      const card = e.target.closest("[data-id]");
      if (!card || !state.catalog) return;
      const p = state.catalog.products.find(
        (x) => String(x.id) === card.dataset.id
      );
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
    $("#btn-card")?.addEventListener("click", startCardPay);
    $("#pay-back")?.addEventListener("click", () => {
      destroyPay();
      showScreen("shop");
      setGuideStep("pay");
    });
    $("#qr-back")?.addEventListener("click", () => {
      destroyPay();
      showScreen("pay");
      setGuideStep("pay-method");
    });
    $("#card-back")?.addEventListener("click", () => {
      destroyPay();
      showScreen("pay");
      setGuideStep("pay-method");
    });
    $("#btn-finish")?.addEventListener("click", () => {
      location.href = "practice.html?done=coupang";
    });
    $("#btn-again")?.addEventListener("click", resetAll);
  }

  document.addEventListener("DOMContentLoaded", () => {
    bind();
    updateCartBar();
    showScreen("welcome");
    loadCatalog();
  });
})();
