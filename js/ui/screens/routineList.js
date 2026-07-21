// screens/routineList.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import { renderBottomNav } from "../components/bottomNav.js";
import * as state from "../../core/state.js";
import { DAYS_DISPLAY_ORDER, secondaryTagsFor } from "../../core/models.js";

// v2.7.0 UI 개선: "5개 운동(메인 9세트, 보조 8세트)" - 괄호 앞 공백 제거(사용자 테스트 피드백 반영).
function buildMetaText(summary) {
  if (!summary.count) return "운동 없음";
  return `${summary.count}개 운동(메인 ${summary.mainSets}세트, 보조 ${summary.assistSets}세트)`;
}

// v2.7.4: Weekly Effective Volume Target(MEV/MAV) 고정 기준표. 상태 판정은 volume.js가 이미 계산해 둔
// 숫자(state.getWeeklyVolume() 결과)를 "읽기만" 해서 색상만 매기는 표시 전용 로직입니다 - Effective Sets
// 계산 자체에는 관여하지 않습니다(volume.js 미수정, 새 helper 파일도 만들지 않고 이 파일 안에만 둡니다).
const VOLUME_TARGETS = {
  상체: { mev: 45, mavLow: 55, mavHigh: 70 },
  하체: { mev: 30, mavLow: 38, mavHigh: 50 },
  코어: { mev: 6, mavLow: 8, mavHigh: 12, isCore: true },
  가슴: { mev: 8, mavLow: 12, mavHigh: 16 },
  등: { mev: 10, mavLow: 14, mavHigh: 18 },
  어깨: { mev: 8, mavLow: 12, mavHigh: 16 },
  팔: { mev: 8, mavLow: 10, mavHigh: 14 },
  대퇴사두: { mev: 8, mavLow: 12, mavHigh: 16 },
  둔근: { mev: 10, mavLow: 14, mavHigh: 18 },
  햄스트링: { mev: 6, mavLow: 10, mavHigh: 14 },
};

// 일반 부위: MEV 미만 🔴 / MEV~MAV하단 미만 🟡 / MAV하단~MAV상단 🟢 / MAV상단 초과 🔴
// 코어: 위와 동일하되 MAV상단 초과가 🟡(코어는 초과해도 크게 페널티를 주지 않는 기준).
function calcVolumeStatus(label, value) {
  const target = VOLUME_TARGETS[label];
  if (!target) return ""; // 정의되지 않은 라벨은 방어적으로 상태 표시를 비웁니다(회귀 방지).
  if (value < target.mev) return "🔴";
  if (value < target.mavLow) return "🟡";
  if (value <= target.mavHigh) return "🟢";
  return target.isCore ? "🟡" : "🔴";
}

// v2.7.5: 상/하체 밸런스(상체·하체·코어 Primary total)를 별도 좌측 컬럼이 아니라 헤더 행에 "라벨 + 3개 값
// (세트+상태)"으로 한 줄 표시합니다. 볼드는 쓰지 않고 라벨만 색상으로 강조합니다(font-weight 그대로 normal).
// v2.7.6: 이 헤더 구조는 "절대 변경 금지"로 요청되어 그대로 유지합니다(내용 영역만 변경).
function buildBalanceHeader(rows) {
  const children = [el("span", { class: "volume-balance-label", text: "상/하체 밸런스" })];
  rows.forEach(({ label, value, status }) => {
    children.push(
      el("span", { class: "volume-balance-item" }, [
        el("span", { class: "volume-balance-item-label", text: `${label} ` }),
        el("span", { class: "volume-balance-item-value", text: `${value}세트 ` }),
        el("span", { class: "volume-balance-item-status", text: status }),
      ])
    );
  });
  return el("div", { class: "volume-card-headers" }, children);
}

// v2.7.7: 상체/하체 세부 부위를 "가로 나열"(flex, 라벨 길이만큼 다음 항목이 밀림) 대신 4행 Grid로 재구성합니다.
// 각 항목(라벨/세트/상태)을 grid-column/grid-row로 명시적으로 배치해, 상태 아이콘이 항상 같은 열(4번째)에
// 정렬되도록 합니다(행마다 라벨 길이가 달라도 흔들리지 않음 - 기존 flex 방식의 한계를 구조적으로 해결).
// rows가 4개보다 적으면(하체는 3개) 남는 행은 그냥 비워둡니다(자동으로 공란 처리, 별도 코드 불필요).
function buildDetailColumns(label, rows, colOffset) {
  const cells = [
    el("div", {
      class: "volume-grid-title",
      style: { gridColumn: String(colOffset), gridRow: "1" },
      text: label,
    }),
  ];
  rows.forEach(({ label: rowLabel, value, status }, i) => {
    const gridRow = String(i + 1);
    cells.push(el("span", { class: "volume-grid-label", style: { gridColumn: String(colOffset + 1), gridRow }, text: rowLabel }));
    cells.push(el("span", { class: "volume-grid-value", style: { gridColumn: String(colOffset + 2), gridRow }, text: `${value}세트` }));
    cells.push(el("span", { class: "volume-grid-status", style: { gridColumn: String(colOffset + 3), gridRow }, text: status }));
  });
  return cells;
}

