import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';

import { ThemeProvider } from '@/components/theme-provider';
import { THEME_INIT_SCRIPT } from '@/lib/theme';
import '@/styles/globals.css';

export const metadata: Metadata = {
  title: 'WaterDrinkers',
  description: 'Учёт офисной кассы на бутилированную воду',
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5fbff' },
    { media: '(prefers-color-scheme: dark)', color: '#091521' },
  ],
};

export default function RootLayout({ children }: { children: ReactNode }): ReactNode {
  return (
    // suppressHydrationWarning: data-theme на <html> ставит скрипт ниже,
    // до гидратации, поэтому разметка сервера и клиента здесь заведомо разная.
    <html lang="ru" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="min-h-dvh antialiased">
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
