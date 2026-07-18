// screens/settings.js
import { el, mount, onLongPress } from "../dom.js";
import { navigate } from "../router.js";
import * as state from "../../core/state.js";
import { THEMES, getThemeName, applyTheme } from "../../core/theme.js";
import { openModal } from "../components/modal.js";
import { getGenerationSummaries } from "../../core/stats.js";
import { APP_VERSION } from "../../core/appConfig.js";

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

  // v2.5.1: 복원 완료 안내. 시스템 alert() 대신 confirmResetGeneration()/confirmRestore()와 동일한
  // openModal 패턴을 재사용해 앱 내부 UI 스타일로 통일합니다. 확인 후 홈 화면 이동 흐름은 기존과 동일합니다.
  function showRestoreComplete() {
    const content = el("div", { class: "duration-modal" }, [
      el("div", { class: "duration-title", text: "복원 완료" }),
      el("div", {}, [
        el("p", {
          class: "detail",
          style: { textAlign: "center", margin: "0 0 3px" },
          text: "백업 데이터 복원이 완료되었습니다.",
        }),
        el("p", {
          class: "detail",
          style: { textAlign: "center", margin: "0 0 16px" },
          text: "최신 데이터를 적용하기 위해 앱을 다시 실행해주세요.",
        }),
      ]),
      el("div", { class: "btn-row-h" }, [
        el("button", {
          class: "btn btn-primary",
          text: "확인",
          onclick: () => {
            close();
            navigate("#/home", { replace: true });
          },
        }),
      ]),
    ]);
    const close = openModal(content);
  }

  // v2.5.0: 복원 전 확인 모달. confirmResetGeneration()과 동일한 openModal 패턴을 재사용합니다.
  // v2.5.1: 확인 문구가 한 문장으로 길게 이어지며 임의 지점에서 줄바꿈되던 문제를, 기존
  // confirmResetGeneration()과 동일하게 "무엇을 하는지"/"계속할지"를 별도 문단으로 분리해 개선합니다.
  function confirmRestore(parsedData) {
    const content = el("div", { class: "duration-modal" }, [
      el("div", { class: "duration-title", text: "백업 복원" }),
      el("div", {}, [
        el("p", {
          class: "detail",
          style: { textAlign: "center", margin: "0 0 3px" },
          text: "기존 운동 데이터를 백업 파일 기준으로 덮어씁니다.",
        }),
        el("p", {
          class: "detail",
          style: { textAlign: "center", margin: "0 0 16px" },
          text: "계속하시겠습니까?",
        }),
      ]),
      el("div", { class: "btn-row-h" }, [
        el("button", { class: "btn btn-ghost", text: "취소", onclick: () => close() }),
        el("button", {
          class: "btn btn-primary",
          text: "복원하기",
          onclick: () => {
            state.restoreFromData(parsedData);
            applyTheme(state.getData().settings.themeId);
            close();
            showRestoreComplete();
          },
        }),
      ]),
    ]);
    const close = openModal(content);
  }

  const fileInput = el("input", {
    type: "file",
    accept: "application/json",
    style: { display: "none" },
    onchange: async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      fileInput.value = ""; // 같은 파일을 다시 선택해도 onchange가 발생하도록 초기화
      try {
        const parsed = await state.readBackupFile(file);
        confirmRestore(parsed);
      } catch (err) {
        alert("올바른 Do Your Workout 백업 파일이 아닙니다.");
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
    el("div", {
      class: "helper-text",
      style: { textAlign: "center", margin: "var(--sp-5) 0 0" },
      text: APP_VERSION,
    }),
  ]);
  mount(root, screen);
}
