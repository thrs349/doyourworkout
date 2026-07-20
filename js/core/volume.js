// volume.js
// v2.7.0: "설정된 루틴 기준 예상 주간 볼륨"만 계산하는 순수 함수 모듈입니다.
// 입력은 ExerciseDefinition(role/primaryBodyPart/secondaryTags/baseSets)과 요일별 루틴 구성뿐이며,
// ExerciseState/WorkoutSession(중량, 판정, 증량, 상태 전이)은 이 파일 어디에서도 참조하지 않습니다.
// 즉 judge.js/gain.js와는 사용하는 데이터 자체가 겹치지 않아 완전히 분리되어 있습니다.
//
// 계산 범위(v2.7.0):
//  - 포함: 본세트(baseSets) — "설정된 루틴"이 곧 계획이므로 baseSets를 그대로 계획 세트 수로 봅니다.
//  - 도전세트: 실제로는 세션마다 1개 종목에만 동적으로 배정되는 런타임 개념(state.js의
//    designatedChallengeExerciseId)이라 "루틴에 고정된 데이터"가 아닙니다. 특정 종목에 임의로 +1을
//    가산하면 오히려 "설정 루틴 기준 예상치"라는 취지에 맞지 않아, v2.7.0 계획 볼륨에는 포함하지 않습니다
//    (실제 수행 기반 볼륨은 v2.7.1 이후 세션 기록을 바탕으로 별도 계산 예정).
//  - 워밍업 세트: 제외(애초에 baseSets에 포함되지 않는 별도 필드).
//  - 판정(A/B/X), 분할세트 성공 여부: 사용하지 않음.
//
// 가중치(v2.7.0 확정, v2.7.1에서도 유지): 메인 1.0 / 보조 0.65 / 코어 0.65.
//
// v2.7.1: 계산 방식 변경(확정) — "주간 계획 루틴 기준 예상 근성장 자극량" 취지에 맞춰, 실제 볼륨 계산 단위를
// Secondary Tag로 바꿨습니다. 자세한 규칙은 calcWeeklyVolume() 위 주석 참고. 반올림도 floor → Math.round로
// 변경되었고, 적용 시점은 여전히 "개별 종목이 아니라 같은 태그로 다 모인 뒤 최종 1회"입니다.

import { BODY_PARTS, secondaryTagsFor, effectiveRole, effectiveRoleWeight } from "./models.js";

// 하이라이트 태그 표시 순서를 고정하기 위한 목록(상체 태그 → 하체 태그 → 코어).
const HIGHLIGHT_TAG_ORDER = [...secondaryTagsFor("상체"), ...secondaryTagsFor("하체"), "코어"];

// v2.7.1: 볼륨 계산 규칙 변경(확정) — Secondary Tag가 실제 계산 단위이며, Primary Body Part는 그룹 분류용
// 대분류일 뿐 별도로 점수를 더하지 않습니다. 단, Secondary Tag가 없는 운동을 0으로 만들지 않기 위해
// "태그 없는 운동은 Primary에 직접 반영"하는 방어 처리를 함께 둡니다(태그 누락 데이터/신규 운동 대비).
//  - 운동 총점(raw) = 계획 세트 수(baseSets) × 역할 가중치(effectiveRoleWeight)
//  - Secondary Tag가 있으면: 총점을 태그 개수만큼 "균등 분배"해서 각 태그의 raw 누적값에 더합니다.
//  - Secondary Tag가 없으면: 태그 raw 누적에는 전혀 관여하지 않고, 해당 Primary Body Part의 "직접 반영" raw
//    누적값에 총점 전체를 더합니다. 코어(primaryBodyPart==="코어")는 현재 데이터 구조상 secondaryTags UI
//    자체가 없어 항상 빈 배열이므로, 이 일반 규칙을 그대로 타면서 자연스럽게 "코어는 항상 직접 반영"이 됩니다
//    (별도 분기 불필요 — models.js도 건드리지 않습니다).
//  - 반올림(Math.round, floor 금지)은 "개별 운동 단위"에서 하지 않습니다. 부위(Primary)의 최종 total은
//    "그 부위에 속한 모든 raw(태그 누적 raw 전체 + 직접 반영 raw)를 다 더한 뒤" 딱 한 번만 반올림합니다
//    (태그별로 먼저 반올림한 값들을 정수로 합산하지 않음 — 반올림을 두 번 겹쳐 하면 사용된 세트 수보다
//    값이 부풀려질 수 있어, 이번 버전은 "raw 합산 → 최종 1회 반올림"이라는 확정 순서를 그대로 따릅니다).
//    태그별로 화면에 보여줄 개별 숫자(예: "가슴 4세트")는 별도로 그 태그의 raw 누적값만 반올림해서 표시하며,
//    Secondary Tag가 없는 운동의 기여분은 어떤 특정 태그에도 속하지 않으므로(직접 반영이라 태그 자체가 없음)
//    이 개별 태그 표시에는 나타나지 않고 부위 total에만 반영됩니다(그만큼 total이 태그들의 합보다 클 수 있음
//    — 태그 누락 데이터를 "0 처리"하지 않기 위한 의도된 결과입니다).
function emptyTagAccumulator() {
  const acc = {};
  BODY_PARTS.forEach((part) => {
    acc[part] = {};
    secondaryTagsFor(part).forEach((tag) => (acc[part][tag] = 0));
  });
  return acc;
}

