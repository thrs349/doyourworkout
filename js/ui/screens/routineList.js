// screens/routineList.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import { renderBottomNav } from "../components/bottomNav.js";
import * as state from "../../core/state.js";
import { DAYS_DISPLAY_ORDER, secondaryTagsFor } from "../../core/models.js";

// v2.7.0: 루틴 카드 메타 줄("4개 운동 (메인 10세트, 보조 6세트) [가슴·등·어깨]") 문구 조립.
// 기존 ".meta" 한 줄(레이아웃 구조 변경 없음)을 그대로 확장하는 방식입니다(안2 확정).
function buildMetaText(summary) {
  if (!summary.count) return "운동 없음";
  const base = `${summary.count}개 운동 (메인 ${summary.mainSets}세트, 보조 ${summary.assistSets}세트)`;
  if (!summary.highlightTags.length) return base;
  return `${base} [${summary.highlightTags.join("·")}]`;
}

// v2.7.0: Weekly Routine Volume Card. 확정 기준(가로 3:3:1, 상체 3열 + 하체 3열 + 코어 1열이 한 카드 안에서
// 나란히)을 그대로 구현합니다. 각 부위 섹션은 "부위명+총세트(1열, 상단 고정)" + "태그명/태그세트(2·3열,
// 태그 수만큼 세로로 나열)" 구조이며, 상체(flex 3) / 하체(flex 3) / 코어(flex 1)를 한 행에 나란히 배치합니다.
function buildBodyPartSection(label, partVolume, tags) {
  return el("div", { class: "volume-section" }, [
    el("div", { class: "volume-part-head" }, [
      el("span", { class: "volume-part-label", text: label }),
      el("span", { class: "volume-part-total", text: `${partVolume.total}세트` }),
    ]),
    el(
      "div",
      { class: "volume-tag-list" },
      tags.map((tag) =>
        el("div", { class: "volume-tag-row" }, [
          el("span", { class: "volume-tag-name", text: tag }),
          el("span", { class: "volume-tag-value", text: `${partVolume.tags[tag] ?? 0}세트` }),
        ])
      )
    ),
  ]);
}

function buildCoreColumn(partVolume) {
  return el("div", { class: "volume-core-col" }, [
    el("span", { class: "volume-part-label", text: "코어" }),
    el("span", { class: "volume-part-total", text: `${partVolume.total}세트` }),
  ]);
}

function buildVolumeCard() {
  const volume = state.getWeeklyVolume();
  return el("div", { class: "volume-card" }, [
    el("div", { class: "volume-card-title", text: "주간 예상 볼륨" }),
    el("div", { class: "volume-card-grid" }, [
      buildBodyPartSection("상체", volume["상체"], secondaryTagsFor("상체")),
      buildBodyPartSection("하체", volume["하체"], secondaryTagsFor("하체")),
      buildCoreColumn(volume["코어"]),
    ]),
  ]);
}

export function renderRoutineList(root) {
  // v1.1: 요일을 월~일 순서로 표시합니다.
  const rows = DAYS_DISPLAY_ORDER.map((d) => {
    const version = state.getDefaultVersion(d.key);
    const summary = state.getRoutineDaySummary(d.key); // v2.7.0: 개수 + 메인/보조 세트 + 하이라이트 태그
    return el("button", { class: "list-row", style: { width: "100%", border: "1px solid var(--color-border)", background: "var(--color-surface)" }, onclick: () => navigate(`#/routine/${d.key}`) }, [
      el("div", {}, [
        el("div", { class: "name", text: `${d.label}요일 · ${version.title}` }),
        el("div", { class: "meta", text: buildMetaText(summary) }),
      ]),
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
