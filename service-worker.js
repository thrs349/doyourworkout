// service-worker.js
// 오프라인에서도 앱 자체(껍데기)는 항상 열리도록 하는 최소한의 캐시 전략입니다.
// 데이터는 여기서 다루지 않습니다(전부 Local Storage에 있음).

const CACHE_NAME = "doyourworkout-v2.7.10"; // v2.7.10: 역할 토글/태그 배지 여백 조정 + Dashboard 그래프 정렬·여백 버그 수정.
// APP_VERSION과 동일한 라벨로 캐시를 무효화합니다(activate 핸들러가 다른 캐시 키를 전부 삭제).
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
  "./js/core/volume.js",
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

  // v2.7.9: HTML/JS/CSS(destination이 document/script/style)는 network-first로 전환합니다.
  // 기존 cache-first는 "새로고침해도 직전 배포본이 먼저 보이고, 최신 코드는 그 다음 로드에야 반영되는"
  // 문제가 있었습니다(Weekly Volume Dashboard 위치가 매번 달라 보이던 원인 중 하나로 확인됨). 온라인
  // 상태라면 항상 네트워크에서 최신 파일을 받아오고, 그 응답을 즉시 화면에 반영하는 동시에
  // response.clone()으로 캐시도 갱신해 오프라인 대비는 그대로 유지합니다. 이미지/manifest 등 자주 안
  // 바뀌는 정적 리소스는 아래 기존 cache-first 경로를 그대로 씁니다(요청 범위를 앱 코드로만 한정).
  const isAppCode = ["document", "script", "style"].includes(event.request.destination);
  if (isAppCode) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone(); // 응답 바디는 한 번만 읽을 수 있어, 캐시에 넣기 전 반드시 clone
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request)) // 오프라인(네트워크 실패) 시에만 캐시로 폴백
    );
    return;
  }

  // 그 외 정적 리소스(이미지 등): 기존 cache-first 유지.
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
