import React from 'react';
import { typeStyle } from '../core/kl.js';

/** Card. `level` picks the surface: "surface" sits on the background, "raised" sits on a surface. `flourish` plays the confirmation slash once per change of its value. */
export function Card({ level = 'surface', padding = 'var(--space-4)', title, children, flourish, onClick, style, ...rest }) {
  const [slashKey, setSlashKey] = React.useState(0);
  const first = React.useRef(true);
  React.useEffect(() => { if (first.current) { first.current = false; return; } if (flourish) setSlashKey((k) => k + 1); }, [flourish]);
  return (
    <div onClick={onClick} {...rest} style={{ position: 'relative', overflow: 'hidden', background: level === 'raised' ? 'var(--surface-raised)' : 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-large)', boxShadow: 'var(--elevation-card)', padding, fontFamily: 'var(--font-sans)', color: 'var(--text-primary)', cursor: onClick ? 'pointer' : undefined, ...style }}>
      {title && <div style={{ ...typeStyle('h2'), marginBottom: 'var(--space-3)' }}>{title}</div>}
      {children}
      {slashKey > 0 && <span key={slashKey} aria-hidden style={{ position: 'absolute', top: '-20%', bottom: '-20%', left: 0, width: '18%', background: 'var(--accent)', opacity: 0, pointerEvents: 'none', animation: 'kl-slash var(--duration-flourish) var(--ease-exit) both' }}></span>}
    </div>
  );
}
