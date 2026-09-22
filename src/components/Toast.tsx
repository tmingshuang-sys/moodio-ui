import { create } from 'zustand';

interface ToastItem { id: number; text: string; action?: { label: string; onClick: () => void } }
interface ToastState { items: ToastItem[]; push: (item: ToastItem) => void; remove: (id: number) => void; }
const useToast = create<ToastState>(set => ({ items: [], push: item => set(s => ({ items: [...s.items.slice(-2), item] })), remove: id => set(s => ({ items: s.items.filter(i => i.id !== id) })) }));

let seq = 0;
export function toast(text: string, action?: { label: string; onClick: () => void }) {
  const id = ++seq; useToast.getState().push({ id, text, action });
  setTimeout(() => useToast.getState().remove(id), action ? 6000 : 2600);
}

export function ToastHost() {
  const items = useToast(s => s.items); const remove = useToast(s => s.remove);
  return (
    <div className="toast-host" aria-live="polite">
      {items.map(i => (
        <div key={i.id} className="toast" role="status">
          <span>{i.text}</span>
          {i.action && <button type="button" onClick={() => { i.action!.onClick(); remove(i.id); }}>{i.action.label}</button>}
        </div>
      ))}
    </div>
  );
}
