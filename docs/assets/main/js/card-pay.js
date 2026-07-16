/**
 * 이음 카드 결제 — 16자리 카드 번호 입력 (키패드·키보드)
 */
(function (global) {
  const CODE_LEN = 16;

  function randDigits(n) {
    let s = "";
    for (let i = 0; i < n; i++) s += Math.floor(Math.random() * 10);
    return s;
  }

  function formatCard(digits) {
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
      <div class="card-pay" id="ieum-card-pay">
        <div class="card-pay__face" aria-hidden="true">
          <div class="card-pay__stripe-label">연습용 카드 · 번호</div>
          <div class="card-pay__number-panel" id="card-pay-secret">${formatCard(secret)}</div>
          <div class="card-pay__brand">CARD</div>
        </div>
        <div class="card-pay__panel">
          <div class="card-pay__label">카드 번호를 그대로 입력</div>
          <input
            type="text"
            inputmode="numeric"
            autocomplete="off"
            enterkeyhint="done"
            maxlength="19"
            class="card-pay__input is-focus"
            id="card-pay-input"
            placeholder="____ ____ ____ ____"
            aria-label="카드 번호"
          />
          <div class="card-pay__keys" id="card-pay-keys">
            ${[1, 2, 3, 4, 5, 6, 7, 8, 9, "지움", 0, "한 글자"]
              .map((k) => {
                const isFn = typeof k === "string";
                const val = k === "지움" ? "clear" : k === "한 글자" ? "del" : String(k);
                return `<button type="button" class="card-pay__key ${isFn ? "card-pay__key--fn" : ""}" data-k="${val}">${k}</button>`;
              })
              .join("")}
            <button type="button" class="card-pay__key card-pay__key--ok" data-k="ok" id="card-pay-ok" disabled>결제하기</button>
          </div>
          <p class="card-pay__hint">왼쪽 카드 숫자 16자리 · 키보드도 가능</p>
        </div>
        <div class="card-pay__processing">
          <div class="card-pay__spin" aria-hidden="true"></div>
          카드 결제 확인 중…
        </div>
      </div>
    `;

    const input = root.querySelector("#card-pay-input");
    const okBtn = root.querySelector("#card-pay-ok");
    const wrap = root.querySelector("#ieum-card-pay");

    function refresh() {
      const shown = typed ? formatCard(typed) : "";
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
          opts.onError("카드 번호가 다릅니다. 다시 입력해 주세요.");
        }
        typed = "";
        refresh();
        input.focus();
        return;
      }
      wrap.classList.add("is-busy");
      setTimeout(() => {
        if (!destroyed && typeof opts.onSuccess === "function") {
          opts.onSuccess({ number: secret });
        }
      }, 1200);
    }

    root.querySelector("#card-pay-keys").addEventListener("click", (e) => {
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

  global.IeumCardPay = { mount, formatCard, onlyDigits, CODE_LEN };
})(window);
