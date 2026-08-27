interface RadialProgressProps {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color: string;
  trackColor?: string;
  label?: string;
}

const R = 45; // radius in the 0–100 viewBox this circle is drawn in
const CIRCUMFERENCE = 2 * Math.PI * R;

/** A ring gauge for "one percentage, make it feel like an instrument
 * reading" — used for today's attendance % instead of a flat progress bar.
 * The fill animates in via a CSS transition on `stroke-dashoffset` (see
 * .radial-progress-fill), so it sweeps into place on mount/update rather
 * than snapping. */
export function RadialProgress({
  percent,
  size = 96,
  strokeWidth = 9,
  color,
  trackColor = 'var(--color-surface-hover)',
  label,
}: RadialProgressProps) {
  const clamped = Math.max(0, Math.min(100, percent));
  const offset = CIRCUMFERENCE * (1 - clamped / 100);

  return (
    <div className="radial-progress" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <circle cx="50" cy="50" r={R} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          className="radial-progress-fill"
          cx="50"
          cy="50"
          r={R}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div className="radial-progress-center">
        <span className="radial-progress-value">{clamped}%</span>
        {label && <span className="radial-progress-label">{label}</span>}
      </div>
    </div>
  );
}
