# Research source corpus — 2026-09-25

Third-party projects remain legally and architecturally separate from the MIT master. This repository records roles, source references, and reuse constraints rather than vendoring unrelated source trees.

| Source | Research role | Reuse posture |
|---|---|---|
| Booru Enhancer 1.2.7 — itachi-re | Original architectural base | MIT; retain attribution |
| Booru Enhancer Extended | Authoritative implementation baseline | MIT |
| Image Board Enhancer 1.5.20 | DOM-first media hints, badges, compact/native-state interactions | No license established in reviewed artifact; independently reimplement behavior |
| Eza's Gallery Swallower 2.46.21 | Cross-site extraction, request discipline, Rule34 media-resolution knowledge | Reviewed source declares MIT/public-domain terms; preserve applicable provenance |
| ppixiv r257 | Priority loading, coalescing/cancellation, Pixiv metadata/cache, multi-page/ugoira model | Mixed provenance; inspect exact file before adaptation |
| Pixiv Previewer 3.8.7 | Hover/multi-page/ugoira UX | GPLv3; behavior reference only |
| re621 1.5.64 | e621 interactions, fit cycling, filename vocabulary, migrations | GPL-3.0-only; behavior reference only |
| Pixiv Plus 0.9.5 | Pixiv originals, dimensions, downloads, filenames | GPL-3.0; behavior reference only |
| Pixiv Infinite Scroll 1.6.3 | Page-boundary/history synchronization | MIT; adaptation candidate |
| FurAffinity Features — Midori Dragon | Modular FurAffinity adapter; request cadence/concurrency/retry; preview/full lifecycle | MIT; audited at `290b31711b05ea9d0e888867c2ae72af8cfd569c` |
| Pixiv Downloader 2.3.1 | Secondary Pixiv retry/progress/filename evidence | GPL-3.0-only; behavior reference only |
| Eza's Image Glutton 1.47.2 | Broad high-resolution resolver knowledge and fail-closed navigation | Reviewed source declares MIT/public-domain terms; validate each site rule |
| Danbooru EX — evazion | Dedicated Danbooru preview/video interaction reference | MIT; pinned `f352096c1fcfab3b98771940166c920a6dcd1c4d` |
| ExHentai Enhancer 1.21.0 | Long-form reader; safe original upgrade/page tracking | MIT; pinned `bf3b286eff45abb77a00e4622563ce68862bc766` |
| eHunter 3.1.0 — Alex Chen / hanFengSan | Platform/reader separation, fallback sources, bounded spreads, partial batch results | MIT; audited at `43a0a13d356507a9724d58a9e0a71fb02ec08e8b` |
| Sad Panda variants | ExHentai access/session-friction context | Not implementation donors |

## Generalization rule

The important question is not whether a FurAffinity, Pixiv, or E-Hentai implementation runs unchanged elsewhere. It usually does not. Instead:

> **Generalize behavior and infrastructure; localize extraction, semantics, and actions.**

Examples:

- request scheduling is shared; per-site cadence and endpoints are adapter policy;
- viewer behavior is shared; preview/sample/original URL discovery is adapter logic;
- infinite/appended gallery lifecycle is shared; next-page parsing is site-specific;
- favorite/bookmark UI can be shared; tokens/endpoints/state semantics remain local;
- ordered multi-item media is shared; Pixiv ugoira, FurAffinity webcomic discovery, and E-Hentai alternate sources remain site capabilities.

Before copying nontrivial code, recheck the exact source file's license and provenance. GPL or unlicensed sources can establish useful behavior without supplying implementation text to the MIT master.
