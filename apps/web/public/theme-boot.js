/* Apply the saved theme (or system preference) before first paint. No network. */
(function () {
  var KEY = 'runtime-lab-theme';
  var pref = 'system';
  try {
    var stored = localStorage.getItem(KEY);
    if (stored === 'light' || stored === 'dark' || stored === 'system') pref = stored;
  } catch {
    /* storage may be blocked */
  }
  var dark = pref === 'dark' || (pref === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var theme = dark ? 'dark' : 'light';
  var root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', dark);
  root.style.colorScheme = theme;
})();
