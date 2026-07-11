// judge.js
// A/B/X 판정, 도전세트 성공/재도전 판단만 담당하는 순수 함수 모음입니다.
// DOM이나 저장소를 전혀 모르므로 그대로 테스트하거나 재사용할 수 있습니다.

// 세트 입력값을 해석합니다.
// "12" -> 한 번에 12회 (clean)
// "6+6" -> 쉬었다 나눠서 총 12회 (broken, "연속 수행" 인정 대상에서는 제외되지만 총량 계산에는 포함)
export function parseSetInput(raw) {
  if (raw === null || raw === undefined || raw === "") return { total: 0, broken: false, empty: true };
  const str = String(raw).trim();
  if (str.includes("+")) {
    const parts = str.split("+").map((s) => Number(s.trim()) || 0);
    return { total: parts.reduce((a, b) => a + b, 0), broken: true, empty: false };
  }
  const num = Number(str);
  return { total: Number.isFinite(num) ? num : 0, broken: false, empty: false };
}

// 한 세트가 "연속 수행으로 target을 달성"했는지 판단합니다.
// mode "exact": 정확히 target과 같아야 함 (머신/프리웨이트 본세트, 도전세트 기준)
// mode "threshold": target(하한) 이상이면 됨 (고반복 본세트 기준)
export function isCleanlyAchieved(parsed, target, mode) {
  if (parsed.broken) return false;
  return mode === "threshold" ? parsed.total >= target : parsed.total === target;
}

// 원시 입력값(performedRaw)을 바로 넘겨서 판단하고 싶을 때 쓰는 편의 함수입니다.
export function isSetAchieved(performedRaw, target, mode = "exact") {
  return isCleanlyAchieved(parseSetInput(performedRaw), target, mode);
}

// mainSets: [{ targetReps, performedRaw }]  (워밍업/도전세트는 제외하고 넘겨야 함)
// options.mode: "exact"(머신/프리웨이트, 기본값) | "threshold"(고반복 - targetReps를 하한으로 취급)
// 반환: "A" | "B" | "X" | null(아직 미입력)
export function computeJudgement(mainSets, { mode = "exact" } = {}) {
  if (!mainSets || mainSets.length === 0) return null;
  const parsed = mainSets.map((s) => ({ ...parseSetInput(s.performedRaw), target: s.targetReps }));
  if (parsed.some((p) => p.empty)) return null;

  const allClean = parsed.every((p) => isCleanlyAchieved(p, p.target, mode));
  if (allClean) return "A";

  const totalTarget = parsed.reduce((a, p) => a + p.target, 0);
  const totalPerformed = parsed.reduce((a, p) => a + p.total, 0);
  return totalPerformed >= totalTarget ? "B" : "X";
}

// 고반복 전용: 모든 본세트가 "상한"까지 연속 수행으로 달성했는지 확인합니다(자동 증량 조건).
export function allSetsAchievedContinuously(mainSets, target) {
  if (!mainSets || mainSets.length === 0) return false;
  return mainSets.every((s) => {
    const p = parseSetInput(s.performedRaw);
    return isCleanlyAchieved(p, target, "threshold");
  });
}

// 도전세트 성공 판정: 목표 반복수의 80% 이상을 "연속 수행"으로 달성하면 성공입니다.
// 분할 수행(예: 6+4, 5+5)은 총 반복수가 80% 이상이어도 성공으로 인정하지 않고 항상 재도전 처리합니다.
// (v1.4: 이전 버전에서 100% 기준으로 잘못 구현됐던 것을 원래 의도한 80% 기준으로 수정했습니다.)
export function computeChallengeResult(performedRaw, targetReps) {
  const p = parseSetInput(performedRaw);
  if (p.empty) return null;
  if (p.broken) return "retry";
  return p.total >= targetReps * 0.8 ? "success" : "retry";
}

// 편측(좌우 구분) 운동 전용 판정입니다. gainMethod의 exact/threshold 모드와는 별개의 독립적인 규칙입니다.
// sets: [{ target, leftRaw, rightRaw }]
// mode: "exact"(머신/프리웨이트 등 기본값) | "threshold"(맨몸 반복수형/고반복 - "이상"이면 달성)
// A: 모든 세트에서 양쪽 다 목표치를 mode 기준으로, 연속 수행으로 달성
// X: 세트 중 하나라도, 좌우 중 한쪽이라도 목표치 미만
// B: X는 아니지만(모두 목표 이상) A는 아닌 경우(한쪽 이상 분할 수행 등)
export function computeUnilateralJudgement(sets, mode = "exact") {
  if (!sets || sets.length === 0) return null;
  const parsed = sets.map((s) => ({
    left: parseSetInput(s.leftRaw),
    right: parseSetInput(s.rightRaw),
    target: s.target,
  }));
  if (parsed.some((p) => p.left.empty || p.right.empty)) return null;

  // v1.8: "한쪽이라도 목표 미달이면 X" — 반대쪽이 목표를 채워도 상쇄하지 않습니다.
  const anyUnderTarget = parsed.some((p) => p.left.total < p.target || p.right.total < p.target);
  if (anyUnderTarget) return "X";

  const leftAllClean = parsed.every((p) => isCleanlyAchieved(p.left, p.target, mode));
  const rightAllClean = parsed.every((p) => isCleanlyAchieved(p.right, p.target, mode));
  if (leftAllClean && rightAllClean) return "A";

  return "B";
}

