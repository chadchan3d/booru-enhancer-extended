'use strict';

function createOwner({ origin = null, fallback = null } = {}) {
  let disposed = false;
  const attributeRecords = [];
  const additions = [];
  const listeners = [];
  const cleanups = [];
  const mutationUnsubs = [];

  function ownAttribute(node, name, value) {
    const record = {
      node, name,
      originalPresent: node.hasAttribute(name),
      originalValue: node.getAttribute(name),
      nativeTouched: false,
      suppress: false,
    };
    record.suppress = true;
    if (value === null || value === undefined) node.removeAttribute(name);
    else node.setAttribute(name, value);
    record.suppress = false;
    const unsub = node.observeMutations((m) => {
      if (!record.suppress && m.attributeName === name) record.nativeTouched = true;
    });
    mutationUnsubs.push(unsub);
    attributeRecords.push(record);
    return record;
  }

  function addOwned(node, parent) {
    parent.appendChild(node);
    additions.push(node);
    return node;
  }

  function on(node, type, fn) {
    node.addEventListener(type, fn);
    listeners.push([node, type, fn]);
  }

  function cleanup(fn) { cleanups.push(fn); }
  function guard(fn) { return (...args) => { if (!disposed) return fn(...args); }; }

  function dispose() {
    if (disposed) return { alreadyDisposed: true, reloadRecommended: false };
    disposed = true;

    for (const unsub of mutationUnsubs.splice(0)) unsub();
    for (const [node, type, fn] of listeners.splice(0)) node.removeEventListener(type, fn);

    for (const record of attributeRecords) {
      if (record.nativeTouched) continue;
      record.suppress = true;
      if (record.originalPresent) record.node.setAttribute(record.name, record.originalValue);
      else record.node.removeAttribute(record.name);
      record.suppress = false;
    }

    const doc = origin?.ownerDocument || fallback?.ownerDocument || additions[0]?.ownerDocument || null;
    const active = doc?.activeElement || null;
    const removingFocusedOwned = additions.some(node => node.contains(active));

    for (const node of additions.slice().reverse()) {
      if (node.parentNode) node.remove();
    }

    let focusOutcome = 'unchanged';
    let reloadRecommended = false;
    if (removingFocusedOwned && doc) {
      if (origin?.isConnected) {
        origin.focus();
        focusOutcome = 'origin';
      } else if (fallback?.isConnected) {
        fallback.focus();
        focusOutcome = 'fallback';
      } else {
        focusOutcome = 'unresolved';
        reloadRecommended = true;
      }
    }

    for (const fn of cleanups.splice(0)) fn();
    return { alreadyDisposed: false, focusOutcome, reloadRecommended };
  }

  return {
    ownAttribute, addOwned, on, cleanup, guard, dispose,
    get disposed() { return disposed; },
  };
}

function safeViewerClick(event, { openShell, isNativeControl = false } = {}) {
  if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || isNativeControl) return false;
  const opened = openShell();
  if (!opened) return false;
  event.preventDefault();
  return true;
}

module.exports = { createOwner, safeViewerClick };
