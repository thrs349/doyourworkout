// bottomNav.js
import { el } from "../dom.js";
import { navigate } from "../router.js";

// 메뉴 순서: 루틴 - 홈 - 기록 (홈이 항상 정중앙)
export function renderBottomNav(activeKey) {
  const items = [
    { key: "routine", label: "루틴", icon: "☰", hash: "#/routine-list" },
    { key: "home", label: "홈", icon: "⌂", hash: "#/home" },
    { key: "history", label: "기록", icon: "▤", hash: "#/history", sub: "지난 운동" },
  ];

  return el(
    "nav",
    { class: "bottom-nav" },
    items.map((item) =>
      el(
        "button",
        {
          class: `nav-item${item.key === activeKey ? " active" : ""}`,
          onclick: () => navigate(item.hash, { replace: true }),
        },
        [
          el("span", { class: "nav-icon", text: item.icon }),
          el("span", { text: item.label }),
          item.sub ? el("span", { class: "nav-sub", text: item.sub }) : null,
        ]
      )
    )
  );
}
