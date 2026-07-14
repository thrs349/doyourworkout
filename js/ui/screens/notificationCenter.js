// screens/notificationCenter.js
// v2.4.0: Exercise Notification Center.
// 여러 gainMethod에 흩어진 "확인이 필요한 상태/알림"을 하나의 화면에서 모아 보여주는 순수 UI 레이어입니다.
// 이 파일은 judge.js/gain.js를 전혀 호출하지 않고, state.js의 조회 함수만 읽어서 그립니다.
// 각 카드의 액션(목표 수정/현행 유지)도 state.js에 이미 있거나 이번에 추가된 함수(clearBodyweightGoalPending,
// clearHighRepReviewAlert)를 그대로 호출할 뿐, 이 파일 자체는 어떤 판정/증량 상태도 직접 계산하지 않습니다.
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import * as state from "../../core/state.js";

// 1. 🏋 도전세트 후보 — Read Only. 선택 기능 없음(기존 #/machine-candidate FAB 기능은 그대로 유지).
function buildChallengeCandidateCard() {
  const groups = state.getChallengeCandidateGroups();
  if (groups.length === 0) return null;

  const groupNodes = groups.map((g) =>
    el("div", { class: "notif-group" }, [
      el("div", { class: "section-label", text: `${g.dayLabel}요일 - ${g.routineTitle}` }),
      ...g.exercises.map((ex) => el("div", { class: "notif-ro-row", text: ex.name })),
    ])
  );

  return el("div", { class: "exercise-card notif-card" }, [
    el("div", { class: "notif-card-title", text: "🏋 도전세트 후보" }),
    ...groupNodes,
  ]);
}

// 고반복/맨몸 공통 액션 행: 종목명 + [목표 수정] [현행 유지] (팝업 없이 카드 내부에서 바로 선택, 안 B).
function buildActionRow(ex, { onEdit, onKeep }) {
  return el("div", { class: "list-row notif-action-row" }, [
    el("div", { class: "notif-action-name", text: ex.name }),
    el("div", { class: "btn-row-h compact", style: { flexShrink: "0" } }, [
      el("button", { class: "btn btn-primary btn-compact", text: "목표 수정", onclick: onEdit }),
      el("button", { class: "btn btn-ghost btn-compact", text: "현행 유지", onclick: onKeep }),
    ]),
  ]);
}

// 2. 💪 고반복 증량 검토 — 단발성 알림(Pending 아님). 목표 수정/현행 유지 모두 알림을 즉시 삭제합니다.
function buildHighRepCard(rerender) {
  const alerts = state.getHighRepReviewAlerts();
  if (alerts.length === 0) return null;

  const rows = alerts.map((ex) =>
    buildActionRow(ex, {
      onEdit: () => {
        state.clearHighRepReviewAlert(ex.id);
        // v2.4.1: 저장 후 Notification Center로 돌아오도록 진입 출처를 남깁니다.
        window.__exerciseEditReturnHash = "#/notification-center";
        navigate(`#/exercise-edit/${ex.id}`);
      },
      onKeep: () => {
        state.clearHighRepReviewAlert(ex.id);
        rerender();
      },
    })
  );

  return el("div", { class: "exercise-card notif-card" }, [
    el("div", { class: "notif-card-title", text: "💪 증량 검토" }),
    ...rows,
  ]);
}

// 3. 🤸 맨몸 목표 조정 — 기존 bodyweightGoalAdjustPending(성장 사이클 상태) 그대로 사용.
// v2.4.0: "목표 수정"은 clearBodyweightGoalPending()으로 pending 자체를 해제하지만,
// "현행 유지"는 dismissBodyweightGoalAdjustNotification()으로 이번 알림 표시만 끄고 pending은 그대로 둡니다.
function buildBodyweightCard(rerender) {
  const list = state.getBodyweightGoalAdjustList();
  if (list.length === 0) return null;

  const rows = list.map((ex) =>
    buildActionRow(ex, {
      onEdit: () => {
        state.clearBodyweightGoalPending(ex.id);
        // v2.4.1: 저장 후 Notification Center로 돌아오도록 진입 출처를 남깁니다.
        window.__exerciseEditReturnHash = "#/notification-center";
        navigate(`#/exercise-edit/${ex.id}`);
      },
      onKeep: () => {
        state.dismissBodyweightGoalAdjustNotification(ex.id);
        rerender();
      },
    })
  );

  return el("div", { class: "exercise-card notif-card" }, [
    el("div", { class: "notif-card-title", text: "🤸 목표 조정" }),
    ...rows,
  ]);
}

export function renderNotificationCenter(root) {
  function renderBody() {
    const cards = [buildChallengeCandidateCard(), buildHighRepCard(renderBody), buildBodyweightCard(renderBody)].filter(Boolean);

    const screen = el("div", { id: "notification-center-screen", class: "screen-content" }, [
      el("div", { class: "topbar" }, [
        el("button", { class: "icon-btn", text: "←", onclick: () => history.back() }),
        el("div", { class: "title", text: "운동 알림" }),
        el("span", { style: { opacity: "0" } }, "·"),
      ]),
      el(
        "div",
        { class: "table-area" },
        cards.length ? cards : [el("div", { class: "helper-text", text: "확인할 알림이 없습니다." })]
      ),
    ]);
    mount(root, screen);
  }

  renderBody();
}
