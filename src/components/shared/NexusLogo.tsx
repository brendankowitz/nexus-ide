import { Fragment } from 'react';

interface NexusLogoProps {
  size?: number;
  light?: boolean;
}

const PROVIDER_COLORS = ['#d97757', '#7c8cff', '#10a37f', '#4a90ff', '#b87bff'];

export const NexusLogo = ({ size = 20, light = false }: NexusLogoProps): React.JSX.Element => {
  const pad = size * 0.22;
  const sw = size * 0.14;
  const cornerR = size * 0.225;
  const ink = light ? '#1a1a17' : '#f4ede0';
  const left = pad;
  const right = size - pad;
  const top = pad;
  const bot = size - pad;
  const x1 = left + sw / 2;
  const y1 = top + sw / 2;
  const x2 = right - sw / 2;
  const y2 = bot - sw / 2;
  const gradId = `nxg-${size}-${light ? 'l' : 'd'}`;
  const clipId = `nxc-${size}-${light ? 'l' : 'd'}`;
  const n = PROVIDER_COLORS.length;

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="Nexus"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          gradientUnits="userSpaceOnUse"
        >
          {PROVIDER_COLORS.map((color, i) => (
            <Fragment key={i}>
              <stop offset={`${(i / n) * 100}%`} stopColor={color} />
              <stop offset={`${((i + 1) / n) * 100}%`} stopColor={color} />
            </Fragment>
          ))}
        </linearGradient>
        <clipPath id={clipId}>
          <rect width={size} height={size} rx={cornerR} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Background */}
        <rect width={size} height={size} fill={light ? '#f5f1e8' : '#1a1d22'} />
        {/* Left vertical */}
        <rect x={left} y={top} width={sw} height={bot - top} fill={ink} rx={sw * 0.18} />
        {/* Right vertical */}
        <rect x={right - sw} y={top} width={sw} height={bot - top} fill={ink} rx={sw * 0.18} />
        {/* Diagonal with provider-weave gradient */}
        <line
          x1={x1} y1={y1} x2={x2} y2={y2}
          stroke={`url(#${gradId})`}
          strokeWidth={sw}
          strokeLinecap="butt"
        />
        {/* Weave overlay — upper-left segment of left vertical in front */}
        <rect x={left} y={top} width={sw} height={(bot - top) * 0.42} fill={ink} rx={sw * 0.18} />
        {/* Weave overlay — lower-right segment of right vertical in front */}
        <rect
          x={right - sw}
          y={top + (bot - top) * 0.58}
          width={sw}
          height={(bot - top) * 0.42}
          fill={ink}
          rx={sw * 0.18}
        />
      </g>
    </svg>
  );
};
