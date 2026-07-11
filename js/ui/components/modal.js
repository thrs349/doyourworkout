// modal.js
import { el } from "../dom.js";

export function openModal(contentNode, { dismissible = false } = {}) {
  const backdrop = el("div", { class: "backdrop", onclick: dismissible ? () => close() : undefined }, [
    el("div", { class: "modal", onclick: (e) => e.stopPropagation() }, [contentNode]),
  ]);
  document.body.appendChild(backdrop);
  function close() {
    backdrop.remove();
  }
  return close;
}
