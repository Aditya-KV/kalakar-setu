/**
 * Kalakar Setu — Gluestack UI Theme
 * Extends the default gluestack config token palette with the app's
 * warm terracotta brand colors (see constants/Colors.ts) so gluestack
 * primitives (Button, Badge, Spinner, Progress, ...) match the rest of the app.
 */

import { createConfig } from '@gluestack-style/react';
import { config as defaultConfig } from '@gluestack-ui/config';

export const gluestackTheme = createConfig({
  ...defaultConfig,
  tokens: {
    ...defaultConfig.tokens,
    colors: {
      ...defaultConfig.tokens.colors,
      // Brick maroon — primary brand scale (from the Kalakar Setu logo)
      primary0: '#F3E2DE',
      primary50: '#E3C3BB',
      primary100: '#C08A80',
      primary200: '#A65D4F',
      primary300: '#8C3128',
      primary400: '#7D2C24',
      primary500: '#6B2119',
      primary600: '#571A14',
      primary700: '#461611',
      primary800: '#35100D',
      primary900: '#240B09',
      primary950: '#130504',
      // Warm ink brown — secondary
      secondary0: '#F2ECD8',
      secondary50: '#DCD1B1',
      secondary100: '#A69C8C',
      secondary200: '#7A6E5C',
      secondary300: '#6E6154',
      secondary400: '#4A3A2E',
      secondary500: '#2C211A',
      secondary600: '#241B15',
      secondary700: '#1D1611',
      secondary800: '#15100D',
      secondary900: '#0D0A08',
      secondary950: '#060504',
      // Semantic status colors
      success500: '#4C7A52',
      success600: '#3D6242',
      warning500: '#C79A3E',
      warning600: '#A67B24',
      error500: '#B8432F',
      error600: '#973626',
    },
  },
});

export type GluestackTheme = typeof gluestackTheme;
