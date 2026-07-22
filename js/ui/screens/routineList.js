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

// v2.8.0: Weekly Volume Dashboard 목적 변경 - "MEV/MAV로 부족/적정/과다 판정"에서 "현재 루틴의 운동량과
// 부위별 자극 분포 확인"으로. 기존 MEV/MAV 판정 코드(VOLUME_TARGETS/calcVolumeStatus)는 이 파일에서
// 완전히 제거했습니다(다른 화면에서 쓰지 않는 걸 확인함 - 요일 카드 메타 텍스트는 별도의
// calcDayRoleSetSummary를 씀). volume.js/state.js는 전혀 수정하지 않고, 이미 공개되어 있던
// state.getRoutineExercisesForEdit(dayKey)만 사용해 아래 두 계산을 이 파일 안에서 새로 만듭니다.

// 헤더용: 상위 분류(상체/하체/코어) 단순 세트 합산. 주동근/보조근 가중치를 적용하지 않는 "순수 운동량".
function calcPrimarySetSum(bodyPart) {
  let sum = 0;
  DAYS_DISPLAY_ORDER.forEach((d) => {
    state.getRoutineExercisesForEdit(d.key).forEach((ex) => {
      if (ex && ex.primaryBodyPart === bodyPart) sum += ex.baseSets || 0;
    });
  });
  return sum;
}

// 내용 영역용: Secondary Tag별 raw 세트 합(표시용 "OO세트")과, 주동근(선택 순서 0번째, ×1.0)/보조근
// (1~2번째, ×0.5) 가중치를 적용한 기여도 비율(%). 태그 개수로 나누는 균등분배는 하지 않고, 종목 하나가
// 여러 태그를 가지면 각 태그에 가중치를 그대로 반영합니다(요청하신 계산식 그대로).
function calcTagRowsForBodyPart(bodyPart) {
  const rawSets = {};
  const contribution = {};
  secondaryTagsFor(bodyPart).forEach((tag) => {
    rawSets[tag] = 0;
    contribution[tag] = 0;
  });
  DAYS_DISPLAY_ORDER.forEach((d) => {
    state.getRoutineExercisesForEdit(d.key).forEach((ex) => {
      if (!ex || ex.primaryBodyPart !== bodyPart) return;
      const sets = ex.baseSets || 0;
      (ex.secondaryTags || []).forEach((tag, idx) => {
        if (!(tag in rawSets)) return;
        rawSets[tag] += sets;
        contribution[tag] += sets * (idx === 0 ? 1.0 : 0.5); // 0번째=주동근(①), 1~2번째=보조근(②)
      });
    });
  });
  const total = Object.values(contribution).reduce((sum, v) => sum + v, 0);
  // "round 적용, 표시 합계가 100%가 되도록" -> 각 태그별로 독립적으로 Math.round합니다. (참고: 이는
  // 대부분의 경우 합계를 100%에 가깝게 만들지만, 나머지값이 특정 방향으로 몰리는 드문 경우엔 99%/101%처럼
  // 정확히 100이 안 될 수 있습니다 - 이는 "독립 반올림" 방식의 수학적 특성이며, 예시(29+36+21+14=100)에서는
  // 정확히 100%로 맞아떨어집니다.)
  return secondaryTagsFor(bodyPart).map((tag) => ({
    label: tag,
    value: rawSets[tag],
    percent: total > 0 ? Math.round((contribution[tag] / total) * 100) : 0,
  }));
}

