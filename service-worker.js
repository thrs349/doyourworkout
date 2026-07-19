// service-worker.js
// 오프라인에서도 앱 자체(껍데기)는 항상 열리도록 하는 최소한의 캐시 전략입니다.
// 데이터는 여기서 다루지 않습니다(전부 Local Storage에 있음).

const CACHE_NAME = "doyourworkout-v2.6.1"; // v2.6.1: 실기기 테스트 반영 UI 마감 릴리즈. APP_VERSION과 동일한 라벨로
// 캐시를 새로 무효화합니다(activate 핸들러가 이 값과 다른 기존 캐시 키를 전부 삭제하므로, 기존 설치 사용자도
// 다음 방문 시 자동으로 새 캐시로 전환됩니다). 캐시 전략 로직 자체는 무변경.
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
