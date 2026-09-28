'use strict';
// IB07 implementation check for gelbooruNativeImagePost(): the Gelbooru
// logged-out native image-post parser. This is not the §3 item 9 acceptance
// suite. It demonstrates that the parser uses only the observed native facts,
// keeps unobserved fields unknown and fails closed outside its scope.
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.resolve(__dirname, '../../../Booru_Enhancer.user.js'), 'utf8');
new Function(source);

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`missing function ${name}`);
  // Start at the body brace, not a default-parameter literal such as `= {}`.
  const bodyStart = source.indexOf(') {', start) + 2;
  let depth = 0;
  for (let i = bodyStart; i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`unterminated function ${name}`);
}

const body = ['emptyPost', 'guessMediaType', 'rule34NativeImagePost', 'gelbooruNativeImagePost']
  .map(extractFunction).join('\n');
const factory = new Function('location', 'document',
  `${body}\nreturn { gelbooruNativeImagePost, rule34NativeImagePost };`);

const ORIGIN = 'https://gelbooru.com';
const SAMPLE = 'https://media.example//samples/aa/bb/sample_0123456789abcdef0123456789abcdef.jpg';
const ORIGINAL = 'https://media.example/images/aa/bb/0123456789abcdef0123456789abcdef.png';

function load({ host = 'gelbooru.com', search = '?page=post&s=view&id=1000', image = SAMPLE, original = ORIGINAL, video = false, stats = 'Size: 1448x2048 | Score: 7' } = {}) {
  const origin = `https://${host}`;
  const location = { hostname: host, origin, search, href: `${origin}/index.php${search}` };
  const document = {
    querySelector(sel) {
      if (sel === 'img#image') return image ? { currentSrc: image, getAttribute: () => image } : null;
      if (sel === 'video') return video ? {} : null;
      if (sel === 'li a[href*="/images/"]') return original ? { href: original } : null;
      return null;
    },
    querySelectorAll(sel) {
      if (sel === 'li, dd, dt, #stats, .stats, #tag-sidebar') return stats ? [{ textContent: stats }] : [];
      return [];
    },
  };
  return factory(location, document);
}

const results = [];
function check(name, condition, detail = '') {
  results.push({ name, pass: !!condition, detail });
}

let p = load().gelbooruNativeImagePost('1000');
check('observed facts populate the minimal Post', p
  && p.id === '1000' && p.siteId === 'gelbooru' && p.mediaType === 'image'
  && p.sampleUrl === SAMPLE && p.originalUrl === ORIGINAL
  && p.width === 1448 && p.height === 2048 && p.score === 7
  && p.postUrl === `${ORIGIN}/index.php?page=post&s=view&id=1000`, JSON.stringify(p));
check('unobserved fields stay unknown', p
  && p.rating === 'unknown' && p.fileSize === 0 && p.md5 === '' && p.source === ''
  && p.createdAt === '' && p.previewUrl === '' && p.allTags.length === 0
  && p.artists.length === 0 && p.characters.length === 0 && p.copyrights.length === 0
  && p.generalTags.length === 0 && p.metaTags.length === 0);

p = load({ original: '' }).gelbooruNativeImagePost('1000');
check('missing original link leaves original empty; sample never fills it', p && p.originalUrl === '' && p.sampleUrl === SAMPLE);

p = load({ stats: '' }).gelbooruNativeImagePost('1000');
check('missing statistics text leaves dimensions and score unknown', p && p.width === 0 && p.height === 0 && p.score === 0);

check('identity mismatch returns null', load().gelbooruNativeImagePost('999') === null);
check('missing id returns null', load().gelbooruNativeImagePost('') === null);
check('listing route returns null', load({ search: '?page=post&s=list&tags=all' }).gelbooruNativeImagePost('1000') === null);
check('missing img#image returns null', load({ image: null }).gelbooruNativeImagePost('1000') === null);
check('page with video returns null (video not in scope)', load({ video: true }).gelbooruNativeImagePost('1000') === null);
check('gif original returns null (GIF not in scope)', load({ original: 'https://media.example/images/aa/bb/x.gif' }).gelbooruNativeImagePost('1000') === null);
check('video-typed sample returns null', load({ image: 'https://media.example/x.mp4' }).gelbooruNativeImagePost('1000') === null);
check('other Gelbooru-family host returns null (no family inference)', load({ host: 'safebooru.org' }).gelbooruNativeImagePost('1000') === null);
check('rule34.xxx host returns null from the Gelbooru parser', load({ host: 'rule34.xxx' }).gelbooruNativeImagePost('1000') === null);
check('Rule34 parser still returns null on gelbooru.com (paths isolated)', load().rule34NativeImagePost('1000') === null);

const failed = results.filter((r) => !r.pass);
console.log(JSON.stringify({ suite: 'ib07-gelbooru-native-post', total: results.length, passed: results.length - failed.length, failed: failed.length, results }, null, 2));
if (failed.length) process.exitCode = 1;
