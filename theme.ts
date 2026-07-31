import { createContext, useContext } from 'react';
import type { TextStyle } from 'react-native';

/**
 * Tokens transcribed from `openseat v4.dc.html` — the two :root blocks, verbatim.
 * No invented values. CSS var name -> camelCase key.
 */
export const light = {
  bgCanvas: '#EFE7D8',
  surface: '#FAF5EC',
  raised: '#FFFDF8',
  fill: '#F1EADC',
  hairFaint: '#F0E8D9',
  map: '#EDE5D5',
  mapGrid: '#F8F2E7',
  park: '#E7E9D9',
  water: '#E1E7E9',
  frame: '#DFD5C4',
  hair: '#E8DFD0',
  hair2: '#E0D6C3',
  dash: '#D4C7B3',
  dotMute: '#C6B9A5',
  disabled: '#C7B9A6',
  ink: '#2A2420',
  ink2: '#5A4F45',
  ink3: '#6E6157',
  mute: '#8A7C6C',
  mute2: '#A2947F',
  faint: '#B3A491',
  parkLabel: '#A3A891',
  waterLabel: '#9EAFB6',
  avGreen: '#5F6B54',
  avBlue: '#5A6E77',
  green: '#5F8B5F',
  blue: '#4A7C97',
  coral: '#FF5C7A',
  coralHover: '#E24462',
  onCoral: '#FFF7EE',
  danger: '#B4443C',
  onDanger: '#FFF4F0',
  surface94: 'rgba(250,245,236,0.94)',
  shadowCol: 'rgba(42,36,32,0.35)',
  shadowCol2: 'rgba(42,36,32,0.45)',
  peelShadow: 'rgba(42,36,32,0.14)',
  greenGlow: 'rgba(95,139,95,0.16)',
};

export const dark: typeof light = {
  bgCanvas: '#12100E',
  surface: '#1A1714',
  raised: '#221E1A',
  fill: '#2A2521',
  hairFaint: '#262220',
  map: '#1D1A16',
  mapGrid: '#262220',
  park: '#232A22',
  water: '#1E272B',
  frame: '#35302A',
  hair: '#2E2A24',
  hair2: '#3A342C',
  dash: '#453E34',
  dotMute: '#52493D',
  disabled: '#5F5648',
  ink: '#F2EDE3',
  ink2: '#D2C9BB',
  ink3: '#B6AC9D',
  mute: '#9C9284',
  mute2: '#8B8173',
  faint: '#776E62',
  parkLabel: '#6E7A67',
  waterLabel: '#6C8189',
  avGreen: '#9FB394',
  avBlue: '#9BB4BE',
  green: '#7CAF7C',
  blue: '#74A9C6',
  coral: '#FF6B85',
  coralHover: '#FF8A9E',
  onCoral: '#2A1418',
  danger: '#E0665C',
  onDanger: '#2A1210',
  surface94: 'rgba(26,23,20,0.94)',
  shadowCol: 'rgba(0,0,0,0.6)',
  shadowCol2: 'rgba(0,0,0,0.65)',
  peelShadow: 'rgba(0,0,0,0.5)',
  greenGlow: 'rgba(124,175,124,0.2)',
};

export type Colors = typeof light;
export type Scheme = 'light' | 'dark';

export const font = {
  regular: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_700Bold',
};

/** The design writes letter-spacing in em; RN wants absolute px. */
export const em = (value: number, fontSize: number) => value * fontSize;

/** Radii the design actually uses. */
export const radius = {
  xs: 6,
  sm: 8,
  chip: 9,
  join: 10,
  md: 11,
  card: 12,
  map: 14,
  sheet: 24,
  round: 99,
};

/** Text presets that repeat across three or more screens. */
export const type = {
  /** 10px / 700 / .16em uppercase — the eyebrow above every section. */
  eyebrow: {
    fontFamily: font.bold,
    fontSize: 10,
    letterSpacing: em(0.16, 10),
  } as TextStyle,
  /** 26px display — screen headlines. */
  display: {
    fontFamily: font.bold,
    fontSize: 26,
    lineHeight: 26 * 1.15,
    letterSpacing: em(-0.022, 26),
  } as TextStyle,
  /** 28px display — room titles. */
  displayLg: {
    fontFamily: font.bold,
    fontSize: 28,
    lineHeight: 28 * 1.12,
    letterSpacing: em(-0.022, 28),
  } as TextStyle,
  /** 19px — feed card titles. */
  cardTitle: {
    fontFamily: font.bold,
    fontSize: 19,
    lineHeight: 19 * 1.2,
    letterSpacing: em(-0.018, 19),
  } as TextStyle,
  /** 17px — prompt answers. */
  prompt: {
    fontFamily: font.medium,
    fontSize: 17,
    lineHeight: 17 * 1.35,
    letterSpacing: em(-0.012, 17),
  } as TextStyle,
  body: { fontFamily: font.regular, fontSize: 13 } as TextStyle,
};

export const ThemeContext = createContext<{ c: Colors; scheme: Scheme }>({
  c: light,
  scheme: 'light',
});

export const useTheme = () => useContext(ThemeContext);
