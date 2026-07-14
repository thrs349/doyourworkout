// models.js
// 앱이 다루는 데이터의 "형태"만 정의하는 순수 모듈입니다.
// UI나 저장소에 의존하지 않으므로, 이후 다른 프레임워크로 옮기더라도 그대로 재사용할 수 있습니다.

export const SCHEMA_VERSION = 14; // v2.4.0: bodyweight의 Notification(알림 표시 여부)과 Pending(성장 사이클 상태)을 분리하기 위해
// ExerciseState에 bodyweightGoalAdjustNotificationDismissed 필드 추가. bodyweightGoalAdjustPending의 의미/생성 조건은 무변경이며,
// 판정/증량 계산식과는 무관합니다.

// 증량 방식(gainMethod) 목록입니다. 새 방식을 추가하려면 여기 하나만 더 넣고,
// judge.js/gain.js의 해당 분기만 채우면 됩니다.
export const GAIN_METHODS = {
  MACHINE: "machine",
  FREEWEIGHT: "freeweight",
  HIGH_REP: "high_rep",
  BODYWEIGHT: "bodyweight",
};

// 맨몸 운동: 세션 최종 판정 A가 이 횟수만큼 연속되면 "목표 조정 검토" 알림을 띄웁니다.
export const BODYWEIGHT_GOAL_ALERT_STREAK = 3;

export const DAYS = [
  { key: "sun", label: "일" },
  { key: "mon", label: "월" },
  { key: "tue", label: "화" },
  { key: "wed", label: "수" },
  { key: "thu", label: "목" },
  { key: "fri", label: "금" },
  { key: "sat", label: "토" },
];

// 화면에 요일을 나열할 때는 월~일 순서로 보여주기 위한 보조 배열입니다.
// (DAYS 원본은 Date.getDay() 인덱스(0=일)와 맞춰야 해서 순서를 바꾸지 않았습니다.)
export const DAYS_DISPLAY_ORDER = [...DAYS.slice(1), DAYS[0]];

export function todayDayKey(date = new Date()) {
  return DAYS[date.getDay()].key;
}

// 화면 표시용 증량 방식 한글 라벨
export function gainMethodLabel(gainMethod) {
  if (gainMethod === "freeweight") return "프리웨이트";
  if (gainMethod === "high_rep") return "고반복";
  if (gainMethod === "bodyweight") return "맨몸";
  return "머신";
}

// 종목의 부가 정보(목표치×세트수, 편측 여부)만 담은 문자열입니다. gainMethod 라벨은 포함하지 않습니다.
// (칩 등으로 gainMethod를 별도 표시하는 화면에서 재사용하기 위해 formatExerciseMeta에서 분리했습니다.)
export function formatExerciseSubMeta(ex) {
  let targetPart;
  if (ex.gainMethod === "high_rep") {
    // 설정 화면(운동 관리/운동 선택) 카드는 "판정 조건"이 아니라 "운동 설정 정보"를 보여주는 자리라
    // 다른 gainMethod와 동일하게 목표치 하나만 표시합니다(상한 기준). 실제 수행 목표/판정 기준(하한)은
    // workout.js가 이 formatter를 쓰지 않고 별도 경로(state.js의 mainTargetReps)로 표시하므로 영향 없습니다.
    targetPart = `${ex.highRepUpper}회`;
  } else if (ex.gainMethod === "bodyweight" && ex.bodyweightGoalType === "time") {
    targetPart = `${ex.targetSeconds}초`;
  } else {
    targetPart = `${ex.targetReps}회`;
  }
  const unilateralPart = ex.isUnilateral ? " · 편측" : "";
  return `${targetPart}×${ex.baseSets}세트${unilateralPart}`;
}

// 종목 목록(관리/선택 화면)에 쓰는 공통 요약 문자열입니다.
export function formatExerciseMeta(ex) {
  return `${gainMethodLabel(ex.gainMethod)} · ${formatExerciseSubMeta(ex)}`;
}

