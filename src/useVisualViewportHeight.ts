import { useEffect } from 'react';

/**
 * Keep --app-height / --app-top in sync with the visual viewport.
 * On iOS Safari the browser chrome (nav / URL bar) changes the visible
 * area without a reliable 100dvh update — without this the board shrinks
 * under the chrome or leaves a dead gap.
 */
export function useVisualViewportHeight(): void {
  useEffect(() => {
    const root = document.documentElement;

    const sync = () => {
      const vv = window.visualViewport;
      const height = vv?.height ?? window.innerHeight;
      const offsetTop = vv?.offsetTop ?? 0;
      root.style.setProperty('--app-height', `${Math.round(height)}px`);
      root.style.setProperty('--app-top', `${Math.round(offsetTop)}px`);
    };

    sync();
    const vv = window.visualViewport;
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);
    window.addEventListener('orientationchange', sync);
    return () => {
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      window.removeEventListener('orientationchange', sync);
    };
  }, []);
}
