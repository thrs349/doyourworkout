// screens/exerciseForm.js
// 종목 "추가"(#/exercise-form/:day)와 "수정"(#/exercise-edit/:id) 화면을 함께 다룹니다.
import { el, mount } from "../dom.js";
import { navigate } from "../router.js";
import * as state from "../../core/state.js";
import { BODY_PARTS, secondaryTagsFor, ROLES } from "../../core/models.js";
import { showAlert } from "../components/modal.js";

function stepper(initial, min, max) {
  let value = initial;
  const valEl = el("div", { class: "sval", text: String(value) });
  const dec = el("button", { class: "step-btn", text: "–", onclick: () => set(value - 1) });
  const inc = el("button", { class: "step-btn", text: "+", onclick: () => set(value + 1) });
  function set(v) {
    value = Math.max(min, Math.min(max, v));
    valEl.textContent = String(value);
  }
  const node = el("div", { class: "stepper" }, [dec, valEl, inc]);
  return { node, get: () => value };
}

function numberField(labelText, initialValue, placeholder) {
  let raw = initialValue === null || initialValue === undefined ? "" : String(initialValue);
  const input = el("input", {
    class: "text-input",
    type: "number",
    inputmode: "decimal",
    placeholder: placeholder || "",
    value: raw,
    oninput: (e) => (raw = e.target.value),
  });
  const group = el("div", { class: "field-group" }, [el("div", { class: "field-label", text: labelText }), input]);
  return { group, get: () => (raw === "" ? null : Number(raw)) };
}

