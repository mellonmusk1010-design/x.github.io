/**
 * 이음 (IEUM) — UI interactions only
 */

document.addEventListener("DOMContentLoaded", () => {
  // Sticky nav border on scroll
  const nav = document.querySelector(".nav");
  if (nav) {
    const onScroll = () => {
      nav.classList.toggle("is-scrolled", window.scrollY > 8);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  // Animate progress bars (decorative)
  const fills = document.querySelectorAll(".progress-bar__fill");
  fills.forEach((el) => {
    const target = el.dataset.progress || "0";
    requestAnimationFrame(() => {
      setTimeout(() => {
        el.style.width = `${target}%`;
      }, 200);
    });
  });

  // 실습 전: 단어 학습 여부 확인
  // sessionStorage → 탭/창이 열려 있는 동안만 "다음에 보지 않기" 유지
  // 창을 닫았다 다시 열면 다시 물어봄
  const GATE_SKIP_KEY = "ieum_skip_word_gate";
  const gateModal = document.getElementById("gate-modal");
  if (gateModal) {
    const isGateSkipped = () => {
      try {
        return sessionStorage.getItem(GATE_SKIP_KEY) === "1";
      } catch {
        return false;
      }
    };
    const skipGateForSession = () => {
      try {
        sessionStorage.setItem(GATE_SKIP_KEY, "1");
      } catch {
        /* ignore */
      }
    };
    const goPractice = () => {
      location.href = "practice.html";
    };
    const openGate = () => {
      gateModal.hidden = false;
      document.body.classList.add("is-modal-open");
      document.getElementById("gate-yes")?.focus();
    };
    const closeGate = () => {
      gateModal.hidden = true;
      document.body.classList.remove("is-modal-open");
    };

    document.querySelectorAll(".js-practice-gate").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        if (isGateSkipped()) {
          goPractice();
          return;
        }
        openGate();
      });
    });

    document.getElementById("gate-yes")?.addEventListener("click", () => {
      location.href = "words.html";
    });
    document.getElementById("gate-no")?.addEventListener("click", () => {
      goPractice();
    });
    document.getElementById("gate-skip")?.addEventListener("click", () => {
      skipGateForSession();
      goPractice();
    });
    gateModal.querySelectorAll("[data-gate-close]").forEach((el) => {
      el.addEventListener("click", closeGate);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !gateModal.hidden) closeGate();
    });
  }
});

