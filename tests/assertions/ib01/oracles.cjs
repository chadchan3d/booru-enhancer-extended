'use strict';

function fail(code, message, details = {}) {
  return { ok: false, code, message, details };
}
function pass(code, message, details = {}) {
  return { ok: true, code, message, details };
}

const oracles = {
  startupFanout(o) {
    const extra = Number(o.apiRequests || 0) + Number(o.postPageRequests || 0);
    return extra === 0
      ? pass('startup-fanout', 'No enhancer metadata requests without user interaction.', { extra })
      : fail('startup-fanout', 'Background metadata fan-out occurred without user interaction.', { extra });
  },

  hoverDwell(o) {
    const sweepRequests = Number(o.apiRequests || 0) + Number(o.postPageRequests || 0);
    return sweepRequests === 0
      ? pass('hover-dwell', 'Pointer sweep admitted no metadata requests before dwell.', { sweepRequests })
      : fail('hover-dwell', 'Pointer sweep admitted metadata requests before dwell.', { sweepRequests });
  },

  viewerTakeover(o) {
    return o.defaultPrevented === false
      ? pass('viewer-takeover', 'Synchronous viewer-open failure preserves native navigation.')
      : fail('viewer-takeover', 'Native click was cancelled before viewer takeover succeeded.');
  },

  nativeTooltip(o) {
    return Number(o.nativeTitlesRemaining) === Number(o.expectedNativeTitles)
      ? pass('native-tooltip', 'Native tooltip labels remain when hover enhancement is disabled.')
      : fail('native-tooltip', 'Native tooltip labels were removed without an active replacement.', o);
  },

  pictureRestoration(o) {
    const sources = Number(o.sourceElementsLeft) === Number(o.expectedSourceElements);
    const srcsets = Number(o.imgSrcsetLeft) === Number(o.expectedImgSrcset);
    const identity = o.nativePictureIdentityPreserved !== false;
    return sources && srcsets && identity
      ? pass('picture-restoration', 'Responsive picture/source state remains recoverable.', o)
      : fail('picture-restoration', 'Responsive picture/source state was destructively altered.', o);
  },

  downloadSingleFlight(o) {
    return Number(o.downloadAttemptsStarted) === 1
      ? pass('download-single-flight', 'Exactly one file attempt is active for one user operation.')
      : fail('download-single-flight', 'Overlapping file attempts were started for one operation.', o);
  },

  favoriteValidation(o) {
    const falseSuccess = o.responseWasLoginPage === true && o.returned === true;
    return falseSuccess
      ? fail('favorite-validation', 'Login/error HTML was treated as confirmed favorite success.', o)
      : pass('favorite-validation', 'Ambiguous/login response is not confirmed as success.', o);
  },

  appendLiveness(o) {
    const attempts = Number(o.requestsForSameNextPage || 0);
    const ceiling = Number(o.finiteAttemptCeiling || 3);
    return attempts <= ceiling
      ? pass('append-liveness', 'Append failure remained within the declared finite attempt ceiling.', { attempts, ceiling })
      : fail('append-liveness', 'Append failure restarted beyond the finite attempt ceiling.', { attempts, ceiling });
  },

  videoDisposal(o) {
    const src = o.srcAfterLeave == null ? '' : String(o.srcAfterLeave);
    return src === '' && o.elementStillConnected === false
      ? pass('video-disposal', 'Owned hover video source and element are released on leave.', o)
      : fail('video-disposal', 'Owned hover video remains connected or retains its source after leave.', o);
  },

  genericMutationScope(o) {
    const excluded = o.enhancerActivated === false && Number(o.favoriteControls || 0) === 0;
    return excluded
      ? pass('generic-mutation-scope', 'Unvalidated generic host receives no enhancer mutation controls.', o)
      : fail('generic-mutation-scope', 'Unvalidated generic host still exposes enhancer mutation behavior.', o);
  },
};

module.exports = { oracles };
