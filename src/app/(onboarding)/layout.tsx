export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      className="flex min-h-screen flex-col items-center px-4 py-8"
      style={{ background: "#0A0A0C" }}
    >
      {/* Logo */}
      <div className="mb-8 flex items-center gap-2">
        <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
          <circle cx="14" cy="14" r="12.5" stroke="#8B9C3A" strokeWidth="1.5"/>
          <path d="M14 5.5C14 5.5 8.5 8.5 8.5 14.5C8.5 18.2 11 20.5 14 20.5C17 20.5 19.5 18.2 19.5 14.5C19.5 8.5 14 5.5 14 5.5Z" fill="#18181E" stroke="#4A5420" strokeWidth="0.8"/>
          <path d="M8.5 14.5H11L12.5 11.5L15 17.5L16.5 14.5H19.5" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontWeight: 700, letterSpacing: "0.5px", color: "#E8E8E8", fontSize: "16px" }}>
          BRAND<span style={{ color: "#8B9C3A" }}>CMD</span>
        </span>
      </div>

      <div className="w-full max-w-xl">{children}</div>
    </div>
  );
}