// v2.7.5: 상/하체 밸런스(상체·하체·코어 Primary total)를 별도 좌측 컬럼이 아니라 헤더 행에 "라벨 + 3개 값"
// 으로 한 줄 표시합니다. 볼드는 쓰지 않고 라벨만 색상으로 강조합니다(font-weight 그대로 normal).
// v2.7.6~v2.8.0: 이 헤더 구조는 "절대 변경 금지"로 요청되어 그대로 유지합니다(내용/데이터 소스만 변경).
// v2.8.0: 값은 이제 MEV/MAV 가중 Effective Sets가 아니라 순수 세트 합산(calcPrimarySetSum)입니다.
// 상태 아이콘은 제거했지만, 향후 확장을 위해 아이콘이 들어가던 자리 자체는 마크업에서 비워둡니다.
function buildBalanceHeader(rows) {
  const children = [el("span", { class: "volume-balance-label", text: "상/하체 밸런스" })];
  rows.forEach(({ label, value }) => {
    children.push(
      el("span", { class: "volume-balance-item" }, [
        el("span", { class: "volume-balance-item-label", text: `${label} ` }),
        el("span", { class: "volume-balance-item-value", text: `${value}세트` }),
      ])
    );
  });
  return el("div", { class: "volume-card-headers" }, children);
}

// v2.7.7: 상체/하체 세부 부위를 4행 Grid로 배치합니다. 각 항목(라벨/세트/비율)을 grid-column/grid-row로
// 명시적으로 배치해, 4번째 열이 항상 같은 x좌표에 정렬되도록 합니다(행마다 라벨 길이가 달라도 흔들리지 않음).
// v2.8.0: 4번째 값이 상태 아이콘(🟢🟡🔴)에서 기여도 비율(%)로 바뀌었습니다.
function buildDetailColumns(label, rows, colOffset) {
  const cells = [
    el("div", {
      class: "volume-grid-title",
      style: { gridColumn: String(colOffset), gridRow: "1" },
      text: label,
    }),
  ];
  rows.forEach(({ label: rowLabel, value, percent }, i) => {
    const gridRow = String(i + 1);
    cells.push(el("span", { class: "volume-grid-label", style: { gridColumn: String(colOffset + 1), gridRow }, text: rowLabel }));
    cells.push(el("span", { class: "volume-grid-value", style: { gridColumn: String(colOffset + 2), gridRow }, text: `${value}세트` }));
    cells.push(el("span", { class: "volume-grid-percent", style: { gridColumn: String(colOffset + 3), gridRow }, text: `${percent}%` }));
  });
  return cells;
}

function buildDetailGrid(upperLabel, upperRows, lowerLabel, lowerRows) {
  return el("div", { class: "volume-detail-grid" }, [
    ...buildDetailColumns(upperLabel, upperRows, 1), // 열1~4: 상체 자극
    ...buildDetailColumns(lowerLabel, lowerRows, 5), // 열5~8: 하체 자극
  ]);
}

function buildVolumeCard() {
  // 상/하체 밸런스(상체·하체·코어 순수 세트 합산) - 헤더 행에 표시.
  const primaryRows = [
    { label: "상체", value: calcPrimarySetSum("상체") },
    { label: "하체", value: calcPrimarySetSum("하체") },
    { label: "코어", value: calcPrimarySetSum("코어") },
  ];
  // 내용 영역: 상체 세부(라벨+세트+기여도%) / 하체 세부(동일).
  const upperRows = calcTagRowsForBodyPart("상체");
  const lowerRows = calcTagRowsForBodyPart("하체");

  return el("div", { class: "volume-card" }, [
    buildBalanceHeader(primaryRows),
    buildDetailGrid("상체 자극", upperRows, "하체 자극", lowerRows),
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
    // v2.7.8: 정중앙 배치(flex 스페이서)를 폐기하고 고정 여백으로 전환합니다. 스페이서 방식은 화면의
    // "남는 공간"을 계산해서 나누는 구조라, 새로고침 직후처럼 viewport/폰트 로딩 타이밍이 아직 안정되지
    // 않은 시점에는 계산 결과가 흔들려 카드 위치가 매번 달라지고 스크롤까지 발생하는 근본적인 문제가
    // 있었습니다(100vh -> 100dvh로도 완전히 해결되지 않음을 실기기에서 재확인). volume-card 자체에 고정
    // margin을 줘서(.volume-card CSS 참고) 외부 요인과 무관하게 항상 동일한 위치를 보장합니다.
    buildVolumeCard(),
    renderBottomNav("routine"),
  ]);
  mount(root, screen);
}
