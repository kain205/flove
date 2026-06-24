// F-Love design tokens — warm-orange redesign.
// Derived from the design handoff (F-Love Web / App / Palette).
// Keep keys stable; screens read from here instead of hardcoding hex values.

export const colors = {
  // Surfaces
  background: '#FFF7EF', // warm cream page background
  surface: '#FFFFFF',
  surfaceWarm: '#FFF3E9', // soft note / inset panels
  surfaceTint: '#FEEFD2', // chip / soft button background

  // Text
  text: '#2B211A',
  textSoft: '#5A4C40',
  muted: '#9A8B7D',
  mutedLight: '#B9A99A',

  // Borders
  border: '#F4E3D4',
  borderSoft: '#F0DDCC',

  // Brand orange ramp
  primary: '#F0852A', // brand orange (used for tints/active states)
  primaryStrong: '#EC6C1A', // gradient end / strong accent
  primaryBright: '#F89233', // gradient start
  primaryDeep: '#DB6A12', // strong text on light
  primaryText: '#D9650F', // links / emphasis text
  primaryDark: '#C46A12', // chip text / deep accent

  // Accent (coral) from palette
  accent: '#E8806A',
  accentSoft: '#F49A6A',

  // Notes / AI callouts
  noteBg: '#FFF3E9',
  noteBorder: '#F8E2CF',
  noteText: '#8A5A3C',

  // Status
  online: '#5BC47A',
  warning: '#B7791F',

  // On-brand text
  onPrimary: '#FFFFFF',
} as const;

// Gradient stop pairs (consumed by expo-linear-gradient as `colors` prop).
export const gradients = {
  brand: ['#F89233', '#EC6C1A'] as const,
  brandSoft: ['#F9A93C', '#EC6C1A'] as const,
  meter: ['#F9B44E', '#EC6C1A'] as const,
  card: ['#FBC76A', '#F0852A'] as const,
  welcome: ['#F9A93C', '#F0852A', '#E5701A'] as const,
  heroCard: ['#F9A93C', '#EC6C1A'] as const,
} as const;

// Reusable avatar/card gradient palettes keyed by an index.
export const avatarGradients: ReadonlyArray<readonly [string, string]> = [
  ['#FBC76A', '#F0852A'],
  ['#F9B856', '#E5701A'],
  ['#FBCB78', '#F08A2E'],
  ['#F9B44E', '#E56E18'],
  ['#FBB94E', '#F0852A'],
];

export function gradientForKey(key: string): readonly [string, string] {
  let sum = 0;
  for (let i = 0; i < key.length; i += 1) sum += key.charCodeAt(i);
  return avatarGradients[sum % avatarGradients.length];
}

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radii = {
  sm: 12,
  md: 14,
  lg: 16,
  xl: 20,
  xxl: 24,
  pill: 999,
} as const;

export const fonts = {
  // Plus Jakarta Sans is loaded on web (see AppProviders); native falls back to system.
  body: 'Plus Jakarta Sans, system-ui, -apple-system, sans-serif',
  mono: 'JetBrains Mono, ui-monospace, SFMono-Regular, monospace',
} as const;
