// appConfig.js
// 앱 표시 이름을 한 곳에서만 관리합니다. 이름을 바꾸려면 이 값만 수정하면 됩니다.
// (내부 화면 표시, PWA manifest name/short_name, index.html 제목에 모두 반영됩니다.)
export const APP_NAME = "NextLift";
export const APP_TAGLINE = "Train. Judge. Progress.";
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
// 보조근×0.5, 최종 표시 직전 1회 Math.round)은 v2.7.8과 동일. 이어서 v2.7.9 사용자 테스트 반영 추가
// 수정 - (a) 역할 토글 컬럼 폭 64px->56px 축소(우측으로 살짝 이동, 여유 폭은 운동명 입력칸이 흡수),
// (b) 태그 역할 배지(Ⓟ/Ⓢ) 좌측 여백 4px->8px 확대, (c) [버그 수정] Dashboard 상/하체 자극 그래프의 라벨
// 열 폭이 고정 40px로 두 섹션에 공유되어 사실상 같은 x축 기준으로 보이던 문제 - 섹션별 독립 CSS Grid
// (.volume-bar-grid)로 전환해 각 섹션이 자기 라벨 기준으로 독립적으로 정렬되도록 수정, (d) [버그 수정]
// 이전 CSS 리팩터링 때 실수로 누락됐던 "마지막 요일 카드 margin-bottom 제거" 규칙을 복원 - 이게 빠져 있어
// Dashboard 카드 위쪽 간격(20px)이 아래쪽(12px)보다 커 보이던 비대칭을 해결. "루틴 추가 시 그래프 미갱신"
// 제보는 코드 재검토+가짜 DOM 시뮬레이션으로 재현되지 않음(계산/렌더링 로직 자체는 정상 확인) - 캐시
// 생애주기 관련 가능성 있음, 상세 내용은 보고 참고. 데이터 구조·SCHEMA_VERSION·
// volume.js/state.js/models.js/storage.js·judge.js/gain.js 전부 무변경.
// v2.7.12: (a) 역할 토글 컬럼 폭 64px->56px로 축소(우측으로 살짝 이동, 여유 폭은 운동명 입력칸이 흡수),
// (b) 태그 역할 배지(Ⓟ/Ⓢ) 좌측 여백 조정, (c) [버그 수정] Weekly Volume Dashboard 상/하체 자극 그래프의
// 라벨 열 폭이 고정 40px로 두 섹션에 공유되어 사실상 같은 x축 기준으로 보이던 문제 - 섹션별 독립 CSS Grid
// (.volume-bar-grid)로 전환, (d) [버그 수정] "마지막 요일 카드 margin-bottom 제거" 규칙 누락 복원 -
// Dashboard 카드 위/아래 여백 비대칭 해결, (e) 역할 토글 좌우 대칭 여백(입력창-토글 = 토글-화면끝, 둘 다
// 16px), (f) Dashboard 상/하체 좌우 2열 배치(세로 스택 폐기)로 전환, 47:53 비율 분배, 행 높이 소폭 확대,
// (g) [구조 개선] 태그 역할 배지를 button 기준 absolute 좌표 미세조정 방식에서, 배지+라벨을 tag-inner
// (inline-flex) 하나의 그룹으로 묶어 "텍스트 기준"으로 함께 중앙 정렬하는 방식으로 전환 - 라벨 길이(가슴~
// 대퇴사두)와 무관하게 배지-텍스트 간격이 항상 동일해짐. "루틴 추가 시 그래프 미갱신" 제보는 코드
// 재검토+가짜 DOM 시뮬레이션으로 재현되지 않음(계산/렌더링 로직 자체는 정상 확인, 이후 실기기 재현 결과
// "보조 태그 미설정 종목은 분포 그래프에 기여하지 않는" 의도된 동작으로 확인되어 현상 유지 확정).
// 데이터 구조·SCHEMA_VERSION·volume.js/state.js/models.js/storage.js·judge.js/gain.js 전부 무변경.
// v2.7.13: (검토 후 반영) (a) 운동 수정 화면의 "메인/보조" 헤더를 하나의 텍스트 문자열에서 [메인(flex:1,
// 우측정렬)] [/(고정폭)] [보조(flex:1,좌측정렬)] 3분할 구조로 변경 - "메인"/"보조"에 동일한 flex 폭을 줘서
// "/"가 그 그룹의 정중앙에 폰트 렌더링과 무관하게 구조적으로 위치하고, 이 그룹을 스위치(42px)와 동일한
// 폭·정렬 규칙(56px 컬럼 안에서 우측 정렬)으로 배치해 "/" 위치와 스위치 중심이 항상 일치하도록 함,
// (b) Weekly Volume Dashboard 막대그래프의 행 사이 간격만 4px->2px로 축소(제목→첫 행 간격은
// .volume-grid-title의 별도 margin-bottom이라 그대로 유지, 막대 계산/%/라벨 정렬은 무변경).
// 데이터 구조·SCHEMA_VERSION·volume.js/state.js/models.js/storage.js·judge.js/gain.js 전부 무변경.
// v2.7.13-patch: 위 (a) 역할 토글 헤더 3분할 구조를 실기기 테스트 결과에 따라 v2.7.12 방식(단일 텍스트
// "메인/보조", text-align:right)으로 롤백. (b) Dashboard 막대그래프 개선 사항(47:53 분배, 좌우 2열,
// 행 간격 2px 등)은 그대로 유지. 토글 클릭 동작·role 데이터 처리·운동명 입력칸 width 구조는 무변경.
// 데이터 구조·SCHEMA_VERSION·volume.js/state.js/models.js/storage.js·judge.js/gain.js 전부 무변경.
// v2.7 정식 릴리즈: v2.7.0~v2.7.13-patch까지의 누적 개발/실기기 테스트 반영분(Exercise Role System,
// Weekly Volume Dashboard 목적 변경 및 막대그래프, 태그 주동근/보조근 배지, UI 정렬·캐싱 전략 개선 등)을
// 하나의 정식 릴리즈로 묶어 "v2.7" 라벨로 배포합니다. v2.6 -> "v2.6" 라벨 통합 때와 동일한 방식이며,
// 기능/데이터 구조 변경은 없고 버전 표기만 정리합니다(코드 로직 무변경, 위 상세 이력은 그대로 보존).
// v2.8.1: v2.8.0 사용자 테스트 반영(FAB 디자인 통일, 버전 표기, 맨몸 그래프 단위 괄호 표기) - 기능/데이터
// 구조 변경 없이 버전 라벨만 갱신합니다(코드 로직 무변경).
// v3.0.0: UI 업데이트 + 설치형 PWA에서 Settings 등 일부 화면 진입 후 "←"로 화면 이동이 안 되던 버그를
// 안정화 작업으로 함께 수정했습니다(router.js safeBack() 추가, exitGuard.js 중복 history 항목 방지,
// service-worker 캐시 버전 정리). 운동 판정/증량/볼륨 계산 로직, JSON 백업/복원 구조, migration,
// SCHEMA_VERSION은 전부 무변경입니다.
// v3.0.1: 설치형 PWA를 Settings 등 홈이 아닌 화면에서 설치/재실행했을 때 앱이 그 화면으로 바로
// 시작되고, 이로 인해 종료 방지 가드가 걸리지 않아 시스템 뒤로가기로 앱이 바로 종료되던 문제를
// 안정화 패치로 수정했습니다(router.js에 콜드 스타트 시 hash 검증 후 Home 보정 로직 추가). 같은
// 이유로 app.js의 init 순서를 한 번 더 조정했습니다(자세한 내용은 각 파일 주석 참고). 기능 추가/UI
// 변경 없음. 운동 판정/증량/볼륨 계산 로직, JSON 백업/복원 구조, migration, SCHEMA_VERSION 전부 무변경.
// v3.0.2: 종목 정의에 weightDirection(표시 전용) 필드를 추가했습니다. 치닝디핑처럼 "낮은 보조 중량이
// 더 좋은 기록"인 종목의 카드 "최근 최고" 표시가 지금까지는 항상 max 기준이라 실제와 반대로 보이던
// 문제를 수정합니다. 종목 카드 통계 계산(stats.js)에서만 사용되며, judge.js/gain.js/volume.js 및
// 실제 증량 판단·기록 저장 구조는 전혀 건드리지 않았습니다. SCHEMA_VERSION 17 -> 18로 증가.
// v3.0.3: Weekly Volume Dashboard "상체 자극" 계산을 개선했습니다. (1) 주동근/보조근 가중치(1.0/0.65)를
// "비율로 세트 분배"하는 방식으로 바꿔, 태그 2개 이상인 운동의 총 기여도가 원래 세트수보다 커지던 문제를
// 없앴습니다. (2) 가슴/등/어깨는 서로 같은 분모(100%)를 공유하고, 팔만 "상체 전체 대비 %"라는 별도
// 지표로 분리했습니다. 하체는 계산 방식(1)만 동일하게 적용되고 분모 구조(2)는 기존과 동일합니다.
// volume.js/judge.js/gain.js/state.js, secondaryTags 저장 구조, SCHEMA_VERSION 전부 무변경.
// v3.0.4: v3.0.3 UI 후속 수정 - 팔 막대의 별도 강조색(color-mix)을 되돌리고, 대신 가슴/등/어깨와 팔
// 사이에 얇은 구분선(--color-border)을 추가해 분모가 다른 지표임을 표시했습니다. 또한 알람센터/도전세트
// 후보 FAB의 내부 배경을 흰색(--color-surface) 고정값에서 메인 홈 화면과 같은 테마별 배경색
// (--color-bg)으로 바꿔, 흰 배경 때문에 별도 요소처럼 보이던 문제를 해결했습니다(테두리 강조색·아이콘·
// 크기·그림자는 무변경). 이번 릴리즈는 CSS/UI 표시 변경만 포함하며, 계산 로직·데이터 구조·
// localStorage/JSON 백업 호환성·SCHEMA_VERSION은 전부 무변경입니다.
// v3.0.5: v3.0.4의 상체 자극 구분선 구현 방식을 수정했습니다. 구분선이 grid의 독립된 행을 차지해
// row-gap이 중복 적용되면서 어깨-팔 간격만 넓어지던 문제(v3.0.4)를, 구분선을 position:absolute 오버레이
// 로 바꿔 해결했습니다 - grid 행 배치·row-gap·카드 높이에 전혀 관여하지 않으므로 가슴/등/어깨/팔 행간이
// 모두 동일하게 유지됩니다. FAB 배경색(--color-bg) 변경은 v3.0.4 그대로 유지됩니다. calcTagRowsForBodyPart
// 계산 로직, volume.js/gain.js/judge.js/state.js/storage.js/models.js, SCHEMA_VERSION, weightDirection
// 관련 로직 전부 무변경 - 순수 UI 표시 릴리즈입니다.
// v3.0.6: v3.0.5의 구분선이 실제로는 화면에 보이지 않던 버그를 수정했습니다. position:absolute + 
// grid-column:1/-1만으로는 containing block의 가로 "범위"만 정해질 뿐 left/right가 없으면 요소가
// shrink-to-fit(내용물 없음 = 0px 너비)으로 축소되어 사실상 렌더링되지 않았습니다. .volume-bar-divider에
// left:0; right:0;을 추가해 실제로 라벨 시작 x축 ~ 상체 섹션 끝까지 채워지도록 했습니다. CSS 속성 2줄
// 추가 외 다른 변경은 없으며, JS(routineList.js)·계산 로직·데이터 구조·SCHEMA_VERSION 전부 무변경입니다.
// v3.1.1: 기능 개선 - FAB scale 모션 삭제, 도전세트 후보 FAB 이모지 롤백(🔥→🏆), 종목 정렬 UX 변경
// (exerciseManage/exercisePicker 기본 가나다순 + 운동유형/운동부위 버튼 선택 시에만 그룹 정렬로 전환),
// 하단 네비 '기록' 아이콘 변경(▤→↗) 및 서브텍스트("지난 운동") 제거를 반영합니다. 계산 로직·데이터 구조·
// localStorage/JSON 백업 호환성·SCHEMA_VERSION은 전부 무변경입니다.
// v3.1.3: 기능 패치 - Splash Screen 위치/크기 최종 확정(41vw/308px/gap 19px/15px/padding-top 7.0vh,
// 더 이상 실험 버전 아님), 요일별 루틴 복사 기능 추가(routineEditor.js 상단 📋 버튼 → 요일 선택 모달 →
// 기존 운동 있으면 덮어쓰기 확인 → 기본 버전 items만 복사, title은 대상 요일 값 유지). 계산 로직·
// 데이터 구조·localStorage 키·SCHEMA_VERSION은 전부 무변경입니다.
export const APP_VERSION = "v3.1.3";
