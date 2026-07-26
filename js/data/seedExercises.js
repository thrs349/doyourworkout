// seedExercises.js
// 최초 실행 시 한 번만 등록해주는 기본 종목 목록입니다. 사용자는 이후 자유롭게 추가/삭제할 수 있습니다.
// v2.6.0: 운동 태그 시스템 도입에 맞춰 시드 종목에도 primaryBodyPart/secondaryTags를 부여합니다.
// (신규 설치 시 addExercise()로 바로 저장되며 exerciseForm.js의 UI 필수 검증을 거치지 않으므로, 여기서
// 미리 채워두지 않으면 시드 종목만 primaryBodyPart:null 상태로 남게 됩니다.)
// v3.0.2: 스쿼트/데드리프트/레그컬은 시드에서 제거하고(레그프레스만 유지), 치닝디핑을 새로 추가했습니다.
// 치닝디핑은 gainMethod: "machine"으로 기존 머신 증량 로직을 그대로 사용하며(judge.js/gain.js 무변경),
// weightDirection: "desc"만 추가로 지정해 신규 설치 시에도 종목 카드 "최근 최고" 표시가 처음부터 낮은
// 보조 중량 기준(min)으로 계산되도록 합니다. weightDirection은 종목 생성/수정 UI에는 노출되지 않는
// 내부 필드이며, 이 시드 데이터는 기존 사용자에게는 영향을 주지 않습니다(신규 설치 시 exercises가
// 0개일 때만 1회 삽입됨 - app.js bootstrap() 참고).
export const SEED_EXERCISES = [
  { name: "레그프레스", gainMethod: "machine", targetReps: 12, baseSets: 3, warmupEnabled: false, warmupTargetReps: 8, startWeight: 35, primaryBodyPart: "하체", secondaryTags: [] },
  { name: "치닝디핑", gainMethod: "machine", targetReps: 10, baseSets: 3, warmupEnabled: false, warmupTargetReps: 8, startWeight: 20, primaryBodyPart: "상체", secondaryTags: ["가슴", "등"], weightDirection: "desc" },
];
