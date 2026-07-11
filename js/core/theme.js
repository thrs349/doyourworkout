// theme.js
// 색상을 하드코딩하지 않고 "Theme 객체(Design Token)"로만 관리합니다.
// 테마를 바꿔도 레이아웃/구조는 그대로이고 CSS 변수 값만 바뀝니다.
// 새 테마를 추가하려면 THEMES 배열에 객체 하나만 더 넣으면 됩니다.

export const THEMES = [
  {
    id: "themeA",
    defaultName: "Theme A",
    tokens: {
      "--color-bg": "#CAD183",
      "--color-primary": "#F7CAC9",
      "--color-on-primary": "#FFFFFF", // Theme A 전용 규칙: Primary 배경 위 텍스트는 항상 흰색
      "--color-surface": "#E4E8C4", // 흰색 배경을 최대한 쓰지 않기 위해 은은한 톤 사용
      "--color-surface-alt": "#D9DFB2",
      "--color-border": "#B9C177",
      "--color-text-primary": "#2E3316",
      "--color-text-secondary": "#5C6432",
      "--color-text-muted": "#8B9257",
      "--color-a": "#355E3B",
      "--color-b": "#A97C1F",
      "--color-x": "#8C3B3B",
      "--color-challenge-hl": "#E5EBC8",
      "--color-primary-soft": "rgba(247, 202, 201, 0.28)",
    },
  },
  {
    id: "themeB",
    defaultName: "Theme B",
    tokens: {
      "--color-bg": "#FFF8B9",
      "--color-primary": "#7A8F4F",
      "--color-on-primary": "#FFFFFF",
      "--color-surface": "#FFFFFF",
      "--color-surface-alt": "#FBF3D6",
      "--color-border": "#E7DDA8",
      "--color-text-primary": "#2B2A1F",
      "--color-text-secondary": "#77744F",
      "--color-text-muted": "#ACA679",
      "--color-a": "#3F6A2B",
      "--color-b": "#B8871B",
      "--color-x": "#B0413E",
      "--color-challenge-hl": "#FFFCD6",
      "--color-primary-soft": "rgba(122, 143, 79, 0.14)",
    },
  },
  {
    id: "themeC",
    defaultName: "Theme C",
    tokens: {
      "--color-bg": "#E4F482",
      "--color-primary": "#FF4FA3",
      "--color-on-primary": "#FFFFFF",
      "--color-surface": "#FFFFFF",
      "--color-surface-alt": "#F5F9D6",
      "--color-border": "#D3DFA0",
      "--color-text-primary": "#293317",
      "--color-text-secondary": "#5E6B3A",
      "--color-text-muted": "#93A066",
      "--color-a": "#2F6A3D",
      "--color-b": "#B98518",
      "--color-x": "#A94442",
      "--color-challenge-hl": "#F2F8C6",
      "--color-primary-soft": "rgba(255, 79, 163, 0.14)",
    },
  },
];

export function getThemeById(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0];
}

export function getThemeName(theme, customNames) {
  return customNames?.[theme.id] || theme.defaultName;
}

// 현재 선택된 테마의 토큰 값을 :root에 적용합니다. (레이아웃/구조는 건드리지 않음)
export function applyTheme(themeId) {
  const theme = getThemeById(themeId);
  const root = document.documentElement;
  Object.entries(theme.tokens).forEach(([key, value]) => {
    root.style.setProperty(key, value);
  });
  return theme;
}
