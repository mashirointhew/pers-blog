import rawSettings from '../data/site-settings.json';

export type SiteSettings = typeof rawSettings;
export const siteSettings: SiteSettings = rawSettings;

export function themeStyle(settings: SiteSettings) {
  const entries: string[] = [];
  for (const mode of ['dark', 'light'] as const) {
    const values = settings.theme[mode];
    for (const key of ['paper', 'ink', 'muted', 'line', 'accent', 'wash', 'surface'] as const) {
      entries.push(`--${mode}-${key}:${values[key]}`);
    }
  }

  entries.push(
    `--font-sans:${JSON.stringify(settings.theme.fonts.sans)}`,
    `--font-serif:${JSON.stringify(settings.theme.fonts.serif)}`,
    `--font-mono:${JSON.stringify(settings.theme.fonts.mono)}`,
    `--layout-shell:${settings.theme.layout.shellWidthRem}rem`,
    `--layout-section:${settings.theme.layout.sectionWidthRem}rem`,
    `--layout-article:${settings.theme.layout.articleWidthRem}rem`,
    `--layout-detail:${settings.theme.layout.detailWidthRem}rem`,
    `--layout-sidebar:${settings.theme.layout.sidebarWidthRem}rem`,
    `--layout-home-sidebar:${settings.theme.layout.homeSidebarWidthRem}rem`,
    `--layout-gap:${settings.theme.layout.pageGapRem}rem`,
    `--layout-section-gap:${settings.theme.layout.sectionGapRem}rem`,
  );

  return entries.join(';');
}