// dayExerciseLists: { [dayKey]: ExerciseDefinition[] } — 요일별로 "루틴에 포함된" 종목 목록.
// 비활성 종목도 포함해서 넘겨야 합니다(호출부인 state.js가 getRoutineExercisesForEdit()로 이미 그렇게 넘김).
// 반환: { [bodyPart]: { total: number, tags: { [tag]: number } } } — total/tags 값은 모두 반올림된 정수(세트).
export function calcWeeklyVolume(dayExerciseLists) {
  const tagRaw = emptyTagAccumulator(); // part -> tag -> raw 누적(태그 있는 운동만)
  const directRaw = {}; // part -> raw 누적(태그 없는 운동 + 코어, Primary에 직접 반영)
  BODY_PARTS.forEach((part) => (directRaw[part] = 0));

  Object.values(dayExerciseLists || {}).forEach((exercises) => {
    (exercises || []).forEach((ex) => {
      if (!ex || !BODY_PARTS.includes(ex.primaryBodyPart)) return; // 부위 미지정 종목은 볼륨 계산에서 제외
      const part = ex.primaryBodyPart;
      const score = (ex.baseSets || 0) * effectiveRoleWeight(ex); // 1. raw 자극량 계산

      // 2. Secondary Tag별 누적 (있으면 균등 분배) / 없으면 Primary에 직접 반영(0 처리 방지, 코어도 이 경로)
      const tags = (ex.secondaryTags || []).filter((tag) => tag in tagRaw[part]);
      if (tags.length === 0) {
        directRaw[part] += score;
        return;
      }
      const perTag = score / tags.length;
      tags.forEach((tag) => {
        tagRaw[part][tag] += perTag;
      });
    });
  });

  const result = {};
  BODY_PARTS.forEach((part) => {
    // 1~3단계(운동 raw 계산 -> Secondary Tag별 raw 누적 -> Primary별 raw 합산)까지는 tagRaw/directRaw에
    // 전부 반올림 전 raw 상태로만 쌓여 있습니다. 아래 두 값은 서로의 결과를 재사용하지 않고, 각자 "같은 raw
    // 소스"에서 이 지점(4단계, 최종 표시 직전)에 단 한 번씩만 Math.round()를 적용합니다 — Secondary 표시값이
    // Primary 합산에 쓰이거나, 그 반대로 쓰이는 경로는 없습니다.
    const partRawTotal = Object.values(tagRaw[part]).reduce((sum, v) => sum + v, 0) + directRaw[part];
    result[part] = {
      total: Math.round(partRawTotal), // Primary 표시값: raw 합산 결과를 직접 반올림
      tags: Object.fromEntries(Object.entries(tagRaw[part]).map(([tag, v]) => [tag, Math.round(v)])), // Secondary 표시값: 태그별 raw를 각각 반올림
    };
  });
  return result;
}

// 루틴 리스트 카드의 "4개 운동 (메인 10세트, 보조 6세트)" 메타 표시용 - 가중치 없이 원본 baseSets 기준
// 메인/보조(코어 포함) 세트 수만 단순 합산합니다. 볼륨 카드(calcWeeklyVolume)와는 별개의 표시용 집계입니다.
export function calcDayRoleSetSummary(exercises) {
  let main = 0;
  let assist = 0;
  (exercises || []).forEach((ex) => {
    if (!ex) return;
    const sets = ex.baseSets || 0;
    if (effectiveRole(ex) === "main") main += sets;
    else assist += sets; // "assist" | "core" 모두 이 카드에서는 "보조"로 합산 표시
  });
  return { main, assist };
}

// 루틴 리스트 카드의 하이라이트 박스([가슴·등·어깨] 등)에 표시할 태그 목록.
// 상체/하체 종목은 secondaryTags를, 코어 종목은 primaryBodyPart 자체("코어")를 사용합니다
// (v2.7.0 확정: 상체/하체는 Primary 미표시, 코어는 Primary 표시). 표시 순서는 HIGHLIGHT_TAG_ORDER로 고정.
export function calcDayHighlightTags(exercises) {
  const present = new Set();
  (exercises || []).forEach((ex) => {
    if (!ex) return;
    if (ex.primaryBodyPart === "코어") present.add("코어");
    else (ex.secondaryTags || []).forEach((tag) => present.add(tag));
  });
  return HIGHLIGHT_TAG_ORDER.filter((tag) => present.has(tag));
}
