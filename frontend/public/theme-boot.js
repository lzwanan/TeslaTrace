/* eslint-disable */
/**
 * Read the theme before the first paint.
 *
 * A plain file rather than an inline <script> so the Content-Security-Policy can
 * stay at `script-src 'self'` with no 'unsafe-inline'. Keep in sync with
 * src/lib/theme.ts — this one runs before any bundle exists.
 */
(function () {
  try {
    var saved = localStorage.getItem("teslatrace.theme");
    var dark =
      saved === "dark" || saved === "light"
        ? saved === "dark"
        : !window.matchMedia("(prefers-color-scheme: light)").matches;
    var root = document.documentElement;
    root.dataset.theme = dark ? "dark" : "light";
    root.style.colorScheme = dark ? "dark" : "light";
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", dark ? "#0A0E13" : "#EFF2F5");
  } catch (error) {
    /* Private mode with storage disabled: the dark default in <html> stands. */
  }
})();
