'use strict';
const fs=require('fs');
const s=fs.readFileSync('IB04_Browser_Ownership_Probe.user.js','utf8');
const h=fs.readFileSync('fixture.html','utf8');
const checks={
  localOnly:/@match\s+http:\/\/127\.0\.0\.1:8775\/\*/.test(s),
  noConnect:!/@connect/.test(s),
  noProductionSites:!/(rule34|e621|e926|gelbooru|pixiv|sankaku)/i.test(s+h),
  noExternalRuntimeUrl:!/(fetch\(|XMLHttpRequest|GM_xmlhttpRequest|GM\.xmlHttpRequest|@connect)/.test(s+h),
  hasRunMenu:/IB04: Run browser ownership probe/.test(s),
  hasExportMenu:/IB04: Show\/export last result/.test(s),
  hasO13:/focused owned control returns native origin/.test(s),
  hasRealNav:/preserves real native navigation/.test(s),
  hasSameValue:/same-value native write/.test(s),
  hasReplacement:/native card replacement/.test(s),
  hasMovedSource:/moved source/.test(s),
};
const failed=Object.entries(checks).filter(([,v])=>!v);
console.log(JSON.stringify({checks,failed:failed.map(([k])=>k)},null,2));
if(failed.length) process.exitCode=1;
