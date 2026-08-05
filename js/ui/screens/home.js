// screens/home.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import { renderBottomNav } from "../components/bottomNav.js";
import { openModal } from "../components/modal.js";
import * as state from "../../core/state.js";
import { todayDayKey, DAYS } from "../../core/models.js";
import { APP_NAME } from "../../core/appConfig.js";

export function renderHome(root) {
  const dayKey = todayDayKey();
  const dayLabel = DAYS.find((d) => d.key === dayKey).label;
  const version = state.getDefaultVersion(dayKey);
  const exercises = state.getRoutineExercises(dayKey);
  // v2.6.6: 실기기 테스트 반영 - "2026. 07. 19." 대신 "2026. 7. 19."로 월/일 앞자리 0을 제거합니다.
  // (year는 "numeric" 그대로라 자릿수 변화 없음. 요일 표기는 이 문자열과 별도로 아래에서 조합됩니다.)
  const dateStr = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "numeric", day: "numeric" });

  // v2.8.0 Recovery Mode: 홈 화면을 새로 그릴 때마다 항상 "⚡ 일반 모드"에서 시작하는 세션 단위 런타임
  // 값입니다. 영구 저장하지 않으며(data/localStorage 어디에도 쓰지 않음), 이 화면을 벗어났다가 돌아오면
  // 다시 기본값으로 초기화됩니다 - "당일 세션에만 적용"이라는 요구사항과 일치합니다.
  let recoveryMode = false;

  const modeBtnNormal = el("button", {
    class: "mode-btn active",
    "aria-label": "일반 모드",
    title: "일반 모드",
    onclick: () => setMode(false),
  }, [el("span", { class: "mode-btn-icon", text: "⚡" })]);
  const modeBtnRecovery = el("button", {
    class: "mode-btn",
    "aria-label": "회복 모드",
    title: "회복 모드",
    onclick: () => setMode(true),
  }, [el("span", { class: "mode-btn-icon", text: "🌱" })]);

  function setMode(nextRecoveryMode) {
    recoveryMode = nextRecoveryMode;
    modeBtnNormal.classList.toggle("active", !recoveryMode);
    modeBtnRecovery.classList.toggle("active", recoveryMode);
    // 회복 모드에서는 도전세트를 그날 진행하지 않으므로(§6 확정), 도전세트 후보 FAB를 숨깁니다.
    // 후보 데이터(designatedChallengeExerciseId/isGainCandidate) 자체는 전혀 건드리지 않으므로,
    // 다시 ⚡ 일반 모드로 돌아오면 처음 계산해둔 showChallengeFab 값 그대로 복원됩니다.
    if (challengeFab) challengeFab.style.display = recoveryMode ? "none" : "";
  }

  const routineCard = el("div", { class: "routine-card-lg" }, [
    el("div", { class: "card-bg" }),
    el("div", { class: "card-fg" }, [
      el("div", { class: "routine-card-head" }, [
        el("div", { class: "eyebrow-title", text: "오늘의 루틴" }),
        el("div", { class: "mode-toggle" }, [modeBtnNormal, modeBtnRecovery]),
      ]),
      el("h2", { text: version.title || `${dayLabel}요일 루틴` }),
      exercises.length
        ? el(
            "div",
            { class: "ex-preview" },
            exercises.map((ex, i) =>
              el("div", { class: "ex-preview-row" }, [
                el("span", { class: "ex-num", text: String(i + 1).padStart(2, "0") }),
                el("span", { text: ex.name }),
              ])
            )
          )
        : el("div", { class: "empty-routine", text: "계획된 운동이 없습니다." }),
    ]),
  ]);

  const startBtn = el("button", { class: "btn btn-primary", text: "운동 시작", onclick: onStartClick });

  // v1.9.2: 픽셀 오프셋 추측(전체 화면 기준) 대신, FAB를 home-cta(운동 시작 버튼을 감싸는 컨테이너) "자신"에
  // position:absolute + bottom:100%로 앵커링합니다. 이렇게 하면:
  //   - 하단 네비/버튼 높이를 몰라도 항상 정확히 "시작 버튼 바로 위"에 위치(구조적으로 겹침 자체가 불가능)
  //   - absolute라 문서 흐름에서 빠지므로, FAB 유무와 무관하게 home-cta/시작 버튼의 크기·위치가 전혀 바뀌지 않음
  //   - v2에서 좌측 하단 알림 FAB를 추가할 때도 같은 home-cta 안에 class="fab-btn left"만 더하면 됨(css/components.css 참고)
  // 조건: 오늘 이미 도전 종목을 선택하지 않았고, 오늘 루틴에 해당하는 후보가 1개 이상 있을 때만 표시.
  // 드래그 이동은 지원하지 않으며, 위치를 저장하는 상태도 없습니다.
  const showChallengeFab = state.shouldShowChallengeFab(dayKey);
  const challengeFab = showChallengeFab
    ? el("button", {
        class: "fab-btn right",
        "aria-label": "도전세트 후보 선택",
        onclick: () => navigate("#/machine-candidate"),
        title: "도전세트 후보 선택",
      }, [el("span", { class: "fab-icon", text: "🏆" })])
    : null;

  // v2.4.0: 운동 알림(Exercise Notification Center) FAB. 도전세트 후보 FAB와 같은 home-cta 컨테이너에
  // class="fab-btn left"만 추가하면 되도록 CSS가 이미 준비돼 있었습니다(위 challengeFab 주석 참고).
  // 숫자 배지는 쓰지 않고, 알림이 하나라도 있으면 표시/없으면 숨김만 처리합니다.
  const showNotificationFab = state.shouldShowNotificationFab();
  const notificationFab = showNotificationFab
    ? el("button", {
        class: "fab-btn left",
        "aria-label": "운동 알림",
        onclick: () => navigate("#/notification-center"),
        title: "운동 알림",
      }, [el("span", { class: "fab-icon", text: "🔔" })])
    : null;

  const screen = el("div", { id: "home-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("div", { class: "home-title" }, [document.createTextNode(APP_NAME), el("span", { class: "sub", text: `${dateStr} (${dayLabel})` })]),
      el("button", { class: "icon-btn gear opacity-50", onclick: () => navigate("#/settings") }),
    ]),
    el("div", { class: "home-body" }, [
      routineCard,
      el("div", { class: "home-spacer" }),
      el("div", { class: "home-cta" }, [notificationFab, challengeFab, startBtn]),
    ]),
    renderBottomNav("home"),
  ]);

  mount(root, screen);

  // v1.2: 프리웨이트 도전 여부도 이제 "운동 종료 후 후보 선택" 화면 하나로 통일되어서,
  // 운동 시작 전 별도 추천 팝업 없이 바로 오늘의 운동으로 들어갑니다.
  // v2.4.1: 기존 native alert() 대신 앱 전역 커스텀 modal 디자인을 사용합니다. 종목명만 종목별로 <p>를 나눠서
  // (exerciseManage.js의 완전 삭제 확인 팝업과 동일 패턴) 화면 폭에 따라 단어 중간에서 줄바꿈되는 것을 방지합니다.
  // v2.4.1 후속 수정: 설명 문구(안내/지시 문장)는 전부 제거하고 종목명만 보여주도록 단순화했습니다.
  function showMissingWeightModal(missing) {
    const checklist = el(
      "div",
      { class: "checklist-wrap" },
      missing.map((ex) =>
        el("div", { class: "checklist-item" }, [
          el("span", { class: "checklist-box", text: "⚠️" }),
          el("span", { text: ex.name }),
        ])
      )
    );

    const content = el("div", { class: "duration-modal" }, [
      el("div", { class: "duration-title", text: "중량 미설정 운동" }),
      checklist,
      el("button", { class: "btn btn-primary", text: "확인", onclick: () => close() }),
    ]);
    const close = openModal(content);
  }

  function onStartClick() {
    if (exercises.length === 0) {
      navigate(`#/routine/${dayKey}`);
      return;
    }
    // v2.3.0: Generation 초기화 등으로 currentWeight가 설정되지 않은(null) 종목이 오늘 루틴에 있으면
    // workout.js에 진입하기 전에 차단합니다(오늘 루틴에 포함된 종목만 검사).
    const missing = state.getExercisesMissingWeightForDay(dayKey);
    if (missing.length > 0) {
      showMissingWeightModal(missing);
      return;
    }
    const session = state.startSession(dayKey, recoveryMode);
    window.__draftSession = session; // 세션 진행 중에는 메모리에만 두고, 종료 시 state에 커밋합니다.
    navigate("#/workout");
  }
}
