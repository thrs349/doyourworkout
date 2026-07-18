// service-worker.js
// 오프라인에서도 앱 자체(껍데기)는 항상 열리도록 하는 최소한의 캐시 전략입니다.
// 데이터는 여기서 다루지 않습니다(전부 Local Storage에 있음).

const CACHE_NAME = "doyourworkout-v2.4.8"; // v2.4.8: 개발용 Pending 디버그 태그 제거(debugBodyweightStatus.js
// 삭제)를 새 캐시로 확실히 반영하기 위해 버전을 올립니다. 삭제된 파일은 CORE_ASSETS에서도 제거했습니다.
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
