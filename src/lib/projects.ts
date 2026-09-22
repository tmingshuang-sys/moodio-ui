// ===== 项目层：多个项目各自拥有独立的文件（文稿 / 媒体）与对话 =====
// 索引 moodio-projects-v1 = { active, projects:[{id,title,createdAt,updatedAt}] }；每个项目的数据键 = 基础键 + '::' + 项目id。
// 与旧版原型共用同一份索引，所以旧项目会原样出现，首次打开时由 migrate.ts 把旧的剧本 / 资产转成文件。
import type { ProjectMeta } from './types';

const INDEX_KEY = 'moodio-projects-v1';
export const SCOPED_BASES = ['moodio-files-v1', 'moodio-agent-chats', 'moodio-ui-refined-storyboard-v1'];
export const NEW_PROJECT_TITLE = '新创作';   // 点「创作」建出的项目先叫这个，第一句话发出后自动改成对话标题
const FRESH_KEY = 'moodio-project-fresh::';   // 标记：这个项目是新建的空白项目，首次加载不放示例文稿、工作区默认收起
export const isFreshProject = (id: string) => { try { return localStorage.getItem(FRESH_KEY + id) === '1'; } catch { return false; } };
export const clearFreshMark = (id: string) => { try { localStorage.removeItem(FRESH_KEY + id); } catch { /* ignore */ } };
const markFresh = (id: string) => { try { localStorage.setItem(FRESH_KEY + id, '1'); } catch { /* ignore */ } };

interface Index { active: string; projects: ProjectMeta[]; }

const read = (): Index | null => { try { return JSON.parse(localStorage.getItem(INDEX_KEY) || 'null'); } catch { return null; } };
const write = (index: Index) => { try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); } catch { /* 本地存储不可用 */ } };
const newId = () => 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

let index = read();
if (!index || !Array.isArray(index.projects) || !index.projects.length) {
  const first: ProjectMeta = { id: newId(), title: '我的项目', createdAt: Date.now(), updatedAt: Date.now() };
  index = { active: first.id, projects: [first] };
  write(index);
}
if (!index.projects.some(p => p.id === index!.active)) { index.active = index.projects[0].id; write(index); }

const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

export const projects = {
  active(): ProjectMeta { return index!.projects.find(p => p.id === index!.active)!; },
  list(): ProjectMeta[] { return index!.projects.slice(); },
  key(base: string) { return base + '::' + index!.active; },
  touch() { const p = this.active(); if (p) { p.updatedAt = Date.now(); write(index!); } },
  create(title: string, { reload = true } = {}) {
    const p: ProjectMeta = { id: newId(), title: String(title || '').trim() || `项目 ${index!.projects.length + 1}`, createdAt: Date.now(), updatedAt: Date.now() };
    index!.projects.push(p); index!.active = p.id; write(index!); markFresh(p.id); notify();
    if (reload) setTimeout(() => location.reload(), 300);
    return p;
  },
  // 清空一个项目的全部数据（文件 / 对话 / 旧版工作区），之后它就是一个空白项目
  clearData(id: string) {
    SCOPED_BASES.forEach(base => { try { localStorage.removeItem(base + '::' + id); } catch { /* ignore */ } });
    markFresh(id);
  },
  switchTo(id: string, { reload = true } = {}) {
    if (!index!.projects.some(p => p.id === id) || id === index!.active) return false;
    index!.active = id; write(index!); notify();
    if (reload) setTimeout(() => location.reload(), 300);
    return true;
  },
  rename(id: string, title: string) {
    const p = index!.projects.find(x => x.id === id); const next = String(title || '').trim();
    if (!p || !next) return false;
    p.title = next; p.updatedAt = Date.now(); write(index!); notify();
    if (id === index!.active) document.title = `${next} · Moodio`;
    return true;
  },
  remove(id: string, { reload = true } = {}) {
    if (index!.projects.length <= 1) return false;
    if (!index!.projects.some(x => x.id === id)) return false;
    SCOPED_BASES.forEach(base => { try { localStorage.removeItem(base + '::' + id); } catch { /* ignore */ } }); clearFreshMark(id);
    index!.projects = index!.projects.filter(x => x.id !== id);
    const wasActive = id === index!.active;
    if (wasActive) index!.active = index!.projects[0].id;
    write(index!); notify();
    if (wasActive && reload) setTimeout(() => location.reload(), 300);
    return true;
  },
  subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; },
};

document.title = `${projects.active().title} · Moodio`;
