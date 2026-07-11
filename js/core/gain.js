// gain.js
// 증량 후보 판단 로직만 담당하는 순수 함수 모음입니다. (증량 "방식"별 분기 지점)
//
// 중요: A/B/X 누적 횟수는 어디에도 저장하지 않습니다.
// "지금 이 중량(또는 이 단계)에서 증량 조건에 얼마나 가까운가"를 나타내는
// 상태값(gainConditionState: none/one_a/condition_met)만 저장하고,
// 이 상태값의 전이만으로 A-A 연속 조건을 판단합니다.
//
// 규칙 요약(헌장 기준):
// - 머신: 같은 중량에서 A 2회 연속 달성 -> 증량 후보(condition_met). 이후 A가 더 나와도 상태는 condition_met로 유지(후보 유지).
//   B/X 발생 시 상태를 none으로 되돌리고 후보 해제.
// - 프리웨이트: 1단계(10x3, A-A) -> 2단계(10x4, A-A) -> 3단계(도전 준비, 도달 자체가 증량 후보).
//   B/X 발생 시 단계는 유지하고 상태값만 none으로 초기화(단계 역행 없음).
// - 맨몸: 이번 단계에서는 판정/증량 로직을 구현하지 않으므로 상태를 건드리지 않습니다.
// - 편측(isUnilateral) 종목: gainMethod와 무관하게 이 함수 자체는 호출되지 않도록 state.js에서 상위 분기로 걸러냅니다.
//   * high_rep/bodyweight: 이 함수는 원래(편측 여부와 무관하게) no-op이므로 결과상 차이가 없습니다.
//   * machine/freeweight: v1.8 기준 "편측 machine/freeweight의 증량 후보·도전세트 지원은 현재 범위에서 제외"라는
//     기획 결정에 따라, 편측이면 증량 후보(A-A)·도전세트 로직을 의도적으로 타지 않습니다. 이 gainMethod들에
//     한해서만 "편측=증량 미지원"이 실제로 의미를 가지는 제외 규칙이며, 나머지 두 방식은 원래도 해당사항이 없습니다.
//   (판정 자체는 judge.js의 computeUnilateralJudgement/computeUnilateralTimeJudgement로 gainMethod별 기준에 맞게
//   계산하지만, 그 결과로 이 applyJudgement를 호출하지 않도록 state.js에서 상위 분기로 걸러냅니다.)
// - 도전 결과(성공/재도전)는 A/B/X 판정 및 상태값에 영향을 주지 않습니다.
//   증량 성공 후 사용자가 직접 중량을 올리면, 그 시점에 resetAfterWeightIncrease()로 상태값/단계를 초기화합니다.
//
// v1.2: 프리웨이트 전용 자동 우선순위(스쿼트>데드리프트)는 제거했습니다.
// 도전 후보 선정은 머신/프리웨이트 모두 "운동 종료 후 후보 목록에서 사용자가 선택"하는 동일한 방식입니다.

