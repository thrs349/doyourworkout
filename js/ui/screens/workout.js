// screens/workout.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import { openModal } from "../components/modal.js";
import { buildCueNoteViewerContent } from "../components/cueNoteViewer.js";
import * as state from "../../core/state.js";
import { parseSetInput } from "../../core/judge.js";

// v2.1.0: 큐노트 아이콘(💡). interactive=true(수행 화면)면 큐노트가 있을 때만 보이고 클릭도 가능합니다.
// interactive=false(결과 화면)면 큐노트 존재 여부와 무관하게 항상 placeholder(투명)로만 유지되고 클릭 기능이 없습니다.
// display:none이 아니라 visibility:hidden을 써서, 아이콘이 있든 없든 표(head-row/set-row) 열 폭과 정렬은 항상 동일합니다.
function buildCueIcon(ex, interactive, onToggle) {
  const hasNotes = interactive && Array.isArray(ex.cueNotes) && ex.cueNotes.length > 0;
  const icon = el("span", { class: `cue-icon${hasNotes ? "" : " cue-icon-placeholder"}`, text: "💡" });
  if (hasNotes) {
    icon.addEventListener("click", (e) => {
      e.stopPropagation();
      onToggle(ex);
    });
  }
  return icon;
}

function fmtDuration(minutes) {
  if (minutes < 60) return `${minutes}분`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h}시간` : `${h}시간 ${m}분`;
}

function fmtClock(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
}

// v1.2: 고반복 종목은 목표를 "하한+" 형태로만 보여주고 상한은 화면에 노출하지 않습니다.
// v1.3: 맨몸(시간 기반) 종목은 목표를 "OO초"로 표시합니다.
function formatTarget(ex, targetReps) {
  if (ex.gainMethod === "high_rep") return `${targetReps}+`;
  if (ex.gainMethod === "bodyweight" && ex.bodyweightGoalType === "time") return `${targetReps}초`;
  return String(targetReps);
}

// v1.1: "수행" 입력은 6+6 같은 분할 입력을 지원해야 하므로 type="text" + inputmode="tel"을 씁니다.
function performedInput(getter, setter) {
  return el("input", {
    class: "cell-input",
    type: "text",
    inputmode: "tel",
    placeholder: "-",
    value: getter ? getter() : "",
    oninput: (e) => setter(e.target.value),
  });
}

// v1.3: 편측(좌우 구분) 운동의 "수행" 칸. 입력 박스 2개를 위치로만 좌우 구분합니다(라벨/슬래시 없음).
// v2.2.1: getLeft/getRight를 추가해 재렌더(예: Check Gate "다시 수정") 시 기존 입력값이 다시 표시되도록 함.
function dualPerformedInput(getLeft, getRight, setLeft, setRight) {
  const leftInput = el("input", {
    class: "cell-input dual",
    type: "text",
    inputmode: "tel",
    placeholder: "-",
    value: getLeft ? getLeft() ?? "" : "",
    oninput: (e) => setLeft(e.target.value),
  });
  const rightInput = el("input", {
    class: "cell-input dual",
    type: "text",
    inputmode: "tel",
    placeholder: "-",
    value: getRight ? getRight() ?? "" : "",
    oninput: (e) => setRight(e.target.value),
  });
  return el("div", { class: "dual-input" }, [leftInput, rightInput]);
}

export function renderWorkout(root) {
  const draft = window.__draftSession;
  if (!draft) {
    navigate("#/home");
    return;
  }

  // v2.1.2: 상단바에서 요일 표시를 제거하면서 dayLabel을 더 이상 쓰지 않아 선언도 함께 정리했습니다.
  let finishedSession = null;

  // v2.2.0 Check Gate ----------------------------------------------------
  // "입력 확인" 버튼의 활성/비활성을 제어하기 위한 참조. 입력이 바뀔 때마다 revalidate()가 다시 계산합니다.
  let confirmBtn = null;

  // Check Gate 진입 시 pushState()로 쌓은 더미 history 항목을 관리하기 위한 popstate 리스너 참조.
  // "다시 수정" 버튼과 물리 뒤로가기(화면 내 "←" 포함)만 이 리스너를 거칩니다. "운동 완료"는 데이터
  // 저장(judge/gain/storage)이라는 핵심 동작을 브라우저 navigation 이벤트에 의존시키지 않기 위해
  // popstate와 완전히 분리해 onFinish()를 직접 호출합니다(아래 onCheckGateComplete 참고).
  let checkGatePopstateHandler = null;

  // 필수 입력(본세트 전체 / 편측 좌·우 모두 / 워밍업 있으면 중량+수행값 / 도전세트 있으면 중량+수행값)이
  // 모두 채워졌는지 검사합니다. judge.js의 parseSetInput()을 그대로 재사용해 "빈 입력" 판정 기준을
  // judge 로직과 항상 일치시키며, judge.js 자체는 수정하지 않습니다.
  function isEntryComplete() {
    return draft.plan.every((row) => {
      const ex = row.exercise;

      if (row.warmup) {
        const w = row.warmup.weight;
        const weightOk = w !== null && w !== undefined && w !== "";
        const performedOk = ex.isUnilateral
          ? !parseSetInput(row.warmup.leftRaw).empty && !parseSetInput(row.warmup.rightRaw).empty
          : !parseSetInput(row.warmup.performedRaw).empty;
        if (!weightOk || !performedOk) return false;
      }

      const mainSetsOk = row.mainSets.every((s) =>
        ex.isUnilateral
          ? !parseSetInput(s.leftRaw).empty && !parseSetInput(s.rightRaw).empty
          : !parseSetInput(s.performedRaw).empty
      );
      if (!mainSetsOk) return false;

      if (row.challengeSet) {
        const w = row.challengeSet.weight;
        const weightOk = w !== null && w !== undefined && w !== "";
        if (!weightOk || parseSetInput(row.challengeSet.performedRaw).empty) return false;
      }

      return true;
    });
  }

  function revalidate() {
    if (confirmBtn) confirmBtn.disabled = !isEntryComplete();
    scheduleDraftSave();
  }
  // ------------------------------------------------------------------------

  // v2.3.0 Draft 자동 저장 --------------------------------------------------
  // 입력이 바뀔 때마다(revalidate 경유) 디바운스(약 0.8초)로 저장합니다. Polling/Interval은 쓰지 않고,
  // 순수 이벤트(입력 변경) 기반으로만 저장합니다. 저장 위치는 storage.js의 별도 key(STORAGE_KEY와 분리)라
  // 메인 데이터/SCHEMA_VERSION과 무관합니다.
  let draftSaveTimer = null;
  function scheduleDraftSave() {
    if (draftSaveTimer) clearTimeout(draftSaveTimer);
    draftSaveTimer = setTimeout(() => {
      state.saveDraft(draft);
    }, 800);
  }
  // ------------------------------------------------------------------------

  // v2.1.0: 큐노트 팝업은 "같은 아이콘을 다시 터치하면 닫힘" 토글 방식입니다.
  // 화면 전체에서 한 번에 하나만 열리도록, 현재 열려 있는 종목 id와 닫기 함수를 여기서 추적합니다.
  let openCueExerciseId = null;
  let closeCueViewer = null;
  function toggleCueViewer(ex) {
    if (openCueExerciseId === ex.id) {
      if (closeCueViewer) closeCueViewer();
      return;
    }
    if (closeCueViewer) closeCueViewer();
    openCueExerciseId = ex.id;
    closeCueViewer = openModal(buildCueNoteViewerContent(ex), {
      dismissible: true,
      onClose: () => {
        openCueExerciseId = null;
        closeCueViewer = null;
      },
    });
  }

  // v1.1: 표 열 순서를 "중량 → 목표 → 수행 → 판정"으로 변경 (중량/목표를 먼저 보고 수행을 입력하는 흐름)
  function buildTableRow(row) {
    const nodes = [];
    const ex = row.exercise;

    if (row.warmup) {
      nodes.push(
        el("div", { class: "set-row warmup" }, [
          // v2.1.0 Patch: 워밍업 여부는 행 배경 강조로 이미 구분되므로 텍스트에서 "· 워밍업"은 제거
          el("span", { class: "ex-name", text: ex.name }),
          el(
            "span",
            { class: "col" },
            ex.gainMethod === "bodyweight"
              ? el("span", { text: "" })
              : el("input", {
                  class: "cell-input",
                  type: "number",
                  inputmode: "decimal",
                  value: row.warmup.weight ?? undefined,
                  placeholder: "-",
                  oninput: (e) => {
                    row.warmup.weight = e.target.value === "" ? null : Number(e.target.value);
                    revalidate();
                  },
                })
          ),
          el("span", { class: "col", text: String(row.warmup.targetReps) }),
          el(
            "span",
            { class: "col" },
            ex.isUnilateral
              ? dualPerformedInput(
                  () => row.warmup.leftRaw,
                  () => row.warmup.rightRaw,
                  (v) => {
                    row.warmup.leftRaw = v;
                    revalidate();
                  },
                  (v) => {
                    row.warmup.rightRaw = v;
                    revalidate();
                  }
                )
              : performedInput(() => row.warmup.performedRaw, (v) => {
                  row.warmup.performedRaw = v;
                  revalidate();
                })
          ),
          el("span", { class: "col" }),
        ])
      );
    }

    row.mainSets.forEach((s, i) => {
      const performedCell = ex.isUnilateral
        ? dualPerformedInput(
            () => s.leftRaw,
            () => s.rightRaw,
            (v) => {
              s.leftRaw = v;
              revalidate();
            },
            (v) => {
              s.rightRaw = v;
              revalidate();
            }
          )
        : performedInput(() => s.performedRaw, (v) => {
            s.performedRaw = v;
            revalidate();
          });
      nodes.push(
        el("div", { class: "set-row" }, [
          el("span", { class: "ex-name", text: "" }),
          el("span", { class: "col", text: ex.gainMethod === "bodyweight" ? "" : String(s.weight) }),
          el("span", { class: "col", text: formatTarget(ex, s.targetReps) }),
          el("span", { class: "col" }, performedCell),
          el("span", { class: "col" }),
        ])
      );
    });
    // 종목명은 표의 첫 행(워밍업이 있으면 워밍업 행, 없으면 첫 본세트 행)에만 표시
    if (!row.warmup && row.mainSets.length) {
      nodes[0].querySelector(".ex-name").textContent = ex.name;
    }

    if (row.challengeSet) {
      nodes.push(
        el("div", { class: "set-row challenge" }, [
          el("span", { class: "ex-name", text: "" }),
          el(
            "span",
            { class: "col" },
            el("input", {
              class: "cell-input",
              type: "number",
              inputmode: "decimal",
              placeholder: "도전",
              value: row.challengeSet.weight ?? "",
              oninput: (e) => {
                row.challengeSet.weight = e.target.value;
                revalidate();
              },
            })
          ),
          el("span", { class: "col", text: String(row.challengeSet.targetReps) }),
          el(
            "span",
            { class: "col" },
            performedInput(() => row.challengeSet.performedRaw, (v) => {
              row.challengeSet.performedRaw = v;
              revalidate();
            })
          ),
          el("span", { class: "col" }),
        ])
      );
    }

    return el("div", { class: "set-table" }, [
      el("div", { class: "head-row" }, [
        el("div", { class: "head-cue-cell" }, [buildCueIcon(ex, true, toggleCueViewer), "운동"]),
        el("div", { text: "중량" }),
        el("div", { text: "목표" }),
        el("div", { text: "수행" }),
        el("div", { text: "판정" }),
      ]),
      ...nodes,
    ]);
  }

  function renderEntryView() {
    const tableArea = el(
      "div",
      { class: "table-area" },
      draft.plan.flatMap((row, i) => [buildTableRow(row), i < draft.plan.length - 1 ? el("div", { class: "group-gap" }) : null])
    );

    confirmBtn = el("button", { class: "btn btn-primary", text: "입력 확인", onclick: openCheckGate });

    const screen = el("div", { id: "workout-screen", class: "screen-content" }, [
      el("div", { class: "topbar" }, [
        el("button", { class: "icon-btn", text: "←", onclick: () => history.back() }),
        el("div", { class: "title", text: "오늘의 운동" }),
        el("span", { style: { opacity: 0 } }, "·"),
      ]),
      tableArea,
      el("div", { class: "bottom-fixed" }, [confirmBtn]),
    ]);
    mount(root, screen);
    revalidate(); // 초기 상태(대부분 미입력) 기준으로 버튼 활성 여부를 맞춥니다.
  }

  // v2.2.0 Check Gate ----------------------------------------------------
  // 결과 화면과 동일한 레이아웃(set-table/head-row/set-row/col)으로 draft.plan(판정 이전 원본 입력값)을
  // read-only 텍스트로만 표시합니다. 판정 칸은 아직 judge가 실행되지 않았으므로 항상 공란이며,
  // 큐노트 아이콘도 결과 화면과 동일하게 표시하지 않습니다(interactive=false).
  function buildCheckGateRow(row) {
    const ex = row.exercise;
    const rows = [];

    if (row.warmup) {
      const warmupPerformedCell = ex.isUnilateral
        ? el("span", { class: "col dual-result" }, [
            el("span", { text: row.warmup.leftRaw || "-" }),
            el("span", { text: row.warmup.rightRaw || "-" }),
          ])
        : el("span", { class: "col", text: row.warmup.performedRaw || "-" });
      rows.push(
        el("div", { class: "set-row warmup" }, [
          el("span", { class: "ex-name", text: ex.name }),
          el("span", { class: "col", text: ex.gainMethod === "bodyweight" ? "" : row.warmup.weight ?? "-" }),
          el("span", { class: "col", text: String(row.warmup.targetReps) }),
          warmupPerformedCell,
          el("span", { class: "col judge" }),
        ])
      );
    }

    row.mainSets.forEach((s, i) => {
      const performedCell =
        ex.isUnilateral
          ? el("span", { class: "col dual-result" }, [
              el("span", { text: s.leftRaw || "-" }),
              el("span", { text: s.rightRaw || "-" }),
            ])
          : el("span", { class: "col", text: s.performedRaw || "-" });
      rows.push(
        el("div", { class: "set-row" }, [
          el("span", { class: "ex-name", text: !row.warmup && i === 0 ? ex.name : "" }),
          el("span", { class: "col", text: ex.gainMethod === "bodyweight" ? "" : String(s.weight) }),
          el("span", { class: "col", text: formatTarget(ex, s.targetReps) }),
          performedCell,
          el("span", { class: "col judge" }),
        ])
      );
    });

    if (row.challengeSet) {
      rows.push(
        el("div", { class: "set-row challenge" }, [
          el("span", { class: "ex-name", text: "" }),
          el("span", { class: "col", text: row.challengeSet.weight ?? "-" }),
          el("span", { class: "col", text: String(row.challengeSet.targetReps) }),
          el("span", { class: "col", text: row.challengeSet.performedRaw || "-" }),
          el("span", { class: "col judge" }),
        ])
      );
    }

    return el("div", { class: "set-table" }, [
      el("div", { class: "head-row" }, [
        el("div", { class: "head-cue-cell" }, [buildCueIcon(ex, false, null), "운동"]),
        el("div", { text: "중량" }),
        el("div", { text: "목표" }),
        el("div", { text: "수행" }),
        el("div", { text: "판정" }),
      ]),
      ...rows,
    ]);
  }

  function renderCheckGateView() {
    const tableArea = el(
      "div",
      { class: "table-area" },
      draft.plan.flatMap((row, i) => [buildCheckGateRow(row), i < draft.plan.length - 1 ? el("div", { class: "group-gap" }) : null])
    );

    const screen = el("div", { id: "workout-checkgate-screen", class: "screen-content" }, [
      el("div", { class: "topbar" }, [
        // 화면 내 "←"도 물리 뒤로가기와 동일하게 history.back()만 호출합니다. 별도 플래그를 세우지 않으므로
        // popstate 핸들러가 기본값(= "다시 수정")으로 처리합니다.
        el("button", { class: "icon-btn", text: "←", onclick: () => history.back() }),
        el("div", { class: "title", text: "입력 확인" }),
        el("span", { style: { opacity: 0 } }, "·"),
      ]),
      tableArea,
      el("div", { class: "bottom-fixed" }, [
        el("div", { class: "btn-row-h" }, [
          el("button", { class: "btn btn-ghost", text: "다시 수정", onclick: onCheckGateRetry }),
          el("button", { class: "btn btn-primary", text: "운동 완료", onclick: onCheckGateComplete }),
        ]),
      ]),
    ]);
    mount(root, screen);
  }

  // "입력 확인" 버튼(입력 화면)을 눌렀을 때만 호출됩니다. 필수 입력이 모두 채워져야 버튼이 활성화되므로
  // 여기서는 방어적으로 한 번 더 확인만 하고, 실제 judge/gain/storage는 전혀 실행하지 않습니다.
  function openCheckGate() {
    if (!isEntryComplete()) return;

    history.pushState({ __checkGate: true }, "", location.hash);
    checkGatePopstateHandler = () => {
      window.removeEventListener("popstate", checkGatePopstateHandler);
      checkGatePopstateHandler = null;
      // 이 핸들러가 실행된다는 것 자체가 "다시 수정" 버튼 또는 물리/화면 내 뒤로가기라는 뜻입니다.
      // (운동 완료는 onCheckGateComplete에서 이 리스너를 먼저 제거하므로 여기로 오지 않습니다.)
      renderEntryView();
    };
    window.addEventListener("popstate", checkGatePopstateHandler);

    renderCheckGateView();
  }

  function onCheckGateRetry() {
    history.back(); // pushState로 쌓은 더미 항목을 소비 -> popstate -> 위 핸들러가 입력 화면으로 복귀
  }

  // 운동 완료: history 정리(리스너 제거 + back())를 먼저 끝내 Check Gate의 흔적을 지운 뒤,
  // 기존 onFinish()를 그 자리에서 곧바로(동기적으로) 호출합니다. 순서를 이렇게 정한 이유는
  // 아래 onFinish() 바로 위 주석에 정리했습니다.
  function onCheckGateComplete() {
    if (checkGatePopstateHandler) {
      window.removeEventListener("popstate", checkGatePopstateHandler);
      checkGatePopstateHandler = null;
    }
    history.back(); // 리스너가 이미 사라진 상태이므로, 이후 popstate가 언제 발생하든 아무 반응도 하지 않음(안전한 no-op)
    onFinish();
  }
  // ------------------------------------------------------------------------

  // 기존 "운동 종료" 버튼이 하던 일 그대로입니다. v2.2.0에서는 호출 위치만 Check Gate의
  // "운동 완료" 버튼(onCheckGateComplete)으로 옮겼을 뿐이며, popstate/브라우저 navigation 이벤트를
  // 전혀 거치지 않고 버튼 클릭 시점에 즉시(동기적으로) 실행됩니다. finishSession/showDurationPopup
  // 호출 구조는 v2.1과 완전히 동일합니다.
  function onFinish() {
    finishedSession = state.finishSession(draft);
    state.clearDraft(); // v2.3.0: 운동 완료 시에만 draft 삭제(그 외에는 뒤로가기/새로고침/앱 종료 모두 draft 유지)
    showDurationPopup();
  }

  function showDurationPopup() {
    const content = el("div", { class: "duration-modal" }, [
      el("div", { class: "duration-title", text: "운동 시간" }),
      el("div", { class: "duration-big", text: fmtDuration(finishedSession.durationMinutes) }),
      el("div", { class: "time-detail" }, [
        el("b", { text: fmtClock(finishedSession.startTime) }),
        document.createTextNode(" 시작 → "),
        el("b", { text: fmtClock(finishedSession.endTime) }),
        document.createTextNode(" 종료"),
      ]),
      el("button", { class: "btn btn-primary", text: "해냈습니다!", onclick: () => { close(); renderResultView(); } }),
    ]);
    const close = openModal(content);
  }

  function renderResultView() {
    const groups = finishedSession.records.map((rec, idx) => {
      const ex = draft.plan[idx].exercise;
      const rows = [];
      if (rec.warmup) {
        const warmupPerformedCell = ex.isUnilateral
          ? el("span", { class: "col dual-result" }, [
              el("span", { text: rec.warmup.leftRaw || "-" }),
              el("span", { text: rec.warmup.rightRaw || "-" }),
            ])
          : el("span", { class: "col", text: rec.warmup.performedRaw || "-" });
        rows.push(
          el("div", { class: "set-row warmup" }, [
            el("span", { class: "ex-name", text: ex.name }),
            el("span", { class: "col", text: ex.gainMethod === "bodyweight" ? "" : rec.warmup.weight ?? "-" }),
            el("span", { class: "col", text: String(rec.warmup.targetReps) }),
            warmupPerformedCell,
            el("span", { class: "col" }),
          ])
        );
      }
      const mainSets = rec.sets.filter((s) => !s.isChallenge && !s.isWarmup);
      const challengeSet = rec.sets.find((s) => s.isChallenge);
      // v1.2: 고반복이 상한을 모두 연속 달성해 자동 증량된 경우 "증량!"으로 표시(마지막 본세트 행에 표기)
      const gainLabel = rec.gainEvent === "auto_increase" ? "증량!" : null;
      // v2.2.1: 도전세트가 있는 종목은 "본세트 A/B/X"와 "도전세트 성공/재도전"이 동시에 표시되어 혼란을
      // 준다는 피드백에 따라, 도전세트가 있으면 본세트 쪽 판정 칸은 비워두고 도전세트 판정만 보여줍니다.
      // rec.judgement/rec.gainEvent 값 자체(=judge.js/gain.js/state.js가 계산한 데이터)는 그대로이며,
      // 이 화면에서 무엇을 표시할지만 조건 처리합니다.
      mainSets.forEach((s, i) => {
        const isLast = i === mainSets.length - 1;
        const judgeText = isLast && !challengeSet ? gainLabel || rec.judgement || "" : "";
        const judgeClass = challengeSet ? "" : gainLabel ? "judge-gain" : rec.judgement ? `judge-${rec.judgement.toLowerCase()}` : "";
        const performedCell =
          s.leftRaw != null || s.rightRaw != null
            ? el("span", { class: "col dual-result" }, [
                el("span", { text: s.leftRaw || "-" }),
                el("span", { text: s.rightRaw || "-" }),
              ])
            : el("span", { class: "col", text: s.performedRaw || "-" });
        rows.push(
          el("div", { class: "set-row" }, [
            el("span", { class: "ex-name", text: !rec.warmup && i === 0 ? ex.name : "" }),
            el("span", { class: "col", text: ex.gainMethod === "bodyweight" ? "" : String(rec.weightUsed) }),
            el("span", { class: "col", text: formatTarget(ex, s.targetReps) }),
            performedCell,
            el("span", { class: `col judge ${judgeClass}`, text: judgeText }),
          ])
        );
      });
      if (challengeSet) {
        // v1.2: 성공 문구에 느낌표 추가("성공!"), 재도전은 기존 표현 유지
        const resultText = rec.challengeResult === "success" ? "성공!" : "재도전";
        rows.push(
          el("div", { class: "set-row challenge" }, [
            el("span", { class: "ex-name", text: "" }),
            el("span", { class: "col", text: rec.challengeWeight ?? "-" }),
            el("span", { class: "col", text: String(challengeSet.targetReps) }),
            el("span", { class: "col", text: challengeSet.performedRaw || "-" }),
            el("span", { class: `col judge judge-${rec.challengeResult === "success" ? "a" : "x"}`, text: resultText }),
          ])
        );
      }
      return el("div", { class: "set-table" }, [
        el("div", { class: "head-row" }, [
          // v2.1.0: 결과 화면은 큐노트 기능을 제공하지 않으므로 항상 placeholder(투명)만 유지합니다(클릭 불가).
          el("div", { class: "head-cue-cell" }, [buildCueIcon(ex, false, null), "운동"]),
          el("div", { text: "중량" }),
          el("div", { text: "목표" }),
          el("div", { text: "수행" }),
          el("div", { text: "판정" }),
        ]),
        ...rows,
      ]);
    });

    const tableArea = el(
      "div",
      { class: "table-area" },
      groups.flatMap((g, i) => [g, i < groups.length - 1 ? el("div", { class: "group-gap" }) : null])
    );

    const screen = el("div", { id: "workout-result-screen", class: "screen-content" }, [
      el("div", { class: "topbar" }, [
        el("button", { class: "icon-btn", text: "←", onclick: () => afterResult() }),
        el("div", { class: "title", text: "운동 결과" }),
        el("span", { style: { opacity: 0 } }, "·"),
      ]),
      tableArea,
      el("div", { class: "bottom-fixed" }, [el("button", { class: "btn btn-primary", text: "확인", onclick: afterResult })]),
    ]);
    mount(root, screen);
  }

  function afterResult() {
    const goalAlerts = finishedSession.records.filter((r) => r.goalAdjustSuggested);
    if (goalAlerts.length > 0) {
      showGoalAdjustPopups(goalAlerts, 0, afterGoalAdjustPopups);
    } else {
      afterGoalAdjustPopups();
    }
  }

  // v1.5: 맨몸 종목이 A 연속 달성 기준을 채우면, 홈으로 넘어가기 전에 "목표 조정 검토" 안내를 순서대로 보여줍니다.
  // v1.8: "유지하기"를 선택하면 그 자리에서 즉시 pending을 해제합니다(목표 수정 화면으로 가야만 해제되던 방식에서 변경).
  function showGoalAdjustPopups(records, index, done) {
    if (index >= records.length) {
      done();
      return;
    }
    const ex = state.getExercise(records[index].exerciseId);
    const exName = ex ? ex.name : "운동";

    const content = el("div", { class: "duration-modal" }, [
      el("div", { class: "duration-title", text: `🎉 ${exName} 3회 연속 목표 달성!` }),
      el("p", { class: "detail", style: { textAlign: "center", margin: "0 0 16px" }, text: "목표 조정을 검토해보세요." }),
      el("div", { class: "btn-row" }, [
        el("button", {
          class: "btn btn-primary",
          text: "수정하기",
          onclick: () => {
            close();
            window.__draftSession = null;
            navigate(`#/exercise-edit/${records[index].exerciseId}`);
          },
        }),
        el("button", {
          class: "btn btn-ghost",
          text: "유지하기",
          onclick: () => {
            // 목표를 그대로 유지하기로 선택 → 즉시 pending 해제 + 연속 A 카운트 초기화.
            // 이후 같은 종목에서 다시 A-A-A를 달성하면 새로운 팝업이 뜰 수 있습니다.
            state.clearBodyweightGoalPending(records[index].exerciseId);
            close();
            showGoalAdjustPopups(records, index + 1, done);
          },
        }),
      ]),
    ]);
    const close = openModal(content);
  }

  function afterGoalAdjustPopups() {
    const highRepAlerts = finishedSession.records.filter((r) => r.highRepGoalReviewSuggested);
    if (highRepAlerts.length > 0) {
      showHighRepReviewPopups(highRepAlerts, 0, proceedAfterResult);
    } else {
      proceedAfterResult();
    }
  }

  // v1.8: 고반복(high_rep) 종목이 상한 반복수를 모든 본세트에서 연속 달성하면, 자동 증량 대신
  // "목표 중량 검토" 안내를 1회성으로 보여줍니다. ExerciseState에는 아무 것도 저장하지 않으므로,
  // "유지하기"를 선택해도 별도 상태가 남지 않고 다음 세션은 그 세션의 결과만으로 다시 판단됩니다.
  // (맨몸의 showGoalAdjustPopups와는 완전히 별개의 함수/문구/필드를 사용합니다.)
  function showHighRepReviewPopups(records, index, done) {
    if (index >= records.length) {
      done();
      return;
    }
    const ex = state.getExercise(records[index].exerciseId);
    const exName = ex ? ex.name : "운동";

    const content = el("div", { class: "duration-modal" }, [
      el("div", { class: "duration-title", text: `🎉 ${exName}` }),
      el("p", { class: "detail", style: { textAlign: "center", margin: "0 0 16px" }, text: "상한 반복수를 달성했습니다.\n중량 조정을 검토해보세요." }),
      el("div", { class: "btn-row" }, [
        el("button", {
          class: "btn btn-primary",
          text: "수정하기",
          onclick: () => {
            close();
            window.__draftSession = null;
            navigate(`#/exercise-edit/${records[index].exerciseId}`);
          },
        }),
        el("button", {
          class: "btn btn-ghost",
          text: "유지하기",
          onclick: () => {
            // high_rep은 pending 상태를 저장하지 않으므로 여기서 할 일은 팝업을 닫고 다음으로 넘어가는 것뿐입니다.
            // 현재 중량/하한/상한은 그대로 유지되며, 다음 세션은 이번 선택과 무관하게 그 세션 결과만으로 다시 판단됩니다.
            close();
            showHighRepReviewPopups(records, index + 1, done);
          },
        }),
      ]),
    ]);
    const close = openModal(content);
  }

  // v1.8: 운동 종료 직후 후보 선택 화면으로 강제 이동하지 않습니다. 항상 홈으로 이동하고,
  // 도전 후보가 있으면 홈 화면의 플로팅 버튼으로만 진입할 수 있습니다.
  function proceedAfterResult() {
    window.__draftSession = null;
    navigate("#/home", { replace: true });
  }

  renderEntryView();
}
