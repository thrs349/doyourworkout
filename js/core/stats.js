// stats.js
// 기록(History) 화면에서 쓰는 통계 계산만 담당하는 순수 함수 모음입니다.
// 그래프 데이터 기준: 워밍업 제외, 도전세트 제외, "목표 반복수를 달성한 본세트"가 있었던 날짜만 포함합니다.
// (고반복 종목은 "목표"가 하한 반복수이므로 하한 이상이면 달성으로 인정합니다 - judge.js의 threshold 모드와 동일 기준.)

import { isSetAchieved } from "./judge.js";

function mainSetsOf(record) {
  return (record.sets || []).filter((s) => !s.isChallenge && !s.isWarmup);
}

// 편측 세트는 leftRaw/rightRaw 두 값을 쓰므로, 양쪽 다 정확히 목표를 달성했을 때만 "달성"으로 봅니다.
function isSetAchievedAny(s, mode) {
  if (s.leftRaw != null || s.rightRaw != null) {
    return isSetAchieved(s.leftRaw, s.targetReps, "exact") && isSetAchieved(s.rightRaw, s.targetReps, "exact");
  }
  return isSetAchieved(s.performedRaw, s.targetReps, mode);
}

// 최근 N일 이내, 목표 반복수를 달성한 본세트가 있었던 세션만 (date, weight) 포인트로 반환합니다.
// gainMethod가 "high_rep"이면 세트별 targetReps를 "하한"으로 보고 threshold 기준(이상)으로 판단하고,
// 그 외에는 기존처럼 정확히 목표치와 같아야 달성으로 인정합니다. 편측 세트는 좌우 모두 달성해야 인정합니다.
export function getWeightTrend(sessions, exerciseId, days = 90, gainMethod = "machine") {
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  const mode = gainMethod === "high_rep" || gainMethod === "bodyweight" ? "threshold" : "exact";

  const points = [];
  for (const session of sessions) {
    const sessionTime = new Date(session.date).getTime();
    if (Number.isFinite(sessionTime) && sessionTime < cutoff) continue;

    const record = session.records.find((r) => r.exerciseId === exerciseId);
    if (!record) continue;

    const hasAchievedMainSet = mainSetsOf(record).some((s) => isSetAchievedAny(s, mode));
    if (!hasAchievedMainSet) continue; // 도전세트 성공 여부와 무관하게, 본세트 달성 기록만 반영

    points.push({ date: session.date, weight: record.weightUsed, generation: session.generation || 1 });
  }

  return points.sort((a, b) => a.date.localeCompare(b.date));
}

// v2.3.0: Generation별 세션 요약(첫/마지막 운동 날짜)을 계산합니다. 세션 기록만으로 계산 가능한 정보만
// 반환하며(리셋 시각 자체는 저장하지 않는다는 결정에 따름), 아직 세션이 하나도 없는 Generation은 결과에
// 포함되지 않습니다. bodyweight 세션도 포함된 세션 배열이 들어오면 함께 집계되지만, 실제로는 화면에서
// bodyweight를 걸러낸 세션만 넘기든 아니든 결과에 영향이 없습니다(날짜 집계에 gainMethod가 관여하지 않음).
export function getGenerationSummaries(sessions) {
  const byGen = new Map();
  sessions.forEach((session) => {
    const gen = session.generation || 1;
    const existing = byGen.get(gen);
    if (!existing) {
      byGen.set(gen, { generation: gen, firstDate: session.date, lastDate: session.date });
    } else {
      if (session.date < existing.firstDate) existing.firstDate = session.date;
      if (session.date > existing.lastDate) existing.lastDate = session.date;
    }
  });
  return Array.from(byGen.values()).sort((a, b) => a.generation - b.generation);
}

export function getRecentMaxWeight(trendPoints) {
  if (!trendPoints.length) return null;
  return Math.max(...trendPoints.map((p) => p.weight));
}

// 그래프 기간과 무관하게, 해당 종목의 가장 최근 세션 기록(요약)을 반환합니다.
export function getMostRecentRecord(sessions, exerciseId) {
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));
  for (const session of sorted) {
    const record = session.records.find((r) => r.exerciseId === exerciseId);
    if (record) return { date: session.date, record };
  }
  return null;
}
