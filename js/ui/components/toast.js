// toast.js
import { el } from "../dom.js";

let currentToast = null;

export function showToast(message, ms = 2000) {
  if (currentToast) {
    currentToast.remove();
    currentToast = null;
  }
  const toast = el("div", { class: "toast", text: message });
  document.body.appendChild(toast);
  currentToast = toast;
  requestAnimationFrame(() => toast.classList.add("show"));
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => {
      toast.remove();
      if (currentToast === toast) currentToast = null;
    }, 200);
  }, ms);
}
