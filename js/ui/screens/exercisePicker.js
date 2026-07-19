// screens/exercisePicker.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import * as state from "../../core/state.js";
import { formatExerciseMetaChips, GAIN_METHODS, BODY_PARTS, secondaryTagsFor } from "../../core/models.js";

// v2.4.7: 종목 선택 화면 전용 표시 순서. 실제 데이터(등록 순서)나 다른 화면의 정렬에는 전혀 영향을 주지 않습니다.
// v2.6.0: 기존 그룹 헤더(section-label) + 유형별 그룹 렌더링을 제거했습니다. 대신 "운동 유형 버튼을 선택하면
// 해당 유형만 표시 → 표시되는 목록은 각 유형 내부 가나다순"으로 동작합니다(운동 유형을 선택하지 않은
// 기본 상태에서도 이 순서 자체는 항상 적용되어 있어, 유형별로 몰아보기만 사라지고 정렬 기준은 그대로입니다).
const PICKER_GAIN_METHOD_ORDER = [GAIN_METHODS.MACHINE, GAIN_METHODS.FREEWEIGHT, GAIN_METHODS.HIGH_REP, GAIN_METHODS.BODYWEIGHT];
const GAIN_METHOD_LABELS = { machine: "머신", freeweight: "프리웨이트", high_rep: "고반복", bodyweight: "맨몸" };

function methodCompare(a, b) {
  const diff = PICKER_GAIN_METHOD_ORDER.indexOf(a.gainMethod) - PICKER_GAIN_METHOD_ORDER.indexOf(b.gainMethod);
  return diff !== 0 ? diff : a.name.localeCompare(b.name, "ko");
}

// v2.6.1: 카드 메타 Chip 행. ExerciseManage와 동일한 순서/스타일(운동 유형 → 부위+보조태그 → 편측 → 반복수×세트수).
function buildMetaChipsRow(ex) {
  return el(
    "div",
    { class: "ex-meta-chips" },
    formatExerciseMetaChips(ex).map((c) => el("span", { class: `ex-chip ex-chip-${c.kind}`, text: c.text }))
  );
}