export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

// 운동 종목 마스터
export function makeExerciseDefinition({
  id = uid("ex"),
  name,
  gainMethod = GAIN_METHODS.MACHINE, // "machine" | "freeweight" | "high_rep"
  targetReps = 10, // machine/freeweight: 세트당 목표 반복수. high_rep에서는 사용하지 않음(대신 highRepLower/Upper).
  baseSets = 3,
  warmupEnabled = false,
  warmupTargetReps = 8,
  active = true, // 비활성화된 종목은 루틴/오늘의 운동에는 숨기되, 기존 기록·그래프 데이터는 그대로 유지합니다.
  // 고반복(high_rep) 전용 필드
  highRepLower = null, // 하한 반복수 (예: 15) - 화면에는 "15+"로만 표시
  highRepUpper = null, // 상한 반복수 (예: 20) - 사용자에게 노출하지 않고 내부 증량 판단에만 사용
  highRepIncrement = null, // 상한 연속 달성 시 자동으로 올릴 중량(kg). 헌장에 고정값이 없어 종목별로 직접 입력받습니다.
  // 맨몸(bodyweight) 전용 필드 - 이번 단계에서는 증량 규칙 없이 표시/입력만 지원합니다.
  bodyweightGoalType = null, // "reps" | "time" | null (gainMethod가 bodyweight일 때만 사용)
  targetSeconds = null, // 목표 시간(초). bodyweightGoalType이 "time"일 때만 사용.
  // 편측성(좌우 구분) 여부 - gainMethod와 무관하게 어떤 종목에도 설정 가능
  isUnilateral = false,
  // v2.1.0: 큐노트(운동 수행 포인트 메모). 판정/증량 로직에서는 전혀 참조하지 않는 순수 표시용 데이터입니다.
  // 체크리스트 형태의 문자열 배열로, 최대 3개까지만 유지합니다(UI에서 강제 + 저장 직전 방어).
  // null이 아닌 빈 배열([])을 기본값으로 사용합니다.
  cueNotes = [],
} = {}) {
  return {
    id,
    name,
    gainMethod,
    targetReps,
    baseSets,
    warmupEnabled,
    warmupTargetReps,
    active,
    highRepLower,
    highRepUpper,
    highRepIncrement,
    bodyweightGoalType,
    targetSeconds,
    isUnilateral,
    cueNotes,
  };
}

