// seedExercises.js
// 최초 실행 시 한 번만 등록해주는 기본 종목 목록입니다. 사용자는 이후 자유롭게 추가/삭제할 수 있습니다.
// v2.6.0: 운동 태그 시스템 도입에 맞춰 시드 종목에도 primaryBodyPart/secondaryTags를 부여합니다.
// (신규 설치 시 addExercise()로 바로 저장되며 exerciseForm.js의 UI 필수 검증을 거치지 않으므로, 여기서
// 미리 채워두지 않으면 시드 종목만 primaryBodyPart:null 상태로 남게 됩니다.)
export const SEED_EXERCISES = [
  { name: "스쿼트", gainMethod: "freeweight", targetReps: 10, baseSets: 3, warmupEnabled: true, warmupTargetReps: 8, startWeight: 40, primaryBodyPart: "하체", secondaryTags: [] },
  { name: "데드리프트", gainMethod: "freeweight", targetReps: 10, baseSets: 3, warmupEnabled: true, warmupTargetReps: 8, startWeight: 50, primaryBodyPart: "하체", secondaryTags: ["등"] },
  { name: "레그프레스", gainMethod: "machine", targetReps: 12, baseSets: 3, warmupEnabled: false, warmupTargetReps: 8, startWeight: 35, primaryBodyPart: "하체", secondaryTags: [] },
  { name: "레그컬", gainMethod: "machine", targetReps: 12, baseSets: 3, warmupEnabled: false, warmupTargetReps: 8, startWeight: 20, primaryBodyPart: "하체", secondaryTags: [] },
];
