'use strict';

const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { BASELINE_COMMIT, BASELINE_SHA256, loadMaster, makeEnv } = require('./lib/env.cjs');

function argValue(name, fallback) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : fallback;
}

const profile = argValue('--profile', 'baseline');
if (!['baseline', 'corrected'].includes(profile)) throw new Error(`unknown profile: ${profile}`);

const master = loadMaster();
if (profile === 'baseline') assert.equal(master.sha256, BASELINE_SHA256, `baseline profile requires ${BASELINE_COMMIT}`);

const results = [];

function qualify({ id, historical, observed, defect, contract, control }) {
  const defectDetected = Boolean(defect(observed));
  const contractSatisfied = Boolean(contract(observed));
  const controlRejectsDefect = !defect(control);
  const controlPassesContract = Boolean(contract(control));
  const oracleQualified = controlRejectsDefect && controlPassesContract;
  const expected = profile === 'baseline' ? defectDetected && !contractSatisfied : !defectDetected && contractSatisfied;
  const classification = contractSatisfied ? 'CONTRACT_PASS' : defectDetected ? 'KNOWN_BASELINE_DEFECT' : 'UNCLASSIFIED_FAILURE';
  const record = {
    id,
    historical,
    profile,
    observed,
    classification,
    defectDetected,
    contractSatisfied,
    oracleQualified,
    expected,
  };
  results.push(record);
  if (!oracleQualified || !expected) process.stderr.write(`[IB01 ${id}] ${JSON.stringify(record)}\n`);
  assert.equal(oracleQualified, true, `${id}: oracle control is not sensitive`);
  assert.equal(expected, true, `${id}: observed behavior does not match ${profile} expectation`);
}

function r34Html(n, withTitles = true) {
  return `<html><body><div class="image-list">${Array.from({ length: n }, (_, i) => `<span class="thumb"><a id="p${100 + i}" href="index.php?page=post&s=view&id=${100 + i}"><img class="preview" src="https://wimg.rule34.xxx/thumbnails/1/thumbnail_${100 + i}.jpg"${withTitles ? ' title="tag_a tag_b"' : ''}></a></span>`).join('')}</div></body></html>`;
}

async function startupFanout() {
  const N = 42;
  const thumbs = Array.from({ length: N }, (_, i) => {
    const id = 9000000 + i;
    return `<article class="thumbnail-preview"><a id="p${id}" href="index.php?page=post&s=view&id=${id}"><img src="https://img3.gelbooru.com/thumbnails/aa/bb/thumbnail_${id}.jpg" title="tag_a tag_b score:1"></a></article>`;
  }).join('');
  const html = `<html><body><div class="content">${thumbs}</div><div id="paginator"><a alt="next" href="index.php?page=post&s=list&tags=all&pid=42">next</a></div></body></html>`;
  const postHtml = (u) => {
    const id = (u.match(/id=(\d+)/) || [])[1];
    return `<html><body><img id="image" src="https://img3.gelbooru.com/samples/aa/bb/sample_${id}.jpg"><a class="download-link" href="https://img3.gelbooru.com/images/aa/bb/${id}.png">orig</a></body></html>`;
  };
  const env = makeEnv({ source: master.source, url: 'https://gelbooru.com/index.php?page=post&s=list&tags=all', html,
    settings: { 'gallery.infiniteScroll': false },
    respond: (u) => /page=dapi/.test(u) ? { status: 401, body: 'Authentication required "api-key" & "user-id" needed to access the API' }
      : /s=view/.test(u) ? { status: 200, body: postHtml(u) } : { status: 200, body: '<html></html>' } });
  env.boot();
  await env.advance(15000);
  const observed = {
    apiRequests: env.log.filter((r) => /page=dapi/.test(r.url)).length,
    postPageRequests: env.log.filter((r) => /s=view/.test(r.url)).length,
    totalRequests: env.log.length,
  };
  env.close();
  qualify({
    id: 'T1_STARTUP_FANOUT', historical: 't1_gelbooru.js / T1', observed,
    defect: (x) => x.apiRequests > 1 && x.postPageRequests >= N,
    contract: (x) => x.apiRequests <= 1 && x.postPageRequests === 0,
    control: { apiRequests: 0, postPageRequests: 0, totalRequests: 0 },
  });
}

