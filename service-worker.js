// service-worker.js
// 오프라인에서도 앱 자체(껍데기)는 항상 열리도록 하는 최소한의 캐시 전략입니다.
// 데이터는 여기서 다루지 않습니다(전부 Local Storage에 있음).

const CACHE_NAME = "doyourworkout-v2.4.1"; // v2.4.1: 캐시 이름이 v2.3.3에서 갱신되지 않아, activate 단계의 구버전 캐시
// 삭제 로직(아래 참고)이 실질적으로 한 번도 발동하지 않고 있었습니다. cache-first(return cached || network) fetch
// 전략과 맞물려, 배포된 새 JS가 반영되기까지 한 박자 늦게 보이는 현상의 원인이었습니다. fetch 전략 자체는 이번
// 범위에서 변경하지 않습니다(필요성 재검토는 별도 작업으로 분리).
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
