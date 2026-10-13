import React from 'react';

// Renders a Lucide icon from the globally loaded `lucide` UMD bundle (window.lucide.icons).
// Stroke weight is the --icon-stroke token; size is an icon size token.
const SIZES = { sm: 'var(--icon-sm)', md: 'var(--icon-md)', lg: 'var(--icon-lg)', xl: 'var(--icon-xl)' };
const toPascal = (s) => s.split('-').map((p) => p.charAt(0).toUpperCase() + p.slice(1)).join('');

function nodeChildren(node) {
  if (!node) return [];
  if (Array.isArray(node) && node[0] === 'svg') return node[2] || [];
  return node;
}

export function Icon({ name, size = 'md', color = 'currentColor', label, style }) {
  const lib = typeof window !== 'undefined' && window.lucide && window.lucide.icons;
  const node = lib ? (lib[name] || lib[toPascal(name)]) : null;
  const px = SIZES[size] || size;
  const children = nodeChildren(node);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width={px} height={px} fill="none" stroke={color} strokeWidth="var(--icon-stroke)" strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : 'presentation'} aria-label={label} aria-hidden={label ? undefined : true} style={{ flex: 'none', display: 'inline-block', ...style }}>
      {children.map((c, i) => React.createElement(c[0], { key: i, ...c[1] }))}
    </svg>
  );
}
