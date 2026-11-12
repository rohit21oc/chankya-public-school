import React from 'react';
import { Image } from 'react-native';

/**
 * Lucide icons exported from the Figma design, rasterized at 3x (assets/icons).
 * The PNGs are single-color with alpha, so the state color is applied via tintColor.
 */
const SOURCES = {
  bell: require('../../../assets/icons/bell.png'),
  grid: require('../../../assets/icons/grid.png'),
  clock: require('../../../assets/icons/clock.png'),
  chevron: require('../../../assets/icons/chevron.png'),
  clipboard: require('../../../assets/icons/clipboard.png'),
  notebook: require('../../../assets/icons/notebook.png'),
  users: require('../../../assets/icons/users.png'),
  calendar: require('../../../assets/icons/calendar.png'),
  house: require('../../../assets/icons/house.png'),
  user: require('../../../assets/icons/user.png'),
  // Added for the parent portal (Lucide, same export size and stroke).
  wallet: require('../../../assets/icons/wallet.png'),
  'graduation-cap': require('../../../assets/icons/graduation-cap.png'),
  'file-text': require('../../../assets/icons/file-text.png'),
  megaphone: require('../../../assets/icons/megaphone.png'),
  'book-open': require('../../../assets/icons/book-open.png'),
  'log-out': require('../../../assets/icons/log-out.png'),
  'chevron-left': require('../../../assets/icons/chevron-left.png'),
  'refresh-cw': require('../../../assets/icons/refresh-cw.png'),
  check: require('../../../assets/icons/check.png'),
  x: require('../../../assets/icons/x.png'),
  receipt: require('../../../assets/icons/receipt.png'),
  'id-card': require('../../../assets/icons/id-card.png'),
  'circle-alert': require('../../../assets/icons/circle-alert.png'),
  'message-circle': require('../../../assets/icons/message-circle.png'),
  phone: require('../../../assets/icons/phone.png'),
  // Added for the hostel warden portal.
  bed: require('../../../assets/icons/bed.png'),
  utensils: require('../../../assets/icons/utensils.png'),
  moon: require('../../../assets/icons/moon.png'),
  'triangle-alert': require('../../../assets/icons/triangle-alert.png'),
  search: require('../../../assets/icons/search.png'),
  'door-open': require('../../../assets/icons/door-open.png'),
  history: require('../../../assets/icons/history.png'),
};

export type IconName = keyof typeof SOURCES;

interface IconProps {
  name: IconName;
  size: number;
  color: string;
}

/** Decorative: the parent control carries the accessibility label. */
export const Icon: React.FC<IconProps> = ({ name, size, color }) => (
  <Image
    source={SOURCES[name]}
    style={{ width: size, height: size, tintColor: color }}
    resizeMode="contain"
    accessible={false}
    importantForAccessibility="no"
  />
);
