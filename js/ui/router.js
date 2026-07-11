// router.js
// 화면 전환만 담당하는 아주 단순한 해시 라우터입니다. (#/home, #/workout/mon, #/routine/mon ...)
//
// v1.1: 뒤로가기 UX 개선을 위해 navigate()에 { replace: true } 옵션을 추가했습니다.
// - 기본(push): location.hash를 바꿔 새 history 항목을 쌓습니다. "드릴다운" 이동(목록 -> 상세)에 적합합니다.
// - replace: history.replaceState로 현재 항목을 덮어써 쌓이지 않게 합니다. 하단 탭 전환처럼
//   "같은 레벨"을 오가는 이동이나, 뒤로가기로 되돌아가면 안 되는 화면(운동 종료 후 결과 -> 홈)에 씁니다.
// 화면 내 "←" 버튼은 대부분 history.back()을 호출해, 쌓인 만큼만 자연스럽게 되돌아가도록 구현했습니다.

const routes = [];
let rootEl = null;

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
  console.warn("[router] 일치하는 라우트가 없습니다:", path);
}