async function hoverAmplification() {
  const N = 42;
  const thumbs = Array.from({ length: N }, (_, i) => {
    const id = 5000000 + i;
    return `<span class="thumb" id="s${id}"><a id="p${id}" href="index.php?page=post&s=view&id=${id}"><img class="preview" src="https://wimg.rule34.xxx/thumbnails/1/thumbnail_${id}.jpg" title="tag_a tag_b score:3 rating:explicit"></a></span>`;
  }).join('');
  const html = `<html><body><div class="image-list">${thumbs}</div></body></html>`;
  const postHtml = (u) => {
    const id = (u.match(/id=(\d+)/) || [])[1];
    return `<html><body><img id="image" src="https://wimg.rule34.xxx/samples/1/sample_${id}.jpg"></body></html>`;
  };
  const env = makeEnv({ source: master.source, url: 'https://rule34.xxx/index.php?page=post&s=list&tags=all', html,
    settings: { 'gallery.infiniteScroll': false },
    respond: (u) => /page=dapi/.test(u) ? { status: 200, body: 'Missing authentication. Go to api.rule34.xxx for more information' }
      : /s=view/.test(u) ? { status: 200, body: postHtml(u) } : { status: 200, body: '' } });
  env.boot();
  await env.advance(500);
  const before = env.log.length;
  const images = [...env.w.document.querySelectorAll('.image-list img')];
  for (let i = 0; i < 12; i++) {
    const img = images[i];
    img.dispatchEvent(new env.w.MouseEvent('pointerover', { bubbles: true }));
    await env.advance(40);
    img.dispatchEvent(new env.w.MouseEvent('pointerout', { bubbles: true, relatedTarget: env.w.document.body }));
  }
  await env.advance(4000);
  const traffic = env.log.slice(before);
  const observed = {
    requests: traffic.length,
    apiRequests: traffic.filter((r) => /dapi/.test(r.url)).length,
    postPageRequests: traffic.filter((r) => /s=view/.test(r.url)).length,
  };
  env.close();
  qualify({
    id: 'T2_HOVER_AMPLIFICATION', historical: 't2_rule34.js / T2 sweep', observed,
    defect: (x) => x.requests > 0,
    contract: (x) => x.requests === 0,
    control: { requests: 0, apiRequests: 0, postPageRequests: 0 },
  });
}

async function viewerClickFailure() {
  const env = makeEnv({ source: master.source, url: 'https://rule34.xxx/index.php?page=post&s=list', html: r34Html(3),
    settings: { 'gallery.infiniteScroll': false }, respond: () => ({ status: 200, body: '' }) });
  env.boot();
  await env.advance(300);
  env.w.BE.modules.viewer.open = () => { throw new Error('simulated viewer failure'); };
  const img = env.w.document.querySelector('.image-list img');
  const ev = new env.w.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 });
  try { img.dispatchEvent(ev); } catch {}
  const observed = { defaultPrevented: ev.defaultPrevented };
  env.close();
  qualify({
    id: 'T3_CLICK_TAKEOVER_FAILURE', historical: 't3_dom.js / T3', observed,
    defect: (x) => x.defaultPrevented === true,
    contract: (x) => x.defaultPrevented === false,
    control: { defaultPrevented: false },
  });
}

async function nativeTitlesWhenHoverOff() {
  const env = makeEnv({ source: master.source, url: 'https://rule34.xxx/index.php?page=post&s=list', html: r34Html(5),
    settings: { 'gallery.infiniteScroll': false, 'media.hoverPreview': false }, respond: () => ({ status: 200, body: '' }) });
  env.boot();
  await env.advance(300);
  const observed = { remaining: env.w.document.querySelectorAll('.image-list img[title]').length, expected: 5 };
  env.close();
  qualify({
    id: 'T4_NATIVE_TITLE_PRESERVATION', historical: 't3_dom.js / T4', observed,
    defect: (x) => x.remaining < x.expected,
    contract: (x) => x.remaining === x.expected,
    control: { remaining: 5, expected: 5 },
  });
}

