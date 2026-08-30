export interface VerdaMarkProps {
  size?: number;
  className?: string;
}

/**
 * VERDA mark — faceted leaf over circuit-trace roots.
 *
 * SWAP POINT: this is a hand-drawn reconstruction from the supplied
 * raster logo, built to prove the palette holds at UI scale. Replace
 * the <svg> body with the production artwork when it's available;
 * every consumer imports <VerdaMark /> by name, so nothing outside
 * this file needs to change.
 */
export function VerdaMark({ size = 40, className }: VerdaMarkProps) {
  return (
    <svg
      viewBox="0 0 200 300"
      width={size}
      height={(size * 300) / 200}
      className={className}
      role="img"
      aria-label="VERDA"
    >
      <defs>
        <clipPath id="verda-leaf-clip">
          <path d="M100 14 C132 48 160 78 160 108 C160 144 133 174 100 190 C67 174 40 144 40 108 C40 78 68 48 100 14 Z" />
        </clipPath>
      </defs>
      <g clipPath="url(#verda-leaf-clip)">
        <rect x="30" y="8" width="180" height="190" fill="#2F9463" />
        <polygon points="100,8 40,110 100,104" fill="#57B383" />
        <polygon points="100,8 168,110 100,104" fill="#3EA070" />
        <polygon points="100,104 40,110 100,196" fill="#1E7148" />
        <polygon points="100,104 168,110 100,196" fill="#134A33" />
        <polygon points="100,8 140,72 100,104" fill="#8FD4AC" opacity=".55" />
        <polygon points="100,104 152,120 100,196" fill="#0C3524" opacity=".35" />
      </g>
      <path
        d="M100 14 C132 48 160 78 160 108 C160 144 133 174 100 190 C67 174 40 144 40 108 C40 78 68 48 100 14 Z"
        fill="none"
        stroke="#0C3524"
        strokeWidth="2.5"
        opacity=".35"
      />
      <path
        d="M100 22 V186 M100 88 L146 104 M100 88 L54 104 M100 128 L138 140 M100 128 L62 140"
        fill="none"
        stroke="#EFF5F1"
        strokeWidth="2.6"
        strokeLinecap="round"
        opacity=".6"
      />
      <g fill="none" stroke="#237A52" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M100 190 V212" />
        <path d="M100 206 H68 V240" />
        <path d="M100 206 H132 V240" />
        <path d="M100 212 V252 H78" />
        <path d="M100 232 H126 V262" />
        <path d="M68 224 H44 V250" />
        <path d="M132 224 H158 V250" />
      </g>
      <g fill="#237A52">
        <circle cx="68" cy="248" r="7" />
        <circle cx="132" cy="248" r="7" />
        <circle cx="78" cy="252" r="6" />
        <circle cx="126" cy="270" r="6" />
        <circle cx="44" cy="258" r="6" />
        <circle cx="158" cy="258" r="6" />
      </g>
    </svg>
  );
}
