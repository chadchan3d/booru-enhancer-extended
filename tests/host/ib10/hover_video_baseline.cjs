'use strict';
// IB10 E-stage baseline: characterization of the CURRENT production hover-video
// lifecycle (Booru_Enhancer.user.js at b9d133c / blob 22e843c; no production
// change). Reuses the IB09 fake-clock hover harness with e621/e926 listing
// cards turned into video posts (native data-file-ext webm/mp4 and a video
// data-file-url). Every <video> created by production is recorded: owner
// (hover upgradeWhenReady / viewer buildMedia, from the call stack), creation
// time and generation, src assignments (slot class only, no URLs), src
// removal, load / pause / play calls, muted state, attachment. Readiness
// (loadeddata) and late events are fired by the test; nothing fetches.
// The checks assert the observed CURRENT behavior (a regression oracle for the
// IB10 P stage). Fault-control mutants of production must each change an
// observation; two positive controls prove the defect detectors can see a fix.
// t = ms since the first pointer-enter. Requires `npm install` in tests/host/ib07.
const fs = require('fs');
const path = require('path');
const hh = require('../ib09/hover_harness.cjs');
const { mustReplace } = require('../ib09/dwell_prototype.cjs');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));

const PROD = h.productionSource();
const EXPECTED_BLOB = '22e843cbe27662fc27d17149534b055d7a249dae';
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 600) });

// ---- video-card fixture and media recorder (installed before production runs) ----
function videoSetup(ext) {
  return (w) => {
    for (const a of w.document.querySelectorAll('article')) {
      a.setAttribute('data-file-ext', ext);
      a.setAttribute('data-file-url', a.getAttribute('data-file-url').replace(/\.png$/, `.${ext}`));
    }
    let seq = 0;
    const V = []; w.__videos = V;
    w.__now = () => 0; w.__gen = () => 0; w.__slot = () => 'UNKNOWN';
    const ce = w.document.createElement.bind(w.document);
    w.document.createElement = function createElement(tag, ...a) {
      const el = ce(tag, ...a);
      if (String(tag).toLowerCase() === 'video') {
        const st = String(new Error().stack);
        el.__rec = { idx: V.length, owner: st.includes('upgradeWhenReady') ? 'hover' : (st.includes('buildMedia') ? 'viewer' : 'other'),
          gen: w.__gen(), createdT: w.__now(), srcSets: [], srcRemoved: [], loads: [], pauses: [], plays: [], readyState: 0 };
        V.push(el);
      }
      return el;
    };
    const MP = w.HTMLMediaElement.prototype;
    const srcDesc = Object.getOwnPropertyDescriptor(MP, 'src');
    Object.defineProperty(MP, 'src', { configurable: true, get() { return srcDesc.get.call(this); }, set(v) {
      if (this.__rec) this.__rec.srcSets.push({ t: w.__now(), gen: w.__gen(), slot: w.__slot(String(v)), mutedAtAssign: this.muted, seq: ++seq });
      srcDesc.set.call(this, v);
    } });
    const ra = w.Element.prototype.removeAttribute;
    w.Element.prototype.removeAttribute = function removeAttribute(n) { if (this.__rec && n === 'src') this.__rec.srcRemoved.push({ t: w.__now(), seq: ++seq }); return ra.call(this, n); };
    const [load, pause, play] = [MP.load, MP.pause, MP.play];
    MP.load = function () { if (this.__rec) this.__rec.loads.push({ t: w.__now(), seq: ++seq }); return load.call(this); };
    MP.pause = function () { if (this.__rec) this.__rec.pauses.push({ t: w.__now(), seq: ++seq }); return pause.call(this); };
    MP.play = function () { if (this.__rec) this.__rec.plays.push({ t: w.__now(), seq: ++seq, muted: this.muted }); return play.call(this); };
    Object.defineProperty(MP, 'readyState', { configurable: true, get() { return this.__rec ? this.__rec.readyState : 0; } });
  };
}

