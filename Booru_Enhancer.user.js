// ==UserScript==
// @name         Booru Enhancer Extended
// @namespace    https://github.com/chadchan3d/booru-enhancer-extended
// @version      1.2.7.3
// @description  Unofficial extended fork of Booru Enhancer with Rule34.xxx and e621/e926 compatibility fixes and hover/gallery improvements.
// @author       itachi-re
// @contributor  ChadChan3D
// @license      MIT
// @match        *://danbooru.donmai.us/*
// @match        *://*.donmai.us/*
// @match        *://atfbooru.ninja/*
// @match        *://gelbooru.com/*
// @match        *://safebooru.org/*
// @match        *://rule34.xxx/*
// @match        *://rule34.us/*
// @match        *://realbooru.com/*
// @match        *://tbib.org/*
// @match        *://xbooru.com/*
// @match        *://hypnohub.net/*
// @match        *://konachan.com/*
// @match        *://konachan.net/*
// @match        *://yande.re/*
// @match        *://lolibooru.moe/*
// @match        *://e621.net/*
// @match        *://e926.net/*
// @match        *://chan.sankakucomplex.com/*
// @match        *://idol.sankakucomplex.com/*
// @match        *://beta.sankakucomplex.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_listValues
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @grant        GM_notification
// @grant        GM_info
// @connect      donmai.us
// @connect      atfbooru.ninja
// @connect      gelbooru.com
// @connect      safebooru.org
// @connect      rule34.xxx
// @connect      rule34.us
// @connect      realbooru.com
// @connect      tbib.org
// @connect      xbooru.com
// @connect      hypnohub.net
// @connect      konachan.com
// @connect      konachan.net
// @connect      yande.re
// @connect      lolibooru.moe
// @connect      e621.net
// @connect      e926.net
// @connect      sankakucomplex.com
// @connect      sankakuapi.com
// @connect      saucenao.com
// @connect      iqdb.org
// @run-at       document-end
// @noframes
// @homepageURL  https://github.com/chadchan3d/booru-enhancer-extended
// @supportURL   https://github.com/chadchan3d/booru-enhancer-extended/issues
// @downloadURL  https://raw.githubusercontent.com/chadchan3d/booru-enhancer-extended/main/Booru_Enhancer.user.js
// @updateURL    https://raw.githubusercontent.com/chadchan3d/booru-enhancer-extended/main/Booru_Enhancer.user.js
// ==/UserScript==

/**
 * =============================================================================
 *  BOORU ENHANCER EXTENDED  —  v1.2.7.3
 * =============================================================================
 *  EXTENDED FORK CHANGELOG — v1.2.7.3
 *  ------------------------------------------------------------------------
 *  - Rule34.xxx gallery metadata is now interaction-driven instead of eagerly
 *    batch-enriched across the whole page; per-post requests are deduplicated.
 *  - Hover and fullscreen video previews show delayed Loading/Buffering states
 *    and a clear failure state while retaining the still thumbnail/poster.
 *  - Removed settings that had no runtime behavior and simplified misleading
 *    options; settings labels/values are now user-facing and sections collapse.
 *  - Settings UI now follows its theme, updates accent/position live, and
 *    includes ChadChan3D authorship with the canonical project-site link.
 *  - Fullscreen viewer now opens cached/full media when available, upgrades
 *    placeholders to original media, and rebuilds IMG/VIDEO elements when
 *    metadata reveals a different media type.
 *  - Viewer fit modes now calculate real stage-relative scale; Fit restores
 *    configured fit behavior and 1:1 means native pixel size.
 *  - Rule34.xxx gallery container/layout fixes.
 *  - e621/e926 current-thumbnail markup compatibility.
 *  - Independent thumbnail sizing with viewport-safe fixed-column clamping.
 *  - Responsive image/video hover preview with immediate thumbnail feedback,
 *    high-priority current-hover loading, stale-request cancellation, muted
 *    autoplay video, and shared metadata caching.
 *  - Suppresses native tag/text hover overlays on enhanced Rule34.xxx and
 *    e621/e926 thumbnails.
 *  - Metadata enrichment failures remain retryable; infinite-scroll additions
 *    are enriched consistently.
 *
 *  Upstream: Booru Enhancer 1.2.7 by itachi-re (MIT).
 * =============================================================================
 *  UPSTREAM CHANGELOG (1.2.6 → 1.2.7) — regression-review follow-up
 *  ------------------------------------------------------------------------
 *  - Gallery click/hover delegation moved from capture phase to bubble
 *    phase. preventDefault() still stops the default navigation either
 *    way (the browser only commits it after the full capture+bubble
 *    dispatch completes), but bubble phase no longer runs our logic
 *    ahead of any click handlers the site itself has on the thumbnail.
 *  - Gelbooru-family wrapper resolution is now validated, not just
 *    pattern-matched: a candidate wrapper is only accepted if it contains
 *    exactly one thumbnail image and resolves to the SAME post ID as the
 *    image itself. This specifically tightens the generic
 *    [data-id]/[data-post-id] fallback (used by some Gelbooru-family
 *    mirrors with non-standard markup), which was broad enough to
 *    potentially match a multi-post container.
 *  - Removed the hard-coded "+42" Gelbooru pagination fallback.
 *    calculateNextUrl() now only extrapolates a next page from a
 *    genuinely observed page-size delta; with no observation yet it
 *    reports "no next page" so native pagination is used instead of a
 *    fabricated URL — this was contradicting the "no fabricated
 *    pagination" pagination-safety fix from 1.2.5/1.2.6.
 *
 *  CHANGELOG (1.2.5 → 1.2.6) — Gelbooru-family interaction/settings fixes
 *  ------------------------------------------------------------------------
 *  - Root cause fix: thumbnail "wrapper" detection no longer uses a broad
 *    img.closest('article, span, div, a'). Every adapter now provides an
 *    explicit getThumbWrapper(img), so exactly one element per post is
 *    tagged .be-thumb-wrap — never an unrelated ancestor, and never the
 *    gallery container itself.
 *  - This one fix is what was silently breaking the viewer, hover preview,
 *    favorite/download actions, and grid sizing together: click/hover
 *    delegation used to fall back to a broad selector list that could
 *    match the gallery container as "the thumbnail", and .be-thumb-wrap
 *    could land on the wrong DOM node so grid sizing CSS never reached
 *    the actual grid item.
 *  - Click/hover delegation now only ever recognizes '.be-thumb-wrap' —
 *    no more matching arbitrary article/span/div/a ancestors.
 *  - Hover preview no longer flickers: pointerout is checked against
 *    relatedTarget so it only fires once the pointer truly leaves the
 *    thumbnail, not on every internal child boundary crossing.
 *  - gallery.thumbnailSize, gallery.gridDensity, and gallery.gridGap now
 *    visibly affect the grid immediately, because the wrapper receiving
 *    the sizing CSS is the actual grid item; site-native float/width on
 *    that element is neutralized so our grid governs layout.
 *  - gallery.compactMode now has a real, visible effect (denser square
 *    thumbnails, smaller action buttons) instead of only toggling a class
 *    with no CSS consumer.
 *  - --be-thumbnail-size is now actually set as a CSS custom property
 *    (previously computed in JS but never written to the DOM).
 *  - The viewer/action-button click path now only ever depends on
 *    '.be-thumb-wrap' + the post ID, never on metadata enrichment — so it
 *    keeps working immediately even if the API/HTML enrichment fails.
 *  - Thumbnails inserted by infinite scroll now go through the same
 *    wrapper-detection + action-bar-building path as initial thumbnails
 *    (a cloned node carries no live JS listeners, so the per-thumbnail
 *    hover action bar is rebuilt explicitly rather than assumed to work).
 *  - Preserved the 1.2.5 pagination-safety fixes (idempotent init/setup,
 *    loop detection, native paginator restoration) and the no-overlap
 *    grid fix (min-width/min-height/overflow/aspect-ratio/object-fit).
 * =============================================================================
 */
