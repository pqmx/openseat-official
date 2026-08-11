import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/**
 * Every icon in `openseat v4.dc.html`, transcribed path-for-path.
 * Sizes default to the size the design renders them at.
 */
type IconProps = { size?: number; color: string };

export const FilterIcon = ({ size = 16, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <Path d="M2 5h14M4.5 9h9M7 13h4" strokeWidth={1.4} strokeLinecap="round" stroke={color} />
  </Svg>
);

export const HomeIcon = ({ size = 19, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path d="M3 8l8-4 8 4v10H3V8z" strokeWidth={1.4} strokeLinejoin="round" stroke={color} />
  </Svg>
);

export const ClockIcon = ({ size = 19, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Circle cx={11} cy={11} r={8} strokeWidth={1.4} stroke={color} />
    <Path d="M11 7v4l3 2" strokeWidth={1.4} strokeLinecap="round" stroke={color} />
  </Svg>
);

export const PlusIcon = ({ size = 18, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path d="M11 4v14M4 11h14" strokeWidth={1.8} strokeLinecap="round" stroke={color} />
  </Svg>
);

export const PersonIcon = ({ size = 19, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 22 22" fill="none">
    <Path
      d="M4 18c1.6-3.6 4-5.4 7-5.4S16.4 14.4 18 18"
      strokeWidth={1.4}
      strokeLinecap="round"
      stroke={color}
    />
    <Circle cx={11} cy={7} r={3.4} strokeWidth={1.4} stroke={color} />
  </Svg>
);

export const BackIcon = ({ size = 18, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <Path
      d="M11 4l-5 5 5 5"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      stroke={color}
    />
  </Svg>
);

export const MoreIcon = ({ size = 18, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 18 18" fill="none">
    <Circle cx={9} cy={4} r={1.2} fill={color} />
    <Circle cx={9} cy={9} r={1.2} fill={color} />
    <Circle cx={9} cy={14} r={1.2} fill={color} />
  </Svg>
);

export const LockIcon = ({ size = 13, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 14 14" fill="none">
    <Rect x={2.5} y={6} width={9} height={6} rx={1.4} strokeWidth={1.3} stroke={color} />
    <Path d="M4.6 6V4.4a2.4 2.4 0 014.8 0V6" strokeWidth={1.3} stroke={color} />
  </Svg>
);

export const PinIcon = ({ size = 14, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <Path d="M8 14s5-4.3 5-7.6A5 5 0 003 6.4C3 9.7 8 14 8 14z" strokeWidth={1.3} stroke={color} />
    <Circle cx={8} cy={6.3} r={1.4} fill={color} />
  </Svg>
);

export const MenuIcon = ({ size = 16, color }: IconProps) => (
  <Svg width={size} height={size} viewBox="0 0 19 19" fill="none">
    <Path d="M3 5.5h13M3 9.5h13M3 13.5h8" strokeWidth={1.4} strokeLinecap="round" stroke={color} />
  </Svg>
);

/**
 * The curling top-right corner on a "live" card. The design draws it with a
 * gradient-filled path plus a drop shadow; RN SVG has no `filter`, so the
 * shadow is dropped and the gradient carries the lift.
 */
export const PeelCorner = ({
  size = 28,
  surface,
  raised,
  hair,
  hair2,
  id,
}: {
  size?: number;
  surface: string;
  raised: string;
  hair: string;
  hair2: string;
  id: string;
}) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 44 44"
    style={{ position: 'absolute', top: -1, right: -1 }}>
    <Defs>
      <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
        <Stop offset="0" stopColor={raised} />
        <Stop offset="1" stopColor={hair2} />
      </LinearGradient>
    </Defs>
    <Path d="M1 1 L44 44 L44 0 Z" fill={surface} />
    <Path d="M1 1 L44 44" strokeWidth={1.4} stroke={hair} />
    <Path
      d="M1 1 C15 4 30 19 40 40 C25 33 9 17 1 1 Z"
      fill={`url(#${id})`}
      strokeWidth={1.4}
      strokeLinejoin="round"
      stroke={hair2}
    />
  </Svg>
);
