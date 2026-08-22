# Contract: Internationalisation & Theming

**Location**: `src/context/LanguageThemeContext.tsx`, `src/index.css`,
`src/layouts/BaseLayout.astro` (post-migration).

## Provider API

```ts
type Language = 'es' | 'en';
type Theme    = 'dark' | 'light';

interface LanguageThemeContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  t: (key: string) => string;
}

useAppLanguageTheme(): LanguageThemeContextType   // throws outside the provider
```

The hook throwing outside a provider is intentional: it turns a missing provider into a
loud failure at mount rather than a silent English-only render.

## Rules

1. **Default language is Spanish**, default theme is dark. An unrecognised stored value
   falls back to the default rather than propagating.
2. **`t(key)` never throws.** A missing key returns the key itself, so a gap surfaces as a
   visible identifier (`spec.md` FR-009).
3. **Parity is mandatory.** A key added to one dictionary must be added to the other in the
   same change (Constitution II).
4. **Two legitimate text paths exist**: `t(key)` for shell chrome and short labels, and
   inline `lang === 'es' ? … : …` ternaries for long-form prose inside modules. Both are
   accepted; a third path (hard-coded single-language text) is a defect.
5. **Persistence keys** are `protspam_lang` and `protspam_theme`. They are stable public
   contract — renaming them silently resets every returning visitor's preferences.
6. **Theme application**: `theme === 'light'` adds `light-theme` and removes `dark` on
   `document.documentElement`; `theme === 'dark'` does the inverse. `index.css` keys its
   light overrides off `html.light-theme`.

## Prerender contract (introduced by the Astro migration)

Astro prerenders the island in Node, where `localStorage` does not exist and where the
server pass must produce markup identical to the first client render.

- **State initialisation must not read `localStorage`.** The provider seeds the documented
  defaults and reconciles with storage inside `useEffect`, after mount.
- **The visible flash this would cause is prevented before React runs.** An inline script
  in `<head>` reads the same two keys and applies the theme class and the `lang` attribute
  before first paint.
- **The boot script and the React effect must enforce the same contract.** They read the
  same keys, apply the same class names, and use the same fallbacks. Changing one without
  the other reintroduces the flash or, worse, a hydration mismatch.
- **Storage access must be defensive.** Private-browsing modes and blocked site data make
  `localStorage` access throw; reads and writes are wrapped so a failure degrades to
  defaults instead of breaking the page.
