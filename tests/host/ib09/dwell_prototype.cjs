'use strict';
// IB09 isolated E-stage dwell prototype. It is a text patch applied to the REAL
// production source inside the test harness only; Booru_Enhancer.user.js is not
// changed. It implements the frozen V2 decisions:
//   - V3 accepted: at pointer-enter the overlay may show only the card's
//     already-displayed rendition (showImmediateThumbnail, unchanged);
//   - zero new hover media loads and no hover metadata resolution before
//     dwell: the DOM-direct upgrade and the metadata path both run only in
//     afterDwell(), behind one timer (HOVER_DWELL_MS, the E-stage candidate);
//   - upgrade ordering follows the card's actual displayed rendition: on the
//     e621/e926 still-image pattern only a displayed PREVIEW may be upgraded,
//     and only to that card's native SAMPLE. A displayed SAMPLE or FILE gets no
//     hover upgrade (FILE is never replaced by SAMPLE). The gate sits in
//     upgradeWhenReady, so both triggers pass through it;
//   - leave cancels the dwell timer; the generation token still guards every
//     later step; a viewer opened before dwell suppresses the upgrade.
// Video and other hosts keep their current resolution behind the same dwell
// (IB10 and other hosts are out of scope).
function mustReplace(src, from, to) {
  const n = src.split(from).length - 1;
  if (n !== 1) throw new Error(`dwell prototype anchor matched ${n} times: ${from.slice(0, 70)}`);
  return src.replace(from, to);
}

function applyDwellPrototype(source, { dwellMs = 200 } = {}) {
  let s = source.replace(/\r\n/g, '\n');
  s = mustReplace(s, '\t\tlet stateTimer = null;\n',
    `\t\tlet stateTimer = null;\n\t\tlet dwellTimer = null; // IB09 prototype: one dwell authority per hover generation\n\t\tconst HOVER_DWELL_MS = ${Number(dwellMs)};\n`);

  // Eligibility: the displayed rendition decides; both upgrade triggers pass here.
  s = mustReplace(s, '\t\tfunction upgradeWhenReady(resolved, sourceImg, token) {\n\t\t\tif (!resolved?.url || token !== requestToken) return;\n',
    `\t\tfunction hoverUpgradeEligible(sourceImg, resolved) {
\t\t\tif (resolved.mediaType === 'video' || guessMediaType(resolved.url) === 'video') return true; // IB10 scope, unchanged
\t\t\tconst wrap = sourceImg.closest('.be-thumb-wrap');
\t\t\tif (BE.adapters.active?.id !== 'e621' || !wrap) return true; // other hosts: unchanged, still behind dwell
\t\t\tconst same = (a, b) => { try { return !!a && !!b && new URL(a, location.href).href === new URL(b, location.href).href; } catch { return false; } };
\t\t\tconst current = sourceImg.currentSrc || sourceImg.src || '';
\t\t\tconst showingPreview = same(current, wrap.dataset.previewUrl) || same(current, wrap.dataset.previewWebp);
\t\t\treturn showingPreview && same(resolved.url, wrap.dataset.sampleUrl) && !same(resolved.url, current);
\t\t}

\t\tfunction upgradeWhenReady(resolved, sourceImg, token) {
\t\t\tif (!resolved?.url || token !== requestToken) return;
\t\t\tif (!hoverUpgradeEligible(sourceImg, resolved)) { clearMediaState(); return; }
`);

  // show(): immediate overlay from the displayed rendition only; everything else after dwell.
  const start = s.indexOf('\t\tasync function show(img) {\n');
  const end = s.indexOf('\t\tfunction hide() {\n');
  if (start < 0 || end < 0 || end < start) throw new Error('dwell prototype: show()/hide() anchors not found');
  const show = `\t\tasync function show(img) {
\t\t\tif (!hoverEl) init();

\t\t\tconst token = ++requestToken;
\t\t\tactiveUpgradeUrl = '';
\t\t\tclearMediaState();
\t\t\tcancelPendingUpgrade();
\t\t\tclearTimeout(dwellTimer);

\t\t\t// V3: instant overlay from the already-displayed card rendition (no new media source).
\t\t\tshowImmediateThumbnail(img, token);

\t\t\t// Every new or costly step waits for dwell, behind one timer.
\t\t\tdwellTimer = setTimeout(() => { dwellTimer = null; afterDwell(img, token); }, HOVER_DWELL_MS);
\t\t}

\t\tasync function afterDwell(img, token) {
\t\t\tif (token !== requestToken) return;
\t\t\tif (BE.modules.viewer?.isOpen?.()) return; // the viewer took over before dwell: no hover upgrade

\t\t\tconst direct = directUpgradeFromDom(img);
\t\t\tif (direct?.url) upgradeWhenReady(direct, img, token);

\t\t\tconst postId =
\t\t\t\timg.dataset.bePostId ||
\t\t\t\tBE.adapters.active?.getThumbPostId?.(img);

\t\t\tif (!postId || !BE.adapters.active) return;

\t\t\ttry {
\t\t\t\tlet post = BE.modules.gallery?.getCachedPost?.(postId) || null;
\t\t\t\tif (!post && /(^|\\.)rule34\\.xxx$/.test(location.hostname)) {
\t\t\t\t\tshowMediaState('Loading preview…', token, 220);
\t\t\t\t}
\t\t\t\tif (!post) {
\t\t\t\t\tif (BE.modules.gallery?.enrichSinglePost) {
\t\t\t\t\t\tpost = await BE.modules.gallery.enrichSinglePost(postId);
\t\t\t\t\t} else if (typeof BE.adapters.active.fetchPost === 'function') {
\t\t\t\t\t\tpost = await BE.adapters.active.fetchPost(postId);
\t\t\t\t\t}
\t\t\t\t}

\t\t\t\tif (!post || token !== requestToken) {
\t\t\t\t\tif (token === requestToken) clearMediaState();
\t\t\t\t\treturn;
\t\t\t\t}
\t\t\t\tconst resolved = mediaFromPost(post);
\t\t\t\tif (resolved?.url) upgradeWhenReady(resolved, img, token);
\t\t\t\telse clearMediaState();
\t\t\t} catch (err) {
\t\t\t\tif (token === requestToken) clearMediaState();
\t\t\t\tBE.log.debug('[Hover] metadata fetch failed; keeping immediate thumbnail preview', err);
\t\t\t}
\t\t}

`;
  s = s.slice(0, start) + show + s.slice(end);
  s = mustReplace(s, '\t\tfunction hide() {\n\t\t\trequestToken++;\n', '\t\tfunction hide() {\n\t\t\tclearTimeout(dwellTimer);\n\t\t\tdwellTimer = null;\n\t\t\trequestToken++;\n');
  return s;
}

module.exports = { applyDwellPrototype, mustReplace };
