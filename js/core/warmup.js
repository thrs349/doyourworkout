// warmup.js
// 과거 "본세트" 중량 기록만을 근거로 워밍업 중량을 계산합니다. 도전세트 중량은 절대 포함하지 않습니다.
//
// 규칙: 세션들을 시간순으로 나열해 "처음 등장한 순서"로 중복 제거한 진행 단계 목록을 만들고,
// 그 목록에서 현재 본세트 중량 바로 앞 단계를 워밍업 중량으로 사용합니다.
// (가장 최근에 달랐던 값이 아니라, "그 중량에 처음 도달하기 직전 단계"를 의미합니다.)
//
// 직전 단계가 없으면(첫 세션이거나 현재 중량이 기록상 가장 낮은 단계) null을 반환하고,
// 화면에서는 빈 칸으로 두어 사용자가 직접 입력하도록 합니다.

export function computeWarmupWeight(sessions, exerciseId, currentWeight) {
  const sorted = [...sessions].sort((a, b) => {
    const ta = `${a.date}T${a.startTime || "00:00"}`;
    const tb = `${b.date}T${b.startTime || "00:00"}`;
    return ta.localeCompare(tb);
  });

  const history = [];
  for (const session of sorted) {
    const record = session.records.find((r) => r.exerciseId === exerciseId);
    if (record && typeof record.weightUsed === "number") {
      history.push(record.weightUsed); // challengeWeight는 절대 포함하지 않음
    }
  }

  const tiers = [];
  const seen = new Set();
  for (const w of history) {
    if (!seen.has(w)) {
      seen.add(w);
      tiers.push(w);
    }
  }

  const idx = tiers.indexOf(currentWeight);
  if (idx > 0) return tiers[idx - 1];
  if (idx === -1 && tiers.length > 0) return tiers[tiers.length - 1]; // 오늘 처음 도달한 새 중량인 경우
  return null; // 직전 단계 없음 -> 빈 칸
}
