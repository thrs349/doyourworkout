// service-worker.js
// 오프라인에서도 앱 자체(껍데기)는 항상 열리도록 하는 최소한의 캐시 전략입니다.
// 데이터는 여기서 다루지 않습니다(전부 Local Storage에 있음).

const CACHE_NAME = "doyourworkout-v2.4.2"; // v2.4.2: 이번 릴리즈(맨몸 "현행 유지" pending 종료, 버전 표시 수정,
// 미설정 중량 팝업 문구 단순화)를 새 캐시로 확실히 반영하기 위해 버전을 올립니다. CORE_ASSETS는 v2.4.1 시점에
// 이미 실제 js/ 디렉토리 전체와 diff로 대조해 누락 없음을 확인했고, 이번 라운드는 신규 파일 추가가 없어
// 목록 변경은 불필요합니다(기존 파일들의 내용 변경만 있었음 — 캐시 이름 갱신만으로 충분히 무효화됩니다).
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/tokens.css",
  "./css/base.css",
  "./css/components.css",
  "./css/screens.css",
  "./js/app.js",
  "./js/core/appConfig.js",
  "./js/core/models.js",
  "./js/core/storage.js",
  "./js/core/theme.js",
  "./js/core/judge.js",
  "./js/core/gain.js",
  "./js/core/warmup.js",
  "./js/core/stats.js",
  "./js/core/state.js",
  "./js/data/seedExercises.js",
  "./js/ui/dom.js",
  "./js/ui/router.js",
  "./js/ui/exitGuard.js",
  "./js/ui/components/modal.js",
  "./js/ui/components/bottomNav.js",
  "./js/ui/components/toast.js",
  "./js/ui/components/lineChart.js",
  "./js/ui/components/debugBodyweightStatus.js",
  "./js/ui/components/cueNoteEditor.js",
  "./js/ui/components/cueNoteViewer.js",
  "./js/ui/screens/home.js",
  "./js/ui/screens/workout.js",
  "./js/ui/screens/routineList.js",
  "./js/ui/screens/routineEditor.js",
  "./js/ui/screens/exercisePicker.js",
  "./js/ui/screens/exerciseForm.js",
  "./js/ui/screens/exerciseManage.js",
  "./js/ui/screens/machineCandidate.js",
  "./js/ui/screens/notificationCenter.js",
  "./js/ui/screens/settings.js",
  "./js/ui/screens/history.js",
  "./icons/icon.svg?v=3",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});
