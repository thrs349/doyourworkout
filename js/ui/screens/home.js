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
  const dateStr = new Date().toLocaleDateString("ko-KR", { year: "numeric", month: "2-digit", day: "2-digit" });

  const routineCard = el("div", { class: "routine-card-lg" }, [
    el("div", { class: "card-bg" }),
    el("div", { class: "card-fg" }, [
      el("div", { class: "eyebrow-title", text: "오늘의 루틴" }),
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
        : el("div", { class: "empty-routine", text: "아직 이 요일에 등록된 운동이 없습니다. 루틴 설정에서 추가해 주세요." }),
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
  // v2.4.1: 기존 native alert() 대신 앱 전역 커스텀 modal 디자인을 사용합니다. 문장 단위로 <p>를 나눠서
  // (exerciseManage.js의 완전 삭제 확인 팝업과 동일 패턴) 화면 폭에 따라 단어 중간에서 줄바꿈되는 것을 방지합니다.
  function showMissingWeightModal(missing) {
    const lines = ["중량이 설정되지 않은 종목이 있습니다.", ...missing.map((ex) => `- ${ex.name}`), "먼저 종목 관리에서 중량을 설정해주세요."];

    const content = el("div", { class: "duration-modal" }, [
      el("div", { class: "duration-title", text: "중량 설정 필요" }),
      el(
        "div",
        { style: { margin: "0 0 16px" } },
        lines.map((line) => el("p", { class: "detail", style: { textAlign: "center", margin: "0" }, text: line }))
      ),
      el("button", { class: "btn btn-primary", text: "확인", onclick: () => close() }),
    ]);
    const close = openModal(content);
  }

  function onStartClick() {
    if (exercises.length === 0) {
      alert("루틴에 등록된 운동이 없습니다. 먼저 루틴 설정에서 운동을 추가해 주세요.");
      return;
    }
    // v2.3.0: Generation 초기화 등으로 currentWeight가 설정되지 않은(null) 종목이 오늘 루틴에 있으면
    // workout.js에 진입하기 전에 차단합니다(오늘 루틴에 포함된 종목만 검사).
    const missing = state.getExercisesMissingWeightForDay(dayKey);
    if (missing.length > 0) {
      showMissingWeightModal(missing);
      return;
    }
    const session = state.startSession(dayKey);
    window.__draftSession = session; // 세션 진행 중에는 메모리에만 두고, 종료 시 state에 커밋합니다.
    navigate("#/workout");
  }
}
