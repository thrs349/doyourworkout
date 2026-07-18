// screens/exercisePicker.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import * as state from "../../core/state.js";
import { formatExerciseMeta, gainMethodLabel } from "../../core/models.js";

// v2.4.7: 종목 선택 화면 전용 표시 순서. 실제 데이터(등록 순서)나 다른 화면의 정렬에는 전혀 영향을 주지 않습니다.
const PICKER_GAIN_METHOD_ORDER = ["machine", "freeweight", "high_rep", "bodyweight"];

export function renderExercisePicker(root, params) {
  const dayKey = params.day;
  const version = state.getDefaultVersion(dayKey);
  const inRoutine = new Set(version.items.map((it) => it.exerciseId));
  const all = state.getActiveExercises(); // 기존 그대로 사용 — 이 배열/순서 자체는 건드리지 않습니다.

  // v2.4.7: 유형별 그룹 + 그룹 내 가나다순(ko locale) 정렬은 여기 화면 렌더링 시점에만 적용합니다.
  // filter()가 매번 새 배열을 만들고 그 위에서만 sort()하므로, all(= getActiveExercises() 결과)과
  // 그 내부 data.exercises 원본은 전혀 mutate되지 않습니다. sort는 안정 정렬이라 이름이 같은 종목은
  // 원래 등록 순서(all에서의 상대 순서)가 그대로 유지됩니다. 종목이 하나도 없는 유형은 그룹 자체를 뺍니다.
  const groups = PICKER_GAIN_METHOD_ORDER.map((gm) => ({
    gainMethod: gm,
    label: gainMethodLabel(gm),
    exercises: all.filter((ex) => ex.gainMethod === gm).sort((a, b) => a.name.localeCompare(b.name, "ko")),
  })).filter((g) => g.exercises.length > 0);

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

  const listNodes = groups.flatMap((g) => [
    el("div", { class: "section-label", text: g.label }),
    ...g.exercises.map(row),
  ]);

  const screen = el("div", { id: "exercise-picker-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("button", { class: "icon-btn", text: "←", onclick: () => history.back() }),
      el("div", { class: "title", text: "운동 선택" }),
      el("span", { style: { opacity: 0 } }, "·"),
    ]),
    el("div", { class: "table-area" }, listNodes.length ? listNodes : [el("div", { class: "empty-routine", text: "등록된 운동이 없습니다. 먼저 새 운동을 만들어 주세요." })]),
    el("div", { class: "bottom-fixed" }, [
      el("button", { class: "btn btn-primary", text: "+ 새 운동 만들기", onclick: () => navigate(`#/exercise-form/${dayKey}`) }),
    ]),
  ]);
  mount(root, screen);
}
