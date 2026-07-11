// screens/machineCandidate.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import { todayDayKey } from "../../core/models.js";
import * as state from "../../core/state.js";

// v1.8: gainMethod별 그룹 표시 순서/라벨. listChallengeCandidates(gain.js)가 애초에
// machine/freeweight만 후보로 반환하므로 이 두 그룹만 존재합니다.
const GROUPS = [
  { gainMethod: "machine", label: "머신" },
  { gainMethod: "freeweight", label: "프리웨이트" },
];

export function renderChallengeCandidate(root) {
  const dayKey = todayDayKey();
  // v1.8: 오늘 루틴에 포함된 후보만 화면에 노출합니다(후보 state 자체는 건드리지 않는 "표시용" 필터).
  const candidates = state.getChallengeCandidatesForDay(dayKey);
  let selectedId = candidates[0]?.id || null;

  function renderCandRow(ex) {
    return el(
      "div",
      {
        class: `cand-row${ex.id === selectedId ? " selected" : ""}`,
        onclick: () => {
          selectedId = ex.id;
          const next = renderList();
          listEl.replaceWith(next);
          listEl = next; // v1.9.1: replaceWith만 하고 변수를 갱신하지 않아 두 번째 선택부터 반영이 안 되던 버그 수정
        },
      },
      [
        el("div", { class: "cand-left" }, [
          el("div", { class: "name", text: ex.name }),
          el("div", { class: "meta" }, [document.createTextNode(`${state.getExerciseState(ex.id).currentWeight}kg · `), el("b", { text: state.getStreakLabel(ex.id) })]),
        ]),
        el("span", { class: `radio${ex.id === selectedId ? " on" : ""}` }),
      ]
    );
  }

  function renderRows() {
    const nodes = [];
    GROUPS.forEach((g) => {
      const items = candidates.filter((ex) => ex.gainMethod === g.gainMethod);
      if (items.length === 0) return;
      nodes.push(el("div", { class: "section-label", text: g.label }));
      items.forEach((ex) => nodes.push(renderCandRow(ex)));
    });
    return nodes;
  }

  function renderList() {
    return el("div", { id: "candidate-list" }, renderRows());
  }

  let listEl = candidates.length ? renderList() : el("div", { class: "helper-text", text: "오늘 루틴에 해당하는 도전 후보가 없습니다." });

  const screen = el("div", { id: "machine-candidate-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("button", { class: "icon-btn", text: "←", onclick: () => history.back() }),
      el("div", { class: "title", text: "증량 후보 선택" }),
      el("span", { style: { opacity: 0 } }, "·"),
    ]),
    candidates.length ? el("div", { class: "helper-text", text: "오늘 도전할 운동을 선택하세요." }) : null,
    listEl,
    el("div", { class: "bottom-fixed" }, [
      el("button", {
        class: "btn btn-primary",
        text: "도전 진행",
        disabled: !candidates.length,
        onclick: () => {
          if (selectedId) state.selectChallengeExercise(selectedId);
          navigate("#/home", { replace: true });
        },
      }),
    ]),
  ]);
  mount(root, screen);
}
