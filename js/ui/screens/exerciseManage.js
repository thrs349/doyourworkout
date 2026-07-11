// screens/exerciseManage.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import * as state from "../../core/state.js";
import { formatExerciseMeta, GAIN_METHODS } from "../../core/models.js";
import { renderBodyweightDebugTag } from "../components/debugBodyweightStatus.js"; // ⚠️ 임시 디버그용 (v1.8) - 정식 UI 생기면 이 줄과 컴포넌트 파일을 함께 제거
import { openModal } from "../components/modal.js";

// 이름순 정렬: 자연정렬(숫자/이모지 가공) 없이 일반 문자열 비교만 사용합니다.
// ex.name 원본을 그대로 비교하므로(이모지 포함) 별도 가공이 없습니다.
function nameCompare(a, b) {
  return a.name.localeCompare(b.name, "ko");
}

const GAIN_METHOD_ORDER = [GAIN_METHODS.MACHINE, GAIN_METHODS.FREEWEIGHT, GAIN_METHODS.HIGH_REP, GAIN_METHODS.BODYWEIGHT];
function methodCompare(a, b) {
  const diff = GAIN_METHOD_ORDER.indexOf(a.gainMethod) - GAIN_METHOD_ORDER.indexOf(b.gainMethod);
  return diff !== 0 ? diff : nameCompare(a, b);
}

function recentCompare(a, b) {
  const da = state.getExerciseLastUsedDate(a.id);
  const db = state.getExerciseLastUsedDate(b.id);
  if (da === db) return nameCompare(a, b);
  if (!da) return 1; // 사용 기록 없는 종목은 뒤로
  if (!db) return -1;
  return da < db ? 1 : -1; // 최신 날짜가 앞으로
}

const SORTERS = { name: nameCompare, gainMethod: methodCompare, recent: recentCompare };
const SORT_LABELS = { name: "이름순", gainMethod: "유형순", recent: "최근 사용순" };

export function renderExerciseManage(root) {
  let tab = "active"; // "active" | "inactive"
  let editMode = false; // 활성 탭 전용 선택 모드
  // 수정 모드에서 "비활성으로 전환 예정"으로 표시된 종목 id 집합.
  // 스위치는 항상 "현재/저장 시 반영될 active 상태"를 그대로 보여줍니다(on = 활성 유지, off = 비활성 전환 예정).
  let deactivateIds = new Set();
  let searchQuery = "";
  let sortKey = "name"; // "name" | "gainMethod" | "recent"

  function matchesSearch(ex) {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return true;
    return ex.name.toLowerCase().includes(q);
  }

  function activeList() {
    return state.getData().exercises.filter((e) => e.active !== false && matchesSearch(e)).sort(SORTERS[sortKey]);
  }
  function inactiveList() {
    return state.getData().exercises.filter((e) => e.active === false && matchesSearch(e)).sort(SORTERS[sortKey]);
  }

  /* ---------------- 활성 탭 ---------------- */

  function activeRow(ex) {
    const willDeactivate = deactivateIds.has(ex.id);
    const rightControls = editMode
      ? [
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
          el("button", {
            class: "icon-btn",
            text: "✎",
            onclick: () => navigate(`#/exercise-edit/${ex.id}`),
          }),
        ];

    return el("div", { class: "list-row", style: { alignItems: "center" } }, [
      el("div", {}, [
        el("span", { class: "name", text: ex.name }),
        el("div", { class: "meta", text: formatExerciseMeta(ex) }),
        renderBodyweightDebugTag(ex, state.getExerciseState(ex.id)),
      ]),
      el("div", { style: { display: "flex", alignItems: "center", gap: "10px" } }, rightControls),
    ]);
  }

  /* ---------------- 비활성 탭 ---------------- */
  // 비활성 탭은 "복구(재활성화)" 또는 "제거(완전 삭제)" 목적만 제공합니다(종목 수정 진입 없음).

  function inactiveRow(ex) {
    return el("div", { class: "list-row", style: { alignItems: "center" } }, [
      el("div", { style: { flex: "1 1 auto", minWidth: "0", overflow: "hidden" } }, [
        el("span", {
          class: "name",
          text: ex.name,
          style: { opacity: 0.6, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" },
        }),
        el("div", { class: "meta", text: formatExerciseMeta(ex) }),
      ]),
      el("div", { class: "btn-row-h compact", style: { flexShrink: 0 } }, [
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
    refreshTabUI();
    refreshEditBtn();
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

  /* ---------------- 정렬 (2-6) ---------------- */

  const sortOpts = {
    name: el("div", { class: "type-opt", text: SORT_LABELS.name, onclick: () => setSortKey("name") }),
    gainMethod: el("div", { class: "type-opt", text: SORT_LABELS.gainMethod, onclick: () => setSortKey("gainMethod") }),
    recent: el("div", { class: "type-opt", text: SORT_LABELS.recent, onclick: () => setSortKey("recent") }),
  };
  function refreshSortUI() {
    Object.entries(sortOpts).forEach(([key, node]) => node.classList.toggle("selected", key === sortKey));
  }
  function setSortKey(key) {
    if (sortKey === key) return;
    sortKey = key;
    refreshSortUI();
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
    editToggleBtn.style.display = tab === "active" ? "flex" : "none";
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
  refreshSortUI();

  const screen = el("div", { id: "exercise-manage-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("button", { class: "icon-btn", text: "←", onclick: () => history.back() }),
      el("div", { class: "title", text: "운동 관리" }),
      editToggleBtn,
    ]),
    el("div", { class: "type-toggle", style: { marginBottom: "12px" } }, [tabActiveOpt, tabInactiveOpt]),
    el("div", { class: "field-group" }, [searchInput]),
    el("div", { class: "type-toggle", style: { marginBottom: "12px" } }, [sortOpts.name, sortOpts.gainMethod, sortOpts.recent]),
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