export function renderExercisePicker(root, params) {
  const dayKey = params.day;
  const version = state.getDefaultVersion(dayKey);
  const inRoutine = new Set(version.items.map((it) => it.exerciseId));
  const all = state.getActiveExercises(); // 기존 그대로 사용 — 이 배열/순서 자체는 건드리지 않습니다.

  // v2.6.0: 운동 관리 화면과 동일한 탐색 필터 상태. 화면 진입 시 항상 초기 상태에서 시작합니다.
  let searchQuery = "";
  let filterMode = null; // null | "type" | "bodyPart" — 운동 유형/운동 부위는 동시에 사용하지 않습니다(상호 배타).
  let typeFilter = null;
  let bodyPartFilter = null;
  let tagFilter = new Set();

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
  function filteredList() {
    // filter()가 매번 새 배열을 만들고 그 위에서만 sort()하므로, all과 그 내부 data.exercises 원본은
    // 전혀 mutate되지 않습니다(기존 v2.4.7 방식과 동일한 안전성 유지).
    return all
      .filter((ex) => matchesSearch(ex) && matchesType(ex) && matchesBodyPart(ex) && matchesTags(ex))
      .sort(methodCompare);
  }

  function row(ex) {
    const already = inRoutine.has(ex.id);
    // v2.6.5: exerciseManage.js와 동일하게 "이름+버튼" 1행을 별도 flex로 분리해 Y축 정렬을 맞춥니다.
    return el("div", { class: "list-row", style: { flexDirection: "column", alignItems: "stretch" } }, [
      el("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between" } }, [
        el("div", { class: "name", text: ex.name }),
        el("button", {
          class: "btn btn-ghost",
          style: { width: "auto", height: "36px", padding: "0 14px", fontSize: "12.5px", flexShrink: 0 },
          text: already ? "추가됨" : "추가",
          disabled: already,
          onclick: () => {
            state.addExerciseToRoutine(dayKey, version.id, ex.id);
            navigate(`#/routine/${dayKey}`, { replace: true });
          },
        }),
      ]),
      buildMetaChipsRow(ex),
    ]);
  }

  /* ---------------- 검색 ---------------- */

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

  /* ---------------- v2.6.0: 운동 유형/부위 탐색 필터 (exerciseManage.js와 동일 구조) ---------------- */

  const modeOpts = {
    type: el("div", { class: "type-opt", text: "운동 유형", onclick: () => selectMode("type") }),
    bodyPart: el("div", { class: "type-opt", text: "운동 부위", onclick: () => selectMode("bodyPart") }),
  };
  const modeRow = el("div", { class: "type-toggle", style: { marginBottom: "8px" } }, [modeOpts.type, modeOpts.bodyPart]);

  const typeOpts = Object.fromEntries(
    PICKER_GAIN_METHOD_ORDER.map((key) => [key, el("div", { class: "type-opt", text: GAIN_METHOD_LABELS[key], onclick: () => selectTypeFilter(key) })])
  );
  const typeRow = el("div", { class: "type-toggle", style: { marginBottom: "8px" } }, PICKER_GAIN_METHOD_ORDER.map((k) => typeOpts[k]));

  const bodyPartOpts = Object.fromEntries(
    BODY_PARTS.map((part) => [part, el("div", { class: "type-opt", text: part, onclick: () => selectBodyPartFilter(part) })])
  );
  const bodyPartRow = el("div", { class: "type-toggle", style: { marginBottom: "8px" } }, BODY_PARTS.map((p) => bodyPartOpts[p]));

  let tagOpts = {};
  const tagRow = el("div", { class: "type-toggle", style: { marginBottom: "8px" } });

  function rebuildTagRow() {
    const tags = secondaryTagsFor(bodyPartFilter);
    tagOpts = Object.fromEntries(
      tags.map((tag) => [tag, el("div", { class: "type-opt", text: tag, onclick: () => toggleTagFilter(tag) })])
    );
    tagRow.replaceChildren(...tags.map((t) => tagOpts[t]));
  }

  function refreshFilterUI() {
    modeOpts.type.classList.toggle("selected", filterMode === "type");
    modeOpts.bodyPart.classList.toggle("selected", filterMode === "bodyPart");
    PICKER_GAIN_METHOD_ORDER.forEach((k) => typeOpts[k].classList.toggle("selected", typeFilter === k));
    BODY_PARTS.forEach((p) => bodyPartOpts[p].classList.toggle("selected", bodyPartFilter === p));
    Object.keys(tagOpts).forEach((t) => tagOpts[t].classList.toggle("selected", tagFilter.has(t)));

    typeRow.style.display = filterMode === "type" ? "flex" : "none";
    bodyPartRow.style.display = filterMode === "bodyPart" ? "flex" : "none";
    tagRow.style.display = filterMode === "bodyPart" && secondaryTagsFor(bodyPartFilter).length > 0 ? "flex" : "none";
  }

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

  /* ---------------- 목록 렌더 ---------------- */

  function buildList() {
    const list = filteredList();
    const emptyText = all.length === 0 ? "등록된 운동이 없습니다. 먼저 새 운동을 만들어 주세요." : "조건에 맞는 운동이 없습니다.";
    const rows = list.length ? list.map(row) : [el("div", { class: "empty-routine", text: emptyText })];
    return el("div", { id: "exercise-picker-list" }, rows);
  }

  function rerenderList() {
    const listEl = document.getElementById("exercise-picker-list");
    listEl.replaceWith(buildList());
  }

  rebuildTagRow();
  refreshFilterUI();

  const screen = el("div", { id: "exercise-picker-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("button", { class: "icon-btn", text: "←", onclick: () => history.back() }),
      el("div", { class: "title", text: "운동 선택" }),
      el("span", { style: { opacity: 0 } }, "·"),
    ]),
    el("div", { class: "field-group", style: { marginBottom: "6px" } }, [searchInput]), // v2.6.6: 검색창-필터 간격 축소(16px->6px)
    modeRow,
    typeRow,
    bodyPartRow,
    tagRow,
    el("div", { class: "table-area" }, [buildList()]),
    el("div", { class: "bottom-fixed" }, [
      el("button", { class: "btn btn-primary", text: "+ 새 운동 만들기", onclick: () => navigate(`#/exercise-form/${dayKey}`) }),
    ]),
  ]);
  mount(root, screen);
}
