'use strict';
// The pinned WebM fixture used by the IB11 controlled pages, as ONE fact:
// its SHA-256 and its decoded video dimensions. The dimensions were measured
// from the file's own EBML (Matroska) track header (PixelWidth/PixelHeight in
// Segment > Tracks > TrackEntry > Video) by webmVideoDims() below, and agree
// with what real Chrome reported as videoWidth/videoHeight (IB11-P9 attempt 1).
// The fixture page's card metadata (data-width/height 1280x720) is page
// metadata only and is NOT the decoded size.
// Usage: node webm_fixture.cjs <file.webm>   (prints the parsed dimensions and SHA-256)
const fs = require('fs');
const crypto = require('crypto');

const PINNED_WEBM_SHA256 = '467649067aecd56d4d49ca9885eb87a6df5150af1bae6f565a1dba8b3eeb4a61';
const PINNED_WEBM_DIMS = [640, 360];

// Minimal EBML reader: element IDs and sizes are variable-length integers.
function vint(buf, pos, keepMarker) {
  const first = buf[pos]; let len = 1; let mask = 0x80;
  while (len <= 8 && !(first & mask)) { len++; mask >>= 1; }
  if (len > 8) throw new Error(`bad EBML vint at ${pos}`);
  let value = keepMarker ? first : (first & (mask - 1)); let allOnes = (first & (mask - 1)) === mask - 1;
  for (let i = 1; i < len; i++) { value = value * 256 + buf[pos + i]; if (buf[pos + i] !== 0xff) allOnes = false; }
  return { value, len, unknown: !keepMarker && allOnes };
}
const MASTER = new Set([0x18538067 /* Segment */, 0x1654ae6b /* Tracks */, 0xae /* TrackEntry */, 0xe0 /* Video */]);
function webmVideoDims(buf) {
  const out = { pixelWidth: null, pixelHeight: null, displayWidth: null, displayHeight: null };
  const walk = (start, end) => {
    let pos = start;
    while (pos < end) {
      const id = vint(buf, pos, true); pos += id.len;
      const size = vint(buf, pos, false); pos += size.len;
      const dataEnd = size.unknown ? end : Math.min(end, pos + size.value);
      if (MASTER.has(id.value)) walk(pos, dataEnd);
      else if ([0xb0, 0xba, 0x54b0, 0x54ba].includes(id.value)) {
        let v = 0; for (let i = pos; i < dataEnd; i++) v = v * 256 + buf[i];
        if (id.value === 0xb0 && out.pixelWidth === null) out.pixelWidth = v;
        if (id.value === 0xba && out.pixelHeight === null) out.pixelHeight = v;
        if (id.value === 0x54b0 && out.displayWidth === null) out.displayWidth = v;
        if (id.value === 0x54ba && out.displayHeight === null) out.displayHeight = v;
      }
      if (out.pixelWidth !== null && out.pixelHeight !== null && id.value === 0xe0) return;
      pos = dataEnd;
    }
  };
  walk(0, buf.length);
  return out;
}
// The size a browser reports as videoWidth/videoHeight (display size when given, else the coded size).
const decodedSize = (d) => [d.displayWidth || d.pixelWidth, d.displayHeight || d.pixelHeight];

module.exports = { PINNED_WEBM_SHA256, PINNED_WEBM_DIMS, webmVideoDims, decodedSize };

if (require.main === module) {
  const buf = fs.readFileSync(process.argv[2]);
  const d = webmVideoDims(buf);
  console.log(JSON.stringify({ sha256: crypto.createHash('sha256').update(buf).digest('hex'), ...d, decoded: decodedSize(d) }));
}
