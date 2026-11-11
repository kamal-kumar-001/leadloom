/**
 * Marketing layout. The landing is light by default (Kamal, 2026-11-10):
 * force the light theme for this segment only, without touching the user's
 * stored dashboard preference. The inline script runs before first paint on
 * direct loads; the page component repeats it on client-side mounts and
 * restores the stored theme on unmount. `data-theme-lock` tells the shared
 * ThemeProvider not to re-apply the stored theme while this segment is shown.
 */
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html:
            "(function(){try{var h=document.documentElement;h.setAttribute('data-theme-lock','marketing');h.setAttribute('data-theme','light');h.classList.remove('dark');}catch(e){}})();",
        }}
      />
      {children}
    </>
  );
}
