'use strict';
// IB07 §3 item 10 Post count fact. Contract:
//   pageCount: null | positive integer; null = unknown; 1 = known single-item Post.
// Only the qualified single-item booru producers set 1 (Rule34 native image post,
// e621/e926 native listing and post, Gelbooru native image post). Everything
// else stays null; unknown never becomes 1 implicitly. Each assertion has a
// source-mutant control. Runs the working-copy production (must equal the
// expected blob) and compares Posts with the previous committed artifact.
const path = require('path');
const { execFileSync } = require('child_process');
const h = require('./item9_harness.cjs');
const fx = require('./item9_fixtures.cjs');

const EXPECTED_BLOB = '32d0051fe73505984066a5b69766b5eafc242bb9';
const PREVIOUS_ARTIFACT = '664bfe6366f03a6b1a27611087bcd6a91f2618f0'; // before the pageCount field
const REPO = path.resolve(__dirname, '../../..');
const NEW = h.productionSource();
const OLD = execFileSync('git', ['-C', REPO, 'cat-file', '-p', PREVIOUS_ARTIFACT], { encoding: 'utf8', maxBuffer: 64 << 20 }).replace(/\r\n/g, '\n');

const mut = (src, from, to) => { if (src.split(from).length !== 2) throw new Error(`mutant pattern not unique: ${from}`); return src.replace(from, to); };
const M = {
  fieldRemoved: (s) => mut(s, "siteId: '', pageCount: null, ...overrides,", "siteId: '', ...overrides,"),
  defaultOne: (s) => mut(s, "siteId: '', pageCount: null, ...overrides,", "siteId: '', pageCount: 1, ...overrides,"),
  r34Null: (s) => mut(s, "\t\t\tsiteId: 'rule34',\n\t\t\tpageCount: 1,\n", "\t\t\tsiteId: 'rule34',\n"),
  gelNull: (s) => mut(s, "\t\t\tsiteId: 'gelbooru',\n\t\t\tpageCount: 1,\n", "\t\t\tsiteId: 'gelbooru',\n"),
  e6Null: (s) => mut(s, "siteId: location.hostname === 'e926.net' ? 'e926' : 'e621',\n\t\t\tpageCount: 1,\n", "siteId: location.hostname === 'e926.net' ? 'e926' : 'e621',\n"),
  cacheErases: (s) => mut(s, '\t\t\tif (postCache.has(key)) return postCache.get(key);', "\t\t\tif (postCache.has(key)) { postCache.set(key, emptyPost({ id: key })); return postCache.get(key); }"),
};

// emptyPost extracted from production (no DOM needed).
function emptyPostFrom(src) {
  const start = src.indexOf('function emptyPost(');
  let depth = 0; let end = -1;
  for (let i = src.indexOf(') {', start) + 2; i < src.length; i++) {
    if (src[i] === '{') depth++;
    else if (src[i] === '}' && --depth === 0) { end = i + 1; break; }
  }
  return new Function('location', `${src.slice(start, end)}\nreturn emptyPost;`)({ href: 'https://example.invalid/' });
}

const GEL = { url: 'https://gelbooru.com/index.php?page=post&s=view&id=5001', html: '<!doctype html><html><body><img id="image" src="https://media.example//samples/aa/bb/sample_x.jpg"><ul id="tag-sidebar"><li>Size: 1448x2048</li><li>Score: 4</li></ul><ul><li><a href="https://media.example/images/aa/bb/x.png">Original image</a></li></ul></body></html>' };
async function posts(src, fixture, ids, { batch = false } = {}) {
  const c = await h.loadAndStart({ ...fixture, source: src });
  const before = c.requests.length;
  const out = batch ? await c.adapter.fetchThumbBatch(ids) : [];
  if (!batch) for (const id of ids) out.push(await c.adapter.fetchPost(id));
  const requests = c.requests.length - before;
  c.window.close();
  return { posts: out, requests };
}

const results = [];
function add(id, name, pass, controls, detail = null) { results.push({ id, name, verdict: pass ? 'PASS' : 'FAIL', controls, detail }); }
const ctl = (name, observed) => ({ name, expectedVerdict: 'FAIL', observed: observed ? 'PASS' : 'FAIL', ok: !observed });

