type IconProps = { className?: string };

const common = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export function IconHome(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M4 11.5 12 4l8 7.5" />
      <path d="M6 10v9.5a1 1 0 0 0 1 1h3.5v-6h3v6H17a1 1 0 0 0 1-1V10" />
    </svg>
  );
}

export function IconMegaphone(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M3 10v4a1 1 0 0 0 1 1h2l2.5 5.5L11 19v-8" />
      <path d="M8 10 18 5v14L8 14" />
      <path d="M18 9.5a3 3 0 0 1 0 5" />
    </svg>
  );
}

export function IconSettings(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3.5v2.2M12 18.3v2.2M4.9 6.9l1.6 1.6M17.5 15.5l1.6 1.6M3.5 12h2.2M18.3 12h2.2M4.9 17.1l1.6-1.6M17.5 8.5l1.6-1.6" />
    </svg>
  );
}

export function IconUsersGroup(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 19c0-3 2.5-5.2 5.5-5.2s5.5 2.2 5.5 5.2" />
      <circle cx="17" cy="8.5" r="2.3" />
      <path d="M15.7 13.6c2.3.3 4.3 2.2 4.3 5.1" />
    </svg>
  );
}

export function IconAcademicCap(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M2.5 8.5 12 4l9.5 4.5L12 13 2.5 8.5Z" />
      <path d="M6.5 10.6v4.3c0 1.4 2.5 2.6 5.5 2.6s5.5-1.2 5.5-2.6v-4.3" />
      <path d="M21 9v6" />
    </svg>
  );
}

export function IconBriefcase(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" />
      <path d="M3.5 12.5h17" />
    </svg>
  );
}

export function IconGraduate(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="12" cy="8" r="3.2" />
      <path d="M5 19.5c0-3.4 3.13-6 7-6s7 2.6 7 6" />
    </svg>
  );
}

export function IconBookOpen(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" />
      <path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" />
    </svg>
  );
}

export function IconClipboardCheck(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V4" />
      <path d="M9 12.5l2 2 4-4.5" />
    </svg>
  );
}

export function IconHistory(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2" />
      <path d="M3 4v4.5h4.5" />
      <path d="M12 8v4.5l3 2" />
    </svg>
  );
}

export function IconUserCheck(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <circle cx="9.5" cy="8" r="3.2" />
      <path d="M3.5 19.5c0-3.4 2.7-6 6-6s6 2.6 6 6" />
      <path d="M16 11.5l1.6 1.6L21 9.5" />
    </svg>
  );
}

export function IconClipboardList(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <rect x="5" y="4.5" width="14" height="16" rx="2" />
      <path d="M9 4V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1V4" />
      <path d="M9 12h6M9 15.5h6M9 8.5h6" />
    </svg>
  );
}

export function IconShieldCheck(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M12 3.5 5 6.2v5.3c0 4.4 3 7 7 9 4-2 7-4.6 7-9V6.2L12 3.5Z" />
      <path d="M9.2 12.1l2 2 3.6-4.1" />
    </svg>
  );
}

export function IconNotebookPen(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M6 3.5h9.5A1.5 1.5 0 0 1 17 5v14a1.5 1.5 0 0 1-1.5 1.5H6a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 6 3.5Z" />
      <path d="M8 8h5.5M8 11.5h5.5" />
      <path d="M15.5 14.7 19 11.2l1.8 1.8-3.5 3.5-2.1.3.3-2.1Z" />
    </svg>
  );
}

export function IconChartBar(props: IconProps) {
  return (
    <svg {...common} {...props}>
      <path d="M4 20V4" />
      <path d="M4 20h16" />
      <rect x="7" y="13" width="3" height="7" rx="0.6" />
      <rect x="12.5" y="9" width="3" height="11" rx="0.6" />
      <rect x="17" y="6" width="3" height="14" rx="0.6" />
    </svg>
  );
}
