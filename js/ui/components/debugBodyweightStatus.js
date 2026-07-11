// debugBodyweightStatus.js
// ⚠️ 임시 디버그 전용 컴포넌트입니다 (v1.8).
// bodyweightGoalAdjustPending 값을 확인할 정식 UI가 아직 없어서, 개발/테스트 목적으로만
// 연속 A 카운트와 pending 상태를 화면에 노출합니다.
// 정식 UX가 만들어지면 이 파일과, 이 파일을 import하는 곳(현재 exerciseManage.js 한 줄)만
// 지우면 깨끗하게 제거됩니다. 일반 사용자 대상 디자인이 아니므로 스타일도 의도적으로 "디버그스럽게" 뒀습니다.
import { el } from "../dom.js";

export function renderBodyweightDebugTag(ex, exState) {
  if (!ex || ex.gainMethod !== "bodyweight") return null;

  const pending = !!exState.bodyweightGoalAdjustPending;
  const streak = exState.bodyweightConsecutiveA || 0;

  return el("div", { class: "debug-tag" }, [
    el("span", { text: "[TEST] " }),
    el("span", { text: `연속 A: ${streak}` }),
    el("span", { text: " · " }),
    el("span", { text: `목표 조정 필요: ${pending ? "ON" : "OFF"}` }),
    pending ? el("span", { class: "debug-tag-warn", text: " ⚠ 목표 조정 필요" }) : null,
  ]);
}
