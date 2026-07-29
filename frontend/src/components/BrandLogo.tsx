/**
 * The BrandCMD wordmark.
 *
 * Was duplicated verbatim in four files (landing, login, signup, dashboard
 * shell), each with its own hardcoded colours. One copy, tokenised.
 */
export function BrandLogo({ size = 24 }: { size?: number }) {
  return (
    <div className="flex items-center gap-2">
      <svg
        width={size}
        height={size}
        viewBox="0 0 28 28"
        fill="none"
        aria-hidden="true"
      >
        <circle
          cx="14"
          cy="14"
          r="12.5"
          stroke="var(--brand)"
          strokeWidth="1.5"
        />
        <path
          d="M14 5.5C14 5.5 8.5 8.5 8.5 14.5C8.5 18.2 11 20.5 14 20.5C17 20.5 19.5 18.2 19.5 14.5C19.5 8.5 14 5.5 14 5.5Z"
          fill="var(--surface-2)"
          stroke="var(--brand-dim)"
          strokeWidth="0.8"
        />
        <path
          d="M8.5 14.5H11L12.5 11.5L15 17.5L16.5 14.5H19.5"
          stroke="white"
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className="font-bold tracking-wide"
        style={{ fontSize: size < 26 ? "14px" : "16px" }}
      >
        BRAND<span className="text-brand">CMD</span>
      </span>
    </div>
  );
}
