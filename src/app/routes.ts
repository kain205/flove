import {
  MessageCircle,
  Shuffle,
  Sparkles,
  User,
  type LucideIcon,
} from 'lucide-react';

export type AppTab = 'ai-picks' | 'blind-date' | 'messages' | 'profile';

export interface AppRouteMetadata {
  tab: AppTab;
  path: string;
  labelKey: string;
  icon: LucideIcon;
  requiresAuth: boolean;
  isNavigationItem: boolean;
}

export const DEFAULT_APP_TAB: AppTab = 'ai-picks';

export const APP_ROUTES = [
  {
    tab: 'ai-picks',
    path: '/',
    labelKey: 'navigation.aiPicks',
    icon: Sparkles,
    requiresAuth: true,
    isNavigationItem: false,
  },
  {
    tab: 'ai-picks',
    path: '/ai-picks',
    labelKey: 'navigation.aiPicks',
    icon: Sparkles,
    requiresAuth: true,
    isNavigationItem: true,
  },
  {
    tab: 'blind-date',
    path: '/blind-date',
    labelKey: 'navigation.blindDate',
    icon: Shuffle,
    requiresAuth: true,
    isNavigationItem: true,
  },
  {
    tab: 'messages',
    path: '/messages',
    labelKey: 'navigation.messages',
    icon: MessageCircle,
    requiresAuth: true,
    isNavigationItem: true,
  },
  {
    tab: 'profile',
    path: '/profile',
    labelKey: 'navigation.profile',
    icon: User,
    requiresAuth: true,
    isNavigationItem: true,
  },
] as const satisfies readonly AppRouteMetadata[];

export const CHAT_ROUTE = {
  path: '/chat/:conversationId',
  requiresAuth: true,
} as const;

export const APP_NAV_ROUTES = APP_ROUTES.filter(route => route.isNavigationItem);

export function getActiveTabForPath(pathname: string): AppTab {
  const matchingRoute = [...APP_ROUTES]
    .sort((a, b) => b.path.length - a.path.length)
    .find(route => {
      if (route.path === '/') return pathname === '/';
      return pathname === route.path || pathname.startsWith(`${route.path}/`);
    });

  return matchingRoute?.tab ?? DEFAULT_APP_TAB;
}

export function getPathForTab(tab: AppTab): string {
  return APP_NAV_ROUTES.find(route => route.tab === tab)?.path ?? '/';
}
