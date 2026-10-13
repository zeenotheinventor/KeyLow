import React from 'react';
import { typeStyle } from '../core/kl.js';
import { Icon } from '../core/Icon.jsx';

const TABS = [
  { key: 'diary', label: 'Diary', icon: 'BookOpen' },
  { key: 'foods', label: 'Foods', icon: 'Apple' },
  { key: 'recipes', label: 'Recipes', icon: 'ChefHat' },
  { key: 'weight', label: 'Weight', icon: 'Scale' },
  { key: 'settings', label: 'Settings', icon: 'Settings' },
];

/** Tab bar. iOS: 49 pt bar, tinted icon and label, an accent underline that wipes across on change. Android: Material-style active pill behind the icon. Safe area is added below. */
export function TabBar({ active = 'diary', onChange, platform = 'ios', tabs = TABS, style }) {
  const idx = Math.max(0, tabs.findIndex((t) => t.key === active));
  const n = tabs.length;
  const android = platform === 'android';
  return (
    <nav aria-label="Main" style={{ position: 'relative', display: 'grid', gridTemplateColumns: `repeat(${n}, 1fr)`, height: android ? 64 : 'var(--tab-bar-height)', paddingBottom: 'var(--safe-area-bottom)', background: android ? 'var(--surface-raised)' : 'var(--surface)', borderTop: android ? 0 : '1px solid var(--border)', fontFamily: 'var(--font-sans)', ...style }}>
      {!android && <span aria-hidden style={{ position: 'absolute', top: -1, left: 0, width: `calc(100% / ${n})`, height: 2, display: 'flex', justifyContent: 'center', transform: `translateX(${idx * 100}%)`, transition: 'transform var(--duration-quick) var(--ease-spring)' }}><span style={{ width: 28, height: 2, background: 'var(--accent)', borderRadius: 1, transform: 'skewX(calc(-20deg * var(--motion-skew)))' }}></span></span>}
      {tabs.map((t, i) => { const on = i === idx; return (
        <button key={t.key} type="button" aria-current={on ? 'page' : undefined} onClick={() => onChange && onChange(t.key)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: android ? 4 : 2, background: 'transparent', border: 0, padding: 0, cursor: 'pointer', color: on ? (android ? 'var(--text-primary)' : 'var(--accent)') : 'var(--text-muted)', outline: 'none', WebkitTapHighlightColor: 'transparent', transition: 'color var(--duration-quick) ease' }}>
          <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: android ? 56 : 'auto', height: android ? 28 : 'auto', borderRadius: 'var(--radius-pill)', background: android && on ? 'var(--accent-muted)' : 'transparent', color: android && on ? 'var(--accent)' : 'inherit', transition: 'background var(--duration-quick) var(--ease-enter)' }}><Icon name={t.icon} size="lg" /></span>
          <span style={{ ...typeStyle('caption'), fontSize: android ? 'var(--type-caption-size)' : '10px', lineHeight: '12px', fontWeight: on ? 'var(--weight-semibold)' : 'var(--weight-medium)' }}>{t.label}</span>
        </button>
      ); })}
    </nav>
  );
}
