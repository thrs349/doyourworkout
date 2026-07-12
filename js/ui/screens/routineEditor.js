// screens/routineEditor.js
// v1.1: 드래그 UX 개선 - 드래그 핸들 + 손가락을 따라 이동하는 플로팅 카드 + 이동 위치를 보여주는 placeholder.
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import * as state from "../../core/state.js";
import { DAYS } from "../../core/models.js";
import { openCueNoteEditor } from "../components/cueNoteEditor.js";

export function renderRoutineEditor(root, params) {
  const dayKey = params.day;
  const dayLabel = DAYS.find((d) => d.key === dayKey)?.label || "";
  const version = state.getDefaultVersion(dayKey);
  let orderedIds = [...version.items].sort((a, b) => a.order - b.order).map((it) => it.exerciseId);

  function exerciseName(id) {
    const ex = state.getExercise(id);
    return ex ? ex.name : "(삭제된 운동)";
  }

  function commitOrder() {
    state.reorderRoutine(dayKey, version.id, orderedIds);
  }

  function renderList() {
    return el(
      "div",
      { id: "routine-drag-list" },
      orderedIds.map((exId, i) => renderRow(exId, i))
    );
  }

  function renderRow(exId, index) {
    const ex = state.getExercise(exId);
    const isActive = !ex || ex.active !== false;
    const row = el("div", { class: `drag-row${isActive ? "" : " inactive"}`, "data-id": exId }, [
      el("span", { class: "drag-handle", text: "≡" }),
      el("span", { class: "order-badge", text: String(index + 1).padStart(2, "0") }),
      el("span", { class: "name", text: exerciseName(exId) + (isActive ? "" : " (비활성)") }),
      // v2.1.2(5): 종목 관리 화면과 동일한 순서(💡 -> ✎)로 큐 노트 버튼 추가. 기존 openCueNoteEditor()를 그대로 재사용합니다.
      ex ? el("button", { class: "icon-btn", text: "💡", onclick: () => openCueNoteEditor(exId) }) : null,
      ex ? el("button", { class: "icon-btn", text: "✎", onclick: () => navigate(`#/exercise-edit/${exId}`) }) : null,
      el("button", {
        class: `switch small${isActive ? " on" : ""}`,
        title: isActive ? "비활성화" : "다시 활성화",
        onclick: () => {
          if (ex) state.setExerciseActive(exId, !isActive);
          rerender();
        },
      }),
      el("button", {
        class: "remove-btn",
        text: "✕",
        onclick: () => {
          state.removeExerciseFromRoutine(dayKey, version.id, exId);
          orderedIds = orderedIds.filter((id) => id !== exId);
          rerender();
        },
      }),
    ]);
    attachDrag(row, exId);
    return row;
  }

  function attachDrag(row, exId) {
    const handle = row.querySelector(".drag-handle");

    handle.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      const container = document.getElementById("routine-drag-list");
      const rect = row.getBoundingClientRect();
      const grabOffsetY = e.clientY - rect.top;

      // 손가락을 따라다니는 플로팅 카드(고스트)
      const ghost = row.cloneNode(true);
      ghost.classList.add("drag-ghost");
      ghost.style.width = `${rect.width}px`;
      ghost.style.left = `${rect.left}px`;
      ghost.style.top = `${rect.top}px`;
      document.body.appendChild(ghost);

      // 원래 자리에는 이동 위치를 보여주는 placeholder를 대신 둡니다.
      const placeholder = el("div", { class: "drag-placeholder", style: { height: `${rect.height}px` } });
      row.style.display = "none";
      container.insertBefore(placeholder, row);

      function onMove(ev) {
        const y = ev.touches ? ev.touches[0].clientY : ev.clientY;
        ghost.style.top = `${y - grabOffsetY}px`;
        repositionPlaceholder(container, placeholder, row, y);
      }

      function onUp() {
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        document.removeEventListener("pointercancel", onUp);

        // v1.9.1: 기존 코드는 placeholder를 row로 되돌리기 "전"에 순서를 읽어서, 그 순간 container 안에
        // placeholder(새 위치)와 display:none인 원래 row(원래 위치)가 동시에 존재해 같은 종목이 배열에
        // 두 번 들어가는 버그가 있었습니다(→ reorderRoutine이 그대로 중복 항목을 만듦).
        // row를 placeholder 자리로 완전히 옮긴(원래 자리에서는 자동으로 사라짐) "뒤"에 순서를 읽도록 순서를 바꿨습니다.
        ghost.remove();
        row.style.display = "";
        placeholder.replaceWith(row);

        orderedIds = Array.from(container.children).map((c) => c.dataset.id);
        commitOrder();
        rerender();
      }

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
      document.addEventListener("pointercancel", onUp);
    });
  }

  // pointerY 위치에 따라 placeholder를 다른 행들 사이의 알맞은 자리로 옮깁니다.
  function repositionPlaceholder(container, placeholder, draggedRow, pointerY) {
    const siblings = Array.from(container.children).filter((c) => c !== draggedRow && c !== placeholder);
    let target = null;
    for (const sib of siblings) {
      const r = sib.getBoundingClientRect();
      if (pointerY < r.top + r.height / 2) {
        target = sib;
        break;
      }
    }
    if (target) {
      if (placeholder.nextSibling !== target) container.insertBefore(placeholder, target);
    } else if (container.lastElementChild !== placeholder) {
      container.appendChild(placeholder);
    }
  }

  function rerender() {
    const listEl = document.getElementById("routine-drag-list");
    listEl.replaceWith(renderList());
  }

  function renameTitle() {
    const next = window.prompt("루틴 제목을 입력하세요 (이모지 사용 가능)", version.title);
    if (next && next.trim()) {
      state.renameRoutineVersion(dayKey, version.id, next.trim());
      titleEl.textContent = next.trim();
    }
  }

  const titleEl = el("div", { class: "title", text: `${version.title}` });

  const screen = el("div", { id: "routine-editor-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("button", { class: "icon-btn", text: "←", onclick: () => history.back() }),
      titleEl,
      el("button", { class: "icon-btn", text: "✎", onclick: renameTitle }),
    ]),
    el("div", { class: "helper-text", text: "≡ 핸들을 눌러 드래그하면 순서가 바뀝니다." }),
    renderList(),
    el("div", { class: "bottom-fixed" }, [
      el("button", { class: "btn btn-ghost", text: "+ 운동 추가", onclick: () => navigate(`#/exercise-picker/${dayKey}`) }),
      el("button", { class: "btn btn-primary", text: "저장", onclick: () => { commitOrder(); navigate("#/routine-list", { replace: true }); } }),
    ]),
  ]);

  mount(root, screen);
}
