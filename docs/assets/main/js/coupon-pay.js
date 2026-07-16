/**
 * 이음 쿠폰 결제 — 8자리 번호 입력
 */
(function (global) {
  const CODE_LEN = 8;

  function randDigits(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
    return s;
  }

  function formatCode(digits) {
    return String(digits)
      .replace(/\D/g, "")
      .slice(0, CODE_LEN)
      .replace(/(\d{4})(?=\d)/g, "$1 ");
  }

  function onlyDigits(s) {
    return String(s || "").replace(/\D/g, "");
  }

  function mount(opts) {
    const root = opts.mount;
    if (!root) return null;

    const secret = randDigits(CODE_LEN);
    let typed = "";
    let destroyed = false;

    root.innerHTML = `
      <div class="card-pay coupon-pay" id="ieum-coupon-pay">
        <div class="card-pay__face coupon-pay__face" aria-hidden="true">
          <div class="card-pay__stripe-label">연습용 쿠폰 · 8자리</div>
          <div class="card-pay__number-panel" id="coupon-pay-secret">${formatCode(secret)}</div>
          <div class="card-pay__brand">COUPON</div>
        </div>
        <div class="card-pay__panel">
          <div class="card-pay__label">쿠폰 번호 8자리를 입력</div>
          <input
            type="text"
            inputmode="numeric"
            autocomplete="off"
            enterkeyhint="done"
            maxlength="9"
            class="card-pay__input is-focus"
            id="coupon-pay-input"
            placeholder="____ ____"
            aria-label="쿠폰 번호"
          />
          <div class="card-pay__keys" id="coupon-pay-keys">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, "지움", 0, "한 글자"]
              .map((k) => {
                const isFn = typeof k === "string";
                const val = k === "지움" ? "clear" : k === "한 글자" ? "del" : String(k);
                return `<button type="button" class="card-pay__key ${isFn ? "card-pay__key--fn" : ""}" data-k="${val}">${k}</button>`;
              })
              .join("")}
            <button type="button" class="card-pay__key card-pay__key--ok" data-k="ok" id="coupon-pay-ok" disabled>쿠폰 결제</button>
          </div>
          <p class="card-pay__hint">왼쪽 8자리 숫자를 보고 입력 · 키보드도 가능</p>
        </div>
        <div class="card-pay__processing" id="coupon-pay-processing">
          <div class="card-pay__spin" aria-hidden="true"></div>
          쿠폰 확인 중…
        </div>
      </div>
    `;

    const input = root.querySelector("#coupon-pay-input");
    const okBtn = root.querySelector("#coupon-pay-ok");
    const wrap = root.querySelector("#ieum-coupon-pay");

    function refresh() {
      const shown = typed ? formatCode(typed) : "";
      if (input.value !== shown) input.value = shown;
      okBtn.disabled = typed.length !== CODE_LEN;
    }

    function setTypedFromString(str) {
      typed = onlyDigits(str).slice(0, CODE_LEN);
      refresh();
    }

    function press(k) {
      if (destroyed) return;
      if (k === "clear") typed = "";
      else if (k === "del") typed = typed.slice(0, -1);
      else if (k === "ok") {
        submit();
        return;
      } else if (/^\d$/.test(k) && typed.length < CODE_LEN) {
        typed += k;
      }
      refresh();
    }

    function submit() {
      if (destroyed) return;
      if (typed !== secret) {
        if (typeof opts.onError === "function") {
          opts.onError("쿠폰 번호가 다릅니다. 다시 입력해 주세요.");
        }
        typed = "";
        refresh();
        input.focus();
        return;
      }
      wrap.classList.add("is-busy");
      setTimeout(() => {
        if (!destroyed && typeof opts.onSuccess === "function") {
          opts.onSuccess({ code: secret });
        }
      }, 1000);
    }

    root.querySelector("#coupon-pay-keys").addEventListener("click", (e) => {
      const btn = e.target.closest("[data-k]");
      if (!btn) return;
      press(btn.dataset.k);
      input.focus();
    });

    input.addEventListener("input", () => setTypedFromString(input.value));
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        if (typed.length === CODE_LEN) submit();
      }
      if (
        e.key.length === 1 &&
        !/\d/.test(e.key) &&
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey
      ) {
        e.preventDefault();
      }
    });

    function onDocKey(e) {
      if (destroyed) return;
      const tag = (document.activeElement && document.activeElement.tagName) || "";
      if (
        tag === "INPUT" &&
        document.activeElement !== input &&
        document.activeElement.type !== "button"
      ) {
        return;
      }
      if (e.key >= "0" && e.key <= "9") {
        if (document.activeElement !== input) {
          e.preventDefault();
          press(e.key);
        }
      } else if (e.key === "Backspace" && document.activeElement !== input) {
        e.preventDefault();
        press("del");
      } else if (e.key === "Enter" && document.activeElement !== input) {
        e.preventDefault();
        if (typed.length === CODE_LEN) submit();
      }
    }
    document.addEventListener("keydown", onDocKey);

    refresh();
    setTimeout(() => {
      try {
        input.focus({ preventScroll: true });
      } catch (_) {
        input.focus();
      }
    }, 80);

    return {
      destroy: () => {
        destroyed = true;
        document.removeEventListener("keydown", onDocKey);
        root.innerHTML = "";
      },
    };
  }

  global.IeumCouponPay = { mount, formatCode, onlyDigits, CODE_LEN };
})(window);
