// state.js
// 저장(storage) + 데이터 모델(models) + 순수 로직(judge/gain/warmup)을 엮어
// "무엇을 해야 하는가"를 결정하는 오케스트레이션 계층입니다.
// DOM을 전혀 다루지 않으므로, 이후 React 등으로 UI를 바꾸더라도 이 파일은 그대로 재사용할 수 있습니다.

import {
  loadData,
  saveData,
  exportJSON,
  readJSONFile,
  validateBackupShape,
  migrate,
  saveDraft as storageSaveDraft,
  loadDraft as storageLoadDraft,
  clearDraft as storageClearDraft,
} from "./storage.js";
import {
  makeExerciseDefinition,
  makeExerciseState,
  makeRoutineVersion,
  makeWorkoutSession,
  makeExerciseRecord,
  uid,
  BODYWEIGHT_GOAL_ALERT_STREAK,
  DAYS_DISPLAY_ORDER,
} from "./models.js";
// v2.7.0: 주간 볼륨 계산(볼륨 카드/루틴 카드 메타 표시 전용). judge.js/gain.js와는 별개 경로입니다.
import { calcWeeklyVolume, calcDayRoleSetSummary, calcDayHighlightTags } from "./volume.js";
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
  // v2.3.2: "변경 전" currentWeight(state.currentWeight, 재할당 전에 캡처된 값)를 다음 워밍업 기준값으로 이월합니다.
  // gain.js의 resetAfterWeightIncrease() 반환값(reset)은 그대로 두고 warmupWeightOverride 필드만 덧씌웁니다.
  data.exerciseStates[id] = { ...reset, currentWeight: newWeight, warmupWeightOverride: state.currentWeight };
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

// v2.7.0: 주간 예상 루틴 볼륨(부위별/보조태그별 세트 수). 비활성 종목도 루틴에 포함되어 있으면 계산에
// 포함합니다(getRoutineExercisesForEdit이 이미 그렇게 동작). 판정/증량 상태와 무관한 순수 조회 함수입니다.
export function getWeeklyVolume() {
  const dayExerciseLists = {};
  DAYS_DISPLAY_ORDER.forEach((d) => {
    dayExerciseLists[d.key] = getRoutineExercisesForEdit(d.key);
  });
  return calcWeeklyVolume(dayExerciseLists);
}