export function applyJudgement(gainMethod, exerciseState, judgement) {
  if (judgement !== "A" && judgement !== "B" && judgement !== "X") return exerciseState;

  if (gainMethod === "high_rep" || gainMethod === "bodyweight") {
    return exerciseState; // 이 방식들은 이 상태 머신을 쓰지 않음 (state.js에서 별도 처리하거나 미구현)
  }

  if (gainMethod === "machine") {
    if (judgement === "A") {
      const next = exerciseState.gainConditionState === "none" ? "one_a" : "condition_met";
      // 도전세트 성공으로 보류 중인 증량 예정 중량(machinePendingIncreaseWeight)이 있는 상태에서
      // 원래 중량 기준으로 다시 A-A를 달성하면, 그 시점에 실제로 currentWeight를 올리고 보류 상태를 비웁니다.
      // (v1.8: 머신 "성공 즉시 증량이 아닌, 재도전 없이 재누적 후 지연 증량" 규칙 반영)
      if (next === "condition_met" && exerciseState.machinePendingIncreaseWeight != null) {
        return {
          ...exerciseState,
          currentWeight: exerciseState.machinePendingIncreaseWeight,
          machinePendingIncreaseWeight: null,
          gainConditionState: "none",
          isGainCandidate: false,
        };
      }
      return { ...exerciseState, gainConditionState: next, isGainCandidate: next === "condition_met" };
    }
    return { ...exerciseState, gainConditionState: "none", isGainCandidate: false };
  }

  // freeweight
  const stage = exerciseState.freeweightStage || "stage1_3set";

  if (judgement === "A") {
    if (stage === "stage3_challenge_ready") {
      return { ...exerciseState, freeweightStage: stage, gainConditionState: "condition_met", isGainCandidate: true };
    }
    if (exerciseState.gainConditionState === "none") {
      return { ...exerciseState, freeweightStage: stage, gainConditionState: "one_a", isGainCandidate: false };
    }
    const nextStage = stage === "stage1_3set" ? "stage2_4set" : "stage3_challenge_ready";
    const reachedChallenge = nextStage === "stage3_challenge_ready";
    return {
      ...exerciseState,
      freeweightStage: nextStage,
      gainConditionState: reachedChallenge ? "condition_met" : "none",
      isGainCandidate: reachedChallenge,
    };
  }

  return { ...exerciseState, freeweightStage: stage, gainConditionState: "none", isGainCandidate: false };
}

// 머신(machine) 전용: 도전세트 "성공" 시 호출합니다.
// 헌장 규칙: 성공해도 즉시 증량하지 않습니다. 대신
//  1) 성공한 도전 중량을 machinePendingIncreaseWeight에 보류 상태로 저장하고,
//  2) 후보 상태(isGainCandidate/gainConditionState)를 반드시 초기화해 원래 중량 기준 A-A 재누적을 처음부터 다시 시작하고,
//  3) 실패 재도전용으로 기억해뒀을 수 있는 machineChallengeWeight는 더 이상 의미가 없으므로 null로 비웁니다.
// (그날 본세트 판정 결과가 무엇이었든 상관없이, 도전 성공 자체가 후보 상태를 확정적으로 리셋합니다.)
// freeweight/high_rep/bodyweight에서는 호출되지 않습니다(state.js에서 machine에만 호출).
export function applyMachineChallengeSuccess(exerciseState, challengeWeight) {
  return {
    ...exerciseState,
    machinePendingIncreaseWeight: challengeWeight,
    machineChallengeWeight: null,
    gainConditionState: "none",
    isGainCandidate: false,
  };
}

// 머신(machine) 전용: 도전세트 "재도전(실패)" 시 호출합니다.
// 헌장 규칙: 실패해도 현재 중량/A-A 누적 상태를 임의로 초기화하지 않으므로, 그날 본세트 판정에 따른
// 상태 변화(applyJudgement 결과)는 그대로 둡니다. 대신 다음 재도전에서 같은 중량을 다시 입력하지 않아도
// 되도록 실패한 도전 중량을 machineChallengeWeight에 기억해둡니다.
// machinePendingIncreaseWeight(성공 후 증량 대기)는 실패와 무관하므로 절대 건드리지 않습니다.
export function applyMachineChallengeFailure(exerciseState, challengeWeight) {
  return {
    ...exerciseState,
    machineChallengeWeight: challengeWeight != null ? challengeWeight : exerciseState.machineChallengeWeight,
  };
}

