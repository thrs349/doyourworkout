// screens/routineEditor.js
// v1.1: 드래그 UX 개선 - 드래그 핸들 + 손가락을 따라 이동하는 플로팅 카드 + 이동 위치를 보여주는 placeholder.
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import * as state from "../../core/state.js";
import { DAYS, effectiveRole } from "../../core/models.js";
import { openCueNoteEditor } from "../components/cueNoteEditor.js";
import { openModal } from "../components/modal.js";

// v2.7.0: 루틴 Editor 전용 읽기 전용 역할 표시. 확정된 디자인(🅼 Main/🅢 Assist/🅒 Core)을 그대로 사용합니다.
// OS별 이모지 렌더링 차이 가능성은 검토 단계에서 안내드렸으나, 이번 버전은 이 확정안을 유지하기로 결정되었습니다.
const ROLE_BADGE_TEXT = { main: "🅼", assist: "🅢", core: "🅒" };

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
    // v2.7.0: 종목이 삭제된 경우(ex===null)는 역할을 알 수 없으므로 배지를 표시하지 않습니다.
    const roleBadge = ex ? el("span", { class: "role-badge", title: "역할(읽기 전용)", text: ROLE_BADGE_TEXT[effectiveRole(ex)] }) : null;
    // v2.7.0 UI 개선: ☰/순서/역할 아이콘을 별도 묶음(.drag-row-icons)으로 감싸 그 안에서만 간격을 좁히고,
    // 종목명(.name)에는 기존 행 간격을 그대로 둬서 Galaxy S25 기준 종목명이 최대한 길게 보이도록 합니다.
    const iconCluster = el("span", { class: "drag-row-icons" }, [
      el("span", { class: "drag-handle", text: "≡" }),
      el("span", { class: "order-badge", text: String(index + 1).padStart(2, "0") }),
      roleBadge,
    ]);
    const row = el("div", { class: `drag-row${isActive ? "" : " inactive"}`, "data-id": exId }, [
      iconCluster,
      // v2.7.0 UI 개선: "(비활성)" 텍스트를 없애고, .drag-row.inactive의 opacity/취소선 스타일만으로 표현합니다.
      el("span", { class: "name", text: exerciseName(exId) }),
      // v2.1.2(5): 종목 관리 화면과 동일한 순서로 큐 노트 버튼 추가. 기존 openCueNoteEditor()를 그대로 재사용합니다.
      // v2.3.0: 종목 수정(✎) 버튼은 제거했습니다(종목 관리 화면에서는 계속 가능). 종목명/큐노트/활성 스위치/삭제는 그대로 유지합니다.
      ex ? el("button", { class: "icon-chip", text: "💡", onclick: () => openCueNoteEditor(exId) }) : null,
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

  // v2.6.2: 네이티브 window.prompt() 대신 앱 modal 시스템 사용(다른 팝업과 디자인 통일). 이모지 입력은
  // 일반 텍스트 input이라 기존과 동일하게 그대로 가능합니다.
  // v2.6.3: 실기기 테스트 반영 - 제목 영역을 제거하고, 안내 문구를 content 영역의 문단으로 표시합니다
  // (showAlert()와 동일하게 "내용 중심" 팝업으로 통일).
  // v2.6.4: 실기기 테스트 반영 - 문구를 "루틴 이름을 수정하세요."로 변경. 이 문단은 공용 .detail(15px,
  // v2.6.4에서 알림 팝업 가독성을 위해 확대)보다 작게, 입력칸(.text-input, 14px)과 같거나 작게 유지해야
  // 해서 인라인으로 폰트 크기를 14px로 지정합니다(공용 클래스를 올리면 이 모달만 다시 커져버리므로).
  function renameTitle() {
    const input = el("input", {
      class: "text-input",
      type: "text",
      value: version.title || "",
      placeholder: "루틴 이름을 수정하세요.",
    });
    const content = el("div", { class: "duration-modal" }, [
      el("p", { class: "detail", style: { textAlign: "center", margin: "0 0 10px", fontSize: "14px" }, text: "루틴 이름을 수정하세요." }),
      el("div", { style: { margin: "0 0 16px" } }, [input]),
      el("div", { class: "btn-row-h" }, [
        el("button", { class: "btn btn-ghost", text: "취소", onclick: () => close() }),
        el("button", {
          class: "btn btn-primary",
          text: "저장",
          onclick: () => {
            const next = input.value.trim();
            if (next) {
              state.renameRoutineVersion(dayKey, version.id, next);
              titleEl.textContent = next;
            }
            close();
          },
        }),
      ]),
    ]);
    const close = openModal(content, { dismissible: true });
    // 모달이 DOM에 붙은 뒤 포커스를 줘야 안전합니다(cueNoteEditor.js와 동일 패턴).
    queueMicrotask(() => {
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
    });
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
