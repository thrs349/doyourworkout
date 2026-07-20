// screens/routineList.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import { renderBottomNav } from "../components/bottomNav.js";
import * as state from "../../core/state.js";
import { DAYS_DISPLAY_ORDER, secondaryTagsFor } from "../../core/models.js";

// v2.7.0 UI 개선: "5개 운동(메인 9세트, 보조 8세트)" - 괄호 앞 공백 제거(사용자 테스트 피드백 반영).
// Secondary Tag 하이라이트는 더 이상 이 텍스트에 붙이지 않고, 아래에서 별도 Chip(ex-meta-chips)으로 표시합니다.
function buildMetaText(summary) {
  if (!summary.count) return "운동 없음";
  return `${summary.count}개 운동(메인 ${summary.mainSets}세트, 보조 ${summary.assistSets}세트)`;
}

// v2.7.0 UI 개선: Weekly Routine Volume Card 재배열. 컬럼그룹 3개(상/하체 균형 | 상체 균형 | 하체 균형)를
// 좌→우로 배치합니다. rows: [{label, value}] - 각 그룹의 라벨/값 쌍을 위→아래로 나열합니다.
function buildVolumeGroup(rows) {
  return el(
    "div",
    { class: "volume-group" },
    rows.map(({ label, value }) =>
      el("div", { class: "volume-row" }, [
        el("span", { class: "volume-row-label", text: label }),
        el("span", { class: "volume-row-value", text: `${value}세트` }),
      ])
    )
  );
}

function buildVolumeCard() {
  const volume = state.getWeeklyVolume();
  // 1~2열: 상/하체 균형(상체·하체·코어 Primary total, 3행)
  const primaryRows = [
    { label: "상체", value: volume["상체"].total },
    { label: "하체", value: volume["하체"].total },
    { label: "코어", value: volume["코어"].total },
  ];
  // 3~4열: 상체 균형(Secondary Tag별 값, 4행) / 5~6열: 하체 균형(Secondary Tag별 값, 3행)
  const upperRows = secondaryTagsFor("상체").map((tag) => ({ label: tag, value: volume["상체"].tags[tag] ?? 0 }));
  const lowerRows = secondaryTagsFor("하체").map((tag) => ({ label: tag, value: volume["하체"].tags[tag] ?? 0 }));

  return el("div", { class: "volume-card" }, [
    el("div", { class: "volume-card-headers" }, [
      el("span", { class: "volume-group-header", text: "상/하체 균형" }),
      el("span", { class: "volume-group-header", text: "상체 균형" }),
      el("span", { class: "volume-group-header", text: "하체 균형" }),
    ]),
    el("div", { class: "volume-card-grid" }, [
      buildVolumeGroup(primaryRows),
      buildVolumeGroup(upperRows),
      buildVolumeGroup(lowerRows),
    ]),
  ]);
}

export function renderRoutineList(root) {
  // v1.1: 요일을 월~일 순서로 표시합니다.
  const rows = DAYS_DISPLAY_ORDER.map((d) => {
    const version = state.getDefaultVersion(d.key);
    const summary = state.getRoutineDaySummary(d.key); // v2.7.0: 개수 + 메인/보조 세트 + 하이라이트 태그
    // v2.7.0 UI 개선: Primary Body Part 대분류(상체/하체/코어)는 표시하지 않고 Secondary Tag만 Highlight Box로
    // 보여줍니다. calcDayHighlightTags()는 코어 종목을 "코어"라는 Primary 라벨로 포함시켜 반환하므로(볼륨 계산
    // 쪽 로직은 그대로 둔 채) 이 화면에서만 걸러냅니다.
    const tagChips = summary.highlightTags.filter((tag) => tag !== "코어");
    const rowContent = [
      el("div", { class: "name", text: `${d.label}요일 · ${version.title}` }),
      el("div", { class: "meta", text: buildMetaText(summary) }),
    ];
    if (tagChips.length) {
      rowContent.push(
        el(
          "div",
          { class: "ex-meta-chips" },
          tagChips.map((tag) => el("span", { class: "ex-chip ex-chip-tag", text: tag }))
        )
      );
    }
    return el("button", { class: "list-row", style: { width: "100%", border: "1px solid var(--color-border)", background: "var(--color-surface)" }, onclick: () => navigate(`#/routine/${d.key}`) }, [
      el("div", {}, rowContent),
      el("span", { class: "arrow", text: "›" }),
    ]);
  });

  const screen = el("div", { id: "routine-list-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("div", { class: "title", text: "루틴 설정" }),
      el("button", { class: "icon-btn", text: "운동 관리", style: { width: "auto", padding: "0 12px" }, onclick: () => navigate("#/exercise-manage") }),
    ]),
    el("div", { class: "table-area" }, rows),
    buildVolumeCard(),
    renderBottomNav("routine"),
  ]);
  mount(root, screen);
}