async function session(source, host, ext = 'webm') {
  const s = await hh.session({ host, quality: 'preview', source, n: 3, extraSetup: videoSetup(ext) });
  const w = s.w;
  w.__now = () => s.clock.now() - s.rec.t0;
  w.__gen = () => s.rec.shows;
  w.__slot = (u) => hh.classifySlot(u, s.rec.focusCard, w.location.href);
  s.startAt();
  const V = () => w.__videos;
  const hoverV = () => V().filter((v) => v.__rec.owner === 'hover');
  const last = (xs) => (xs.length ? xs[xs.length - 1].seq : 0);
  const holdsSource = (v) => v.hasAttribute('src') && v.getAttribute('src') !== '';
  const playing = (v) => last(v.__rec.plays) > last(v.__rec.pauses);
  const inHover = (v) => v.isConnected && !!v.closest('#be-hover-preview');
  return Object.assign(s, {
    V, hoverV, holdsSource, playing, inHover,
    async ready(v, at = null) { v.__rec.readyState = 2; v.dispatchEvent(new w.Event('loadeddata')); await s.clock.advance(0); },
    async fire(v, name) { v.dispatchEvent(new w.Event(name)); await s.clock.advance(0); },
    async openViewerByClick(i) { await s.click(i); },
    snapshot() {
      return hoverV().map((v) => ({ gen: v.__rec.gen, createdT: v.__rec.createdT, srcSets: v.__rec.srcSets.map(({ t, gen, slot, mutedAtAssign }) => ({ t, gen, slot, mutedAtAssign })),
        srcRemovedT: v.__rec.srcRemoved.map((x) => x.t), loadsT: v.__rec.loads.map((x) => x.t), pausesT: v.__rec.pauses.map((x) => x.t), playsT: v.__rec.plays.map((x) => x.t),
        mutedAtPlay: v.__rec.plays.map((x) => x.muted), muted: v.muted, defaultMuted: v.defaultMuted, autoplay: v.autoplay, loop: v.loop, preload: v.preload, playsInline: v.playsInline,
        holdsSource: holdsSource(v), playing: playing(v), inHover: inHover(v), connected: v.isConnected }));
    },
  });
}

