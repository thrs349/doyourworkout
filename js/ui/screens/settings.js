// screens/settings.js
import { el, mount, onLongPress } from "../dom.js";
import { navigate } from "../router.js";
import * as state from "../../core/state.js";
import { THEMES, getThemeName, applyTheme } from "../../core/theme.js";

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
    el("div", { class: "section-label", text: "데이터 백업" }),
    el("div", { class: "backup-actions" }, [
      el("button", { class: "btn btn-ghost", text: "JSON으로 내보내기", onclick: () => state.backupNow() }),
      el("button", { class: "btn btn-ghost", text: "백업 파일 불러오기", onclick: () => fileInput.click() }),
      fileInput,
    ]),
  ]);
  mount(root, screen);
}
