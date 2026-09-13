    /* ===== 版本层：每份文档的自动快照（IndexedDB），侧栏时间线与一键恢复 =====
     * 快照记录：{ id, projectId, episodeId, fileId, fileType, title, at, reason, size, data }
     * reason：auto（定时，30 天后清理）/ manual（手动）/ agent-before / agent（Agent 执行前后）/ before-restore（恢复前）
     * 内容相同不会重复保存；每份文档最多 100 条。 */
    var moodioVersions = (() => {   // var：初始渲染早于本模块执行，侧栏用 typeof 探测时不能是 TDZ 的 const
      const DB = 'moodio-versions', STORE = 'snapshots', MAX_PER_FILE = 100, AUTO_TTL = 30 * 864e5, AUTO_INTERVAL = 120000;
      const SKIP_TYPES = new Set(['scriptOrder', 'locationBreakdown', 'dailyReport', 'dailySchedule']);
      const REASON_LABEL = { auto: '自动', manual: '手动保存', agent: 'Agent 执行后', 'agent-before': 'Agent 执行前', 'before-restore': '恢复前' };
      let dbPromise = null;
      function db() {
        if (!dbPromise) dbPromise = new Promise((res, rej) => {
          const req = indexedDB.open(DB, 1);
          req.onupgradeneeded = () => { const s = req.result.createObjectStore(STORE, { keyPath: 'id', autoIncrement: true }); s.createIndex('byFile', ['projectId', 'fileId']); };
          req.onsuccess = () => res(req.result); req.onerror = () => rej(req.error);
        });
        return dbPromise;
      }
      async function run(mode, fn) {
        const d = await db();
        return new Promise((res, rej) => {
          const t = d.transaction(STORE, mode), s = t.objectStore(STORE); let req = null;
          try { req = fn(s); } catch (e) { rej(e); return; }
          t.oncomplete = () => res(req && 'result' in req ? req.result : undefined); t.onerror = () => rej(t.error);
        });
      }
      function content(file) {
        if (!file) return null;
        if (file.type === 'script') return { scriptBlocks: scriptBlocksOf(file).map(b => ({ id: b.id, type: b.type, text: b.text })) };
        if (file.type === 'storyboard') { const board = file.id; return { shots: JSON.parse(JSON.stringify(state.shots.filter(s => (s.boardFileId || 'film-storyboard-list') === board))) }; }
        const c = {};
        ['docHtml', 'editableText', 'content', 'sheets', 'activeSheet', 'canvas', 'mindmap', 'comments', 'title'].forEach(k => { if (file[k] !== undefined) c[k] = JSON.parse(JSON.stringify(file[k])); });
        return c;
      }
      // 版本摘要：给 Agent 和面板看的一小段内容
      function preview(row, n = 60) {
        const d = row.data || {}; let text = '';
        if (d.scriptBlocks) text = d.scriptBlocks.map(b => b.text).filter(t => t && t.trim()).join(' / ');
        else if (d.shots) text = d.shots.map(s => s.description).join(' / ');
        else if (d.docHtml) text = String(d.docHtml).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
        else if (d.editableText) text = Object.values(d.editableText).join(' / ');
        return text.slice(0, n) + (text.length > n ? '…' : '');
      }
      const hash = s => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h.toString(36) + ':' + s.length; };
      const lastHash = new Map();
      const projectId = () => moodioProjects.active()?.id || null;
      const fileList = () => Object.values(fileStore()).flat().filter(f => f && !SKIP_TYPES.has(f.type));
      async function list(fileId) { const rows = await run('readonly', s => s.index('byFile').getAll([projectId(), fileId])); return (rows || []).sort((a, b) => b.at - a.at); }
      async function get(id) { return run('readonly', s => s.get(Number(id))); }
      async function snapshot(file, reason = 'auto') {
        if (!file || SKIP_TYPES.has(file.type)) return null;
        const data = content(file); if (!data) return null;
        const json = JSON.stringify(data), h = hash(json);
        if (lastHash.get(file.id) === h && reason !== 'manual') return null;   // 内容没变不重复存
        const row = { projectId: projectId(), episodeId: state.activeEpisodeId || null, fileId: file.id, fileType: file.type, title: file.title, at: Date.now(), reason, size: json.length, data };
        row.id = await run('readwrite', s => s.add(row));
        lastHash.set(file.id, h);
        await prune(file.id);
        return row;
      }
      async function prune(fileId) {
        const rows = await list(fileId), now = Date.now(), drop = [];
        rows.forEach((r, i) => { if (i >= MAX_PER_FILE || (r.reason === 'auto' && now - r.at > AUTO_TTL)) drop.push(r.id); });
        if (drop.length) await run('readwrite', s => { drop.forEach(id => s.delete(id)); return null; });
      }
      async function snapshotAll(reason = 'auto') {
        try { captureVisibleEdits?.(); } catch (_) {}
        const out = [];
        for (const f of fileList()) { try { const r = await snapshot(f, reason); if (r) out.push(r); } catch (e) { console.warn('快照失败', e); } }
        if (out.length) refreshPanel();
        return out;
      }
      async function primeHashes() { for (const f of fileList()) { if (lastHash.has(f.id)) continue; try { const rows = await list(f.id); if (rows[0]) lastHash.set(f.id, hash(JSON.stringify(rows[0].data))); } catch (_) {} } }
      async function restore(id) {
        const row = await get(id); if (!row) throw new Error('找不到这个版本');
        const file = findFile(row.fileId); if (!file) throw new Error('这份文档已不存在（可能在回收站里）');
        try { captureVisibleEdits?.(); } catch (_) {}
        await snapshot(file, 'before-restore');
        if (file.type === 'script') {
          const h = shist(file); h.past.push(JSON.stringify(file.scriptBlocks || [])); if (h.past.length > 100) h.past.shift(); h.future = [];
          file.scriptBlocks = JSON.parse(JSON.stringify(row.data.scriptBlocks || [])); h.baseline = JSON.stringify(file.scriptBlocks);
        } else if (file.type === 'storyboard') {
          const board = file.id; state.shots = [...state.shots.filter(s => (s.boardFileId || 'film-storyboard-list') !== board), ...JSON.parse(JSON.stringify(row.data.shots || []))];
        } else {
          Object.entries(row.data).forEach(([k, v]) => { file[k] = JSON.parse(JSON.stringify(v)); });
        }
        file.updated = '刚刚'; file.updatedAt = Date.now();
        // 先把这份文档的稿纸从画面上移除，避免 render() 把旧内容写回文件
        $$(`[data-paper][data-page-file="${file.id}"]`).forEach(el => el.remove());
        scriptRestoring = true; try { persistWorkspace(); render(); } finally { scriptRestoring = false; }
        lastHash.set(file.id, hash(JSON.stringify(content(file))));
        refreshPanel();
        return { file, row };
      }
      // ---- 侧栏「历史版本」区 ----
      const fmtTime = at => { const d = new Date(at), now = new Date(); const sameDay = d.toDateString() === now.toDateString(); return (sameDay ? '今天 ' : `${d.getMonth() + 1}/${d.getDate()} `) + `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
      const fmtSize = n => n > 10000 ? `${(n / 1000).toFixed(0)}k 字符` : `${n} 字符`;
      function sectionHtml() { return ctxSection('历史版本', '<button type="button" class="version-save" data-version-save data-no-tip>保存版本</button>', '<div data-context-fill="versions" class="version-list"><p class="writing-folders-empty">读取中…</p></div>'); }
      async function fillSlot(slot) {
        const { file } = contextDocInfo(); if (!file || SKIP_TYPES.has(file.type)) { slot.innerHTML = '<p class="writing-folders-empty">这类文档不记录版本</p>'; return; }
        let rows = []; try { rows = await list(file.id); } catch (e) { slot.innerHTML = '<p class="writing-folders-empty">版本库不可用</p>'; return; }
        if (!rows.length) { slot.innerHTML = '<p class="writing-folders-empty">还没有快照。内容变化后每 2 分钟自动保存，Agent 执行前后也会保存。</p>'; return; }
        slot.innerHTML = rows.slice(0, 30).map((r, i) => `<div class="version-row${i === 0 ? ' latest' : ''}"><div><strong>${fmtTime(r.at)}</strong><small title="${escapeHtml(preview(r, 200))}">${REASON_LABEL[r.reason] || r.reason} · ${fmtSize(r.size)}</small></div><button type="button" data-version-restore="${r.id}" data-no-tip>恢复</button></div>`).join('') + (rows.length > 30 ? `<p class="writing-folders-empty">还有 ${rows.length - 30} 个更早的版本</p>` : '');
      }
      function refreshPanel() { const slot = $('#writing-panel [data-context-fill="versions"]'); if (slot) fillSlot(slot); }
      document.addEventListener('click', event => {
        const save = event.target.closest('[data-version-save]');
        if (save) { event.preventDefault(); const { file } = contextDocInfo(); if (!file) return; try { captureVisibleEdits?.(); } catch (_) {} snapshot(file, 'manual').then(r => { showToast(r ? `已保存「${file.title}」的版本` : '已保存'); refreshPanel(); }).catch(e => showToast('保存版本失败：' + e.message)); return; }
        const rs = event.target.closest('[data-version-restore]');
        if (rs) { event.preventDefault(); const id = Number(rs.dataset.versionRestore); get(id).then(row => { if (!row) return; if (!window.confirm(`恢复「${row.title}」到 ${fmtTime(row.at)} 的版本？当前内容会先另存一份，可以再恢复回来。`)) return; return restore(id).then(({ file }) => showToast(`已恢复「${file.title}」到 ${fmtTime(row.at)} 的版本`)); }).catch(e => showToast('恢复失败：' + e.message)); }
      });
      primeHashes().then(() => snapshotAll('auto')).then(() => { try { render(); } catch (_) {} });   // 模块就绪后重绘一次，让侧栏出现「历史版本」
      setInterval(() => { if (!document.hidden) snapshotAll('auto'); }, AUTO_INTERVAL);
      return { list, get, snapshot, snapshotAll, restore, sectionHtml, fillSlot, refreshPanel, preview, REASON_LABEL, fmtTime };
    })();
