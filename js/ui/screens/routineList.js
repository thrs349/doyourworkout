// screens/routineList.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import { renderBottomNav } from "../components/bottomNav.js";
import * as state from "../../core/state.js";
import { DAYS_DISPLAY_ORDER } from "../../core/models.js";

export function renderRoutineList(root) {
  // v1.1: 요일을 월~일 순서로 표시합니다.
  const rows = DAYS_DISPLAY_ORDER.map((d) => {
    const version = state.getDefaultVersion(d.key);
    const count = version.items.length;
    return el("button", { class: "list-row", style: { width: "100%", border: "1px solid var(--color-border)", background: "var(--color-surface)" }, onclick: () => navigate(`#/routine/${d.key}`) }, [
      el("div", {}, [
        el("div", { class: "name", text: `${d.label}요일 · ${version.title}` }),
        el("div", { class: "meta", text: count ? `${count}개 운동` : "운동 없음" }),
      ]),
      el("span", { class: "arrow", text: "›" }),
    ]);
  });

  const screen = el("div", { id: "routine-list-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("div", { class: "title", text: "루틴 설정" }),
      el("button", { class: "icon-btn", text: "운동", style: { fontSize: "11px", width: "auto", padding: "0 10px" }, onclick: () => navigate("#/exercise-manage") }),
    ]),
    el("div", { class: "table-area" }, rows),
    renderBottomNav("routine"),
  ]);
  mount(root, screen);
}
