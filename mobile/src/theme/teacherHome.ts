import { BRAND_COLORS } from '../utils/branding';

/**
 * Design tokens for the teacher Home Dashboard (Figma file "pds-school",
 * frame "Home · Teacher Dashboard"). Brand colors are reused from BRAND_COLORS;
 * only values that the shared palette does not already define are added here.
 */
export const TH = {
  bg: BRAND_COLORS.surfaceSoft, // #F7F9FC page background
  surface: '#FFFFFF',
  navy: BRAND_COLORS.primary, // #0B1F4B
  royal: BRAND_COLORS.primaryRoyal, // #123B8C
  gold: BRAND_COLORS.accentGold, // #D9A441
  ink: '#142440', // primary text
  muted: '#63718A', // secondary text, inactive icons
  border: '#E3E9F2',
  tile: '#EAF0FC', // icon tile / info badge background
  goldSoft: '#FFF6E5', // warning badge background
  goldInk: '#8A5B12', // warning badge text
  onNavyMuted: '#C6D4EF', // secondary text on the navy timetable card
  onNavyPanel: 'rgba(255,255,255,0.06)',
  shadow: 'rgba(11,31,75,0.03)',
} as const;

/** Static font files bundled in assets/fonts (SIL Open Font License). */
export const FONT_ASSETS = {
  Outfit_600SemiBold: require('../../assets/fonts/Outfit_600SemiBold.ttf'),
  PlusJakartaSans_400Regular: require('../../assets/fonts/PlusJakartaSans_400Regular.ttf'),
  PlusJakartaSans_500Medium: require('../../assets/fonts/PlusJakartaSans_500Medium.ttf'),
  PlusJakartaSans_600SemiBold: require('../../assets/fonts/PlusJakartaSans_600SemiBold.ttf'),
  PlusJakartaSans_700Bold: require('../../assets/fonts/PlusJakartaSans_700Bold.ttf'),
};

export const FONT = {
  heading: 'Outfit_600SemiBold',
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
} as const;

/** Largest system font-size multiplier honored by this screen, so 9–11px labels stay inside their cards. */
export const MAX_FONT_SCALE = 1.3;
