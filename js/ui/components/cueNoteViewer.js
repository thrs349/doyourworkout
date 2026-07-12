// cueNoteViewer.js
// 운동 "수행" 화면 전용: 큐노트를 읽기 전용으로만 보여주는 팝업 콘텐츠입니다.
// 여기서는 어떤 상태도 변경하지 않습니다(추가/수정/삭제는 cueNoteEditor.js의 역할).
import { el } from "../dom.js";

export function buildCueNoteViewerContent(ex) {
  const notes = ex.cueNotes || [];
  const list = notes.length
    ? el(
        "ul",
        { class: "cue-view-list" },
        notes.map((note) => el("li", { class: "cue-view-item", text: note }))
      )
    : el("p", { class: "cue-view-empty", text: "등록된 큐 노트가 없습니다." });

  // v2.1.0 Patch: 운동 직전 빠른 확인이 목적이므로 종목명은 표시하지 않고 체크리스트만 읽기 전용으로 보여줍니다.
  return el("div", { class: "cue-modal" }, [list]);
}