// 종목별 상태값 (현재 중량, 증량 조건 진행 상태)
export function makeExerciseState({
  exerciseId,
  currentWeight = 0,
  gainConditionState = "none", // "none" | "one_a" | "condition_met" — A/B/X 누적 횟수가 아니라 "현재 조건 충족 상태"만 저장
  isGainCandidate = false,
  freeweightStage = null, // "stage1_3set" | "stage2_4set" | "stage3_challenge_ready" | null (freeweight 전용)
  warmupWeightOverride = null, // 종목 수정 화면에서 직접 지정한 워밍업 중량. null이면 과거 기록 기반 자동계산을 사용.
  challengeWeightDefault = null, // 종목 수정 화면에서 지정한 도전세트 기본 중량. null이면 운동 화면에서 매번 직접 입력.
  bodyweightConsecutiveA = 0, // 맨몸 전용: 세션 최종 판정 A가 연속으로 몇 번 나왔는지. B/X 발생 시 0으로 초기화.
  bodyweightGoalAdjustPending = false, // 맨몸 전용: "목표 조정 검토가 필요한 상태"인지. 연속 A 기준(기본 3회)에 처음 도달했을 때 true가 되고,
  // 이후에는 세션 결과와 무관하게 유지되며, 사용자가 실제로 목표(반복수/시간/세트 수)를 수정해야만 false로 해제됩니다.
  // v2.4.0: 이 필드는 "성장 사이클상 목표 조정이 필요한 상태"만 나타냅니다. Notification Center에 지금 보여줄지 여부는
  // 더 이상 이 필드만으로 판단하지 않고, 아래 bodyweightGoalAdjustNotificationDismissed와 함께 판단합니다.
  bodyweightGoalAdjustNotificationDismissed = false, // 맨몸 전용(v2.4.0): Pending과 별개로 "이번에 발생한 알림을 이미
  // Notification Center에서 확인/처리했는지"만 나타내는 UI 전용 파생 상태입니다. "현행 유지"를 선택하면 이 값만 true가 되고
  // bodyweightGoalAdjustPending은 그대로 유지됩니다("목표 수정"을 선택하면 pending 자체가 false가 되므로 이 값은 의미가 없어짐).
  // pending이 false -> true로 "새로 바뀌는 순간"에는 항상 false로 다시 리셋되어, 다음에 새로 발생한 알림이 정상 노출됩니다.
  // Notification Center 표시 조건: bodyweightGoalAdjustPending === true && bodyweightGoalAdjustNotificationDismissed === false.
  machinePendingIncreaseWeight = null, // 머신(machine) 전용: 도전세트 성공 직후, 아직 실제로 적용되지 않은 "증량 예정 중량".
  // currentWeight와는 별개로 보관되며, 원래 중량(currentWeight)에서 A-A를 다시 달성하는 순간에만 currentWeight로 승격되고 null로 비워집니다.
  // freeweight/high_rep/bodyweight에서는 사용하지 않습니다(항상 null로 유지).
  machineChallengeWeight = null, // 머신(machine) 전용: 도전세트 "실패" 시 재도전에 사용할 도전 중량을 기억해두는 필드.
  // machinePendingIncreaseWeight(성공 후 증량 대기)와는 역할이 완전히 다릅니다 — 이 필드는 실패했을 때만 채워지고,
  // 다음 도전세트 화면의 입력 기본값으로만 쓰이며 currentWeight에는 절대 영향을 주지 않습니다.
  // 도전 성공 시에는 null로 초기화됩니다. freeweight/high_rep/bodyweight에서는 사용하지 않습니다.
  freeweightChallengeWeight = null, // 프리웨이트(freeweight) 전용: 도전세트 "실패" 시 재도전에 사용할 도전 중량을 기억해두는 필드.
  // 이름은 machineChallengeWeight와 비슷하지만 완전히 독립된 필드이며, 서로 참조하지 않습니다.
  // 프리웨이트는 도전 성공 시 "즉시" currentWeight로 승격되므로(머신처럼 보류 상태를 거치지 않음),
  // 성공 시 이 필드는 바로 null로 초기화됩니다. machine/high_rep/bodyweight에서는 사용하지 않습니다.
} = {}) {
  return {
    exerciseId,
    currentWeight,
    gainConditionState,
    isGainCandidate,
    freeweightStage,
    warmupWeightOverride,
    challengeWeightDefault,
    bodyweightConsecutiveA,
    bodyweightGoalAdjustPending,
    bodyweightGoalAdjustNotificationDismissed,
    machinePendingIncreaseWeight,
    machineChallengeWeight,
    freeweightChallengeWeight,
  };
}

// 요일별 루틴 (버전 관리 포함)
export function makeRoutineVersion({ id = uid("rv"), title, isDefault = true, items = [] } = {}) {
  return { id, title, isDefault, items }; // items: [{exerciseId, order}]
}

export function makeRoutineDay(dayKey) {
  return { day: dayKey, versions: [] };
}

// 운동 세션(운동 기록)
export function makeWorkoutSession({
  id = uid("session"),
  date,
  day,
  routineVersionId = null,
  startTime = null,
  endTime = null,
  durationMinutes = null,
  freeweightChallengeExerciseId = null,
  records = [],
  generation = 1, // v2.3.0: 이 세션이 속한 Generation 번호. "운동 기준 초기화" 전후 기록을 구분하는 데만 쓰이고(그래프 색상 구분/히스토리 집계), 판정/증량 로직에는 전혀 관여하지 않습니다.
} = {}) {
  return { id, date, day, routineVersionId, startTime, endTime, durationMinutes, freeweightChallengeExerciseId, records, generation };
}