// 프리웨이트(freeweight) 전용: 도전세트 "성공" 시 호출합니다.
// 헌장 규칙: 프리웨이트는 머신과 달리 "즉시" 증량합니다(보류 없음).
//  1) 입력한 도전 중량을 그대로 currentWeight로 승격하고,
//  2) progression을 stage1_3set/none/후보아님으로 되돌려 새 중량 기준 10x3 A-A부터 재시작하고,
//  3) 실패 재도전용으로 기억해뒀을 수 있는 freeweightChallengeWeight는 더 이상 의미가 없으므로 null로 비웁니다.
// machinePendingIncreaseWeight 같은 "보류" 개념은 사용하지 않습니다(프리웨이트엔 그런 필드 자체가 없음).
// machine/high_rep/bodyweight에서는 호출되지 않습니다(state.js에서 freeweight에만 호출).
export function applyFreeweightChallengeSuccess(exerciseState, challengeWeight) {
  return {
    ...exerciseState,
    currentWeight: challengeWeight,
    freeweightStage: "stage1_3set",
    gainConditionState: "none",
    isGainCandidate: false,
    freeweightChallengeWeight: null,
  };
}

// 프리웨이트(freeweight) 전용: 도전세트 "재도전(실패)" 시 호출합니다.
// 헌장 규칙: 실패해도 현재 중량/10x3·10x4 progression 상태를 임의로 초기화하지 않으므로, 그날 본세트 판정에 따른
// 상태 변화(applyJudgement 결과)는 그대로 둡니다. 대신 다음 재도전에서 같은 중량을 다시 입력하지 않아도
// 되도록 실패한 도전 중량을 freeweightChallengeWeight에 기억해둡니다. machineChallengeWeight와는 무관합니다.
export function applyFreeweightChallengeFailure(exerciseState, challengeWeight) {
  return {
    ...exerciseState,
    freeweightChallengeWeight: challengeWeight != null ? challengeWeight : exerciseState.freeweightChallengeWeight,
  };
}

// 증량(중량 변경)이 실제로 적용된 뒤 호출: 상태값/단계를 처음부터 다시 쌓도록 초기화합니다.
export function resetAfterWeightIncrease(gainMethod, exerciseState) {
  if (gainMethod === "freeweight") {
    // 종목 수정 화면 등에서 중량을 수동으로 바꾼 경우, 기억해둔 재도전 중량도 더 이상 의미가 없으므로 함께 비웁니다.
    return {
      ...exerciseState,
      freeweightStage: "stage1_3set",
      gainConditionState: "none",
      isGainCandidate: false,
      freeweightChallengeWeight: null,
    };
  }
  if (gainMethod === "machine") {
    // 종목 수정 화면 등에서 중량을 수동으로 바꾼 경우, 보류 중이던 도전 성공 중량과 기억해둔 재도전 중량 모두
    // 더 이상 의미가 없으므로 함께 비웁니다.
    return {
      ...exerciseState,
      gainConditionState: "none",
      isGainCandidate: false,
      machinePendingIncreaseWeight: null,
      machineChallengeWeight: null,
    };
  }
  return { ...exerciseState, gainConditionState: "none", isGainCandidate: false };
}

// 도전 후보 목록(머신 + 프리웨이트 공통, 고반복/맨몸/편측 종목 제외). 자동 우선순위 없이 등록된 순서 그대로 반환하고,
// 최종 선택은 화면에서 사용자가 직접 합니다.
// v1.8: 편측(isUnilateral) 제외는 "편측 machine/freeweight의 증량 후보·도전세트 지원을 현재 범위에서 제외"한다는
// 기획 결정에 따른 것입니다(향후 범위 확장 시 이 필터와 state.js/buildWorkoutPlan의 isChallengeToday 조건을 함께 재검토 필요).
export function listChallengeCandidates(exercises, exerciseStates) {
  return exercises.filter(
    (ex) =>
      (ex.gainMethod === "machine" || ex.gainMethod === "freeweight") &&
      !ex.isUnilateral &&
      exerciseStates[ex.id]?.isGainCandidate
  );
}

// 화면 표시용 라벨. 실제 누적 횟수를 저장하지 않으므로, 상태값 기준의 최소 표현만 제공합니다.
// (후보 상태면 "A-A", 한 번만 달성했으면 "A", 그 외에는 "-")
export function formatStreakLabel(exerciseState) {
  if (exerciseState.isGainCandidate) return "A-A";
  if (exerciseState.gainConditionState === "one_a") return "A";
  return "-";
}
