/** localStorage key for the user's theme preference. Also used by /theme-boot.js. */
export const THEME_STORAGE_KEY = 'runtime-lab-theme';

export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

export function readThemePreference(): ThemePreference {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    if (isThemePreference(value)) return value;
  } catch {
    /* private mode or blocked storage */
  }
  return 'system';
}

export function prefersDarkScheme(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') return preference;
  return prefersDarkScheme() ? 'dark' : 'light';
}

/** Apply the resolved theme to <html> so CSS variables switch immediately. */
export function applyTheme(preference: ThemePreference): ResolvedTheme {
  const theme = resolveTheme(preference);
  const root = document.documentElement;
  root.setAttribute('data-theme', theme);
  root.classList.toggle('dark', theme === 'dark');
  root.style.colorScheme = theme;
  return theme;
}

export function persistThemePreference(preference: ThemePreference): ResolvedTheme {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    /* ignore quota / privacy errors; the theme still applies for this session */
  }
  return applyTheme(preference);
}
