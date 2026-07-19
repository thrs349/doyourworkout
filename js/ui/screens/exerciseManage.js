// screens/exerciseManage.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import * as state from "../../core/state.js";
import { formatExerciseMetaChips, GAIN_METHODS, BODY_PARTS, secondaryTagsFor } from "../../core/models.js";
import { openModal } from "../components/modal.js";
import { openCueNoteEditor } from "../components/cueNoteEditor.js";

// 이름순 정렬: 자연정렬(숫자/이모지 가공) 없이 일반 문자열 비교만 사용합니다.
// ex.name 원본을 그대로 비교하므로(이모지 포함) 별도 가공이 없습니다.
function nameCompare(a, b) {
  return a.name.localeCompare(b.name, "ko");
}

const GAIN_METHOD_ORDER = [GAIN_METHODS.MACHINE, GAIN_METHODS.FREEWEIGHT, GAIN_METHODS.HIGH_REP, GAIN_METHODS.BODYWEIGHT];
// v2.6.0: 정렬 버튼(이름순/최근사용순)을 제거했습니다. 목록은 항상 "운동 유형 순(머신 → 프리웨이트 →
// 고반복 → 맨몸) → 각 유형 내부 가나다순"으로 고정 정렬합니다(유형 필터를 적용해도 동일한 정렬 기준 유지).
function methodCompare(a, b) {
  const diff = GAIN_METHOD_ORDER.indexOf(a.gainMethod) - GAIN_METHOD_ORDER.indexOf(b.gainMethod);
  return diff !== 0 ? diff : nameCompare(a, b);
}
const GAIN_METHOD_LABELS = { machine: "머신", freeweight: "프리웨이트", high_rep: "고반복", bodyweight: "맨몸" };

// v2.6.1: 카드 메타 Chip 행(운동 유형 → 부위+보조태그 → 편측 → 반복수×세트수). ExercisePicker와 동일 렌더링.
function buildMetaChipsRow(ex) {
  return el(
    "div",
    { class: "ex-meta-chips" },
    formatExerciseMetaChips(ex).map((c) => el("span", { class: `ex-chip ex-chip-${c.kind}`, text: c.text }))
  );
}

