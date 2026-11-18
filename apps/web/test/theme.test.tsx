import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from '~/components/ThemeToggle';
import {
  THEME_STORAGE_KEY,
  applyTheme,
  persistThemePreference,
  readThemePreference,
  resolveTheme,
} from '~/lib/theme';

type Listener = (event: MediaQueryListEvent) => void;

function stubMatchMedia(dark: boolean) {
  const listeners = new Set<Listener>();
  const mq: MediaQueryList = {
    get matches() {
      return dark;
    },
    media: '(prefers-color-scheme: dark)',
    onchange: null,
    addEventListener: (type: string, cb: EventListenerOrEventListenerObject) => {
      if (type === 'change') listeners.add(cb as Listener);
    },
    removeEventListener: (type: string, cb: EventListenerOrEventListenerObject) => {
      if (type === 'change') listeners.delete(cb as Listener);
    },
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => true,
  };
  window.matchMedia = (query: string) => {
    if (!query.includes('prefers-color-scheme: dark')) {
      return { ...mq, matches: false, media: query };
    }
    return mq;
  };
  return {
    setDark(next: boolean) {
      dark = next;
      const event = { matches: next } as MediaQueryListEvent;
      for (const cb of listeners) cb(event);
    },
  };
}

function clearTheme() {
  localStorage.removeItem(THEME_STORAGE_KEY);
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.classList.remove('dark');
  document.documentElement.style.colorScheme = '';
}

describe('theme preference', () => {
  afterEach(clearTheme);

  it('defaults to system when nothing is stored', () => {
    clearTheme();
    stubMatchMedia(false);
    expect(readThemePreference()).toBe('system');
    expect(resolveTheme('system')).toBe('light');
    stubMatchMedia(true);
    expect(resolveTheme('system')).toBe('dark');
  });

  it('reads only light, dark or system from localStorage', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    expect(readThemePreference()).toBe('dark');
    localStorage.setItem(THEME_STORAGE_KEY, 'nope');
    expect(readThemePreference()).toBe('system');
  });

  it('applyTheme sets data-theme, the dark class and color-scheme', () => {
    stubMatchMedia(false);
    expect(applyTheme('dark')).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');

    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(document.documentElement.style.colorScheme).toBe('light');
  });

  it('persistThemePreference writes localStorage and applies the theme', () => {
    stubMatchMedia(true);
    persistThemePreference('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    persistThemePreference('system');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('system');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});

describe('ThemeToggle', () => {
  beforeEach(() => {
    cleanup();
    clearTheme();
    stubMatchMedia(false);
  });
  afterEach(() => {
    cleanup();
    clearTheme();
  });

  it('defaults to System, then persists Light and Dark when chosen', () => {
    render(<ThemeToggle />);
    const group = screen.getByRole('radiogroup', { name: 'Theme' });
    expect(group).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'System' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('radio', { name: 'Dark' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true');

    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('follows prefers-color-scheme while System is selected', () => {
    const scheme = stubMatchMedia(false);
    render(<ThemeToggle />);
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');

    act(() => scheme.setDark(true));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();

    fireEvent.click(screen.getByRole('radio', { name: 'Light' }));
    act(() => scheme.setDark(false));
    // Explicit Light is not overridden by the system scheme.
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('restores a stored preference on mount', async () => {
    persistThemePreference('dark');
    render(<ThemeToggle />);
    await waitFor(() => expect(screen.getByRole('radio', { name: 'Dark' }).getAttribute('aria-checked')).toBe('true'));
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });
});
