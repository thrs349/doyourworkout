// appConfig.js
// 앱 표시 이름을 한 곳에서만 관리합니다. 이름을 바꾸려면 이 값만 수정하면 됩니다.
// (내부 화면 표시, PWA manifest name/short_name, index.html 제목에 모두 반영됩니다.)
export const APP_NAME = "Do Your Workout";
export const APP_TAGLINE = "운동 헌장 앱";
// v2.4.1: 사용자에게 보여주는 "릴리즈" 버전입니다. models.js의 SCHEMA_VERSION(저장 데이터 구조 migration 번호)과는
// 완전히 별개이며 서로 참조하지 않습니다 — 이 값은 릴리즈마다 사람이 직접 갱신합니다.
// v2.6.0: Exercise Tag System(운동 종목 태그 시스템) 릴리즈.
// v2.6.1: 실기기 테스트 반영 UI 마감(카드 메타 Chip 표시, 시스템 팝업 디자인 통일, 문구 수정). 데이터 구조/판정·증량 로직 변경 없음.
// v2.6.2: 실기기(Galaxy S25) 테스트 반영 UI 버그 수정 - 카드 메타 Chip 클래스명 충돌 수정, 팝업 메시지를
// title에서 content 영역으로 이동, 루틴 제목 수정 native prompt를 앱 modal로 교체. 데이터 구조/로직 변경 없음.
export const APP_VERSION = "v2.6.2";
