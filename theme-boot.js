/* Northwind Ledger — set the theme before the stylesheet paints.
   A classic script on purpose: it must run while the parser is in <head>, so
   the page never flashes the wrong deck. A blocked script simply leaves the
   dark default in the document. */
(function () {
  var theme = null;
  try {
    theme = window.localStorage.getItem("northwind-theme");
  } catch (error) {
    theme = null;
  }

  if (theme !== "light" && theme !== "dark") {
    theme = window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  }

  document.documentElement.setAttribute("data-theme", theme);
})();
