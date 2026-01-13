/**
 * NESTED App Design System
 * Extracted from Figma - HeartLove Dating Mobile App
 * 
 * This file contains all design tokens for consistent styling
 */

export const colors = {
  // Primary Colors
  primary: '#E5385A',      // Main pink/red - buttons, titles, accents (vibrant coral-red)
  primaryDark: '#D42E4F',  // Darker shade for hover states
  
  // Secondary Colors  
  secondary: '#8A2387',    // Purple accent
  
  // Neutral Colors
  dark: '#231429',         // Dark text, home indicator
  white: '#FFFFFF',        // Backgrounds
  
  // Gray Scale
  gray100: '#F3F3F3',      // Light backgrounds
  gray200: '#E8E6EA',      // Borders, dividers
  gray300: '#ADAFBB',      // Placeholder text, descriptions
  gray400: '#323755',      // Secondary text
  
  // Pagination
  dotActive: '#E5385A',
  dotInactive: '#E8E6EA',
}

export const typography = {
  // Font Family - Sk-Modernist (fallback to system fonts)
  fontFamily: "'SK-Modernist', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
  
  // Font Sizes
  sizes: {
    xs: '12px',
    sm: '14px',
    base: '16px',
    lg: '18px',
    xl: '20px',
    '2xl': '24px',
    '3xl': '30px',
    '4xl': '34px',
  },
  
  // Font Weights
  weights: {
    regular: 400,
    medium: 500,
    semibold: 600,
    bold: 700,
  },
  
  // Line Heights
  lineHeights: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
  },
  
  // Letter Spacing
  letterSpacing: {
    tight: '-0.02em',
    normal: '0',
    wide: '0.1em',
    wider: '0.15em',
  }
}

export const spacing = {
  // Base spacing unit: 4px
  0: '0',
  1: '4px',
  2: '8px',
  3: '12px',
  4: '16px',
  5: '20px',
  6: '24px',
  7: '28px',
  8: '32px',
  9: '36px',
  10: '40px',
  12: '48px',
  14: '56px',
  16: '64px',
  20: '80px',
  24: '96px',
}

export const borderRadius = {
  none: '0',
  sm: '4px',
  md: '8px',
  lg: '15px',
  xl: '20px',
  full: '9999px',  // For pills/buttons
}

export const shadows = {
  // Card shadows
  card: '0 4px 15px rgba(0, 0, 0, 0.08)',
  cardHover: '0 8px 25px rgba(0, 0, 0, 0.12)',
  
  // Button shadow
  button: '0 10px 30px rgba(229, 56, 90, 0.3)',
}

// Screen dimensions (iPhone frame)
export const screen = {
  width: 375,
  height: 812,
  paddingX: 40,  // Horizontal padding
}

// Component-specific styles
export const components = {
  // Primary Button
  buttonPrimary: {
    height: '56px',
    borderRadius: '15px',
    fontSize: '16px',
    fontWeight: 700,
  },
  
  // Secondary/Outline Button
  buttonSecondary: {
    height: '56px',
    borderRadius: '15px',
    borderWidth: '1px',
    fontSize: '16px',
    fontWeight: 600,
  },
  
  // Social Button
  buttonSocial: {
    size: '64px',
    borderRadius: '12px',
    borderWidth: '1px',
  },
  
  // Input Field
  input: {
    height: '58px',
    borderRadius: '15px',
    borderWidth: '1px',
    fontSize: '14px',
  },
  
  // Pagination Dots
  dot: {
    size: '8px',
    gap: '8px',
  },
  
  // Home Indicator
  homeIndicator: {
    width: '134px',
    height: '5px',
    borderRadius: '100px',
  },
  
  // Card Stack (Onboarding)
  cardStack: {
    cardWidth: '240px',
    cardHeight: '340px',
    borderRadius: '20px',
  },
}

export default {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
  screen,
  components,
}

