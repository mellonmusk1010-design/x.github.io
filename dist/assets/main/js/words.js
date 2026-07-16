/**
 * 이음 — 실습 전 단어 학습 (시니어용 큰 카드)
 */
(function () {
  const WORDS = [
    {
      tag: "공통",
      term: "키오스크",
      meaning: "매장에 있는 큰 화면 기계예요. 직원이 아니라 손으로 메뉴를 고르고 계산합니다.",
      example: "예: 맥도날드·메가커피 앞에서 키오스크로 주문해요.",
    },
    {
      tag: "키오스크",
      term: "단품",
      meaning: "햄버거만 사는 것. 감자와 음료는 따로 고르지 않습니다.",
      example: "예: 빅맥 단품 = 햄버거만",
    },
    {
      tag: "키오스크",
      term: "세트",
      meaning: "햄버거 + 사이드(감자 등) + 음료를 묶어서 사는 것.",
      example: "예: 세트 고르면 감자와 음료를 이어서 고릅니다.",
    },
    {
      tag: "키오스크",
      term: "사이드",
      meaning: "메인 메뉴와 함께 먹는 곁들임 음식. 감자튀김 같은 것.",
      example: "예: 세트 사이드 → 후렌치 후라이",
    },
    {
      tag: "키오스크",
      term: "매장 식사",
      meaning: "사 온 음식을 가게 안에서 먹는 선택.",
      example: "예: 자리 앉아서 드실 때",
    },
    {
      tag: "키오스크",
      term: "포장",
      meaning: "음식을 가져가서 밖에서 먹는 선택. 집으로 가져갈 때도 포장입니다.",
      example: "예: 테이크아웃과 비슷한 말",
    },
    {
      tag: "결제",
      term: "결제",
      meaning: "돈을 내고 주문을 끝내는 단계. 여기서는 QR 또는 쿠폰으로 연습합니다.",
      example: "예: 메뉴 담은 뒤 「결제하기」",
    },
    {
      tag: "결제",
      term: "QR 결제",
      meaning: "화면에 나온 네모 무늬(QR)를 휴대폰 카메라로 찍으면 결제가 됩니다.",
      example: "예: 폰으로 QR을 찍으면 키오스크가 완료로 바뀝니다.",
    },
    {
      tag: "결제",
      term: "카드 결제",
      meaning: "카드 번호를 입력해 결제하는 방법. 실습에서는 화면에 보이는 번호를 그대로 입력합니다.",
      example: "예: 카드 번호 16자리 입력 후 「결제하기」",
    },
    {
      tag: "키오스크",
      term: "수량",
      meaning: "몇 개를 살지. + 버튼으로 늘리고 − 버튼으로 줄입니다.",
      example: "예: 커피 수량 2개",
    },
    {
      tag: "키오스크",
      term: "합계",
      meaning: "담은 메뉴 가격을 모두 더한 최종 금액.",
      example: "예: 합계 12,500원",
    },
    {
      tag: "키오스크",
      term: "주문번호",
      meaning: "주문이 끝난 뒤 나오는 숫자. 음식 나올 때 이 번호를 확인합니다.",
      example: "예: 주문번호 247",
    },
    {
      tag: "키오스크",
      term: "카테고리",
      meaning: "메뉴를 나눈 칸. 버거, 음료, 디저트처럼 종류별로 모입니다.",
      example: "예: 위쪽 탭에서 「버거」 누르기",
    },
    {
      tag: "공통",
      term: "미션",
      meaning: "실습에서 「이 메뉴를 주문하세요」처럼 따라 할 과제.",
      example: "예: 미션: 아메리카노 2잔 주문",
    },
    {
      tag: "공통",
      term: "영수증",
      meaning: "결제 후 나오는 종이. 메뉴·금액·주문번호가 적혀 있습니다.",
      example: "예: 주문 완료 화면에 영수증처럼 보여 줍니다.",
    },
    {
      tag: "쿠팡",
      term: "쿠팡",
      meaning: "인터넷으로 물건을 주문하는 쇼핑몰 앱·사이트입니다.",
      example: "예: 쿠팡에서 휴지·세제를 주문해요.",
    },
    {
      tag: "쿠팡",
      term: "로켓배송",
      meaning: "쿠팡에서 빠르게 배송해 주는 서비스. 실습에서는 배송 종류 선택이에요.",
      example: "예: 로켓배송 = 내일 도착(연습)",
    },
    {
      tag: "쿠팡",
      term: "장바구니",
      meaning: "살 물건을 모아 두는 곳. 다 고른 뒤 한꺼번에 결제합니다.",
      example: "예: 상품 담기 → 장바구니 → 결제",
    },
    {
      tag: "쿠팡",
      term: "생필품",
      meaning: "생활하면서 자주 쓰는 물건. 휴지, 세제, 샴푸, 라면 등.",
      example: "예: 이번 미션은 생필품 사기",
    },
    {
      tag: "쿠팡",
      term: "배송",
      meaning: "주문한 물건을 집으로 보내 주는 것.",
      example: "예: 일반배송 / 로켓배송",
    },
  ];

  let index = 0;

  const $ = (sel) => document.querySelector(sel);

  function render() {
    const w = WORDS[index];
    const card = $("#word-card");
    const done = $("#words-done");
    const actions = document.querySelector(".words-actions");
    const progress = $("#words-progress");
    const btnPrev = $("#btn-prev");
    const btnNext = $("#btn-next");

    if (!w) return;

    if (done) done.hidden = true;
    if (card) card.hidden = false;
    if (actions) actions.hidden = false;

    $("#word-tag").textContent = w.tag;
    $("#word-term").textContent = w.term;
    $("#word-meaning").textContent = w.meaning;
    $("#word-example").textContent = w.example;

    if (progress) {
      progress.textContent = `${index + 1} / ${WORDS.length}`;
    }

    if (btnPrev) btnPrev.disabled = index === 0;
    if (btnNext) {
      btnNext.textContent = index >= WORDS.length - 1 ? "완료 ✓" : "다음 →";
    }

    card?.classList.remove("word-card--in");
    void card?.offsetWidth;
    card?.classList.add("word-card--in");
  }

  function showDone() {
    const card = $("#word-card");
    const done = $("#words-done");
    const actions = document.querySelector(".words-actions");
    const progress = $("#words-progress");
    if (card) card.hidden = true;
    if (actions) actions.hidden = true;
    if (done) done.hidden = false;
    if (progress) progress.textContent = `완료 · ${WORDS.length}개`;
  }

  function next() {
    if (index >= WORDS.length - 1) {
      showDone();
      return;
    }
    index += 1;
    render();
  }

  function prev() {
    if (index <= 0) return;
    index -= 1;
    render();
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("#btn-next")?.addEventListener("click", next);
    $("#btn-prev")?.addEventListener("click", prev);
    $("#btn-restart")?.addEventListener("click", () => {
      index = 0;
      render();
    });
    render();
  });
})();
