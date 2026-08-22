import React from 'react';
import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { colors, fonts } from '../theme';

export interface DonutSegment {
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
  centerLabel: string;
  centerSubLabel?: string;
}

const GAP_DEGREES = 3;

/** A ring chart built from one Circle per segment (stroke-dasharray trick) —
 * no charting library pulled in beyond react-native-svg, which is Expo Go
 * compatible unlike most RN chart packages. A small gap between segments is
 * a stand-in for the "2px surface gap" a stacked bar would use. */
export function DonutChart({
  segments,
  size = 148,
  strokeWidth = 18,
  centerLabel,
  centerSubLabel,
}: DonutChartProps): React.JSX.Element {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  let cursorDegrees = -90;
  const visibleSegments = segments.filter((s) => s.value > 0);

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colors.surfaceHover}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {total > 0 &&
          visibleSegments.map((segment, i) => {
            const fraction = segment.value / total;
            const gapCount = visibleSegments.length > 1 ? 1 : 0;
            const arcDegrees = fraction * 360 - GAP_DEGREES * gapCount;
            const dash = (Math.max(arcDegrees, 0) / 360) * circumference;
            const rotation = cursorDegrees;
            cursorDegrees += fraction * 360;
            return (
              <Circle
                key={i}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                stroke={segment.color}
                strokeWidth={strokeWidth}
                strokeDasharray={`${dash} ${circumference - dash}`}
                strokeLinecap="round"
                fill="none"
                rotation={rotation}
                origin={`${size / 2}, ${size / 2}`}
              />
            );
          })}
      </Svg>
      <Text style={{ fontSize: 22, fontFamily: fonts.headingBold, color: colors.text }}>{centerLabel}</Text>
      {centerSubLabel && (
        <Text style={{ fontSize: 12, fontFamily: fonts.body, color: colors.textMuted }}>{centerSubLabel}</Text>
      )}
    </View>
  );
}
