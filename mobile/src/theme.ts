// Mirrors the light-theme palette in frontend/src/index.css so the mobile
// app reads as the same product, not a reskin.
export const colors = {
  bg: '#f6f7fb',
  surface: '#ffffff',
  surfaceHover: '#f1f2fa',
  border: '#e2e5ee',
  text: '#171b2e',
  textMuted: '#64748b',

  primary: '#004c97',
  primaryHover: '#003d7a',
  primaryContrast: '#ffffff',
  primaryTint: 'rgba(0, 76, 151, 0.08)',

  success: '#007a53',
  successTint: 'rgba(0, 122, 83, 0.1)',
  danger: '#dc2626',
  dangerTint: 'rgba(220, 38, 38, 0.1)',
  warning: '#d97706',
  warningTint: 'rgba(217, 119, 6, 0.1)',
  info: '#1d6fb8',
  infoTint: 'rgba(29, 111, 184, 0.1)',
} as const;

export const radius = { sm: 8, md: 12, lg: 18, xl: 22 } as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

// Mirrors frontend/src/index.css: --font-body (Inter) for text, --font-heading
// (Lexend) for h1-h3. Custom font files ignore the `fontWeight` style prop on
// Android, so pick the weight-specific family instead of fontWeight + these.
export const fonts = {
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  bodyExtraBold: 'Inter_800ExtraBold',
  headingSemiBold: 'Lexend_600SemiBold',
  headingBold: 'Lexend_700Bold',
  headingExtraBold: 'Lexend_800ExtraBold',
} as const;
