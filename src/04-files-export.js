    const BACKUP_SKIP_KEYS = new Set(['moodio-agent-model']);   // API 密钥不进备份文件
    function backupLocalKeys() { return Object.keys(localStorage).filter(k => k.startsWith('moodio-') && !BACKUP_SKIP_KEYS.has(k)); }
    function blobToDataUrl(blob) { return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); }); }
    async function readAllMedia() {
      const db = await cdocDb();
      const rows = await new Promise((res, rej) => {
        const tx = db.transaction('files'), store = tx.objectStore('files'), out = [];
        const req = store.openCursor();
        req.onsuccess = () => { const c = req.result; if (!c) return res(out); out.push({ id: String(c.key), blob: c.value }); c.continue(); };
        req.onerror = () => rej(req.error);
      });
      const media = [];
      for (const row of rows) { if (row.blob instanceof Blob) media.push({ id: row.id, type: row.blob.type || 'application/octet-stream', data: await blobToDataUrl(row.blob) }); }
      return media;
    }
    async function writeAllMedia(media) {
      const db = await cdocDb();
      await new Promise((res, rej) => { const tx = db.transaction('files', 'readwrite'); tx.objectStore('files').clear(); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
      for (const m of media || []) {
        if (!m || typeof m.id !== 'string' || typeof m.data !== 'string') continue;
        const blob = await (await fetch(m.data)).blob();
        await cdocPutMedia(m.id, blob);
      }
    }
    async function buildProjectBackup() {
      try { captureVisibleEdits?.(); } catch (_) {}
      persistWorkspace();
      const entries = {}; backupLocalKeys().forEach(k => { entries[k] = localStorage.getItem(k); });
      let media = []; try { media = await readAllMedia(); } catch (e) { console.warn('媒体读取失败，备份中不含图片视频', e); }
      return { app: 'moodio-ui', kind: 'project-backup', version: 1, exportedAt: new Date().toISOString(), localStorage: entries, media };
    }
    async function exportProjectBackup() {
      const backup = await buildProjectBackup();
      const json = JSON.stringify(backup);
      const d = new Date(), pad = n => String(n).padStart(2, '0');
      const name = `moodio-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
      const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      showToast(`已导出备份 ${name}（${(json.length / 1024 / 1024).toFixed(2)} MB，含 ${backup.media.length} 个媒体文件）`);
    }
    let pendingBackup = null;
    function validateBackup(data) {
      if (!data || data.app !== 'moodio-ui' || data.kind !== 'project-backup' || typeof data.localStorage !== 'object') throw new Error('这不是 Moodio 的项目备份文件');
      if (!data.localStorage[WORKSPACE_STORAGE_KEY]) throw new Error('备份文件里没有项目数据');
      JSON.parse(data.localStorage[WORKSPACE_STORAGE_KEY]);   // 确认能解析
      return data;
    }
    async function applyProjectBackup(data) {
      backupLocalKeys().forEach(k => localStorage.removeItem(k));
      Object.entries(data.localStorage).forEach(([k, v]) => { if (k.startsWith('moodio-') && !BACKUP_SKIP_KEYS.has(k) && typeof v === 'string') localStorage.setItem(k, v); });
      try { await writeAllMedia(data.media); } catch (e) { console.warn('媒体恢复失败', e); }
    }
    document.addEventListener('click', event => {
      if (event.target.closest('[data-backup-export]')) { event.preventDefault(); exportProjectBackup().catch(e => showToast('导出失败：' + e.message)); return; }
      if (event.target.closest('[data-backup-import]')) { event.preventDefault(); $('#backup-file-input').value = ''; $('#backup-file-input').click(); return; }
      if (event.target.closest('[data-backup-confirm]')) {
        event.preventDefault(); const data = pendingBackup; pendingBackup = null; closeFlowDialog();
        if (!data) return;
        applyProjectBackup(data).then(() => { showToast('备份已恢复，正在重新加载…'); setTimeout(() => location.reload(), 600); }).catch(e => showToast('恢复失败：' + e.message));
      }
    });
    document.addEventListener('change', event => {
      if (event.target.id !== 'backup-file-input') return;
      const file = event.target.files?.[0]; if (!file) return;
      file.text().then(text => {
        const data = validateBackup(JSON.parse(text));
        pendingBackup = data;
        const when = data.exportedAt ? new Date(data.exportedAt).toLocaleString() : '未知时间';
        closeExportDialog?.();
        openFlowDialog('导入项目备份', `<p>将用备份文件 <strong>${escapeHtml(file.name)}</strong>（导出于 ${escapeHtml(when)}，含 ${(data.media || []).length} 个媒体文件）覆盖当前浏览器里的全部项目数据，包括剧本、分镜、资产和 Agent 对话。</p><p>此操作不可撤销。建议先导出一份当前数据的备份。</p>`, flowButton('close-dialog', '取消') + '<button class="canvas-action primary" data-backup-confirm>覆盖并恢复</button>');
      }).catch(e => showToast('无法读取备份：' + e.message));
    });

    function createStoryboardFile(options = {}) {
      const newId = Math.max(0, ...state.shots.map(shot => shot.id)) + 1;
      const shot = {
        id: newId,
        sourceId: options.sourceId || null,
        sourceLabel: options.sourceLabel || '尚未指定剧本段落',
        description: options.description || '写下这个镜头要让观众看见与感受到什么。',
        tags: { '景别': [], '镜头运动': [], '摄影机角度': [], '透视关系': [], '景深强度': [], '光影效果': [] },
        media: null
      };
      state.shots.push(shot);
      state.shotTab[newId] = 'description';
      const file = addFile('storyboard', {
        title: `分镜 ${String(newId).padStart(2, '0')}`,
        preview: shot.description,
        shotId: newId,
        sourceId: shot.sourceId
      });
      return { shot, file };
    }

    function createTemplate(id) {
      state.workspaceMode = 'document';
      state.openCreateMenu = null;
      state.createMenuVisible = false;
      state.view = 'focus';
      const file = id === 'storyboard' ? createStoryboardFile().file : addFile(id);
      state.currentDoc = id;
      state.currentFileId = file.id;
      state.expandedStack = id;
      state.selectedPageSlot = 'left';
      state.locatedScriptId = null;
      render();
      $('#canvas-viewport').scrollTop = 0;
      showToast(`已新建“${file.title}”，并归入${docDef(id).name}纸堆`);
    }

    function selectFile(fileId) {
      const file = findFile(fileId);
      if (!file) return;
      state.workspaceMode = 'document';
      if (state.view === 'compare' && state.selectedPageSlot === 'right') {
        state.compareDoc = file.type;
        state.compareFileId = file.id;
      } else {
        state.currentDoc = file.type;
        state.currentFileId = file.id;
      }
      state.expandedStack = file.type;
      state.locatedScriptId = null;
      state.openCreateMenu = null;
      state.createMenuVisible = false;
      render();
      const scrollTarget = state.view === 'compare' ? $(`[data-paper][data-page-slot="${state.selectedPageSlot}"]`) : $('#canvas-viewport');
      if (scrollTarget) scrollTarget.scrollTop = 0;
      showToast(`已打开“${file.title}”`);
    }

    function selectDoc(id) {
      const file = latestFile(id);
      if (file) selectFile(file.id);
    }

    function switchMode(mode) {
      state.mode = mode;
      state.workspaceMode = 'document';
      state.currentDoc = mode === 'film' ? 'script' : 'episodeScript';
      state.compareDoc = mode === 'film' ? 'outline' : 'episodeOutline';
      state.currentFileId = latestFile(state.currentDoc)?.id || allFiles()[0]?.id || null;
      state.compareFileId = latestFile(state.compareDoc)?.id || allFiles().find(file => file.id !== state.currentFileId)?.id || null;
      state.view = 'focus';
      state.locatedScriptId = null;
      state.expandedStack = null;
      state.selectedShots.clear();
      state.openCreateMenu = null;
      render();
      showToast(mode === 'film' ? '已切换为电影创作路径' : '已切换为剧集创作路径');
    }

    function setView(view) {
      if (view === 'compare') {
        let secondary = findFile(state.compareFileId);
        if (!secondary || secondary.id === state.currentFileId) secondary = allFiles().find(file => file.id !== state.currentFileId) || null;
        if (!secondary) {
          showToast('至少需要两份稿纸才能进入对照视图');
          return;
        }
        state.compareFileId = secondary.id;
        state.compareDoc = secondary.type;
      }
      state.view = view;
      state.selectedPageSlot = 'left';
      render();
      $('#canvas-viewport').scrollTop = 0;
    }

    const COMPARE_INTRO_KEY = 'moodio-compare-mode-intro-seen-v1';
    let compareIntroAcknowledged = false;
    function compareIntroSeen() {
      try { return compareIntroAcknowledged || localStorage.getItem(COMPARE_INTRO_KEY) === '1'; }
      catch (_) { return compareIntroAcknowledged; }
    }
    function requestViewFromDock(view) {
      if (view !== 'compare' || compareIntroSeen()) return setView(view);
      captureVisibleEdits();
      closeAssetMenu(); hideAssetCard(); hideCaretToolbar(); cdocSlashClose(); hideWorkspaceTip();
      openFlowDialog('对照模式', `<section id="compare-mode-intro">
        <p>把两份文稿并排放在同一画布中，方便一边参考、一边编辑。</p>
        <div class="chunk-confirm-steps"><ol>
          <li><strong>左右对照</strong>：同时查看剧本与分镜表，也可以比较不同文档或版本。</li>
          <li><strong>自由搭配</strong>：把侧栏中的文档拖到左栏或右栏，替换对应的内容。</li>
          <li><strong>独立滚动与编辑</strong>：两栏可以分别滚动，修改保存在原文档中，不会创建副本。</li>
        </ol></div>
        <p class="chunk-confirm-note">点击底部「专注」可返回单页；再次进入「对照」时会恢复可用的上次组合。确认后，此说明不再重复显示。</p>
        <p id="compare-mode-intro-error" role="alert"></p>
      </section>`, flowButton('close-dialog', '暂不进入') + flowButton('confirm-compare-intro', '知道了，进入对照', '', true));
    }
    function confirmCompareIntro() {
      if (!$('#flow-dialog').open || !$('#compare-mode-intro')) return;
      if (!allFiles().some(file => file.id !== state.currentFileId)) {
        $('#compare-mode-intro-error').textContent = '至少需要两份文档才能对照，请先新建或导入另一份文档。';
        return;
      }
      closeFlowDialog();
      setView('compare');
      if (state.view !== 'compare') return;
      compareIntroAcknowledged = true;
      try { localStorage.setItem(COMPARE_INTRO_KEY, '1'); } catch (_) {}
    }

    function renameFile(fileId, title) {
      const file = findFile(fileId);
      const nextTitle = title.trim();
      if (!file || !nextTitle) return;
      file.title = nextTitle;
      file.updated = '刚刚';
      state.renamingFileId = null;
      render();
      showToast(`已重命名为“${nextTitle}”`);
    }

    function duplicateFile(fileId) {
      const source = findFile(fileId);
      if (!source) return;
      const copy = addFile(source.type, { title: `${source.title} 副本`, preview: source.preview, content: source.content, shotId: source.shotId, sourceId: source.sourceId });
      if (source.editableText) copy.editableText = { ...source.editableText };
      ['kind', 'docHtml', 'updatedAt'].forEach(k => { if (source[k] !== undefined) copy[k] = source[k]; });
      ['comments', 'sheet', 'sheets', 'canvas', 'mindmap'].forEach(k => { if (source[k]) copy[k] = JSON.parse(JSON.stringify(source[k])); });
      if (source.activeSheet !== undefined) copy.activeSheet = source.activeSheet;
      state.expandedStack = source.type;
      persistWorkspace();
      render();
      showToast(`已创建“${copy.title}”`);
    }

    function deleteFile(fileId) {
      const file = findFile(fileId);
      if (!file) return;
      fileStore()[file.type] = filesForType(file.type).filter(item => item.id !== fileId);
      if (state.currentFileId === fileId) {
        const fallback = latestFile(file.type) || allFiles()[0] || null;
        state.currentFileId = fallback?.id || null;
        state.currentDoc = fallback?.type || 'custom';
      }
      if (state.compareFileId === fileId) {
        state.view = 'focus';
        state.compareFileId = null;
      }
      state.contextFileId = null;
      render();
      showToast(`已删除“${file.title}”`);
    }

    function formatIdForBlock(block) {
      if (!block) return 'action';
      const explicit = block.dataset.formatType;
      if (explicit) return explicit;
      const match = screenplayFormats.find(format => format.className && block.classList.contains(format.className));
      return match ? match.id : 'action';
    }

    // 整个剧本正文是一个编辑根：从选区 / 事件推出当前段落
    function scriptBlockFromSelection() { const sel = window.getSelection(); const n = sel?.anchorNode; if (!n) return null; const el = n.nodeType === 3 ? n.parentElement : n; return el?.closest?.('.script-block') || null; }
    function scriptBlockFromEvent(event) { return event.target?.closest?.('.script-block') || (event.target?.closest?.('[data-script-blocks]') ? scriptBlockFromSelection() : null); }
    let caretToolbarPinned = null;   // 双击唤出的工具栏：光标未选中文字时也保持显示
    function positionCaretToolbar(block, force = false) {
      const toolbar = $('#caret-format-toolbar');
      if (!toolbar || !block) return;
      const selection = window.getSelection();
      const hasSelection = selection && selection.rangeCount && !selection.isCollapsed && selection.toString().trim();
      if (force) caretToolbarPinned = block.dataset.scriptId;
      if (!hasSelection && caretToolbarPinned !== block.dataset.scriptId) {
        hideCaretToolbar();
        return;
      }
      state.activeScriptBlockId = block.dataset.scriptId;
      state.activeScriptElement = block;
      toolbar.classList.add('visible');
      const activeFormat = formatIdForBlock(block);
      $$('[data-format-type]', toolbar).forEach(button => button.classList.toggle('active', button.dataset.formatType === activeFormat));

      let anchor = block.getBoundingClientRect();
      if (selection && selection.rangeCount) {
        const range = selection.getRangeAt(0);
        const rangeNode = range.commonAncestorContainer.nodeType === Node.TEXT_NODE ? range.commonAncestorContainer.parentElement : range.commonAncestorContainer;
        const rangeRect = range.getBoundingClientRect();
        if (rangeNode && block.contains(rangeNode) && (rangeRect.width || rangeRect.height)) anchor = rangeRect;
      }

      const toolbarRect = toolbar.getBoundingClientRect();
      const safeLeft = 12;
      const desiredLeft = anchor.left + Math.max(anchor.width, 1) / 2 - toolbarRect.width / 2;
      const left = Math.min(window.innerWidth - toolbarRect.width - safeLeft, Math.max(safeLeft, desiredLeft));
      let top = anchor.top - toolbarRect.height - 11;
      const below = top < 58;
      if (below) top = anchor.bottom + 11;
      toolbar.classList.toggle('below', below);
      toolbar.style.left = `${Math.round(left)}px`;
      toolbar.style.top = `${Math.round(top)}px`;
      const arrowX = Math.min(toolbarRect.width - 14, Math.max(14, anchor.left + Math.max(anchor.width, 1) / 2 - left));
      toolbar.style.setProperty('--caret-arrow-x', `${Math.round(arrowX)}px`);
    }

    function hideCaretToolbar() {
      const toolbar = $('#caret-format-toolbar');
      if (toolbar) toolbar.classList.remove('visible');
      caretToolbarPinned = null;
    }

    function applyScriptFormat(formatId) {
      const block = state.activeScriptElement?.isConnected ? state.activeScriptElement : $(`[data-script-id="${state.activeScriptBlockId || state.selectedScriptId}"]`);
      const format = screenplayFormats.find(item => item.id === formatId);
      if (!block || !format) return;
      // 只选中了段落中的一部分文字：把这部分拆成独立的一段并应用格式，前后文字保持原格式
      const sel = window.getSelection();
      if (sel && sel.rangeCount && !sel.isCollapsed && block.classList.contains('script-block')) {
        const r = sel.getRangeAt(0);
        if (block.contains(r.startContainer) && block.contains(r.endContainer)) {
          const rangeText = (a, b, c, d) => { const x = document.createRange(); x.setStart(a, b); x.setEnd(c, d); return x.toString(); };
          const before = rangeText(block, 0, r.startContainer, r.startOffset), mid = r.toString();
          const afterR = document.createRange(); afterR.setStart(r.endContainer, r.endOffset); afterR.setEndAfter(block.lastChild || block); const after = afterR.toString();
          if (mid.trim() && (before.trim() || after.trim())) {
            const type = block.dataset.formatType || 'action', parts = [];
            if (before.trim()) parts.push([type, before.trim()]);
            parts.push([format.id, mid.trim()]);
            if (after.trim()) parts.push([type, after.trim()]);
            const holder = document.createElement('div'); holder.innerHTML = parts.map(([t, txt]) => scriptNewBlockHtml(t, txt)).join('');
            const els = Array.from(holder.children); els[0].dataset.scriptId = block.dataset.scriptId;   // 首段沿用原 id，已关联的镜头不受影响
            block.replaceWith(...els);
            const target = els[before.trim() ? 1 : 0];
            state.selectedScriptId = target.dataset.scriptId; state.activeScriptElement = target; state.activeScriptBlockId = target.dataset.scriptId;
            $$('.script-block.selected').forEach(b => b.classList.remove('selected')); target.classList.add('selected');
            scriptChanged(target); scriptFocusBlock(target, true); try { hideCaretToolbar(); } catch (_) {}
            return;
          }
        }
      }
      const fileId = block.closest('[data-paper]')?.dataset.pageFile || 'script';
      state.formatAssignments[`${fileId}:${block.dataset.scriptId}`] = format.id;
      screenplayFormats.forEach(item => { if (item.className) block.classList.remove(item.className); });
      if (format.className) block.classList.add(format.className);
      block.dataset.formatType = format.id;
      block.dataset.placeholder = SCRIPT_PLACEHOLDER[format.id] || '';
      state.selectedScriptId = block.dataset.scriptId;
      if (block.closest('.script-paper')) scriptChanged(block);
      positionCaretToolbar(block);
      markSaving();
      showToast(`当前段落已设为 ${format.name}`);
    }

    function cycleScriptFormat(direction = 1) {
      const block = state.activeScriptElement?.isConnected ? state.activeScriptElement : null;
      if (!block) return;
      const current = formatIdForBlock(block);
      const index = Math.max(0, screenplayFormats.findIndex(format => format.id === current));
      const next = (index + direction + screenplayFormats.length) % screenplayFormats.length;
      applyScriptFormat(screenplayFormats[next].id);
    }

    function assetTypeLabel(type) {
      return ({ character: '人物', location: '场景', prop: '道具' })[type] || '资产';
    }

    function assetSymbol(type, className = 'icon') {
      if (type === 'location') return `<svg class="${className}"><path d="M4 20V8l8-5 8 5v12M8 20v-7h8v7"/><path d="M9 9h6"/></svg>`;
      if (type === 'prop') return `<svg class="${className}"><path d="M6 7h12v13H6zM9 7V4h6v3"/><path d="M9 12h6M9 16h4"/></svg>`;
      return `<svg class="${className}"><circle cx="12" cy="7" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>`;
    }

    function positionAssetSurface(surface, token, preferredWidth) {
      const rect = token.getBoundingClientRect();
      const surfaceRect = surface.getBoundingClientRect();
      const width = surfaceRect.width || preferredWidth;
      const height = surfaceRect.height || 260;
      const left = Math.max(10, Math.min(window.innerWidth - width - 10, rect.left + rect.width / 2 - width / 2));
      const belowTop = rect.bottom + 9;
      const top = belowTop + height <= window.innerHeight - 10 ? belowTop : Math.max(56, rect.top - height - 9);
      surface.style.left = `${Math.round(left)}px`;
      surface.style.top = `${Math.round(top)}px`;
    }

    function closeAssetMenu() {
      state.activeAssetInstance = null;
      $('#asset-dropdown-menu')?.classList.add('hidden');
      $$('[data-asset-token][aria-expanded="true"]').forEach(token => token.setAttribute('aria-expanded', 'false'));
      $$('[data-asset-token]').forEach(token=>{token.setAttribute('aria-haspopup','dialog');token.setAttribute('aria-controls','asset-hover-card');});
    }

    function openAssetMenu(token) {
      const asset = assetById(token.dataset.assetId);
      if (!asset) return;
      hideAssetCard();
      const menu = $('#asset-dropdown-menu');
      state.activeAssetInstance = token.dataset.assetInstance;
      $$('[data-asset-token]').forEach(item => item.setAttribute('aria-expanded', String(item === token)));
      token.setAttribute('aria-haspopup','listbox');token.setAttribute('aria-controls','asset-dropdown-menu');
      menu.innerHTML = `<div class="asset-menu-head"><strong>切换${assetTypeLabel(asset.type)}</strong><span>同类资产</span></div>
        ${assetCatalog[asset.type].map(option => `<button class="asset-menu-option ${option.id === asset.id ? 'active' : ''}" data-asset-option="${option.id}" data-asset-instance="${token.dataset.assetInstance}" role="option" aria-selected="${option.id === asset.id}">
          <span class="asset-menu-icon ${asset.type}">${assetSymbol(asset.type)}</span>
          <span class="asset-menu-copy"><strong>${escapeHtml(option.name)}</strong><span>${escapeHtml(option.meta)}</span></span>
          ${option.id === asset.id ? icons.check : ''}
        </button>`).join('')}`;
      menu.classList.remove('hidden');
      positionAssetSurface(menu, token, 246);
    }

    function switchAsset(instance, assetId) {
      const token = $(`[data-asset-instance="${instance}"]`);
      const previous = assetById(token?.dataset.assetId);
      const next = assetById(assetId);
      if (!token || !previous || !next || previous.type !== next.type) return;
      state.assetOverrides[instance] = next.id;
      token.dataset.assetId = next.id;
      token.dataset.assetType = next.type;
      token.className = `asset-token ${next.type}`;
      token.textContent = next.name;
      capturePaperEdits(token.closest('[data-paper]'), true);
      closeAssetMenu();
      markSaving();
      showAssetCard(token);
      showToast(`已将${assetTypeLabel(next.type)}切换为“${next.name}”`);
    }

    let assetPreviewAnchor=null;
    function showAssetCard(token) {
      const asset = assetById(token.dataset.assetId);
      const card = $('#asset-hover-card');
      if (!asset || !card) return;
      closeAssetMenu();assetPreviewAnchor=token;
      card.dataset.assetId=asset.id;
      card.setAttribute('aria-label',`${asset.name} · 资产缩略卡片`);
      card.innerHTML = `<button class="asset-card-close" data-close-asset-card aria-label="关闭资产卡片"><svg viewBox="0 0 24 24" class="icon sm"><path d="m6 6 12 12M18 6 6 18"/></svg></button>${assetCardHtml(asset,{preview:true})}`;
      card.classList.add('visible');card.setAttribute('aria-hidden','false');
      token.setAttribute('aria-expanded','true');token.setAttribute('aria-haspopup','dialog');token.setAttribute('aria-controls','asset-hover-card');
      positionAssetSurface(card,token,318);
      requestAnimationFrame(() => positionAssetSurface(card, token, 318));
    }

    function hideAssetCard(restoreFocus=false) {
      const token=assetPreviewAnchor,card=$('#asset-hover-card');
      card?.classList.remove('visible');card?.setAttribute('aria-hidden','true');
      token?.setAttribute('aria-expanded','false');assetPreviewAnchor=null;
      if(restoreFocus&&token?.isConnected)token.focus();
    }
    function refreshAssetSurfaces(){
      $$('[data-asset-view]').forEach(surface=>{
        const asset=assetById(surface.dataset.assetId);
        if(!asset){if(surface.dataset.assetView==='preview')hideAssetCard();else surface.remove();return;}
        const cover=$('[data-asset-cover]',surface),src=assetCoverSource(asset),img=$('img',cover);
        if(src){if(img?.getAttribute('src')!==src)cover.innerHTML=assetThumbnailHtml(asset);else img.alt=asset.name;}
        else if(img||!$('.asset-cover-empty',cover))cover.innerHTML=assetThumbnailHtml(asset);
        const values={name:asset.name,meta:asset.meta||'待补充属性',description:asset.description||'定义资产外观、材质与使用规则。',variants:`${asset.variants?.length||1} 个变体`,kind:assetTypeLabel(asset.type),status:asset.status||'进行中'};
        for(const [key,value] of Object.entries(values)){const element=$(`[data-asset-${key}]`,surface);if(element&&element.textContent!==value)element.textContent=value;}
      });
      const card=$('#asset-hover-card');
      if(card?.classList.contains('visible')){
        if(!assetPreviewAnchor?.isConnected)return hideAssetCard();
        const asset=assetById(card.dataset.assetId);if(!asset)return hideAssetCard();
        card.setAttribute('aria-label',`${asset.name} · 资产缩略卡片`);
        positionAssetSurface(card,assetPreviewAnchor,318);
      }
    }
    document.addEventListener('moodio:assets-updated',refreshAssetSurfaces);
    document.addEventListener('click',event=>{
      const button=event.target.closest('[data-asset-preview-action]');if(!button)return;
      event.preventDefault();event.stopImmediatePropagation();
      const id=$('#asset-hover-card').dataset.assetId,anchor=assetPreviewAnchor;
      if(button.dataset.assetPreviewAction==='switch'){if(anchor?.isConnected)openAssetMenu(anchor);return;}
      hideAssetCard();openAssetDetail(id,anchor);
    },true);

    function recognizeAssetsWithConfirm(control) {
      const fileId=control?.dataset.sourceFileId||control?.closest('[data-page-file]')?.dataset.pageFile;
      if(!hasRecognizedScriptAssets(fileId))return requestAgentRecognition('assets',fileId);
      if(findFile(fileId)?.type!=='script')return;
      captureVisibleEdits();
      const previous=state.assetRecognition[fileId],enabled=!assetHighlightsEnabled(fileId);
      state.assetRecognition={...state.assetRecognition,[fileId]:{...previous,highlightsEnabled:enabled}};
      if(!persistWorkspace()){state.assetRecognition={...state.assetRecognition,[fileId]:previous};return;}
      closeAssetMenu();hideAssetCard();
      // 只刷新该剧本的资产标注，保留稿纸、滚动位置、按钮焦点与当前正文。
      $$('.script-paper [data-script-id]').filter(block=>block.closest('[data-page-file]')?.dataset.pageFile===fileId).forEach(block=>{
        const text=block.innerText.replace(/\r\n/g,'\n').replace(/\n+$/,'');
        block.innerHTML=renderAssetText(text,`${fileId}:${block.dataset.scriptId}`)||'<br>';
      });
      $$('[data-recognize-assets]').filter(button=>button.dataset.sourceFileId===fileId).forEach(button=>{
        button.classList.toggle('active',enabled);button.setAttribute('aria-checked',String(enabled));
      });
    }

    function clearStackDragState() {
      state.draggedFile = null;
      state.dragSource = null;
      $('#canvas-viewport').classList.remove('stack-drag-active');
      $('.paper-stack').classList.remove('page-return-active');
      $$('.stack-card.dragging, .stack-file-row.dragging, .paper.page-dragging').forEach(element => element.classList.remove('dragging', 'page-dragging'));
      $$('.drop-page-zone').forEach(zone => zone.classList.remove('active'));
      $$('.page-slot.page-swap-target').forEach(slot => slot.classList.remove('page-swap-target'));
    }

    function placeFileInWorkspace(fileId, side = 'right') {
      const file = findFile(fileId);
      if (!file) return;
      if (side === 'center') {
        state.currentDoc = file.type;
        state.currentFileId = file.id;
        state.compareDoc = null;
        state.compareFileId = null;
        state.view = 'focus';
        state.selectedPageSlot = 'left';
        state.expandedStack = file.type;
        clearStackDragState();
        render();
        $('#canvas-viewport').scrollTop = 0;
        showToast(`已在专注视图打开“${file.title}”`);
        return;
      }
      if (state.view === 'focus') {
        if (side === 'left') {
          state.compareDoc = state.currentDoc;
          state.compareFileId = state.currentFileId;
          state.currentDoc = file.type;
          state.currentFileId = file.id;
        } else {
          state.compareDoc = file.type;
          state.compareFileId = file.id;
        }
      } else if (side === 'left') {
        state.currentDoc = file.type;
        state.currentFileId = file.id;
      } else {
        state.compareDoc = file.type;
        state.compareFileId = file.id;
      }
      state.view = 'compare';
      state.selectedPageSlot = side;
      state.expandedStack = file.type;
      clearStackDragState();
      render();
      const arrived = side === 'left' ? $('#compare-script') : $('#compare-secondary');
      arrived.classList.add('drop-arrived');
      setTimeout(() => arrived.classList.remove('drop-arrived'), 420);
      $('#canvas-viewport').scrollTop = 0;
      showToast(`已将“${file.title}”放到${side === 'left' ? '左页' : '右页'}对照`);
    }

    function returnPageToStack(slot) {
      if (state.view !== 'compare') return clearStackDragState();
      const returned = activeFile(slot);
      if (slot === 'left') {
        state.currentDoc = state.compareDoc;
        state.currentFileId = state.compareFileId;
      }
      state.compareDoc = null;
      state.compareFileId = null;
      state.view = 'focus';
      state.selectedPageSlot = 'left';
      state.expandedStack = returned?.type || state.expandedStack;
      clearStackDragState();
      render();
      showToast(returned ? `“${returned.title}”已收回${docDef(returned.type).name}纸堆` : '稿纸已收回');
    }

    function createShotFromSelection() {
      if (!state.storyboardEnabled) {
        showToast('请先开启“识别分镜”');
        return;
      }
      const sourceId = state.selectedScriptId || 's3';
      const { shot, file: storyboardFile } = createStoryboardFile({
        sourceId,
        sourceLabel: '场 1 · 已选段落',
        description: '从已选剧本段落创建的新分镜。补充你的自然语言镜头设计。'
      });
      const scriptType = 'script';
      const selectedPaperFile = state.activeScriptElement?.closest('[data-paper]')?.dataset.pageFile;
      const scriptFile = findFile(selectedPaperFile) || (state.currentDoc === scriptType ? activeFile('left') : latestFile(scriptType));
      state.currentDoc = scriptType;
      state.currentFileId = scriptFile?.id || state.currentFileId;
      state.compareDoc = 'storyboard';
      state.compareFileId = storyboardFile.id;
      state.view = 'compare';
      state.selectedPageSlot = 'right';
      state.expandedStack = 'storyboard';
      state.locatedScriptId = state.selectedScriptId;
      render();
      showToast(`分镜 ${String(shot.id).padStart(2, '0')} 已创建为独立稿纸，并关联到剧本段落`);
    }

    function locateSource(sourceId, storyboardFileId) {
      if (!sourceId) {
        showToast('这份分镜尚未关联剧本段落');
        return;
      }
      const scriptType = 'script';
      const scriptFile = latestFile(scriptType);
      const storyboardFile = findFile(storyboardFileId) || filesForType('storyboard').find(file => file.sourceId === sourceId) || latestFile('storyboard');
      state.currentDoc = scriptType;
      state.currentFileId = scriptFile?.id || state.currentFileId;
      state.compareDoc = 'storyboard';
      state.compareFileId = storyboardFile?.id || state.compareFileId;
      state.view = 'compare';
      state.selectedPageSlot = 'left';
      state.expandedStack = 'storyboard';
      state.locatedScriptId = sourceId;
      render();
      setTimeout(() => {
        const target = $(`#compare-script [data-script-id="${sourceId}"]`);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 60);
      showToast('已在左页定位关联剧本段落');
    }

    function insertShot(index) {
      const newId = Math.max(...state.shots.map(shot => shot.id)) + 1;
      state.shots.splice(index, 0, {
        id: newId,
        sourceId: 's3',
        sourceLabel: '尚未指定剧本段落',
        description: '新分镜：写下这个镜头要让观众看见与感受到什么。',
        tags: { '景别': [], '镜头运动': [], '摄影机角度': [], '透视关系': [], '景深强度': [], '光影效果': [] },
        media: null
      });
      state.shotTab[newId] = 'description';
      render();
      showToast('已插入一个新分镜');
    }

    function toggleTag(shotId, category, value) {
      const shot = state.shots.find(item => item.id === shotId);
      if (!shot) return;
      const list = shot.tags[category] || (shot.tags[category] = []);
      const index = list.indexOf(value);
      if (index >= 0) list.splice(index, 1); else list.push(value);
      state.openTagMenu = `${shotId}-${category}`;
      render();
      showToast('镜头语言已同步到文字描述');
    }

    function addCustomTag(shotId) {
      const input = $(`[data-custom-tag-input="${shotId}"]`);
      const value = input && input.value.trim();
      if (!value) return;
      const shot = state.shots.find(item => item.id === shotId);
      if (!shot.tags['自定义']) shot.tags['自定义'] = [];
      shot.tags['自定义'].push(value);
      state.openTagMenu = null;
      render();
      showToast('自定义镜头语言已添加');
    }

    function mergeSelectedShots() {
      if (state.selectedShots.size < 2) return;
      const chosen = state.shots.filter(shot => state.selectedShots.has(shot.id));
      const firstIndex = state.shots.findIndex(shot => state.selectedShots.has(shot.id));
      const newId = Math.min(...chosen.map(shot => shot.id));
      const merged = {
        id: newId,
        sourceId: chosen[0].sourceId,
        sourceLabel: `合并自 ${chosen.length} 个剧本段落`,
        description: chosen.map(shot => shot.description).join(' '),
        tags: {},
        media: chosen.find(shot => shot.media)?.media || null
      };
      Object.keys(cameraOptions).forEach(category => {
        merged.tags[category] = Array.from(new Set(chosen.flatMap(shot => shot.tags[category] || [])));
      });
      state.shots = state.shots.filter(shot => !state.selectedShots.has(shot.id));
      state.shots.splice(firstIndex, 0, merged);
      state.selectedShots.clear();
      state.shotTab[newId] = 'description';
      render();
      showToast('所选分镜已合并，镜头语言与描述已保留');
    }

    function switchScriptWorkspace(mode) {
      state.workspaceMode = mode;
      state.canvasAgentOpen = false;
      state.selectedIdea = null;
      state.ideaTagMenu = null;
      state.ideaContextMenu = null;
      state.ideaConnectFrom = null;
      state.storyConnectFrom = null;
      state.selectedStoryEdge = null;
      state.storyEdgeMenu = null;
      state.view = 'focus';
      render();
      $('#canvas-viewport').scrollTop = 0;
      if (mode !== 'document') showToast(mode === 'beatboard' ? '已进入故事结构板' : '已进入灵感画布');
    }

    function createStoryFlowEdge(fromId,toId,fromPort = 'auto',toPort = 'auto',options = {}) {
      if (!fromId || !toId || fromId === toId) return null;
      const duplicate = state.storyEdges.some(edge => edge.from === fromId && edge.to === toId && (edge.fromPort || 'auto') === fromPort && (edge.toPort || 'auto') === toPort);
      if (duplicate) return null;
      const edge = { id:uid('story-edge'),from:fromId,to:toId,fromPort,toPort,kind:options.kind || 'flow',dashed:options.dashed ?? false,arrow:options.arrow ?? true,bend:0 };
      state.storyEdges.push(edge);
      return edge;
    }

    function createStorySubCardFromWire(parentId,dropX,dropY,fromPort = 'auto') {
      const parent = state.storyBeats.find(card => card.id === parentId);
      if (!parent) return { card:null,edge:null };
      let x = Math.max(20,Math.min(2490,dropX - 95)),y = Math.max(90,Math.min(1120,dropY - 56));
      if (state.storyGridSnap) { x = Math.round(x / 20) * 20;y = Math.round(y / 20) * 20; }
      const card = { id:uid('sub'),kind:'sub',parentId,order:null,x,y,w:190,h:112,act:parent.act,type:'SUB CARD',title:'新的发散卡片',summary:'在这里继续发展情节、人物动机或世界观线索。',scenes:'待关联',plot:'支线',characters:parent.characters,shift:'—',color:parent.color,source:'由连接点拖拽创建' };
      state.storyBeats.push(card);
      const edge = createStoryFlowEdge(parentId,card.id,fromPort,'auto',{ kind:'branch',dashed:true });
      return { card,edge };
    }

    function connectStoryCard(cardId,port = 'auto') {
      const card = state.storyBeats.find(item => item.id === cardId);
      if (!card) return;
      state.storyTool = 'connect';
      state.selectedStoryEdge = null;
      state.storyEdgeMenu = null;
      if (!state.storyConnectFrom) {
        state.storyConnectFrom = { cardId,port };
        state.selectedStoryCard = cardId;
        render();
        return;
      }
      if (state.storyConnectFrom.cardId === cardId) {
        state.storyConnectFrom.port = port;
        render();
        return;
      }
      const source = state.storyConnectFrom;
      const edge = createStoryFlowEdge(source.cardId,cardId,source.port,port);
      if (edge) {
        state.selectedStoryEdge = edge.id;
        showToast('已连接；源卡片保持锁定，可继续选择其他目标');
      } else showToast('这两个端口已经连接');
      state.selectedStoryCard = cardId;
      render();
    }

