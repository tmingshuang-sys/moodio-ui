    /* ===== 项目层：多个项目各自拥有独立的剧集 / 文档 / 分镜 / 资产 / 对话 / 回收站 =====
     * 存储方式：索引 moodio-projects-v1 = { active, projects:[{id,title,createdAt,updatedAt}] }
     *           每个项目的数据键 = 原键 + '::' + 项目id（例如 moodio-ui-refined-storyboard-v1::p-xxx）
     * 首次打开时把旧的单项目数据迁移为第一个项目，用户无感。切换 / 新建项目后整页重新加载。 */
    const moodioProjects = (() => {
      const INDEX_KEY = 'moodio-projects-v1';
      const SCOPED_BASES = ['moodio-ui-refined-storyboard-v1', 'moodio-agent-chats'];
      const read = () => { try { return JSON.parse(localStorage.getItem(INDEX_KEY) || 'null'); } catch (_) { return null; } };
      const write = index => { try { localStorage.setItem(INDEX_KEY, JSON.stringify(index)); return true; } catch (_) { return false; } };
      const newId = () => 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
      let index = read();
      if (!index || !Array.isArray(index.projects) || !index.projects.length) {
        // 迁移：把旧的单项目数据当作第一个项目
        const legacyTitle = document.querySelector('.project-title')?.textContent?.trim() || '我的项目';
        const first = { id: newId(), title: legacyTitle, createdAt: Date.now(), updatedAt: Date.now() };
        SCOPED_BASES.forEach(base => { const legacy = localStorage.getItem(base); if (legacy !== null && localStorage.getItem(base + '::' + first.id) === null) { try { localStorage.setItem(base + '::' + first.id, legacy); } catch (_) {} } });
        index = { active: first.id, projects: [first] };
        write(index);
      }
      if (!index.projects.some(p => p.id === index.active)) { index.active = index.projects[0].id; write(index); }
      const active = () => index.projects.find(p => p.id === index.active);
      const key = base => base + '::' + index.active;
      function touch() { const p = active(); if (p) { p.updatedAt = Date.now(); write(index); } }
      function reloadSoon(delay = 400) { setTimeout(() => location.reload(), delay); }
      function create(title, { reload = true } = {}) {
        const p = { id: newId(), title: String(title || '').trim() || `项目 ${index.projects.length + 1}`, createdAt: Date.now(), updatedAt: Date.now() };
        index.projects.push(p); index.active = p.id; write(index);
        try { localStorage.setItem('moodio-project-fresh::' + p.id, '1'); } catch (_) {}
        if (reload) reloadSoon();
        return p;
      }
      function switchTo(id, { reload = true } = {}) {
        if (!index.projects.some(p => p.id === id) || id === index.active) return false;
        try { window.persistWorkspace?.(); } catch (_) {}
        index.active = id; write(index);
        if (reload) reloadSoon();
        return true;
      }
      function rename(id, title) {
        const p = index.projects.find(x => x.id === id); const next = String(title || '').trim();
        if (!p || !next) return false;
        p.title = next; p.updatedAt = Date.now(); write(index);
        if (id === index.active) syncTitle();
        return true;
      }
      function remove(id, { reload = true } = {}) {
        if (index.projects.length <= 1) return false;
        const p = index.projects.find(x => x.id === id); if (!p) return false;
        SCOPED_BASES.forEach(base => { try { localStorage.removeItem(base + '::' + id); } catch (_) {} });
        try { localStorage.removeItem('moodio-project-fresh::' + id); } catch (_) {}
        index.projects = index.projects.filter(x => x.id !== id);
        const wasActive = id === index.active;
        if (wasActive) index.active = index.projects[0].id;
        write(index);
        if (wasActive && reload) reloadSoon();
        return true;
      }
      // 新建项目后第一次加载：返回 true 表示要把工作区重置为空白（由剧集模块执行）
      function consumeFresh() { const k = 'moodio-project-fresh::' + index.active; const fresh = localStorage.getItem(k) === '1'; if (fresh) { try { localStorage.removeItem(k); } catch (_) {} } return fresh; }
      function syncTitle() { const p = active(); const el = document.querySelector('.project-title'); if (el && p) el.textContent = p.title; if (p) document.title = `${p.title} · Moodio`; }
      syncTitle();
      return { key, active, list: () => index.projects.slice(), create, switchTo, rename, remove, consumeFresh, touch, syncTitle, INDEX_KEY };
    })();
