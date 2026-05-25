'use client';

import { useEffect } from 'react';
import { useLocale } from 'next-intl';
import { ADMIN_PHRASES_AR, ADMIN_STATIC_AR } from './adminLocale';

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE', 'PRE', 'KBD', 'SAMP']);
const ATTRS = ['aria-label', 'title', 'placeholder'] as const;

export function AdminLanguageBridge() {
  const locale = useLocale();

  useEffect(() => {
    const root = document.documentElement;
    root.lang = locale;
    root.dir = locale === 'ar' ? 'rtl' : 'ltr';
    root.dataset.adminLocale = locale;
    document.body.dataset.adminLocale = locale;

    if (locale !== 'ar') return undefined;

    const translateTree = (node: Node) => {
      translateTextNodes(node);
      if (node instanceof Element) translateElementAttrs(node);
      if ('querySelectorAll' in node) {
        (node as ParentNode).querySelectorAll<HTMLElement>('*').forEach(translateElementAttrs);
      }
    };

    translateTree(document.body);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') translateTextNode(mutation.target);
        for (const node of mutation.addedNodes) translateTree(node);
      }
    });
    observer.observe(document.body, {
      childList: true,
      characterData: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [locale]);

  return null;
}

function translateTextNodes(root: Node) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent || SKIP_TAGS.has(parent.tagName)) return NodeFilter.FILTER_REJECT;
      if (parent.closest('[data-no-admin-translate]')) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });
  let node = walker.nextNode();
  while (node) {
    translateTextNode(node);
    node = walker.nextNode();
  }
}

function translateTextNode(node: Node) {
  const text = node.textContent ?? '';
  const trimmed = text.trim();
  if (!trimmed) return;
  const translated = translateValue(trimmed);
  if (!translated || translated === trimmed) return;
  node.textContent = text.replace(trimmed, translated);
}

function translateElementAttrs(el: Element) {
  if (SKIP_TAGS.has(el.tagName) || el.closest('[data-no-admin-translate]')) return;
  for (const attr of ATTRS) {
    const value = el.getAttribute(attr);
    if (!value) continue;
    const translated = translateValue(value.trim());
    if (translated && translated !== value) el.setAttribute(attr, translated);
  }
}

function translateValue(value: string): string | null {
  if (ADMIN_PHRASES_AR[value]) return ADMIN_PHRASES_AR[value];
  if (ADMIN_STATIC_AR[value]) return ADMIN_STATIC_AR[value];
  const withArrow = value.match(/^←\s*(.+)$/);
  if (withArrow) {
    const label = ADMIN_PHRASES_AR[withArrow[1]!.trim()] ?? ADMIN_STATIC_AR[withArrow[1]!.trim()];
    return label ? `→ ${label}` : null;
  }
  const dotted = value.split('·').map((part) => part.trim());
  if (dotted.length > 1) {
    const translated = dotted.map((part) => ADMIN_PHRASES_AR[part] ?? ADMIN_STATIC_AR[part] ?? part);
    return translated.join(' · ');
  }
  return null;
}