// v2.7.0: 루틴 리스트 카드 한 줄에 필요한 요약(운동 개수/메인·보조 세트/하이라이트 태그)을 한 번에 반환합니다.
export function getRoutineDaySummary(dayKey) {
  const exercises = getRoutineExercisesForEdit(dayKey);
  const { main, assist } = calcDayRoleSetSummary(exercises);
  return {
    count: exercises.length,
    mainSets: main,
    assistSets: assist,
    highlightTags: calcDayHighlightTags(exercises),
  };
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

/* ---------------- Exercise Notification Center (v2.4.0) ---------------- */
// 여러 gainMethod에 흩어진 "확인이 필요한 상태/알림"을 하나의 화면에서 모아 보여주기 위한 순수 조회(+ 최소 저장) 계층입니다.
// judge.js/gain.js를 전혀 호출하지 않으며, 각 gainMethod의 기존 철학(머신/프리웨이트 후보 선택, 맨몸 Pending,
// 고반복 단발성 신호)은 이 섹션의 어떤 함수도 바꾸지 않습니다.

// 도전세트 후보(머신/프리웨이트)를 "요일별 루틴" 기준으로 그룹핑해 읽기 전용으로 반환합니다.
// - 오늘 요일로 한정하지 않고, 후보가 포함된 모든 요일 루틴을 대상으로 합니다(동일 종목이 여러 요일에 있으면 각각 노출).
// - 그룹 내 정렬은 getRoutineExercises()가 이미 반환하는 루틴 order 순서를 그대로 따릅니다.
// - "후보가 된 시점" 순서는 사용하지 않습니다(ExerciseState에 그런 타임스탬프가 없고, 요구사항에도 불필요함).
export function getChallengeCandidateGroups() {
  const candidateIds = new Set(getChallengeCandidates().map((ex) => ex.id));
  if (candidateIds.size === 0) return [];

  return DAYS_DISPLAY_ORDER.map((d) => {
    const version = getDefaultVersion(d.key);
    const exercises = getRoutineExercises(d.key).filter((ex) => candidateIds.has(ex.id));
    return { dayKey: d.key, dayLabel: d.label, routineTitle: version.title, exercises };
  }).filter((g) => g.exercises.length > 0);
}

// 고반복(high_rep) "목표 검토" 알림을 사용자가 처리(목표 수정/현행 유지)하기 전까지 최소 보관합니다.
// ExerciseState에는 아무 것도 쓰지 않으므로 Pending 개념으로 바뀌는 것이 아닙니다. 종목당 1건만 유지하며,
// 같은 종목에서 다시 발생하면(finishSession) 기존 항목의 updatedAt만 갱신됩니다(새 항목을 추가하지 않음).
export function clearHighRepReviewAlert(exerciseId) {
  if (!data.highRepReviewAlerts || !(exerciseId in data.highRepReviewAlerts)) return;
  const next = { ...data.highRepReviewAlerts };
  delete next[exerciseId];
  data.highRepReviewAlerts = next;
  persist();
}

// 알림센터 표시용 목록. 활성 종목 등록 순서를 그대로 따르고, 비활성화된 종목의 과거 알림은
// 별도 삭제 로직 없이 이 필터링만으로 자연스럽게 화면에서 숨겨집니다(저장된 값 자체는 남아있을 수 있음).
export function getHighRepReviewAlerts() {
  const alerts = data.highRepReviewAlerts || {};
  return getActiveExercises().filter((ex) => ex.gainMethod === "high_rep" && alerts[ex.id]);
}

// 맨몸(bodyweight) 목표 조정 Pending 목록. v2.4.0부터 Pending(성장 사이클 상태)과 Notification(표시 여부)이
// 분리되었으므로, 화면에는 "지금도 조정이 필요하고(pending) + 아직 처리 안 한(dismissed=false)" 것만 노출합니다.
export function getBodyweightGoalAdjustList() {
  return getActiveExercises().filter((ex) => {
    if (ex.gainMethod !== "bodyweight") return false;
    const st = getExerciseState(ex.id);
    return st.bodyweightGoalAdjustPending && !st.bodyweightGoalAdjustNotificationDismissed;
  });
}

// v2.4.0: Notification Center "현행 유지" 전용. bodyweightGoalAdjustPending(성장 사이클 상태)은 절대 건드리지 않고,
// "이번 알림을 확인했다"는 표시(dismissed)만 남깁니다. 이후 finishSession에서 pending이 다시 false->true로
// 새로 발생하면 dismissed는 자동으로 false로 리셋되어 새 알림이 정상적으로 다시 노출됩니다.
export function dismissBodyweightGoalAdjustNotification(exerciseId) {
  const st = getExerciseState(exerciseId);
  data.exerciseStates[exerciseId] = { ...st, bodyweightGoalAdjustNotificationDismissed: true };
  persist();
}

// 알림 FAB(운동 화면 좌측 하단) 노출 여부. 위 세 종류 중 하나라도 있으면 true. 숫자 배지는 쓰지 않으므로
// 정확한 개수가 아니라 boolean만 필요합니다.
export function shouldShowNotificationFab() {
  return getChallengeCandidateGroups().length > 0 || getHighRepReviewAlerts().length > 0 || getBodyweightGoalAdjustList().length > 0;
}

/* ---------------- Generation (운동 기준 초기화) ---------------- */
// v2.3.0: "기존 기록은 유지, 운동 기준(중량/증량 진행 상태)만 새로 시작"하기 위한 기능입니다.
// gain.js는 전혀 호출하지 않고, ExerciseState의 대상 필드만 명시적으로 나열해 교체합니다
// (models.js의 makeExerciseState() 팩토리로 통째 교체하지 않음 - 향후 필드가 추가되어도
// 이 목록에 명시적으로 추가하기 전까지는 이 함수의 영향을 받지 않도록 하기 위함).
// bodyweight는 이 기능의 대상이 아니며(ExerciseState 전혀 건드리지 않음), machine/freeweight/high_rep에만 적용됩니다.
// 활성/비활성 여부와 무관하게 해당 gainMethod의 모든 종목에 적용됩니다.
export function resetGeneration() {
  data.exercises.forEach((ex) => {
    const st = getExerciseState(ex.id);

    if (ex.gainMethod === "bodyweight") {
      // v2.4.0: 기존에는 bodyweight를 완전히 제외했으나, "현재 성장 사이클 기준값은 모두 초기화한다"는
      // Generation 취지에 맞춰 bodyweightConsecutiveA(연속 달성 횟수)/bodyweightGoalAdjustPending(목표 조정
      // 검토 필요 여부)만 명시적으로 초기화합니다. bodyweight는 currentWeight/도전세트 관련 필드를 애초에
      // 쓰지 않으므로 그 외 필드는 여전히 건드리지 않습니다(judge.js의 판정 계산식 자체와는 무관).
      data.exerciseStates[ex.id] = {
        ...st,
        bodyweightConsecutiveA: 0,
        bodyweightGoalAdjustPending: false,
        bodyweightGoalAdjustNotificationDismissed: false,
      };
      return;
    }

    if (ex.gainMethod === "high_rep") {
      // high_rep은 gain.js 상태머신 자체를 쓰지 않으므로 gainConditionState/isGainCandidate는 항상 기본값에
      // 머물러 있지만(never mutated by gain.js), 최종 구현 스펙에 명시된 대로 명시적으로 초기화합니다.
      // freeweightStage/machine*/freeweightChallengeWeight는 high_rep과 무관한 필드라 계속 건드리지 않습니다.
      data.exerciseStates[ex.id] = {
        ...st,
        currentWeight: null,
        warmupWeightOverride: null,
        challengeWeightDefault: null,
        gainConditionState: "none",
        isGainCandidate: false,
      };
    } else {
      // machine / freeweight
      data.exerciseStates[ex.id] = {
        ...st,
        currentWeight: null,
        warmupWeightOverride: null,
        challengeWeightDefault: null,
        gainConditionState: "none",
        isGainCandidate: false,
        freeweightStage: null,
        machinePendingIncreaseWeight: null,
        machineChallengeWeight: null,
        freeweightChallengeWeight: null,
      };
    }
  });

  data.designatedChallengeExerciseId = null;
  // v2.4.0: 현재 Generation 기준으로 발생한 미처리 고반복 알림도 "현재 성장 사이클" 소속이므로 함께 초기화합니다.
  // 이 저장소는 오직 high_rep 알림만 담으므로 전체를 비우는 것으로 충분합니다(과거 세션 기록/history는 무관, 그대로 유지).
  data.highRepReviewAlerts = {};
  data.currentGeneration = (data.currentGeneration || 1) + 1;
  persist();
}

// v2.3.0: 현재 중량이 설정되지 않은(currentWeight == null) 종목을 조회하는 읽기 전용 함수입니다.
// "운동 시작 제한"(v2.3, day-scoped)과 향후 알림센터(v2.4 예정, 전역)가 동일한 함수를 재사용할 수 있도록
// 전역 버전과 day-scoped 버전을 분리했습니다. 어떤 상태도 변경하지 않습니다.
export function getExercisesMissingWeight() {
  return getActiveExercises().filter(
    (ex) => ex.gainMethod !== "bodyweight" && getExerciseState(ex.id).currentWeight == null
  );
}

export function getExercisesMissingWeightForDay(dayKey) {
  const routineIds = new Set(getRoutineExercises(dayKey).map((e) => e.id));
  return getExercisesMissingWeight().filter((ex) => routineIds.has(ex.id));
}

/* ---------------- 운동 진행 상태(Draft) 복구 ---------------- */
// v2.3.0: storage.js의 별도 key(STORAGE_KEY와 분리)에 대한 얇은 pass-through입니다.
// UI(workout.js/app.js)는 storage.js를 직접 호출하지 않고 이 함수들을 통해서만 접근합니다(기존 레이어 원칙 유지).
// startSession()/finishSession() 등 기존 세션 함수는 이 섹션과 무관하게 그대로 동작합니다.
export function saveDraft(draft) {
  storageSaveDraft(draft);
}

export function loadDraft() {
  return storageLoadDraft();
}

export function clearDraft() {
  storageClearDraft();
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
    // v2.3.2: 워밍업 중량은 더 이상 "종목 관리 설정값 -> 없으면 과거 기록 기반 자동계산"이 아니라,
    // ExerciseState.warmupWeightOverride 하나가 "실제 운동 흐름에서 유지되는 워밍업 기준값" 역할을 그대로 겸합니다
    // (신규/Generation 초기화 직후에는 null이라 화면에서 빈 칸으로 시작 -> 사용자가 최초 입력).
    // 갱신 로직은 finishSession()에 있고, 여기서는 그 값을 그대로 읽기만 합니다. computeWarmupWeight()는 더 이상 호출하지 않습니다.
    const warmupWeight = warmupApplicable ? state.warmupWeightOverride : null;

    return {
      exercise: ex,
      isChallengeToday,
      warmup: warmupApplicable
        ? { targetReps: ex.warmupTargetReps, weight: warmupWeight, performedRaw: "", leftRaw: "", rightRaw: "" }
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
            // v2.3.2: 종목 관리 화면의 고정 기본값(challengeWeightDefault)은 더 이상 사용하지 않습니다(fallback 제거).
            // machine: 직전 도전 실패로 기억해둔 machineChallengeWeight가 있으면 그 값을 우선 사용(gain.js가 관리, 무변경).
            // freeweight: 직전 도전 실패로 기억해둔 freeweightChallengeWeight가 있으면 그 값을 우선 사용(machine과 완전히 별개 필드, gain.js가 관리, 무변경).
            // 둘 다 없으면(첫 도전이거나 직전 성공으로 초기화됨) 빈 칸으로 시작 -> 매번 직접 입력.
            weight: ex.gainMethod === "machine" ? state.machineChallengeWeight ?? "" : state.freeweightChallengeWeight ?? "",
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
      // 맨몸 시간형은 목표/80% 3단계 기준의 전용 함수를 사용하고, 그 외(맨몸 반복수형/고반복/machine/freeweight)는
      // v2.3.x부터 전부 "이상"(threshold) 기준으로 통일합니다(비편측과 동일 정책, 헌장: 목표 이상 연속 수행 = A).
      const isUnilateralTimeGoal = isBodyweight && ex.bodyweightGoalType === "time";
      if (isUnilateralTimeGoal) {
        judgement = computeUnilateralTimeJudgement(
          row.mainSets.map((s) => ({ target: s.targetReps, leftRaw: s.leftRaw, rightRaw: s.rightRaw }))
        );
      } else {
        judgement = computeUnilateralJudgement(
          row.mainSets.map((s) => ({ target: s.targetReps, leftRaw: s.leftRaw, rightRaw: s.rightRaw })),
          "threshold"
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
        { mode: "threshold" } // v2.3.x: machine/freeweight도 "목표 이상 연속 수행 = A"로 통일(기존엔 machine/freeweight만 "정확히 일치" 요구했던 것을 헌장 기준에 맞춰 수정). high_rep은 원래부터 threshold였음.
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
        // v2.4.0: pending이 새로 false -> true가 되는 순간에는 Notification도 새로 발생한 것이므로,
        // 예전에 "현행 유지"로 닫아뒀던 dismissed 상태를 여기서 다시 false로 리셋합니다.
        // (pending이 이미 true였던 경우/false인 채로 유지되는 경우는 dismissed를 건드리지 않습니다.)
        ...(goalAdjustSuggested ? { bodyweightGoalAdjustNotificationDismissed: false } : {}),
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

    // v2.3.2: 워밍업 기준값(warmupWeightOverride) 갱신 — 이 레코드에 대한 판정/도전세트 처리가 전부 끝난
    // "최종 상태"를 딱 한 번만 읽어 갱신합니다(그 사이 gain.js가 반영한 다른 필드를 덮어쓰지 않기 위함).
    // - currentWeight가 이번 세션 중 바뀌었으면(machine 지연 승격 또는 freeweight 도전 성공): "변경 전" 값을 다음 워밍업 기준값으로.
    //   (state.currentWeight는 이 레코드 처리 시작 시점에 캡처된 값이라 이후 재할당과 무관하게 "변경 전" 값 그대로입니다.)
    // - 바뀌지 않았으면: 이번 세션에 실제로 사용한 워밍업 중량을 그대로 기억(없으면 null 유지).
    // bodyweight는 warmupApplicable이 애초에 false라 row.warmup이 없어 이 블록 자체가 실행되지 않습니다.
    if (row.warmup) {
      const finalState = getExerciseState(ex.id);
      const weightChangedThisSession = finalState.currentWeight !== state.currentWeight;
      const nextWarmup = weightChangedThisSession ? state.currentWeight : row.warmup.weight;
      data.exerciseStates[ex.id] = { ...finalState, warmupWeightOverride: nextWarmup };
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
    generation: data.currentGeneration, // v2.3.0: 완료 시점의 Generation 번호를 세션에 기록(그래프 색상 구분/히스토리 집계 전용)
  });

  data.sessions.push(session);

  // v2.4.0: 세션 종료 시점에만 존재하던 highRepGoalReviewSuggested 신호를, Notification Center에서
  // 나중에도 다시 확인할 수 있도록 최소 저장소(data.highRepReviewAlerts)에 기록합니다.
  // ExerciseState는 건드리지 않으며(Pending 아님), 종목당 1건만 유지하고 다시 발생하면 updatedAt만 갱신합니다(A안).
  records.forEach((r) => {
    if (r.highRepGoalReviewSuggested) {
      data.highRepReviewAlerts = { ...data.highRepReviewAlerts, [r.exerciseId]: { updatedAt: endTime } };
    }
  });

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

// v2.5.0: 파일을 읽고 최소 구조 검증까지만 수행합니다(아직 앱 데이터에 반영하지 않음).
// UI에서 이 결과로 복원 확인 모달을 띄운 뒤, 사용자가 확인하면 restoreFromData()를 호출합니다.
export async function readBackupFile(file) {
  const parsed = await readJSONFile(file);
  if (!validateBackupShape(parsed)) {
    throw new Error("올바른 Do Your Workout 백업 파일이 아닙니다.");
  }
  return parsed;
}

// v2.5.0: 검증된 백업 데이터를 실제로 반영합니다. migrate()는 기존과 동일하게 적용되어
// SCHEMA_VERSION/구버전 호환 로직은 변경되지 않습니다. 복원 성공 후 진행 중이던 운동 draft만 삭제합니다.
export function restoreFromData(parsedData) {
  data = migrate(parsedData);
  storageClearDraft();
  persist();
  return data;
}

export async function restoreFromFile(file) {
  const parsed = await readBackupFile(file);
  return restoreFromData(parsed);
}
