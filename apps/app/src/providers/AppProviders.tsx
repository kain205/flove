import { QueryClient, QueryClientProvider, focusManager } from '@tanstack/react-query';
import { AppState, Platform } from 'react-native';
import { useEffect, useState, type PropsWithChildren } from 'react';
import { AuthProvider } from './AuthProvider';
import '@/i18n';

function injectWebFonts() {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('flove-fonts')) return;

  const preconnect1 = document.createElement('link');
  preconnect1.rel = 'preconnect';
  preconnect1.href = 'https://fonts.googleapis.com';
  document.head.appendChild(preconnect1);

  const fontLink = document.createElement('link');
  fontLink.id = 'flove-fonts';
  fontLink.rel = 'stylesheet';
  fontLink.href =
    'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap';
  document.head.appendChild(fontLink);

  const style = document.createElement('style');
  style.id = 'flove-base-style';
  style.textContent =
    "body{font-family:'Plus Jakarta Sans',system-ui,-apple-system,sans-serif;background:#FFF7EF}" +
    'input:focus,textarea:focus{outline:none}' +
    'input,textarea{font-family:inherit}' +
    // Keyframes ported from the design prototype.
    '@keyframes flove-sweep{0%{transform:translateX(-120%) skewX(-18deg)}100%{transform:translateX(420%) skewX(-18deg)}}' +
    '@keyframes flove-floaty{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}' +
    '@keyframes flove-fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}' +
    '@keyframes flove-pulseGlow{0%,100%{opacity:.5;transform:scale(1)}50%{opacity:.85;transform:scale(1.08)}}' +
    // data-anim hooks (react-native-web renders dataSet as data-* attributes).
    '[data-anim="reveal"]{opacity:0;animation:flove-fadeUp .7s cubic-bezier(.2,.7,.2,1) forwards}' +
    '[data-anim="floaty"]{animation:flove-floaty 6s ease-in-out infinite}' +
    '[data-anim="pulse"]{animation:flove-pulseGlow 5s ease-in-out infinite}' +
    '[data-anim="sweep"]{animation:flove-sweep 7s ease-in-out infinite}' +
    '[data-anim="sweep-fast"]{animation:flove-sweep 4.5s ease-in-out infinite}';
  document.head.appendChild(style);
}

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        // Expensive workflows opt out entirely; ordinary reads get one transient retry.
        retry: 1,
        refetchOnReconnect: true,
      },
      mutations: { retry: false },
    },
  }));

  useEffect(() => {
    injectWebFonts();
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', status => {
      if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active');
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
