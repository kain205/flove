import { describe, expect, it } from 'vitest';
import { APP_NAV_ROUTES, getActiveTabForPath, getPathForTab } from './routes';

describe('route metadata', () => {
  it('keeps root on the AI Picks tab without requiring a redirect', () => {
    expect(getActiveTabForPath('/')).toBe('ai-picks');
  });

  it('maps tab navigation from the shared route metadata', () => {
    expect(getPathForTab('messages')).toBe('/messages');
    expect(APP_NAV_ROUTES.map(route => route.path)).toEqual([
      '/ai-picks',
      '/blind-date',
      '/messages',
      '/profile',
    ]);
  });
});