// 세션 내 종목별 기록
export function makeExerciseRecord({
  exerciseId,
  weightUsed, // 본세트에 사용한 중량 (워밍업 계산의 기준이 됨)
  challengeWeight = null, // 도전세트에 사용한 중량(본세트와 다를 수 있음). 워밍업 계산에서 항상 제외.
  warmup = null, // { targetReps, weight, performedRaw, leftRaw, rightRaw } - leftRaw/rightRaw는 편측(isUnilateral) 종목의 워밍업에서만 값이 채워지고, 그 외에는 빈 문자열/미사용(본세트와 동일한 관례)
  sets = [], // [{setNo, targetReps, performedRaw, isChallenge, isWarmup, leftRaw, rightRaw}] - leftRaw/rightRaw는 편측(isUnilateral) 종목의 본세트에서만 사용, 그 외에는 null
  judgement = null, // "A" | "B" | "X" | null
  challengeResult = null, // "success" | "retry" | null
  gainEvent = null, // null | "auto_increase" (과거 버전에서 고반복이 상한을 연속 달성해 자동 증량됐던 이력이 남은 기존 세션 기록에만 존재.
  // v1.8부터 high_rep은 더 이상 이 값을 "auto_increase"로 설정하지 않습니다 - 자동 증량 자체를 제거했습니다.)
  goalAdjustSuggested = false, // 맨몸 전용: 이 세션에서 A 연속 달성 기준(기본 3회)을 채워 "목표 조정 검토" 알림을 띄워야 하는 경우 true
  highRepGoalReviewSuggested = false, // 고반복(high_rep) 전용: 이 세션에서 모든 본세트가 상한 반복수를 연속 수행으로 달성해
  // "목표 중량 검토" 안내를 띄워야 하는 경우 true. 맨몸의 goalAdjustSuggested와 달리 ExerciseState에는 대응하는
  // 지속 상태(pending)가 전혀 없습니다 - 오직 이 세션 기록에만 1회성으로 남고, 다음 세션 판단에는 전혀 영향을 주지 않습니다.
} = {}) {
  return {
    exerciseId,
    weightUsed,
    challengeWeight,
    warmup,
    sets,
    judgement,
    challengeResult,
    gainEvent,
    goalAdjustSuggested,
    highRepGoalReviewSuggested,
  };
}

// 전체 앱 상태 기본값
export function defaultAppData() {
  return {
    schemaVersion: SCHEMA_VERSION,
    exercises: [],
    exerciseStates: {}, // exerciseId -> ExerciseState
    routines: DAYS.map((d) => makeRoutineDay(d.key)),
    sessions: [],
    designatedChallengeExerciseId: null, // 다음 해당 종목 세션에 도전세트를 적용할 종목 (머신/프리웨이트 공통, 사용자가 선택)
    currentGeneration: 1, // v2.3.0: "운동 기준 초기화"를 누를 때마다 1씩 증가. bodyweight는 이 개념의 영향을 받지 않습니다.
    // v2.4.0: 고반복(high_rep) "목표 검토" 알림 저장소. exerciseId -> { updatedAt }.
    // ExerciseState의 Pending 개념과는 별개이며, gain.js/judge.js는 이 값을 전혀 참조하지 않습니다.
    // 종목당 최대 1건만 유지되고(같은 종목에서 다시 발생하면 updatedAt만 갱신), 사용자가 알림센터에서
    // "목표 수정" 또는 "현행 유지"를 선택하면 해당 항목이 삭제됩니다.
    highRepReviewAlerts: {},
    settings: {
      themeId: "themeB",
      customThemeNames: {}, // themeId -> 사용자가 Long Press로 바꾼 이름
    },
  };
}
