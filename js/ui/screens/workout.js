// screens/workout.js
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import { openModal } from "../components/modal.js";
import { buildCueNoteViewerContent } from "../components/cueNoteViewer.js";
import * as state from "../../core/state.js";
import { DAYS } from "../../core/models.js";

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
function dualPerformedInput(setLeft, setRight) {
  const leftInput = el("input", {
    class: "cell-input dual",
    type: "text",
    inputmode: "tel",
    placeholder: "-",
    oninput: (e) => setLeft(e.target.value),
  });
  const rightInput = el("input", {
    class: "cell-input dual",
    type: "text",
    inputmode: "tel",
    placeholder: "-",
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

  const dayLabel = DAYS.find((d) => d.key === draft.day)?.label || "";
  let finishedSession = null;

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
                  value: row.warmup.weight ?? "",
                  placeholder: "-",
                  oninput: (e) => (row.warmup.weight = e.target.value === "" ? null : Number(e.target.value)),
                })
          ),
          el("span", { class: "col", text: String(row.warmup.targetReps) }),
          el("span", { class: "col" }, performedInput(null, (v) => (row.warmup.performedRaw = v))),
          el("span", { class: "col" }),
        ])
      );
    }

    row.mainSets.forEach((s, i) => {
      const performedCell = ex.isUnilateral
        ? dualPerformedInput((v) => (s.leftRaw = v), (v) => (s.rightRaw = v))
        : performedInput(null, (v) => (s.performedRaw = v));
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
              oninput: (e) => (row.challengeSet.weight = e.target.value),
            })
          ),
          el("span", { class: "col", text: String(row.challengeSet.targetReps) }),
          el("span", { class: "col" }, performedInput(null, (v) => (row.challengeSet.performedRaw = v))),
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

    const screen = el("div", { id: "workout-screen", class: "screen-content" }, [
      el("div", { class: "topbar" }, [
        el("button", { class: "icon-btn", text: "←", onclick: () => history.back() }),
        el("div", { class: "title", text: `${dayLabel} · 오늘의 운동` }),
        el("span", { style: { opacity: 0 } }, "·"),
      ]),
      tableArea,
      el("div", { class: "bottom-fixed" }, [el("button", { class: "btn btn-primary", text: "운동 종료", onclick: onFinish })]),
    ]);
    mount(root, screen);
  }

  function onFinish() {
    finishedSession = state.finishSession(draft);
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
        rows.push(
          el("div", { class: "set-row warmup" }, [
            el("span", { class: "ex-name", text: ex.name }),
            el("span", { class: "col", text: ex.gainMethod === "bodyweight" ? "" : rec.warmup.weight ?? "-" }),
            el("span", { class: "col", text: String(rec.warmup.targetReps) }),
            el("span", { class: "col", text: rec.warmup.performedRaw || "-" }),
            el("span", { class: "col" }),
          ])
        );
      }
      const mainSets = rec.sets.filter((s) => !s.isChallenge && !s.isWarmup);
      // v1.2: 고반복이 상한을 모두 연속 달성해 자동 증량된 경우 "증량!"으로 표시(마지막 본세트 행에 표기)
      const gainLabel = rec.gainEvent === "auto_increase" ? "증량!" : null;
      mainSets.forEach((s, i) => {
        const isLast = i === mainSets.length - 1;
        const judgeText = isLast ? gainLabel || rec.judgement || "" : "";
        const judgeClass = gainLabel ? "judge-gain" : rec.judgement ? `judge-${rec.judgement.toLowerCase()}` : "";
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
      const challengeSet = rec.sets.find((s) => s.isChallenge);
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
        el("div", { class: "title", text: `${dayLabel} · 결과` }),
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