export function renderExerciseManage(root) {
  let tab = "active"; // "active" | "inactive"
  let editMode = false; // 활성 탭 전용 선택 모드
  // 수정 모드에서 "비활성으로 전환 예정"으로 표시된 종목 id 집합.
  // 스위치는 항상 "현재/저장 시 반영될 active 상태"를 그대로 보여줍니다(on = 활성 유지, off = 비활성 전환 예정).
  let deactivateIds = new Set();
  let searchQuery = "";
  // v2.6.0: 정렬 버튼(이름순/최근사용순) 대신 유형/부위 탐색 필터로 대체합니다.
  // 필터 상태는 화면 진입 시(렌더 함수 재호출 시) 항상 초기 상태에서 시작합니다.
  let filterMode = null; // null | "type" | "bodyPart" — 운동 유형/운동 부위는 동시에 사용하지 않습니다(상호 배타).
  let typeFilter = null; // GAIN_METHODS 값 중 하나
  let bodyPartFilter = null; // BODY_PARTS 값 중 하나
  let tagFilter = new Set(); // 선택된 부위의 보조 태그 중 복수 선택(OR) - v2.6.3: 부위별 태그 목록으로 분리

  function matchesSearch(ex) {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return ex.name.toLowerCase().includes(q);
  }
  function matchesType(ex) {
    return !typeFilter || ex.gainMethod === typeFilter;
  }
  function matchesBodyPart(ex) {
    return !bodyPartFilter || ex.primaryBodyPart === bodyPartFilter;
  }
  function matchesTags(ex) {
    if (tagFilter.size === 0) return true;
    return (ex.secondaryTags || []).some((t) => tagFilter.has(t));
  }
  function matchesFilters(ex) {
    return matchesSearch(ex) && matchesType(ex) && matchesBodyPart(ex) && matchesTags(ex);
  }

  function activeList() {
    return state.getData().exercises.filter((e) => e.active !== false && matchesFilters(e)).sort(methodCompare);
  }
  function inactiveList() {
    return state.getData().exercises.filter((e) => e.active === false && matchesFilters(e)).sort(methodCompare);
  }

  /* ---------------- 활성 탭 ---------------- */

  function activeRow(ex) {
    const exState = state.getExerciseState(ex.id);
    const willDeactivate = deactivateIds.has(ex.id);
    // v2.1.0: 큐노트(💡) 버튼은 editMode 여부와 무관하게 항상 노출합니다(숨김 처리하지 않음).
    // v2.4.3: 종목수정/미설정중량 아이콘과 디자인을 통일하기 위해 .icon-btn 대신 .icon-chip 사용(클릭 동작은 그대로).
    const cueBtn = el("button", {
      class: "icon-chip",
      text: "💡",
      onclick: () => openCueNoteEditor(ex.id),
    });
    // v2.4.3: 중량 미설정(currentWeight === null) 종목에 표시하는 읽기 전용 아이콘. 클릭 핸들러가 없는
    // <span>이라 상태를 전혀 바꾸지 않습니다(순수 표시용). bodyweight는 중량 개념 자체가 없어 대상에서 제외.
    // 큐노트/종목수정과 디자인 통일을 위해 .icon-chip.readonly 사용(표시 전용 특성은 동일하게 유지).
    const missingWeightIcon =
      ex.gainMethod !== "bodyweight" && exState.currentWeight == null
        ? el("span", { class: "icon-chip readonly", text: "⚠️", title: "중량 미설정" })
        : null;
    const rightControls = editMode
      ? [
          missingWeightIcon,
          cueBtn,
          el("button", {
            class: `switch${willDeactivate ? "" : " on"}`,
            title: willDeactivate ? "비활성으로 전환 예정" : "활성 유지",
            onclick: () => {
              if (willDeactivate) deactivateIds.delete(ex.id);
              else deactivateIds.add(ex.id);
              rerenderList();
            },
          }),
        ]
      : [
          missingWeightIcon,
          cueBtn,
          el("button", {
            class: "icon-chip",
            text: "✏️",
            onclick: () => navigate(`#/exercise-edit/${ex.id}`),
          }),
        ];

    // v2.6.1: 부위/편측/반복수×세트수를 Chip으로 분리 표시(카드 세로 길이 증가 최소화, 줄바꿈은 허용).
    // v2.6.5: 실기기 테스트 반영 - 기존에는 list-row 자체가 (이름+칩 2줄짜리 왼쪽 블록) vs (버튼 영역)을
    // 카드 전체 높이 기준으로 세로 중앙 정렬해서, 버튼이 이름 텍스트와 어긋나 보였습니다. list-row를
    // 세로로 쌓는 컨테이너로 바꾸고, "이름+버튼"을 별도의 1행 flex(자체적으로 Y축 중앙 정렬)로 분리해
    // 2행(칩)과 무관하게 1행 내부에서만 정렬이 맞도록 구조를 변경했습니다.
    return el("div", { class: "list-row", style: { flexDirection: "column", alignItems: "stretch" } }, [
      el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, [
        el("span", { class: "name", text: ex.name }),
        el("div", { style: { display: "flex", alignItems: "center", gap: "10px" } }, rightControls),
      ]),
      buildMetaChipsRow(ex),
    ]);
  }

  /* ---------------- 비활성 탭 ---------------- */
  // 비활성 탭은 "복구(재활성화)" 또는 "제거(완전 삭제)" 목적만 제공합니다(종목 수정 진입 없음).

  function inactiveRow(ex) {
    // v2.6.5: activeRow와 동일하게 "이름+버튼" 1행을 별도 flex로 분리해 Y축 정렬을 맞춥니다.
    return el("div", { class: "list-row", style: { flexDirection: "column", alignItems: "stretch" } }, [
      el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, [
        el("span", {
          class: "name",
          text: ex.name,
          style: { opacity: 0.6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: "1 1 auto", minWidth: "0" },
        }),
        el("div", { class: "btn-row-h compact", style: { flexShrink: 0 } }, [
          // v2.1.0: 비활성 카드에서도 큐노트(💡) 버튼은 동일하게 노출하되, 기존 비활성 카드 스타일(회색 처리)에
          // 맞춰 opacity만 낮춰 표시합니다. 카드 전체 스타일(취소선 등)에는 영향을 주지 않습니다.
          el("button", {
            class: "icon-chip",
            text: "💡",
            style: { opacity: 0.6 },
            onclick: () => openCueNoteEditor(ex.id),
          }),
          el("button", {
            class: "btn btn-ghost btn-compact",
            text: "재활성화",
            onclick: () => {
              state.setExerciseActive(ex.id, true);
              rerenderList();
            },
          }),
          el("button", {
            class: "btn btn-danger-mute btn-compact",
            text: "완전 삭제",
            onclick: () => confirmDelete(ex),
          }),
        ]),
      ]),
      el("div", { style: { opacity: 0.6 } }, [buildMetaChipsRow(ex)]),
    ]);
  }

  function confirmDelete(ex) {
    const count = state.getExerciseRecordCount(ex.id);
    // 문장 단위로 줄을 분리해, 화면 폭에 따라 단어 중간에서 자동 줄바꿈되는 것을 방지합니다.
    const lines =
      count > 0
        ? [`운동 기록 ${count}개가 있는 운동입니다.`, "완전 삭제 시 복구할 수 없습니다."]
        : ["완전 삭제 시 복구할 수 없습니다."];

    const content = el("div", { class: "duration-modal" }, [
      el("div", { class: "duration-title", text: `"${ex.name}" 완전 삭제` }),
      el(
        "div",
        { style: { margin: "0 0 16px" } },
        lines.map((line) => el("p", { class: "detail", style: { textAlign: "center", margin: "0" }, text: line }))
      ),
      el("div", { class: "btn-row-h" }, [
        el("button", {
          class: "btn btn-danger",
          text: "삭제",
          onclick: () => {
            state.deleteExercise(ex.id);
            close();
            rerenderList();
          },
        }),
        el("button", { class: "btn btn-ghost", text: "취소", onclick: () => close() }),
      ]),
    ]);
    const close = openModal(content, { dismissible: true });
  }

  /* ---------------- 탭 헤더 ---------------- */

  const tabActiveOpt = el("div", { class: "type-opt", text: "활성", onclick: () => switchTab("active") });
  const tabInactiveOpt = el("div", { class: "type-opt", text: "비활성", onclick: () => switchTab("inactive") });

  function refreshTabUI() {
    tabActiveOpt.classList.toggle("selected", tab === "active");
    tabInactiveOpt.classList.toggle("selected", tab === "inactive");
  }

  function switchTab(key) {
    if (tab === key) return;
    tab = key;
    editMode = false;
    deactivateIds = new Set();
    searchQuery = ""; // 2-5: 탭 전환 시 검색어 초기화
    searchInput.value = "";
    resetFilters(); // v2.6.0: 탭 전환 시에도 항상 초기 탐색 상태로 되돌립니다.
    refreshTabUI();
    refreshEditBtn();
    refreshFilterUI();
    rerenderList();
  }

  /* ---------------- 검색 (2-5) ---------------- */

  const searchInput = el("input", {
    class: "text-input",
    type: "text",
    placeholder: "운동명 검색",
    value: searchQuery,
    oninput: (e) => {
      searchQuery = e.target.value;
      rerenderList();
    },
  });

  /* ---------------- v2.6.0: 운동 유형/부위 탐색 필터 ---------------- */

  // 1행: "운동 유형" / "운동 부위" 카테고리 선택(1:1, 상호 배타)
  const modeOpts = {
    type: el("div", { class: "type-opt", text: "운동 유형", onclick: () => selectMode("type") }),
    bodyPart: el("div", { class: "type-opt", text: "운동 부위", onclick: () => selectMode("bodyPart") }),
  };
  const modeRow = el("div", { class: "type-toggle", style: { marginBottom: "8px" } }, [modeOpts.type, modeOpts.bodyPart]);

  // 2행: 운동 유형 상세(머신/프리웨이트/고반복/맨몸)
  const typeOptKeys = [GAIN_METHODS.MACHINE, GAIN_METHODS.FREEWEIGHT, GAIN_METHODS.HIGH_REP, GAIN_METHODS.BODYWEIGHT];
  const typeOpts = Object.fromEntries(
    typeOptKeys.map((key) => [key, el("div", { class: "type-opt", text: GAIN_METHOD_LABELS[key], onclick: () => selectTypeFilter(key) })])
  );
  const typeRow = el("div", { class: "type-toggle", style: { marginBottom: "8px" } }, typeOptKeys.map((k) => typeOpts[k]));

  // 2행(대체): 운동 부위 상세(상체/하체/코어)
  const bodyPartOpts = Object.fromEntries(
    BODY_PARTS.map((part) => [part, el("div", { class: "type-opt", text: part, onclick: () => selectBodyPartFilter(part) })])
  );
  const bodyPartRow = el("div", { class: "type-toggle", style: { marginBottom: "8px" } }, BODY_PARTS.map((p) => bodyPartOpts[p]));

  // 3행: 보조 태그(운동 부위 선택 시, 해당 부위의 태그 목록으로 매번 다시 그림), 복수 선택 OR
  let tagOpts = {};
  const tagRow = el("div", { class: "type-toggle", style: { marginBottom: "8px" } });

  function rebuildTagRow() {
    const tags = secondaryTagsFor(bodyPartFilter);
    tagOpts = Object.fromEntries(
      tags.map((tag) => [tag, el("div", { class: "type-opt", text: tag, onclick: () => toggleTagFilter(tag) })])
    );
    tagRow.replaceChildren(...tags.map((t) => tagOpts[t]));
  }

  function resetFilters() {
    filterMode = null;
    typeFilter = null;
    bodyPartFilter = null;
    tagFilter = new Set();
    rebuildTagRow();
  }

  function refreshFilterUI() {
    modeOpts.type.classList.toggle("selected", filterMode === "type");
    modeOpts.bodyPart.classList.toggle("selected", filterMode === "bodyPart");
    typeOptKeys.forEach((k) => typeOpts[k].classList.toggle("selected", typeFilter === k));
    BODY_PARTS.forEach((p) => bodyPartOpts[p].classList.toggle("selected", bodyPartFilter === p));
    Object.keys(tagOpts).forEach((t) => tagOpts[t].classList.toggle("selected", tagFilter.has(t)));

    typeRow.style.display = filterMode === "type" ? "flex" : "none";
    bodyPartRow.style.display = filterMode === "bodyPart" ? "flex" : "none";
    tagRow.style.display = filterMode === "bodyPart" && secondaryTagsFor(bodyPartFilter).length > 0 ? "flex" : "none";
  }

  // 운동 유형/운동 부위는 동시에 사용하지 않습니다 — 한쪽을 선택하면 다른 쪽 선택은 자동 해제됩니다.
  function selectMode(mode) {
    filterMode = filterMode === mode ? null : mode;
    typeFilter = null;
    bodyPartFilter = null;
    tagFilter = new Set();
    rebuildTagRow();
    refreshFilterUI();
    rerenderList();
  }
  function selectTypeFilter(key) {
    typeFilter = typeFilter === key ? null : key;
    refreshFilterUI();
    rerenderList();
  }
  function selectBodyPartFilter(part) {
    bodyPartFilter = bodyPartFilter === part ? null : part;
    // 부위가 바뀌면(또는 선택 해제되면) 보조 태그 선택값을 초기화합니다(부위마다 태그 목록 자체가 다르므로).
    tagFilter = new Set();
    rebuildTagRow();
    refreshFilterUI();
    rerenderList();
  }
  function toggleTagFilter(tag) {
    if (tagFilter.has(tag)) tagFilter.delete(tag);
    else tagFilter.add(tag);
    refreshFilterUI();
    rerenderList();
  }

  /* ---------------- 상단 "수정/저장" 버튼 (활성 탭 전용, 항상 topbar에 고정) ---------------- */

  const editToggleBtn = el("button", {
    class: "icon-btn",
    text: "수정",
    style: { width: "auto", padding: "0 12px" },
    onclick: () => {
      if (tab !== "active") return;
      if (editMode) {
        // 저장: 비활성 전환 예정으로 표시된 종목만 일괄 비활성화 (기존 setExerciseActive 재사용)
        deactivateIds.forEach((id) => state.setExerciseActive(id, false));
        editMode = false;
        deactivateIds = new Set();
      } else {
        editMode = true;
      }
      refreshEditBtn();
      rerenderList();
    },
  });

  function refreshEditBtn() {
    // v2.4.3: display:none이면 topbar(justify-content:space-between)의 우측 슬롯이 사라져 타이틀이
    // 좌측으로 쏠려 보였습니다. visibility:hidden은 레이아웃 공간은 유지한 채 시각적으로만 숨겨서
    // 활성 탭과 동일하게 타이틀이 중앙 정렬됩니다. 클릭/포커스도 함께 막히므로 버튼 기능도 비활성화됩니다.
    editToggleBtn.style.display = "flex";
    editToggleBtn.style.visibility = tab === "active" ? "visible" : "hidden";
    editToggleBtn.textContent = editMode ? "저장" : "수정";
  }

  /* ---------------- 목록 렌더 ---------------- */

  function buildList() {
    const list = tab === "active" ? activeList() : inactiveList();
    const rowFn = tab === "active" ? activeRow : inactiveRow;
    const rows = list.length
      ? list.map(rowFn)
      : [el("div", { class: "empty-routine", text: searchQuery.trim() ? "검색 결과가 없습니다." : tab === "active" ? "활성화된 운동이 없습니다." : "비활성화된 운동이 없습니다." })];
    return el("div", { id: "exercise-manage-list" }, rows);
  }

  function rerenderList() {
    const listEl = document.getElementById("exercise-manage-list");
    listEl.replaceWith(buildList());
  }

  refreshTabUI();
  rebuildTagRow();
  refreshFilterUI();

  const screen = el("div", { id: "exercise-manage-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("button", { class: "icon-btn", text: "←", onclick: () => history.back() }),
      el("div", { class: "title", text: "운동 관리" }),
      editToggleBtn,
    ]),
    el("div", { class: "type-toggle", style: { marginBottom: "12px" } }, [tabActiveOpt, tabInactiveOpt]),
    el("div", { class: "field-group", style: { marginBottom: "6px" } }, [searchInput]), // v2.6.6: 검색창-필터 간격 축소(16px->6px)
    modeRow,
    typeRow,
    bodyPartRow,
    tagRow,
    el("div", {
      class: "helper-text",
      text: "비활성화한 운동은 루틴/오늘의 운동에서 숨겨지지만 기존 기록과 그래프는 그대로 남습니다. 완전 삭제는 비활성 탭에서만 가능합니다.",
    }),
    el("div", { class: "table-area" }, [buildList()]),
    el("div", { class: "bottom-fixed" }, [
      el("button", { class: "btn btn-primary", text: "+ 새 운동 만들기", onclick: () => navigate("#/exercise-form") }),
    ]),
  ]);

  refreshEditBtn();
  mount(root, screen);
}
