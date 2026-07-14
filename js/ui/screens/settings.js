// screens/settings.js
import { el, mount, onLongPress } from "../dom.js";
import { navigate } from "../router.js";
import * as state from "../../core/state.js";
import { THEMES, getThemeName, applyTheme } from "../../core/theme.js";
import { openModal } from "../components/modal.js";
import { getGenerationSummaries } from "../../core/stats.js";

// v2.3.0: "YYYY-MM-DD" -> "YYYY.MM.DD" 표시용 포맷터(순수 텍스트 변환, 데이터 자체는 건드리지 않음)
function fmtDot(dateStr) {
  return dateStr.replaceAll("-", ".");
}

// 두 "YYYY-MM-DD" 날짜 사이의 일수(양끝 포함)를 계산합니다. Generation 히스토리 표시 전용입니다.
function daysBetween(fromDateStr, toDateStr) {
  const ms = new Date(toDateStr).getTime() - new Date(fromDateStr).getTime();
  return Math.round(ms / 86400000) + 1;
}

export function renderSettings(root) {
  const data = state.getData();

  function renderThemeRow(theme) {
    const isSelected = data.settings.themeId === theme.id;
    const nameEl = el("span", { class: "theme-name", text: getThemeName(theme, data.settings.customThemeNames) });

    const row = el(
      "div",
      { class: `theme-row${isSelected ? " selected" : ""}`, onclick: () => selectTheme(theme.id) },
      [
        el("div", { class: "theme-row-left" }, [
          el("div", { class: "chip-pair" }, [
            el("span", { class: "chip", style: { background: theme.tokens["--color-bg"] } }),
            el("span", { class: "chip", style: { background: theme.tokens["--color-primary"] } }),
          ]),
          nameEl,
        ]),
        isSelected ? el("span", { text: "✓", style: { color: "var(--color-primary)", fontWeight: "700" } }) : null,
      ]
    );

    onLongPress(row, () => {
      const next = window.prompt("테마 이름을 입력하세요", getThemeName(theme, data.settings.customThemeNames));
      if (next && next.trim()) {
        state.renameTheme(theme.id, next.trim());
        nameEl.textContent = next.trim();
      }
    });

    return row;
  }

  function selectTheme(themeId) {
    state.setTheme(themeId);
    applyTheme(themeId);
    navigate("#/settings", { replace: true }); // 강제 리렌더 (history를 쌓지 않음)
  }

  // v2.3.0: 운동 기준 초기화(Generation). judge.js/gain.js를 거치지 않고 state.resetGeneration()만 호출합니다.
  function confirmResetGeneration() {
    const content = el("div", { class: "duration-modal" }, [
      el("div", { class: "duration-title", text: "운동 기준 초기화" }),
      el("div", {}, [
        el("p", {
          class: "detail",
          style: { textAlign: "center", margin: "0 0 3px" },
          text: "모든 운동의 현재 중량 및 증량 기준이 초기화됩니다.",
        }),
        el("p", {
          class: "detail",
          style: { textAlign: "center", margin: "0 0 16px" },
          text: "기존 운동 기록은 삭제되지 않습니다.",
        }),
      ]),
      el("div", { class: "btn-row-h" }, [
        el("button", { class: "btn btn-ghost", text: "취소", onclick: () => close() }),
        el("button", {
          class: "btn btn-primary",
          text: "초기화",
          onclick: () => {
            state.resetGeneration();
            close();
            navigate("#/settings", { replace: true }); // 강제 리렌더(history 쌓지 않음, 기존 selectTheme()과 동일 패턴)
          },
        }),
      ]),
    ]);
    const close = openModal(content);
  }

  function renderGenerationSection() {
    const summaries = getGenerationSummaries(data.sessions);
    const todayStr = new Date().toISOString().slice(0, 10);

    const historyRows = summaries.map((s) => {
      const isCurrent = s.generation === data.currentGeneration;
      const rangeText = isCurrent ? `${fmtDot(s.firstDate)} ~ 진행중` : `${fmtDot(s.firstDate)} ~ ${fmtDot(s.lastDate)}`;
      const dayCount = isCurrent ? daysBetween(s.firstDate, todayStr) : daysBetween(s.firstDate, s.lastDate);
      return el("div", { class: "helper-text", text: `Generation ${s.generation} ${rangeText} (${dayCount}일)` });
    });

    return el("div", {}, [
      el("div", { class: "helper-text", text: `현재 Generation ${data.currentGeneration}` }),
      ...historyRows,
      el("button", { class: "btn btn-ghost", text: "운동 기준 초기화", onclick: confirmResetGeneration }),
    ]);
  }

  const fileInput = el("input", {
    type: "file",
    accept: "application/json",
    style: { display: "none" },
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        await state.restoreFromFile(file);
        applyTheme(state.getData().settings.themeId);
        alert("데이터를 불러왔습니다.");
        navigate("#/home", { replace: true });
      } catch (err) {
        alert("파일을 불러오지 못했습니다. 올바른 백업 파일인지 확인해 주세요.");
      }
    },
  });

  const screen = el("div", { id: "settings-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("button", { class: "icon-btn", text: "←", onclick: () => history.back() }),
      el("div", { class: "title", text: "설정" }),
      el("span", { style: { opacity: 0 } }, "·"),
    ]),
    el("div", { class: "section-label", text: "테마 (길게 눌러 이름 수정)" }),
    ...THEMES.map(renderThemeRow),
    el("div", { class: "section-label", text: "운동 기준 초기화" }),
    renderGenerationSection(),
    el("div", { class: "section-label", text: "데이터 백업" }),
    el("div", { class: "backup-actions" }, [
      el("button", { class: "btn btn-ghost", text: "JSON으로 내보내기", onclick: () => state.backupNow() }),
      el("button", { class: "btn btn-ghost", text: "백업 파일 불러오기", onclick: () => fileInput.click() }),
      fileInput,
    ]),
  ]);
  mount(root, screen);
}
