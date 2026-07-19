// modal.js
import { el } from "../dom.js";

export function openModal(contentNode, { dismissible = false, onClose } = {}) {
  const backdrop = el("div", { class: "backdrop", onclick: dismissible ? () => close() : undefined }, [
    el("div", { class: "modal", onclick: (e) => e.stopPropagation() }, [contentNode]),
  ]);
  document.body.appendChild(backdrop);
  function close() {
    backdrop.remove();
    if (onClose) onClose();
  }
  return close;
}

// v2.6.1: 실기기 테스트 반영 - 화면마다 제각각이던 네이티브 alert()를 걷어내고, 앱 전역에서 이미 쓰던
// .duration-modal 스타일(제목 + 확인 버튼)로 통일합니다. 단순 안내/검증 메시지 전용이며, 여러 버튼이나
// 세부 문단이 필요한 경우(삭제 확인 등)는 기존처럼 openModal(content)로 직접 구성하면 됩니다.
export function showAlert(message) {
  const content = el("div", { class: "duration-modal" }, [
    el("div", { class: "duration-title", text: message }),
    el("button", { class: "btn btn-primary", text: "확인", onclick: () => close() }),
  ]);
  const close = openModal(content, { dismissible: true });
  return close;
}