async function e621PicturePreservation() {
  const art = (id) => `<article class="thumbnail" id="post_${id}" data-id="${id}" data-preview-url="https://static1.e621.net/data/preview/aa/bb/${id}.jpg" data-sample-url="https://static1.e621.net/data/sample/aa/bb/${id}.jpg" data-file-url="https://static1.e621.net/data/aa/bb/${id}.png"><a class="thm-link" href="/posts/${id}" title="tags" data-hover-text="tags"><picture><source type="image/webp" srcset="https://static1.e621.net/data/preview/aa/bb/${id}.webp 1x, https://static1.e621.net/data/preview/aa/bb/${id}_2x.webp 2x"><img src="https://static1.e621.net/data/preview/aa/bb/${id}.jpg" srcset="https://static1.e621.net/data/preview/aa/bb/${id}.jpg 1x"></picture></a></article>`;
  const env = makeEnv({ source: master.source, url: 'https://e621.net/posts', html: `<html><body><section id="posts-container">${art(1)}${art(2)}</section></body></html>`,
    settings: { 'gallery.infiniteScroll': false }, respond: (u) => /posts\.json/.test(u) ? { status: 200, body: '{"posts":[]}' } : { status: 200, body: '' } });
  env.boot();
  await env.advance(500);
  const observed = {
    sourceElements: env.w.document.querySelectorAll('picture source').length,
    imgSrcsets: env.w.document.querySelectorAll('picture img[srcset]').length,
    expected: 2,
  };
  env.close();
  qualify({
    id: 'T5_E621_PICTURE_PRESERVATION', historical: 't3_dom.js / T5', observed,
    defect: (x) => x.sourceElements < x.expected || x.imgSrcsets < x.expected,
    contract: (x) => x.sourceElements === x.expected && x.imgSrcsets === x.expected,
    control: { sourceElements: 2, imgSrcsets: 2, expected: 2 },
  });
}

async function downloadOverlap() {
  const html = '<html><body><div class="image-list"><span class="thumb"><a id="p100" href="index.php?page=post&s=view&id=100"><img class="preview" src="https://wimg.rule34.xxx/thumbnails/1/thumbnail_100.jpg"></a></span></div></body></html>';
  let anchorClicks = 0;
  const events = [];
  let env;
  env = makeEnv({ source: master.source, url: 'https://rule34.xxx/index.php?page=post&s=list', html,
    settings: { 'gallery.infiniteScroll': false }, respond: () => ({ status: 200, body: '' }),
    gmDownload: (o) => {
      events.push({ at: env.clock.now, type: 'GM_download_start' });
      env.w.setTimeout(() => { events.push({ at: env.clock.now, type: 'GM_download_onload' }); o.onload && o.onload(); }, 12000);
      return { abort() {} };
    } });
  env.boot();
  await env.advance(300);
  env.w.HTMLAnchorElement.prototype.click = function () {
    if (this.download) { anchorClicks++; events.push({ at: env.clock.now, type: 'anchor_fallback' }); }
  };
  const p = env.w.BE.modules.downloader.downloadPost({ id: '100', originalUrl: 'https://wimg.rule34.xxx/images/1/100.mp4', sampleUrl: '', previewUrl: '', mediaType: 'video', artists: [], characters: [], copyrights: [], generalTags: [], allTags: [] });
  p.catch(() => {});
  await env.advance(9000);
  const attemptsAt9s = 1 + anchorClicks;
  await env.advance(4000);
  await Promise.resolve(p).catch(() => {});
  const observed = { attemptsAt9s, anchorClicks, eventTypes: events.map((e) => e.type) };
  env.close();
  qualify({
    id: 'T6_DOWNLOAD_OVERLAP', historical: 't4_actions.js / T6', observed,
    defect: (x) => x.attemptsAt9s > 1,
    contract: (x) => x.attemptsAt9s === 1,
    control: { attemptsAt9s: 1, anchorClicks: 0, eventTypes: ['GM_download_start'] },
  });
}

async function favoriteFalseSuccess() {
  const html = '<html><body><div class="image-list"><span class="thumb"><a id="p100" href="index.php?page=post&s=view&id=100"><img class="preview" src="https://wimg.rule34.xxx/thumbnails/1/thumbnail_100.jpg"></a></span></div></body></html>';
  const env = makeEnv({ source: master.source, url: 'https://rule34.xxx/index.php?page=post&s=list', html,
    settings: { 'gallery.infiniteScroll': false },
    respond: (u) => /s=view/.test(u) ? { status: 200, body: '<html><body><a id="favorite-button" href="https://rule34.xxx/index.php?page=favorites&s=add&id=100">Add to favorites</a></body></html>' }
      : /favorites/.test(u) ? { status: 200, body: '<html><body>You must be logged in to do that.</body></html>' } : { status: 200, body: '' } });
  env.boot();
  await env.advance(300);
  const promise = env.w.BE.modules.favorites.toggle({ id: '100', postUrl: 'https://rule34.xxx/index.php?page=post&s=view&id=100' });
  await env.advance(1000);
  const returned = await promise;
  const observed = { returned };
  env.close();
  qualify({
    id: 'T7_FAVORITE_FALSE_SUCCESS', historical: 't4_actions.js / T7', observed,
    defect: (x) => x.returned === true,
    contract: (x) => x.returned !== true,
    control: { returned: false },
  });
}

