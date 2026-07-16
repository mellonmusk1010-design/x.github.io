/**
 * 이음 QR 결제 (실습용)
 * - 같은 Wi‑Fi / 폰 스캔 없어도 동작
 * - QR을 누르거나 「결제 완료」 버튼 → 주문 완료
 * - (선택) 같은 네트워크면 폰 스캔도 여전히 가능
 */
(function (global) {
  function randId() {
    return (
      Date.now().toString(36) +
      Math.random().toString(36).slice(2, 10)
    );
  }

  function storageKey(id) {
    return "ieum_pay_done_" + id;
  }

  async function tryCreateServerSession() { return null; }

  async function resolveScanUrl(sessionId) { return '#payment-practice'; }

  function mount(opts) {
    const root = opts.mount;
    if (!root) return null;

    let destroyed = false;
    let timer = null;
    let sessionId = null;
    let paidFired = false;

    root.innerHTML = `
      <div class="qr-pay" id="ieum-qr-pay">
        <div class="qr-pay__box">
          <p class="qr-pay__title">QR로 결제하기</p>
          <button type="button" class="qr-pay__frame qr-pay__frame--tap" id="qr-pay-frame" aria-label="QR을 눌러 결제 완료">
            <div class="qr-pay__loading">QR 준비 중…</div>
          </button>
          <p class="qr-pay__hint">
            <strong>QR을 누르거나</strong> 아래 버튼을 누르면<br/>결제가 완료됩니다.
          </p>
          <p class="qr-pay__wait" id="qr-pay-wait">화면의 QR을 눌러 주세요</p>
          <button type="button" class="qr-pay__fake" id="qr-pay-fake">
            결제 완료
          </button>
        </div>
        <div class="qr-pay__processing" id="qr-pay-processing" hidden>
          <div class="card-pay__spin" aria-hidden="true"></div>
          결제 확인 중…
        </div>
      </div>
    `;

    const frame = root.querySelector("#qr-pay-frame");
    const processing = root.querySelector("#qr-pay-processing");
    const box = root.querySelector(".qr-pay__box");
    const waitEl = root.querySelector("#qr-pay-wait");
    const fakeBtn = root.querySelector("#qr-pay-fake");

    function stopPoll() {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }

    function showPaid() {
      if (paidFired || destroyed) return;
      paidFired = true;
      stopPoll();
      if (box) box.hidden = true;
      if (processing) processing.hidden = false;

      // 서버 세션이 있으면 표시만 (실패해도 완료 진행)
      if (sessionId) {
        try {
          localStorage.setItem(storageKey(sessionId), "1");
        } catch (_) {}
      }

      setTimeout(() => {
        if (!destroyed && typeof opts.onSuccess === "function") {
          opts.onSuccess({ sessionId: sessionId || "local" });
        }
      }, 600);
    }

    async function pollServer() {
      if (destroyed || paidFired || !sessionId) return;
      try {
        if (localStorage.getItem(storageKey(sessionId)) === "1") {
          showPaid();
          return;
        }
      } catch (_) {}
    }

    function bindCompleteTriggers() {
      frame?.addEventListener("click", (e) => {
        e.preventDefault();
        showPaid();
      });
      fakeBtn?.addEventListener("click", (e) => {
        e.preventDefault();
        if (fakeBtn.disabled) return;
        fakeBtn.disabled = true;
        fakeBtn.textContent = "확인 중…";
        showPaid();
      });
    }

    async function start() {
      bindCompleteTriggers();

      // 서버 세션은 있으면 쓰고, 없어도 로컬로 진행
      sessionId = (await tryCreateServerSession()) || randId();
      const scanUrl = await resolveScanUrl(sessionId);

      const qrImg =
        "https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&data=" +
        encodeURIComponent(scanUrl);

      frame.innerHTML = `
        <span class="qr-pay__img-wrap">
          <img class="qr-pay__img" src="${qrImg}" alt="결제 QR 코드" width="200" height="200" draggable="false" />
        </span>
        <span class="qr-pay__tap-label">여기를 누르세요</span>
      `;
      const img = frame.querySelector("img");
      if (img) {
        img.onerror = () => {
          frame.innerHTML = `
            <span class="qr-pay__img-wrap">
              <span class="qr-pay__fake-code" aria-hidden="true">■■■ □■□ ■■■</span>
            </span>
            <span class="qr-pay__tap-label">여기를 누르세요</span>
          `;
        };
      }

      if (waitEl) waitEl.textContent = "QR을 누르거나 「결제 완료」";

      // 폰 스캔(같은 네트워크)도 되면 좋고, 안 돼도 상관없음
      timer = setInterval(pollServer, 1000);
      pollServer();
    }

    start();

    return {
      destroy: () => {
        destroyed = true;
        stopPoll();
        root.innerHTML = "";
      },
    };
  }

  global.IeumQrPay = { mount };
})(window);
