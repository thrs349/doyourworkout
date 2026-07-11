// state.js
// 저장(storage) + 데이터 모델(models) + 순수 로직(judge/gain/warmup)을 엮어
// "무엇을 해야 하는가"를 결정하는 오케스트레이션 계층입니다.
// DOM을 전혀 다루지 않으므로, 이후 React 등으로 UI를 바꾸더라도 이 파일은 그대로 재사용할 수 있습니다.

import { loadData, saveData, exportJSON, importJSONFile } from "./storage.js";
import { makeExerciseDefinition, makeExerciseState, makeRoutineVersion, makeWorkoutSession, makeExerciseRecord, uid, BODYWEIGHT_GOAL_ALERT_STREAK } from "./models.js";
import {
  computeJudgement,
  computeChallengeResult,
  allSetsAchievedContinuously,
  computeUnilateralJudgement,
  computeUnilateralTimeJudgement,
  allUnilateralSetsAchievedContinuously,
  computeBodyweightTimeJudgement,
  computeBodyweightRepsJudgement,
} from "./judge.js";
import {
  applyJudgement,
  resetAfterWeightIncrease,
  listChallengeCandidates,
  formatStreakLabel,
  applyMachineChallengeSuccess,
  applyMachineChallengeFailure,
  applyFreeweightChallengeSuccess,
  applyFreeweightChallengeFailure,
} from "./gain.js";
import { computeWarmupWeight } from "./warmup.js";

let data = null;
const listeners = new Set();