// ---- scenarios ----
const SCEN = {
  // S1 sustained hover, no readiness yet
  S1: async (s) => { await s.enter(0); await s.wait(300); return {}; },
  // S2 40 ms sweep (leave before readiness)
  S2: async (s) => { await s.enter(0); await s.wait(40); await s.leave(0); await s.wait(300); return {}; },
  // S3 leave before readiness, then late loadeddata/playing/canplay on the released element
  S3: async (s) => { await s.enter(0); await s.wait(100); await s.leave(0); await s.wait(50); const v = s.hoverV()[0]; await s.ready(v); await s.fire(v, 'playing'); await s.fire(v, 'canplay'); await s.wait(200); return { hoverVisible: s.hoverVisible() }; },
  // S4 leave after loadeddata, then late events on the detached element
  S4: async (s) => {
    await s.enter(0); await s.wait(50); const v = s.hoverV()[0]; await s.ready(v);
    const installed = s.inHover(v); const playingAfterReady = s.playing(v);
    await s.wait(250); await s.leave(0); await s.wait(50);
    for (const e of ['playing', 'waiting', 'stalled', 'canplay', 'loadeddata', 'error']) await s.fire(v, e);
    await s.wait(200);
    const el = s.w.document.querySelector('#be-hover-preview');
    return { installed, playingAfterReady, hoverVisible: s.hoverVisible(), hoverChildren: el ? el.childElementCount : 0 };
  },
  // S5 five leave/re-enter cycles, each after readiness
  S5: async (s) => {
    let maxHolding = 0;
    for (let k = 0; k < 5; k++) { await s.enter(0); await s.wait(50); const v = s.hoverV()[k]; if (v) await s.ready(v); await s.wait(250); await s.leave(0); maxHolding = Math.max(maxHolding, s.hoverV().filter(s.holdsSource).length); await s.wait(50); }
    await s.wait(300);
    return { maxHolding };
  },
  // S6 five leave/re-enter cycles, each before readiness
  S6: async (s) => { for (let k = 0; k < 5; k++) { await s.enter(0); await s.wait(40); await s.leave(0); await s.wait(20); } await s.wait(300); return {}; },
  // S7 re-entry: generation 1 becomes ready after generation 2 started
  S7: async (s) => {
    await s.enter(0); await s.wait(40); await s.leave(0); await s.wait(20); await s.enter(0); await s.wait(20);
    const [g1, g2] = s.hoverV(); await s.ready(g1); const g1Installed = s.inHover(g1);
    await s.wait(20); await s.ready(g2); await s.wait(100);
    return { g1Installed, g2Installed: s.inHover(g2) };
  },
  // S8 card A ready, then move to card B: concurrent source-holding hover videos
  S8: async (s) => { await s.enter(0); await s.wait(50); await s.ready(s.hoverV()[0]); await s.wait(250); await s.leave(0); await s.enter(1); await s.wait(20); return { holdingWhileB: s.hoverV().filter(s.holdsSource).length }; },
  // S9 viewer takeover after readiness, then viewer close, then leave
  S9: async (s) => {
    await s.enter(0); await s.wait(50); const v = s.hoverV()[0]; await s.ready(v); await s.wait(250);
    await s.openViewerByClick(0); await s.wait(100);
    const afterOpen = { viewerOpen: !!s.BE.modules.viewer.isOpen(), hoverVisible: s.hoverVisible(), hoverPlaying: s.playing(v), hoverInstalled: s.inHover(v), viewerVideos: s.V().filter((x) => x.__rec.owner === 'viewer').length };
    s.BE.modules.viewer.close(); await s.wait(50);
    const afterClose = { viewerOpen: !!s.BE.modules.viewer.isOpen(), hoverVisible: s.hoverVisible(), hoverPlaying: s.playing(v) };
    await s.leave(0); await s.wait(50);
    return { afterOpen, afterClose };
  },
  // S10 viewer takeover before readiness; the hover video becomes ready while the viewer is open
  S10: async (s) => {
    await s.enter(0); await s.wait(50); await s.openViewerByClick(0); await s.wait(50);
    const v = s.hoverV()[0]; await s.ready(v); await s.wait(50);
    return { viewerOpen: !!s.BE.modules.viewer.isOpen(), hoverInstalledDuringViewer: s.inHover(v), hoverPlayingDuringViewer: s.playing(v), hoverVisible: s.hoverVisible() };
  },
  // S11 gallery dispose after readiness
  S11: async (s) => { await s.enter(0); await s.wait(50); await s.ready(s.hoverV()[0]); await s.wait(250); s.BE.modules.gallery.dispose(); await s.wait(50); return { hoverVisible: s.hoverVisible() }; },
  // S12 gallery dispose before readiness
  S12: async (s) => { await s.enter(0); await s.wait(50); s.BE.modules.gallery.dispose(); await s.wait(50); return { hoverVisible: s.hoverVisible() }; },
};

async function run(source, host, id, ext = 'webm') {
  const s = await session(source, host, ext);
  const meta = await SCEN[id](s);
  const out = { meta, videos: s.snapshot(), metadata: s.rec.meta.map(({ t, name, gen }) => ({ t, name, gen })), network: s.networkRequests(),
    thumbAssigns: s.rec.assigns.filter((a) => a.path === 'showImmediateThumbnail').map(({ t, slot }) => ({ t, slot })) };
  s.close();
  return out;
}

