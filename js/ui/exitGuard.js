// exitGuard.js
// 브라우저/설치된 PWA에서는 JS로 "앱을 강제 종료"할 방법이 없습니다.
// 대신 홈 화면에서 뒤로가기를 처음 누르면 안내 토스트를 띄우고 실제로는 나가지지 않게 막았다가,
// 짧은 시간(기본 2초) 안에 한 번 더 누르면 그때는 막지 않고 브라우저/OS가 자연스럽게
// 앱을 닫도록(또는 이전 화면으로 나가도록) 둡니다. Android Chrome/PWA 환경에서 가장 자연스럽게 동작합니다.
import { showToast } from "./components/toast.js";
import { currentPath } from "./router.js";

const EXIT_WINDOW_MS = 2000;

let guardArmed = false;
let lastBackAt = 0;

function isHome() {
  return currentPath().replace(/^\//, "") === "home";
}

function armGuard() {
  if (guardArmed) return;
  history.pushState({ __exitGuard: true }, "", location.hash);
  guardArmed = true;
}

export function initExitGuard() {
  window.addEventListener("hashchange", () => {
    guardArmed = false;
    if (isHome()) armGuard();
  });

  window.addEventListener("popstate", (e) => {
    if (!isHome()) return; // 홈이 아니면 평소처럼 라우터가 처리하도록 둠
    const now = Date.now();
    if (now - lastBackAt < EXIT_WINDOW_MS) {
      // 짧은 시간 내 두 번째 뒤로가기 -> 더 막지 않고 통과시킵니다.
      guardArmed = false;
      return;
    }
    lastBackAt = now;
    showToast("뒤로가기를 한 번 더 누르면 앱이 종료됩니다");
    armGuard();
  });

  if (isHome()) armGuard();
}