function notify() {
  listeners.forEach((fn) => fn(data));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function init() {
  data = loadData();
  return data;
}

export function getData() {
  return data;
}

function persist() {
  saveData(data);
  notify();
}

/* ---------------- 종목 관리 ---------------- */

export function addExercise(fields) {
  const def = makeExerciseDefinition(fields);
  data.exercises.push(def);
  data.exerciseStates[def.id] = makeExerciseState({ exerciseId: def.id, currentWeight: fields.startWeight || 0 });
  persist();
  return def;
}

export function updateExercise(id, patch) {
  const idx = data.exercises.findIndex((e) => e.id === id);
  if (idx === -1) return;
  data.exercises[idx] = { ...data.exercises[idx], ...patch };
  persist();
}

// 비활성화된 종목은 루틴/오늘의 운동 화면에서 숨기되, 기존 세션 기록과 그래프 데이터는 그대로 유지합니다.
export function setExerciseActive(id, active) {
  updateExercise(id, { active });
}

export function getActiveExercises() {
  return data.exercises.filter((e) => e.active !== false);
}

export function getExercise(id) {
  return data.exercises.find((e) => e.id === id);
}

export function getExerciseState(id) {
  if (!data.exerciseStates[id]) {
    data.exerciseStates[id] = makeExerciseState({ exerciseId: id });
  }
  return data.exerciseStates[id];
}

// "목표 중량"을 사용자가 직접 수정합니다. 증량 성공 후 갱신과 동일하게 취급해 진행 상태를 초기화합니다.
// (편집 이후부터 새 중량 기준으로 동작해야 하므로, 이전 중량에서 쌓인 연속조건은 의미가 없어집니다.)
export function setExerciseWeight(id, newWeight) {
  const ex = getExercise(id);
  const state = getExerciseState(id);
  const reset = resetAfterWeightIncrease(ex.gainMethod, state);
  data.exerciseStates[id] = { ...reset, currentWeight: newWeight };
  if (data.designatedChallengeExerciseId === id) data.designatedChallengeExerciseId = null;
  persist();
}

// 워밍업/도전세트 "기본값"만 바꾸는 편집입니다. 증량 진행 상태에는 영향을 주지 않습니다.
export function setWarmupWeightOverride(id, weight) {
  const state = getExerciseState(id);
  data.exerciseStates[id] = { ...state, warmupWeightOverride: weight === null || weight === "" ? null : Number(weight) };
  persist();
}

export function setChallengeWeightDefault(id, weight) {
  const state = getExerciseState(id);
  data.exerciseStates[id] = { ...state, challengeWeightDefault: weight === null || weight === "" ? null : Number(weight) };
  persist();
}

// 맨몸 종목의 목표(반복수/시간) 조정이 실제로 이뤄졌다고 판단될 때 호출합니다.
// (v1.8: 이름을 resetBodyweightGoalStreak -> clearBodyweightGoalPending으로 변경했습니다.
//  실제로는 연속 A 카운트 초기화 + pending 해제 두 가지를 함께 하므로, "pending을 해소한다"는
//  의미가 더 잘 드러나는 이름입니다. 호출부는 exerciseForm.js 한 곳뿐이라 안전하게 이름을 바꿨습니다.)
export function clearBodyweightGoalPending(id) {
  const state = getExerciseState(id);
  data.exerciseStates[id] = { ...state, bodyweightConsecutiveA: 0, bodyweightGoalAdjustPending: false };
  persist();
}

// 완전 삭제 확인 팝업에 표시할 기록 개수(읽기 전용, 상태를 바꾸지 않음).
export function getExerciseRecordCount(id) {
  return data.sessions.reduce((sum, session) => sum + session.records.filter((r) => r.exerciseId === id).length, 0);
}

// 종목별 가장 최근 사용 날짜("YYYY-MM-DD")를 반환합니다. 사용 기록이 없으면 null.
// "최근 사용순" 정렬 UI 전용 읽기 전용 헬퍼로, 세션/기록 데이터를 전혀 변경하지 않습니다.
export function getExerciseLastUsedDate(id) {
  let latest = null;
  data.sessions.forEach((session) => {
    const used = session.records.some((r) => r.exerciseId === id);
    if (used && (!latest || session.date > latest)) latest = session.date;
  });
  return latest;
}

// 종목을 완전히 삭제합니다(비활성 탭에서만 호출되는 것을 전제로 함).
// orphan 참조가 남지 않도록, 이 종목을 "참조"하는 지점(도전 지정/루틴/세션 기록)을 먼저 정리한 뒤
// 마지막에 exercises/exerciseStates 원본 데이터를 제거하는 순서로 처리합니다.
export function deleteExercise(id) {
  // 1) 참조 정리
  if (data.designatedChallengeExerciseId === id) {
    data.designatedChallengeExerciseId = null;
  }
  data.routines.forEach((day) => {
    day.versions.forEach((v) => {
      v.items = v.items.filter((it) => it.exerciseId !== id).map((it, i) => ({ ...it, order: i + 1 }));
    });
  });
  data.sessions.forEach((session) => {
    session.records = session.records.filter((r) => r.exerciseId !== id);
  });

  // 2) 데이터 제거
  data.exercises = data.exercises.filter((e) => e.id !== id);
  delete data.exerciseStates[id];

  persist();
}

/* ---------------- 루틴 관리 ---------------- */

export function getRoutineDay(dayKey) {
  return data.routines.find((r) => r.day === dayKey);
}

export function getDefaultVersion(dayKey) {
  const day = getRoutineDay(dayKey);
  let version = day.versions.find((v) => v.isDefault);
  if (!version) {
    version = makeRoutineVersion({ title: "기본 루틴", isDefault: true, items: [] });
    day.versions.push(version);
  }
  return version;
}

export function renameRoutineVersion(dayKey, versionId, title) {
  const day = getRoutineDay(dayKey);
  const v = day.versions.find((v) => v.id === versionId);
  if (v) v.title = title;
  persist();
}

export function addExerciseToRoutine(dayKey, versionId, exerciseId) {
  const day = getRoutineDay(dayKey);
  const v = day.versions.find((v) => v.id === versionId);
  if (!v) return;
  if (v.items.some((it) => it.exerciseId === exerciseId)) return;
  v.items.push({ exerciseId, order: v.items.length + 1 });
  persist();
}

export function removeExerciseFromRoutine(dayKey, versionId, exerciseId) {
  const day = getRoutineDay(dayKey);
  const v = day.versions.find((v) => v.id === versionId);
  if (!v) return;
  v.items = v.items.filter((it) => it.exerciseId !== exerciseId).map((it, i) => ({ ...it, order: i + 1 }));
  persist();
}

export function reorderRoutine(dayKey, versionId, orderedExerciseIds) {
  const day = getRoutineDay(dayKey);
  const v = day.versions.find((v) => v.id === versionId);
  if (!v) return;
  v.items = orderedExerciseIds.map((exerciseId, i) => ({ exerciseId, order: i + 1 }));
  persist();
}

// 오늘의 운동/기록 화면 등에서 쓰는, "활성 종목만" 걸러진 루틴 목록.
export function getRoutineExercises(dayKey) {
  const version = getDefaultVersion(dayKey);
  return [...version.items]
    .sort((a, b) => a.order - b.order)
    .map((it) => getExercise(it.exerciseId))
    .filter((ex) => ex && ex.active !== false);
}

// 루틴 편집 화면 전용: 비활성 종목도 포함해서 보여주되(회색 표시용), 어떤 항목이 비활성인지 알 수 있게 반환합니다.
export function getRoutineExercisesForEdit(dayKey) {
  const version = getDefaultVersion(dayKey);
  return [...version.items]
    .sort((a, b) => a.order - b.order)
    .map((it) => getExercise(it.exerciseId))
    .filter(Boolean);
}

/* ---------------- 증량 후보 / 도전 ---------------- */
// v1.2: 머신/프리웨이트 모두 "운동 종료 후 후보 목록에서 사용자가 선택"하는 동일한 방식입니다.
// (프리웨이트 자동 우선순위는 제거했습니다.)

export function getChallengeCandidates() {
  return listChallengeCandidates(getActiveExercises(), data.exerciseStates);
}

// v1.8: "오늘 루틴에 포함된 후보만" 화면에 노출하기 위한 필터입니다.
// 후보 state(isGainCandidate) 자체는 전혀 건드리지 않고, 화면 표시용으로만 걸러냅니다.
// (오늘 루틴에 없다고 후보 자격이 사라지는 게 아니라, 해당 종목이 포함된 날 다시 노출됩니다.)
export function getChallengeCandidatesForDay(dayKey) {
  const routineIds = new Set(getRoutineExercises(dayKey).map((e) => e.id));
  return getChallengeCandidates().filter((ex) => routineIds.has(ex.id));
}

export function getStreakLabel(exerciseId) {
  return formatStreakLabel(getExerciseState(exerciseId));
}

export function selectChallengeExercise(exerciseId) {
  data.designatedChallengeExerciseId = exerciseId;
  persist();
}

function resolveTodayChallengeExerciseId(dayKey) {
  if (!data.designatedChallengeExerciseId) return null;
  const routineIds = getRoutineExercises(dayKey).map((e) => e.id);
  return routineIds.includes(data.designatedChallengeExerciseId) ? data.designatedChallengeExerciseId : null;
}

// v1.8: 홈 화면 플로팅 버튼 노출 여부. "오늘 이미 도전 종목을 선택 완료"했으면 숨기고,
// 그렇지 않은 상태에서 오늘 루틴에 해당하는 후보가 하나라도 있으면 보여줍니다.
// 후보 state를 지우는 게 아니라 순수하게 "지금 이 화면에 버튼을 그릴지" 판단만 합니다.
export function shouldShowChallengeFab(dayKey) {
  if (resolveTodayChallengeExerciseId(dayKey)) return false;
  return getChallengeCandidatesForDay(dayKey).length > 0;
}

// v1.9.1: 여러 종류의 "확인이 필요한 상태"를 하나의 목록으로 조회하기 위한 읽기 전용 집계 함수입니다.
// 이 함수는 어떤 상태도 새로 저장하지 않습니다 — 기존 exerciseStates/designatedChallengeExerciseId를
// 그대로 읽어서 알림 표시용 뷰(view)만 만들어 반환합니다. source of truth는 각 도메인의 기존 필드 그대로입니다.
//
// 반환 형태: [{ type, exerciseId }]
//   - "bodyweight_adjust": 맨몸 목표 조정 검토 필요 (ExerciseState.bodyweightGoalAdjustPending === true)
//   - "challenge_candidate": 도전세트 후보 (ExerciseState.isGainCandidate === true, machine/freeweight만.
//     dayKey를 넘기면 그날 루틴에 포함된 후보만, 생략하면 전체 활성 후보를 포함합니다.)
//
// 주의(중요): high_rep의 "목표 검토" 신호(highRepGoalReviewSuggested)는 세션 종료 시점에만 존재하는
// 1회성 값이고 ExerciseState에는 대응 필드가 아예 없습니다. 즉 지금 구조에서는 이 함수가 high_rep 항목을
// 절대 포함할 수 없습니다(저장을 안 하니 읽을 데이터가 없음). 향후 알림 아이콘에 고반복까지 포함하려면
// "고반복도 pending을 저장할지" 여부를 먼저 별도로 결정해야 합니다(이번 턴에서는 그 결정을 내리지 않았습니다).
export function getPendingActions({ dayKey } = {}) {
  const actions = [];

  getActiveExercises().forEach((ex) => {
    const st = getExerciseState(ex.id);
    if (st.bodyweightGoalAdjustPending) {
      actions.push({ type: "bodyweight_adjust", exerciseId: ex.id });
    }
  });

  const candidates = dayKey ? getChallengeCandidatesForDay(dayKey) : getChallengeCandidates();
  candidates.forEach((ex) => {
    actions.push({ type: "challenge_candidate", exerciseId: ex.id });
  });

  return actions;
}

/* ---------------- 오늘의 운동(세션) ---------------- */

// 화면에 그릴 계획(워밍업/본세트/도전세트 행 구조)을 만듭니다. 아직 세션을 저장하지는 않습니다.
export function buildWorkoutPlan(dayKey) {
  const challengeExerciseId = resolveTodayChallengeExerciseId(dayKey);
  const exercises = getRoutineExercises(dayKey);

  return exercises.map((ex) => {
    const state = getExerciseState(ex.id);
    const isHighRep = ex.gainMethod === "high_rep";
    const isBodyweightTime = ex.gainMethod === "bodyweight" && ex.bodyweightGoalType === "time";
    // 고반복/맨몸/편측 종목은 도전세트를 쓰지 않습니다.
    const isChallengeToday =
      !isHighRep && ex.gainMethod !== "bodyweight" && !ex.isUnilateral && ex.id === challengeExerciseId;
    // 프리웨이트 전용: 10x3(stage1) A-A 달성 후에는 같은 중량에서 10x4(stage2 이상)로 실제 세트 수가 늘어나야 합니다.
    // 다른 gainMethod는 이 분기의 영향을 받지 않고 기존처럼 ex.baseSets를 그대로 사용합니다.
    let baseSetCount = ex.baseSets;
    if (ex.gainMethod === "freeweight") {
      const freeweightStage = state.freeweightStage || "stage1_3set";
      baseSetCount = freeweightStage === "stage1_3set" ? ex.baseSets : ex.baseSets + 1;
    }
    const mainSetCount = baseSetCount - (isChallengeToday ? 1 : 0);
    const mainTargetReps = isHighRep ? ex.highRepLower : isBodyweightTime ? ex.targetSeconds : ex.targetReps;

    // v1.9.1: 맨몸은 워밍업 세트를 쓰지 않습니다. UI에서 이미 막아두지만, 과거 데이터에 warmupEnabled:true가
    // 남아있는 경우까지 대비한 방어 가드입니다(판정/증량 로직과는 무관, 워밍업 세트 생성 여부만 결정).
    const warmupApplicable = ex.warmupEnabled && ex.gainMethod !== "bodyweight";
    const warmupWeight = warmupApplicable
      ? state.warmupWeightOverride ?? computeWarmupWeight(data.sessions, ex.id, state.currentWeight)
      : null;

    return {
      exercise: ex,
      isChallengeToday,
      warmup: warmupApplicable
        ? { targetReps: ex.warmupTargetReps, weight: warmupWeight, performedRaw: "" }
        : null,
      mainSets: Array.from({ length: Math.max(mainSetCount, 0) }, (_, i) => ({
        setNo: i + 1,
        targetReps: mainTargetReps,
        weight: state.currentWeight,
        performedRaw: "",
        leftRaw: "", // 편측(isUnilateral) 종목에서만 사용
        rightRaw: "", // 편측(isUnilateral) 종목에서만 사용
      })),
      challengeSet: isChallengeToday
        ? {
            targetReps: ex.targetReps,
            // machine: 직전 도전 실패로 기억해둔 machineChallengeWeight가 있으면 그 값을 우선 사용합니다.
            // freeweight: 직전 도전 실패로 기억해둔 freeweightChallengeWeight가 있으면 그 값을 우선 사용합니다(machine과 완전히 별개 필드).
            // 그 외/두 필드 모두 없으면 기존 방식(challengeWeightDefault ?? "")을 그대로 유지합니다.
            weight:
              ex.gainMethod === "machine"
                ? state.machineChallengeWeight ?? state.challengeWeightDefault ?? ""
                : ex.gainMethod === "freeweight"
                ? state.freeweightChallengeWeight ?? state.challengeWeightDefault ?? ""
                : state.challengeWeightDefault ?? "",
            performedRaw: "",
          }
        : null,
    };
  });
}

export function startSession(dayKey) {
  return {
    id: uid("session"),
    date: new Date().toISOString().slice(0, 10),
    day: dayKey,
    startTime: new Date().toISOString(),
    plan: buildWorkoutPlan(dayKey),
  };
}

// draftSession: startSession()이 반환한 형태 + 사용자가 입력을 채운 plan
export function finishSession(draftSession) {
  const endTime = new Date().toISOString();
  const startMs = new Date(draftSession.startTime).getTime();
  const durationMinutes = Math.max(1, Math.round((new Date(endTime).getTime() - startMs) / 60000));

  const records = draftSession.plan.map((row) => {
    const ex = row.exercise;
    const state = getExerciseState(ex.id);
    const isHighRep = ex.gainMethod === "high_rep";
    const isBodyweight = ex.gainMethod === "bodyweight";

    let judgement = null;
    let gainEvent = null;
    let highRepGoalReviewSuggested = false;

    if (ex.isUnilateral) {
      // 편측 운동: 좌우 각각 입력받아 전용 규칙으로만 판정하고, 증량/후보 로직은 전혀 적용하지 않습니다.
      // 맨몸 시간형은 목표/80% 3단계 기준의 전용 함수를 사용하고, 그 외(맨몸 반복수형/고반복)는
      // "이상"(threshold) 기준을, machine/freeweight는 기존과 동일하게 "정확히"(exact) 기준을 사용합니다.
      const isUnilateralTimeGoal = isBodyweight && ex.bodyweightGoalType === "time";
      if (isUnilateralTimeGoal) {
        judgement = computeUnilateralTimeJudgement(
          row.mainSets.map((s) => ({ target: s.targetReps, leftRaw: s.leftRaw, rightRaw: s.rightRaw }))
        );
      } else {
        const unilateralMode = isBodyweight || isHighRep ? "threshold" : "exact";
        judgement = computeUnilateralJudgement(
          row.mainSets.map((s) => ({ target: s.targetReps, leftRaw: s.leftRaw, rightRaw: s.rightRaw })),
          unilateralMode
        );
      }
      // 고반복 편측: 상한 반복수 달성 여부(자동 증량 대신 검토 팝업 트리거)를 좌우 각각 확인합니다.
      // 비편측 high_rep의 highRepGoalReviewSuggested 계산(else 블록)과 동일한 목적이며, 좌우 합산은 하지 않습니다.
      if (isHighRep && ex.highRepUpper != null) {
        highRepGoalReviewSuggested = allUnilateralSetsAchievedContinuously(row.mainSets, ex.highRepUpper);
      }
    } else if (isBodyweight) {
      // 맨몸: 자동 증량은 없지만, 반복수형/시간형 각각 전용 규칙으로 A/B/X는 판정합니다.
      // 반복수형은 machine/high_rep과 판정 함수를 공유하지 않는 맨몸 전용 세트별(per-set) 함수를 사용합니다.
      const isTimeGoal = ex.bodyweightGoalType === "time";
      judgement = isTimeGoal
        ? computeBodyweightTimeJudgement(row.mainSets.map((s) => ({ targetReps: s.targetReps, performedRaw: s.performedRaw })))
        : computeBodyweightRepsJudgement(row.mainSets.map((s) => ({ targetReps: s.targetReps, performedRaw: s.performedRaw })));
    } else {
      judgement = computeJudgement(
        row.mainSets.map((s) => ({ targetReps: s.targetReps, performedRaw: s.performedRaw })),
        { mode: isHighRep ? "threshold" : "exact" }
      );

      if (isHighRep) {
        // v1.8: 고반복은 자동 증량을 하지 않습니다. currentWeight를 바꾸는 코드는 전혀 없으며,
        // 모든 본세트가 상한 반복수를 연속 수행으로 달성했을 때 "목표 중량 검토가 필요하다"는
        // 1회성 신호만 세션 기록(highRepGoalReviewSuggested)에 남깁니다. ExerciseState는 전혀 건드리지 않으므로
        // 다음 세션/앱 재실행 후에는 이 신호가 남지 않고, 그 세션의 결과만으로 다시 판단됩니다.
        if (ex.highRepUpper != null) {
          highRepGoalReviewSuggested = allSetsAchievedContinuously(row.mainSets, ex.highRepUpper);
        }
      } else if (judgement) {
        data.exerciseStates[ex.id] = applyJudgement(ex.gainMethod, state, judgement);
      }
    }

    // 맨몸 전용: 자동 증량 대신, 세션 최종 판정 A가 연속 N회(기본 3회) 이상이면 "목표 조정이 필요한 상태"가 됩니다.
    // (판정이 편측 규칙으로 계산된 경우도 포함 - 맨몸+편측 조합에도 동일하게 적용)
    // v1.7: 팝업은 pending 상태가 false -> true로 "새로 바뀌는 순간"에만 1회 표시합니다.
    // pending이 이미 true인 동안에는 A가 계속돼도 팝업을 다시 띄우지 않고 상태만 유지하며,
    // 사용자가 종목 수정 화면에서 목표를 실제로 바꿔야만(clearBodyweightGoalPending) 해제됩니다.
    let goalAdjustSuggested = false;
    if (isBodyweight && judgement) {
      const bwState = getExerciseState(ex.id);
      const nextStreak = judgement === "A" ? (bwState.bodyweightConsecutiveA || 0) + 1 : 0;
      const wasPending = bwState.bodyweightGoalAdjustPending;
      const nowPending = wasPending || nextStreak >= BODYWEIGHT_GOAL_ALERT_STREAK;
      goalAdjustSuggested = !wasPending && nowPending; // 처음 임계치에 도달한 이번 세션에만 true

      data.exerciseStates[ex.id] = {
        ...getExerciseState(ex.id),
        bodyweightConsecutiveA: nextStreak,
        bodyweightGoalAdjustPending: nowPending,
      };
    }

    let challengeResult = null;
    if (row.challengeSet) {
      challengeResult = computeChallengeResult(row.challengeSet.performedRaw, row.challengeSet.targetReps);
    }

    // 머신(machine) 전용 도전세트 처리.
    if (challengeResult && ex.gainMethod === "machine") {
      const challengeWeightNum = Number(row.challengeSet.weight) || null;
      if (challengeResult === "success" && challengeWeightNum != null) {
        data.exerciseStates[ex.id] = applyMachineChallengeSuccess(getExerciseState(ex.id), challengeWeightNum);
      } else if (challengeResult === "retry") {
        data.exerciseStates[ex.id] = applyMachineChallengeFailure(getExerciseState(ex.id), challengeWeightNum);
      }
    }

    // 프리웨이트(freeweight) 전용 도전세트 처리. machine 전용 필드(machinePendingIncreaseWeight/machineChallengeWeight)는
    // 전혀 참조하지 않으며, 완전히 독립된 상태 전이(즉시 증량 + progression 재시작)를 적용합니다.
    if (challengeResult && ex.gainMethod === "freeweight") {
      const challengeWeightNum = Number(row.challengeSet.weight) || null;
      if (challengeResult === "success" && challengeWeightNum != null) {
        data.exerciseStates[ex.id] = applyFreeweightChallengeSuccess(getExerciseState(ex.id), challengeWeightNum);
      } else if (challengeResult === "retry") {
        data.exerciseStates[ex.id] = applyFreeweightChallengeFailure(getExerciseState(ex.id), challengeWeightNum);
      }
    }

    const sets = [
      ...(row.warmup ? [{ setNo: 0, targetReps: row.warmup.targetReps, performedRaw: row.warmup.performedRaw, isChallenge: false, isWarmup: true, leftRaw: null, rightRaw: null }] : []),
      ...row.mainSets.map((s) => ({
        setNo: s.setNo,
        targetReps: s.targetReps,
        performedRaw: ex.isUnilateral ? null : s.performedRaw,
        leftRaw: ex.isUnilateral ? s.leftRaw : null,
        rightRaw: ex.isUnilateral ? s.rightRaw : null,
        isChallenge: false,
      })),
      ...(row.challengeSet ? [{ setNo: row.mainSets.length + 1, targetReps: row.challengeSet.targetReps, performedRaw: row.challengeSet.performedRaw, isChallenge: true, leftRaw: null, rightRaw: null }] : []),
    ];

    return makeExerciseRecord({
      exerciseId: ex.id,
      weightUsed: state.currentWeight,
      challengeWeight: row.challengeSet ? Number(row.challengeSet.weight) || null : null,
      warmup: row.warmup,
      sets,
      judgement,
      challengeResult,
      gainEvent,
      goalAdjustSuggested,
      highRepGoalReviewSuggested,
    });
  });

  const session = makeWorkoutSession({
    id: draftSession.id,
    date: draftSession.date,
    day: draftSession.day,
    startTime: draftSession.startTime,
    endTime,
    durationMinutes,
    records,
  });

  data.sessions.push(session);

  // 도전을 실제로 시도했다면(성공/재도전 상관없이), 성공한 경우에만 지정 해제(재도전은 다음 기회에 재시도)
  const challengeRecord = records.find((r) => r.challengeResult);
  if (challengeRecord && data.designatedChallengeExerciseId === challengeRecord.exerciseId) {
    if (challengeRecord.challengeResult === "success") data.designatedChallengeExerciseId = null;
  }

  persist();
  return session;
}

/* ---------------- 테마 ---------------- */

export function setTheme(themeId) {
  data.settings.themeId = themeId;
  persist();
}

export function renameTheme(themeId, name) {
  data.settings.customThemeNames[themeId] = name;
  persist();
}

/* ---------------- 백업 ---------------- */

export function backupNow() {
  exportJSON(data);
}

export async function restoreFromFile(file) {
  const restored = await importJSONFile(file);
  data = restored;
  persist();
  return data;
}
