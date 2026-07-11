// screens/exercisePicker.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import * as state from "../../core/state.js";
import { formatExerciseMeta } from "../../core/models.js";

export function renderExercisePicker(root, params) {
  const dayKey = params.day;
  const version = state.getDefaultVersion(dayKey);
  const inRoutine = new Set(version.items.map((it) => it.exerciseId));
  const all = state.getActiveExercises(); // 비활성화된 종목은 루틴에 추가할 수 없도록 목록에서 제외

  function row(ex) {
    const already = inRoutine.has(ex.id);
    return el("div", { class: "list-row" }, [
      el("div", {}, [
        el("div", { class: "name", text: ex.name }),
        el("div", { class: "meta", text: formatExerciseMeta(ex) }),
      ]),
      el("button", {
        class: "btn btn-ghost",
        style: { width: "auto", height: "36px", padding: "0 14px", fontSize: "12.5px" },
        text: already ? "추가됨" : "추가",
        disabled: already,
        onclick: () => {
          state.addExerciseToRoutine(dayKey, version.id, ex.id);
          navigate(`#/routine/${dayKey}`, { replace: true });
        },
      }),
    ]);
  }

  const screen = el("div", { id: "exercise-picker-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("button", { class: "icon-btn", text: "←", onclick: () => history.back() }),
      el("div", { class: "title", text: "운동 선택" }),
      el("span", { style: { opacity: 0 } }, "·"),
    ]),
    el("div", { class: "table-area" }, all.length ? all.map(row) : [el("div", { class: "empty-routine", text: "등록된 운동이 없습니다. 먼저 새 운동을 만들어 주세요." })]),
    el("div", { class: "bottom-fixed" }, [
      el("button", { class: "btn btn-primary", text: "+ 새 운동 만들기", onclick: () => navigate(`#/exercise-form/${dayKey}`) }),
    ]),
  ]);
  mount(root, screen);
}
