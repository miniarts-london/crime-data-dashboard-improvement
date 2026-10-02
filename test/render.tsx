import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, type RenderOptions } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { getTheme } from '@/lib/theme';
import { makeQueryClient } from '@/lib/queryClient';

// A fresh query cache per test, so cached results never leak between tests.
export function createQueryWrapper() {
  const client = makeQueryClient();
  return function QueryWrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

export function renderWithProviders(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  const QueryWrapper = createQueryWrapper();
  function Providers({ children }: { children: ReactNode }) {
    return (
      <QueryWrapper>
        <ThemeProvider theme={getTheme('light')}>
          <LocalizationProvider dateAdapter={AdapterDayjs}>{children}</LocalizationProvider>
        </ThemeProvider>
      </QueryWrapper>
    );
  }
  return render(ui, { wrapper: Providers, ...options });
}