async function appendLiveness(status) {
  const html = `<html><body><div class="image-list">${Array.from({ length: 5 }, (_, i) => `<span class="thumb"><a id="p${100 + i}" href="index.php?page=post&s=view&id=${100 + i}"><img class="preview" src="x_${i}.jpg"></a></span>`).join('')}</div><div id="paginator"><a alt="next" href="index.php?page=post&s=list&tags=all&pid=42">next</a></div></body></html>`;
  const env = makeEnv({ source: master.source, url: 'https://rule34.xxx/index.php?page=post&s=list&tags=all', html,
    respond: (u) => /s=list/.test(u) ? { status, body: 'error' } : { status: 200, body: '' } });
  env.boot();
  await env.advance(300);
  const io = env.ioCallbacks.find((o) => o.el && o.el.id === 'be-infinite-scroll-sentinel');
  assert.ok(io, 'append sentinel observer not found');
  io.cb([{ isIntersecting: true }]);
  await env.advance(40000);
  const first = env.log.filter((r) => /s=list/.test(r.url)).length;
  await env.advance(40000);
  const second = env.log.filter((r) => /s=list/.test(r.url)).length;
  const observed = { status, firstWindowRequests: first, secondWindowRequests: second - first, totalRequests: second };
  env.close();
  qualify({
    id: `T8_APPEND_LIVENESS_${status}`, historical: 't5_append.js / T8', observed,
    defect: (x) => x.totalRequests > 2 && x.secondWindowRequests > 0,
    contract: (x) => x.totalRequests <= 2 && x.secondWindowRequests === 0,
    control: { status, firstWindowRequests: 1, secondWindowRequests: 0, totalRequests: 1 },
  });
}

async function videoSourceRetention() {
  const art = '<article class="thumbnail" id="post_7" data-id="7" data-preview-url="https://static1.e621.net/data/preview/aa/bb/7.jpg" data-sample-url="https://static1.e621.net/data/sample/aa/bb/7.jpg" data-file-url="https://static1.e621.net/data/aa/bb/7.webm"><a class="thm-link" href="/posts/7"><picture><img src="https://static1.e621.net/data/preview/aa/bb/7.jpg"></picture></a></article>';
  const env = makeEnv({ source: master.source, url: 'https://e621.net/posts', html: `<html><body><section id="posts-container">${art}</section></body></html>`,
    settings: { 'gallery.infiniteScroll': false }, respond: () => ({ status: 200, body: '{"posts":[]}' }) });
  env.boot();
  await env.advance(300);
  const videos = [];
  const orig = env.w.document.createElement.bind(env.w.document);
  env.w.document.createElement = (t, ...a) => {
    const el = orig(t, ...a);
    if (String(t).toLowerCase() === 'video') videos.push(el);
    return el;
  };
  const img = env.w.document.querySelector('picture img');
  img.dispatchEvent(new env.w.MouseEvent('pointerover', { bubbles: true }));
  await env.advance(100);
  const v = videos[0];
  assert.ok(v, 'hover did not create a video element');
  v.dispatchEvent(new env.w.Event('loadeddata'));
  await env.advance(50);
  img.dispatchEvent(new env.w.MouseEvent('pointerout', { bubbles: true, relatedTarget: env.w.document.body }));
  await env.advance(100);
  const observed = { srcAfterLeave: v.getAttribute('src') || '', connectedAfterLeave: v.isConnected };
  env.close();
  qualify({
    id: 'T9_VIDEO_SOURCE_RETENTION', historical: 't6_video.js / T9 ready path', observed,
    defect: (x) => Boolean(x.srcAfterLeave),
    contract: (x) => !x.srcAfterLeave,
    control: { srcAfterLeave: '', connectedAfterLeave: false },
  });
}

function metadataMatches(source) {
  const end = source.indexOf('// ==/UserScript==');
  return (end >= 0 ? source.slice(0, end) : source).split(/\r?\n/).filter((line) => /^\/\/\s+@match\s+/.test(line)).map((line) => line.replace(/^\/\/\s+@match\s+/, '').trim());
}