// exerciseId가 있으면 수정, 없으면 신규 추가입니다.
function renderForm(root, { title, exerciseId, defInitial, stateInitial, onBack, afterSaveHash }) {
  let name = defInitial.name;
  let gainMethod = defInitial.gainMethod;
  let bodyweightGoalType = defInitial.bodyweightGoalType || "reps";
  let warmupEnabled = defInitial.warmupEnabled;
  let isUnilateral = defInitial.isUnilateral;
  // v2.6.0: 운동 태그 시스템(탐색 전용). judge.js/gain.js와 무관한 필드입니다.
  let primaryBodyPart = defInitial.primaryBodyPart ?? null;
  let secondaryTags = new Set(defInitial.secondaryTags || []);
  // v2.7.0: 운동 역할(볼륨 계산 전용, 루틴별이 아닌 종목 자체의 기본 역할). judge.js/gain.js와 무관합니다.
  // 코어(primaryBodyPart==="코어")는 이 토글 자체를 숨기고 항상 "main"으로 저장합니다
  // (effectiveRole()이 표시/계산 시 primaryBodyPart를 보고 "코어"로 자동 파생하므로, 저장값 자체는 의미가 없습니다).
  let role = defInitial.role || ROLES.MAIN;

  const isEdit = !!exerciseId;

  const nameInput = el("input", {
    class: "text-input",
    type: "text",
    placeholder: "예: 레그프레스",
    value: name,
    oninput: (e) => (name = e.target.value),
  });
  const nameGroup = el("div", { class: "field-group" }, [el("div", { class: "field-label", text: "운동명" }), nameInput]);

  // v2.7.4 UI 롤백: v2.7.2에서 도입했던 "운동명 입력칸+역할 토글 같은 행" 배치를 되돌립니다. 이름 입력칸 폭을
  // 줄여야 하는 부작용(긴 운동명 표시를 위해 역할 토글까지 좌측으로 몰리며 우측에 빈 공간 발생)이 있었고,
  // 증량방식/운동부위처럼 "헤더 위 + 전체 폭 컨트롤 아래"라는 화면의 다른 필드 구조와도 통일성이 떨어졌습니다.
  // 이제 역할 토글은 별도 field-group으로 분리하고, field-label(헤더)도 다른 헤더들과 동일한 클래스/정렬을
  // 그대로 사용해 y축 시작 위치가 자연히 맞습니다. 토글 자체는 기존 활성/비활성 switch를 재사용하되, 다른
  // toggle-row(편측성/워밍업)와 동일하게 좌우 여유 패딩이 있는 박스 안에 배치합니다.
  const roleStateLabel = el("span", { text: role === ROLES.ASSIST ? "보조" : "메인" });
  const roleSwitch = el("button", {
    class: `switch${role === ROLES.ASSIST ? " on" : ""}`,
    onclick: () => {
      role = role === ROLES.ASSIST ? ROLES.MAIN : ROLES.ASSIST;
      roleSwitch.classList.toggle("on", role === ROLES.ASSIST);
      roleStateLabel.textContent = role === ROLES.ASSIST ? "보조" : "메인";
    },
  });
  const roleGroup = el("div", { class: "field-group" }, [
    el("div", { class: "field-label", text: "메인/보조" }),
    el("div", { class: "toggle-row" }, [roleStateLabel, roleSwitch]),
  ]);

  function refreshRoleUI() {
    // 코어(primaryBodyPart==="코어")는 항상 자동으로 코어 취급되므로, 역할 그룹 전체(헤더+토글)를 숨깁니다.
    // 운동명은 이제 완전히 별개의 field-group이라 이 토글과 무관하게 항상 그대로 표시됩니다.
    roleGroup.style.display = primaryBodyPart === "코어" ? "none" : "block";
  }

  // ---- 증량 방식 4분기 토글 ----
  const methodOpts = {
    machine: el("div", { class: "type-opt", text: "머신", onclick: () => selectMethod("machine") }),
    freeweight: el("div", { class: "type-opt", text: "프리웨이트", onclick: () => selectMethod("freeweight") }),
    high_rep: el("div", { class: "type-opt", text: "고반복", onclick: () => selectMethod("high_rep") }),
    bodyweight: el("div", { class: "type-opt", text: "맨몸", onclick: () => selectMethod("bodyweight") }),
  };

  // ---- 맨몸 전용: 목표 유형(반복수/시간) 토글 ----
  const goalTypeOpts = {
    reps: el("div", { class: "type-opt", text: "반복수 기반", onclick: () => selectGoalType("reps") }),
    time: el("div", { class: "type-opt", text: "시간 기반", onclick: () => selectGoalType("time") }),
  };
  const goalTypeGroup = el("div", { class: "field-group" }, [
    el("div", { class: "field-label", text: "목표 유형" }),
    el("div", { class: "type-toggle" }, [goalTypeOpts.reps, goalTypeOpts.time]),
  ]);

  // ---- v2.6.0: 운동 부위(필수, 단일 선택) ----
  const bodyPartOpts = Object.fromEntries(
    BODY_PARTS.map((part) => [part, el("div", { class: "type-opt", text: part, onclick: () => selectBodyPart(part) })])
  );
  // v2.6.6: 실기기 테스트 반영 - 운동 부위 행과 바로 아래 보조 태그 행 사이 간격만 좁힙니다(기본
  // .field-group 하단 여백 16px -> 6px). 다른 필드 그룹(운동명/증량방식/목표유형 등)의 간격에는 영향 없도록
  // 공용 .field-group 클래스는 그대로 두고 이 요소에만 인라인 스타일로 덮어씁니다.
  const bodyPartGroup = el("div", { class: "field-group", style: { marginBottom: "6px" } }, [
    el("div", { class: "field-label", text: "운동 부위" }),
    el("div", { class: "type-toggle" }, BODY_PARTS.map((part) => bodyPartOpts[part])),
  ]);

  // ---- v2.6.3: 보조 태그(선택, 복수 선택) - 선택된 운동 부위에 맞는 태그 목록으로 매번 다시 그립니다.
  // (상체: 가슴/등/어깨/팔, 하체: 대퇴사두/둔근/햄스트링, 코어: 없음 - secondaryTagsFor()가 빈 배열 반환) ----
  let secondaryTagOpts = {};
  // v2.6.5: 실기기 테스트 반영 - "보조 태그" 텍스트 라벨을 제거합니다(버튼 기능/저장 구조는 그대로 유지).
  const secondaryTagButtons = el("div", { class: "type-toggle" });
  const secondaryTagGroup = el("div", { class: "field-group" }, [secondaryTagButtons]);

  function rebuildSecondaryTagButtons() {
    const tags = secondaryTagsFor(primaryBodyPart);
    secondaryTagOpts = Object.fromEntries(
      tags.map((tag) => [tag, el("div", { class: "type-opt", text: tag, onclick: () => toggleSecondaryTag(tag) })])
    );
    secondaryTagButtons.replaceChildren(...tags.map((tag) => secondaryTagOpts[tag]));
    secondaryTagGroup.style.display = tags.length > 0 ? "block" : "none";
  }

  function refreshBodyPartUI() {
    BODY_PARTS.forEach((part) => bodyPartOpts[part].classList.toggle("selected", part === primaryBodyPart));
    Object.keys(secondaryTagOpts).forEach((tag) => secondaryTagOpts[tag].classList.toggle("selected", secondaryTags.has(tag)));
  }
  function selectBodyPart(part) {
    primaryBodyPart = primaryBodyPart === part ? null : part;
    // 부위가 바뀌면(또는 선택 해제되면) 보조 태그 선택값을 초기화합니다(부위마다 태그 목록 자체가 다르므로).
    secondaryTags = new Set();
    rebuildSecondaryTagButtons();
    refreshBodyPartUI();
    refreshRoleUI(); // v2.7.0: 코어 선택/해제에 따라 역할 토글 표시 여부가 바뀝니다.
  }
  function toggleSecondaryTag(tag) {
    if (secondaryTags.has(tag)) secondaryTags.delete(tag);
    else secondaryTags.add(tag);
    refreshBodyPartUI();
  }

  function refreshMethodUI() {
    Object.entries(methodOpts).forEach(([key, node]) => node.classList.toggle("selected", key === gainMethod));
    Object.entries(goalTypeOpts).forEach(([key, node]) => node.classList.toggle("selected", key === bodyweightGoalType));

    const isHighRep = gainMethod === "high_rep";
    const isBodyweight = gainMethod === "bodyweight";
    const isBodyweightTime = isBodyweight && bodyweightGoalType === "time";

    goalTypeGroup.style.display = isBodyweight ? "block" : "none";
    highRepFields.style.display = isHighRep ? "flex" : "none"; // v2.3.2: 하한/상한 같은 행 배치(flex)로 변경됨에 따라 block이 아닌 flex로 토글
    repsField.group.style.display = isHighRep || isBodyweightTime ? "none" : "block";
    targetSecondsField.group.style.display = isBodyweightTime ? "block" : "none";

    // v1.9.1: 맨몸은 중량 추적 대상이 아니므로 "목표 중량"과 "워밍업 세트" 관련 입력을 전부 숨깁니다.
    // (판정 로직은 건드리지 않고 설정 화면 표시만 제어합니다.)
    targetWeightField.group.style.display = isBodyweight ? "none" : "block";
    warmupToggleGroup.style.display = isBodyweight ? "none" : "block";
    warmupRepsGroup.style.display = !isBodyweight && warmupEnabled ? "block" : "none";
  }
  function selectMethod(m) {
    gainMethod = m;
    refreshMethodUI();
  }
  function selectGoalType(t) {
    bodyweightGoalType = t;
    refreshMethodUI();
  }

  const setsStepper = stepper(defInitial.baseSets, 1, 8);
  const repsField = numberField("세트당 목표 횟수", defInitial.targetReps, "예: 12");

  // ---- 고반복 전용 필드 ----
  const highRepLowerField = numberField("하한 반복수", defInitial.highRepLower, "예: 15");
  const highRepUpperField = numberField("상한 반복수", defInitial.highRepUpper, "예: 20");
  // v1.9.1: "상한 연속 달성 시 자동 증량폭(kg)" 입력 UI 제거 — 자동 증량 로직 자체가 이미 없어서 이 값은
  // 어디서도 읽히지 않는 죽은 필드였습니다. models.js/storage.js의 highRepIncrement 필드 자체는
  // 기존 데이터 호환을 위해 그대로 남겨두고, UI에서만 제거합니다.
  // v2.3.2: 하한/상한을 같은 행에 50%씩 배치(인라인 스타일만 사용, CSS 파일 무수정).
  highRepLowerField.group.style.flex = "1";
  highRepLowerField.group.style.minWidth = "0";
  highRepUpperField.group.style.flex = "1";
  highRepUpperField.group.style.minWidth = "0";
  const highRepFields = el("div", { style: { display: "flex", gap: "10px" } }, [highRepLowerField.group, highRepUpperField.group]);

  // ---- 맨몸(시간 기반) 전용 필드 ----
  const targetSecondsField = numberField("목표 시간 (초)", defInitial.targetSeconds, "예: 30");

  // ---- 편측성(좌우 구분) - 증량 방식과 무관하게 항상 표시 ----
  const unilateralSwitch = el("button", {
    class: `switch${isUnilateral ? " on" : ""}`,
    onclick: () => {
      isUnilateral = !isUnilateral;
      unilateralSwitch.classList.toggle("on", isUnilateral);
      refreshMethodUI();
    },
  });
  const unilateralGroup = el("div", { class: "field-group" }, [
    el("div", { class: "toggle-row" }, [el("span", { text: "편측성 운동 (좌우 구분)" }), unilateralSwitch]),
  ]);

  // ---- 워밍업 ----
  const warmupRepsField = numberField("워밍업 목표 횟수", defInitial.warmupTargetReps, "예: 8");
  const warmupRepsGroup = warmupRepsField.group;
  warmupRepsGroup.style.display = warmupEnabled ? "block" : "none";

  const warmupSwitch = el("button", {
    class: `switch${warmupEnabled ? " on" : ""}`,
    onclick: () => {
      warmupEnabled = !warmupEnabled;
      warmupSwitch.classList.toggle("on", warmupEnabled);
      warmupRepsGroup.style.display = warmupEnabled ? "block" : "none";
    },
  });
  const warmupToggleGroup = el("div", { class: "field-group" }, [
    el("div", { class: "toggle-row" }, [el("span", { text: "워밍업 세트 사용" }), warmupSwitch]),
  ]);

  // ---- 목표 중량 (현재 중량) ----
  // v2.3.2: 신규 종목의 초기값을 0이 아니라 null로 바꿔, 진짜 "빈 칸"에서 시작하도록 합니다.
  // (0으로 프리필되어 있으면 사용자가 지우지 않는 한 항상 "값이 있는" 상태라 방금 추가한 필수 입력 검증이 걸리지 않고,
  // 화면에도 의미 없는 0이 표시되는 문제가 있었습니다.)
  const targetWeightField = numberField("목표 중량 (kg)", isEdit ? stateInitial.currentWeight : null, "예: 40");
  // v2.3.2: "워밍업 중량"/"도전세트 중량" 설정 필드는 종목 관리 화면에서 제거했습니다. 이제 두 값 모두
  // 운동 화면에서 실제 수행 흐름에 따라 관리됩니다(워밍업: warmupWeightOverride를 state.js가 자동 갱신,
  // 도전세트: 매번 직접 입력하거나 실패 시 재도전 기억값을 그대로 사용). 저장 로직은 state.js의
  // setWarmupWeightOverride()/setChallengeWeightDefault()를 그대로 두되(다른 화면에서 재사용될 가능성 대비),
  // 이 화면에서는 더 이상 호출하지 않습니다.

  const screen = el("div", { id: "exercise-form-screen", class: "screen-content" }, [
    el("div", { class: "topbar" }, [
      el("button", { class: "icon-btn", text: "←", onclick: onBack }),
      el("div", { class: "title", text: title }),
      el("span", { style: { opacity: 0 } }, "·"),
    ]),
    nameGroup,
    roleGroup,
    el("div", { class: "field-group" }, [
      el("div", { class: "field-label", text: "증량 방식" }),
      el("div", { class: "type-toggle" }, [methodOpts.machine, methodOpts.freeweight, methodOpts.high_rep, methodOpts.bodyweight]),
    ]),
    bodyPartGroup,
    secondaryTagGroup,
    goalTypeGroup,
    el("div", { class: "field-group" }, [el("div", { class: "field-label", text: "기본 세트 수" }), setsStepper.node]),
    repsField.group,
    targetSecondsField.group,
    highRepFields,
    targetWeightField.group,
    unilateralGroup,
    warmupToggleGroup,
    warmupRepsGroup,
    el("div", { class: "bottom-fixed" }, [
      el("button", {
        class: "btn btn-primary",
        text: "저장",
        onclick: () => {
          if (!name.trim()) {
            showAlert("운동명을 입력해 주세요.");
            return;
          }
          // v2.6.0: 운동 부위 선택은 신규 생성뿐 아니라 기존 종목 수정 저장 시에도 필수입니다.
          // 마이그레이션으로 primaryBodyPart가 null인 기존 종목도, 수정 화면에서 저장하려면 부위를 지정해야 합니다.
          if (!primaryBodyPart) {
            showAlert("운동 부위를 선택하세요."); // v2.6.1: 문구 수정(실기기 테스트 반영)
            return;
          }
          // v2.3.2: 목표 중량 미입력 시 조용히 currentWeight:0으로 저장되던 기존 공백을 막습니다.
          // bodyweight는 이 필드 자체가 화면에 없으므로(gainMethod !== "bodyweight" 조건으로) 자동 제외됩니다.
          if (gainMethod !== "bodyweight" && targetWeightField.get() == null) {
            showAlert("목표 중량을 입력하세요."); // v2.6.1: 문구 수정(실기기 테스트 반영)
            return;
          }
          if (gainMethod === "high_rep" && (highRepLowerField.get() == null || highRepUpperField.get() == null)) {
            showAlert("고반복 방식은 하한/상한 반복수를 입력해야 합니다.");
            return;
          }
          if (gainMethod === "bodyweight" && bodyweightGoalType === "time" && targetSecondsField.get() == null) {
            showAlert("시간 기반 맨몸 운동은 목표 시간(초)을 입력해야 합니다.");
            return;
          }

          // v1.9.1: 맨몸은 워밍업 세트를 쓰지 않으므로, UI에서 막아뒀더라도 저장 시점에 한 번 더 강제로 false 처리합니다.
          // (과거에 어떤 경로로든 warmupEnabled:true로 저장된 맨몸 종목이 있었다면 이 저장을 거치는 순간 정리됩니다.)
          const effectiveWarmupEnabled = gainMethod === "bodyweight" ? false : warmupEnabled;

          const defFields = {
            name: name.trim(),
            gainMethod,
            baseSets: setsStepper.get(),
            targetReps: repsField.get() ?? defInitial.targetReps,
            warmupEnabled: effectiveWarmupEnabled,
            warmupTargetReps: warmupRepsField.get() ?? defInitial.warmupTargetReps,
            highRepLower: gainMethod === "high_rep" ? highRepLowerField.get() : null,
            highRepUpper: gainMethod === "high_rep" ? highRepUpperField.get() : null,
            // v1.9.1: UI가 사라졌으므로 이 필드는 더 이상 사용자가 바꿀 수 없습니다.
            // 기존 값(defInitial.highRepIncrement)을 그대로 보존해 데이터 손실 없이 넘깁니다.
            highRepIncrement: gainMethod === "high_rep" ? defInitial.highRepIncrement : null,
            bodyweightGoalType: gainMethod === "bodyweight" ? bodyweightGoalType : null,
            targetSeconds: gainMethod === "bodyweight" && bodyweightGoalType === "time" ? targetSecondsField.get() : null,
            isUnilateral,
            // v2.6.0: 운동 태그 시스템(탐색 전용). secondaryTags는 상체가 아니면 UI에서 이미 비워지지만,
            // 저장 시점에도 한 번 더 방어적으로 정리합니다.
            primaryBodyPart,
            // v2.6.3: 부위 변경 시 secondaryTags를 항상 초기화하고 버튼도 해당 부위 목록으로만 다시 그리므로,
            // 이 시점의 secondaryTags Set은 이미 현재 primaryBodyPart에 유효한 태그만 담고 있습니다.
            secondaryTags: Array.from(secondaryTags),
            // v2.7.0: 코어는 역할 토글이 숨겨져 사용자가 고를 수 없으므로 항상 기본값("main")으로 저장합니다.
            // 실제 "코어" 취급은 저장값이 아니라 models.js의 effectiveRole()이 primaryBodyPart를 보고 자동 판단합니다.
            role: primaryBodyPart === "코어" ? ROLES.MAIN : role,
          };

          if (isEdit) {
            state.updateExercise(exerciseId, defFields);
            const newWeight = targetWeightField.get();
            const weightChanged = newWeight !== null && newWeight !== stateInitial.currentWeight;
            if (weightChanged) {
              state.setExerciseWeight(exerciseId, newWeight);
            }

            // v2.4.0: 맨몸 종목의 목표 기준 데이터가 "어느 방향으로든" 바뀌면, 그 기준으로 생성된 기존
            // Pending/Notification은 더 이상 유효하지 않은 것으로 판단해 함께 초기화합니다(증가만 보던 v1.7~v2.3
            // 방식에서 변경). bodyweightGoalType이 reps<->time으로 전환되는 경우도 defFields.targetReps/targetSeconds
            // 값이 null <-> 숫자로 바뀌면서 아래 두 비교에 자연히 포함되므로 별도 조건이 필요 없습니다.
            // 종목명/메모/워밍업 등 목표와 무관한 변경은 여기 해당하지 않아 pending을 그대로 유지합니다.
            if (gainMethod === "bodyweight") {
              const setsChanged = setsStepper.get() !== defInitial.baseSets;
              const targetRepsChanged = defFields.targetReps !== defInitial.targetReps;
              const targetSecondsChanged = defFields.targetSeconds !== defInitial.targetSeconds;
              const goalChanged = setsChanged || targetRepsChanged || targetSecondsChanged;
              if (goalChanged) state.clearBodyweightGoalPending(exerciseId);
            }

            // v2.4.0: 고반복 종목은 "증량 검토" 알림이 근거했던 기준 데이터(중량/하단/상단 반복수) 중
            // 하나라도 바뀌면 그 알림은 더 이상 유효하지 않은 것으로 판단해 삭제합니다(증가/감소 방향 무관,
            // 세 가지 모두 바뀔 필요 없이 OR 조건). ExerciseState는 건드리지 않으므로 Pending으로 바뀌는 것은 아닙니다.
            if (gainMethod === "high_rep") {
              const lowerChanged = defFields.highRepLower !== defInitial.highRepLower;
              const upperChanged = defFields.highRepUpper !== defInitial.highRepUpper;
              if (weightChanged || lowerChanged || upperChanged) state.clearHighRepReviewAlert(exerciseId);
            }
          } else {
            state.addExercise({ ...defFields, startWeight: targetWeightField.get() ?? 0 });
          }

          navigate(afterSaveHash, { replace: true });
        },
      }),
    ]),
  ]);

  refreshMethodUI();
  rebuildSecondaryTagButtons(); // v2.6.3: 초기(수정 진입 시 기존 부위) 태그 버튼을 먼저 그린 뒤 선택 상태를 반영
  refreshBodyPartUI();
  refreshRoleUI(); // v2.7.0: 초기 진입 시(수정 화면 등) 코어 여부에 따라 역할 토글 표시 상태를 맞춥니다.
  mount(root, screen);
}

