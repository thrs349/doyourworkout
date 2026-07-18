// storage.js
// 기기 로컬 저장(Local Storage) 및 JSON 내보내기/가져오기만 담당합니다.
// 데이터의 "의미"는 모르고, 그대로 저장하고 그대로 돌려줄 뿐입니다.

import { defaultAppData, SCHEMA_VERSION } from "./models.js";
import { APP_VERSION } from "./appConfig.js";

const STORAGE_KEY = "hangtory:data";
// v2.3.0: 운동 진행 상태(Draft) 복구 기능 전용 key입니다. STORAGE_KEY(메인 데이터)와 완전히 분리되어 있어
// SCHEMA_VERSION/migrate()와는 무관합니다. 내부 식별자라 브랜딩 변경 대상이 아닙니다.
const DRAFT_STORAGE_KEY = "hangtory:draft";

export function loadData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultAppData();
    const parsed = JSON.parse(raw);
    return migrate(parsed);
  } catch (e) {
    console.error("[storage] 데이터를 불러오지 못했습니다. 기본값으로 시작합니다.", e);
    return defaultAppData();
  }
}

export function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (e) {
    console.error("[storage] 저장에 실패했습니다.", e);
    return false;
  }
}

// 스키마 버전이 바뀔 때마다 과거 백업을 최대한 살리기 위한 이관 지점입니다.
// 새 필드가 추가되면 여기서 단계적으로(버전별로) 기본값을 채워 넣습니다.
export function migrate(data) {
  const base = defaultAppData();
  if (!data || typeof data !== "object") return base;

  const fromVersion = data.schemaVersion || 1;

  const merged = {
    ...base,
    ...data,
    settings: { ...base.settings, ...(data.settings || {}) },
    exerciseStates: { ...(data.exerciseStates || {}) },
  };

  // v1 -> v2: 종목마다 active(비활성화 여부) 필드가 추가됨. 과거 데이터는 모두 "사용 중"으로 간주합니다.
  if (fromVersion < 2) {
    merged.exercises = (merged.exercises || []).map((ex) => ({ active: true, ...ex }));
  }

  // v2 -> v3:
  //  - 종목의 `type` 필드를 `gainMethod`로 옮깁니다("machine"/"freeweight" 값은 그대로 유효).
  //  - 프리웨이트 자동 우선순위(challengePriority)는 더 이상 쓰지 않으므로 제거합니다.
  //  - 고반복(high_rep) 전용 필드와 종목 상태값의 새 필드(warmupWeightOverride, challengeWeightDefault)를 기본값으로 채웁니다.
  if (fromVersion < 3) {
    merged.exercises = (merged.exercises || []).map((ex) => {
      const { type, challengePriority, ...rest } = ex;
      return {
        ...rest,
        gainMethod: ex.gainMethod || type || "machine",
        highRepLower: ex.highRepLower ?? null,
        highRepUpper: ex.highRepUpper ?? null,
        highRepIncrement: ex.highRepIncrement ?? null,
      };
    });
    merged.exerciseStates = Object.fromEntries(
      Object.entries(merged.exerciseStates || {}).map(([id, st]) => [
        id,
        { warmupWeightOverride: null, challengeWeightDefault: null, ...st },
      ])
    );
  }

  // v3 -> v4:
  //  - 맨몸(bodyweight) 전용 필드(bodyweightGoalType, targetSeconds)를 기본값으로 채웁니다.
  //  - 편측성(isUnilateral) 필드를 기본값(false)으로 채웁니다.
  //  - 과거 세션 기록의 세트에는 leftRaw/rightRaw 필드가 없었으므로 null로 채워 구조만 맞춥니다.
  if (fromVersion < 4) {
    merged.exercises = (merged.exercises || []).map((ex) => ({
      bodyweightGoalType: ex.bodyweightGoalType ?? null,
      targetSeconds: ex.targetSeconds ?? null,
      isUnilateral: ex.isUnilateral ?? false,
      ...ex,
    }));
    merged.sessions = (merged.sessions || []).map((session) => ({
      ...session,
      records: (session.records || []).map((record) => ({
        ...record,
        sets: (record.sets || []).map((s) => ({ leftRaw: null, rightRaw: null, ...s })),
      })),
    }));
  }

  // v4 -> v5:
  //  - 맨몸 전용 상태값 bodyweightConsecutiveA(연속 A 카운트)를 기본값 0으로 채웁니다.
  //  - 과거 세션 기록에는 goalAdjustSuggested 필드가 없었으므로 false로 채워 구조만 맞춥니다.
  if (fromVersion < 5) {
    merged.exerciseStates = Object.fromEntries(
      Object.entries(merged.exerciseStates || {}).map(([id, st]) => [id, { bodyweightConsecutiveA: 0, ...st }])
    );
    merged.sessions = (merged.sessions || []).map((session) => ({
      ...session,
      records: (session.records || []).map((record) => ({ goalAdjustSuggested: false, ...record })),
    }));
  }

  // v5 -> v6: 목표 조정 알림을 "1회성 팝업 + 지속 상태(pending)"로 분리하면서 추가된 필드입니다.
  // 과거 데이터는 아직 알림을 받은 적이 없는 것으로 간주해 false로 채웁니다.
  if (fromVersion < 6) {
    merged.exerciseStates = Object.fromEntries(
      Object.entries(merged.exerciseStates || {}).map(([id, st]) => [id, { bodyweightGoalAdjustPending: false, ...st }])
    );
  }

  // v6 -> v7: 머신 전용 "도전세트 성공 후 보류 중인 증량 예정 중량"(machinePendingIncreaseWeight) 필드가 추가됨.
  // 과거 데이터에는 이 개념 자체가 없었으므로 "보류 중인 증량 없음"을 뜻하는 null로 채웁니다.
  // (freeweight/high_rep/bodyweight 종목의 상태값에도 필드는 생기지만, 해당 방식들의 로직에서는 이 필드를 전혀 참조하지 않습니다.)
  if (fromVersion < 7) {
    merged.exerciseStates = Object.fromEntries(
      Object.entries(merged.exerciseStates || {}).map(([id, st]) => [id, { machinePendingIncreaseWeight: null, ...st }])
    );
  }

  // v7 -> v8: 머신 전용 "도전세트 실패 시 재도전용으로 기억해두는 도전 중량"(machineChallengeWeight) 필드가 추가됨.
  // machinePendingIncreaseWeight(성공 후 증량 대기)와는 별개의 필드이며, 과거 데이터는 기억해둔 재도전 중량이 없는 것으로 간주해 null로 채웁니다.
  if (fromVersion < 8) {
    merged.exerciseStates = Object.fromEntries(
      Object.entries(merged.exerciseStates || {}).map(([id, st]) => [id, { machineChallengeWeight: null, ...st }])
    );
  }

  // v8 -> v9: 프리웨이트 전용 "도전세트 실패 시 재도전용으로 기억해두는 도전 중량"(freeweightChallengeWeight) 필드가 추가됨.
  // machineChallengeWeight와 이름은 비슷하지만 완전히 독립된 필드입니다. 과거 데이터는 null로 채웁니다.
  if (fromVersion < 9) {
    merged.exerciseStates = Object.fromEntries(
      Object.entries(merged.exerciseStates || {}).map(([id, st]) => [id, { freeweightChallengeWeight: null, ...st }])
    );
  }

  // v9 -> v10: 고반복(high_rep) 자동 증량을 제거하고 대신 세션 기록에만 남는 1회성 신호(highRepGoalReviewSuggested)로
  // 교체했습니다. ExerciseState에는 대응하는 필드가 없습니다(의도적으로 없음). 과거 세션 기록에는 이 필드가 없었으므로
  // false로 채워 구조만 맞춥니다. 과거에 이미 "auto_increase"로 기록된 세션의 gainEvent 값은 지난 이력이므로 그대로 둡니다.
  if (fromVersion < 10) {
    merged.sessions = (merged.sessions || []).map((session) => ({
      ...session,
      records: (session.records || []).map((record) => ({ highRepGoalReviewSuggested: false, ...record })),
    }));
  }

  // v10 -> v11: 종목별 큐노트(cueNotes) 필드가 추가됨. 판정/증량 상태와는 무관한 순수 표시용 메모이며,
  // 과거 데이터에는 이 개념 자체가 없었으므로 "메모 없음"을 뜻하는 빈 배열([])로 채웁니다(null 사용하지 않음).
  if (fromVersion < 11) {
    merged.exercises = (merged.exercises || []).map((ex) => ({ cueNotes: [], ...ex }));
  }

  // v11 -> v12: Generation(운동 기준 초기화) 지원을 위한 필드가 추가됨.
  //  - 루트에 currentGeneration(현재 Generation 번호)을 1로 채웁니다(과거 데이터는 전부 "초기화 이전"이므로 1).
  //  - 과거 세션 기록 전부에 generation:1을 채웁니다. 판정/증량 계산과 무관한, 그래프 색상 구분/히스토리 집계 전용 값입니다.
  if (fromVersion < 12) {
    merged.currentGeneration = merged.currentGeneration ?? 1;
    merged.sessions = (merged.sessions || []).map((session) => ({ generation: 1, ...session }));
  }

  // v12 -> v13: Exercise Notification Center를 위한 고반복(high_rep) "목표 검토" 알림 저장소가 추가됨.
  // 과거 데이터에는 이 개념 자체가 없었으므로 "보관 중인 알림 없음"을 뜻하는 빈 객체({})로 채웁니다.
  // ExerciseState/세션 기록에는 아무 필드도 추가하지 않으므로 이 블록 외에는 영향이 없습니다.
  if (fromVersion < 13) {
    merged.highRepReviewAlerts = merged.highRepReviewAlerts || {};
  }

  // v13 -> v14: bodyweight의 Notification(알림 표시 여부)과 Pending(성장 사이클 상태)을 분리하기 위해
  // bodyweightGoalAdjustNotificationDismissed 필드가 추가됨. 과거 데이터는 이 알림을 아직 아무도 처리하지 않은 것과
  // 동등하므로 false로 채웁니다(참고: 과거에 pending===true였던 종목은 이 migration 이후 다시 Notification Center에
  // 노출되는데, 이는 v13까지는 pending===Notification이었으므로 실질적으로 이전과 동일한 노출 결과입니다).
  if (fromVersion < 14) {
    merged.exerciseStates = Object.fromEntries(
      Object.entries(merged.exerciseStates || {}).map(([id, st]) => [id, { bodyweightGoalAdjustNotificationDismissed: false, ...st }])
    );
  }

  merged.schemaVersion = SCHEMA_VERSION;
  return merged;
}

