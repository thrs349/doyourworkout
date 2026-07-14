// appConfig.js
// 앱 표시 이름을 한 곳에서만 관리합니다. 이름을 바꾸려면 이 값만 수정하면 됩니다.
// (내부 화면 표시, PWA manifest name/short_name, index.html 제목에 모두 반영됩니다.)
export const APP_NAME = "Do Your Workout";
export const APP_TAGLINE = "운동 헌장 앱";
// v2.4.1: 사용자에게 보여주는 "릴리즈" 버전입니다. models.js의 SCHEMA_VERSION(저장 데이터 구조 migration 번호)과는
// 완전히 별개이며 서로 참조하지 않습니다 — 이 값은 릴리즈마다 사람이 직접 갱신합니다.
export const APP_VERSION = "v2.4.3";
