// ===== 通用弹出菜单：按锚点定位，点外面或 Esc 关闭 =====
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { create } from 'zustand';

export interface MenuItem { label: string; icon?: ReactNode; danger?: boolean; active?: boolean; disabled?: boolean; onClick?: () => void; hint?: string; }
interface MenuSpec { x: number; y: number; items: MenuItem[]; width?: number; align?: 'left' | 'right'; title?: string; }
interface MenuState { menu: MenuSpec | null; open: (spec: MenuSpec) => void; close: () => void; }
export const useMenu = create<MenuState>(set => ({ menu: null, open: spec => set({ menu: spec }), close: () => set({ menu: null }) }));

export function openMenuAt(anchor: Element | DOMRect, items: MenuItem[], opts: { width?: number; align?: 'left' | 'right'; title?: string } = {}) {
  const r = anchor instanceof Element ? anchor.getBoundingClientRect() : anchor;
  useMenu.getState().open({ x: opts.align === 'right' ? r.right : r.left, y: r.bottom + 6, items, width: opts.width, align: opts.align, title: opts.title });
}
export const closeMenu = () => useMenu.getState().close();

export function MenuHost() {
  const menu = useMenu(s => s.menu); const close = useMenu(s => s.close);
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    if (!menu || !ref.current) { setPos(null); return; }
    const w = ref.current.offsetWidth, h = ref.current.offsetHeight;
    let left = menu.align === 'right' ? menu.x - w : menu.x; let top = menu.y;
    left = Math.max(8, Math.min(left, window.innerWidth - w - 8));
    if (top + h > window.innerHeight - 8) top = Math.max(8, menu.y - h - 12);
    setPos({ left, top });
  }, [menu]);
  useEffect(() => {
    if (!menu) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) close(); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const t = setTimeout(() => { document.addEventListener('mousedown', onDown); }, 0);
    document.addEventListener('keydown', onKey); window.addEventListener('resize', close);
    return () => { clearTimeout(t); document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); window.removeEventListener('resize', close); };
  }, [menu, close]);
  if (!menu) return null;
  return (
    <div ref={ref} className="menu" role="menu" style={{ left: pos?.left ?? menu.x, top: pos?.top ?? menu.y, width: menu.width, visibility: pos ? 'visible' : 'hidden' }}>
      {menu.title && <div className="menu-title">{menu.title}</div>}
      {menu.items.map((it, i) => (
        <button key={i} type="button" role="menuitem" className={`menu-item${it.danger ? ' danger' : ''}${it.active ? ' active' : ''}`} disabled={it.disabled} onClick={() => { close(); it.onClick?.(); }}>
          {it.icon && <span className="menu-icon">{it.icon}</span>}
          <span className="menu-label">{it.label}</span>
          {it.hint && <span className="menu-hint">{it.hint}</span>}
        </button>
      ))}
    </div>
  );
}