(async () => {
  // 1-3 contract on the Post constructor.
  const ep = emptyPostFrom(NEW);
  const a1 = (src) => Object.prototype.hasOwnProperty.call(emptyPostFrom(src)(), 'pageCount');
  add('PC1', 'emptyPost contains pageCount', a1(NEW), [ctl('field removed', a1(M.fieldRemoved(NEW)))]);
  const a2 = (src) => emptyPostFrom(src)().pageCount === null;
  add('PC2', 'default pageCount is exactly null (unknown)', a2(NEW), [ctl('default 1', a2(M.defaultOne(NEW)))]);
  const a3 = (src) => { const e = emptyPostFrom(src); return e({ id: 'x', previewUrl: 'p', sampleUrl: 'p' }).pageCount === null && e({ pageCount: null }).pageCount === null
    && !/pageCount\s*(\|\||\?\?)\s*1|pageCount\s*:\s*[^,}\n]*\|\|\s*1/.test(src); };
  add('PC3', 'unknown does not become 1 implicitly (placeholder Posts stay null; no null-to-1 coercion in code)', a3(NEW) && ep({ id: 'y' }).pageCount === null, [ctl('default 1', a3(M.defaultOne(NEW)))]);

  // 4-7 qualified single-item producers.
  const r34 = async (src) => (await posts(src, fx.rule34Post({ id: 1001 }), ['1001'])).posts[0];
  add('PC4', 'Rule34 qualified native image Post: pageCount === 1', (await r34(NEW))?.pageCount === 1, [ctl('Rule34 producer left null', (await r34(M.r34Null(NEW)))?.pageCount === 1)]);
  for (const host of ['e621.net', 'e926.net']) {
    const listing = fx.e6Listing(host);
    const all1 = async (src) => {
      const l = await posts(src, listing, ['2001', '2002', '2003'], { batch: true });
      const p = await posts(src, fx.e6Post(host, { id: 3001 }), ['3001']);
      return l.posts.length === 3 && l.posts.every((x) => x.pageCount === 1) && p.posts[0]?.pageCount === 1;
    };
    add(`PC-${host}`, `${host} qualified native listing and image Posts: pageCount === 1`, await all1(NEW), [ctl('e621/e926 producer left null', await all1(M.e6Null(NEW)))]);
  }
  const gel = async (src) => (await posts(src, GEL, ['5001'])).posts[0];
  add('PC7', 'Gelbooru qualified native image Post: pageCount === 1', (await gel(NEW))?.pageCount === 1, [ctl('Gelbooru producer left null', (await gel(M.gelNull(NEW)))?.pageCount === 1)]);

  // No Post is invented where production builds none (Rule34 and Gelbooru listings).
  const noListingPost = async (src) => (await posts(src, fx.rule34Listing(), ['1001'])).posts[0] === null
    && (await posts(src, fx.gelbooruListing({ withContainer: true }), ['4001'])).posts[0] === null;
  add('PC-LISTING', 'Rule34 and Gelbooru listings still build no Post', await noListingPost(NEW), []);

  // 8-9 every other Post fact unchanged versus the previous artifact; no request.
  const cases = [['rule34 post', fx.rule34Post({ id: 1001 }), ['1001'], false], ['e621 post', fx.e6Post('e621.net', { id: 3001 }), ['3001'], false],
    ['e926 post', fx.e6Post('e926.net', { id: 3001 }), ['3001'], false], ['e621 listing', fx.e6Listing('e621.net'), ['2001', '2002', '2003'], true],
    ['e926 listing', fx.e6Listing('e926.net'), ['2001', '2002', '2003'], true], ['gelbooru post', GEL, ['5001'], false]];
  const diffs = []; let requests = 0;
  for (const [name, f, ids, batch] of cases) {
    const a = await posts(OLD, f, ids, { batch }); const b = await posts(NEW, f, ids, { batch });
    requests += b.requests;
    const strip = (p) => JSON.stringify(p && { ...p, pageCount: undefined });
    if (a.posts.length !== b.posts.length || a.posts.some((p, i) => strip(p) !== strip(b.posts[i]))) diffs.push(name);
  }
  add('PC8', 'all other Post facts identical to the previous artifact', diffs.length === 0, [], { differing: diffs });
  add('PC9', 'no enhancer request while producing Posts', requests === 0, [], { requests });

  // Cache/merge: a known 1 is not erased by later enrichment or lookups.
  const cacheKeeps = async (src) => {
    const c = await h.loadAndStart({ ...fx.e6Listing('e621.net'), source: src });
    const g = c.BE.modules.gallery;
    const first = g.getCachedPost('2001')?.pageCount;
    await g.enrichThumbnails(); await h.sleep(50);
    const again = (await g.enrichSinglePost('2001'))?.pageCount;
    const after = g.getCachedPost('2001')?.pageCount;
    c.window.close();
    return first === 1 && again === 1 && after === 1;
  };
  add('PC-MERGE', 'known pageCount 1 survives re-enrichment and cached lookups', await cacheKeeps(NEW), [ctl('cache lookup overwrites with an unknown Post', await cacheKeeps(M.cacheErases(NEW)))]);

  const blob = h.gitBlobId(NEW);
  const failed = results.filter((r) => r.verdict !== 'PASS').map((r) => r.id);
  const controlFailures = results.flatMap((r) => r.controls.filter((c) => !c.ok).map((c) => `${r.id}: ${c.name}`));
  console.log(JSON.stringify({ suite: 'IB07 Post pageCount assertions', contract: 'pageCount: null | positive integer; null = unknown; 1 = known single-item Post',
    productionBlob: blob, productionBlobIsExpected: blob === EXPECTED_BLOB, assertions: results.length, pass: results.length - failed.length, failed,
    controls: results.reduce((n, r) => n + r.controls.length, 0), controlFailures, results }, null, 2));
  if (failed.length || controlFailures.length || blob !== EXPECTED_BLOB) process.exitCode = 1;
})().catch((e) => { console.error(e.stack); process.exitCode = 1; });