// 새 종목 추가. 요일별 종목 선택 화면(day 있음) 또는 종목 관리 화면(day 없음) 양쪽에서 진입 가능합니다.
export function renderExerciseForm(root, params) {
  const dayKey = params.day; // 없으면(종목 관리 화면에서 진입) undefined
  renderForm(root, {
    title: "운동 추가",
    exerciseId: null,
    defInitial: {
      name: "",
      gainMethod: "machine",
      baseSets: 3,
      targetReps: 12,
      warmupEnabled: false,
      warmupTargetReps: 8,
      highRepLower: null,
      highRepUpper: null,
      highRepIncrement: null,
      bodyweightGoalType: "reps",
      targetSeconds: null,
      isUnilateral: false,
      primaryBodyPart: null,
      secondaryTags: [],
      role: ROLES.MAIN,
    },
    stateInitial: null,
    onBack: () => history.back(),
    // 생성 후에는 루틴에 자동 연결하지 않고(기존 exercisePicker 흐름과 동일 원칙),
    // 진입한 화면으로 그대로 돌아갑니다.
    afterSaveHash: dayKey ? `#/exercise-picker/${dayKey}` : "#/exercise-manage",
  });
}

// 기존 종목 수정 (종목 관리 화면 또는 Notification Center에서 진입)
export function renderExerciseEdit(root, params) {
  // v2.4.1: Notification Center(고반복/맨몸 카드의 "목표 수정")에서 진입한 경우, 저장 후 그 화면으로
  // 돌아가야 합니다. notificationCenter.js가 navigate 직전에 세팅해두는 임시 플래그를 여기서 한 번만
  // 읽고 즉시 비웁니다 — router.js(쿼리스트링 파싱 등)는 전혀 건드리지 않는 최소 변경입니다.
  // 플래그가 없으면(종목 관리 등 다른 경로로 진입) 기존과 동일하게 #/exercise-manage로 돌아갑니다.
  // 아래의 "종목을 찾을 수 없음" 조기 반환보다 반드시 먼저 읽고 비워야, 그 경우에도 플래그가 남지 않습니다.
  const returnHash = window.__exerciseEditReturnHash || "#/exercise-manage";
  window.__exerciseEditReturnHash = null;

  const ex = state.getExercise(params.id);
  if (!ex) {
    navigate("#/exercise-manage", { replace: true });
    return;
  }
  const exState = state.getExerciseState(ex.id);
  renderForm(root, {
    title: "운동 수정",
    exerciseId: ex.id,
    defInitial: ex,
    stateInitial: exState,
    onBack: () => history.back(),
    afterSaveHash: returnHash,
  });
}
