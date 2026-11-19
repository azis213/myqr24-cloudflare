import type { SVGProps } from "react";

/** Kleine, Word-nahe Symbole. Alle zeichnen mit `currentColor`, damit sie der Leiste folgen. */
const base = (props: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({
  width: 16,
  height: 16,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: "false",
  ...props,
});

export const IconAlignLeft = () => (
  <svg {...base({})}>
    <path d="M4 6h16M4 10h10M4 14h16M4 18h8" />
  </svg>
);

export const IconAlignCenter = () => (
  <svg {...base({})}>
    <path d="M4 6h16M7 10h10M4 14h16M8 18h8" />
  </svg>
);

export const IconAlignRight = () => (
  <svg {...base({})}>
    <path d="M4 6h16M10 10h10M4 14h16M12 18h8" />
  </svg>
);

export const IconBulletList = () => (
  <svg {...base({})}>
    <circle cx="5" cy="7" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none" />
    <circle cx="5" cy="17" r="1.4" fill="currentColor" stroke="none" />
    <path d="M9 7h11M9 12h11M9 17h11" />
  </svg>
);

export const IconOrderedList = () => (
  <svg {...base({})}>
    <path d="M10 7h10M10 12h10M10 17h10" />
    <path d="M4 5.5h1.2V9M3.6 9h2.2M3.6 12.4h2.2l-2.2 2.2h2.2M3.7 17.2c0-.7.5-1.2 1.2-1.2s1.2.5 1.2 1.2c0 1.1-2.4 1.3-2.4 3.2h2.4" />
  </svg>
);

export const IconIndentIncrease = () => (
  <svg {...base({})}>
    <path d="M4 6h16M10 10h10M10 14h10M4 18h16M6 12l4-3v6z" />
  </svg>
);

export const IconIndentDecrease = () => (
  <svg {...base({})}>
    <path d="M4 6h16M10 10h10M10 14h10M4 18h16M10 12l-4-3v6z" />
  </svg>
);

export const IconLineSpacing = () => (
  <svg {...base({})}>
    <path d="M4 6h9M4 10h9M4 14h9M4 18h9M19 5v14M19 5l-2 2M19 5l2 2M19 19l-2-2M19 19l2-2" />
  </svg>
);

export const IconHighlighter = () => (
  <svg {...base({})}>
    <path d="M5 15.5 12 8.5l3.5 3.5-7 7H5z" />
    <path d="M13.5 7 16 4.5a2 2 0 0 1 2.8 0l.7.7a2 2 0 0 1 0 2.8L17 10.5z" />
    <path d="M4 21h16" />
  </svg>
);

export const IconBucket = () => (
  <svg {...base({})}>
    <path d="M5.5 11.5 12 5l6.5 6.5-6.5 6.5z" />
    <path d="M9.5 7.5 8 6a2 2 0 0 1 2.8-2.8l1.6 1.6" />
    <path d="M20 16.5c0 1.1-.9 2-2 2s-2-.9-2-2 2-3.5 2-3.5 2 2.4 2 3.5z" />
  </svg>
);

export const IconTextColor = () => (
  <svg {...base({})}>
    <path d="M5 17 10.5 5h3L19 17M7.5 13h9" />
  </svg>
);

export const IconLink = () => (
  <svg {...base({})}>
    <path d="M10 14a4 4 0 0 1 0-5.7l2.3-2.3a4 4 0 1 1 5.7 5.7L16.7 13" />
    <path d="M14 10a4 4 0 0 1 0 5.7l-2.3 2.3a4 4 0 1 1-5.7-5.7L7.3 11" />
  </svg>
);

export const IconUnlink = () => (
  <svg {...base({})}>
    <path d="M9.5 13.4a4 4 0 0 1-.4-5.4l2.3-2.3a4 4 0 0 1 5.7 5.7L15.7 12" />
    <path d="M14.5 10.6a4 4 0 0 1 .4 5.4l-2.3 2.3a4 4 0 0 1-5.7-5.7L8.3 12" />
    <path d="M4 4l16 16" />
  </svg>
);

export const IconClear = () => (
  <svg {...base({})}>
    <path d="M6 17 15.5 7.5a2.5 2.5 0 0 1 3.5 3.5L10.5 20H7z" />
    <path d="M12 20h9" />
  </svg>
);

export const IconTable = () => (
  <svg {...base({})}>
    <rect x="3.5" y="5" width="17" height="14" rx="1.5" />
    <path d="M3.5 9.5h17M3.5 14.5h17M9.5 5v14M15 5v14" />
  </svg>
);

export const IconGrid = () => (
  <svg {...base({})}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
    <path d="M3.5 9h17M3.5 15h17M9 3.5v17M15 3.5v17" />
  </svg>
);

export const IconChevronDown = () => (
  <svg {...base({ width: 12, height: 12 })}>
    <path d="M6 9l6 6 6-6" />
  </svg>
);

export const IconEraser = IconClear;
