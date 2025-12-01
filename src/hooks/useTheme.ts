import { useState, useEffect, Dispatch, SetStateAction } from 'react';

export function useTheme(): [string, Dispatch<SetStateAction<string>>] {
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  return [theme, setTheme] as const;
}
