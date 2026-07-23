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
// v2.7.5: v2.7.4 사용자 테스트 반영 UI 수정 - 루틴 Editor ☰ 핸들 좌우 padding 축소(글리프 크기는 유지),
// 종목 수정 화면 운동명/역할 토글을 다시 한 행으로 병합(행 수 절약, v2.7.4 분리안에서 롤백), Weekly Volume
// Dashboard의 상/하체 밸런스(상체·하체·코어 total+상태)를 헤더 행으로 이동하고 내용 영역은 상체 세부(좌)/
// 하체 세부(우) 2분할 3열 Grid(부위/세트/상태)로 재구성, 구분선 제거. 카드 세로 위치(마지막 루틴 카드와
// 하단 탭 사이 정중앙) 유지 재확인. 데이터 구조·SCHEMA_VERSION·volume.js/state.js/models.js/storage.js·
// judge.js/gain.js 전부 무변경(UI 전용 패치).
// v2.7.5 긴급 패치: exerciseForm.js에 동일 이름 함수(refreshRoleUI)가 중복 선언되어 있어 구버전이 신규
// 버전을 덮어쓰며 존재하지 않는 변수(roleGroup)를 참조 -> 운동 추가/수정 화면 진입 시 ReferenceError로
// 화면이 열리지 않던 버그 수정(구버전 중복 함수 삭제, 다른 파일 무수정).
// v2.7.6: v2.7.5 사용자 테스트 반영 UI 수정 - Weekly Volume Card가 하단 탭에 너무 붙어 보이는 문제의 실제
// 원인(마지막 루틴 카드의 margin-bottom이 위쪽 스페이서 간격에만 추가로 더해져 위/아래가 비대칭이었음)을
// 찾아 그 마지막 카드의 margin-bottom을 제거해 구조적으로 대칭을 맞춤(고정 margin 추가 아님). Weekly
// Volume Card 내용 영역을 좌우 절반 3열 Grid에서, 카드 전체 폭을 쓰는 가로 나열(상체 밸런스 라벨+가로나열,
// 하체 밸런스 라벨+가로나열)로 재구성 - 헤더 구조(상/하체 밸런스 한 줄)는 요청대로 변경 없이 그대로 유지.
// 데이터 구조·SCHEMA_VERSION·volume.js/state.js/models.js/storage.js·judge.js/gain.js 전부 무변경.
// v2.7.7: v2.7.6 사용자 테스트 반영 UI 수정 - (1) #app의 min-height를 100vh(모바일 브라우저 주소창 상태에
// 따라 새로고침 시마다 값이 달라져 Weekly Volume Card 위치가 흔들리던 원인)에서 100dvh로 교체(100vh는
// 구형 브라우저 폴백으로 유지), (2) 운동 수정 화면의 역할 헤더(.role-header-label) text-align을
// right->left로 변경해 역할 토글(.role-toggle-col, 왼쪽 정렬)과 시작점을 맞춤, (3) 편측성/워밍업 토글
// 라벨(.toggle-row span)에 font-size:14px 명시(기존엔 지정이 없어 브라우저 기본값 16px로 저장 버튼(15px)
// 보다 커 보였음), (4) Weekly Volume Card 내용 영역을 가로나열 flex에서 4행x8열 CSS Grid로 재구성 -
// 상태 아이콘이 라벨 길이와 무관하게 항상 같은 열(4/8열)에 정렬됨. 헤더(상/하체 밸런스)는 무변경.
// 데이터 구조·SCHEMA_VERSION·volume.js/state.js/models.js/storage.js·judge.js/gain.js 전부 무변경.
// v2.7.9: v2.7.8 사용자 테스트 반영 - (1) 읽기 전용 큐노트 아이콘 ☑->✅ 통일(수정 화면과 동일), (2) 운동
// 수정 화면 역할 토글 gap 16px->8px 축소(헤더/내용 정렬 유지, 여유 폭은 운동명 입력칸이 흡수), (3)
// service-worker fetch 전략을 리소스별로 분기 - HTML/JS/CSS(document/script/style)는 network-first(온라인
// 시 항상 최신 코드 즉시 반영, 오프라인일 때만 캐시 폴백), 이미지 등 정적 리소스는 기존 cache-first 유지.
// Weekly Volume Dashboard 위치가 "새로고침 후 매번 달라지던" 문제의 원인 중 하나로 추정(직전 배포본이
// 먼저 보이던 캐시 전략)되어 이번에 함께 해결, (4) 태그 역할 배지를 버튼 텍스트에 합치던 방식에서 별도
// absolute 레이어(.tag-role-badge)로 분리 - 라벨(.tag-label) 중앙 정렬이 항상 유지됨, 기호도 ①/②에서
// Ⓟ(주동근)/Ⓢ(보조근)로 변경, (5) Weekly Volume Dashboard 내용 영역을 4행x8열 Grid(부위/세트/비율)에서
// 가로 막대그래프(부위/막대/%)로 재구성 - 세트 열 제거, 막대 길이는 그룹 내 최대 부위 기준 상대비 × 80%
// 상한. 헤더("상/하체 밸런스")와 Grid 제목("상체 자극"/"하체 자극")은 무변경. 계산 로직(주동근×1.0/
// 보조근×0.5, 최종 표시 직전 1회 Math.round)은 v2.7.8과 동일. 데이터 구조·SCHEMA_VERSION·
// volume.js/state.js/models.js/storage.js·judge.js/gain.js 전부 무변경.
export const APP_VERSION = "v2.7.9";