// 편측 시간형(맨몸) 전용 판정입니다. computeUnilateralJudgement(분할 수행 개념 기반)와는 완전히 별개이며,
// computeBodyweightTimeJudgement(비편측 시간형)와 동일한 목표/80% 3단계 기준을 좌우 각각에 적용합니다.
// sets: [{ target: 목표시간(초), leftRaw, rightRaw }]
// A: 모든 세트에서 좌우 모두 목표 시간 이상
// B: A는 아니지만, 모든 세트에서 좌우 모두 목표 시간의 80% 이상
// X: 한 세트라도 좌우 중 한쪽이 목표 시간의 80% 미만
export function computeUnilateralTimeJudgement(sets) {
  if (!sets || sets.length === 0) return null;
  const parsed = sets.map((s) => {
    const left = Number(s.leftRaw);
    const right = Number(s.rightRaw);
    return {
      leftRaw: s.leftRaw,
      rightRaw: s.rightRaw,
      left: Number.isFinite(left) ? left : null,
      right: Number.isFinite(right) ? right : null,
      target: s.target,
    };
  });
  const isEmpty = (v) => v === "" || v === null || v === undefined;
  if (parsed.some((p) => isEmpty(p.leftRaw) || isEmpty(p.rightRaw) || p.left === null || p.right === null)) return null;

  const allHit = parsed.every((p) => p.left >= p.target && p.right >= p.target);
  if (allHit) return "A";

  const allAtLeast80 = parsed.every((p) => p.left >= p.target * 0.8 && p.right >= p.target * 0.8);
  return allAtLeast80 ? "B" : "X";
}

// 고반복(high_rep) 편측 전용: 상한 반복수 달성 여부(자동 증량 대신 "목표 검토 팝업" 트리거)를 좌우 각각 확인합니다.
// allSetsAchievedContinuously(비편측)와 동일한 개념을 좌우에 적용한 것으로, 좌우 합산은 하지 않습니다.
// sets: [{ leftRaw, rightRaw }] (mainSets를 그대로 넘기면 됨)
export function allUnilateralSetsAchievedContinuously(sets, target) {
  if (!sets || sets.length === 0) return false;
  return sets.every((s) => {
    const left = parseSetInput(s.leftRaw);
    const right = parseSetInput(s.rightRaw);
    return isCleanlyAchieved(left, target, "threshold") && isCleanlyAchieved(right, target, "threshold");
  });
}

// 맨몸(반복수형) 전용 판정입니다. machine/freeweight/high_rep이 쓰는 computeJudgement(합산 기준 B/X)와는
// 완전히 별개의 세트별(per-set) 판정 규칙입니다. 어떤 gainMethod와도 판정 함수를 공유하지 않습니다.
// mainSets: [{ targetReps, performedRaw }]
// A: 모든 세트가 각각 목표 반복수 이상 + 연속 수행(분할 아님) — 초과 달성도 A
// X: 한 세트라도 목표 반복수 미달(분할 여부 무관, 총합이 목표에 못 미치면 그 세트는 미달)
// B: 모든 세트가 목표 반복수 이상이지만(=X 아님), 그중 하나 이상이 분할 수행
export function computeBodyweightRepsJudgement(mainSets) {
  if (!mainSets || mainSets.length === 0) return null;
  const parsed = mainSets.map((s) => ({ ...parseSetInput(s.performedRaw), target: s.targetReps }));
  if (parsed.some((p) => p.empty)) return null;

  const anyUnderTarget = parsed.some((p) => p.total < p.target);
  if (anyUnderTarget) return "X";

  const allContinuous = parsed.every((p) => !p.broken);
  return allContinuous ? "A" : "B";
}

// 맨몸(시간 기반) 전용 판정입니다. 반복수 판정(exact/threshold)과 별개의 독립 규칙입니다.
// 분할 시간 입력은 쓰지 않으므로(항상 하나의 숫자), "+"가 들어와도 단순 숫자로만 취급합니다.
// mainSets: [{ targetReps: 목표시간(초), performedRaw }]
// 세트 간 합산이 아니라, 세트 "각각"을 기준으로 판정합니다.
// A: 모든 세트가 목표 시간 이상
// B: (모든 세트가 A는 아니지만) 모든 세트가 목표 시간의 80% 이상
// X: 한 세트라도 목표 시간의 80% 미만
export function computeBodyweightTimeJudgement(mainSets) {
  if (!mainSets || mainSets.length === 0) return null;
  const parsed = mainSets.map((s) => {
    const num = Number(s.performedRaw);
    return { total: Number.isFinite(num) ? num : null, target: s.targetReps, raw: s.performedRaw };
  });
  if (parsed.some((p) => p.raw === "" || p.raw === null || p.raw === undefined || p.total === null)) return null;

  const allHit = parsed.every((p) => p.total >= p.target);
  if (allHit) return "A";

  const allAtLeast80 = parsed.every((p) => p.total >= p.target * 0.8);
  return allAtLeast80 ? "B" : "X";
}