export function exportJSON(data) {
  const payload = { ...data, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  // v2.3.0: 브랜딩 변경 반영 + 날짜를 YYMMDD로 표기 (예: 260713). STORAGE_KEY 등 내부 식별자와는 무관합니다.
  // v2.5.0: 여러 백업 파일을 구분하기 쉽도록 앱 버전을 파일명에 추가합니다(예: doyourworkout-backup-260713-v2.4.json).
  // JSON 내부 payload 구조는 그대로이며, 파일명에만 반영합니다.
  const stamp = new Date().toISOString().slice(2, 10).replace(/-/g, "");
  a.href = url;
  a.download = `doyourworkout-backup-${stamp}-${APP_VERSION}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// ---------------- 운동 진행 상태(Draft) 복구 ----------------
// v2.3.0: 메인 앱 데이터(STORAGE_KEY)와 완전히 분리된 별도 key를 사용합니다.
// SCHEMA_VERSION/migrate()의 영향을 전혀 받지 않고, defaultAppData()에도 포함되지 않습니다.
// 저장하는 값은 state.js의 startSession()이 만드는 draft 구조({id,date,day,startTime,plan})를 그대로,
// 추가 필드 없이 저장합니다.

export function saveDraft(draft) {
  try {
    localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return true;
  } catch (e) {
    console.error("[storage] draft 저장에 실패했습니다.", e);
    return false;
  }
}

export function loadDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) {
    console.error("[storage] draft를 불러오지 못했습니다.", e);
    return null;
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch (e) {
    console.error("[storage] draft 삭제에 실패했습니다.", e);
  }
}

// v2.5.0: 백업 파일을 읽고 JSON으로 파싱만 합니다(migrate 미적용). 복원 확인 모달에 보여줄 데이터를
// 먼저 확보하기 위한 용도로, 실제 앱 데이터로 반영하는 시점(migrate + 저장)과 분리했습니다.
export function readJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

// v2.5.0: 백업 파일의 "최소 구조"만 확인합니다. 세부 값이나 모든 필드를 강제하지 않으며,
// 구버전 백업(과거 스키마)도 이 조건은 만족하므로 migrate()가 담당하는 하위호환 영역은 건드리지 않습니다.
export function validateBackupShape(parsed) {
  if (!parsed || typeof parsed !== "object") return false;
  if (!Array.isArray(parsed.exercises)) return false;
  if (!Array.isArray(parsed.sessions)) return false;
  if (!Array.isArray(parsed.routines)) return false;
  if (!parsed.settings || typeof parsed.settings !== "object") return false;
  return true;
}