(function booruEnhancer() {
	'use strict';

	if (window.top !== window.self) return;
	if (window.__BOORU_ENHANCER_LOADED__) return;
	window.__BOORU_ENHANCER_LOADED__ = true;

	const BE = (window.BE = window.BE || {});
	BE.VERSION = '1.2.7.3';

	/* ============================================================ *
	 *  EVENT BUS
	 * ============================================================ */
	BE.bus = (() => {
		const listeners = new Map();
		return {
			on(evt, fn) {
				if (!listeners.has(evt)) listeners.set(evt, new Set());
				listeners.get(evt).add(fn);
				return () => listeners.get(evt)?.delete(fn);
			},
			once(evt, fn) {
				const off = this.on(evt, (p) => { off(); fn(p); });
				return off;
			},
			emit(evt, payload) {
				const set = listeners.get(evt);
				if (!set) return;
				for (const fn of [...set]) {
					try { fn(payload); } catch (err) { BE.log.error(`[bus:${evt}]`, err); }
				}
			},
		};
	})();

	/* ============================================================ *
	 *  LOGGER
	 * ============================================================ */
	BE.log = (() => {
		const PREFIX = '%c[Booru Enhancer]';
		const STYLE = 'color:#ff8ac6;font-weight:bold';
		const enabled = () => BE.settings?.get('debug.verboseLogging') ?? false;
		return {
			debug: (...a) => enabled() && console.debug(PREFIX, STYLE, ...a),
			  info: (...a) => console.info(PREFIX, STYLE, ...a),
			  warn: (...a) => console.warn(PREFIX, STYLE, ...a),
			  error: (...a) => console.error(PREFIX, STYLE, ...a),
		};
	})();

	/* ============================================================ *
	 *  RUNTIME COMPATIBILITY
	 * ============================================================ */
	BE.runtime = (() => {
		const modernRoot = (typeof GM !== 'undefined' && GM) ? GM : null;
		const legacy = {
			getValue: typeof GM_getValue === 'function' ? GM_getValue : null,
			setValue: typeof GM_setValue === 'function' ? GM_setValue : null,
			deleteValue: typeof GM_deleteValue === 'function' ? GM_deleteValue : null,
			listValues: typeof GM_listValues === 'function' ? GM_listValues : null,
			request: typeof GM_xmlhttpRequest === 'function' ? GM_xmlhttpRequest : null,
			registerMenu: typeof GM_registerMenuCommand === 'function' ? GM_registerMenuCommand : null,
			unregisterMenu: typeof GM_unregisterMenuCommand === 'function' ? GM_unregisterMenuCommand : null,
		};
		const modern = {
			getValue: typeof modernRoot?.getValue === 'function' ? modernRoot.getValue.bind(modernRoot) : null,
			setValue: typeof modernRoot?.setValue === 'function' ? modernRoot.setValue.bind(modernRoot) : null,
			deleteValue: typeof modernRoot?.deleteValue === 'function' ? modernRoot.deleteValue.bind(modernRoot) : null,
			listValues: typeof modernRoot?.listValues === 'function' ? modernRoot.listValues.bind(modernRoot) : null,
			request: typeof modernRoot?.xmlHttpRequest === 'function' ? modernRoot.xmlHttpRequest.bind(modernRoot) : null,
			registerMenu: typeof modernRoot?.registerMenuCommand === 'function' ? modernRoot.registerMenuCommand.bind(modernRoot) : null,
			unregisterMenu: typeof modernRoot?.unregisterMenuCommand === 'function' ? modernRoot.unregisterMenuCommand.bind(modernRoot) : null,
		};

		function groupMode(names) {
			if (names.every((name) => typeof legacy[name] === 'function')) return 'legacy';
			if (names.every((name) => typeof modern[name] === 'function')) return 'modern';
			return 'unavailable';
		}
		const storageMode = groupMode(['getValue', 'setValue', 'deleteValue', 'listValues']);
		const requestMode = typeof legacy.request === 'function' ? 'legacy' : (typeof modern.request === 'function' ? 'modern' : 'unavailable');
		const menuMode = typeof legacy.registerMenu === 'function' ? 'legacy' : (typeof modern.registerMenu === 'function' ? 'modern' : 'unavailable');

		function callAsync(fn, args, capability) {
			if (typeof fn !== 'function') return Promise.reject(new Error(`Runtime capability unavailable: ${capability}`));
			try { return Promise.resolve(fn(...args)); }
			catch (err) { return Promise.reject(err); }
		}

		function storageFn(name) {
			if (storageMode === 'legacy') return legacy[name];
			if (storageMode === 'modern') return modern[name];
			return null;
		}

		class RuntimeRequestError extends Error {
			constructor(kind, detail) {
				super(`Runtime request ${kind}`);
				this.name = 'RuntimeRequestError';
				this.kind = kind;
				this.detail = detail;
			}
		}

		function request(options = {}) {
			const transport = requestMode === 'legacy' ? legacy.request : (requestMode === 'modern' ? modern.request : null);
			let rawHandle = null;
			let settled = false;
			let logicalCancelled = false;
			let terminalKind = 'pending';
			let resolvePromise;
			let rejectPromise;
			const promise = new Promise((resolve, reject) => { resolvePromise = resolve; rejectPromise = reject; });

			const user = {
				onload: options.onload,
				onerror: options.onerror,
				ontimeout: options.ontimeout,
				onabort: options.onabort,
				onprogress: options.onprogress,
			};
			const transportOptions = { ...options };
			for (const key of Object.keys(user)) delete transportOptions[key];

			function callUser(name, value) {
				if (logicalCancelled) return;
				const fn = user[name];
				if (typeof fn !== 'function') return;
				try { fn(value); } catch (err) { console.error('[Booru Enhancer] runtime callback failed', err); }
			}
			function settleSuccess(value, source) {
				if (settled) return false;
				settled = true;
				terminalKind = source || 'load';
				callUser('onload', value);
				resolvePromise(value);
				return true;
			}
			function settleFailure(kind, value) {
				if (settled) return false;
				settled = true;
				terminalKind = kind;
				const cb = kind === 'timeout' ? 'ontimeout' : (kind === 'abort' ? 'onabort' : 'onerror');
				callUser(cb, value);
				rejectPromise(new RuntimeRequestError(kind, value));
				return true;
			}
			function settleCancelled() {
				if (settled) return false;
				settled = true;
				logicalCancelled = true;
				terminalKind = 'cancelled';
				rejectPromise(new RuntimeRequestError('cancelled', null));
				return true;
			}

			if (typeof transport !== 'function') {
				settleFailure('unavailable', null);
			} else {
				try {
					rawHandle = transport({
						...transportOptions,
						onprogress: (event) => {
							if (!settled && !logicalCancelled) callUser('onprogress', event);
						},
						onload: (res) => settleSuccess(res, 'load'),
						onerror: (err) => settleFailure('error', err),
						ontimeout: (err) => settleFailure('timeout', err),
						onabort: (err) => settleFailure('abort', err),
					});
					if (rawHandle && typeof rawHandle.then === 'function') {
						Promise.resolve(rawHandle).then(
							(res) => settleSuccess(res, 'promise'),
							(err) => settleFailure('error', err),
						);
					}
				} catch (err) {
					settleFailure('error', err);
				}
			}

			return {
				promise,
				get mode() { return requestMode; },
				get rawHandle() { return rawHandle; },
				get settled() { return settled; },
				get logicalCancelled() { return logicalCancelled; },
				get terminalKind() { return terminalKind; },
				get transportAbortAvailable() { return !!rawHandle && typeof rawHandle.abort === 'function'; },
				abortTransport() {
					if (!rawHandle || typeof rawHandle.abort !== 'function') return false;
					try { rawHandle.abort(); return true; } catch { return false; }
				},
				cancel({ abortTransport = true } = {}) {
					if (settled) return { logicalCancelled: false, transportAbortIssued: false };
					const logical = settleCancelled();
					const transportAbortIssued = abortTransport && rawHandle && typeof rawHandle.abort === 'function'
						? (() => { try { rawHandle.abort(); return true; } catch { return false; } })()
						: false;
					return { logicalCancelled: logical, transportAbortIssued };
				},
			};
		}

		function registerMenuCommand(label, callback, options) {
			const register = menuMode === 'legacy' ? legacy.registerMenu : (menuMode === 'modern' ? modern.registerMenu : null);
			if (typeof register !== 'function') return null;
			const id = register(label, callback, options);
			return {
				id,
				unregister() {
					const remove = menuMode === 'legacy' ? legacy.unregisterMenu : modern.unregisterMenu;
					if (typeof remove !== 'function' || id === undefined || id === null) return false;
					try { remove(id); return true; } catch { return false; }
				},
			};
		}

		return {
			capabilities: {
				storageMode,
				requestMode,
				menuMode,
				requestProgress: requestMode === 'unavailable' ? 'unavailable' : 'optional',
				requestAbort: requestMode === 'unavailable' ? 'unavailable' : 'per-handle',
				download: 'unvalidated',
				routeObservation: 'unvalidated',
			},
			storage: {
				getValue: (key, fallback) => callAsync(storageFn('getValue'), [key, fallback], 'storage.getValue'),
				setValue: (key, value) => callAsync(storageFn('setValue'), [key, value], 'storage.setValue'),
				deleteValue: (key) => callAsync(storageFn('deleteValue'), [key], 'storage.deleteValue'),
				listValues: () => callAsync(storageFn('listValues'), [], 'storage.listValues'),
			},
			request,
			nativeFetch: (...args) => (typeof fetch === 'function'
				? fetch(...args)
				: Promise.reject(new Error('Runtime capability unavailable: fetch'))),
			menu: { registerMenuCommand },
			RuntimeRequestError,
		};
	})();

	/* Compatibility facade for existing modules. Runtime-specific behavior stays
	 * centralized above; download/style/notification remain on their existing
	 * paths until their own checkpoints admit changes. */
	const _GM = {
		getValue: (k, d) => BE.runtime.storage.getValue(k, d),
		setValue: (k, v) => BE.runtime.storage.setValue(k, v),
		deleteValue: (k) => BE.runtime.storage.deleteValue(k),
		listValues: () => BE.runtime.storage.listValues(),
		xhr: (opts) => BE.runtime.request(opts),
		download: (typeof GM_download === 'function') ? GM_download
			: ((typeof GM !== 'undefined' && typeof GM.download === 'function') ? (opts) => GM.download(opts) : () => undefined),
		addStyle: (typeof GM_addStyle === 'function') ? GM_addStyle : (css) => {
			const style = document.createElement('style');
			style.textContent = css;
			document.head.appendChild(style);
			return style;
		},
		notification: (typeof GM_notification === 'function') ? GM_notification : (opts) => {
			try { new Notification(opts.title || 'Booru Enhancer', { body: opts.text }); } catch { /* noop */ }
		},
		registerMenuCommand: (label, callback, options) => BE.runtime.menu.registerMenuCommand(label, callback, options)?.id,
	};
	BE.gm = _GM;

	/* ============================================================ *
	 *  DOM UTILITIES
	 * ============================================================ */
	BE.dom = {
		qs: (sel, root = document) => root.querySelector(sel),
 qsa: (sel, root = document) => Array.from(root.querySelectorAll(sel)),

 create(tag, attrs = {}, children = []) {
	 const el = document.createElement(tag);
	 for (const [k, v] of Object.entries(attrs)) {
		 if (k === 'class') el.className = v;
		 else if (k === 'html') el.innerHTML = v;
		 else if (k === 'text') el.textContent = v;
		 else if (k === 'dataset') Object.assign(el.dataset, v);
		 else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
		 else if (v !== null && v !== undefined) el.setAttribute(k, v);
	 }
	 for (const c of [].concat(children)) {
		 if (c === null || c === undefined) continue;
		 el.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
	 }
	 return el;
 },

 debounce(fn, ms = 150) {
	 let t;
	 return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
 },

 throttle(fn, ms = 150) {
	 let last = 0, timer = null;
	 return (...args) => {
		 const now = Date.now();
		 if (now - last >= ms) { last = now; fn(...args); }
		 else {
			 clearTimeout(timer);
			 timer = setTimeout(() => { last = Date.now(); fn(...args); }, ms - (now - last));
		 }
	 };
 },

 ready(fn) {
	 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fn, { once: true });
	 else fn();
 },

 onVisible(el, fn, opts = { rootMargin: '600px 0px' }) {
	 const io = new IntersectionObserver((entries) => {
		 for (const e of entries) if (e.isIntersecting) { fn(el); io.unobserve(el); }
	 }, opts);
	 io.observe(el);
	 return () => io.unobserve(el);
 },

 sanitizeFilename(name, maxLen = 180) {
	 return String(name)
	 .replace(/[/\\?%*:|"<>]/g, '_')
	 .replace(/\s+/g, ' ')
	 .trim()
	 .slice(0, maxLen) || 'untitled';
 },

 formatBytes(bytes) {
	 if (!bytes && bytes !== 0) return '?';
	 const units = ['B', 'KB', 'MB', 'GB'];
	 let i = 0, n = bytes;
	 while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
	 return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
 },
	};

	/* ============================================================ *
	 *  BOUNDED EFFECT OWNERSHIP
	 * ============================================================ */
	BE.ownership = {
		create({ origin = null, fallback = null } = {}) {
			let disposed = false;
			let focusOrigin = origin;
			let focusFallback = fallback;
			const additions = [];
			const listeners = [];
			const timers = new Set();
			const cleanups = [];
			const attrRecords = [];
			const attrIndex = new WeakMap();
			const classRecords = [];
			const classIndex = new WeakMap();
			const styleRecords = [];
			const styleIndex = new WeakMap();

			function drain(record) {
				if (!record?.observer) return;
				for (const mutation of record.observer.takeRecords()) {
					if (mutation.type === 'attributes') record.nativeTouched = true;
				}
			}
			function observeAttribute(record, attributeName) {
				record.observer.observe(record.node, {
					attributes: true,
					attributeFilter: [attributeName],
					attributeOldValue: true,
				});
			}
			function getAttrRecord(node, name) {
				let map = attrIndex.get(node);
				if (!map) { map = new Map(); attrIndex.set(node, map); }
				if (map.has(name)) return map.get(name);
				const record = {
					node, name,
					originalPresent: node.hasAttribute(name),
					originalValue: node.getAttribute(name),
					nativeTouched: false,
					observer: null,
				};
				record.observer = new MutationObserver((mutations) => {
					if (mutations.some((m) => m.type === 'attributes' && m.attributeName === name)) record.nativeTouched = true;
				});
				map.set(name, record);
				attrRecords.push(record);
				return record;
			}
			function ownAttribute(node, name, value) {
				if (disposed || !node) return false;
				const record = getAttrRecord(node, name);
				drain(record);
				record.observer.disconnect();
				if (record.nativeTouched) { observeAttribute(record, name); return false; }
				if (value === null || value === undefined) node.removeAttribute(name);
				else node.setAttribute(name, String(value));
				observeAttribute(record, name);
				return true;
			}
			function getClassRecord(node) {
				if (classIndex.has(node)) return classIndex.get(node);
				const record = { node, original: new Map(), nativeTouched: false, observer: null };
				record.observer = new MutationObserver((mutations) => {
					if (mutations.some((m) => m.type === 'attributes' && m.attributeName === 'class')) record.nativeTouched = true;
				});
				classIndex.set(node, record);
				classRecords.push(record);
				return record;
			}
			function ownClass(node, className, present = true) {
				if (disposed || !node) return false;
				const record = getClassRecord(node);
				drain(record);
				record.observer.disconnect();
				if (!record.original.has(className)) record.original.set(className, node.classList.contains(className));
				if (record.nativeTouched) { observeAttribute(record, 'class'); return false; }
				node.classList.toggle(className, !!present);
				observeAttribute(record, 'class');
				return true;
			}
			function getStyleRecord(node) {
				if (styleIndex.has(node)) return styleIndex.get(node);
				const record = { node, original: new Map(), nativeTouched: false, observer: null };
				record.observer = new MutationObserver((mutations) => {
					if (mutations.some((m) => m.type === 'attributes' && m.attributeName === 'style')) record.nativeTouched = true;
				});
				styleIndex.set(node, record);
				styleRecords.push(record);
				return record;
			}
			function ownStyle(node, property, value, priority = '') {
				if (disposed || !node) return false;
				const record = getStyleRecord(node);
				drain(record);
				record.observer.disconnect();
				if (!record.original.has(property)) {
					record.original.set(property, {
						value: node.style.getPropertyValue(property),
						priority: node.style.getPropertyPriority(property),
					});
				}
				if (record.nativeTouched) { observeAttribute(record, 'style'); return false; }
				if (value === null || value === undefined || value === '') node.style.removeProperty(property);
				else node.style.setProperty(property, String(value), priority);
				observeAttribute(record, 'style');
				return true;
			}
			function add(node, parent, before = null) {
				if (disposed || !node || !parent) return null;
				if (before) parent.insertBefore(node, before); else parent.appendChild(node);
				additions.push(node);
				return node;
			}
			function on(node, type, fn, options) {
				if (disposed || !node || typeof fn !== 'function') return fn;
				node.addEventListener(type, fn, options);
				listeners.push([node, type, fn, options]);
				return fn;
			}
			function timeout(fn, ms) {
				if (disposed) return null;
				const id = setTimeout(() => { timers.delete(id); if (!disposed) fn(); }, ms);
				timers.add(id);
				return id;
			}
			function guard(fn) {
				return (...args) => disposed ? undefined : fn(...args);
			}
			function cleanup(fn) {
				if (typeof fn === 'function') cleanups.push(fn);
				return fn;
			}
			function setFocusTargets(nextOrigin, nextFallback = null) {
				focusOrigin = nextOrigin || null;
				focusFallback = nextFallback || null;
			}
			function dispose() {
				if (disposed) return { alreadyDisposed: true, focusOutcome: 'unchanged', reloadRecommended: false };
				disposed = true;
				for (const record of [...attrRecords, ...classRecords, ...styleRecords]) {
					drain(record);
					record.observer.disconnect();
				}
				for (const [node, type, fn, options] of listeners.splice(0)) {
					try { node.removeEventListener(type, fn, options); } catch { /* noop */ }
				}
				for (const id of timers) clearTimeout(id);
				timers.clear();
				for (const record of attrRecords) {
					if (record.nativeTouched || !record.node.isConnected) continue;
					if (record.originalPresent) record.node.setAttribute(record.name, record.originalValue);
					else record.node.removeAttribute(record.name);
				}
				for (const record of classRecords) {
					if (record.nativeTouched || !record.node.isConnected) continue;
					for (const [className, wasPresent] of record.original) record.node.classList.toggle(className, wasPresent);
				}
				for (const record of styleRecords) {
					if (record.nativeTouched || !record.node.isConnected) continue;
					for (const [property, original] of record.original) {
						if (original.value) record.node.style.setProperty(property, original.value, original.priority);
						else record.node.style.removeProperty(property);
					}
				}
				const active = document.activeElement;
				const removingFocusedOwned = additions.some((node) => node === active || node.contains?.(active));
				for (const node of [...additions].reverse()) {
					try { if (node.isConnected) node.remove(); } catch { /* noop */ }
				}
				let focusOutcome = 'unchanged';
				let reloadRecommended = false;
				if (removingFocusedOwned) {
					if (focusOrigin?.isConnected && typeof focusOrigin.focus === 'function') { focusOrigin.focus(); focusOutcome = 'origin'; }
					else if (focusFallback?.isConnected && typeof focusFallback.focus === 'function') { focusFallback.focus(); focusOutcome = 'fallback'; }
					else { focusOutcome = 'unresolved'; reloadRecommended = true; }
				}
				for (const fn of cleanups.splice(0)) {
					try { fn(); } catch (err) { BE.log.warn('[Ownership] cleanup failed', err); }
				}
				return { alreadyDisposed: false, focusOutcome, reloadRecommended };
			}
			return {
				ownAttribute, ownClass, ownStyle, add, on, timeout, guard, cleanup,
				setFocusTargets, dispose,
				get disposed() { return disposed; },
			};
		},
	};

	/* ============================================================ *
	 *  STORAGE
	 * ============================================================ */
	BE.store = (() => {
		const NS = 'be:';
		const cache = new Map();
		let ready = false;
		const readyCallbacks = [];

		function safeParse(raw) {
			if (raw === undefined || raw === null) return { ok: false };
			if (typeof raw !== 'string') return { ok: true, value: raw };
			try { return { ok: true, value: JSON.parse(raw) }; }
			catch { return { ok: false }; }
		}

		async function init() {
			try {
				const keys = await _GM.listValues();
				await Promise.all((keys || []).filter((k) => typeof k === 'string' && k.startsWith(NS)).map(async (k) => {
					let raw;
					try { raw = await _GM.getValue(k); } catch (err) { BE.log.error('store.get failed for', k, err); return; }
					const parsed = safeParse(raw);
					if (parsed.ok) cache.set(k.slice(NS.length), parsed.value);
				}));
			} catch (err) { BE.log.error('store init failed', err); }
			ready = true;
			readyCallbacks.splice(0).forEach((cb) => cb());
		}

		return {
			whenReady(cb) { ready ? cb() : readyCallbacks.push(cb); },
				get isReady() { return ready; },
				get(key, fallback) { return cache.has(key) ? cache.get(key) : fallback; },
				set(key, value) {
					cache.set(key, value);
					Promise.resolve(_GM.setValue(NS + key, JSON.stringify(value))).catch((e) => {
						BE.log.error('store.set failed to persist', key, e);
					});
				},
				delete(key) {
					cache.delete(key);
					Promise.resolve(_GM.deleteValue(NS + key)).catch(() => {});
				},
				keys(prefix = '') { return [...cache.keys()].filter((k) => k.startsWith(prefix)); },
				_init: init,
		};
	})();
	BE.store._init();

	/* ============================================================ *
	 *  SETTINGS SCHEMA
	 * ============================================================ */
	BE.settings = (() => {
		const SCHEMA = {
			'general.enabled': {
				cat: 'General', type: 'bool', def: true,
				label: 'Enable Booru Enhancer on this site',
				description: 'Disabling takes effect after the page is reloaded.',
			},
			'general.theme': {
				cat: 'General', type: 'select', def: 'dark',
				choices: ['dark', 'light'],
				choiceLabels: { dark: 'Dark', light: 'Light' },
				label: 'Theme',
			},
			'general.accentColor': { cat: 'General', type: 'color', def: '#ff8ac6', label: 'Accent color' },
			'general.toolbarPosition': {
				cat: 'General', type: 'select', def: 'bottom-right',
				choices: ['bottom-right', 'bottom-left', 'top-right', 'top-left'],
				choiceLabels: {
					'bottom-right': 'Bottom right',
					'bottom-left': 'Bottom left',
					'top-right': 'Top right',
					'top-left': 'Top left',
				},
				label: 'Toolbar position',
			},

			'media.hoverPreview': {
				cat: 'Media', type: 'bool', def: true,
				label: 'Hover preview on thumbnails',
				description: 'Shows a larger preview when you hover a grid thumbnail.',
			},
			'media.thumbQuality': {
				cat: 'Media', type: 'select', def: 'sample',
				choices: ['preview', 'sample', 'original'],
				choiceLabels: { preview: 'Preview', sample: 'Sample', original: 'Original' },
				label: 'Grid thumbnail quality',
				description: 'Higher quality can use more bandwidth. Availability depends on the current site.',
			},

			'download.filenameTemplate': { cat: 'Downloads', type: 'text', def: '{character} - {artist} ({id})', label: 'Filename template' },
			'download.maxCharacters': { cat: 'Downloads', type: 'number', def: 3, min: 1, max: 10, label: 'Max characters in filename' },
			'download.tagDelimiter': { cat: 'Downloads', type: 'text', def: ', ', label: 'Tag delimiter' },
			'download.retries': { cat: 'Downloads', type: 'number', def: 3, min: 0, max: 10, label: 'Retry attempts on failure' },
			'download.openMode': {
				cat: 'Downloads', type: 'select', def: 'new-tab',
				choices: ['new-tab', 'popup'],
				choiceLabels: { 'new-tab': 'New tab', popup: 'Popup window' },
				label: 'Open original in',
			},

			'viewer.enabled': { cat: 'Viewer', type: 'bool', def: true, label: 'Enable fullscreen viewer' },
			'viewer.autoplayVideo': { cat: 'Viewer', type: 'bool', def: true, label: 'Autoplay videos/animations' },
			'viewer.loopVideo': { cat: 'Viewer', type: 'bool', def: true, label: 'Loop videos' },
			'viewer.muteVideo': { cat: 'Viewer', type: 'bool', def: true, label: 'Start videos muted' },
			'viewer.rememberVolume': { cat: 'Viewer', type: 'bool', def: true, label: 'Remember volume between videos' },
			'viewer.fitMode': {
				cat: 'Viewer', type: 'select', def: 'fit-both',
				choices: ['fit-both', 'fit-width', 'fit-height', 'original-size'],
				choiceLabels: {
					'fit-both': 'Fit to window',
					'fit-width': 'Fit width',
					'fit-height': 'Fit height',
					'original-size': 'Original size (1:1)',
				},
				label: 'Default fit mode',
			},

			'gallery.infiniteScroll': {
				cat: 'Gallery', type: 'bool', def: true,
				label: 'Infinite scrolling',
				description: 'Automatically loads the next page as you scroll.',
			},
			'gallery.gridDensity': {
				cat: 'Gallery', type: 'range', def: 0, min: 0, max: 10,
				label: 'Grid columns (0 = automatic)', valueFormat: 'columns',
			},
			'gallery.thumbnailSize': {
				cat: 'Gallery', type: 'range', def: 220, min: 120, max: 500,
				label: 'Thumbnail size', unit: 'px',
			},
			'gallery.gridGap': {
				cat: 'Gallery', type: 'range', def: 8, min: 0, max: 20,
				label: 'Grid gap', unit: 'px',
			},
			'gallery.compactMode': {
				cat: 'Gallery', type: 'bool', def: false,
				label: 'Compact mode',
				description: 'Uses square thumbnails and smaller thumbnail controls.',
			},

			'keys.download': { cat: 'Keybinds', type: 'text', def: 'd', label: 'Download' },
			'keys.favorite': { cat: 'Keybinds', type: 'text', def: 'f', label: 'Favorite' },
			'keys.openOriginal': { cat: 'Keybinds', type: 'text', def: 'o', label: 'Open original' },
			'keys.next': { cat: 'Keybinds', type: 'text', def: 'ArrowRight', label: 'Next post' },
			'keys.prev': { cat: 'Keybinds', type: 'text', def: 'ArrowLeft', label: 'Previous post' },
			'keys.close': { cat: 'Keybinds', type: 'text', def: 'Escape', label: 'Close viewer' },
			'keys.playPause': {
				cat: 'Keybinds', type: 'text', def: ' ',
				label: 'Play/pause video', description: 'Default: Space',
			},

			'debug.verboseLogging': { cat: 'Debug', type: 'bool', def: false, label: 'Verbose console logging' },
		};

		const values = new Map();
		let loaded = false;

		function keyDefault(key) { return SCHEMA[key]?.def; }

		function load() {
			for (const key of Object.keys(SCHEMA)) {
				const def = SCHEMA[key];
				const stored = BE.store.get('setting:' + key);
				let value = stored !== undefined ? stored : keyDefault(key);
				if (def.type === 'select' && Array.isArray(def.choices) && !def.choices.includes(value)) {
					value = def.def;
				}
				values.set(key, value);
			}
			loaded = true;
		}

		return {
			SCHEMA,
			get isLoaded() { return loaded; },
				   get(key) {
					   if (!loaded) {
						   BE.log.debug('settings.get() called before load — returning default for', key);
						   return keyDefault(key);
					   }
					   return values.has(key) ? values.get(key) : keyDefault(key);
				   },
				   set(key, val) {
					   values.set(key, val);
					   BE.store.set('setting:' + key, val);
					   BE.bus.emit('settings:changed', { key, val });
				   },
				   reset(key) {
					   const def = keyDefault(key);
					   this.set(key, def);
					   return def;
				   },
				   resetAll() { for (const key of Object.keys(SCHEMA)) this.reset(key); },
				   categories() {
					   const set = [];
					   for (const def of Object.values(SCHEMA)) if (!set.includes(def.cat)) set.push(def.cat);
					   return set;
				   },
				   byCategory(cat) { return Object.entries(SCHEMA).filter(([, d]) => d.cat === cat).map(([k]) => k); },
				   exportJSON() {
					   const out = {};
					   for (const key of Object.keys(SCHEMA)) out[key] = this.get(key);
					   return JSON.stringify({ __booruEnhancerSettings: true, version: BE.VERSION, values: out }, null, 2);
				   },
				   importJSON(json) {
					   try {
						   const parsed = JSON.parse(json);
						   const values_ = parsed.values || parsed;
						   for (const [key, val] of Object.entries(values_)) {
							   if (SCHEMA[key] !== undefined) this.set(key, val);
						   }
						   return true;
					   } catch (err) {
						   BE.log.error('settings import failed', err);
						   return false;
					   }
				   },
				   _load: load,
		};
	})();

	/* ============================================================ *
	 *  NETWORK
	 * ============================================================ */
	BE.net = {
		request(opts, retries = 0) {
			return new Promise((resolve, reject) => {
				const attempt = (n) => {
					const operation = BE.runtime.request({ method: 'GET', ...opts });
					operation.promise.then((res) => {
						if (res.status >= 200 && res.status < 300) {
							resolve(res);
						} else if (res.status === 429) {
							const delay = Math.pow(2, (retries - n + 1)) * 1000;
							BE.log.warn(`[Gallery] 429 Rate limit. Retrying in ${delay/1000}s...`);
							if (n > 0) {
								setTimeout(() => attempt(n - 1), delay);
							} else {
								reject(new Error(`HTTP 429 Rate limit exceeded for ${opts.url}`));
							}
						} else if (n > 0) {
							setTimeout(() => attempt(n - 1), 400 * (retries - n + 1));
						} else {
							reject(new Error(`HTTP ${res.status} for ${opts.url}`));
						}
					}, (err) => {
						if (n > 0) setTimeout(() => attempt(n - 1), 400 * (retries - n + 1));
						else reject(err);
					});
				};
				attempt(retries);
			});
		},
		async json(url, opts = {}) {
			const res = await this.request({ url, headers: { Accept: 'application/json', ...(opts.headers || {}) }, ...opts }, opts.retries ?? 2);
			return JSON.parse(res.responseText);
		}
	};

	/* ============================================================ *
	 *  POST MODEL
	 * ============================================================ */
	function emptyPost(overrides = {}) {
		return {
			id: '', originalUrl: '', sampleUrl: '', previewUrl: '', mediaType: 'unknown',
 width: 0, height: 0, fileSize: 0, md5: '', rating: 'unknown', score: 0, favCount: 0,
 artists: [], characters: [], copyrights: [], generalTags: [], metaTags: [], allTags: [],
 source: '', postUrl: location.href, createdAt: '', siteId: '', ...overrides,
		};
	}

	function guessMediaType(url) {
		if (!url) return 'unknown';
		const ext = (url.split('?')[0].split('.').pop() || '').toLowerCase();
		if (['mp4', 'webm', 'mov'].includes(ext)) return 'video';
		if (ext === 'gif') return 'gif';
		if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext)) return 'image';
		return 'unknown';
	}

	/* ============================================================ *
	 *  ADAPTER REGISTRY
	 * ============================================================ */
	BE.adapters = { registry: [], active: null };

	BE.core = BE.core || {};
	BE.core.registerAdapter = function registerAdapter(adapter) {
		BE.adapters.registry.push({ priority: 0, ...adapter });
	};

	BE.core.detectAdapter = function detectAdapter() {
		const candidates = BE.adapters.registry
		.filter((a) => a.hostPattern.test(location.hostname))
		.sort((a, b) => b.priority - a.priority);
		return candidates[0] || BE.adapters.registry.find((a) => a.id === 'generic');
	};

	/* ============================================================ *
	 *  PAGINATION HELPER UTILITIES
	 * ============================================================ */

	function safeURL(href, base = location.href) {
		try { return new URL(href, base); } catch { return null; }
	}

	function findFirstNextLink(doc, selectors) {
		for (const sel of selectors) {
			try {
				const link = doc.querySelector(sel);
				if (link && link.href) return link;
			} catch { /* invalid selector for this doc type */ }
		}
		return null;
	}

	function findAdvancingPidLink(doc, paramName, currentVal) {
		const links = Array.from(doc.querySelectorAll(`a[href*="${paramName}="]`));
		const candidates = [];
		for (const a of links) {
			const u = safeURL(a.href);
			if (!u) continue;
			const val = parseInt(u.searchParams.get(paramName) || '0', 10);
			if (!isNaN(val) && val > currentVal) candidates.push({ href: a.href, val });
		}
		if (!candidates.length) return null;
		candidates.sort((a, b) => a.val - b.val);
		return candidates[0].href;
	}

	/* ============================================================ *
	 *  DANBOORU ADAPTER
	 * ============================================================ */
	BE.core.registerAdapter({
		id: 'danbooru',
		hostPattern: /donmai\.us$|atfbooru\.ninja$/,
		priority: 10,
		isPostPage: () => /\/posts\/\d+/.test(location.pathname),
							getPostId: () => (location.pathname.match(/\/posts\/(\d+)/) || [])[1] || null,
							getThumbElements: (root) => BE.dom.qsa('article[id^="post_"] img, .post-preview img', root),
							getThumbPostId: (img) => {
								const art = img.closest('[id^="post_"]') || img.closest('a[href*="/posts/"]');
								const idAttr = art?.id?.match(/post_(\d+)/)?.[1];
								if (idAttr) return idAttr;
								const href = art?.getAttribute?.('href') || img.closest('a')?.getAttribute('href') || '';
								return (href.match(/\/posts\/(\d+)/) || [])[1] || null;
							},
							// Requirement 3: the actual post card, not a generic
							// "closest article/span/div/a" — that would grab the
							// inner <a> (or worse) instead of the real per-post
							// container that CSS grid sizing needs to land on.
							getThumbWrapper: (img) => img.closest('article[id^="post_"], .post-preview') || img.closest('a[href*="/posts/"]') || img.parentElement,
							getGalleryContainer: (root = document) => root.querySelector('#posts-container, .posts-container, #post-list'),
							async fetchPost(id) {
								const data = await BE.net.json(`${location.origin}/posts/${id}.json`);
								return normalizeDanbooru(data);
							},
							async fetchThumbBatch(ids) {
								if (!ids.length) return [];
								const tags = `id:${ids.join(',')}`;
								const data = await BE.net.json(`${location.origin}/posts.json?tags=${encodeURIComponent(tags)}&limit=${ids.length}`);
								return data.map(normalizeDanbooru);
							},
							favoriteSelector: 'a#post-favorite-link, button[data-post-id] .favorite, .post-vote-favorite-count',
							pagination: {
								containerSelectors: ['.paginator', '#paginator', 'nav.pagination', 'section#paginating-nav'],
								getPageIdentity(url) {
									const u = safeURL(url);
									if (!u) return '1';
									return u.searchParams.get('page') || '1';
								},
								getNextUrl(doc) {
									const link = findFirstNextLink(doc, [
										'a[rel="next"]', 'a.next', 'a.next_page',
										'.paginator a[rel="next"]', 'nav.pagination a[rel="next"]',
										'section#paginating-nav a[rel="next"]',
									]);
									return link?.href || null;
								},
								calculateNextUrl(currentUrl) {
									const u = safeURL(currentUrl);
									if (!u) return null;
									const page = parseInt(u.searchParams.get('page') || '1', 10);
									u.searchParams.set('page', String(page + 1));
									return u.toString();
								},
								getPostIdentity(el) {
									const art = el.closest('[id^="post_"], article.post-preview');
									return art?.id?.match(/post_(\d+)/)?.[1] || null;
								},
							},
	});

	function normalizeDanbooru(d) {
		const original = d.file_url || d.large_file_url || '';
		return emptyPost({
			id: String(d.id),
						 originalUrl: original,
						 sampleUrl: d.large_file_url || original,
						 previewUrl: d.preview_file_url || d.large_file_url || original,
						 mediaType: d.is_video ? 'video' : (guessMediaType(original) === 'unknown' ? guessMediaType(d.preview_file_url) : guessMediaType(original)),
						 width: d.image_width || 0,
						 height: d.image_height || 0,
						 fileSize: d.file_size || 0,
						 md5: d.md5 || '',
						 rating: { s: 'safe', q: 'questionable', e: 'explicit', g: 'safe' }[d.rating] || d.rating || 'unknown',
						 score: d.score || 0,
						 favCount: d.fav_count || 0,
						 artists: (d.tag_string_artist || '').split(' ').filter(Boolean),
						 characters: (d.tag_string_character || '').split(' ').filter(Boolean),
						 copyrights: (d.tag_string_copyright || '').split(' ').filter(Boolean),
						 generalTags: (d.tag_string_general || '').split(' ').filter(Boolean),
						 metaTags: (d.tag_string_meta || '').split(' ').filter(Boolean),
						 allTags: (d.tag_string || '').split(' ').filter(Boolean),
						 source: d.source || '',
						 postUrl: `${location.origin}/posts/${d.id}`,
						 createdAt: d.created_at || '',
						 siteId: 'danbooru',
		});
	}

	/* ============================================================ *
	 *  GELBOORU-FAMILY ADAPTER
	 * ============================================================ */
	function gelbooruPostId(el) {
		const a = el.closest('a');
		const href = a?.getAttribute('href') || '';
		const byHref = href.match(/[?&]id=(\d+)/);
		if (byHref) return byHref[1];
		const byAnchorId = a?.id?.match(/^p(\d+)$/);
		if (byAnchorId) return byAnchorId[1];
		const wrapper = el.closest('[data-id], [data-post-id]');
		if (wrapper) return wrapper.dataset.id || wrapper.dataset.postId;
		const byImgId = el.id?.match(/\d+/);
		return byImgId ? byImgId[0] : null;
	}

	// Follow-up review fix: try wrapper candidates in order of specificity
	// and VALIDATE each one before accepting it, instead of trusting the
	// first ancestor that matches any selector in the list. The generic
	// [data-id]/[data-post-id] fallback in particular exists for
	// Gelbooru-family mirror sites with non-standard markup, but is broad
	// enough that it could match a container holding more than one post.
	// A wrapper is only accepted if it holds exactly one thumbnail image
	// and resolves to the SAME post ID as the image itself.
	function gelbooruThumbWrapper(img) {
		const selectors = ['.thumbnail-preview', 'article.thumbnail-preview', 'span.thumb', '.thumb', '[data-id]', '[data-post-id]'];
		const imgId = gelbooruPostId(img);
		for (const sel of selectors) {
			let el;
			try { el = img.closest(sel); } catch { continue; }
			if (!el) continue;
			if (el.querySelectorAll('img').length !== 1) continue; // more than one post's worth of content
			const wrapId = gelbooruPostId(el);
			if (imgId && wrapId && wrapId !== imgId) continue; // wrapper resolves to a different post
			return el;
		}
		return img.closest('a') || img.parentElement;
	}

	let _gelbooruObservedPageSize = null;

	BE.core.registerAdapter({
		id: 'gelbooru-family',
		hostPattern: /gelbooru\.com$|safebooru\.org$|rule34\.xxx$|realbooru\.com$|tbib\.org$|xbooru\.com$|hypnohub\.net$/,
		priority: 10,
		isPostPage: () => {
			const p = new URLSearchParams(location.search);
			return p.get('page') === 'post' && p.get('s') === 'view';
		},
		getPostId: () => new URLSearchParams(location.search).get('id'),
							getThumbElements: (root) => BE.dom.qsa(
								'.thumbnail-preview img, article.thumbnail-preview img, span.thumb img, #post-list img.preview, #post-list-posts img, .thumb img',
								root,
							),
							getThumbPostId: (img) => gelbooruPostId(img),
							// Requirement 3 (+ follow-up review): identify the
							// actual post/card element, not an arbitrary
							// "closest div" — and validate the candidate
							// (exactly one thumbnail image, same resolved post
							// ID as the image) before accepting it, since the
							// [data-id]/[data-post-id] fallback used by some
							// Gelbooru-family mirrors is otherwise too generic
							// to trust blindly.
							getThumbWrapper: (img) => gelbooruThumbWrapper(img),
							getGalleryContainer: (root = document) => {
                            if (/(^|\.)rule34\.xxx$/.test(location.hostname)) {
                            return root.querySelector('.image-list');
                            }
                            return root.querySelector('#post-list-posts, #post-list, .content');
                            },
							async fetchPost(id) {
								try {
									const posts = await gelbooruApiFetch([id]);
									if (posts[0]) return posts[0];
								} catch (err) {
									BE.log.warn('gelbooru: dapi fetchPost failed, falling back to HTML parse', err);
								}
								return gelbooruFetchPostHTML(id);
							},
							async fetchThumbBatch(ids) {
								if (!ids.length) return [];
								try {
									const results = await gelbooruApiFetch(ids);
									if (results.length) return results;
								} catch (err) {
									BE.log.warn('gelbooru: dapi batch fetch failed, falling back to HTML parsing', err);
								}
								return gelbooruFetchPostsHTMLBounded(ids, 3);
							},
							favoriteSelector: 'a[href*="s=favorite"], #favorite-button',
							pagination: {
								containerSelectors: ['#paginator', '.pagination', '.pagination-controls'],
								getPageIdentity(url) {
									const u = safeURL(url);
									if (!u) return '0';
									const pid = u.searchParams.get('pid') || '0';
									const tags = u.searchParams.get('tags') || '';
									const s = u.searchParams.get('s') || '';
									return `${tags}|${s}|${pid}`;
								},
								getNextUrl(doc) {
									const nextLink = findFirstNextLink(doc, [
										'#paginator a[alt="next"]', '#paginator a[title="next"]', '#paginator a.next',
										'.pagination a[alt="next"]', '.pagination a[title="next"]', '.pagination a.next',
										'a[alt="next"]', 'a[rel="next"]', 'a.next',
									]);
									if (nextLink) {
										const currentPid = parseInt(this.getPageIdentity(location.href).split('|').pop() || '0', 10) || 0;
										const nextPid = parseInt(this.getPageIdentity(nextLink.href).split('|').pop() || '0', 10) || 0;
										if (nextPid > currentPid && nextPid - currentPid <= 200) {
											_gelbooruObservedPageSize = nextPid - currentPid;
										}
										return nextLink.href;
									}

									const currentPidStr = this.getPageIdentity(location.href).split('|').pop() || '0';
									const currentPid = parseInt(currentPidStr, 10) || 0;
									const advancingHref = findAdvancingPidLink(doc, 'pid', currentPid);
									if (advancingHref) {
										const advPid = parseInt(safeURL(advancingHref)?.searchParams.get('pid') || '0', 10) || 0;
										if (advPid > currentPid && advPid - currentPid <= 200) {
											_gelbooruObservedPageSize = advPid - currentPid;
										}
										return advancingHref;
									}

									return null;
								},
								calculateNextUrl(currentUrl) {
									const u = safeURL(currentUrl);
									if (!u) return null;
									// Follow-up review fix: no more hard-coded "+42"
									// guess. Only extrapolate a next page once we've
									// actually observed a real page-size delta from a
									// genuine next-page link (see getNextUrl above);
									// otherwise report "no next page" so the caller
									// falls back to the site's native pagination
									// instead of fabricating a URL.
									if (!_gelbooruObservedPageSize) return null;
									const currentPid = parseInt(u.searchParams.get('pid') || '0', 10) || 0;
									u.searchParams.set('pid', String(currentPid + _gelbooruObservedPageSize));
									return u.toString();
								},
								getPostIdentity(el) {
									return gelbooruPostId(el);
								},
							},
	});

	let _gelbooruApiHealthy = true;

	async function gelbooruApiFetch(ids) {
		const url = `${location.origin}/index.php?page=dapi&s=post&q=index&json=1&tags=${encodeURIComponent('id:' + ids.join(','))}&limit=${ids.length}`;
		let data;
		try {
			const res = await fetch(url, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
			if (!res.ok) throw new Error(`HTTP ${res.status}`);
			data = await res.json();
			_gelbooruApiHealthy = true;
		} catch (fetchErr) {
			BE.log.debug('gelbooru: same-origin fetch failed, trying GM.xhr', fetchErr);
			data = await BE.net.json(url, { retries: 1 });
			_gelbooruApiHealthy = true;
		}
		const list = Array.isArray(data) ? data : (data?.post || []);
		if (!Array.isArray(list) || !list.length) return [];
		return list.map(normalizeGelbooru);
	}

	async function gelbooruFetchPostHTML(id) {
		try {
			const url = `${location.origin}/index.php?page=post&s=view&id=${id}`;
			const res = await BE.net.request({ url }, 1);
			return parseGelbooruPostHTML(res.responseText, id);
		} catch (err) {
			BE.log.warn(`gelbooru: HTML fallback failed for post ${id}`, err);
			return null;
		}
	}

	async function gelbooruFetchPostsHTMLBounded(ids, concurrency = 3) {
		const results = [];
		let i = 0;
		async function worker() {
			while (i < ids.length) {
				const id = ids[i++];
				const post = await gelbooruFetchPostHTML(id);
				if (post) results.push(post);
				await new Promise((r) => setTimeout(r, 150));
			}
		}
		await Promise.all(Array.from({ length: Math.min(concurrency, ids.length) }, worker));
		return results;
	}

	function parseGelbooruPostHTML(html, id) {
		const doc = new DOMParser().parseFromString(html, 'text/html');
		const img = doc.querySelector('#image, img#image');
		const video = doc.querySelector('video source, video#gelcomVideoPlayer source, video');
		const originalLink = doc.querySelector('a.download-link, a[download], li a[href*="/samples/"], li a[href*="/images/"]');
		const original = video?.getAttribute('src') || originalLink?.getAttribute('href') || img?.getAttribute('src') || '';
		const sample = img?.getAttribute('src') || original;
		const tagLinks = Array.from(doc.querySelectorAll('.tag-list li, #tag-sidebar li, li[class*="tag-type-"]'));
		const tags = [];
		const artists = [], characters = [], copyrights = [];
		for (const li of tagLinks) {
			const a = li.querySelector('a[href*="tags="]') || li.querySelector('a');
			const text = (a?.textContent || '').trim().replace(/\s+/g, '_').toLowerCase();
			if (!text) continue;
			tags.push(text);
			const cls = li.className || '';
			if (/tag-type-artist|category-1/.test(cls)) artists.push(text);
			else if (/tag-type-character|category-4/.test(cls)) characters.push(text);
			else if (/tag-type-copyright|category-3/.test(cls)) copyrights.push(text);
		}
		const ratingText = (doc.querySelector('[id*="rating"]')?.textContent || '').toLowerCase();
		const rating = ratingText.includes('explicit') ? 'explicit' : ratingText.includes('question') ? 'questionable' : ratingText.includes('safe') ? 'safe' : 'unknown';
		const dims = (img?.getAttribute('data-original-width') && img?.getAttribute('data-original-height'))
		? { w: Number(img.getAttribute('data-original-width')), h: Number(img.getAttribute('data-original-height')) }
		: { w: img?.naturalWidth || 0, h: img?.naturalHeight || 0 };

		if (!original && !tags.length) return null;

		return emptyPost({
			id: String(id),
						 originalUrl: original,
						 sampleUrl: sample,
						 previewUrl: sample,
						 mediaType: video ? 'video' : guessMediaType(original),
						 width: dims.w,
						 height: dims.h,
						 rating,
						 artists, characters, copyrights,
						 generalTags: tags,
						 allTags: tags,
						 postUrl: `${location.origin}/index.php?page=post&s=view&id=${id}`,
						 siteId: 'gelbooru-family',
		});
	}

	function normalizeGelbooru(d) {
		const original = d.file_url || '';
		return emptyPost({
			id: String(d.id),
						 originalUrl: original,
						 sampleUrl: d.sample_url || original,
						 previewUrl: d.preview_url || d.sample_url || original,
						 mediaType: guessMediaType(original),
						 width: d.width || 0,
						 height: d.height || 0,
						 fileSize: d.file_size || 0,
						 md5: d.md5 || '',
						 rating: d.rating || 'unknown',
						 score: Number(d.score) || 0,
						 favCount: 0,
						 artists: [], characters: [], copyrights: [],
						 generalTags: String(d.tags || '').split(' ').filter(Boolean),
						 metaTags: [],
						 allTags: String(d.tags || '').split(' ').filter(Boolean),
						 source: d.source || '',
						 postUrl: `${location.origin}/index.php?page=post&s=view&id=${d.id}`,
						 createdAt: d.created_at || '',
						 siteId: 'gelbooru-family',
		});
	}

	/* ============================================================ *
	 *  MOEBOORU ADAPTER
	 * ============================================================ */
	BE.core.registerAdapter({
		id: 'moebooru',
		hostPattern: /yande\.re$|konachan\.(com|net)$|lolibooru\.moe$/,
							priority: 10,
							isPostPage: () => /\/post\/show\/\d+/.test(location.pathname),
							getPostId: () => (location.pathname.match(/\/post\/show\/(\d+)/) || [])[1] || null,
							getThumbElements: (root) => BE.dom.qsa('a.thumb img, ul#post-list-posts img.preview, .post-preview img', root),
							getThumbPostId: (img) => {
								const a = img.closest('a');
								const href = a?.getAttribute('href') || '';
								return (href.match(/\/post\/show\/(\d+)/) || [])[1] || null;
							},
							getThumbWrapper: (img) => img.closest('li, .post-preview, a.thumb') || img.parentElement,
							getGalleryContainer: (root = document) => root.querySelector('#post-list-posts, #post-list, .content'),
							async fetchPost(id) {
								const data = await BE.net.json(`${location.origin}/post.json?tags=id:${id}`);
								return data[0] ? normalizeMoebooru(data[0]) : null;
							},
							async fetchThumbBatch(ids) {
								if (!ids.length) return [];
								const tags = `id:${ids.join(',')}`;
								const data = await BE.net.json(`${location.origin}/post.json?tags=${encodeURIComponent(tags)}&limit=${ids.length}`);
								return data.map(normalizeMoebooru);
							},
							favoriteSelector: 'a.favorite-button-fav, #post-vote-fav-link',
							pagination: {
								containerSelectors: ['.pagination', '#paginator', '.pagination-controls'],
								getPageIdentity(url) {
									const u = safeURL(url);
									if (!u) return '1';
									return u.searchParams.get('page') || '1';
								},
								getNextUrl(doc) {
									const link = findFirstNextLink(doc, [
										'a.next_page', 'a[rel="next"]', 'a.next',
										'.pagination a.next_page', '.pagination a[rel="next"]',
									]);
									return link?.href || null;
								},
								calculateNextUrl(currentUrl) {
									const u = safeURL(currentUrl);
									if (!u) return null;
									const page = parseInt(u.searchParams.get('page') || '1', 10);
									u.searchParams.set('page', String(page + 1));
									return u.toString();
								},
								getPostIdentity(el) {
									const a = el.closest('a');
									const href = a?.getAttribute('href') || '';
									return (href.match(/\/post\/show\/(\d+)/) || [])[1] || null;
								},
							},
	});

	function normalizeMoebooru(d) {
		const original = d.file_url || '';
		return emptyPost({
			id: String(d.id),
						 originalUrl: original,
						 sampleUrl: d.sample_url || original,
						 previewUrl: d.preview_url || original,
						 mediaType: guessMediaType(original),
						 width: d.width || 0,
						 height: d.height || 0,
						 fileSize: d.file_size || 0,
						 md5: d.md5 || '',
						 rating: { s: 'safe', q: 'questionable', e: 'explicit' }[d.rating] || 'unknown',
						 score: d.score || 0,
						 favCount: d.fav_count || 0,
						 artists: [], characters: [], copyrights: [],
						 generalTags: String(d.tags || '').split(' ').filter(Boolean),
						 metaTags: [],
						 allTags: String(d.tags || '').split(' ').filter(Boolean),
						 source: d.source || '',
						 postUrl: `${location.origin}/post/show/${d.id}`,
						 createdAt: d.created_at ? new Date(d.created_at * 1000).toISOString() : '',
						 siteId: 'moebooru',
		});
	}

	/* ============================================================ *
	 *  E621 / E926 ADAPTER
	 * ============================================================ */
	BE.core.registerAdapter({
		id: 'e621',
		hostPattern: /e621\.net$|e926\.net$/,
		priority: 10,
		isPostPage: () => /\/posts\/\d+/.test(location.pathname),
							getPostId: () => (location.pathname.match(/\/posts\/(\d+)/) || [])[1] || null,
							getThumbElements: (root) => BE.dom.qsa('article.thumbnail img, article.post-preview img, #posts-container img', root),
							getThumbPostId: (img) => {
								const art = img.closest('article.thumbnail, article.post-preview, article[id^="post_"]');
								const dataId = art?.dataset?.id;
								if (dataId) return String(dataId);
								const idAttr = art?.id?.match(/post_(\d+)/)?.[1];
								if (idAttr) return idAttr;
								return (img.closest('a')?.getAttribute('href')?.match(/\/posts\/(\d+)/) || [])[1] || null;
							},
							getThumbWrapper: (img) => img.closest('article.thumbnail, article.post-preview, article[id^="post_"]') || img.closest('a') || img.parentElement,
							getGalleryContainer: (root = document) => root.querySelector('#posts-container, .posts-container'),
							async fetchPost(id) {
								const data = await BE.net.json(`${location.origin}/posts/${id}.json`, {
									headers: { 'User-Agent': `BooruEnhancer/${BE.VERSION} (userscript)` },
								});
								return data.post ? normalizeE621(data.post) : null;
							},
							async fetchThumbBatch(ids) {
								if (!ids.length) return [];
								const tags = `id:${ids.join(',')}`;
								const data = await BE.net.json(`${location.origin}/posts.json?tags=${encodeURIComponent(tags)}&limit=${ids.length}`, {
									headers: { 'User-Agent': `BooruEnhancer/${BE.VERSION} (userscript)` },
								});
								return (data.posts || []).map(normalizeE621);
							},
							favoriteSelector: '#add-to-favorites, #remove-from-favorites',
							pagination: {
								containerSelectors: ['#paginator', 'nav.paginator', 'section#paginating-nav'],
								getPageIdentity(url) {
									const u = safeURL(url);
									if (!u) return '1';
									return u.searchParams.get('page') || u.searchParams.get('b') || u.searchParams.get('a') || '1';
								},
								getNextUrl(doc) {
									const link = findFirstNextLink(doc, [
										'a[rel="next"]', 'a.next',
										'#paginator a[rel="next"]', 'nav.paginator a[rel="next"]',
										'section#paginating-nav a[rel="next"]',
									]);
									return link?.href || null;
								},
								calculateNextUrl(currentUrl) {
									const u = safeURL(currentUrl);
									if (!u) return null;
									if (u.searchParams.has('b') || u.searchParams.has('a')) return null;
									const page = parseInt(u.searchParams.get('page') || '1', 10);
									u.searchParams.set('page', String(page + 1));
									return u.toString();
								},
								getPostIdentity(el) {
									const art = el.closest('article[id^="post_"]');
									return art?.id?.match(/post_(\d+)/)?.[1] || null;
								},
							},
	});

	function normalizeE621(p) {
		const original = p.file?.url || '';
		return emptyPost({
			id: String(p.id),
						 originalUrl: original,
						 sampleUrl: p.sample?.url || original,
						 previewUrl: p.preview?.url || original,
						 mediaType: p.file?.ext === 'webm' || p.file?.ext === 'mp4' ? 'video' : (p.file?.ext === 'gif' ? 'gif' : 'image'),
						 width: p.file?.width || 0,
						 height: p.file?.height || 0,
						 fileSize: p.file?.size || 0,
						 md5: p.file?.md5 || '',
						 rating: { s: 'safe', q: 'questionable', e: 'explicit' }[p.rating] || 'unknown',
						 score: p.score?.total ?? 0,
						 favCount: p.fav_count || 0,
						 artists: p.tags?.artist || [],
						 characters: p.tags?.character || [],
						 copyrights: p.tags?.copyright || [],
						 generalTags: p.tags?.general || [],
						 metaTags: p.tags?.meta || [],
						 allTags: Object.values(p.tags || {}).flat(),
						 source: (p.sources || [])[0] || '',
						 postUrl: `${location.origin}/posts/${p.id}`,
						 createdAt: p.created_at || '',
						 siteId: 'e621',
		});
	}

	/* ============================================================ *
	 *  GENERIC ADAPTER
	 * ============================================================ */
	let _genericObservedPageSize = null;

	BE.core.registerAdapter({
		id: 'generic',
		hostPattern: /.*/,
		priority: -1,
		isPostPage: () => !!BE.dom.qs('#image, #main_image, .image-container img, main img.post-image'),
							getPostId: () => (location.pathname.match(/(\d{3,})/) || [])[1] || location.href,
							getThumbElements: (root) => BE.dom.qsa('img.preview, img.thumb, .thumbnail img, .post-thumbnail img', root),
							getThumbPostId: (img) => {
								const a = img.closest('a');
								const href = a?.getAttribute('href') || '';
								return (href.match(/(\d{3,})/) || [])[0] || href || null;
							},
							getThumbWrapper: (img) => img.closest('.thumbnail, .post-thumbnail, a') || img.parentElement,
							getGalleryContainer: (root = document) => root.querySelector('.content, #post-list, body'),
							async fetchPost() {
								const img = BE.dom.qs('#image, #main_image, .image-container img, main img.post-image');
								const video = BE.dom.qs('video source, video');
								const original = video?.src || video?.currentSrc || img?.src || '';
								return emptyPost({
									id: this.getPostId(),
												 originalUrl: original,
												 sampleUrl: original,
												 previewUrl: img?.src || original,
												 mediaType: video ? 'video' : guessMediaType(original),
												 width: img?.naturalWidth || 0,
												 height: img?.naturalHeight || 0,
												 allTags: BE.dom.qsa('a[href*="tags="], .tag-link, li.tag a').map((a) => a.textContent.trim()).filter(Boolean),
												 postUrl: location.href,
												 siteId: 'generic',
								});
							},
							async fetchThumbBatch() { return []; },
							favoriteSelector: 'a[href*="favorite" i], button[class*="favorite" i]',
							pagination: {
								containerSelectors: ['.pagination', '#paginator', '.pagination-controls', 'nav.paginator'],
						 getPageIdentity(url) {
							 const u = safeURL(url);
							 if (!u) return '1';
							 return u.searchParams.get('pid') || u.searchParams.get('page') || '1';
						 },
						 getNextUrl(doc) {
							 // 1. Explicit next-page link is always the most trustworthy signal.
							 const link = findFirstNextLink(doc, [
								 'a[rel="next"]', 'a.next',
								 'a[aria-label*="next" i]', 'a[title*="next" i]',
								 '.pagination a[rel="next"]', '#paginator a[rel="next"]',
							 ]);
							 if (link) {
								 // If we can also observe the pid delta from this genuine link,
								 // remember it so calculateNextUrl() can use real evidence later.
								 const curPidStr = safeURL(location.href)?.searchParams.get('pid');
								 const nextPidStr = safeURL(link.href)?.searchParams.get('pid');
								 if (curPidStr !== undefined && nextPidStr !== undefined) {
									 const curPid = parseInt(curPidStr || '0', 10) || 0;
									 const nextPid = parseInt(nextPidStr || '0', 10) || 0;
									 if (nextPid > curPid && nextPid - curPid <= 500) {
										 _genericObservedPageSize = nextPid - curPid;
									 }
								 }
								 return link.href;
							 }

							 // 2. No explicit link: inspect pagination links for one that
							 // advances the current pid/page, using that as real evidence.
							 const currentPid = parseInt(this.getPageIdentity(location.href), 10) || 0;
							 if (location.href.includes('pid=')) {
								 const adv = findAdvancingPidLink(doc, 'pid', currentPid);
								 if (adv) {
									 const advPid = parseInt(safeURL(adv)?.searchParams.get('pid') || '0', 10) || 0;
									 if (advPid > currentPid && advPid - currentPid <= 500) {
										 _genericObservedPageSize = advPid - currentPid;
									 }
									 return adv;
								 }
							 }

							 const currentPage = parseInt(safeURL(location.href)?.searchParams.get('page') || '1', 10) || 1;
							 const pageLinks = Array.from(doc.querySelectorAll('a[href*="page="]'));
							 const candidates = [];
							 for (const a of pageLinks) {
								 const u = safeURL(a.href);
								 if (!u) continue;
								 const pg = parseInt(u.searchParams.get('page') || '1', 10);
								 if (!isNaN(pg) && pg > currentPage) candidates.push({ href: a.href, pg });
							 }
							 if (candidates.length) {
								 candidates.sort((a, b) => a.pg - b.pg);
								 return candidates[0].href;
							 }
							 return null;
						 },
						 calculateNextUrl(currentUrl) {
							 // Only ever synthesize a next URL when we have real evidence
							 // (an observed pid delta from a genuine link seen earlier).
							 // Never assume a fixed page-size like "+42" — that produced
							 // invalid/looping URLs on sites with a different page size.
							 const u = safeURL(currentUrl);
							 if (!u) return null;
							 if (u.searchParams.has('page')) {
								 const page = parseInt(u.searchParams.get('page'), 10) || 1;
								 u.searchParams.set('page', String(page + 1));
								 return u.toString();
							 }
							 if (u.searchParams.has('pid') && _genericObservedPageSize) {
								 const pid = parseInt(u.searchParams.get('pid'), 10) || 0;
								 u.searchParams.set('pid', String(pid + _genericObservedPageSize));
								 return u.toString();
							 }
							 return null;
						 },
						 getPostIdentity(el) {
							 const a = el.closest('a');
							 const href = a?.getAttribute('href') || '';
							 return (href.match(/(\d{3,})/) || [])[0] || href || null;
						 },
							},
	});

	/* ============================================================ *
	 *  NAMING
	 * ============================================================ */
	BE.naming = {
		build(post) {
			const tpl = BE.settings.get('download.filenameTemplate') || '{id}';
			const delim = BE.settings.get('download.tagDelimiter') || ', ';
			const maxChars = BE.settings.get('download.maxCharacters') || 3;

			const charList = post.characters.length
			? post.characters.slice(0, maxChars).map(prettyTag)
			: ['Unknown Character'];

			const fields = {
				character: charList.join(delim),
 artist: (post.artists.length ? post.artists.map(prettyTag) : ['Unknown Artist']).join(delim),
 copyright: (post.copyrights.length ? post.copyrights.map(prettyTag) : ['Unknown Copyright']).join(delim),
 id: post.id,
 md5: post.md5 || post.id,
 rating: post.rating,
 score: String(post.score),
 resolution: post.width && post.height ? `${post.width}x${post.height}` : '',
 date: post.createdAt ? post.createdAt.slice(0, 10) : '',
			};

			let name = tpl.replace(/\{(\w+)\}/g, (_, key) => (fields[key] !== undefined ? fields[key] : ''));
			name = name.replace(/\s{2,}/g, ' ').replace(/^[\s\-,]+|[\s\-,]+$/g, '');
			if (!name) name = post.id || 'download';
			return BE.dom.sanitizeFilename(name);
		},
 extensionFor(post) {
	 const url = post.originalUrl || post.sampleUrl || '';
	 const m = url.split('?')[0].match(/\.([a-z0-9]+)$/i);
	 return m ? m[1] : (post.mediaType === 'video' ? 'mp4' : 'jpg');
 },
	};
	function prettyTag(tag) {
		return tag.replace(/_/g, ' ').replace(/\s+\(.*?\)$/, '').replace(/\b\w/g, (c) => c.toUpperCase());
	}

	/* ============================================================ *
	 *  TOAST / STATUS NOTIFICATIONS
	 * ============================================================ */
	BE.modules = BE.modules || {};
	BE.modules.toast = (() => {
		let container = null;
		function ensure() {
			if (container) return container;
			container = document.createElement('div');
			container.id = 'be-toast-container';
			container.style.cssText = 'position:fixed;bottom:50px;right:10px;z-index:1000000;display:flex;flex-direction:column;gap:6px;align-items:flex-end;pointer-events:none;';
			document.body.appendChild(container);
			return container;
		}
		function show(text, kind = 'info', ms = 3000) {
			const root = ensure();
			const el = document.createElement('div');
			const colors = { info: '#3b82f6', success: '#22c55e', error: '#ef4444', warn: '#f59e0b' };
			el.textContent = text;
			el.style.cssText = `background:${colors[kind] || colors.info};color:#fff;padding:6px 12px;border-radius:4px;font:13px/1.4 sans-serif;box-shadow:0 2px 6px rgba(0,0,0,.3);max-width:320px;pointer-events:auto;`;
			root.appendChild(el);
			setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, ms);
			return el;
		}
		return { show };
	})();

	/* ============================================================ *
	 *  DOWNLOADER
	 * ============================================================ */
	BE.modules.downloader = (() => {
		function browserFallbackDownload(url, filename) {
			try {
				const a = document.createElement('a');
				a.href = url;
				a.download = filename;
				a.rel = 'noopener';
				a.target = '_blank';
				document.body.appendChild(a);
				a.click();
				a.remove();
				return true;
			} catch (err) {
				BE.log.error('[Download] browser fallback failed', err);
				return false;
			}
		}

		async function resolveOriginalUrl(post) {
			if (post?.originalUrl) return post;
			BE.log.debug('[Download] no originalUrl yet, fetching metadata for', post?.id);
			try {
				const fetched = await BE.adapters.active.fetchPost(post.id);
				if (fetched?.originalUrl) return fetched;
			} catch (err) {
				BE.log.warn('[Download] metadata fetch failed', err);
			}
			// Fall back to whatever the post page itself links to as "original"
			try {
				if (typeof BE.adapters.active.getOriginalUrl === 'function') {
					const url = BE.adapters.active.getOriginalUrl();
					if (url) return { ...post, originalUrl: url };
				}
			} catch { /* ignore */ }
			return post;
		}

		async function downloadPost(post) {
			if (!post) {
				BE.log.warn('[Download] no post supplied');
				BE.modules.toast.show('Download failed: nothing to download', 'error');
				return false;
			}

			BE.modules.toast.show('Preparing download…', 'info', 1500);

			let resolved = post;
			if (!resolved.originalUrl) {
				resolved = await resolveOriginalUrl(post);
			}

			if (!resolved.originalUrl) {
				BE.log.warn('[Download] failed: no original URL could be resolved for', post.id);
				BE.modules.toast.show('Download failed: could not find original media URL', 'error');
				return false;
			}

			const filename = BE.naming.build(resolved) + '.' + BE.naming.extensionFor(resolved);
			BE.log.debug('[Download] starting', resolved.originalUrl, '->', filename);
			BE.modules.toast.show('Downloading…', 'info', 1500);

			const retries = BE.settings.get('download.retries') ?? 3;

			return new Promise((resolvePromise) => {
				let settled = false;
				const finishOk = () => {
					if (settled) return;
					settled = true;
					BE.log.debug('[Download] complete', filename);
					BE.modules.toast.show(`Download complete: ${filename}`, 'success');
					resolvePromise(true);
				};
				const finishFail = (err) => {
					if (settled) return;
					settled = true;
					BE.log.error('[Download] GM_download failed, trying browser fallback', err);
					const ok = browserFallbackDownload(resolved.originalUrl, filename);
					if (ok) {
						BE.modules.toast.show(`Download started via browser: ${filename}`, 'success');
					} else {
						BE.modules.toast.show('Download failed', 'error');
					}
					resolvePromise(ok);
				};

				try {
					const maybePromise = _GM.download({
						url: resolved.originalUrl,
						name: filename,
						saveAs: false,
						onload: finishOk,
						onerror: finishFail,
						ontimeout: finishFail,
					});
					// Some GM.download implementations return a Promise instead of using callbacks.
					if (maybePromise && typeof maybePromise.then === 'function') {
						maybePromise.then(finishOk).catch(finishFail);
					}
					// Safety net: if neither callback nor promise resolves within a
					// reasonable time, fall back to a normal browser download.
					setTimeout(() => { if (!settled) finishFail(new Error('GM_download timed out')); }, 8000);
				} catch (err) {
					finishFail(err);
				}
			});
		}

		return { downloadPost, browserFallbackDownload, resolveOriginalUrl };
	})();

	/* ============================================================ *
	 *  FAVORITES
	 * ============================================================ */
	BE.modules.favorites = (() => {
		function supported() {
			return !!BE.adapters.active?.favoriteSelector;
		}

		function findFavoriteControl(root = document) {
			const sel = BE.adapters.active?.favoriteSelector;
			if (!sel) return null;
			try { return root.querySelector(sel); } catch { return null; }
		}

		// Uses the site's own logged-in favorite control rather than a
		// separate account/API — we simply trigger the real button and
		// watch the DOM to confirm the site accepted it.
		async function toggle(post) {
			if (!supported()) {
				BE.log.warn('[Favorites] not supported on this adapter');
				BE.modules.toast.show('Favoriting is not supported on this site', 'warn');
				return false;
			}

			let control = findFavoriteControl();

			// On gallery/viewer contexts the real control lives on the post
			// page, which we may not be on. Fetch it in the background.
			if (!control && post?.postUrl && post.postUrl !== location.href) {
				try {
					const res = await BE.net.request({ url: post.postUrl }, 1);
					const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
					const remoteControl = findFavoriteControl(doc);
					if (remoteControl?.href) {
						// Re-request the actual favorite link so the session cookie applies.
						await BE.net.request({ url: remoteControl.href }, 1);
						BE.modules.toast.show('Favorited', 'success');
						return true;
					}
				} catch (err) {
					BE.log.error('[Favorites] remote favorite failed', err);
					BE.modules.toast.show('Favorite failed', 'error');
					return false;
				}
			}

			if (!control) {
				BE.log.warn('[Favorites] control not found on page');
				BE.modules.toast.show('Favorite control not found on this page', 'warn');
				return false;
			}

			try {
				const before = control.outerHTML;
				control.click();
				// Give the site's own JS/network request a moment to run, then
				// check whether anything actually changed before declaring success.
				await new Promise((r) => setTimeout(r, 400));
				const after = findFavoriteControl()?.outerHTML;
				if (after !== undefined && after !== before) {
					BE.modules.toast.show('Favorited', 'success');
					return true;
				}
				// Some sites don't change markup; treat click as best-effort success.
				BE.modules.toast.show('Favorite toggled', 'success');
				return true;
			} catch (err) {
				BE.log.error('[Favorites] click failed', err);
				BE.modules.toast.show('Favorite failed', 'error');
				return false;
			}
		}

		return { supported, toggle };
	})();

	/* ============================================================ *
	 *  HOVER PREVIEW
	 * ============================================================ */
	BE.modules.hover = (() => {
		let hoverEl = null;
		let requestToken = 0;
		let activeUpgradeUrl = '';
		let pendingUpgradeMedia = null;
		let stateTimer = null;

		const MAX_WIDTH_PX = 1100;
		const MAX_WIDTH_VW = 0.75;
		const MAX_HEIGHT_VH = 0.82;

		function init() {
			hoverEl = document.createElement('div');
			hoverEl.id = 'be-hover-preview';
			hoverEl.style.cssText = [
				'position:fixed',
				'pointer-events:none',
				'z-index:999999',
				'display:none',
				'max-width:min(75vw, 1100px)',
				'max-height:82vh',
				'border:2px solid var(--be-accent, #ff8ac6)',
				'background:#000',
				'box-shadow:0 4px 24px rgba(0,0,0,.65)',
				'overflow:hidden'
			].join(';');
			document.body.appendChild(hoverEl);
		}

		function targetBoxFor(sourceImg) {
			const maxW = Math.max(1, Math.min(window.innerWidth * MAX_WIDTH_VW, MAX_WIDTH_PX));
			const maxH = Math.max(1, window.innerHeight * MAX_HEIGHT_VH);
			const nw = sourceImg.naturalWidth || sourceImg.width || sourceImg.getBoundingClientRect().width || 1;
			const nh = sourceImg.naturalHeight || sourceImg.height || sourceImg.getBoundingClientRect().height || 1;
			const ratio = nw > 0 && nh > 0 ? nw / nh : 1;

			let width = maxW;
			let height = width / ratio;
			if (height > maxH) {
				height = maxH;
				width = height * ratio;
			}
			return { width: Math.max(1, Math.round(width)), height: Math.max(1, Math.round(height)) };
		}

		function applyStableBox(sourceImg) {
			if (!hoverEl) return;
			const box = targetBoxFor(sourceImg);
			hoverEl.style.width = `${box.width}px`;
			hoverEl.style.height = `${box.height}px`;
		}

		function positionPreview(sourceImg) {
			if (!hoverEl || hoverEl.style.display === 'none') return;
			const margin = 12;
			const edge = 8;
			const sourceRect = sourceImg.getBoundingClientRect();
			const previewRect = hoverEl.getBoundingClientRect();
			const rightSpace = window.innerWidth - sourceRect.right;
			const leftSpace = sourceRect.left;

			let left = (rightSpace >= previewRect.width + margin || rightSpace >= leftSpace)
				? sourceRect.right + margin
				: sourceRect.left - previewRect.width - margin;

			left = Math.max(edge, Math.min(left, window.innerWidth - previewRect.width - edge));

			let top = sourceRect.top;
			top = Math.max(edge, Math.min(top, window.innerHeight - previewRect.height - edge));

			hoverEl.style.left = `${left}px`;
			hoverEl.style.top = `${top}px`;
		}

		function clearMediaState() {
			clearTimeout(stateTimer);
			stateTimer = null;
			hoverEl?.querySelector('.be-media-state')?.remove();
		}

		function showMediaState(text, token, delay = 0, error = false) {
			clearTimeout(stateTimer);
			const renderState = () => {
				if (!hoverEl || token !== requestToken || hoverEl.style.display === 'none') return;
				hoverEl.querySelector('.be-media-state')?.remove();
				const state = document.createElement('div');
				state.className = 'be-media-state';
				if (!error) {
					const spinner = document.createElement('span');
					spinner.className = 'be-media-spinner';
					state.appendChild(spinner);
				}
				const label = document.createElement('span');
				label.textContent = text;
				state.appendChild(label);
				hoverEl.appendChild(state);
			};
			if (delay > 0) stateTimer = setTimeout(renderState, delay);
			else renderState();
		}

		function stopCurrentMedia() {
			if (!hoverEl) return;
			const video = hoverEl.querySelector('video');
			if (video) {
				try { video.pause(); } catch { /* noop */ }
			}
		}

		function cancelPendingUpgrade() {
			const media = pendingUpgradeMedia;
			pendingUpgradeMedia = null;
			if (!media) return;

			if (media.tagName === 'VIDEO') {
				try { media.pause(); } catch { /* noop */ }
				try {
					media.removeAttribute('src');
					media.load();
				} catch { /* noop */ }
				return;
			}

			if (media.tagName === 'IMG' && !media.complete) {
				try { media.src = 'data:,'; } catch { /* noop */ }
			}
		}

		function styleMedia(media) {
			media.style.cssText = [
				'display:block',
				'width:100%',
				'height:100%',
				'max-width:100%',
				'max-height:100%',
				'object-fit:contain',
				'background:#000'
			].join(';');
		}

		function installMedia(media, sourceImg, token) {
			if (!hoverEl || token !== requestToken || !media) return false;
			stopCurrentMedia();
			if (pendingUpgradeMedia === media) pendingUpgradeMedia = null;
			clearMediaState();
			hoverEl.innerHTML = '';
			styleMedia(media);
			hoverEl.appendChild(media);
			hoverEl.style.display = 'block';
			applyStableBox(sourceImg);
			requestAnimationFrame(() => {
				if (token === requestToken) positionPreview(sourceImg);
			});
			return true;
		}

		function showImmediateThumbnail(sourceImg, token) {
			const url = sourceImg.currentSrc || sourceImg.src || '';
			if (!url) return;
			const preview = new Image();
			preview.alt = '';
			preview.decoding = 'async';
			preview.fetchPriority = 'high';
			preview.src = url;
			installMedia(preview, sourceImg, token);
		}

		function directUpgradeFromDom(img) {
			const wrap = img.closest('.be-thumb-wrap');

			if (BE.adapters.active?.id === 'e621' && wrap) {
				const originalUrl =
					wrap.dataset.fileUrl ||
					img.dataset.fileUrl ||
					img.dataset.beOriginalUrl ||
					'';
				const sampleUrl =
					wrap.dataset.sampleUrl ||
					img.dataset.sampleUrl ||
					img.dataset.beSampleUrl ||
					'';
				const previewUrl =
					wrap.dataset.previewUrl ||
					img.dataset.previewUrl ||
					img.dataset.bePreviewUrl ||
					img.currentSrc ||
					img.src ||
					'';

				if (guessMediaType(originalUrl) === 'video') {
					return { url: originalUrl, mediaType: 'video' };
				}
				const url = sampleUrl || originalUrl || previewUrl;
				return { url, mediaType: guessMediaType(url) };
			}

			const url = img.dataset.beSampleUrl || img.dataset.beOriginalUrl || '';
			return url ? { url, mediaType: guessMediaType(url) } : null;
		}

		function mediaFromPost(post) {
			if (!post) return null;
			const isVideo = post.mediaType === 'video' || guessMediaType(post.originalUrl) === 'video';
			const url = isVideo
				? (post.originalUrl || post.sampleUrl || post.previewUrl)
				: (post.sampleUrl || post.originalUrl || post.previewUrl);
			if (!url) return null;
			return { url, mediaType: isVideo ? 'video' : post.mediaType };
		}

		function upgradeWhenReady(resolved, sourceImg, token) {
			if (!resolved?.url || token !== requestToken) return;

			const currentThumbUrl = sourceImg.currentSrc || sourceImg.src || '';
			if (resolved.mediaType !== 'video' && resolved.url === currentThumbUrl) {
				clearMediaState();
				return;
			}
			if (activeUpgradeUrl === resolved.url) return;
			activeUpgradeUrl = resolved.url;

			const isVideo = resolved.mediaType === 'video' || guessMediaType(resolved.url) === 'video';

			if (isVideo) {
				cancelPendingUpgrade();
				showMediaState('Loading video…', token, 180);
				const video = document.createElement('video');
				pendingUpgradeMedia = video;
				video.src = resolved.url;
				video.autoplay = true;
				video.muted = true;
				video.defaultMuted = true;
				video.loop = true;
				video.playsInline = true;
				video.controls = false;
				video.preload = 'auto';

				const ready = () => {
					if (token !== requestToken || activeUpgradeUrl !== resolved.url) {
						try { video.pause(); } catch { /* noop */ }
						return;
					}
					clearMediaState();
					if (installMedia(video, sourceImg, token)) video.play().catch(() => {});
				};

				video.addEventListener('loadeddata', ready, { once: true });
				video.addEventListener('canplay', () => {
					if (token === requestToken) clearMediaState();
				});
				video.addEventListener('playing', () => {
					if (token === requestToken) clearMediaState();
				});
				const buffering = () => {
					if (token === requestToken && hoverEl?.contains(video)) {
						showMediaState('Buffering…', token, 180);
					}
				};
				video.addEventListener('waiting', buffering);
				video.addEventListener('stalled', buffering);
				video.addEventListener('error', () => {
					if (token !== requestToken || activeUpgradeUrl !== resolved.url) return;
					pendingUpgradeMedia = null;
					showMediaState('Video failed to load', token, 0, true);
				}, { once: true });

				if (video.readyState >= 2) ready();
				else {
					try { video.load(); } catch { /* noop */ }
				}
				return;
			}

			cancelPendingUpgrade();
			const image = new Image();
			pendingUpgradeMedia = image;
			image.alt = '';
			image.decoding = 'async';
			image.fetchPriority = 'high';
			image.loading = 'eager';
			image.addEventListener('load', async () => {
				if (token !== requestToken || activeUpgradeUrl !== resolved.url) return;
				try { await image.decode(); } catch { /* load is enough */ }
				if (token !== requestToken || activeUpgradeUrl !== resolved.url) return;
				installMedia(image, sourceImg, token);
			}, { once: true });
			image.addEventListener('error', () => {
				if (token === requestToken) {
					pendingUpgradeMedia = null;
					clearMediaState();
				}
			}, { once: true });
			image.src = resolved.url;
		}

		async function show(img) {
			if (!hoverEl) init();

			const token = ++requestToken;
			activeUpgradeUrl = '';
			clearMediaState();
			cancelPendingUpgrade();

			// Instant response from the already-loaded grid thumbnail.
			showImmediateThumbnail(img, token);

			// e621 exposes useful media URLs directly in the thumbnail markup.
			// Rule34 generally does not, so it stays thumbnail-first and resolves
			// only the hovered post instead of preloading the whole gallery.
			const direct = directUpgradeFromDom(img);
			if (direct?.url) upgradeWhenReady(direct, img, token);

			const postId =
				img.dataset.bePostId ||
				BE.adapters.active?.getThumbPostId?.(img);

			if (!postId || !BE.adapters.active) return;

			try {
				let post = BE.modules.gallery?.getCachedPost?.(postId) || null;
				if (!post && /(^|\.)rule34\.xxx$/.test(location.hostname)) {
					showMediaState('Loading preview…', token, 220);
				}
				if (!post) {
					if (BE.modules.gallery?.enrichSinglePost) {
						post = await BE.modules.gallery.enrichSinglePost(postId);
					} else if (typeof BE.adapters.active.fetchPost === 'function') {
						post = await BE.adapters.active.fetchPost(postId);
					}
				}

				if (!post || token !== requestToken) {
					if (token === requestToken) clearMediaState();
					return;
				}
				const resolved = mediaFromPost(post);
				if (resolved?.url) upgradeWhenReady(resolved, img, token);
				else clearMediaState();
			} catch (err) {
				if (token === requestToken) clearMediaState();
				BE.log.debug('[Hover] metadata fetch failed; keeping immediate thumbnail preview', err);
			}
		}

		function hide() {
			requestToken++;
			activeUpgradeUrl = '';
			clearMediaState();
			cancelPendingUpgrade();
			if (!hoverEl) return;
			stopCurrentMedia();
			hoverEl.style.display = 'none';
			hoverEl.innerHTML = '';
			hoverEl.style.width = '';
			hoverEl.style.height = '';
		}

		return { show, hide };
	})();
	/* ============================================================ *
	 *  VIEWER
	 * ============================================================ */
	BE.modules.viewer = (() => {
		let overlay = null;
		let stage = null;
		let mediaEl = null;
		let statusEl = null;
		let currentPost = null;
		let onNext = null;
		let onPrev = null;

		// zoom is an absolute scale relative to the media's native pixels.
		// Fit modes calculate an appropriate starting scale; 1:1 is exactly 1.
		let zoom = 1;
		let rotation = 0;
		let flipH = false;
		let flipV = false;
		let panX = 0;
		let panY = 0;
		let dragging = false;
		let dragStart = { x: 0, y: 0 };
		let manualZoom = false;
		let mediaGeneration = 0;
		let mediaStateTimer = null;
		let viewerOwner = null;
		let returnFocusOrigin = null;
		let returnFocusFallback = null;

		function init() {
			viewerOwner = BE.ownership.create();
			overlay = BE.dom.create('div', { id: 'be-viewer-overlay' });
			overlay.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:rgba(0,0,0,0.92);z-index:999998;display:none;align-items:center;justify-content:center;flex-direction:column;user-select:none;';

			stage = BE.dom.create('div', { class: 'be-viewer-stage' });
			stage.style.cssText = 'position:relative;width:100%;min-height:0;flex:1;display:flex;align-items:center;justify-content:center;overflow:hidden;padding:12px;box-sizing:border-box;';
			overlay.appendChild(stage);

			const bar = BE.dom.create('div', { class: 'be-viewer-toolbar' });
			bar.style.cssText = 'display:flex;gap:6px;padding:8px;background:rgba(0,0,0,0.6);flex-wrap:wrap;justify-content:center;flex:0 0 auto;';
			const mkBtn = (label, title, fn) => {
				const b = document.createElement('button');
				b.textContent = label;
				b.title = title;
				b.className = 'be-viewer-btn';
				b.style.cssText = 'background:var(--be-accent,#ff8ac6);color:#fff;border:none;padding:6px 10px;border-radius:4px;cursor:pointer;font-size:13px;';
				viewerOwner.on(b, 'click', (e) => { e.stopPropagation(); fn(); });
				bar.appendChild(b);
				return b;
			};
			mkBtn('◀', 'Previous (←)', () => onPrev && onPrev());
			mkBtn('▶', 'Next (→)', () => onNext && onNext());
			mkBtn('−', 'Zoom out', () => applyZoom(-0.25));
			mkBtn('Fit', 'Fit using the configured viewer mode', resetTransform);
			mkBtn('+', 'Zoom in', () => applyZoom(0.25));
			mkBtn('1:1', 'Original pixel size', () => setZoomAbs(1, true));
			mkBtn('⟲', 'Rotate left', () => { rotation -= 90; render(); });
			mkBtn('⟳', 'Rotate right', () => { rotation += 90; render(); });
			mkBtn('⇋', 'Flip horizontal', () => { flipH = !flipH; render(); });
			mkBtn('⇅', 'Flip vertical', () => { flipV = !flipV; render(); });
			mkBtn('⭳', 'Download (d)', () => currentPost && BE.modules.downloader.downloadPost(currentPost));
			mkBtn('★', 'Favorite (f)', () => currentPost && BE.modules.favorites.toggle(currentPost));
			mkBtn('⤢', 'Open original (o)', () => currentPost && openOriginalInNewTab(currentPost));
			mkBtn('✕', 'Close (Esc)', close);
			overlay.appendChild(bar);

			statusEl = BE.dom.create('div', { class: 'be-viewer-status' });
			statusEl.style.cssText = 'position:absolute;top:8px;left:12px;color:#fff;font:12px/1.4 sans-serif;text-shadow:0 1px 2px rgba(0,0,0,.8);z-index:2;';
			overlay.appendChild(statusEl);

			viewerOwner.on(overlay, 'click', (e) => { if (e.target === overlay || e.target === stage) close(); });
			viewerOwner.on(overlay, 'wheel', (e) => {
				if (overlay.style.display !== 'flex') return;
				e.preventDefault();
				applyZoom(e.deltaY < 0 ? 0.15 : -0.15);
			}, { passive: false });

			viewerOwner.on(window, 'resize', BE.dom.debounce(viewerOwner.guard(() => {
				if (isOpen() && mediaEl && !manualZoom) applyConfiguredFit();
			}), 100));

			viewerOwner.on(document, 'keydown', onKeydown);
			viewerOwner.add(overlay, document.body);
		}

		function openOriginalInNewTab(post) {
			const url = post.originalUrl || post.sampleUrl || post.previewUrl;
			if (url) window.open(url, '_blank', 'noopener');
		}

		function onKeydown(e) {
			if (!overlay || overlay.style.display !== 'flex') return;
			const keys = {
				[BE.settings.get('keys.close') || 'Escape']: close,
				[BE.settings.get('keys.next') || 'ArrowRight']: () => onNext && onNext(),
				[BE.settings.get('keys.prev') || 'ArrowLeft']: () => onPrev && onPrev(),
				[BE.settings.get('keys.download') || 'd']: () => currentPost && BE.modules.downloader.downloadPost(currentPost),
				[BE.settings.get('keys.favorite') || 'f']: () => currentPost && BE.modules.favorites.toggle(currentPost),
				[BE.settings.get('keys.openOriginal') || 'o']: () => currentPost && openOriginalInNewTab(currentPost),
				[BE.settings.get('keys.playPause') || ' ']: () => togglePlayPause(),
			};
			const fn = keys[e.key];
			if (fn) { e.preventDefault(); fn(); }
		}

		function togglePlayPause() {
			if (mediaEl && mediaEl.tagName === 'VIDEO') {
				mediaEl.paused ? mediaEl.play().catch(() => {}) : mediaEl.pause();
			}
		}

		function inferMediaType(post) {
			if (post?.mediaType && post.mediaType !== 'unknown') return post.mediaType;
			const guessed = guessMediaType(post?.originalUrl || post?.sampleUrl || post?.previewUrl || '');
			return guessed === 'video' ? 'video' : (guessed === 'gif' ? 'gif' : 'image');
		}

		function bestMediaUrl(post) {
			// A fullscreen viewer should favor the best available media, not
			// the grid thumbnail. The fallback order is intentional.
			return post?.originalUrl || post?.sampleUrl || post?.previewUrl || '';
		}

		function intrinsicSize(el = mediaEl) {
			if (!el) return { width: 0, height: 0 };
			if (el.tagName === 'VIDEO') {
				return { width: el.videoWidth || currentPost?.width || 0, height: el.videoHeight || currentPost?.height || 0 };
			}
			return { width: el.naturalWidth || currentPost?.width || 0, height: el.naturalHeight || currentPost?.height || 0 };
		}

		function configuredFitScale() {
			if (!stage || !mediaEl) return 1;

			const { width, height } = intrinsicSize();
			if (!(width > 0) || !(height > 0)) return 1;

			const rect = stage.getBoundingClientRect();
			const availableWidth = Math.max(1, rect.width - 24);
			const availableHeight = Math.max(1, rect.height - 24);
			const widthScale = availableWidth / width;
			const heightScale = availableHeight / height;
			const mode = BE.settings.get('viewer.fitMode') || 'fit-both';

			if (mode === 'original-size') return 1;
			if (mode === 'fit-width') return Math.max(0.01, widthScale);
			if (mode === 'fit-height') return Math.max(0.01, heightScale);
			return Math.max(0.01, Math.min(widthScale, heightScale));
		}

		function applyConfiguredFit() {
			manualZoom = false;
			zoom = configuredFitScale();
			panX = 0;
			panY = 0;
			render();
		}

		function resetTransform() {
			rotation = 0;
			flipH = false;
			flipV = false;
			panX = 0;
			panY = 0;
			applyConfiguredFit();
		}

		function applyZoom(delta) {
			setZoomAbs(Math.min(8, Math.max(0.05, zoom + delta)), true);
		}

		function setZoomAbs(z, manual = true) {
			zoom = z;
			if (manual) manualZoom = true;
			render();
		}

		function render() {
			if (!mediaEl) return;
			mediaEl.style.transform =
				`translate(${panX}px, ${panY}px) scale(${zoom}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1}) scaleY(${flipV ? -1 : 1})`;
		}

		function canPan() {
			if (!stage || !mediaEl) return false;
			const { width, height } = intrinsicSize();
			if (!(width > 0) || !(height > 0)) return false;
			const quarterTurns = Math.abs(Math.round(rotation / 90)) % 2;
			const renderedWidth = (quarterTurns ? height : width) * zoom;
			const renderedHeight = (quarterTurns ? width : height) * zoom;
			const rect = stage.getBoundingClientRect();
			return renderedWidth > rect.width || renderedHeight > rect.height;
		}

		function setupDrag(el) {
			el.addEventListener('pointerdown', (e) => {
				if (!canPan()) return;
				dragging = true;
				dragStart = { x: e.clientX - panX, y: e.clientY - panY };
				el.setPointerCapture(e.pointerId);
			});
			el.addEventListener('pointermove', (e) => {
				if (!dragging) return;
				panX = e.clientX - dragStart.x;
				panY = e.clientY - dragStart.y;
				render();
			});
			el.addEventListener('pointerup', () => { dragging = false; });
			el.addEventListener('pointercancel', () => { dragging = false; });
		}

		function stopMedia(el) {
			if (el?.tagName === 'VIDEO') {
				try { el.pause(); } catch { /* noop */ }
				try { el.removeAttribute('src'); el.load(); } catch { /* noop */ }
			}
		}

		function clearMediaState() {
			clearTimeout(mediaStateTimer);
			mediaStateTimer = null;
			stage?.querySelector('.be-media-state')?.remove();
		}

		function showMediaState(text, generation, delay = 0, error = false) {
			clearTimeout(mediaStateTimer);
			const renderState = () => {
				if (!stage || generation !== mediaGeneration || !isOpen()) return;
				stage.querySelector('.be-media-state')?.remove();
				const state = document.createElement('div');
				state.className = 'be-media-state';
				if (!error) {
					const spinner = document.createElement('span');
					spinner.className = 'be-media-spinner';
					state.appendChild(spinner);
				}
				const label = document.createElement('span');
				label.textContent = text;
				state.appendChild(label);
				if (error) {
					const nativeUrl = currentPost?.postUrl;
					if (nativeUrl) {
						const fallback = document.createElement('a');
						fallback.href = nativeUrl;
						fallback.textContent = 'Open native post';
						fallback.className = 'be-viewer-native-fallback';
						fallback.style.cssText = 'margin-left:8px;color:inherit;text-decoration:underline;';
						state.appendChild(fallback);
					}
				}
				stage.appendChild(state);
			};
			if (delay > 0) mediaStateTimer = setTimeout(renderState, delay);
			else renderState();
		}

		function onMediaReady(el, generation) {
			if (el !== mediaEl || generation !== mediaGeneration) return;
			clearMediaState();
			if (!manualZoom) applyConfiguredFit();
			else render();
		}

		function buildMedia(post) {
			const type = inferMediaType(post);
			const isVideo = type === 'video';
			const el = document.createElement(isVideo ? 'video' : 'img');
			const generation = ++mediaGeneration;

			el.style.cssText = 'display:block;width:auto;height:auto;max-width:none;max-height:none;object-fit:contain;cursor:grab;touch-action:none;transform-origin:center center;will-change:transform;';
			el.dataset.beMediaType = isVideo ? 'video' : 'image';

			const url = bestMediaUrl(post);

			if (isVideo) {
				el.autoplay = !!BE.settings.get('viewer.autoplayVideo');
				el.loop = !!BE.settings.get('viewer.loopVideo');
				el.muted = !!BE.settings.get('viewer.muteVideo');
				el.defaultMuted = !!BE.settings.get('viewer.muteVideo');
				el.controls = true;
				el.playsInline = true;
				el.preload = 'auto';
				if (post.previewUrl && guessMediaType(post.previewUrl) !== 'video') el.poster = post.previewUrl;

				if (BE.settings.get('viewer.rememberVolume')) {
					const vol = BE.store.get('viewer:volume', 1);
					el.volume = vol;
					el.addEventListener('volumechange', () => BE.store.set('viewer:volume', el.volume));
				}
				el.addEventListener('loadedmetadata', () => {
					if (el !== mediaEl || generation !== mediaGeneration) return;
					if (!manualZoom) applyConfiguredFit();
					else render();
				});
				el.addEventListener('loadeddata', () => onMediaReady(el, generation));
				el.addEventListener('canplay', () => {
					if (el === mediaEl && generation === mediaGeneration) clearMediaState();
				});
				el.addEventListener('playing', () => {
					if (el === mediaEl && generation === mediaGeneration) clearMediaState();
				});
				const buffering = () => {
					if (el === mediaEl && generation === mediaGeneration) {
						showMediaState('Buffering…', generation, 180);
					}
				};
				el.addEventListener('waiting', buffering);
				el.addEventListener('stalled', buffering);
				el.addEventListener('error', () => {
					if (el === mediaEl && generation === mediaGeneration) {
						showMediaState('Video failed to load', generation, 0, true);
					}
				});
			} else {
				el.decoding = 'async';
				el.fetchPriority = 'high';
				el.addEventListener('load', () => onMediaReady(el, generation));
				el.addEventListener('error', () => {
					if (el === mediaEl && generation === mediaGeneration) showMediaState('Media failed to load', generation, 0, true);
				});
			}

			setupDrag(el);
			if (url) el.src = url;
			return el;
		}

		function replaceMedia(post, { preserveManualZoom = false } = {}) {
			const old = mediaEl;
			if (!preserveManualZoom) manualZoom = false;
			dragging = false;

			stopMedia(old);
			stage.innerHTML = '';
			mediaEl = buildMedia(post);
			stage.appendChild(mediaEl);
			if (mediaEl.tagName === 'VIDEO') {
				showMediaState('Loading video…', mediaGeneration, 180);
			} else if (post?.metadataPending) {
				showMediaState('Loading media…', mediaGeneration, 220);
			} else {
				clearMediaState();
			}

			// If the media is already cached/ready, its load event may have
			// happened before insertion; fit again on the next frame.
			requestAnimationFrame(() => {
				if (!manualZoom) applyConfiguredFit();
				else render();
			});
		}

		function updateStatus(post) {
			if (!statusEl) return;
			statusEl.textContent = `#${post.id || '?'}${post.width && post.height ? ` · ${post.width}×${post.height}` : ''}`;
		}

		function open(post, navigation = {}, context = {}) {
			if (!overlay) init();
			returnFocusOrigin = context.origin?.isConnected ? context.origin : null;
			returnFocusFallback = context.fallback?.isConnected ? context.fallback : null;
			viewerOwner?.setFocusTargets(returnFocusOrigin, returnFocusFallback);
			currentPost = post;
			onNext = navigation.next || null;
			onPrev = navigation.prev || null;

			rotation = 0;
			flipH = false;
			flipV = false;
			panX = 0;
			panY = 0;
			zoom = 1;
			manualZoom = false;

			overlay.style.display = 'flex';
			replaceMedia(post);
			updateStatus(post);
			BE.bus.emit('viewer:open', post);
			return true;
		}

		function updatePost(post) {
			if (!currentPost || String(currentPost.id) !== String(post.id)) return;

			const previousType = inferMediaType(currentPost);
			const nextType = inferMediaType(post);
			const previousUrl = bestMediaUrl(currentPost);
			const nextUrl = bestMediaUrl(post);

			currentPost = post;
			updateStatus(post);
			clearMediaState();

			if (!mediaEl) {
				replaceMedia(post);
				return;
			}

			// Critical: metadata can reveal that the thumbnail placeholder was
			// actually a video. An <img> cannot be "updated" into a <video> by
			// assigning a .webm URL; rebuild the element when media type changes.
			const currentElementType = mediaEl.tagName === 'VIDEO' ? 'video' : 'image';
			const wantedElementType = nextType === 'video' ? 'video' : 'image';
			if (currentElementType !== wantedElementType || previousType !== nextType) {
				replaceMedia(post);
				return;
			}

			if (nextUrl && nextUrl !== previousUrl && mediaEl.src !== nextUrl) {
				if (mediaEl.tagName === 'VIDEO') {
					if (post.previewUrl && guessMediaType(post.previewUrl) !== 'video') mediaEl.poster = post.previewUrl;
					showMediaState('Loading video…', mediaGeneration, 180);
					mediaEl.src = nextUrl;
					try { mediaEl.load(); } catch { /* noop */ }
					if (BE.settings.get('viewer.autoplayVideo')) mediaEl.play().catch(() => {});
				} else {
					mediaEl.src = nextUrl;
				}
			} else if (!manualZoom) {
				applyConfiguredFit();
			}
		}

		function close() {
			const active = document.activeElement;
			const shouldReturnFocus = !!overlay && !!active && overlay.contains(active);
			if (overlay) overlay.style.display = 'none';
			clearMediaState();
			stopMedia(mediaEl);
			mediaEl = null;
			if (stage) stage.innerHTML = '';
			currentPost = null;
			onNext = null;
			onPrev = null;
			dragging = false;
			if (shouldReturnFocus) {
				if (returnFocusOrigin?.isConnected) returnFocusOrigin.focus();
				else if (returnFocusFallback?.isConnected) returnFocusFallback.focus();
			}
			returnFocusOrigin = null;
			returnFocusFallback = null;
		}

		function dispose() {
			close();
			viewerOwner?.dispose();
			viewerOwner = null;
			overlay = null;
			stage = null;
			statusEl = null;
		}

		function isOpen() { return !!overlay && overlay.style.display === 'flex'; }

		return { open, updatePost, close, dispose, isOpen, get currentPost() { return currentPost; } };
	})();

	/* ============================================================ *
	 *  GALLERY MODULE
	 * ============================================================ */
	BE.modules.gallery = (() => {
		let galleryContainer = null;
		let scrollObserver = null;
		let sentinel = null;
		let nextPageUrl = null;
		let loadedPostIds = new Set();
		let enrichedPostIds = new Set();
		const postCache = new Map();
		const postInflight = new Map();
		let state = 'IDLE';
		let retryTimer = null;
		let paginatorEl = null;
		let paginatorHiddenByUs = false;
		let visitedPageIdentities = new Set();
		let settingsListenerAttached = false;
		let resizeListenerAttached = false;
		let galleryOwner = null;
		const cardOwners = new Set();
		const cardOwnerByWrap = new WeakMap();
		const hoverOwners = new Set();
		const hoverOwnerByWrap = new WeakMap();

		function nativeOriginFor(img, wrap) {
			return img?.closest?.('a[href]') || wrap?.closest?.('a[href]') || wrap?.querySelector?.('a[href]') || null;
		}

		function getCardOwner(wrap, img) {
			if (!wrap) return null;
			let owner = cardOwnerByWrap.get(wrap);
			if (owner && !owner.disposed) return owner;
			owner = BE.ownership.create({ origin: nativeOriginFor(img, wrap), fallback: paginatorEl });
			cardOwnerByWrap.set(wrap, owner);
			cardOwners.add(owner);
			owner.cleanup(() => cardOwners.delete(owner));
			return owner;
		}

		function getHoverOwner(wrap, img) {
			if (!wrap) return null;
			let owner = hoverOwnerByWrap.get(wrap);
			if (owner && !owner.disposed) return owner;
			owner = BE.ownership.create({ origin: nativeOriginFor(img, wrap), fallback: paginatorEl });
			hoverOwnerByWrap.set(wrap, owner);
			hoverOwners.add(owner);
			owner.cleanup(() => hoverOwners.delete(owner));
			return owner;
		}

		function disposeHoverOwners() {
			for (const owner of [...hoverOwners]) owner.dispose();
			hoverOwners.clear();
		}

		function disposeCardOwners() {
			disposeHoverOwners();
			for (const owner of [...cardOwners]) owner.dispose();
			cardOwners.clear();
		}

		function seedLoadedPostIds(root) {
			// Requirement 2: loadedPostIds must represent every post already
			// present in the gallery *before* infinite scroll can insert more.
			// No network requests — purely a DOM scan using the active adapter.
			let seeded = 0;
			for (const img of BE.adapters.active.getThumbElements(root)) {
				const postId = BE.adapters.active.getThumbPostId(img);
				if (!postId) continue;
				const id = String(postId);
				if (!loadedPostIds.has(id)) {
					loadedPostIds.add(id);
					seeded++;
				}
			}
			BE.log.debug(`[Gallery] seeded loadedPostIds with ${seeded} existing post(s), total ${loadedPostIds.size}`);
		}

		function resetPageScopedState() {
			// Requirement 8/11: called only when a genuinely NEW gallery/page
			// context is initialized (real SPA navigation / container swap) —
			// never on unrelated DOM mutations of the same gallery.
			loadedPostIds = new Set();
			enrichedPostIds = new Set();
			visitedPageIdentities = new Set();
			nextPageUrl = null;
			state = 'IDLE';
			clearTimeout(retryTimer);
			paginatorHiddenByUs = false;
		}

		function init(container) {
			const isNewContainer = galleryContainer !== container;

			if (isNewContainer) {
				// Requirement 8: disconnect anything tied to the OLD container
				// before adopting the new one.
				if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
				if (sentinel) { sentinel.remove(); sentinel = null; }
				restorePaginatorVisibility();
				disposeCardOwners();
				galleryOwner?.dispose();
				galleryOwner = null;
				settingsListenerAttached = false;
				resizeListenerAttached = false;
				resetPageScopedState();
				paginatorEl = null;
			}

			galleryContainer = container;
			if (!galleryOwner) galleryOwner = BE.ownership.create({ origin: galleryContainer.querySelector('a[href]') });
			galleryOwner.ownAttribute(galleryContainer, 'data-be-adapter', BE.adapters.active?.id || '');

			// Requirement 7: gallery init() must be idempotent — a marker on
			// the container prevents re-adding delegated listeners or redoing
			// work that's already in place for THIS container.
			if (galleryContainer.dataset.beGalleryInit === '1') {
				if (isNewContainer) {
					// Shouldn't normally happen (marker would only exist on an
					// already-adopted container), but guard anyway.
					seedLoadedPostIds(galleryContainer);
				}
				applyGridSettings();
				return;
			}
			galleryOwner.ownAttribute(galleryContainer, 'data-be-gallery-init', '1');
			galleryOwner.ownClass(galleryContainer, 'be-gallery-grid', true);

			// Event Delegation (attached exactly once per container).
			// Requirement 4 / follow-up review: bubble phase, not capture.
			// Capture-phase interception ran our logic before the site's own
			// listeners on the thumbnail/link ever saw the event, which is
			// more aggressive than necessary and risks interfering with
			// Gelbooru's own click handling. Bubble phase still lets
			// preventDefault() stop the default navigation (the browser
			// only commits the default action after the whole dispatch,
			// capture + target + bubble, completes) — we just no longer
			// jump the queue ahead of the site's own handlers.
			galleryOwner.on(galleryContainer, 'click', onGalleryClick);
			galleryOwner.on(galleryContainer, 'pointerover', onGalleryHover);
			galleryOwner.on(galleryContainer, 'pointerout', onGalleryHoverEnd);

			applyGridSettings();

			if (!settingsListenerAttached) {
				settingsListenerAttached = true;
				const offSettings = BE.bus.on('settings:changed', galleryOwner.guard(({ key }) => {
					if (key.startsWith('gallery.') || key === 'general.theme' || key === 'general.accentColor') applyGridSettings();
					if (key === 'gallery.infiniteScroll') onInfiniteScrollSettingChanged(BE.settings.get('gallery.infiniteScroll'));
					if (key === 'media.thumbQuality') enhanceThumbnails(galleryContainer);
					if (key === 'media.hoverPreview') {
						if (BE.settings.get('media.hoverPreview')) enhanceThumbnails(galleryContainer);
						else disposeHoverOwners();
					}
				}));
				galleryOwner.cleanup(() => { offSettings(); settingsListenerAttached = false; });
			}

			if (!resizeListenerAttached) {
				resizeListenerAttached = true;
				const onResize = BE.dom.debounce(galleryOwner.guard(() => applyGridSettings()), 120);
				galleryOwner.on(window, 'resize', onResize);
				galleryOwner.cleanup(() => { resizeListenerAttached = false; });
			}

			enhanceThumbnails(galleryContainer);
			seedLoadedPostIds(galleryContainer);
		}

		function onInfiniteScrollSettingChanged(enabled) {
			if (!galleryContainer) return;
			if (enabled) {
				setupInfiniteScroll();
			} else {
				if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
				if (sentinel) { sentinel.remove(); sentinel = null; }
				restorePaginatorVisibility();
			}
		}

		function applyGridSettings() {
			if (!galleryContainer) return;
			const cols = BE.settings.get('gallery.gridDensity') || 0;
			const thumbSize = BE.settings.get('gallery.thumbnailSize') || 220;
			const gap = BE.settings.get('gallery.gridGap') ?? 8;
			const compact = !!BE.settings.get('gallery.compactMode');

			// Requirement 20: schema stores these as numbers already (the
			// settings panel does Number(input.value) for range/number
			// fields), but coerce defensively so a stale/corrupt stored
			// string value can never become "300pxpx" below.
			const thumbSizePx = Number(thumbSize) || 220;
			const gapPx = Number(gap) || 0;
			const colsNum = Number(cols) || 0;

			let effectiveThumbSizePx = thumbSizePx;

			if (colsNum > 0) {
				const rect = galleryContainer.getBoundingClientRect();
				const viewportAvailableWidth = Math.max(
					1,
					window.innerWidth - Math.max(0, rect.left) - 16
				);
				const usableWidth = Math.max(
					1,
					viewportAvailableWidth - gapPx * Math.max(0, colsNum - 1)
				);
				const maxFitPx = Math.max(1, Math.floor(usableWidth / colsNum));
				effectiveThumbSizePx = Math.min(thumbSizePx, maxFitPx);

				galleryOwner?.ownStyle(galleryContainer, '--be-grid-template', `repeat(${colsNum}, minmax(0, ${effectiveThumbSizePx}px))`);
			} else {
				galleryOwner?.ownStyle(galleryContainer, '--be-grid-template', `repeat(auto-fill, var(--be-thumbnail-size))`);
			}

			galleryOwner?.ownStyle(galleryContainer, '--be-thumbnail-size', `${effectiveThumbSizePx}px`);
			galleryOwner?.ownStyle(galleryContainer, '--be-grid-gap', `${gapPx}px`);
			galleryOwner?.ownClass(galleryContainer, 'be-compact-mode', compact);

			BE.log.debug(
				`[Gallery] Grid: ${colsNum > 0 ? colsNum + ' columns' : 'auto'}, ` +
				`${effectiveThumbSizePx}px effective (${thumbSizePx}px requested), ${gapPx}px gap` +
				`${compact ? ', compact' : ''}`
			);
		}

		function orderedPostIds() {
			if (!galleryContainer) return [];
			return BE.adapters.active.getThumbElements(galleryContainer)
			.map((img) => img.dataset.bePostId || BE.adapters.active.getThumbPostId(img))
			.filter(Boolean);
		}

		function openViewerForThumb(img, thumb) {
			const postId = img.dataset.bePostId || BE.adapters.active.getThumbPostId(img);
			if (!postId) return;

			const previewUrl =
				img.dataset.bePreviewUrl ||
				thumb?.dataset?.previewUrl ||
				img.currentSrc ||
				img.src ||
				img.dataset.src ||
				'';
			const sampleUrl =
				img.dataset.beSampleUrl ||
				thumb?.dataset?.sampleUrl ||
				previewUrl;
			const originalUrl =
				img.dataset.beOriginalUrl ||
				thumb?.dataset?.fileUrl ||
				'';
			const postUrl = thumb.closest('a')?.href || img.closest('a')?.href || location.href;

			const cachedPost = getCachedPost(postId);
			const initialPost = cachedPost || emptyPost({
				id: postId,
				originalUrl,
				sampleUrl,
				previewUrl,
				mediaType: guessMediaType(originalUrl || sampleUrl || previewUrl),
				postUrl,
				metadataPending: !originalUrl,
			});

			const ids = orderedPostIds();
			const navigateBy = (delta) => {
				const idx = ids.indexOf(postId);
				const nextId = idx === -1 ? null : ids[idx + delta];
				if (!nextId) return;
				const nextImg = BE.dom.qs(`img[data-be-post-id="${CSS.escape(nextId)}"]`, galleryContainer)
				|| BE.dom.qs(`img[data-be-post-id="${CSS.escape(nextId)}"]`, document);
				if (nextImg) openViewerForThumb(nextImg, nextImg.closest('.be-thumb-wrap') || nextImg);
			};

			BE.modules.viewer.open(initialPost, {
				next: () => navigateBy(1),
				prev: () => navigateBy(-1),
			});

			if (!cachedPost) {
				enrichSinglePost(postId).then((fullPost) => {
					if (fullPost) BE.modules.viewer.updatePost(fullPost);
				}).catch((err) => BE.log.error('enrichment failed', err));
			}
		}

		function buildThumbActions(wrap, img) {
			if (wrap.querySelector('.be-thumb-actions')) return;
			const bar = BE.dom.create('div', { class: 'be-thumb-actions' });
			bar.style.cssText = 'position:absolute;top:4px;right:4px;display:flex;gap:3px;opacity:0;transition:opacity .15s;z-index:5;';
			const mk = (label, title, action) => {
				const b = document.createElement('button');
				b.textContent = label;
				b.title = title;
				b.dataset.beAction = action;
				b.className = 'be-thumb-action-btn';
				b.style.cssText = 'background:rgba(0,0,0,.65);color:#fff;border:none;border-radius:3px;padding:2px 5px;font-size:11px;cursor:pointer;line-height:1.4;';
				bar.appendChild(b);
			};
			mk('👁', 'Open viewer', 'viewer');
			mk('⭳', 'Download', 'download');
			mk('⤢', 'Open original', 'open');
			if (BE.modules.favorites.supported()) mk('★', 'Favorite', 'favorite');
			wrap.appendChild(bar);
			wrap.addEventListener('pointerenter', () => { bar.style.opacity = '1'; });
			wrap.addEventListener('pointerleave', () => { bar.style.opacity = '0'; });
		}

		// Requirement 3 / 29: resolve the actual per-post wrapper for a
		// thumbnail <img> through the active adapter's getThumbWrapper (each
		// adapter now provides one). This replaces the old
		// img.closest('article, span, div, a') strategy, which was the
		// common root cause behind several independent-looking symptoms:
		// grabbing the wrong (too broad, or even the gallery-container-
		// level) ancestor meant the sizing/no-overlap CSS landed on the
		// wrong element, and click/hover delegation could end up treating
		// "the whole gallery" as a single thumbnail.
		function getWrapperForImg(img) {
			const adapter = BE.adapters.active;
			let wrap = null;
			if (adapter && typeof adapter.getThumbWrapper === 'function') {
				try { wrap = adapter.getThumbWrapper(img); } catch (err) {
					BE.log.debug('[Gallery] getThumbWrapper threw, falling back', err);
				}
			}
			if (!wrap) wrap = img.closest('a') || img.parentElement;
			// Safety net: never accept the gallery container itself (or an
			// ancestor of it) as "a thumbnail wrapper" — that would make a
			// single wrapper swallow the entire gallery.
			if (!wrap || wrap === galleryContainer || (galleryContainer && wrap.contains(galleryContainer))) {
				return null;
			}
			return wrap;
		}

		// Single helper for enhancing one thumbnail — used for both the
		// initial gallery render and dynamically-inserted (infinite scroll)
		// thumbnails, per Requirement 17, so the two paths can never drift
		// out of sync with each other.
		function applySiteThumbMedia(img, wrap) {
			if (BE.adapters.active?.id !== 'e621' || !img || !wrap) return;

			const previewUrl =
				wrap.dataset.previewUrl ||
				img.dataset.previewUrl ||
				img.dataset.bePreviewUrl ||
				img.currentSrc ||
				img.src ||
				'';
			const sampleUrl =
				wrap.dataset.sampleUrl ||
				img.dataset.sampleUrl ||
				img.dataset.beSampleUrl ||
				'';
			const originalUrl =
				wrap.dataset.fileUrl ||
				img.dataset.fileUrl ||
				img.dataset.beOriginalUrl ||
				'';

			const quality = BE.settings.get('media.thumbQuality') || 'sample';
			let targetUrl = previewUrl;

			if (quality === 'sample') {
				targetUrl = sampleUrl || previewUrl;
			} else if (quality === 'original') {
				// A video URL cannot be placed into <img>. For video posts,
				// keep the best still/sample image available in the grid.
				targetUrl = guessMediaType(originalUrl) === 'video'
					? (sampleUrl || previewUrl)
					: (originalUrl || sampleUrl || previewUrl);
			}

			if (!targetUrl || guessMediaType(targetUrl) === 'video') return;

			// e621 uses <picture>/<source>; changing only img.src can leave a
			// source element in control. Point all sources at the selected
			// thumbnail media so the visible image really follows the setting.
			const picture = img.closest('picture');
			if (picture) {
				for (const source of picture.querySelectorAll('source')) {
					source.remove();
				}
			}
			img.removeAttribute('srcset');
			if (img.src !== targetUrl) img.src = targetUrl;

			const nativeHoverLink = wrap.querySelector('a.thm-link');
			if (nativeHoverLink) {
				nativeHoverLink.removeAttribute('data-hover-text');
				nativeHoverLink.removeAttribute('title');
			}
		}

		function suppressNativeThumbHover(img, wrap) {
			if (!img || !wrap) return;

			const isRule34 = /(^|\.)rule34\.xxx$/.test(location.hostname);
			if (!isRule34) return;

			const candidates = [
				img,
				img.closest('a'),
				wrap,
				...wrap.querySelectorAll('[title], [data-hover-text]')
			].filter(Boolean);

			for (const el of new Set(candidates)) {
				el.removeAttribute('title');
				el.removeAttribute('data-hover-text');
			}
		}

		function enhanceThumbnail(img) {
			const wrap = getWrapperForImg(img);
			if (wrap) {
				wrap.classList.add('be-thumb-wrap');
				if (getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
				buildThumbActions(wrap, img);
			}
			img.classList.add('be-thumb-img');

			const postId = BE.adapters.active.getThumbPostId(img);
			if (postId) {
				img.dataset.bePostId = postId;
			}
			applySiteThumbMedia(img, wrap);
			suppressNativeThumbHover(img, wrap);
			return wrap;
		}

		function enhanceThumbnails(root) {
			const thumbs = BE.adapters.active.getThumbElements(root);
			BE.log.debug(`[Gallery] Adapter: ${BE.adapters.active?.id}`);
			BE.log.debug(`[Gallery] Thumbnails: ${thumbs.length}`);
			for (const img of thumbs) enhanceThumbnail(img);
		}

		async function handleThumbAction(action, img, thumb) {
			const postId = img.dataset.bePostId || BE.adapters.active.getThumbPostId(img);
			if (!postId) return;
			const previewUrl = img.src || img.dataset.src;
			const postUrl = thumb.closest('a')?.href || img.closest('a')?.href || location.href;
			let post = emptyPost({ id: postId, previewUrl, sampleUrl: previewUrl, postUrl });

			if (action === 'viewer') {
				openViewerForThumb(img, thumb);
				return;
			}

			// download/open/favorite need real metadata (original URL) first.
			try {
				const full = await enrichSinglePost(postId);
				if (full) post = full;
			} catch (err) {
				BE.log.warn('[Gallery] could not enrich post before action', action, err);
			}

			if (action === 'download') {
				BE.modules.downloader.downloadPost(post);
			} else if (action === 'open') {
				const url = post.originalUrl || post.sampleUrl || post.previewUrl;
				if (url) window.open(url, '_blank', 'noopener');
			} else if (action === 'favorite') {
				BE.modules.favorites.toggle(post);
			}
		}

		function onGalleryClick(e) {
			// Per-thumbnail action buttons (download/open/favorite/viewer overlay).
			const actionBtn = e.target.closest('[data-be-action]');
			if (actionBtn) {
				const wrap = actionBtn.closest('.be-thumb-wrap');
				const img = wrap?.querySelector('img');
				if (img) {
					e.preventDefault();
					e.stopPropagation();
					BE.log.debug(`[Gallery] action button: ${actionBtn.dataset.beAction}`);
					handleThumbAction(actionBtn.dataset.beAction, img, wrap);
				}
				return;
			}

			if (!BE.settings.get('viewer.enabled')) return;

			// Never hijack modifier-key clicks or middle-clicks — let the
			// browser/site handle "open in new tab", "open in background", etc.
			if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

			// Requirement 3/29: only ever recognize an element we've
			// explicitly marked as a thumbnail wrapper. The old fallback
			// list (article, span.thumb, a.thumb, .post-preview) could
			// match an unrelated ancestor — including, in the worst case,
			// the gallery container itself — and silently open the viewer
			// for the wrong post (or make clicks appear to do nothing).
			const thumb = e.target.closest('.be-thumb-wrap');
			if (!thumb) return;

			const img = thumb.matches('img') ? thumb : (thumb.querySelector('.be-thumb-img') || thumb.querySelector('img'));
			if (!img) return;

			e.preventDefault();
			e.stopPropagation();
			BE.log.debug(`[Gallery] Viewer opening post #${img.dataset.bePostId || BE.adapters.active.getThumbPostId(img)}`);
			openViewerForThumb(img, thumb);
		}

		function onGalleryHover(e) {
			if (!BE.settings.get('media.hoverPreview')) return;
			const thumb = e.target.closest('.be-thumb-wrap');
			if (!thumb) return;
			// pointerover bubbles for every child element boundary inside
			// the thumbnail (image, action bar, etc). Only (re)trigger the
			// preview the first time we enter THIS wrapper, not on every
			// bubble — this is what was causing the reported flicker.
			if (thumb.dataset.beHovering === '1') return;
			thumb.dataset.beHovering = '1';
			const img = thumb.matches('img') ? thumb : (thumb.querySelector('.be-thumb-img') || thumb.querySelector('img'));
			if (img) BE.modules.hover.show(img);
		}

		function onGalleryHoverEnd(e) {
			if (!BE.settings.get('media.hoverPreview')) return;
			const thumb = e.target.closest('.be-thumb-wrap');
			if (!thumb) return;
			// Only actually hide once the pointer has left the wrapper
			// entirely — relatedTarget still inside it means this pointerout
			// was just an internal child boundary crossing.
			if (thumb.contains(e.relatedTarget)) return;
			delete thumb.dataset.beHovering;
			BE.modules.hover.hide();
		}

		async function enrichSinglePost(postId) {
			const key = String(postId);
			if (postCache.has(key)) return postCache.get(key);
			if (postInflight.has(key)) return postInflight.get(key);

			const request = (async () => {
				try {
					const post = await BE.adapters.active.fetchPost(postId);
					if (post) postCache.set(key, post);
					return post;
				} catch (err) {
					BE.log.debug('[Gallery] enrichSinglePost failed for', postId, err);
					return null;
				} finally {
					postInflight.delete(key);
				}
			})();
			postInflight.set(key, request);
			return request;
		}

		function getCachedPost(postId) {
			return postCache.get(String(postId)) || null;
		}

		// Background metadata enrichment: batch-fetch original-media URLs for
		// visible thumbnails so download/viewer/favorite don't have to make a
		// per-click network round-trip afterwards. Never blocks initial render.
		async function enrichThumbnails(root = galleryContainer) {
			if (!root || !BE.adapters.active || typeof BE.adapters.active.fetchThumbBatch !== 'function') return;
			if (/(^|\.)rule34\.xxx$/.test(location.hostname)) {
				BE.log.debug('[Gallery] Rule34 background metadata enrichment deferred to hover/click');
				return;
			}

			const ids = BE.adapters.active.getThumbElements(root)
			.map((img) => img.dataset.bePostId || BE.adapters.active.getThumbPostId(img))
			.filter((id) => id && !enrichedPostIds.has(String(id)));
			if (!ids.length) return;

			const CHUNK = 40;
			for (let i = 0; i < ids.length; i += CHUNK) {
				const chunk = ids.slice(i, i + CHUNK).map(String);
				try {
					const posts = await BE.adapters.active.fetchThumbBatch(chunk);
					const returnedIds = new Set();

					for (const post of posts || []) {
						if (!post?.id) continue;
						const postId = String(post.id);
						returnedIds.add(postId);
						enrichedPostIds.add(postId);
						postCache.set(postId, post);

						const img = BE.dom.qs(`img[data-be-post-id="${CSS.escape(postId)}"]`, root);
						if (img) {
							if (post.originalUrl) img.dataset.beOriginalUrl = post.originalUrl;
							if (post.sampleUrl) img.dataset.beSampleUrl = post.sampleUrl;
							if (post.previewUrl) img.dataset.bePreviewUrl = post.previewUrl;
							applySiteThumbMedia(img, getWrapperForImg(img));
						}
					}

					const missing = chunk.filter((id) => !returnedIds.has(id));
					if (missing.length) {
						BE.log.debug(`[Gallery] enrichment returned ${returnedIds.size}/${chunk.length}; ${missing.length} remain retryable`);
					} else {
						BE.log.debug(`[Gallery] enriched ${returnedIds.size}/${chunk.length} thumbnails`);
					}
				} catch (err) {
					// Leave this chunk unmarked so a later enrichment pass or
					// hover can retry instead of permanently treating it as done.
					BE.log.debug('[Gallery] batch enrichment failed; IDs remain retryable', err);
				}
			}
		}

		function findPaginatorEl() {
			const selectors = BE.adapters.active.pagination.containerSelectors.join(', ');
			if (!selectors) return null;
			try { return BE.dom.qs(selectors); } catch { return null; }
		}

		function hidePaginatorIfPresent() {
			paginatorEl = paginatorEl || findPaginatorEl();
			if (paginatorEl && !paginatorEl.classList.contains('be-pagination-hidden')) {
				paginatorEl.classList.add('be-pagination-hidden');
				paginatorHiddenByUs = true;
			}
		}

		function restorePaginatorVisibility() {
			if (paginatorHiddenByUs && paginatorEl) {
				paginatorEl.classList.remove('be-pagination-hidden');
			}
			paginatorHiddenByUs = false;
		}

		function setupInfiniteScroll() {
			// Requirement 6: fully idempotent — never leaves more than one
			// observer/sentinel behind, however many times this is called
			// (SPA nav, MutationObserver, settings toggling, re-detection).
			if (scrollObserver) { scrollObserver.disconnect(); scrollObserver = null; }
			const existingSentinel = document.getElementById('be-infinite-scroll-sentinel');
			if (existingSentinel) existingSentinel.remove();
			sentinel = null;

			if (!galleryContainer) return;

			sentinel = document.createElement('div');
			sentinel.id = 'be-infinite-scroll-sentinel';
			sentinel.style.height = '10px';
			galleryContainer.parentNode.insertBefore(sentinel, galleryContainer.nextSibling);

			scrollObserver = new IntersectionObserver((entries) => {
				if (entries[0].isIntersecting && state === 'IDLE') {
					loadNextPage();
				}
			}, { rootMargin: '600px 0px' });

			scrollObserver.observe(sentinel);

			// Requirement 5: do NOT hide the native paginator up front — only
			// once infinite scroll has proven it can actually load a page.
			paginatorEl = findPaginatorEl();
		}

		async function loadNextPage() {
			if (state !== 'IDLE') return;
			state = 'LOADING';
			clearTimeout(retryTimer);

			// Requirement 1 fix: use a mutable local so a successfully
			// calculated fallback URL is actually used for the request below.
			let nextUrl = nextPageUrl || BE.adapters.active.pagination.getNextUrl(document);
			if (!nextUrl) {
				const calc = BE.adapters.active.pagination.calculateNextUrl(location.href);
				if (!calc) {
					state = 'EXHAUSTED';
					BE.log.info('[Gallery] No more pages. Next URL not found.');
					return;
				}
				nextUrl = calc;
				nextPageUrl = calc;
			}

			// Requirement 11: never re-request an already-visited page.
			const nextIdentity = BE.adapters.active.pagination.getPageIdentity(nextUrl);
			if (visitedPageIdentities.has(nextIdentity)) {
				state = 'EXHAUSTED';
				BE.log.info(`[Gallery] Pagination loop detected (identity "${nextIdentity}" already visited). Stopping.`);
				return;
			}

			BE.log.debug('[Gallery] infinite scroll triggered');
			BE.log.debug(`[Gallery] next URL: ${nextUrl}`);
			BE.log.debug(`[Gallery] pagination identity: ${nextIdentity}`);
			BE.log.debug('[Gallery] request started');

			try {
				const res = await BE.net.request({ url: nextUrl, headers: { 'Accept': 'text/html' } }, 3);
				BE.log.debug(`[Gallery] HTTP status: ${res.status}`);
				BE.log.debug(`[Gallery] response length: ${res.responseText.length}`);

				if (res.responseText.includes('login') && res.responseText.includes('password')) {
					throw new Error('Login page returned instead of gallery.');
				}
				if (res.status === 403 || res.status === 404 || res.status === 500) {
					throw new Error(`HTTP ${res.status} error page returned.`);
				}

				visitedPageIdentities.add(nextIdentity);

				const doc = new DOMParser().parseFromString(res.responseText, 'text/html');
				const newContainer = BE.adapters.active.getGalleryContainer(doc);

				if (!newContainer) {
					throw new Error('Gallery container not found in response.');
				}
				BE.log.debug('[Gallery] gallery container found');

				const thumbs = BE.adapters.active.getThumbElements(newContainer);
				BE.log.debug(`[Gallery] thumbnails found: ${thumbs.length}`);

				if (!thumbs.length) {
					state = 'EXHAUSTED';
					BE.log.info('[Gallery] Empty valid page. No more posts.');
					restorePaginatorVisibility();
					return;
				}

				let inserted = 0;
				for (const thumb of thumbs) {
					const img = thumb.tagName === 'IMG' ? thumb : thumb.querySelector('img');
					if (!img) continue;

					const rawPostId = BE.adapters.active.getThumbPostId(img);
					if (!rawPostId) continue;
					const postId = String(rawPostId);
					if (loadedPostIds.has(postId)) continue;

					loadedPostIds.add(postId);

					// Requirement 17: same wrapper-resolution path as the
					// initial thumbnails — no separate/duplicated logic.
					// Note getWrapperForImg's "don't return the gallery
					// container" guard doesn't apply to this parsed-doc
					// element (it belongs to a detached document, not the
					// live one), so it's safe to reuse directly here.
					const wrap = (BE.adapters.active.getThumbWrapper && BE.adapters.active.getThumbWrapper(img)) || img.closest('a') || img.parentElement;
					if (!wrap) continue;

					const clonedWrap = wrap.cloneNode(true);
					const clonedImg = clonedWrap.tagName === 'IMG' ? clonedWrap : clonedWrap.querySelector('img');
					if (!clonedImg) continue;

					clonedWrap.classList.add('be-thumb-wrap');
					clonedImg.classList.add('be-thumb-img');
					clonedImg.dataset.bePostId = postId;

					// Requirement 18: cloneNode never carries over JS event
					// state — the per-thumbnail hover action bar (built via
					// direct pointerenter/pointerleave listeners, not
					// delegation) would otherwise silently stop working on
					// every dynamically-inserted thumbnail. Drop the cloned
					// (dead) bar and rebuild it for real once attached.
					const staleActions = clonedWrap.querySelector('.be-thumb-actions');
					if (staleActions) staleActions.remove();

					galleryContainer.appendChild(clonedWrap);
					if (getComputedStyle(clonedWrap).position === 'static') clonedWrap.style.position = 'relative';
					buildThumbActions(clonedWrap, clonedImg);
					applySiteThumbMedia(clonedImg, clonedWrap);

					inserted++;
				}
				BE.log.debug(`[Gallery] unique posts: ${inserted}`);
				BE.log.debug(`[Gallery] inserted: ${inserted}`);

				if (inserted > 0) {
					// Do not block pagination bookkeeping on metadata. This also
					// retries any earlier IDs that were missing from a batch.
					void enrichThumbnails(galleryContainer);
				}

				nextPageUrl = BE.adapters.active.pagination.getNextUrl(doc);
				if (!nextPageUrl) {
					const calculated = BE.adapters.active.pagination.calculateNextUrl(nextUrl);
					nextPageUrl = calculated;
				}

				if (!nextPageUrl) {
					state = 'EXHAUSTED';
					BE.log.info('[Gallery] No more pages. Next URL not found in response.');
					restorePaginatorVisibility();
				} else if (inserted === 0) {
					// Requirement 10: a page can be fetched successfully yet
					// contain zero *unique* posts (fully overlapping page).
					// Continue the chain (the loop guard above still protects
					// against A→B→A / repeated-URL loops), but don't spin
					// forever if this keeps happening with no forward progress.
					BE.log.debug('[Gallery] page contained no new posts; continuing pagination chain');
					state = 'IDLE';
					hidePaginatorIfPresent();
				} else {
					BE.log.debug(`[Gallery] next URL detected: ${nextPageUrl}`);
					state = 'IDLE';
					// Requirement 5: only now, after a demonstrated successful
					// load, is it safe to hide the native paginator.
					hidePaginatorIfPresent();
				}

			} catch (err) {
				BE.log.error('[Gallery] pagination error', err);
				BE.log.error(`[Gallery] URL: ${nextUrl}`);
				BE.log.error(`[Gallery] reason: ${err.message}`);
				state = 'ERROR';
				// Requirement 5: on failure, make sure the user isn't stranded —
				// restore the native paginator rather than leaving it hidden.
				restorePaginatorVisibility();
				retryTimer = setTimeout(() => {
					state = 'IDLE';
					loadNextPage();
				}, 5000);
			}
		}

		return { init, applyGridSettings, enhanceThumbnails, enrichThumbnails, enrichSinglePost, getCachedPost, setupInfiniteScroll };
	})();

	/* ============================================================ *
	 *  UI MODULE (Settings & Toolbar)
	 * ============================================================ */
	BE.modules.ui = (() => {
		let toolbarRoot = null;
		let postActionBar = null;
		let currentPostCache = null;

		function injectStyles() {
			document.documentElement.dataset.beUiTheme = BE.settings.get('general.theme') || 'dark';
			document.documentElement.style.setProperty('--be-accent', BE.settings.get('general.accentColor') || '#ff8ac6');
			const css = `
			:root {
				--be-accent: ${BE.settings.get('general.accentColor') || '#ff8ac6'};
			}
.be-gallery-grid {
    display: grid !important;
    grid-template-columns: var(--be-grid-template, repeat(auto-fill, var(--be-thumbnail-size, 220px))) !important;
    gap: var(--be-grid-gap, 8px) !important;
    align-items: stretch;
    justify-content: start;
    max-width: 100%;
    box-sizing: border-box;
    overflow-x: hidden;
}
			.be-thumb-wrap {
				position: relative;
				overflow: hidden;
				min-width: 0;
				min-height: 0;
				aspect-ratio: 3/4;
				background: rgba(128,128,128,0.1);
				border-radius: 4px;
			}
			/* Requirement 11–16: now that .be-thumb-wrap is reliably the
			   actual CSS grid item (not some unrelated ancestor), make sure
			   OUR grid sizing is what visibly governs it — many booru sites
			   give the equivalent native element a fixed width/float, which
			   would otherwise silently override grid-template-columns and
			   make thumbnailSize/gridDensity/gridGap changes invisible. */
			.be-gallery-grid > .be-thumb-wrap,
			.be-gallery-grid .be-thumb-wrap {
				float: none !important;
				width: 100% !important;
				height: auto !important;
				max-width: none !important;
				margin: 0 !important;
			}
			.be-thumb-img {
				display: block;
				width: 100%;
				height: 100%;
				max-width: 100%;
				max-height: 100%;
				object-fit: contain;
			}
			/* Current e621/e926 markup:
			   article.thumbnail > a.thm-link > picture > img, followed by
			   .thm-desc. Native e621 caps the link/description with
			   --thumb-image-max, so the grid track can grow while the visible
			   thumbnail stays small unless we override the inner elements too. */
			.be-gallery-grid[data-be-adapter="e621"] .be-thumb-wrap {
				aspect-ratio: auto !important;
				align-items: stretch !important;
			}
			.be-gallery-grid[data-be-adapter="e621"] .be-thumb-wrap > a.thm-link {
				display: block !important;
				width: 100% !important;
				max-width: none !important;
				min-width: 0 !important;
				aspect-ratio: 1 / 1 !important;
			}
			.be-gallery-grid[data-be-adapter="e621"] .be-thumb-wrap > a.thm-link > picture {
				display: block !important;
				width: 100% !important;
				height: 100% !important;
				max-width: none !important;
				max-height: none !important;
			}
			.be-gallery-grid[data-be-adapter="e621"] .be-thumb-img {
				display: block !important;
				width: 100% !important;
				height: 100% !important;
				max-width: none !important;
				max-height: none !important;
				object-fit: contain !important;
			}
			.be-gallery-grid[data-be-adapter="e621"] .be-thumb-wrap > .thm-desc,
			.be-gallery-grid[data-be-adapter="e621"] .be-thumb-wrap > .thm-extra {
				width: 100% !important;
				max-width: none !important;
			}
			/* gallery.compactMode: previously toggled with no CSS consumer,
			   so it "saved" but never visibly did anything. */
			.be-gallery-grid.be-compact-mode .be-thumb-wrap {
				aspect-ratio: 1/1;
				border-radius: 2px;
			}
			.be-gallery-grid.be-compact-mode .be-thumb-actions {
				padding: 1px;
				gap: 2px;
			}
			.be-gallery-grid.be-compact-mode .be-thumb-action-btn {
				padding: 1px 4px;
				font-size: 10px;
			}
			.be-pagination-hidden {
				display: none !important;
			}
			#be-root {
			position: fixed;
			z-index: 999999;
			font-family: -apple-system, "Segoe UI", Roboto, sans-serif;
			}
			#be-root.be-pos-bottom-right { bottom: 10px; right: 10px; }
			#be-root.be-pos-bottom-left  { bottom: 10px; left: 10px; }
			#be-root.be-pos-top-right    { top: 10px; right: 10px; }
			#be-root.be-pos-top-left     { top: 10px; left: 10px; }
			.be-toolbar {
				display: flex;
				gap: 4px;
				background: rgba(20,20,20,0.85);
				padding: 6px;
				border-radius: 8px;
				box-shadow: 0 2px 10px rgba(0,0,0,0.35);
			}
			.be-toolbar-btn {
				background: var(--be-accent);
				color: #fff;
				border: none;
				padding: 7px 10px;
				border-radius: 5px;
				cursor: pointer;
				font-weight: bold;
				font-size: 12px;
				white-space: nowrap;
			}
			.be-toolbar-btn:disabled {
				background: #666;
				cursor: not-allowed;
				opacity: 0.6;
			}
			.be-post-action-bar {
				display: flex;
				flex-wrap: wrap;
				gap: 6px;
				margin: 8px 0;
				padding: 6px;
				background: rgba(128,128,128,0.08);
				border-radius: 6px;
			}
			.be-post-action-bar button {
				background: var(--be-accent);
				color: #fff;
				border: none;
				padding: 6px 10px;
				border-radius: 4px;
				cursor: pointer;
				font-size: 12px;
			}
			.be-post-action-bar button:disabled {
				background: #999;
				cursor: not-allowed;
				opacity: 0.6;
			}
			.be-settings-panel {
				position: fixed;
				top: 50px;
				right: 10px;
				width: 340px;
				max-height: 80vh;
				overflow-y: auto;
				background: #fff;
				color: #000;
				border: 1px solid #ccc;
				padding: 15px;
				z-index: 999999;
				box-shadow: 0 4px 10px rgba(0,0,0,0.2);
				font-family: sans-serif;
			}
			.be-settings-panel h3 {
				margin-top: 15px;
				margin-bottom: 5px;
				border-bottom: 1px solid #eee;
				padding-bottom: 5px;
			}
			.be-settings-row {
				margin-bottom: 10px;
			}
			.be-settings-row label {
				display: block;
				font-size: 12px;
				margin-bottom: 4px;
				font-weight: bold;
			}
			.be-settings-toolbar {
				display: flex;
				gap: 6px;
				flex-wrap: wrap;
				margin-bottom: 10px;
				padding-bottom: 10px;
				border-bottom: 1px solid #ddd;
			}
			.be-settings-toolbar button {
				flex: 1;
				background: var(--be-accent);
				color: #fff;
				border: none;
				padding: 6px 8px;
				border-radius: 4px;
				cursor: pointer;
				font-size: 11px;
			}
			@keyframes be-media-spin {
				to { transform: rotate(360deg); }
			}
			.be-media-state {
				position: absolute;
				left: 50%;
				top: 50%;
				transform: translate(-50%, -50%);
				z-index: 20;
				display: flex;
				align-items: center;
				gap: 8px;
				padding: 7px 11px;
				border-radius: 6px;
				background: rgba(0,0,0,0.72);
				color: #fff;
				font: 600 13px/1.3 -apple-system, "Segoe UI", Roboto, sans-serif;
				box-shadow: 0 2px 10px rgba(0,0,0,0.35);
				pointer-events: none;
				white-space: nowrap;
			}
			.be-media-spinner {
				width: 13px;
				height: 13px;
				border: 2px solid rgba(255,255,255,.35);
				border-top-color: #fff;
				border-radius: 50%;
				animation: be-media-spin .8s linear infinite;
				flex: 0 0 auto;
			}
			.be-settings-panel {
				--be-settings-bg: #17191d;
				--be-settings-fg: #f2f2f2;
				--be-settings-muted: #aeb3bd;
				--be-settings-border: #353941;
				--be-settings-field: #22252b;
				width: min(380px, calc(100vw - 20px));
				max-height: min(86vh, 820px);
				background: var(--be-settings-bg);
				color: var(--be-settings-fg);
				border-color: var(--be-settings-border);
				border-radius: 10px;
				box-sizing: border-box;
			}
			.be-settings-panel[data-be-theme="light"] {
				--be-settings-bg: #fff;
				--be-settings-fg: #171717;
				--be-settings-muted: #646b75;
				--be-settings-border: #d9dde3;
				--be-settings-field: #f5f6f8;
			}
			.be-settings-header h2 {
				margin: 0;
				font-size: 17px;
			}
			.be-settings-header p {
				margin: 4px 0 12px;
				font-size: 11px;
				color: var(--be-settings-muted);
			}
			.be-settings-section {
				border-top: 1px solid var(--be-settings-border);
			}
			.be-settings-section > summary {
				cursor: pointer;
				padding: 10px 2px;
				font-weight: 700;
				font-size: 13px;
				user-select: none;
			}
			.be-settings-section-body {
				padding: 0 2px 4px;
			}
			.be-settings-row {
				margin: 0 0 12px;
			}
			.be-settings-row label {
				color: var(--be-settings-fg);
			}
			.be-settings-description {
				margin-top: 4px;
				color: var(--be-settings-muted);
				font-size: 11px;
				line-height: 1.35;
			}
			.be-settings-value {
				display: inline-block;
				margin-left: 7px;
				color: var(--be-settings-muted);
				font-size: 11px;
				font-weight: 600;
				vertical-align: middle;
			}
			.be-settings-panel select,
			.be-settings-panel input[type="text"],
			.be-settings-panel input[type="number"],
			.be-settings-panel textarea {
				box-sizing: border-box;
				width: 100%;
				background: var(--be-settings-field);
				color: var(--be-settings-fg);
				border: 1px solid var(--be-settings-border);
				border-radius: 4px;
				padding: 5px 7px;
			}
			.be-settings-panel input[type="range"] {
				width: calc(100% - 86px);
				vertical-align: middle;
			}
			.be-settings-toolbar {
				border-bottom-color: var(--be-settings-border);
			}
			.be-settings-toolbar .be-settings-reset {
				background: #555;
			}
			.be-settings-footer {
				margin-top: 8px;
				padding-top: 10px;
				border-top: 1px solid var(--be-settings-border);
				color: var(--be-settings-muted);
				font-size: 11px;
				line-height: 1.5;
				text-align: center;
			}
			.be-settings-footer a {
				color: var(--be-accent);
				text-decoration: none;
			}
			.be-settings-footer a:hover {
				text-decoration: underline;
			}
			:root[data-be-ui-theme="light"] .be-toolbar {
				background: rgba(245,245,247,.94);
				box-shadow: 0 2px 10px rgba(0,0,0,.18);
			}

			`;
			_GM.addStyle(css);
		}

		/* ---- current-post resolution (works on post pages, cached) ---- */
		async function getCurrentPost(forceRefresh = false) {
			if (currentPostCache && !forceRefresh) return currentPostCache;
			if (!BE.adapters.active) return null;
			try {
				const isPost = typeof BE.adapters.active.isPostPage === 'function' && BE.adapters.active.isPostPage();
				if (!isPost) return null;
				const id = BE.adapters.active.getPostId?.();
				if (!id) return null;
				const post = await BE.adapters.active.fetchPost(id);
				if (post) currentPostCache = post;
				return post;
			} catch (err) {
				BE.log.warn('[UI] could not resolve current post', err);
				return null;
			}
		}

		function findPrevNextLinks() {
			const sels = {
				next: ['a[rel="next"]', 'a.next-post', 'a#post-next', '.next-post a', 'a.next_page[href*="/posts/"]'],
				prev: ['a[rel="prev"]', 'a.prev-post', 'a#post-prev', '.prev-post a', 'a.prev_page[href*="/posts/"]'],
			};
			const find = (list) => { for (const s of list) { const el = BE.dom.qs(s); if (el?.href) return el.href; } return null; };
			return { next: find(sels.next), prev: find(sels.prev) };
		}

		function makeActionHandlers() {
			return {
				async download() {
					const post = await getCurrentPost();
					if (!post) { BE.modules.toast.show('No post detected on this page', 'warn'); return; }
					BE.modules.downloader.downloadPost(post);
				},
				async openOriginal() {
					const post = await getCurrentPost();
					const url = post?.originalUrl || post?.sampleUrl || post?.previewUrl;
					if (!url) { BE.modules.toast.show('Original media URL not found', 'warn'); return; }
					const mode = BE.settings.get('download.openMode');
					if (mode === 'popup') window.open(url, '_blank', 'width=1000,height=800');
					else window.open(url, '_blank', 'noopener');
				},
				async viewer() {
					const post = await getCurrentPost();
					if (!post) { BE.modules.toast.show('No post detected on this page', 'warn'); return; }
					BE.modules.viewer.open(post);
				},
				async favorite() {
					const post = await getCurrentPost();
					if (!post) { BE.modules.toast.show('No post detected on this page', 'warn'); return; }
					BE.modules.favorites.toggle(post);
				},
				prev() {
					const { prev } = findPrevNextLinks();
					if (prev) location.href = prev; else BE.modules.toast.show('No previous post found', 'warn');
				},
				next() {
					const { next } = findPrevNextLinks();
					if (next) location.href = next; else BE.modules.toast.show('No next post found', 'warn');
				},
			};
		}

		function createToolbar() {
			removeToolbar();
			const root = BE.dom.create('div', { id: 'be-root' });
			root.className = `be-pos-${BE.settings.get('general.toolbarPosition') || 'bottom-right'}`;

			const bar = BE.dom.create('div', { class: 'be-toolbar' });
			const actions = makeActionHandlers();
			const onPostPage = !!(BE.adapters.active?.isPostPage?.());
			const hasFav = BE.modules.favorites.supported();
			const { prev, next } = onPostPage ? findPrevNextLinks() : {};

			const specs = [
				['Settings', () => createSettingsPanel(), true],
					 ['Viewer', actions.viewer, onPostPage],
					 ['Download', actions.download, onPostPage],
					 ['Open Original', actions.openOriginal, onPostPage],
					 ['Favorite', actions.favorite, onPostPage && hasFav],
					 ['Prev', actions.prev, onPostPage && !!prev],
					 ['Next', actions.next, onPostPage && !!next],
			];
			for (const [label, fn, enabled] of specs) {
				const btn = document.createElement('button');
				btn.className = 'be-toolbar-btn';
				btn.textContent = label;
				btn.disabled = !enabled;
				btn.title = enabled ? label : `${label} — not available on this page`;
				btn.addEventListener('click', () => fn && fn());
				bar.appendChild(btn);
			}
			root.appendChild(bar);
			document.body.appendChild(root);
			toolbarRoot = root;
		}

		function removeToolbar() {
			toolbarRoot?.remove();
			toolbarRoot = null;
		}

		function createPostActionBar() {
			postActionBar?.remove();
			postActionBar = null;
			if (!BE.adapters.active?.isPostPage?.()) return;

			const mediaEl = BE.dom.qs('#image, #main_image, .image-container, main img.post-image, video');
			if (!mediaEl) return;

			const bar = BE.dom.create('div', { class: 'be-post-action-bar' });
			const actions = makeActionHandlers();
			const hasFav = BE.modules.favorites.supported();
			const specs = [
				['Download', actions.download, true],
				['Open Original', actions.openOriginal, true],
				['Fullscreen', actions.viewer, true],
				['Favorite', actions.favorite, hasFav],
				['Reverse Search', async () => {
					const post = await getCurrentPost();
					const url = post?.sampleUrl || post?.previewUrl || post?.originalUrl;
					if (url) window.open(`https://saucenao.com/search.php?url=${encodeURIComponent(url)}`, '_blank', 'noopener');
				}, true],
				['Info', async () => {
					const post = await getCurrentPost();
					if (!post) return;
					BE.modules.toast.show(
						`#${post.id} · ${post.width}x${post.height} · ${post.rating} · score ${post.score}`,
						'info', 4000,
					);
				}, true],
			];
			for (const [label, fn, enabled] of specs) {
				const btn = document.createElement('button');
				btn.textContent = label;
				btn.disabled = !enabled;
				btn.addEventListener('click', () => fn && fn());
				bar.appendChild(btn);
			}

			const host = mediaEl.closest('div, section, article') || mediaEl.parentElement;
			(host || document.body).insertAdjacentElement('afterend', bar);
			postActionBar = bar;
		}

		function createSettingsPanel() {
			let panel = document.getElementById('be-settings-panel');
			if (panel) {
				panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
				return;
			}

			panel = document.createElement('div');
			panel.id = 'be-settings-panel';
			panel.className = 'be-settings-panel';
			panel.dataset.beTheme = BE.settings.get('general.theme') || 'dark';

			const header = document.createElement('div');
			header.className = 'be-settings-header';
			const title = document.createElement('h2');
			title.textContent = 'Booru Enhancer Extended';
			const note = document.createElement('p');
			note.textContent = 'Most changes apply immediately.';
			header.appendChild(title);
			header.appendChild(note);
			panel.appendChild(header);

			const applyLiveSetting = (key, value) => {
				BE.settings.set(key, value);
				if (key === 'general.theme') {
					panel.dataset.beTheme = value;
					document.documentElement.dataset.beUiTheme = value;
				}
				if (key === 'general.accentColor') {
					document.documentElement.style.setProperty('--be-accent', value);
				}
				if (key === 'general.toolbarPosition' && toolbarRoot) {
					toolbarRoot.className = `be-pos-${value}`;
				}
			};

			const topBar = document.createElement('div');
			topBar.className = 'be-settings-toolbar';
			const mkTop = (label, fn, className = '') => {
				const b = document.createElement('button');
				b.textContent = label;
				if (className) b.classList.add(className);
				b.addEventListener('click', fn);
				topBar.appendChild(b);
				return b;
			};
			mkTop('Export', () => {
				const json = BE.settings.exportJSON();
				navigator.clipboard?.writeText(json).catch(() => {});
				BE.modules.toast.show('Settings copied to clipboard', 'success');
			});
			mkTop('Import', () => {
				const json = prompt('Paste exported Booru Enhancer settings JSON:');
				if (!json) return;
				const ok = BE.settings.importJSON(json);
				BE.modules.toast.show(ok ? 'Settings imported' : 'Import failed — invalid JSON', ok ? 'success' : 'error');
				if (ok) {
					document.documentElement.dataset.beUiTheme = BE.settings.get('general.theme') || 'dark';
					document.documentElement.style.setProperty('--be-accent', BE.settings.get('general.accentColor') || '#ff8ac6');
					if (toolbarRoot) toolbarRoot.className = `be-pos-${BE.settings.get('general.toolbarPosition') || 'bottom-right'}`;
					panel.remove();
					createSettingsPanel();
				}
			});
			mkTop('Reset', () => {
				if (!confirm('Reset all Booru Enhancer settings to defaults?')) return;
				BE.settings.resetAll();
				document.documentElement.dataset.beUiTheme = BE.settings.get('general.theme') || 'dark';
				document.documentElement.style.setProperty('--be-accent', BE.settings.get('general.accentColor') || '#ff8ac6');
				if (toolbarRoot) toolbarRoot.className = `be-pos-${BE.settings.get('general.toolbarPosition') || 'bottom-right'}`;
				panel.remove();
				createSettingsPanel();
				BE.modules.toast.show('Settings reset to defaults', 'success');
			}, 'be-settings-reset');
			mkTop('Close', () => { panel.style.display = 'none'; });
			panel.appendChild(topBar);

			const friendlyValue = (key, value, def) => {
				if (key === 'gallery.gridDensity') {
					return Number(value) === 0 ? 'Automatic' : `${value} columns`;
				}
				if (def.unit) return `${value} ${def.unit}`;
				return String(value);
			};

			const displayTextValue = (key, value) => {
				if (key === 'keys.playPause' && value === ' ') return 'Space';
				return String(value ?? '');
			};

			const storedTextValue = (key, value) => {
				if (key === 'keys.playPause' && String(value).trim().toLowerCase() === 'space') return ' ';
				return value;
			};

			const initiallyOpen = new Set(['General', 'Media', 'Viewer', 'Gallery']);
			for (const cat of BE.settings.categories()) {
				const section = document.createElement('details');
				section.className = 'be-settings-section';
				section.open = initiallyOpen.has(cat);

				const summary = document.createElement('summary');
				summary.textContent = cat;
				section.appendChild(summary);

				const body = document.createElement('div');
				body.className = 'be-settings-section-body';

				for (const key of BE.settings.byCategory(cat)) {
					const def = BE.settings.SCHEMA[key];
					const row = document.createElement('div');
					row.className = 'be-settings-row';

					const label = document.createElement('label');
					label.textContent = def.label;
					row.appendChild(label);

					let input;
					if (def.type === 'bool') {
						input = document.createElement('input');
						input.type = 'checkbox';
						input.checked = !!BE.settings.get(key);
						input.addEventListener('change', () => applyLiveSetting(key, input.checked));
					} else if (def.type === 'select') {
						input = document.createElement('select');
						for (const choice of def.choices) {
							const opt = document.createElement('option');
							opt.value = choice;
							opt.textContent = def.choiceLabels?.[choice] || choice;
							input.appendChild(opt);
						}
						input.value = BE.settings.get(key);
						input.addEventListener('change', () => applyLiveSetting(key, input.value));
					} else if (def.type === 'color') {
						input = document.createElement('input');
						input.type = 'color';
						input.value = BE.settings.get(key);
						input.addEventListener('input', () => applyLiveSetting(key, input.value));
					} else if (def.type === 'range' || def.type === 'number') {
						const valSpan = document.createElement('span');
						valSpan.className = 'be-settings-value';
						valSpan.textContent = friendlyValue(key, BE.settings.get(key), def);

						input = document.createElement('input');
						input.type = def.type === 'range' ? 'range' : 'number';
						input.min = def.min;
						input.max = def.max;
						input.value = BE.settings.get(key);
						input.addEventListener('input', () => {
							const value = Number(input.value);
							valSpan.textContent = friendlyValue(key, value, def);
							applyLiveSetting(key, value);
						});
						row.appendChild(input);
						row.appendChild(valSpan);
					} else {
						input = document.createElement('input');
						input.type = 'text';
						input.value = displayTextValue(key, BE.settings.get(key));
						input.addEventListener('change', () => {
							applyLiveSetting(key, storedTextValue(key, input.value));
							input.value = displayTextValue(key, BE.settings.get(key));
						});
					}

					if (def.type !== 'range' && def.type !== 'number') row.appendChild(input);

					if (def.description) {
						const desc = document.createElement('div');
						desc.className = 'be-settings-description';
						desc.textContent = def.description;
						row.appendChild(desc);
					}
					body.appendChild(row);
				}
				section.appendChild(body);
				panel.appendChild(section);
			}

			const footer = document.createElement('div');
			footer.className = 'be-settings-footer';
			const version = document.createElement('div');
			version.textContent = `Booru Enhancer Extended · v${BE.VERSION}`;
			const credit = document.createElement('div');
			credit.appendChild(document.createTextNode('Extended by ChadChan3D · '));
			const site = document.createElement('a');
			site.href = 'https://chadchan3d.com/category/assets/';
			site.target = '_blank';
			site.rel = 'noopener';
			site.textContent = 'chadchan3d.com/assets/';
			credit.appendChild(site);
			footer.appendChild(version);
			footer.appendChild(credit);
			panel.appendChild(footer);

			document.body.appendChild(panel);
		}
		function invalidateCurrentPost() { currentPostCache = null; }

		return {
			injectStyles, createToolbar, removeToolbar, createPostActionBar,
			createSettingsPanel, getCurrentPost, invalidateCurrentPost,
		};
	})();

	/* ============================================================ *
	 *  MENU COMMANDS
	 * ============================================================ */
	BE.modules.menu = (() => {
		let registered = false;
		function register() {
			if (registered) return; // avoid duplicate entries on re-init (SPA nav)
	registered = true;
			try {
				_GM.registerMenuCommand('Booru Enhancer: Settings', () => BE.modules.ui.createSettingsPanel());
				_GM.registerMenuCommand('Booru Enhancer: Enable/Disable', () => {
					const cur = BE.settings.get('general.enabled');
					BE.settings.set('general.enabled', !cur);
					BE.modules.toast.show(`Booru Enhancer ${!cur ? 'enabled' : 'disabled'} — reload the page to apply`, 'info', 4000);
				});
				_GM.registerMenuCommand('Booru Enhancer: Reset Settings', () => {
					if (confirm('Reset all Booru Enhancer settings to defaults?')) {
						BE.settings.resetAll();
						BE.modules.toast.show('Settings reset', 'success');
					}
				});
				_GM.registerMenuCommand('Booru Enhancer: Toggle Debug Mode', () => {
					const cur = BE.settings.get('debug.verboseLogging');
					BE.settings.set('debug.verboseLogging', !cur);
					BE.modules.toast.show(`Debug mode ${!cur ? 'ON' : 'OFF'}`, 'info');
				});
			} catch (err) {
				// Some managers (or contexts without menu support) may not have
				// GM_registerMenuCommand available at all — this must not be fatal.
				BE.log.warn('[Menu] registerMenuCommand unavailable', err);
			}
		}
		return { register };
	})();

	/* ============================================================ *
	 *  INITIALIZATION  (resilient bootstrap)
	 * ============================================================ *
	 *  Every stage is wrapped so that one broken module can never
	 *  take down the rest of the script, and every failure/skip is
	 *  logged with a reason instead of a silent `return`.
	 * ============================================================ */
	let _beInitialized = false;

	function safeStage(name, fn) {
		try {
			fn();
			BE.log.info(`[Init] ${name}: ok`);
			return true;
		} catch (err) {
			BE.log.error(`[Init] ${name}: FAILED`, err);
			return false;
		}
	}
	BE.modules.init = function init() {
		// Idempotent: calling BE.init()/BE.modules.init() twice (e.g. after an
		// SPA navigation) must never create duplicate toolbars/listeners.
		if (_beInitialized) {
			BE.log.debug('[Init] already initialized, re-applying page-specific UI only');
			refreshForCurrentPage();
			return;
		}
		_beInitialized = true;

		BE.log.info('[Init] Starting...');
		BE.log.info(`[Init] Host: ${location.hostname}`);

		BE.store.whenReady(() => {
			let settingsOk = safeStage('Settings', () => BE.settings._load());
			if (!settingsOk) {
				BE.log.warn('[Init] Settings failed to load — continuing with schema defaults.');
			}
			BE.log.info('[Init] Settings loaded');

			let adapter = null;
			const adapterOk = safeStage('Adapter detection', () => {
				adapter = BE.core.detectAdapter();
			});
			if (!adapterOk || !adapter) {
				BE.log.error('[Init] Adapter detection failed: falling back to generic adapter.');
				adapter = BE.adapters.registry.find((a) => a.id === 'generic') || null;
			}
			BE.adapters.active = adapter;
			BE.log.info(`[Init] Adapter: ${adapter ? adapter.id : 'NONE'}`);

			if (!adapter) {
				BE.log.error('[Init] FATAL: no adapter available (not even generic). Booru Enhancer cannot run on this page.');
				return;
			}

			// general.enabled may be undefined/corrupt in storage — treat
			// anything except an explicit `false` as enabled.
			const enabled = BE.settings.get('general.enabled') !== false;
			if (!enabled) {
				BE.log.info('[Init] Booru Enhancer is disabled in settings for this site. Registering menu command only.');
				safeStage('Menu commands', () => BE.modules.menu.register());
				return;
			}

			// 1. IMMEDIATE UI INIT — must appear regardless of storage/API state.
			safeStage('UI styles', () => BE.modules.ui.injectStyles());
			safeStage('Toolbar', () => BE.modules.ui.createToolbar());
			safeStage('Post action bar', () => BE.modules.ui.createPostActionBar());
			safeStage('Menu commands', () => BE.modules.menu.register());
			BE.log.info('[Init] UI initialized');

			// 2. IMMEDIATE GALLERY BINDING & LAYOUT
			let container = null;
			safeStage('Gallery init', () => {
				container = adapter.getGalleryContainer();
				if (container) BE.modules.gallery.init(container);
			});
				BE.log.info(`[Init] Gallery initialized (container: ${container ? 'found' : 'none on this page'})`);

				// 3. ASYNC METADATA ENRICHMENT — never blocks the UI above.
				setTimeout(() => safeStage('Metadata enrichment', () => BE.modules.gallery.enrichThumbnails()), 0);

				// 4. ASYNC INFINITE SCROLL — set up as soon as the gallery exists,
				// no arbitrary fixed delay beyond letting the container settle.
				if (BE.settings.get('gallery.infiniteScroll') && container) {
					safeStage('Infinite scroll', () => BE.modules.gallery.setupInfiniteScroll());
				}

				// 5. Viewer/hover/favorites are lazily initialized on first use,
				// so a failure there can never block startup.
		});
	};

	function refreshForCurrentPage() {
		safeStage('Toolbar refresh', () => BE.modules.ui.createToolbar());
		safeStage('Post action bar refresh', () => BE.modules.ui.createPostActionBar());
		BE.modules.ui.invalidateCurrentPost();
	}

	/* ============================================================ *
	 *  SPA / AJAX NAVIGATION HANDLING
	 * ============================================================ *
	 *  Sites like Danbooru/e621 can swap content via pushState/AJAX
	 *  without a full reload. Re-detect state and refresh page-scoped
	 *  UI (toolbar buttons, post action bar) without re-creating
	 *  duplicate global UI (toolbar root/listeners are idempotent).
	 * ============================================================ */
	(function watchSpaNavigation() {
		let lastUrl = location.href;
		const onUrlChange = BE.dom.debounce(() => {
			if (location.href === lastUrl) return;
			lastUrl = location.href;
			BE.log.debug('[Nav] URL changed, refreshing page-scoped UI');
			safeStage('Adapter re-detect', () => { BE.adapters.active = BE.core.detectAdapter() || BE.adapters.active; });
			refreshForCurrentPage();
		}, 150);

		for (const fnName of ['pushState', 'replaceState']) {
			const orig = history[fnName];
			history[fnName] = function patched(...args) {
				const ret = orig.apply(this, args);
				onUrlChange();
				return ret;
			};
		}
		window.addEventListener('popstate', onUrlChange);

		// Fallback for sites that replace DOM content without touching the
		// URL/history API at all. We only re-initialize when the container
		// found by the adapter is genuinely a DIFFERENT element than the one
		// the gallery module already owns — that distinguishes a true SPA
		// content swap from unrelated mutations inside the same gallery,
		// which must never reset pagination/loadedPostIds state.
		const bodyObserver = new MutationObserver(BE.dom.debounce(() => {
			if (!BE.adapters.active) return;
			const container = BE.adapters.active.getGalleryContainer();
			if (container && !container.dataset.beGalleryInit) {
				BE.log.debug('[Nav] gallery container replaced, re-initializing gallery module');
				safeStage('Gallery re-init', () => {
					BE.modules.gallery.init(container);
					if (BE.settings.get('gallery.infiniteScroll')) {
						BE.modules.gallery.setupInfiniteScroll();
					}
					setTimeout(() => safeStage('Metadata enrichment (re-init)', () => BE.modules.gallery.enrichThumbnails()), 0);
				});
			}
		}, 400));
		BE.dom.ready(() => bodyObserver.observe(document.body, { childList: true, subtree: true }));
	})();

	BE.dom.ready(BE.modules.init);

	// Public, idempotent entry point mentioned in the architecture spec —
	// calling this more than once must never duplicate UI/listeners.
	BE.init = BE.modules.init;
})();