// Observations (the current lifecycle). Each returns [ok, detail].
function observe(r, id) {
  const v = r.videos; const v0 = v[0];
  switch (id) {
    case 'S1': return [v.length === 1 && v0.createdT === 0 && v0.srcSets.length === 1 && v0.srcSets[0].t === 0 && v0.srcSets[0].slot === 'FILE'
      && v0.srcSets[0].mutedAtAssign === false && v0.muted === true && v0.defaultMuted === true && v0.autoplay === true && v0.loop === true && v0.preload === 'auto' && v0.playsInline === true
      && !v0.inHover && v0.holdsSource && r.thumbAssigns.length === 1 && r.thumbAssigns[0].t === 0 && r.metadata.length >= 1 && r.metadata.every((m) => m.t === 0) && r.network === 0, r];
    case 'S2': return [v.length === 1 && v0.srcSets[0].t === 0 && v0.pausesT.includes(40) && v0.srcRemovedT.join() === '40' && v0.loadsT.join() === '0,40' && !v0.holdsSource && !v0.connected, r];
    case 'S3': return [v.length === 1 && v0.srcRemovedT.join() === '100' && !v0.inHover && !v0.holdsSource && !v0.playing && r.meta.hoverVisible === false, r];
    case 'S4': return [v.length === 1 && r.meta.installed && r.meta.playingAfterReady && v0.playsT.join() === '50' && v0.mutedAtPlay.every(Boolean)
      && v0.pausesT.includes(300) && !v0.connected && v0.srcRemovedT.length === 0 && v0.loadsT.join() === '0' && v0.holdsSource && !v0.playing
      && r.meta.hoverVisible === false && r.meta.hoverChildren === 0, r];
    case 'S5': return [v.length === 5 && v.every((x) => !x.connected && !x.playing && x.holdsSource && x.srcRemovedT.length === 0) && r.meta.maxHolding === 5, r];
    case 'S6': return [v.length === 5 && v.every((x) => !x.connected && !x.holdsSource && x.srcRemovedT.length === 1) , r];
    case 'S7': return [v.length === 2 && r.meta.g1Installed === false && r.meta.g2Installed === true && !v[0].holdsSource, r];
    case 'S8': return [v.length === 2 && r.meta.holdingWhileB === 2 && !v[0].connected && v[0].holdsSource, r];
    case 'S9': return [r.meta.afterOpen.viewerOpen && r.meta.afterOpen.hoverVisible && r.meta.afterOpen.hoverPlaying && r.meta.afterOpen.hoverInstalled
      && r.meta.afterClose.viewerOpen === false && r.meta.afterClose.hoverVisible && r.meta.afterClose.hoverPlaying
      && v0.pausesT.includes(450) && !v0.connected && v0.holdsSource, r];
    case 'S10': return [r.meta.viewerOpen && r.meta.hoverInstalledDuringViewer && r.meta.hoverPlayingDuringViewer && r.meta.hoverVisible, r];
    case 'S11': return [r.meta.hoverVisible === false && v0.pausesT.includes(300) && !v0.connected && v0.holdsSource && v0.srcRemovedT.length === 0, r];
    case 'S12': return [r.meta.hoverVisible === false && v0.srcRemovedT.join() === '50' && !v0.holdsSource, r];
    default: return [false, 'unknown'];
  }
}
const LABEL = {
  S1: 'sustained hover: one hover <video> created and its FILE src assigned at pointer-enter (t=0, no dwell), then load() at t=0; muted/defaultMuted/autoplay/loop/playsInline set right after src in the same task; preload auto; not installed before readiness; thumbnail overlay and cached metadata at t=0; no network',
  S2: '40 ms sweep: the FILE src is assigned at 0; leave at 40 pauses, removes src and calls load() (pending element released)',
  S3: 'leave before readiness, then late loadeddata/playing/canplay: nothing installed or played; the element stays released',
  S4: 'leave after loadeddata: installed and play() (muted) at 50; leave pauses and detaches, but src is NOT removed and no reset load() follows; late events do not revive the overlay',
  S5: 'five leave/re-enter cycles after readiness: five hover videos, each paused and detached but still holding its src (5 at once)',
  S6: 'five leave/re-enter cycles before readiness: five hover videos, each released (src removed)',
  S7: 're-entry: generation 1 becoming ready during generation 2 is not installed; generation 2 installs',
  S8: 'card A ready, then card B: two hover videos hold a source at once (A detached, B pending)',
  S9: 'viewer takeover after readiness: the hover overlay stays visible and its video keeps playing while the viewer is open and after close; only the later leave pauses and detaches it (src kept)',
  S10: 'viewer takeover before readiness: the hover video becomes ready while the viewer is open and is installed and played',
  S11: 'gallery dispose after readiness: hides and pauses/detaches, src kept',
  S12: 'gallery dispose before readiness: pending element released (src removed)',
};