async function genericHostRisk() {
  const hosts = [
    ['rule34.us', 'https://rule34.us/index.php?r=posts/index&q=all'],
    ['chan.sankakucomplex.com', 'https://chan.sankakucomplex.com/posts'],
    ['idol.sankakucomplex.com', 'https://idol.sankakucomplex.com/'],
    ['beta.sankakucomplex.com', 'https://beta.sankakucomplex.com/'],
  ];
  const matches = metadataMatches(master.source);
  const rows = [];
  for (const [host, url] of hosts) {
    const env = makeEnv({ source: master.source, url, html: '<html><body><div class="thumbnail"><a href="/index.php?r=posts/view&id=123"><img class="preview" src="t.jpg"></a></div><a href="/x/favorite/add/123">favorite</a></body></html>',
      settings: { 'gallery.infiniteScroll': false }, respond: () => ({ status: 200, body: '' }) });
    env.boot();
    await env.advance(300);
    rows.push({
      host,
      metadataMatched: matches.some((m) => m.includes(host)),
      adapter: env.w.BE.adapters.active.id,
      favoriteSupported: env.w.BE.modules.favorites.supported(),
      favoriteButtons: env.w.document.querySelectorAll('[data-be-action="favorite"]').length,
    });
    env.close();
  }
  const observed = { rows };
  qualify({
    id: 'T10_GENERIC_HOST_MUTATION_RISK', historical: 't7_generic.js / T10 + missing idol fixture', observed,
    defect: (x) => x.rows.some((r) => r.metadataMatched && (r.favoriteSupported || r.favoriteButtons > 0)),
    contract: (x) => x.rows.every((r) => !r.metadataMatched && !r.favoriteSupported && r.favoriteButtons === 0),
    control: { rows: hosts.map(([host]) => ({ host, metadataMatched: false, adapter: 'none', favoriteSupported: false, favoriteButtons: 0 })) },
  });
}

function qualifyEc1Registry() {
  const registryPath = path.join(__dirname, 'evidence', 'ec1_ownership_registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  assert.equal(registry.source, 'EC0_EC1_Evidence_Ledger.md');
  assert.equal(registry.cases.length, 13);
  const pass = registry.cases.filter((c) => c.historicalDisposition.startsWith('PASS'));
  const fail = registry.cases.filter((c) => c.historicalDisposition.startsWith('FAIL'));
  assert.equal(pass.length, 12, 'O01-O12 must remain recorded as passing bounded sensitivity evidence');
  assert.deepEqual(fail.map((c) => c.id), ['O13'], 'O13 must remain the one recorded historical failure');
  assert.ok(registry.cases.every((c) => c.sensitivityEvidence && c.requirement), 'each ownership case needs requirement and sensitivity evidence');
  results.push({
    id: 'EC1_OWNERSHIP_REGISTRY',
    historical: 'EC0/EC1 ledger O01-O13',
    profile,
    classification: 'HISTORICAL_EVIDENCE_PRESERVED',
    oracleQualified: true,
    expected: true,
    note: 'Registry preserves the supplied EC1 sensitivity record; original EC1 script packet was not included in the public repository and is not recreated as historical code.',
  });
}

async function main() {
  qualifyEc1Registry();
  await startupFanout();
  await hoverAmplification();
  await viewerClickFailure();
  await nativeTitlesWhenHoverOff();
  await e621PicturePreservation();
  await downloadOverlap();
  await favoriteFalseSuccess();
  await appendLiveness(403);
  await appendLiveness(429);
  await videoSourceRetention();
  await genericHostRisk();

  const summary = {
    checkpoint: 'IB01',
    profile,
    sourcePath: master.sourcePath,
    sourceSha256: master.sha256,
    baselineCommit: BASELINE_COMMIT,
    node: process.version,
    jsdom: require('jsdom/package.json').version,
    counts: {
      total: results.length,
      knownBaselineDefects: results.filter((r) => r.classification === 'KNOWN_BASELINE_DEFECT').length,
      contractPass: results.filter((r) => r.classification === 'CONTRACT_PASS').length,
      preservedHistorical: results.filter((r) => r.classification === 'HISTORICAL_EVIDENCE_PRESERVED').length,
    },
    results,
  };
  const outDir = path.join(__dirname, 'results');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, `ib01-${profile}.json`);
  fs.writeFileSync(outPath, JSON.stringify(summary, null, 2) + '\n');
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n');
}

main().catch((err) => {
  console.error(err.stack || err);
  process.exitCode = 1;
});
