// cueNoteEditor.js
// 운동 "관리" 화면 전용: 큐노트를 체크리스트 형태로 추가/수정/삭제하는 모달입니다.
// - 최대 3개, 항목당 1줄, 자유 입력
// - 행을 터치하면 수정 모드로 전환(자동 포커스), 🗑 버튼만 삭제(확인 팝업 있음)
// - "완료" 버튼 없이, 입력칸에서 포커스가 벗어나는 순간 자동 저장/자동 삭제(빈 값)됩니다.
// - 여기서 하는 모든 저장은 기존 state.updateExercise()만 사용합니다(전용 CRUD 함수 없음).
// - judge.js / gain.js / 판정·증량 상태와는 전혀 무관합니다.
import { el, mount } from "../dom.js";
import { openModal } from "./modal.js";
import * as state from "../../core/state.js";

const MAX_CUE_NOTES = 3;

export function openCueNoteEditor(exerciseId) {
  let editingIndex = null; // number(기존 항목 인덱스) | "new" | null

  const container = el("div", { class: "cue-editor" });

  function currentExercise() {
    return state.getExercise(exerciseId);
  }

  function saveNotes(notes) {
    // 방어: 어떤 경로로 들어오든 최대 3개를 넘지 않도록 저장 직전에 한 번 더 자릅니다.
    state.updateExercise(exerciseId, { cueNotes: notes.slice(0, MAX_CUE_NOTES) });
  }

  // index: 기존 항목 수정이면 숫자, 신규 추가면 "new"
  function commitEdit(index, rawValue) {
    const ex = currentExercise();
    const notes = [...(ex.cueNotes || [])];
    const value = rawValue.trim();

    if (index === "new") {
      // 값이 있으면 새 항목으로 저장, 없으면(빈 값) 애초에 저장하지 않고 그냥 버립니다.
      if (value && notes.length < MAX_CUE_NOTES) {
        notes.push(value);
        saveNotes(notes);
      }
    } else if (value) {
      notes[index] = value;
      saveNotes(notes);
    } else {
      // 기존 항목을 지워서 빈 값이 된 경우: 빈 항목은 저장하지 않는다는 원칙에 따라 삭제합니다.
      notes.splice(index, 1);
      saveNotes(notes);
    }

    editingIndex = null;
    render();
  }

  function requestDelete(index) {
    const ex = currentExercise();
    const noteText = ex.cueNotes[index];
    const content = el("div", { class: "duration-modal" }, [
      el("div", { class: "duration-title", text: "삭제하시겠습니까?" }), // v2.1.2: "큐 노트를" 접두어 제거
      el("p", { class: "detail", style: { textAlign: "center", margin: "0 0 16px" }, text: noteText }),
      el("div", { class: "btn-row-h" }, [
        el("button", {
          class: "btn btn-danger",
          text: "삭제",
          onclick: () => {
            const notes = [...currentExercise().cueNotes];
            notes.splice(index, 1);
            saveNotes(notes);
            confirmClose();
            render();
          },
        }),
        el("button", { class: "btn btn-ghost", text: "취소", onclick: () => confirmClose() }),
      ]),
    ]);
    const confirmClose = openModal(content, { dismissible: true });
  }

  function buildEditingInput(initialValue, onCommit) {
    const input = el("input", {
      class: "cue-edit-input",
      type: "text",
      value: initialValue,
      onblur: (e) => onCommit(e.target.value),
      onkeydown: (e) => {
        if (e.key === "Enter") e.target.blur();
      },
    });
    // 모달이 DOM에 이미 붙은 뒤 렌더되므로 다음 tick에 포커스를 주면 안전하게 동작합니다.
    queueMicrotask(() => {
      input.focus();
      const len = input.value.length;
      input.setSelectionRange(len, len);
    });
    return input;
  }

  function buildRow(note, index) {
    if (editingIndex === index) {
      return el("div", { class: "cue-edit-row editing" }, [
        el("span", { class: "cue-bullet", text: "☑" }),
        buildEditingInput(note, (value) => commitEdit(index, value)),
      ]);
    }
    return el(
      "div",
      {
        class: "cue-edit-row",
        onclick: () => {
          editingIndex = index;
          render();
        },
      },
      [
        el("span", { class: "cue-bullet", text: "☑" }),
        el("span", { class: "cue-edit-text", text: note }),
        el("button", {
          class: "cue-trash-btn",
          text: "🗑",
          onclick: (e) => {
            e.stopPropagation();
            requestDelete(index);
          },
        }),
      ]
    );
  }

  function buildNewRow() {
    return el("div", { class: "cue-edit-row editing" }, [
      el("span", { class: "cue-bullet", text: "☑" }),
      buildEditingInput("", (value) => commitEdit("new", value)),
    ]);
  }

  function render() {
    const ex = currentExercise();
    const notes = ex.cueNotes || [];

    const rows = notes.map((n, i) => buildRow(n, i));
    if (editingIndex === "new") rows.push(buildNewRow());

    const listNode =
      rows.length > 0
        ? el("div", { class: "cue-edit-list" }, rows)
        : el("div", { class: "cue-edit-list" }, [el("p", { class: "cue-view-empty", text: "등록된 큐 노트가 없습니다." })]);

    const showAddBtn = notes.length < MAX_CUE_NOTES && editingIndex !== "new";
    const addBtn = showAddBtn
      ? el("button", {
          class: "btn btn-ghost cue-add-btn",
          text: "작성", // v2.1.2: "+ 큐 노트 추가" -> "작성" (화면 제목에 이미 "큐 노트"가 있어 반복 표현 제거)
          onclick: () => {
            editingIndex = "new";
            render();
          },
        })
      : null;

    const content = el(
      "div",
      { class: "cue-editor-modal" },
      [
        // v2.1.2: 안내 문구 제거(1.1) — 관리 화면 UI 간소화
        listNode,
        addBtn,
      ].filter(Boolean)
    );

    mount(container, content);
  }

  render();
  openModal(container, { dismissible: true });
}