async function main() {
  const detail = {};
  check('production under test is the IB09 artifact (blob 22e843c)', h.gitBlobId(PROD) === EXPECTED_BLOB, h.gitBlobId(PROD));
  for (const host of ['e621.net', 'e926.net']) {
    for (const id of Object.keys(SCEN)) {
      const r = await run(PROD, host, id);
      detail[`${host} ${id}`] = r;
      const [ok, d] = observe(r, id);
      check(`${host} ${id}: ${LABEL[id]}`, ok, JSON.stringify(d));
    }
    const mp4 = await run(PROD, host, 'S1', 'mp4');
    check(`${host} S1 mp4 card: same path (FILE src at t=0)`, observe(mp4, 'S1')[0], JSON.stringify(mp4));
  }

  // ---- fault controls: each production mutant must change at least one observation ----
  const P = PROD.replace(/\r\n/g, '\n');
  const m = (from, to) => mustReplace(P, from, to);
  const caughtBy = async (src, ids) => { for (const id of ids) { const r = await run(src, 'e621.net', id); if (!observe(r, id)[0]) return id; } return null; };
  const faults = [
    ['hover video not muted', m('\t\t\t\tvideo.muted = true;\n\t\t\t\tvideo.defaultMuted = true;\n', ''), ['S1', 'S4']],
    ['pending video not released on leave (src kept)', m("\t\t\t\ttry {\n\t\t\t\t\tmedia.removeAttribute('src');\n\t\t\t\t\tmedia.load();\n\t\t\t\t} catch { /* noop */ }\n", ''), ['S2', 'S6', 'S12']],
    ['stale readiness guard removed (old generation installs)', m("\t\t\t\t\tif (token !== requestToken || activeUpgradeUrl !== resolved.url) {\n\t\t\t\t\t\ttry { video.pause(); } catch { /* noop */ }\n\t\t\t\t\t\treturn;\n\t\t\t\t\t}\n\t\t\t\t\tclearMediaState();\n\t\t\t\t\tif (installMedia(video, sourceImg, token)) video.play().catch(() => {});",
      "\t\t\t\t\tclearMediaState();\n\t\t\t\t\tif (installMedia(video, sourceImg, requestToken)) video.play().catch(() => {});"), ['S3', 'S7']],
    ['installed video not paused on leave', m('\t\t\tif (!hoverEl) return;\n\t\t\tstopCurrentMedia();\n\t\t\thoverEl.style.display', '\t\t\tif (!hoverEl) return;\n\t\t\thoverEl.style.display'), ['S4', 'S5']],
    ['installed video not detached on leave', m("\t\t\thoverEl.style.display = 'none';\n\t\t\thoverEl.innerHTML = '';\n", "\t\t\thoverEl.style.display = 'none';\n"), ['S4']],
    ['positive control: leave releases the installed video (src removed + load)', m("\t\t\tif (video) {\n\t\t\t\ttry { video.pause(); } catch { /* noop */ }\n\t\t\t}", "\t\t\tif (video) {\n\t\t\t\ttry { video.pause(); } catch { /* noop */ }\n\t\t\t\ttry { video.removeAttribute('src'); video.load(); } catch { /* noop */ }\n\t\t\t}"), ['S4', 'S5', 'S8']],
    ['positive control: video cards dwell-gated (qualified class widened)', m("\t\t\treturn rendition === 'NATIVE_PREVIEW' || rendition === 'OWNED_SAMPLE' || rendition === 'OWNED_ORIGINAL' ? wrap : null;", "\t\t\treturn rendition ? wrap : null;"), ['S1', 'S2']],
  ];
  const faultOut = [];
  for (const [name, src, ids] of faults) {
    const by = await caughtBy(src, ids);
    faultOut.push({ name, caughtBy: by });
    check(`fault ${name}: changes the observed lifecycle (caught by ${by || 'nothing'})`, !!by);
  }

  const passed = results.filter((x) => x.pass).length;
  const sanitize = (k, v) => (k === 'el' ? undefined : v);
  const summary = { checkpoint: 'IB10', stage: 'E-stage baseline characterization of the current hover-video lifecycle (no production change)', production_blob: h.gitBlobId(PROD), fixtures: 'synthetic video cards (webm; mp4 variant)',
    clock: 'fake; t = ms since first pointer-enter', observations: Object.fromEntries(Object.entries(detail).map(([k, r]) => [k, { meta: r.meta, videos: r.videos, metadata: r.metadata, network: r.network }])),
    checks: results.length, passed, failed: results.length - passed, fault_controls: faultOut, failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'hover-video-baseline-result.json'), JSON.stringify(summary, sanitize, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
