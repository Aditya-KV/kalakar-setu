/**
 * Kalakar Setu — Design System Colors
 * Derived directly from the Kalakar Setu badge logo (brick-maroon on warm
 * cream, quill motif) — toned down from the logo's own vibrancy for
 * comfortable all-day screen use, with a soft gold accent for highlights.
 */

export const Colors = {
  light: {
    primary: '#8C3128',       // Brick Maroon (from logo)
    primaryDark: '#6B2119',   // Pressed Maroon
    primaryLight: '#C08A80',  // Mid Rose-Brick
    primaryTint: '#F3E2DE',   // Pale Rose (icon circles, light backgrounds)
    secondary: '#2C211A',     // Warm Ink Brown
    secondaryLight: '#4A3A2E',
    secondaryAccent: '#A67C3D', // Muted Bronze — selected states, small highlights only
    accent: '#C79A3E',        // Soft Gold Ochre (from logo's cream-on-red warmth)
    accentDark: '#A67B24',
    info: '#5C6E7A',          // Muted Slate
    background: '#FAF6E9',    // Warm Ivory (softer than the logo's own cream)
    surface: '#FFFFFF',       // Clean White
    surfaceElevated: '#F2ECD8',
    border: '#E8DFC9',        // Pale Cream-Tan
    borderFocused: '#8C3128',
    text: '#2C211A',
    textPrimary: '#2C211A',   // Warm Ink Brown
    textSecondary: '#6E6154', // Warm Taupe
    textMuted: '#A69C8C',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#FFFFFF',
    success: '#4C7A52',       // Forest Green
    successLight: '#E7F0E5',
    warning: '#C79A3E',       // Soft Gold Ochre
    warningLight: '#FAF1DC',
    error: '#B8432F',         // Warm Red-Orange (kept distinct from the maroon primary)
    errorLight: '#F8E3DD',
    tabIconDefault: '#A69C8C',
    tabIconSelected: '#8C3128',
    badgeDraft: '#C79A3E',
    badgeSynced: '#4C7A52',
    badgeAction: '#B8432F',
    tint: '#8C3128',
  },
  dark: {
    primary: '#C1584A',
    primaryDark: '#8C3128',
    primaryLight: '#6B2119',
    primaryTint: '#3A241F',
    secondary: '#E4DAC9',
    secondaryLight: '#F2EAD9',
    secondaryAccent: '#D1A868',
    accent: '#E0B563',
    accentDark: '#C79A3E',
    info: '#8CA0AC',
    background: '#1C1712',
    surface: '#26201A',
    surfaceElevated: '#302921',
    border: '#3D342A',
    borderFocused: '#C1584A',
    text: '#F5F0E3',
    textPrimary: '#F5F0E3',
    textSecondary: '#C2B7A3',
    textMuted: '#8A8071',
    textOnPrimary: '#FFFFFF',
    textOnSecondary: '#14100C',
    success: '#6BAE73',
    successLight: '#223326',
    warning: '#E0B563',
    warningLight: '#332A18',
    error: '#D97A63',
    errorLight: '#33221C',
    tabIconDefault: '#8A8071',
    tabIconSelected: '#C1584A',
    badgeDraft: '#E0B563',
    badgeSynced: '#6BAE73',
    badgeAction: '#D97A63',
    tint: '#C1584A',
  },
};

export type ColorScheme = keyof typeof Colors;
export type ThemeColors = typeof Colors.light;

export default Colors;
