import React from 'react';
import { Text, TextProps } from 'react-native';
import { MAX_FONT_SCALE } from '../../theme/teacherHome';

/** Text with a bounded system font scale. Use for all teacher-home copy. */
export const T: React.FC<TextProps> = (props) => <Text maxFontSizeMultiplier={MAX_FONT_SCALE} {...props} />;
