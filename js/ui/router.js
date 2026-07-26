// router.js
// 화면 전환만 담당하는 아주 단순한 해시 라우터입니다. (#/home, #/workout/mon, #/routine/mon ...)
//
// v1.1: 뒤로가기 UX 개선을 위해 navigate()에 { replace: true } 옵션을 추가했습니다.
// - 기본(push): location.hash를 바꿔 새 history 항목을 쌓습니다. "드릴다운" 이동(목록 -> 상세)에 적합합니다.
// - replace: history.replaceState로 현재 항목을 덮어써 쌓이지 않게 합니다. 하단 탭 전환처럼
//   "같은 레벨"을 오가는 이동이나, 뒤로가기로 되돌아가면 안 되는 화면(운동 종료 후 결과 -> 홈)에 씁니다.
// 화면 내 "←" 버튼은 대부분 history.back()을 호출해, 쌓인 만큼만 자연스럽게 되돌아가도록 구현했습니다.
//
// v3.0.0: 설치형 PWA에서 백그라운드 이후 재개되면 브라우저가 history stack을 비워버리는 경우가
// 간헐적으로 있어, history.back()을 호출해도 되돌아갈 곳이 없어 화면이 멈추는 문제가 있었습니다.
// safeBack()을 추가해 "되돌아갈 기록이 있으면 back(), 없으면 기본 화면으로 이동"하도록 보강합니다.
// 기존 history.back() 자체의 동작(쌓인 만큼 자연스럽게 되돌아감)은 그대로 유지합니다.

const routes = [];
let rootEl = null;
let notFoundFallbackHash = "#/home";

export function registerRoute(pattern, render) {
  const paramNames = [];
  const regex = new RegExp(
    "^" +
      pattern
        .split("/")
        .map((seg) => {
          if (seg.startsWith(":")) {
            paramNames.push(seg.slice(1));
            return "([^/]+)";
          }
          return seg;
        })
        .join("/") +
      "$"
  );
  routes.push({ regex, paramNames, render });
}

export function initRouter(root, fallbackHash = "#/home") {
  rootEl = root;
  notFoundFallbackHash = fallbackHash;
  window.addEventListener("hashchange", handleRouteChange);
  if (!location.hash) location.hash = fallbackHash;
  handleRouteChange();
}

export function navigate(hash, { replace = false } = {}) {
  if (location.hash === hash) {
    handleRouteChange();
    return;
  }
  if (replace) {
    history.replaceState(history.state, "", hash);
    handleRouteChange();
  } else {
    location.hash = hash;
  }
}

export function currentPath() {
  return location.hash.replace(/^#/, "") || "/home";
}

// v3.0.0: 화면 내 "←" 버튼 및 각종 "뒤로" 동작 전용 안전한 back()입니다.
// history.back()을 호출한 뒤, 실제로 popstate가 발생하는지(=되돌아갈 기록이 있었는지) 짧게 지켜보고
// 아무 반응이 없으면(설치형 PWA 재개 등으로 history stack이 사라진 경우) 기본 화면으로 대신 이동합니다.
// popstate는 되돌아간 곳의 해시가 이전과 같아도(예: 내부적으로 쌓은 더미 history 항목을 소비하는
// 화면) 항상 발생하므로, 그런 기존 화면들의 동작에는 영향을 주지 않습니다.
export function safeBack(fallbackHash = "#/home") {
  let handled = false;

  function onPopState() {
    handled = true;
    window.removeEventListener("popstate", onPopState);
  }

  window.addEventListener("popstate", onPopState);
  history.back();

  setTimeout(() => {
    if (handled) return;
    window.removeEventListener("popstate", onPopState);
    // 되돌아갈 history가 없었던 경우에만 여기로 옵니다 -> 기본 화면으로 fallback.
    navigate(fallbackHash, { replace: true });
  }, 250);
}

function handleRouteChange() {
  const path = currentPath();
  for (const route of routes) {
    const match = path.match(route.regex);
    if (match) {
      const params = {};
      route.paramNames.forEach((name, i) => (params[name] = decodeURIComponent(match[i + 1])));
      route.render(rootEl, params);
      window.scrollTo(0, 0);
      return;
    }
  }
  // v3.0.0: 일치하는 라우트가 없으면(PWA 재개 시 유효하지 않은 해시로 남아있는 경우 등) 경고만 남기고
  // 빈 화면에 갇히지 않도록 기본 화면으로 이동합니다.
  console.warn("[router] 일치하는 라우트가 없습니다:", path);
  navigate(notFoundFallbackHash, { replace: true });
}
