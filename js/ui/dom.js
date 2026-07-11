// dom.js
// 프레임워크 없이도 컴포넌트처럼 작성할 수 있게 해주는 최소한의 DOM 헬퍼입니다.

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  Object.entries(props || {}).forEach(([key, value]) => {
    if (value === undefined || value === null || value === false) return;
    if (key === "class") node.className = value;
    else if (key === "text") node.textContent = value;
    else if (key === "html") node.innerHTML = value;
    else if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value);
    } else if (key === "style" && typeof value === "object") {
      Object.assign(node.style, value);
    } else {
      node.setAttribute(key, value);
    }
  });
  (Array.isArray(children) ? children : [children]).forEach((c) => {
    if (c === null || c === undefined || c === false) return;
    node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(c) : c);
  });
  return node;
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

export function mount(root, node) {
  clear(root);
  root.appendChild(node);
}

// 길게 누르기(long press) 제스처 헬퍼: 모바일 터치/마우스 공통 지원
export function onLongPress(node, callback, ms = 550) {
  let timer = null;
  const start = () => {
    timer = setTimeout(callback, ms);
  };
  const cancel = () => {
    if (timer) clearTimeout(timer);
  };
  node.addEventListener("touchstart", start, { passive: true });
  node.addEventListener("touchend", cancel);
  node.addEventListener("touchmove", cancel);
  node.addEventListener("mousedown", start);
  node.addEventListener("mouseup", cancel);
  node.addEventListener("mouseleave", cancel);
}
