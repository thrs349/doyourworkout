// screens/history.js
// v1.2: "요일"이 아니라 "오늘의 루틴에 포함된 종목" 기준으로 카드를 보여줍니다.
// (오늘 요일에 연결된 기본 루틴을 조회해서 그 루틴에 들어있는 종목들을 순서대로 표시하는 방식이라
//  결과적으로 매일 실제로 수행하는 루틴의 종목이 그대로 반영됩니다.)
// 각 카드는 최근 최고 중량 / 3개월 추이 그래프 / 최근 기록을 표시합니다.
import { el, mount } from "../dom.js";
import { renderBottomNav } from "../components/bottomNav.js";
import { renderLineChart } from "../components/lineChart.js";
import * as state from "../../core/state.js";
import { getWeightTrend, getRecentMaxWeight, getMostRecentRecord } from "../../core/stats.js";
import { todayDayKey, DAYS } from "../../core/models.js";

// v1.9.1: bodyweight는 "weightUsed}kg ×" 대신 반복수/시간 단위(회/초)를 붙여서 보여줍니다.
// (기록 자체는 그대로 유지 — 중량 표현만 제거하고 단위를 붙이는 순수 텍스트 포맷 변경입니다.)
function fmtRecentSummary(entry, ex) {
  if (!entry) return "아직 기록이 없습니다.";
  const { date, record } = entry;
  const mainSets = record.sets.filter((s) => !s.isChallenge && !s.isWarmup);
  const performed = mainSets.map((s) => s.performedRaw || "-").join("/");
  const resultText = record.gainEvent === "auto_increase" ? "증량!" : record.judgement;
  const judge = resultText ? ` · ${resultText}` : "";
  if (ex.gainMethod === "bodyweight") {
    const unit = ex.bodyweightGoalType === "time" ? "초" : "회";
    return `${date} · ${performed}${unit}${judge}`;
  }
  return `${date} · ${record.weightUsed}kg × ${performed}${judge}`;
}

function buildExerciseCard(ex) {
  const sessions = state.getData().sessions;
  const isBodyweight = ex.gainMethod === "bodyweight";
  const recent = getMostRecentRecord(sessions, ex.id);

  // v1.9.1: 맨몸은 중량 성장 추적 목적이 아니므로 그래프와 "최근 최고" 표시를 제외합니다.
  if (isBodyweight) {
    return el("div", { class: "exercise-card" }, [
      el("div", { class: "ec-head" }, [el("div", { class: "ec-name", text: ex.name })]),
      el("div", { class: "ec-recent" }, [document.createTextNode("최근 기록: "), el("b", { text: fmtRecentSummary(recent, ex) })]),
    ]);
  }

  const trend = getWeightTrend(sessions, ex.id, 90, ex.gainMethod);
  const maxWeight = getRecentMaxWeight(trend);

  return el("div", { class: "exercise-card" }, [
    el("div", { class: "ec-head" }, [
      el("div", { class: "ec-name", text: ex.name }),
      el("div", { class: "ec-max" }, [el("small", { text: "최근 최고 " }), document.createTextNode(maxWeight !== null ? `${maxWeight}kg` : "-")]),
    ]),
    renderLineChart(trend, { width: 300, height: 92 }),
    el("div", { class: "ec-recent" }, [document.createTextNode("최근 기록: "), el("b", { text: fmtRecentSummary(recent, ex) })]),
  ]);
}

export function renderHistory(root) {
  const dayKey = todayDayKey();
  const dayLabel = DAYS.find((d) => d.key === dayKey)?.label || "";
  const exercises = state.getRoutineExercises(dayKey);
  // v2.6.4: 홈 화면(home.js)과 동일하게 오늘 요일에 설정된 루틴 이름을 그대로 반영합니다. 이 화면은 항상
  // "오늘" 기준으로 현재 루틴 상태를 조회해 매번 새로 그리므로(과거 세션 기록 자체는 건드리지 않음),
  // 데이터 구조 변경이나 migration 없이 표시 문구만 수정하면 됩니다.
  // v2.6.5: 실기기 테스트 반영 - "기록 · 루틴명" 형태 대신 "요일 + 루틴명"으로 변경(예: "월요일 상체A").
  // v2.6.6: 실기기 테스트 반영 - "요일 + 루틴명" 대신 "오늘 날짜(요일) + 루틴명"으로 변경(예: "7.18(일) · 상체A").
  // toLocaleDateString은 "7. 18."처럼 공백/마침표가 붙어 요청 형식과 달라 getMonth()/getDate()로 직접 조합합니다.
  // 이 값도 매 렌더마다 "지금 이 순간"을 새로 읽어 표시하는 것뿐이라 과거 세션 기록에는 전혀 영향이 없습니다.
  const version = state.getDefaultVersion(dayKey);
  const routineTitle = version.title || "루틴";
  const now = new Date();
  const dateLabel = `${now.getMonth() + 1}.${now.getDate()}`;

  const cards = exercises.length
    ? exercises.map(buildExerciseCard)
    : [el("div", { class: "empty-routine", text: "오늘의 루틴에 포함된 운동이 없습니다." })];

  const screen = el("div", { id: "history-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("div", { class: "title", text: `${dateLabel}(${dayLabel}) · ${routineTitle}` }),
      el("span", { style: { opacity: 0 } }, "·"),
    ]),
    el("div", { class: "table-area" }, cards),
    renderBottomNav("history"),
  ]);
  mount(root, screen);
}