function buildDetailGrid(upperLabel, upperRows, lowerLabel, lowerRows) {
  return el("div", { class: "volume-detail-grid" }, [
    ...buildDetailColumns(upperLabel, upperRows, 1), // 열1~4: 상체 밸런스
    ...buildDetailColumns(lowerLabel, lowerRows, 5), // 열5~8: 하체 밸런스
  ]);
}

function buildVolumeCard() {
  const volume = state.getWeeklyVolume();
  // 상/하체 밸런스(상체·하체·코어 Primary total) - 헤더 행에 표시(buildBalanceHeader, 변경 없음).
  const primaryRows = [
    { label: "상체", value: volume["상체"].total },
    { label: "하체", value: volume["하체"].total },
    { label: "코어", value: volume["코어"].total },
  ];
  // 내용 영역: 상체 세부(1행 라벨 + 1행 가로나열) / 하체 세부(1행 라벨 + 1행 가로나열).
  const upperRows = secondaryTagsFor("상체").map((tag) => ({ label: tag, value: volume["상체"].tags[tag] ?? 0 }));
  const lowerRows = secondaryTagsFor("하체").map((tag) => ({ label: tag, value: volume["하체"].tags[tag] ?? 0 }));
  [...primaryRows, ...upperRows, ...lowerRows].forEach((row) => {
    row.status = calcVolumeStatus(row.label, row.value);
  });

  return el("div", { class: "volume-card" }, [
    buildBalanceHeader(primaryRows),
    buildDetailGrid("상체 밸런스", upperRows, "하체 밸런스", lowerRows),
  ]);
}

export function renderRoutineList(root) {
  // v1.1: 요일을 월~일 순서로 표시합니다.
  const rows = DAYS_DISPLAY_ORDER.map((d) => {
    const version = state.getDefaultVersion(d.key);
    const summary = state.getRoutineDaySummary(d.key); // v2.7.2: 개수 + 메인/보조 세트 + Primary별 하이라이트 그룹(최대 3개)
    // v2.7.2 UI 개선: 3행 -> 2행 구조. 1행 = 운동명 + Highlight Box(같은 행), 2행 = 메타 텍스트만.
    const titleRow = el("div", { class: "list-row-title-line" }, [
      el("span", { class: "name", text: `${d.label}요일 · ${version.title}` }),
      summary.highlightGroups.length
        ? el(
            "span",
            { class: "ex-meta-chips" },
            summary.highlightGroups.map((group) => el("span", { class: "ex-chip ex-chip-tag", text: group }))
          )
        : null,
    ]);
    return el("button", { class: "list-row", style: { width: "100%", border: "1px solid var(--color-border)", background: "var(--color-surface)" }, onclick: () => navigate(`#/routine/${d.key}`) }, [
      el("div", { style: { minWidth: "0", flex: "1" } }, [titleRow, el("div", { class: "meta", text: buildMetaText(summary) })]),
      el("span", { class: "arrow", text: "›" }),
    ]);
  });

  const screen = el("div", { id: "routine-list-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("div", { class: "title", text: "루틴 설정" }),
      el("button", { class: "icon-btn", text: "운동 관리", style: { width: "auto", padding: "0 12px" }, onclick: () => navigate("#/exercise-manage") }),
    ]),
    el("div", { class: "table-area" }, rows),
    // v2.7.5: Weekly Volume Card를 "마지막(일요일) 루틴 카드 하단(A)"과 "하단 탭바 상단(B)" 사이에 남는
    // 세로 공간의 정중앙에 배치합니다. margin으로 어림잡지 않고, 카드 위/아래에 동일한 flex:1 스페이서를
    // 둬서 두 스페이서가 항상 같은 높이로 남는 공간을 정확히 반씩 나눠 갖도록 했습니다(레이아웃 자체가
    // 중앙 정렬을 보장 - 콘텐츠 양이 바뀌어도 항상 A/B 사이 정중앙 유지).
    el("div", { class: "volume-card-spacer" }),
    buildVolumeCard(),
    el("div", { class: "volume-card-spacer" }),
    renderBottomNav("routine"),
  ]);
  mount(root, screen);
}
