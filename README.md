# Booru Enhancer Extended

Unofficial MIT-licensed fork of **Booru Enhancer 1.2.7** by **itachi-re**.

This fork preserves practical compatibility fixes and quality-of-life improvements developed while using the script on **Rule34.xxx** and **e621/e926**.

## Status

- **Actively tested:** Rule34.xxx, e621/e926
- **Retained from upstream but not comprehensively retested here:** other sites/adapters already supported by Booru Enhancer 1.2.7
- No guarantee is made that every upstream-supported site remains compatible after site or browser changes.

## Extended changes

- Rule34.xxx metadata is loaded on demand for the item being hovered or opened, reducing background gallery requests.
- Video previews/viewer show loading, buffering, and failure states when needed.

- Rule34.xxx gallery-container and layout fixes.
- Current e621/e926 thumbnail markup support.
- Thumbnail-size and fixed-column controls that stay within the viewport.
- Responsive image/video hover previews.
- Immediate low-resolution hover feedback followed by high-resolution replacement when ready.
- Current-hover media prioritization and stale-hover cancellation where practical.
- Muted autoplay video in hover previews.
- Native tag/text hover overlays suppressed on enhanced Rule34.xxx and e621/e926 thumbnails.
- More reliable metadata enrichment and retry behavior, including infinite-scroll additions.

## Install

Install `Booru_Enhancer.user.js` with a userscript manager such as Tampermonkey or Violentmonkey.

The userscript update metadata points to this repository's `main` branch.

## Scope

This is a compatibility fork, not a commitment to maintain every supported booru indefinitely. Changes are driven primarily by behavior observed on the sites actually tested above.

## Upstream

Original project: **Booru Enhancer** by **itachi-re**, version 1.2.7.

The upstream userscript declares the **MIT License**. This repository preserves upstream attribution and identifies fork-specific changes separately.

## Maintainer

**ChadChan3D**  
Project site: https://chadchan3d.com/category/assets/
