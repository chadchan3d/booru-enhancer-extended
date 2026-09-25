# Research snapshot — 2026-09-25

Booru Enhancer Extended is being evaluated as a restrained cross-site gallery enhancer. The design principle is simple:

> **The native gallery should feel better, not replaced.**

The research method is **user problem first**: identify a recurring browsing problem, compare the source projects that address that exact problem, synthesize the strongest behavior, then decide whether it belongs in Core, Core + Adapter Contract, Site-Specific behavior, or should be rejected.

## Strongest user problems

The research corpus most strongly supports these needs:

1. Larger, sharper, whole-image thumbnails instead of misleading crops.
2. Small factual indicators for video, GIF/animation, and multi-page works.
3. Hover previews with intentional delay, cache/coalescing, stale-target protection, and real cancellation where possible.
4. Request discipline so background work does not create stalls, rate limits, or wasted bandwidth.
5. Reliable video behavior with understandable loading/buffering/failure states, sane mute/autoplay, and remembered volume.
6. Remembering the user's place when opening media and returning to a long or appended gallery.
7. Multi-page work navigation where the source actually contains multiple media items.
8. Reliable downloads with useful filenames and clear partial-failure behavior.
9. Graceful degradation when a site changes: withdraw the broken enhancement and leave the native page usable.

## Preliminary best-in-class synthesis

### Grid and thumbnail presentation

Keep the current master's grid sizing/column behavior. Add a user-facing **Show whole image in thumbnails** option and restrained media/page-count badges. Prefer native DOM/data hints before extra requests.

**Home:** Core + Adapter Contract.

### Hover preview

Use Pixiv Previewer as an interaction reference, ppixiv for scheduling/coalescing/cancellation concepts, selected re621 trigger ideas, and the current master's thumbnail-first feedback. A hover should not fetch a huge original merely because the pointer crossed a card.

**Home:** Core + Adapter Contract.

### Request scheduling and failure recovery

The strongest combination is layered rather than winner-take-all:

- ppixiv: current-target priority, coalescing, cancellation, partial/full metadata ideas;
- FurAffinity Features: per-adapter concurrency/cadence, AbortSignal use, bounded retry and HTTP 429 handling;
- eHunter: ordered alternate-source fallback where a site supports it;
- ExHentai Enhancer: safe high-resolution upgrade lifecycle;
- Eza's tools: validated site-specific resolver knowledge;
- current master: in-flight deduplication and target-driven Rule34 metadata.

Shared scheduler/lifecycle belongs in Core. Site limits, URL resolution and source candidates belong in adapters.

### Viewer

Preserve the current viewer as the baseline. It already provides Fit to window / width / height / Original size and correct image/video element replacement. Extend it to consume an ordered `mediaItems[]` model instead of replacing it.

**Home:** Core.

### Remember my place

Generalize the useful history/page-boundary idea from Pixiv Infinite Scroll. Preserve query/page identity and enough position state that browser Back returns near the work the user left, including after appended pages.

**Home:** Core + Adapter Contract.

### Multi-page and long-form works

Do not falsely unify three different models:

- ordered media within one work, such as Pixiv manga;
- explicit long galleries, such as E-Hentai/nhentai;
- linked independent submissions, such as FurAffinity webcomics.

Generic ordered media can be Core. Discovery and special reader behavior remain adapter/site capabilities. Book/spread controls should only appear where sequential content warrants them.

### Native actions

Favorite/bookmark/vote convenience is useful only when it performs and reconciles the site's real action. Do not build a parallel shadow state.

**Home:** Core + Adapter Contract.

### Downloads

Keep ordinary single-item download excellent first. Use a conservative cross-site filename vocabulary, with adapters providing available metadata. Multi-page work downloads should preserve ordering and report partial failures cleanly. Do not let mass-download complexity dominate the browsing product.

**Home:** Core + Adapter Contract.

### Settings

Expose visible outcomes, not networking internals. Version the schema, migrate deliberately, remove dead settings, and hide unsupported site-specific controls.

**Home:** Core with capability-gated additions.

## Rejected directions

The research does not support turning the project into a replacement application, giant tagging/admin suite, premium-feature circumvention tool, ad blocker, autoplay-heavy preloader, universal mass downloader, or a settings panel that exposes request concurrency/source ordering.

## Architecture invariant

Every feature must be classified as:

- **Core** — truly site-independent machinery;
- **Core + Adapter Contract** — same user-visible behavior, local site knowledge underneath;
- **Site-Specific** — justified by one site's content/API model;
- **Reject** — wrong for this product.

The emerging architecture is therefore intentionally sophisticated underneath and restrained on the surface.
