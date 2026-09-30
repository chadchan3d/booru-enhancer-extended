'use strict';
// IB08 presentation residue: after gallery.dispose(), a card whose class the
// site rewrote keeps the owned be-thumb-wrap / be-thumb-img token (IB04
// whole-record native-touch rule, unchanged). Production scopes card
// presentation to an active gallery container, so a stale token must have no
// enhancer presentation. Runs the REAL production userscript in jsdom (IB07
// harness) on e621 and e926. "Enhancer presentation applies" means at least
// one rule of the injected enhancer stylesheet (selector mentioning be-thumb
// or be-gallery-grid) matches the element.
// Cases: active gallery; site class rewrite then dispose; no-touch dispose;
// explicit re-init; new container. Fault control: the previous unscoped CSS
// (production 4ac1e36, commit 2765b9d). Observation (reported, not a pass
// condition): if the site also rewrites the CONTAINER's class, be-gallery-grid
// survives on it and gallery-scoped presentation stays; package check D11
// measures this live.
// Fixtures are synthetic. Requires `npm install` in tests/host/ib07.
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const h = require(path.resolve(__dirname, '../ib07/item9_harness.cjs'));

const REPO = path.resolve(__dirname, '../../..');
const PROD = h.productionSource();
const PREVIOUS = execFileSync('git', ['-C', REPO, 'show', '2765b9d:Booru_Enhancer.user.js'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).replace(/\r\n/g, '\n');
const results = [];
const check = (name, ok, detail = '') => results.push({ name, pass: !!ok, detail: ok ? '' : String(detail).slice(0, 300) });

const M = 'https://static.example';
const card = (id) => `<article class="thumbnail" data-id="${id}" data-file-ext="png" data-file-url="${M}/f${id}.png" data-sample-url="${M}/sample/s${id}.jpg"
  data-preview-url="${M}/p${id}.jpg" data-preview-webp="${M}/p${id}.webp"><a href="/posts/${id}" class="thm-link"><picture><source srcset="${M}/p${id}.webp" type="image/webp"><source srcset="${M}/p${id}.jpg" type="image/jpeg"><img src="${M}/p${id}.jpg" alt=""></picture></a></article>`;
const N = 5;
const listing = (host) => ({ url: `https://${host}/posts`, html: `<!doctype html><html><head></head><body data-user-is-anonymous="true"><section id="posts-container">${Array.from({ length: N }, (_, i) => card(i + 1)).join('')}</section></body></html>` });

function enhancerRules(d) {
  const out = [];
  for (const sheet of d.styleSheets) {
    let rules; try { rules = sheet.cssRules; } catch { continue; }
    for (const r of rules) if (r.selectorText && /be-thumb|be-gallery-grid/.test(r.selectorText)) out.push(r.selectorText);
  }
  return out;
}
const matching = (el, rules) => rules.filter((sel) => { try { return el.matches(sel); } catch { return false; } }).length;

async function run(host, { source = PROD, siteTouchCards = false, siteTouchContainer = false, reinit = false, newContainer = false } = {}) {
  const c = h.load({ ...listing(host), source });
  await h.sleep(300);
  const d = c.window.document; const G = c.BE.modules.gallery;
  let container = d.querySelector('#posts-container');
  const rules = enhancerRules(d);
  const cards = () => [...container.querySelectorAll('article')];
  const measure = () => ({
    cardsWithEnhancerRules: cards().filter((a) => matching(a, rules) > 0).length,
    imgsWithEnhancerRules: cards().filter((a) => matching(a.querySelector('img'), rules) > 0).length,
    staleWrapTokens: cards().filter((a) => a.classList.contains('be-thumb-wrap')).length,
    staleImgTokens: cards().filter((a) => a.querySelector('img').classList.contains('be-thumb-img')).length,
    containerHasGalleryClass: container.classList.contains('be-gallery-grid'),
  });
  const o = { enhancerRuleCount: rules.length, active: measure() };
  if (siteTouchCards) for (const a of cards()) { a.classList.remove('blacklisted'); a.querySelector('img').classList.remove('blacklisted'); }
  if (siteTouchContainer) container.classList.remove('blacklisted');
  await h.sleep(20);
  G.dispose();
  await h.sleep(700);
  o.afterDispose = measure();
  if (reinit) { G.init(container); await h.sleep(50); o.afterReinit = measure(); }
  if (newContainer) {
    const fresh = d.createElement('section'); fresh.id = 'posts-container'; fresh.innerHTML = [8, 9].map(card).join('');
    container.replaceWith(fresh); container = fresh; await h.sleep(700);
    o.newContainer = measure();
  }
  c.window.close();
  return o;
}

async function main() {
  const obs = {};
  for (const host of ['e621.net', 'e926.net']) {
    const touched = obs[`${host} site class rewrite, dispose, re-init`] = await run(host, { siteTouchCards: true, reinit: true });
    const clean = obs[`${host} no site touch, dispose`] = await run(host);
    const fresh = obs[`${host} new container`] = await run(host, { siteTouchCards: true, newContainer: true });
    const fault = obs[`${host} previous unscoped CSS (fault control)`] = await run(host, { source: PREVIOUS, siteTouchCards: true });
    const cont = obs[`${host} site also rewrites the container class (observation)`] = await run(host, { siteTouchCards: true, siteTouchContainer: true });
    check(`${host} active gallery: enhancer presentation applies to every card and image`, touched.active.cardsWithEnhancerRules === N && touched.active.imgsWithEnhancerRules === N && touched.active.containerHasGalleryClass, JSON.stringify(touched.active));
    check(`${host} site class rewrite then dispose: stale tokens remain on cards and images`, touched.afterDispose.staleWrapTokens === N && touched.afterDispose.staleImgTokens === N, JSON.stringify(touched.afterDispose));
    check(`${host} ...but no enhancer presentation rule matches any card or image, and the container lost be-gallery-grid`, touched.afterDispose.cardsWithEnhancerRules === 0 && touched.afterDispose.imgsWithEnhancerRules === 0 && !touched.afterDispose.containerHasGalleryClass, JSON.stringify(touched.afterDispose));
    check(`${host} no-touch dispose restores normally (no tokens, no rules)`, clean.afterDispose.staleWrapTokens === 0 && clean.afterDispose.staleImgTokens === 0 && clean.afterDispose.cardsWithEnhancerRules === 0 && clean.afterDispose.imgsWithEnhancerRules === 0, JSON.stringify(clean.afterDispose));
    check(`${host} explicit re-init makes the scoped presentation active again`, touched.afterReinit.cardsWithEnhancerRules === N && touched.afterReinit.imgsWithEnhancerRules === N && touched.afterReinit.containerHasGalleryClass, JSON.stringify(touched.afterReinit));
    check(`${host} a new container initializes with enhancer presentation`, fresh.newContainer.cardsWithEnhancerRules === 2 && fresh.newContainer.imgsWithEnhancerRules === 2, JSON.stringify(fresh.newContainer));
    check(`fault ${host} previous unscoped CSS: caught (stale-token cards and images keep enhancer rules after dispose)`, fault.afterDispose.cardsWithEnhancerRules === N && fault.afterDispose.imgsWithEnhancerRules === N, JSON.stringify(fault.afterDispose));
  }
  const passed = results.filter((x) => x.pass).length;
  const summary = { checkpoint: 'IB08', finding: 'presentation residue after dispose (CSS scoping)', production_blob: h.gitBlobId(PROD), previous_production_blob: h.gitBlobId(PREVIOUS), fixtures: 'synthetic',
    observations: obs, checks: results.length, passed, failed: results.length - passed, failures: results.filter((x) => !x.pass) };
  fs.writeFileSync(path.join(__dirname, 'presentation-residue-result.json'), JSON.stringify(summary, null, 2) + '\n');
  for (const x of results) console.log(`${x.pass ? 'PASS' : 'FAIL'}  ${x.name}${x.pass ? '' : `  -- ${x.detail}`}`);
  for (const host of ['e621.net', 'e926.net']) console.log(`OBSERVATION ${host} container class also rewritten:`, JSON.stringify(obs[`${host} site also rewrites the container class (observation)`].afterDispose));
  console.log(`\n${passed}/${results.length} checks passed`);
  process.exitCode = passed === results.length ? 0 : 1;
}
main().catch((e) => { console.error(e); process.exitCode = 1; });
