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
// v2.6.3: 실기기 테스트 반영 - Chip 디자인(폰트/배경/간격) 재조정, 하체 보조 태그(대퇴사두/둔근/햄스트링)
// 추가, 팝업 제목 영역 제거(내용 중심). secondaryTags는 기존과 동일한 문자열 배열이라 데이터 구조 변경 없음.
// v2.6.4: 운동 기록 탭 제목이 루틴 이름을 반영하지 않던 버그 수정(표시 전용, 과거 기록 데이터 무관), 알림/
// 루틴 이름 팝업 폰트 크기 조정, 카드 Chip 간격 추가 축소. 데이터 구조/판정·증량 로직 변경 없음.
// v2.6.5: 실기기 테스트 반영 - 운동 기록 탭 헤더를 "요일+루틴명" 형식으로 수정, 운동 카드 1행(이름/버튼)
// Y축 정렬 수정, 종목 폼의 "보조 태그" 라벨 텍스트 제거. 표시/레이아웃 전용 수정으로 데이터 구조 무변경.
// v2.6.6: 실기기 테스트 반영 - 팝업 내용 텍스트 크기 조정(줄바꿈 방지), 홈 화면 날짜 월/일 앞자리 0 제거,
// 운동 기록 탭 헤더를 "M.D(요일) · 루틴명" 형식으로 변경, 종목 폼/검색 화면 spacing 축소. 표시/레이아웃
// 전용 수정으로 데이터 구조·판정/증량 로직 변경 없음.
// v2.6 정식 릴리즈: v2.6.0~v2.6.6까지의 누적 개발/실기기 테스트 반영분(Exercise Tag System 및 UI 마감)을
// 하나의 정식 릴리즈로 묶어 "v2.6" 라벨로 배포합니다. 기능/데이터 구조 변경은 없으며 버전 표기만 정리합니다.
// v2.7.0: Exercise Role System(종목 자체의 메인/보조 역할 저장) + Weekly Routine Volume Card(설정된 루틴 기준
// 예상 주간 볼륨 표시) 추가. SCHEMA_VERSION 15->16(role 필드). judge.js/gain.js(판정/증량/상태전이)는 무변경.
// v2.7.1: v2.7.0 사용자 테스트 반영 UI 패치 - 역할 토글을 기존 활성/비활성 switch 스타일로 교체, 루틴
// Editor 역할 아이콘 Highlight Box 제거 및 간격 축소, 비활성 종목 "(비활성)" 텍스트 제거(opacity만 사용),
// 요일 카드 좌측 정렬 버그 수정(button 기본 text-align:center 상속 문제), 메타 텍스트 형식 수정 및 Secondary
// Tag Highlight Box 재활용, Weekly Volume Card 헤더/간격 재배열, 기록 탭 헤더 날짜·요일 간격 조정. 데이터
// 구조·SCHEMA_VERSION·volume.js 계산 로직·judge.js/gain.js 전부 무변경(UI 전용 패치).
// v2.7.2: v2.7.1 사용자 테스트 반영 UI 패치 - 종목 수정 화면 운동명/역할 토글을 한 행으로 재배치(코어는 역할
// 부분만 숨김), 루틴 Editor 순서-역할-종목명 간격 균일화, 요일 카드 3행->2행(운동명+Highlight Box 같은 줄),
// Highlight Box를 Primary 기준 최대 3개 그룹으로 재구성(volume.js는 무수정, state.js에서 후처리만 추가),
// Weekly Volume Card 헤더 문구 변경("균형"->"밸런스") 및 폰트를 Space Mono로 앱 전체에 통일, 헤더/내용 폰트
// 크기·볼드 조정, 하체 세부 항목 y축 정렬을 상체 기준에 맞춤. 데이터 구조·SCHEMA_VERSION·volume.js 계산
// 로직·judge.js/gain.js 전부 무변경(UI 전용 패치).
// v2.7.3: 폰트 최종 확정(A안 혼용) - Space Mono 전체 통일을 폐기하고, 사람이 읽는 텍스트(운동명/설명)는
// Noto Sans KR, 숫자/데이터 표시는 Noto Sans Mono(한글 폴백 Noto Sans KR)로 분리. font-variant-numeric:
// tabular-nums를 전역 적용해 숫자 자리맞춤 확보. v2.7.2의 다른 UI 수정(운동 수정 화면 같은 행 구조, 루틴
// Editor ☰ 제거, 요일 카드 2행 구조, Weekly Volume Card 배열/여백)은 전부 그대로 유지. 데이터 구조·
// SCHEMA_VERSION·volume.js 계산 로직·judge.js/gain.js 전부 무변경(폰트 전용 패치).
export const APP_VERSION = "v2.7.3";
