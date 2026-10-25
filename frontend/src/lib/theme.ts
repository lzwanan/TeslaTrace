/**
 * Theme, in one place.
 *
 * `index.html` runs the same read before the first paint, so the page never
 * flashes dark before switching to light. The browser chrome colours live here
 * too: a dark `theme-color` above a light page is the difference between an app
 * and a website.
 */

export type Theme = "dark" | "light";

const KEY = "teslatrace.theme";

/** Matches `--bg` in styles.css; kept literal because `<meta>` cannot read CSS vars. */
const CHROME: Record<Theme, string> = { dark: "#0A0E13", light: "#EFF2F5" };

export function readTheme(): Theme {
  const saved = localStorage.getItem(KEY);
  if (saved === "dark" || saved === "light") return saved;
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.style.colorScheme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", CHROME[theme]);
}

export function saveTheme(theme: Theme): void {
  localStorage.setItem(KEY, theme);
}
