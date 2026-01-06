import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem('app_theme');
    const initialTheme = (saved as Theme) || 'light';
    return initialTheme;
  });

  // Áp dụng theme ngay khi mount (trước khi render)
  useEffect(() => {
    const saved = localStorage.getItem('app_theme');
    const initialTheme = (saved as Theme) || 'light';
    const root = document.documentElement;
    
    if (initialTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, []);

  // Áp dụng theme khi theme state thay đổi
  useEffect(() => {
    const root = document.documentElement;
    
    // Xóa class dark trước để tránh conflict
    root.classList.remove('dark');
    
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    
    // Lưu vào localStorage
    localStorage.setItem('app_theme', theme);
    
    // Force reflow để đảm bảo CSS được áp dụng
    root.offsetHeight;
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};
