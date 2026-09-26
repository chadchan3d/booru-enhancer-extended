'use strict';

class MiniEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.button = init.button ?? 0;
    this.ctrlKey = !!init.ctrlKey;
    this.metaKey = !!init.metaKey;
    this.shiftKey = !!init.shiftKey;
    this.altKey = !!init.altKey;
    this.target = init.target || null;
    this.defaultPrevented = false;
  }
  preventDefault() { this.defaultPrevented = true; }
}

class MiniElement {
  constructor(document, tagName) {
    this.ownerDocument = document;
    this.tagName = String(tagName).toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this.listeners = new Map();
    this._mutationListeners = new Set();
    this.textContent = '';
  }
  get isConnected() {
    let n = this;
    while (n) {
      if (n === this.ownerDocument.body) return true;
      n = n.parentNode;
    }
    return false;
  }
  setAttribute(name, value) {
    const oldValue = this.attributes.has(name) ? this.attributes.get(name) : null;
    const newValue = String(value);
    this.attributes.set(name, newValue);
    this._emitMutation({ type: 'attributes', attributeName: name, oldValue, newValue });
  }
  removeAttribute(name) {
    const had = this.attributes.has(name);
    const oldValue = had ? this.attributes.get(name) : null;
    this.attributes.delete(name);
    if (had) this._emitMutation({ type: 'attributes', attributeName: name, oldValue, newValue: null });
  }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  hasAttribute(name) { return this.attributes.has(name); }
  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child, { preserveFocus: true });
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  insertBefore(child, before) {
    if (!before) return this.appendChild(child);
    if (child.parentNode) child.parentNode.removeChild(child, { preserveFocus: true });
    const i = this.children.indexOf(before);
    if (i < 0) throw new Error('before node is not a child');
    child.parentNode = this;
    this.children.splice(i, 0, child);
    return child;
  }
  removeChild(child, opts = {}) {
    const i = this.children.indexOf(child);
    if (i < 0) throw new Error('child not found');
    const doc = this.ownerDocument;
    const focusedInside = child.contains(doc.activeElement);
    this.children.splice(i, 1);
    child.parentNode = null;
    if (focusedInside && !opts.preserveFocus) doc.activeElement = doc.body;
    return child;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  contains(node) {
    if (!node) return false;
    if (node === this) return true;
    return this.children.some(c => c.contains(node));
  }
  addEventListener(type, fn) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(fn);
  }
  removeEventListener(type, fn) { this.listeners.get(type)?.delete(fn); }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    for (const fn of [...(this.listeners.get(event.type) || [])]) fn(event);
    return !event.defaultPrevented;
  }
  focus() {
    if (this.isConnected) this.ownerDocument.activeElement = this;
  }
  observeMutations(fn) {
    this._mutationListeners.add(fn);
    return () => this._mutationListeners.delete(fn);
  }
  _emitMutation(record) {
    for (const fn of [...this._mutationListeners]) fn({ ...record, target: this });
  }
}

class MiniDocument {
  constructor() {
    this.body = new MiniElement(this, 'body');
    this.activeElement = this.body;
  }
  createElement(tag) { return new MiniElement(this, tag); }
}

function structuralSnapshot(node) {
  return {
    tagName: node.tagName,
    attributes: [...node.attributes.entries()].sort(([a],[b]) => a.localeCompare(b)),
    textContent: node.textContent,
    children: node.children.map(structuralSnapshot),
  };
}

module.exports = { MiniDocument, MiniElement, MiniEvent, structuralSnapshot };
