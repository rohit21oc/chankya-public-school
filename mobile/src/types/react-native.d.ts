declare module 'react-native' {
  import * as React from 'react';

  export interface StyleProp<T> {
    [key: string]: any;
  }

  export interface ViewStyle {
    flex?: number;
    flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';
    justifyContent?: 'flex-start' | 'flex-end' | 'center' | 'space-between' | 'space-around' | 'space-evenly';
    alignItems?: 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    alignSelf?: 'auto' | 'flex-start' | 'flex-end' | 'center' | 'stretch' | 'baseline';
    padding?: number;
    paddingHorizontal?: number;
    paddingVertical?: number;
    paddingTop?: number;
    paddingBottom?: number;
    paddingLeft?: number;
    paddingRight?: number;
    margin?: number;
    marginHorizontal?: number;
    marginVertical?: number;
    marginTop?: number;
    marginBottom?: number;
    marginLeft?: number;
    marginRight?: number;
    backgroundColor?: string;
    borderRadius?: number;
    borderTopLeftRadius?: number;
    borderTopRightRadius?: number;
    borderBottomLeftRadius?: number;
    borderBottomRightRadius?: number;
    borderWidth?: number;
    borderTopWidth?: number;
    borderBottomWidth?: number;
    borderColor?: string;
    width?: number | string;
    height?: number | string;
    minHeight?: number | string;
    maxHeight?: number | string;
    minWidth?: number | string;
    maxWidth?: number | string;
    position?: 'absolute' | 'relative';
    top?: number | string;
    bottom?: number | string;
    left?: number | string;
    right?: number | string;
    zIndex?: number;
    overflow?: 'visible' | 'hidden' | 'scroll';
    opacity?: number;
    elevation?: number;
    shadowColor?: string;
    shadowOffset?: { width: number; height: number };
    flexGrow?: number;
    flexShrink?: number;
    flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';
    borderLeftWidth?: number;
    borderRightWidth?: number;
    borderTopColor?: string;
    borderBottomColor?: string;
    borderLeftColor?: string;
    borderRightColor?: string;
    gap?: number;
    rowGap?: number;
    columnGap?: number;
    transform?: any[];
    [key: string]: any;
    display?: 'none' | 'flex';
  }

  export interface TextStyle extends ViewStyle {
    color?: string;
    fontSize?: number;
    fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900';
    fontFamily?: string;
    textAlign?: 'auto' | 'left' | 'right' | 'center' | 'justify';
    lineHeight?: number;
    textDecorationLine?: 'none' | 'underline' | 'line-through' | 'underline line-through';
    textTransform?: 'none' | 'capitalize' | 'uppercase' | 'lowercase';
    letterSpacing?: number;
  }

  export interface ImageStyle extends ViewStyle {
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    tintColor?: string;
  }

  export type NamedStyles<T> = { [P in keyof T]: ViewStyle | TextStyle | ImageStyle };

  export const StyleSheet: {
    create<T extends NamedStyles<T> | NamedStyles<any>>(styles: T | NamedStyles<T>): T;
    absoluteFill: ViewStyle;
    absoluteFillObject: ViewStyle;
    hairlineWidth: number;
  };

  export interface ViewProps {
    onLayout?: (e: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
    style?: StyleProp<ViewStyle>;
    children?: React.ReactNode;
    key?: React.Key;
    accessibilityLabel?: string;
    accessibilityRole?: string;

    accessible?: boolean;
    importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
    pointerEvents?: 'auto' | 'none' | 'box-none' | 'box-only';
    collapsable?: boolean;
    accessibilityLiveRegion?: 'none' | 'polite' | 'assertive';
  }
  export interface View { measureInWindow(cb: (x: number, y: number, width: number, height: number) => void): void }
  export const View: React.ForwardRefExoticComponent<ViewProps & React.RefAttributes<View>>;

  export interface TextProps {
    adjustsFontSizeToFit?: boolean;
    style?: StyleProp<TextStyle>;
    numberOfLines?: number;
    ellipsizeMode?: 'head' | 'middle' | 'tail' | 'clip';
    accessibilityLabel?: string;

    accessibilityRole?: string;
    allowFontScaling?: boolean;
    maxFontSizeMultiplier?: number;

    children?: React.ReactNode;
    key?: React.Key;
  }
  export const Text: React.FC<TextProps>;

  export interface TextInputProps {
    style?: StyleProp<TextStyle>;
    value?: string;
    onChangeText?: (text: string) => void;
    placeholder?: string;
    placeholderTextColor?: string;
    secureTextEntry?: boolean;
    keyboardType?: 'default' | 'email-address' | 'numeric' | 'phone-pad' | 'number-pad';
    autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
    autoCorrect?: boolean;
    editable?: boolean;
    maxLength?: number;
    multiline?: boolean;
    returnKeyType?: 'done' | 'go' | 'next' | 'search' | 'send';
    onSubmitEditing?: () => void;
    onFocus?: () => void;
    onBlur?: () => void;
    accessibilityLabel?: string;
    autoFocus?: boolean;
  }
  export interface TextInputRef {
    measureLayout(relativeTo: any, onSuccess: (x: number, y: number, w: number, h: number) => void, onFail?: () => void): void;
  }
  export const TextInput: React.FC<TextInputProps> & { State: { currentlyFocusedInput(): TextInputRef | null | undefined } };
  export function findNodeHandle(ref: any): number | null;

  export interface FlatListProps<T> {
    data: ArrayLike<T> | null | undefined;
    renderItem: (info: { item: T; index: number }) => React.ReactElement | null;
    keyExtractor?: (item: T, index: number) => string;
    contentContainerStyle?: StyleProp<ViewStyle>;
    refreshControl?: React.ReactElement;
    ListEmptyComponent?: React.ReactElement | null;
    ListHeaderComponent?: React.ReactElement | null;
    ListFooterComponent?: React.ReactElement | null;
    keyboardShouldPersistTaps?: "always" | "never" | "handled";
    inverted?: boolean;
    style?: StyleProp<ViewStyle>;
  }
  export const FlatList: <T>(props: FlatListProps<T>) => React.ReactElement;

  export interface TouchableOpacityProps extends ViewProps {
    onPressIn?: () => void;
    onPressOut?: () => void;
    onPress?: () => void;
    activeOpacity?: number;
    disabled?: boolean;
    accessibilityLabel?: string;
    accessibilityRole?: string;
    accessibilityState?: { selected?: boolean; disabled?: boolean; expanded?: boolean };
    hitSlop?: number | { top?: number; bottom?: number; left?: number; right?: number };
  }
  export const TouchableOpacity: React.FC<TouchableOpacityProps>;
  export const Pressable: React.FC<TouchableOpacityProps>;
  export interface SwitchProps extends ViewProps {
    value?: boolean;
    onValueChange?: (value: boolean) => void;
    disabled?: boolean;
    trackColor?: { true?: string; false?: string };
    thumbColor?: string;
  }
  export const Switch: React.FC<SwitchProps>;
  export const AccessibilityInfo: {
    isReduceMotionEnabled(): Promise<boolean>;
    announceForAccessibility(message: string): void;
  };
  export const Vibration: { vibrate(pattern?: number | number[]): void };
  export const Share: { share(content: { message: string; title?: string }, options?: { dialogTitle?: string; subject?: string }): Promise<{ action: string }>; sharedAction: string; dismissedAction: string };
  export const Linking: { openSettings(): Promise<void>; openURL(url: string): Promise<void> };
  export const AppState: { currentState: string; addEventListener(type: 'change', listener: (state: string) => void): { remove(): void } };

  export interface ScrollViewProps extends ViewProps {
    contentContainerStyle?: StyleProp<ViewStyle>;
    keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
    showsVerticalScrollIndicator?: boolean;
    showsHorizontalScrollIndicator?: boolean;
    horizontal?: boolean;
    refreshControl?: React.ReactElement;
    keyboardDismissMode?: 'none' | 'on-drag' | 'interactive';
    scrollEventThrottle?: number;
    onScroll?: (e: { nativeEvent: { contentOffset: { x: number; y: number } } }) => void;
    onLayout?: (e: { nativeEvent: { layout: { x: number; y: number; width: number; height: number } } }) => void;
  }
  export interface ScrollView { scrollTo(o: { x?: number; y?: number; animated?: boolean }): void }
  export const ScrollView: React.ForwardRefExoticComponent<ScrollViewProps & React.RefAttributes<ScrollView>>;

  export interface SafeAreaViewProps extends ViewProps {}
  export const SafeAreaView: React.FC<SafeAreaViewProps>;

  export interface KeyboardAvoidingViewProps extends ViewProps {
    behavior?: 'height' | 'position' | 'padding';
    keyboardVerticalOffset?: number;
  }
  export const KeyboardAvoidingView: React.FC<KeyboardAvoidingViewProps>;

  export interface ImageSourcePropType {
    uri?: string;
    [key: string]: any;
  }
  export interface ImageProps {
    source: ImageSourcePropType | number;
    style?: StyleProp<ImageStyle>;
    resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center';
    accessibilityLabel?: string;

    accessible?: boolean;
    importantForAccessibility?: 'auto' | 'yes' | 'no' | 'no-hide-descendants';
    onError?: () => void;

  }
  export const Image: React.FC<ImageProps>;

  export interface ActivityIndicatorProps extends ViewProps {
    size?: 'small' | 'large' | number;
    color?: string;
    animating?: boolean;
  }
  export const ActivityIndicator: React.FC<ActivityIndicatorProps>;

  export interface ModalProps {
    visible?: boolean;
    transparent?: boolean;
    animationType?: 'none' | 'slide' | 'fade';
    onRequestClose?: () => void;
    statusBarTranslucent?: boolean;
    navigationBarTranslucent?: boolean;
    children?: React.ReactNode;
  }
  export const Modal: React.FC<ModalProps>;

  export interface RefreshControlProps {
    refreshing: boolean;
    onRefresh?: () => void;
    tintColor?: string;
    colors?: string[];
  }
  export const RefreshControl: React.FC<RefreshControlProps>;

  export const Platform: {
    OS: 'ios' | 'android' | 'web';
    select<T>(specifics: { [platform in 'ios' | 'android' | 'web' | 'default']?: T }): T | undefined;
  };

  export const Alert: {
    alert(title: string, message?: string, buttons?: Array<{ text?: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive' }>): void;
  };

  export const Keyboard: {
    addListener(
      event: 'keyboardDidShow' | 'keyboardDidHide' | 'keyboardWillShow' | 'keyboardWillHide',
      cb: (e: { endCoordinates: { screenY: number; height: number } }) => void
    ): { remove(): void };
    dismiss(): void;
  };

  export const BackHandler: {
    addEventListener(
      eventName: 'hardwareBackPress',
      handler: () => boolean | null | undefined
    ): { remove(): void };
  };

  export namespace Animated {
    class Value {
      constructor(value: number);
      setValue(value: number): void;
      interpolate(config: { inputRange: number[]; outputRange: Array<number | string> }): any;
    }
    function timing(
      value: Value,
      config: { toValue: number; duration: number; useNativeDriver: boolean; delay?: number; easing?: (t: number) => number }
    ): { start(callback?: () => void): void };
    function spring(
      value: Value,
      config: { toValue: number; useNativeDriver: boolean; friction?: number; tension?: number }
    ): { start(callback?: () => void): void };
    function parallel(anims: Array<{ start(callback?: () => void): void }>): { start(callback?: () => void): void };
    function sequence(anims: Array<{ start(callback?: () => void): void }>): { start(callback?: () => void): void };
    type Anim = { start(callback?: () => void): void; stop(): void };
    function loop(anim: { start(callback?: () => void): void }): Anim;
    function delay(ms: number): Anim;
    function multiply(a: any, b: any): any;
    const View: React.FC<any>;
  }

  export const Easing: {
    out(fn: (t: number) => number): (t: number) => number;
    in(fn: (t: number) => number): (t: number) => number;
    inOut(fn: (t: number) => number): (t: number) => number;
    cubic: (t: number) => number;
    quad: (t: number) => number;
    ease: (t: number) => number;
  };

  export function useWindowDimensions(): { width: number; height: number; scale: number; fontScale: number };
  export const Dimensions: {
    get(dim: 'window' | 'screen'): { width: number; height: number; scale: number; fontScale: number };
  };
}

declare module 'expo-status-bar' {
  import * as React from 'react';
  export interface StatusBarProps {
    style?: 'auto' | 'inverted' | 'light' | 'dark';
    backgroundColor?: string;
    translucent?: boolean;
  }
  export const StatusBar: React.FC<StatusBarProps>;
}

declare module 'expo-font' {
  export function useFonts(map: Record<string, any>): [boolean, Error | null];
  export function loadAsync(map: Record<string, any>): Promise<void>;
}

declare module 'expo-asset' {
  export class Asset {
    static fromModule(moduleId: number | string): Asset;
  }
}

declare module 'expo' {
  export function registerRootComponent(component: React.ComponentType<any>): void;
}

declare module 'qrcode' {
  const QRCode: {
    create(
      text: string,
      options?: { errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H' }
    ): { modules: { size: number; data: ArrayLike<number> } };
  };
  export default QRCode;
}
