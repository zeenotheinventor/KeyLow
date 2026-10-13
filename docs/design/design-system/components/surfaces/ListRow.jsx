import React from 'react';
import { typeStyle, numeric, focusRing, useInteraction } from '../core/kl.js';
import { Icon } from '../core/Icon.jsx';
import { Badge } from '../feedback/Badge.jsx';

/** List row: leading icon, title, subtitle, trailing value, chevron. `source` adds a source badge under the title. `revealDelete` shows the swipe-to-delete action (the row is swiped left). */
export function ListRow({ icon, title, subtitle, value, unit, chevron = true, source, onPress, revealDelete = false, onDelete, disabled = false, index = 0, animate = false, style }) {
  const { focus, pressed, hover, handlers } = useInteraction(disabled);
  const Tag = onPress ? 'button' : 'div';
  const overlay = pressed ? 'var(--press-overlay)' : hover ? 'var(--hover-overlay)' : 'transparent';
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-medium)', animation: animate ? `kl-cut-in var(--duration-standard) var(--ease-enter) both` : undefined, animationDelay: animate ? `calc(${index} * var(--stagger))` : undefined, ...style }}>
      {revealDelete && <button type="button" onClick={onDelete} style={{ ...typeStyle('body-strong'), position: 'absolute', top: 0, bottom: 0, right: 0, width: 88, border: 0, background: 'var(--danger)', color: 'var(--text-on-status)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--space-1)', fontFamily: 'var(--font-sans)' }}><Icon name="Trash2" size="sm" />Delete</button>}
      <Tag type={onPress ? 'button' : undefined} onClick={onPress} disabled={disabled || undefined} {...handlers}
        style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 'var(--space-3)', minHeight: 56, padding: 'var(--space-2) var(--space-3)', boxSizing: 'border-box', background: 'var(--surface)', border: 0, borderRadius: 'var(--radius-medium)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', textAlign: 'left', cursor: onPress && !disabled ? 'pointer' : 'default', outline: 'none', opacity: disabled ? 0.5 : 1, WebkitTapHighlightColor: 'transparent', transform: pressed ? 'scale(0.985)' : 'none', marginRight: revealDelete ? 88 : 0, width: revealDelete ? 'calc(100% - 88px)' : '100%', transition: 'transform var(--duration-standard) var(--ease-spring), width var(--duration-standard) var(--ease-spring), margin var(--duration-standard) var(--ease-spring), box-shadow var(--duration-instant) ease', ...focusRing(focus) }}>
        <span aria-hidden style={{ position: 'absolute', inset: 0, borderRadius: 'inherit', background: overlay, transition: 'background var(--duration-quick) ease', pointerEvents: 'none' }}></span>
        {icon && <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 36, height: 36, borderRadius: 'var(--radius-small)', background: 'var(--surface-raised)', color: 'var(--text-secondary)', flex: 'none' }}>{typeof icon === 'string' ? <Icon name={icon} size="md" /> : icon}</span>}
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', minWidth: 0 }}>
            <span style={{ ...typeStyle('body-strong'), overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{title}</span>
            {source && <Badge kind="source" source={source} />}
          </span>
          {subtitle && <span style={{ ...typeStyle('caption'), color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{subtitle}</span>}
        </span>
        {value !== undefined && <span style={{ display: 'flex', alignItems: 'baseline', gap: 3, flex: 'none' }}><span style={{ ...typeStyle('numeral-small'), ...numeric }}>{value}</span>{unit && <span style={{ ...typeStyle('caption'), color: 'var(--text-muted)' }}>{unit}</span>}</span>}
        {chevron && onPress && <Icon name="ChevronRight" size="md" color="var(--text-muted)" />}
      </Tag>
    </div>
  );
}
