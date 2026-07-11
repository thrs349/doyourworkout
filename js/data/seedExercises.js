// seedExercises.js
// 최초 실행 시 한 번만 등록해주는 기본 종목 목록입니다. 사용자는 이후 자유롭게 추가/삭제할 수 있습니다.
export const SEED_EXERCISES = [
  { name: "스쿼트", gainMethod: "freeweight", targetReps: 10, baseSets: 3, warmupEnabled: true, warmupTargetReps: 8, startWeight: 40 },
  { name: "데드리프트", gainMethod: "freeweight", targetReps: 10, baseSets: 3, warmupEnabled: true, warmupTargetReps: 8, startWeight: 50 },
  { name: "레그프레스", gainMethod: "machine", targetReps: 12, baseSets: 3, warmupEnabled: false, warmupTargetReps: 8, startWeight: 35 },
  { name: "레그컬", gainMethod: "machine", targetReps: 12, baseSets: 3, warmupEnabled: false, warmupTargetReps: 8, startWeight: 20 },
];
