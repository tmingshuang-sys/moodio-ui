    (function rememberCompareLayout(){
      const slotEl = side => side === 'left' ? $('#compare-script') : $('#compare-secondary');
      const scrollOf = side => slotEl(side)?.firstElementChild?.scrollTop || 0;
      function snapshot(){
        if (state.view !== 'compare' || !state.compareDoc) return;
        state.compareMemo = {
          leftDoc: state.currentDoc, leftId: state.currentFileId,
          rightDoc: state.compareDoc, rightId: state.compareFileId,
          slot: state.selectedPageSlot,
          scroll: { left: scrollOf('left'), right: scrollOf('right') }
        };
      }
      // 每次在对照视图下渲染都记一笔；两页各自滚动时同步记录滚动位置
      const renderBeforeMemo = render;
      render = () => { renderBeforeMemo(); snapshot(); };
      $('#canvas-viewport').addEventListener('scroll', event => {
        if (state.view !== 'compare' || !state.compareMemo) return;
        const slot = event.target.closest?.('.compare-layout .page-slot');
        if (slot) state.compareMemo.scroll[slot.dataset.pageSlot] = event.target.scrollTop;
      }, true);

      const setViewBeforeMemo = setView;
      setView = view => {
        const memo = state.compareMemo;
        if (view !== 'compare' || state.view === 'compare' || !memo) return setViewBeforeMemo(view);
        const leftFile = findFile(memo.leftId), rightFile = findFile(memo.rightId);
        if (!leftFile || !rightFile || leftFile.id === rightFile.id) return setViewBeforeMemo(view);
        captureVisibleEdits();
        // 当前专注页若不在上次的两页里：它留在左页，右页补回上次的另一页
        const current = state.currentFileId;
        if (current !== leftFile.id && current !== rightFile.id) {
          const other = rightFile.id !== current ? rightFile : leftFile;
          state.compareDoc = other.type; state.compareFileId = other.id;
          state.selectedPageSlot = 'left';
        } else {
          state.currentDoc = leftFile.type; state.currentFileId = leftFile.id;
          state.compareDoc = rightFile.type; state.compareFileId = rightFile.id;
          state.selectedPageSlot = memo.slot || 'left';
        }
        state.view = 'compare';
        state.expandedStack = activeFile(state.selectedPageSlot)?.type || state.expandedStack;
        const scroll = memo.scroll || {};
        render();
        $('#canvas-viewport').scrollTop = 0;
        ['left', 'right'].forEach(side => { const page = slotEl(side)?.firstElementChild; if (page && scroll[side]) page.scrollTop = scroll[side]; });
      };
    })();


    /* 封面占位符：内容清空后去掉残留的 <br>，让 :empty 占位符重新显示 */
    document.addEventListener('input', event => {
      const el = event.target.closest?.('[data-placeholder][contenteditable="true"]');
      if (el && !el.textContent.trim() && el.innerHTML !== '') el.innerHTML = '';
    });

    /* ===== 稿纸顶部「剧本 / 封面」tab：在同一槽位内切换两份文档 ===== */
    document.addEventListener('click', event => {
      const tab = event.target.closest('[data-paper-doc]');
      if (!tab) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const page = tab.closest('[data-paper]'), slot = page?.dataset.pageSlot || 'left', type = tab.dataset.paperDoc;
      if (tab.classList.contains('active')) return;
      const file = latestFile(type);
      if (!file) return showToast(type === 'cover' ? '还没有封面稿纸' : '还没有剧本稿纸');
      captureVisibleEdits?.();
      if (slot === 'right') { state.compareDoc = file.type; state.compareFileId = file.id; }
      else { state.currentDoc = file.type; state.currentFileId = file.id; }
      state.selectedPageSlot = slot;
      state.expandedStack = file.type;
      render();
      const target = state.view === 'compare' ? (slot === 'right' ? $('#compare-secondary') : $('#compare-script'))?.firstElementChild : $('#canvas-viewport');
      if (target) target.scrollTop = 0;
    }, true);


    /* ===== 「剧本与创作文档」→ 右侧二级菜单（My Writing 文件夹） ===== */
    function fanAnchorButton(){ return $('.writing-sidebar [data-script-workspace="document"]'); }
    function fanAnchorTop(){ return fanAnchorButton()?.getBoundingClientRect().top ?? 60; }
    function clampFanPosition(left, top){
      const fan = $('#writing-fan'), w = fan?.offsetWidth || 272, h = fan?.offsetHeight || 400;
      return { left: Math.max(6, Math.min(left, innerWidth - w - 6)), top: Math.max(6, Math.min(top, innerHeight - h - 6)) };
    }
    positionWritingFan = () => {
      const fan = $('#writing-fan'), sidebar = $('.writing-sidebar')?.getBoundingClientRect(), anchor = fanAnchorButton()?.getBoundingClientRect();
      if (!fan || !sidebar || !anchor) return;
      fan.classList.add('as-submenu');
      const wanted = state.fanPosition || { left: sidebar.right + 6, top: anchor.top - 6 };
      const pos = clampFanPosition(wanted.left, wanted.top);
      fan.style.left = pos.left + 'px'; fan.style.top = pos.top + 'px'; fan.style.bottom = 'auto';
      fan.classList.toggle('is-detached', !!state.fanPosition);
    };
    // 拖动标题栏移动浮窗；双击标题栏回到按钮旁的默认位置
    $('#writing-fan').addEventListener('pointerdown', event => {
      const head = event.target.closest('#writing-fan > header');
      if (!head || event.button || event.target.closest('button, select, input')) return;
      const fan = $('#writing-fan'), start = fan.getBoundingClientRect(), sx = event.clientX, sy = event.clientY;
      event.preventDefault();
      try { head.setPointerCapture(event.pointerId); } catch (_) {}
      fan.classList.add('is-dragging');
      const move = e => { const pos = clampFanPosition(start.left + e.clientX - sx, start.top + e.clientY - sy); fan.style.left = pos.left + 'px'; fan.style.top = pos.top + 'px'; };
      const stop = e => {
        head.removeEventListener('pointermove', move); head.removeEventListener('pointerup', stop); head.removeEventListener('pointercancel', stop);
        fan.classList.remove('is-dragging');
        if (Math.abs(e.clientX - sx) + Math.abs(e.clientY - sy) < 3) return;
        state.fanPosition = { left: parseFloat(fan.style.left), top: parseFloat(fan.style.top) };
        fan.classList.add('is-detached'); persistWorkspace();
      };
      head.addEventListener('pointermove', move); head.addEventListener('pointerup', stop); head.addEventListener('pointercancel', stop);
    });
    $('#writing-fan').addEventListener('dblclick', event => {
      if (!event.target.closest('#writing-fan > header') || event.target.closest('button, select')) return;
      state.fanPosition = null; persistWorkspace(); positionWritingFan();
    });
    window.addEventListener('resize', () => { if (state.writingOpen) positionWritingFan(); });
    const stackBeforeSubmenu = renderStack;
    renderStack = () => {
      stackBeforeSubmenu();
      const open = $('#writing-fan')?.classList.contains('is-open');
      fanAnchorButton()?.classList.toggle('submenu-open', !!open);
      fanAnchorButton()?.setAttribute('aria-expanded', String(!!open));
    };
    // 「点击菜单外部关闭」的监听排在前面，会先把菜单收起；记下时间戳，避免本次点击又把它打开
    let fanClosedAt = -1;
    const closeBeforeSubmenu = closeWritingFan;
    closeWritingFan = () => { fanClosedAt = performance.now(); closeBeforeSubmenu(); };
    document.addEventListener('click', event => {
      const button = event.target.closest('.writing-sidebar [data-script-workspace="document"]');
      if (!button) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const alreadyDocument = state.workspaceMode === 'document';
      const wasOpen = state.writingOpen || performance.now() - fanClosedAt < 80;
      if (alreadyDocument && wasOpen) { if (state.writingOpen) closeWritingFan(); return; }
      if (!alreadyDocument) switchScriptWorkspace('document');
      fanFolder = null; fanPage = 0;
      state.writingOpen = true;
      renderStack(); persistWorkspace();
    }, true);


    /* ===== 侧栏一级层级：My Writing 文件夹树（替代原「剧本与创作文档」入口） ===== */
    // 首次渲染早于本段代码执行，所以用惰性初始化的函数而不是 const（避免 TDZ）
    function openFolders(){ return openFolders.set || (openFolders.set = new Set()); }
    function renderWritingFolders(){
      const chevron = `<svg class="icon sm writing-folder-chevron" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></svg>`;
      const activeIds = new Set([state.currentFileId, state.view === 'compare' ? state.compareFileId : null].filter(Boolean));
      // 封面并入剧本：不单列；拍摄日报不在侧栏展示
      const hiddenFolders = new Set(['cover', 'dailyReport', 'dailySchedule', 'locationBreakdown', 'scriptOrder', 'custom']);   // 封面并入剧本；制作表类（拍摄日报、通告单、分景表、顺场表）不展示；空白页面单独逐份列出
      const coverShown = filesForType('cover').some(f => activeIds.has(f.id));
      const order = state.folderOrder || [], rank = id => { const i = order.indexOf(id); return i < 0 ? order.length : i; };
      const groups = docList().filter(d => !hiddenFolders.has(d.id) && filesForType(d.id).length).map((d, i) => ({ d, i })).sort((a, b) => rank(a.d.id) - rank(b.d.id) || a.i - b.i).map(x => x.d);
      // 每个类别只露出最新一份作为「当前版本」；更早的都是历史版本，展开后可查看
      return groups.map(d => {
        const files = filesForType(d.id), current = files[files.length - 1], history = files.slice(0, -1).reverse();
        const activeFile = files.find(f => activeIds.has(f.id)) || null, viewingHistory = !!activeFile && activeFile !== current;
        const hasActive = !!activeFile || (d.id === 'script' && coverShown), open = openFolders().has(d.id);
        const versionRow = (f, index, isCurrent) => `<button class="writing-version-row ${activeIds.has(f.id) ? 'active' : ''}" data-writing-file="${f.id}" data-file-id="${f.id}" data-drag-file="${f.id}" draggable="true"><span class="writing-version-no">v${index}</span><span class="writing-version-title">${escapeHtml(displayFileTitle(f))}</span><small>${isCurrent ? '当前' : escapeHtml(f.updated || '')}</small></button>`;
        const panel = open ? `<div class="writing-folder-files writing-doc-history">${versionRow(current, files.length, true)}${history.map((f, i) => versionRow(f, files.length - 1 - i, false)).join('')}<button class="writing-file-new" data-writing-new="${d.id}">${icons.plus}<span>新建版本</span></button></div>` : '';
        return `<div class="writing-folder ${open ? 'open' : ''} ${hasActive ? 'has-active' : ''}"><button class="writing-folder-row writing-doc-row ${hasActive ? 'active' : ''}" data-writing-file="${current.id}" data-drag-folder="${d.id}" draggable="true"><span class="writing-doc-icon">${icons[d.icon] || icons.custom}</span><span class="writing-folder-name">${escapeHtml(d.name)}</span>${viewingHistory ? '<span class="writing-doc-tag">查看历史</span>' : ''}<span class="writing-doc-versions" data-writing-folder="${d.id}" role="button" aria-expanded="${open}" aria-label="${escapeHtml(d.name)} 的版本历史"><small>${files.length > 1 ? files.length + ' 个版本' : '1 个版本'}</small>${chevron}</span></button>${panel}</div>`;
      }).join('')
      // 空白页面：每一页是一条独立的版本链（lineageId 相同的文件互为版本），最新一份为当前版本
      + blankPageLineages().map(({ key, files }) => {
        const current = files[files.length - 1], history = files.slice(0, -1).reverse(), folderKey = 'custom:' + key;
        const activeFile = files.find(f => activeIds.has(f.id)) || null, viewingHistory = !!activeFile && activeFile !== current, open = openFolders().has(folderKey);
        const versionRow = (f, index, isCurrent) => `<button class="writing-version-row ${activeIds.has(f.id) ? 'active' : ''}" data-writing-file="${f.id}" data-file-id="${f.id}" data-drag-file="${f.id}" draggable="true"><span class="writing-version-no">v${index}</span><span class="writing-version-title">${escapeHtml(displayFileTitle(f))}</span><small>${isCurrent ? '当前' : escapeHtml(f.updated || '')}</small></button>`;
        const panel = open ? `<div class="writing-folder-files writing-doc-history">${versionRow(current, files.length, true)}${history.map((f, i) => versionRow(f, files.length - 1 - i, false)).join('')}<button class="writing-file-new" data-writing-new="${folderKey}">${icons.plus}<span>新建版本</span></button></div>` : '';
        return `<div class="writing-folder ${open ? 'open' : ''} ${activeFile ? 'has-active' : ''}"><button class="writing-folder-row writing-doc-row blank-page ${activeFile ? 'active' : ''}" data-writing-file="${current.id}" data-file-id="${current.id}" data-drag-file="${current.id}" draggable="true"><span class="writing-doc-icon">${blankKindIcon(current.kind)}</span><span class="writing-folder-name">${escapeHtml(displayFileTitle(current))}</span>${viewingHistory ? '<span class="writing-doc-tag">查看历史</span>' : ''}<span class="writing-doc-versions" data-writing-folder="${folderKey}" role="button" aria-expanded="${open}" aria-label="${escapeHtml(displayFileTitle(current))} 的版本历史"><small>${files.length} 个版本</small>${chevron}</span></button>${panel}</div>`;
      }).join('')
      ;
    }
    // Only explicit sidebar navigation animates; autosave and ordinary renders stay still.
    const writingWorkspaceMotionPreference = matchMedia('(prefers-reduced-motion: reduce)');
    function stopWritingWorkspaceTransition(){
      const motion = selectWritingFile.motion;
      selectWritingFile.motion = null;
      motion?.cancel();
    }
    function selectWritingFile(id){
      const previousId = state.currentFileId;
      const wasDocument = state.workspaceMode === 'document' && state.projectPage === 'scripts';
      stopWritingWorkspaceTransition();
      selectFile(id);
      if (state.currentFileId !== id || (wasDocument && previousId === id)) return;
      const pane = state.view === 'compare' ? $('#compare-script') : $('#focus-layout');
      if (!pane || !pane.animate || writingWorkspaceMotionPreference.matches) return;
      try {
        const motion = pane.animate([
          { opacity: .65, transform: 'translateY(6px)' },
          { opacity: 1, transform: 'none' }
        ], { duration: 240, easing: 'cubic-bezier(.22, 1, .36, 1)', fill: 'none' });
        selectWritingFile.motion = motion;
        const clear = () => { if (selectWritingFile.motion === motion) selectWritingFile.motion = null; };
        motion.finished.then(clear, clear);
      } catch (_) { stopWritingWorkspaceTransition(); }
    }
    // Let editing, dragging and scrolling take over immediately, without transformed hit areas.
    ['pointerdown', 'keydown', 'dragstart', 'wheel'].forEach(type =>
      $('#canvas-viewport').addEventListener(type, stopWritingWorkspaceTransition, { capture: true, passive: true }));
    window.addEventListener('resize', stopWritingWorkspaceTransition);
    writingWorkspaceMotionPreference.addEventListener?.('change', stopWritingWorkspaceTransition);

    document.addEventListener('click', event => {
      const folder = event.target.closest('[data-writing-folder]'), file = event.target.closest('[data-writing-file]'), create = event.target.closest('[data-writing-new]'), blank = event.target.closest('[data-writing-blank]');
      if (!folder && !file && !create && !blank) return;
      // 对照模式下，从侧栏打开 / 新建的文档默认落在左页
      if (!folder && state.view === 'compare') state.selectedPageSlot = 'left';
      if (blank) { event.preventDefault(); event.stopImmediatePropagation(); return createBlankPage(); }
      event.preventDefault(); event.stopImmediatePropagation();
      if (folder) { const id = folder.dataset.writingFolder; openFolders().has(id) ? openFolders().delete(id) : openFolders().add(id); renderWritingPanel(); return; }
      if (file) return selectWritingFile(file.dataset.writingFile);
      openFolders().add(create.dataset.writingNew); createVersionFromCurrent(create.dataset.writingNew);
    }, true);
    // 「新建版本」= 复制当前版本（正文编辑、制作表数据、分镜镜头一并带上），成为新的当前版本并打开
    function blankPageLineages(){
      const groups = new Map();
      filesForType('custom').forEach(f => { const key = f.lineageId || f.id; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(f); });
      return Array.from(groups, ([key, files]) => ({ key, files }));
    }
    function createBlankPage(){
      captureVisibleEdits?.();
      const n = blankPageLineages().length + 1;
      const file = addFile('custom', { title: n > 1 ? `空白页面 ${String(n).padStart(2, '0')}` : '空白页面', preview: '自由空白稿纸' });
      file.lineageId = file.id;
      state.workspaceMode = 'document'; state.view = 'focus'; state.selectedPageSlot = 'left';
      state.currentDoc = 'custom'; state.currentFileId = file.id; state.expandedStack = 'custom';
      render(); persistWorkspace(); $('#canvas-viewport').scrollTop = 0;
      showToast(`已新建「${file.title}」`);
    }
    function nextVersionTitle(title, n){ return `${String(title).replace(/\s*(副本|v\d+)$/i, '').trim()} v${n}`; }
    function createVersionFromCurrent(type){
      const lineage = type.startsWith('custom:') ? type.slice(7) : null;
      if (lineage) type = 'custom';
      const chain = lineage ? (blankPageLineages().find(g => g.key === lineage)?.files || []) : filesForType(type);
      const source = chain[chain.length - 1];
      if (!source) return createFolderManuscript(type);
      const before = filesForType(type).length;
      duplicateFile(source.id);
      const copy = latestFile(type);
      if (!copy || copy === source || filesForType(type).length === before) return;
      if (lineage) copy.lineageId = lineage;
      copy.title = nextVersionTitle(source.title, (lineage ? chain.length : before) + 1);
      copy.updated = '刚刚';
      selectFile(copy.id);
      persistWorkspace();
      showToast(`已基于「${source.title}」新建 ${copy.title}，可以继续编辑`);
    }


    /* ===== 侧栏文件夹：拖拽调整顺序 ===== */
    (function folderReorder(){
      let dragging = null;
      const clear = () => { dragging = null; $$('.writing-folder.drag-before, .writing-folder.drag-after, .writing-folder.dragging').forEach(el => el.classList.remove('drag-before', 'drag-after', 'dragging')); };
      document.addEventListener('dragstart', event => {
        const row = event.target.closest('[data-drag-folder]');
        if (!row) return;
        event.stopImmediatePropagation();
        dragging = row.dataset.dragFolder;
        row.closest('.writing-folder')?.classList.add('dragging');
        // 同一次拖拽既能在列表内排序，也能拖进右侧工作区：拖到画布上时按「当前版本」这份文件落到左页 / 专注 / 右页
        const file = findFile(row.dataset.writingFile);
        if (file) { state.dragSource = 'stack'; state.draggedFile = { fileId: file.id, type: file.type }; }
        event.dataTransfer.effectAllowed = file ? 'copyMove' : 'move';
        event.dataTransfer.setData('text/plain', file ? file.id : 'folder:' + dragging);
      }, true);
      document.addEventListener('dragover', event => {
        if (!dragging) return;
        const folder = event.target.closest('.writing-folder');
        if (!folder || !folder.closest('.writing-folders')) return;
        event.preventDefault(); event.stopImmediatePropagation();
        event.dataTransfer.dropEffect = 'move';
        const rect = folder.getBoundingClientRect(), before = event.clientY < rect.top + rect.height / 2;
        $$('.writing-folder.drag-before, .writing-folder.drag-after').forEach(el => { if (el !== folder) el.classList.remove('drag-before', 'drag-after'); });
        folder.classList.toggle('drag-before', before); folder.classList.toggle('drag-after', !before);
      }, true);
      document.addEventListener('drop', event => {
        if (!dragging) return;
        const folder = event.target.closest('.writing-folders .writing-folder');
        if (!folder) return clear();
        event.preventDefault(); event.stopImmediatePropagation();
        const targetId = folder.querySelector('[data-drag-folder]')?.dataset.dragFolder, before = folder.classList.contains('drag-before');
        const current = Array.from(document.querySelectorAll('.writing-folders [data-drag-folder]')).map(el => el.dataset.dragFolder);
        const from = dragging; clear();
        if (!targetId || targetId === from) return;
        const next = current.filter(id => id !== from);
        next.splice(next.indexOf(targetId) + (before ? 0 : 1), 0, from);
        state.folderOrder = next; persistWorkspace(); renderWritingPanel();
      }, true);
      document.addEventListener('dragend', () => { if (dragging) clear(); }, true);
    })();


    /* ===== 剧集：每一集拥有独立的剧本 / 分镜 / 大纲等文稿、镜头与生成单元画布 ===== */
    let episodesApi = null;   // 供 Agent 工具调用：switchEpisode / createEpisode / renameEpisode
    (function episodes(){
      // 属于单集的状态字段；切换剧集时整体换入换出
      const EPISODE_KEYS = ['fileStores','shots','chunks','recentShotId','currentDoc','currentFileId','compareDoc','compareFileId','compareMemo','activeStoryboardId','selectedChunk',
        'productionRows','callSheetMeta','castCalls','dailyReportMeta','dailyReportCastActuals','formatAssignments','assetOverrides','assetsRecognized','assetRecognition',
        'characterAssignments','selectedScriptId','locatedScriptId','activeScene','shotTab','storyBeats','storyEdges','ideaNodes','ideaEdges','ideaLayoutGroups'];
      const clone = value => JSON.parse(JSON.stringify(value));
      const nextEpisodeId = () => 'ep-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

      state.episodes = Array.isArray(restoredWorkspace?.episodes) && restoredWorkspace.episodes.length ? restoredWorkspace.episodes : [{ id: 'ep-1', title: '第 1 集', workspace: null }];
      state.activeEpisodeId = state.episodes.some(ep => ep.id === restoredWorkspace?.activeEpisodeId) ? restoredWorkspace.activeEpisodeId : state.episodes[0].id;
      const activeEpisode = () => state.episodes.find(ep => ep.id === state.activeEpisodeId) || state.episodes[0];
      const captureEpisode = () => Object.fromEntries(EPISODE_KEYS.map(key => [key, state[key]]));
      const applyEpisode = workspace => { EPISODE_KEYS.forEach(key => { if (key in workspace) state[key] = workspace[key]; }); };

      // 新一集：文稿从模板开始（剧本正文留白），没有镜头和生成单元
      function freshWorkspace(){
        const boardFile = { id: 'film-storyboard-list', type: 'storyboard', title: '分镜表', updated: '刚刚', preview: '镜头按拍摄叙事顺序排列' };
        const fileStores = clone(initialFileStores);
        // 新一集的创作文稿全部从空白开始：故事梗概 / 故事大纲 / 剧本正文各一份空白版本，分镜表为空，没有自定义页面
        const now = Date.now();
        const blankDoc = (mode, type, title) => ({ id: `${mode}-${type}-1`, type, title, updated: '刚刚', updatedAt: now, preview: '空白，从这里开始', kind: 'doc', docHtml: '', comments: [] });
        Object.keys(fileStores).forEach(mode => {
          const fs = fileStores[mode];
          if (fs.cover) fs.cover = [{ id: `${mode}-cover-1`, type: 'cover', title: '封面', updated: '刚刚', updatedAt: now, preview: '空白封面', blank: true, editableText: {} }];
          if (fs.synopsis) fs.synopsis = [blankDoc(mode, 'synopsis', '故事梗概 01')];
          if (fs.outline) fs.outline = [blankDoc(mode, 'outline', '故事大纲 · 初稿')];
          if (fs.episodeOutline) fs.episodeOutline = [blankDoc(mode, 'episodeOutline', '分集大纲 · 初稿')];
          if (fs.script) fs.script = [{ id: `${mode}-script-1`, type: 'script', title: '剧本正文 · 第一稿', updated: '刚刚', updatedAt: now, preview: '空白剧本', editableText: {},
            scriptBlocks: [{ id: 'b-' + now.toString(36) + 'a', type: 'action', text: '' }] }];
          fs.storyboard = [mode === 'film' ? boardFile : { ...boardFile, id: `${mode}-storyboard-list` }];
          fs.custom = [];
        });
        const script = fileStores.film.script?.[0];
        return {
          fileStores, shots: [], chunks: [],
          currentDoc: 'script', currentFileId: script?.id || 'film-script-1', compareDoc: 'storyboard', compareFileId: boardFile.id, compareMemo: null,
          activeStoryboardId: boardFile.id, selectedChunk: null,
          productionRows: clone(initialProductionRows), callSheetMeta: { ...initialCallSheetMeta }, castCalls: clone(initialCastCalls),
          dailyReportMeta: { ...initialDailyReportMeta }, dailyReportCastActuals: clone(initialDailyReportCastActuals),
          formatAssignments: {}, assetOverrides: {}, assetsRecognized: false, assetRecognition: {},
          characterAssignments: { s4: '吴老师', s6: '梦雨' }, selectedScriptId: null, locatedScriptId: null, activeScene: 'scene1', shotTab: {},
          storyBeats: clone(initialStoryCards), storyEdges: clone(initialStoryEdges), ideaNodes: clone(initialIdeaNodes), ideaEdges: clone(initialIdeaEdges), ideaLayoutGroups: []
        };
      }
      function resetTransient(){
        state.selectedShots = new Set(); state.view = 'focus'; state.selectedPageSlot = 'left'; state.projectPage = 'scripts'; state.workspaceMode = 'document';
        state.expandedStack = null; state.contextFileId = null; state.renamingFileId = null; state.writingOpen = false;
        openFolders().clear();
      }
      function switchEpisode(id){
        const target = state.episodes.find(ep => ep.id === id);
        if (!target || id === state.activeEpisodeId) return;
        captureVisibleEdits();
        activeEpisode().workspace = captureEpisode();
        applyEpisode(target.workspace || freshWorkspace());
        target.workspace = null;
        state.activeEpisodeId = id;
        resetTransient();
        // 两集的文件 id 会重名（都从同一套模板来）；render() 开头会把仍在画面上的稿纸内容写回同 id 的文件，
        // 所以换集后先把旧集的稿纸从 DOM 清掉，避免上一集的正文被抄进这一集
        $$('[data-paper], .board-shell').forEach(el => el.remove());
        closeEpisodeMenu(); render(); persistWorkspace();
        $('#canvas-viewport').scrollTop = 0;
        showToast(`已切换到「${target.title}」`);
      }
      function createEpisode(){
        const n = state.episodes.length + 1;
        const ep = { id: nextEpisodeId(), title: `第 ${n} 集`, workspace: freshWorkspace() };
        state.episodes.push(ep);
        switchEpisode(ep.id);
        showToast(`已新建「${ep.title}」，这一集的剧本、分镜与画布独立保存`);
      }
      function deleteEpisode(id){
        const ep = state.episodes.find(e => e.id === id);
        if (!ep || state.episodes.length <= 1) return showToast('至少保留一集');
        if (!window.confirm(`删除「${ep.title}」？这一集的剧本、分镜和生成单元画布会一起删除，无法恢复。`)) return;
        const index = state.episodes.indexOf(ep);
        if (id === state.activeEpisodeId) switchEpisode((state.episodes[index - 1] || state.episodes[index + 1]).id);
        state.episodes = state.episodes.filter(e => e.id !== id);
        persistWorkspace(); renderEpisodeMenu(); render();
        showToast(`已删除「${ep.title}」`);
      }
      function renameEpisode(id, title){
        const ep = state.episodes.find(e => e.id === id), next = (title || '').trim();
        if (!ep || !next || next === ep.title) return renderEpisodeMenu();
        ep.title = next; persistWorkspace(); renderEpisodeMenu(); syncEpisodeTitle();
      }
      episodesApi = { switchEpisode, createEpisode, renameEpisode };
      const shotCount = ep => ep.id === state.activeEpisodeId ? state.shots.length : (ep.workspace?.shots?.length || 0);
      const clapper = `<svg class="icon sm" viewBox="0 0 24 24"><path d="M3 9h18v11H3zM3 9l2-5h14l2 5M8 4l2 5M13 4l2 5"/></svg>`;
      let renamingEpisodeId = null;
      function renderEpisodeMenu(){
        const menu = $('#episode-menu');
        if (!menu) return;
        if (menu.classList.contains('fx-entering')) moodioMenuFx.settle(menu);   // 入场动画未完就重绘（如点了重命名）时直接定格，避免行再次淡入
        const projects = moodioProjects.list(), activeProject = moodioProjects.active();
        const folderIcon = `<svg class="icon sm" viewBox="0 0 24 24"><path d="M3 7h6l2 2h10v10H3z"/></svg>`;
        const projectHtml = `<div class="project-section-title">项目</div>` + projects.map(p => `<div class="episode-row project-row ${p.id === activeProject?.id ? 'active' : ''}" role="menuitem" data-project-switch="${p.id}">${folderIcon}<span class="episode-name">${escapeHtml(p.title)}</span>${p.id === activeProject?.id ? `<button class="episode-tool" data-project-rename="${p.id}" aria-label="重命名项目 ${escapeHtml(p.title)}"><svg class="icon sm" viewBox="0 0 24 24"><path d="m4 20 4-1 11-11-3-3L5 16zM14 7l3 3"/></svg></button>` : ''}${projects.length > 1 ? `<button class="episode-tool" data-project-delete="${p.id}" aria-label="删除项目 ${escapeHtml(p.title)}">${icons.trash}</button>` : ''}</div>`).join('')
          + `<button class="episode-new" data-project-new>${flowIcon('plus')}新建项目</button><div class="project-section-title">剧集</div>`;
        menu.innerHTML = projectHtml + state.episodes.map(ep => `<div class="episode-row ${ep.id === state.activeEpisodeId ? 'active' : ''}" role="menuitem" data-episode="${ep.id}">${clapper}${renamingEpisodeId === ep.id
          ? `<input class="episode-rename" data-episode-rename="${ep.id}" value="${escapeHtml(ep.title)}" maxlength="30" aria-label="重命名剧集">`
          : `<span class="episode-name">${escapeHtml(ep.title)}</span><small>${shotCount(ep)} 个镜头</small><button class="episode-tool" data-episode-edit="${ep.id}" aria-label="重命名 ${escapeHtml(ep.title)}"><svg class="icon sm" viewBox="0 0 24 24"><path d="m4 20 4-1 11-11-3-3L5 16zM14 7l3 3"/></svg></button><button class="episode-tool danger" data-episode-delete="${ep.id}" aria-label="删除 ${escapeHtml(ep.title)}" ${state.episodes.length <= 1 ? 'disabled' : ''}><svg class="icon sm" viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14"/></svg></button>`}</div>`).join('')
          + `<button class="episode-new" data-episode-new>${flowIcon('plus')}新建剧集</button>`;
        if (renamingEpisodeId) { const input = $('[data-episode-rename]', menu); input?.focus(); input?.select(); }
      }
      function syncEpisodeTitle(){ const el = $('#episode-title'); if (el) el.textContent = activeEpisode().title; }
      function openEpisodeMenu(){
        const button = $('#episode-switch'), menu = $('#episode-menu');
        renamingEpisodeId = null; renderEpisodeMenu();
        const rect = button.getBoundingClientRect();
        menu.style.left = rect.left + 'px'; menu.style.top = rect.bottom + 6 + 'px';
        menu.classList.remove('hidden'); button.setAttribute('aria-expanded', 'true'); button.classList.add('open');
        moodioMenuFx.open(menu);
      }
      function closeEpisodeMenu(){
        renamingEpisodeId = null;
        const menu = $('#episode-menu'), button = $('#episode-switch');
        button?.setAttribute('aria-expanded', 'false'); button?.classList.remove('open');
        if (menu) moodioMenuFx.close(menu, () => menu.classList.add('hidden'));
      }
      document.addEventListener('click', event => {
        const switchButton = event.target.closest('#episode-switch');
        if (switchButton) { event.preventDefault(); event.stopImmediatePropagation(); return moodioMenuFx.isOpen($('#episode-menu')) ? closeEpisodeMenu() : openEpisodeMenu(); }
        const inMenu = event.target.closest('#episode-menu');
        if (!inMenu) { if (moodioMenuFx.isOpen($('#episode-menu'))) closeEpisodeMenu(); return; }
        event.preventDefault(); event.stopImmediatePropagation();
        // 项目区
        const pRename = event.target.closest('[data-project-rename]'), pDel = event.target.closest('[data-project-delete]'), pNew = event.target.closest('[data-project-new]'), pSwitch = event.target.closest('[data-project-switch]');
        if (pRename) { const p = moodioProjects.active(); closeEpisodeMenu(); openFlowDialog('重命名项目', `<label>项目名称<input id="project-name-input" value="${escapeHtml(p?.title || '')}" maxlength="40"></label>`, flowButton('close-dialog', '取消') + `<button class="canvas-action primary" data-project-dialog="rename" data-project-id="${p?.id || ''}">保存</button>`); setTimeout(() => $('#project-name-input')?.select(), 30); return; }
        if (pDel) { const id = pDel.dataset.projectDelete; const p = moodioProjects.list().find(x => x.id === id); if (!p) return; closeEpisodeMenu(); openFlowDialog('删除项目', `<p>删除项目 <strong>${escapeHtml(p.title)}</strong>？它的全部剧集、文档、分镜、资产和对话会被删除，<strong>无法恢复</strong>。建议先在「导出文档」里导出项目备份。</p>`, flowButton('close-dialog', '取消') + `<button class="canvas-action primary" data-project-dialog="delete" data-project-id="${p.id}">删除项目</button>`); return; }
        if (pNew) { closeEpisodeMenu(); openFlowDialog('新建项目', `<p>新项目从空白开始：一集、空白封面与剧本、无资产。当前项目会先自动保存。</p><label>项目名称<input id="project-name-input" value="新项目" maxlength="40"></label>`, flowButton('close-dialog', '取消') + `<button class="canvas-action primary" data-project-dialog="create">创建并切换</button>`); setTimeout(() => $('#project-name-input')?.select(), 30); return; }
        if (pSwitch) { const id = pSwitch.dataset.projectSwitch; if (id !== moodioProjects.active()?.id) { captureVisibleEdits(); closeEpisodeMenu(); showToast('正在切换项目…'); moodioProjects.switchTo(id); } return; }
        const edit = event.target.closest('[data-episode-edit]'), del = event.target.closest('[data-episode-delete]'), create = event.target.closest('[data-episode-new]'), row = event.target.closest('[data-episode]');
        if (edit) { renamingEpisodeId = edit.dataset.episodeEdit; return renderEpisodeMenu(); }
        if (del) return deleteEpisode(del.dataset.episodeDelete);
        if (create) return createEpisode();
        if (event.target.closest('[data-episode-rename]')) return;
        if (row) { switchEpisode(row.dataset.episode); closeEpisodeMenu(); }
      }, true);
      document.addEventListener('click', event => {
        const btn = event.target.closest('[data-project-dialog]'); if (!btn) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const action = btn.dataset.projectDialog, id = btn.dataset.projectId, name = $('#project-name-input')?.value?.trim();
        if (action === 'rename') { if (!name) return; moodioProjects.rename(id, name); closeFlowDialog(); showToast(`项目已重命名为「${name}」`); return; }
        if (action === 'delete') { const p = moodioProjects.list().find(x => x.id === id); closeFlowDialog(); if (p && moodioProjects.remove(id)) showToast(`已删除项目「${p.title}」`); return; }
        if (action === 'create') { captureVisibleEdits(); persistWorkspace(); closeFlowDialog(); showToast('正在创建项目…'); moodioProjects.create(name || '新项目'); }
      }, true);
      document.addEventListener('keydown', event => {
        if (event.key === 'Enter' && event.target.id === 'project-name-input') { event.preventDefault(); $('[data-project-dialog]')?.click(); return; }
        const input = event.target.closest?.('[data-episode-rename]');
        if (input) { if (event.key === 'Enter') { event.preventDefault(); renameEpisode(input.dataset.episodeRename, input.value); renamingEpisodeId = null; renderEpisodeMenu(); } else if (event.key === 'Escape') { event.stopPropagation(); renamingEpisodeId = null; renderEpisodeMenu(); } return; }
        if (event.key === 'Escape' && moodioMenuFx.isOpen($('#episode-menu'))) closeEpisodeMenu();
      }, true);
      document.addEventListener('focusout', event => {
        const input = event.target.closest?.('[data-episode-rename]');
        if (input && renamingEpisodeId) { const id = input.dataset.episodeRename, value = input.value; renamingEpisodeId = null; renameEpisode(id, value); }
      }, true);
      const renderBeforeEpisodes = render;
      render = () => { renderBeforeEpisodes(); syncEpisodeTitle(); };
      syncEpisodeTitle();
      // 新建项目后的第一次加载：把示例数据重置为空白工作区
      if (moodioProjects.consumeFresh()) {
        state.episodes = [{ id: nextEpisodeId(), title: '第 1 集', workspace: null }];
        state.activeEpisodeId = state.episodes[0].id;
        applyEpisode(freshWorkspace());
        Object.keys(assetCatalog).forEach(k => { assetCatalog[k] = []; });
        state.storyBeats = []; state.storyEdges = []; state.ideaNodes = []; state.ideaEdges = []; state.ideaLayoutGroups = []; state.trash = [];
        resetTransient();
        $$('[data-paper], .board-shell').forEach(el => el.remove());
        persistWorkspace(); render(); syncEpisodeTitle(); moodioProjects.syncTitle();
        showToast(`已创建空白项目「${moodioProjects.active()?.title || ''}」`);
      }
    })();


    /* ===== 侧栏：「剧本工作区」板块高度可拖动（分隔条压在它下方那条线上） ===== */
    (function setupWorkspaceResizer(){
      const panel = document.getElementById('writing-panel');
      if (!panel) return;
      const MIN_H = 60, DEFAULT_H = 653;   // 默认高度：按用户拖出来的比例定
      let stored = state.workspacePaneHeight ?? DEFAULT_H, observer = null;
      const clamp = h => Math.min(Math.max(MIN_H, panel.clientHeight - 80), Math.max(MIN_H, h));
      const remember = () => { state.workspacePaneHeight = stored; persistWorkspace(); };
      function install(){
        observer?.disconnect();
        panel.querySelectorAll(':scope > .writing-divider').forEach(el => el.remove());
        const first = panel.querySelector(':scope > .writing-section');
        if (first && panel.querySelector(':scope > .writing-context')) {
          first.classList.add('resizable');
          if (stored != null) first.style.height = Math.round(clamp(stored)) + 'px'; else first.style.removeProperty('height');
          const bar = document.createElement('div');
          bar.className = 'writing-divider'; bar.tabIndex = 0;
          bar.setAttribute('role', 'separator'); bar.setAttribute('aria-orientation', 'horizontal'); bar.setAttribute('aria-label', '拖动调整「剧本工作区」高度');
          const commit = h => { stored = Math.round(clamp(h)); first.style.height = stored + 'px'; remember(); };
          const reset = () => { stored = DEFAULT_H; first.style.height = Math.round(clamp(stored)) + 'px'; remember(); };
          bar.addEventListener('pointerdown', event => {
            if (event.button) return;
            event.preventDefault();
            const startY = event.clientY, startH = first.getBoundingClientRect().height;
            try { bar.setPointerCapture(event.pointerId); } catch (_) {}
            bar.classList.add('dragging'); document.body.classList.add('writing-resizing');
            const move = e => commit(startH + (e.clientY - startY));
            const stop = () => { bar.classList.remove('dragging'); document.body.classList.remove('writing-resizing'); bar.removeEventListener('pointermove', move); bar.removeEventListener('pointerup', stop); bar.removeEventListener('pointercancel', stop); };
            bar.addEventListener('pointermove', move); bar.addEventListener('pointerup', stop); bar.addEventListener('pointercancel', stop);
          });
          bar.addEventListener('dblclick', reset);
          bar.addEventListener('keydown', event => {
            const step = event.shiftKey ? 24 : 8, current = first.getBoundingClientRect().height;
            if (event.key === 'ArrowUp') { event.preventDefault(); commit(current - step); }
            else if (event.key === 'ArrowDown') { event.preventDefault(); commit(current + step); }
            else if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); reset(); }
          });
          first.after(bar);
        }
        observer?.observe(panel, { childList: true });
      }
      observer = new MutationObserver(install);
      install();
    })();


    /* ===== 侧栏下半区：随当前板块变化的上下文面板 ===== */
    function contextDocInfo(){
      const slot = state.view === 'compare' ? state.selectedPageSlot : 'left';
      const type = slot === 'right' ? state.compareDoc : state.currentDoc;
      const file = findFile(slot === 'right' ? state.compareFileId : state.currentFileId);
      const root = state.view === 'compare' ? (slot === 'right' ? '#compare-secondary' : '#compare-script') : '#focus-layout';
      return { slot, type, file, root };
    }
    function ctxSection(title, aside, body, extra = ''){ return `<section class="writing-section context-section ${extra}"><div class="writing-section-head"><span>${title}</span>${aside ? `<span>${aside}</span>` : ''}</div>${body}</section>`; }
    function ctxStats(items){ return `<div class="writing-stat-grid">${items.map(([v, l]) => `<div class="writing-stat"><strong>${v}</strong><span>${l}</span></div>`).join('')}</div>`; }
    function ctxMeta(rows){ return rows.map(([k, v]) => `<div class="writing-meta-row"><span>${k}</span><strong title="${escapeHtml(String(v ?? ''))}">${escapeHtml(String(v ?? '—'))}</strong></div>`).join(''); }
    function ctxNav(items){ return `<div class="writing-scene-list">${items.map(it => `<button class="writing-scene ${it.active ? 'active' : ''}" data-context-jump="${escapeHtml(it.jump || '')}"><span>${escapeHtml(it.no)}</span><span><strong>${escapeHtml(it.title)}</strong>${it.sub ? `<small>${escapeHtml(it.sub)}</small>` : ''}</span></button>`).join('') || '<p class="writing-folders-empty">暂无内容</p>'}</div>`; }
    function sumBy(rows, i){ return rows.reduce((n, r) => n + (parseFloat(r[i]) || 0), 0); }
    function productionRowsOf(file, type){ return file?.productionData?.rows || state.productionRows?.[type] || []; }
    // 各板块导航共用的表头右侧：定位输入框 + 计数
    function navHead(placeholder, count){ return `<span class="scene-locate"><input type="text" inputmode="numeric" data-nav-locate placeholder="${placeholder}" aria-label="输入${placeholder}定位" maxlength="3"><small>/ ${count}</small></span>`; }
    function renderContextSections(sceneRows){
      const base = renderContextSectionsBase(sceneRows);
      const { type } = contextDocInfo();
      const lintPart = type === 'script' && typeof MOODIO_SCRIPT_RULES !== 'undefined' ? scriptLintSection(contextDocInfo().file) : '';   // 规则表在 src/15 赋值，首屏渲染时可能尚未就绪
      return base + lintPart + (type && type !== 'cover' && typeof moodioVersions !== 'undefined' ? moodioVersions.sectionHtml() : '');
    }
    // 侧栏「格式检查」：按当前排版规则校验剧本，点击定位到那一行
    function scriptLintSection(file){
      if (!file) return '';
      const names = new Set(allAssets().filter(a => a.type === 'character').flatMap(a => [a.name, ...(a.aliases || [])])); scriptBlocksOf(file).forEach(b => { if (b.type === 'character') names.add(String(b.text || '').replace(/[（(].*$/, '').trim()); });
      const issues = lintScriptBlocks(scriptBlocksOf(file), { layout: state.scriptLayout, knownNames: [...names] });
      const body = issues.length ? ctxNav(issues.slice(0, 30).map((x, i) => ({ no: x.level === 'error' ? '✕' : x.level === 'warn' ? '△' : '?', title: x.message.replace(/，请.*$/, ''), sub: x.snippet, jump: `[data-script-id="${x.blockId}"]` }))) : '<p class="writing-folders-empty">未发现格式问题</p>';
      return ctxSection('格式检查', lintSummaryText(issues), body);
    }
    function renderContextSectionsBase(sceneRows){
      const { type, file } = contextDocInfo();
      if (type === 'script' || !type) {
        const blocks = file ? scriptBlocksOf(file) : [];
        const scenes = [];
        blocks.forEach(b => { if (b.type === 'scene') scenes.push({ id: b.id, title: (b.text || '').trim() || '（未命名场景）', cast: new Set() }); else if (b.type === 'character' && scenes.length) { const n = (b.text || '').trim(); if (n && n !== '选择人物') scenes[scenes.length - 1].cast.add(n); } });
        const rows = scenes.map((sc, i) => `<button class="writing-scene ${state.locatedScriptId === sc.id || state.activeScene === sc.id ? 'active' : ''}" data-writing-scene="${sc.id}" data-scene="${sc.id}"><span>${String(i + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(sc.title.replace(/^(INT|EXT|INT\/EXT)\.\s*/i, '$1 · ').replace(/\s*-\s*/g, ' · '))}</strong><small>${[...sc.cast].join('、') || '—'}</small></span></button>`).join('');
        return ctxSection('场次导航', navHead('场次号', `${scenes.length} 场`), `<div class="writing-scene-list">${rows || '<p class="writing-folders-empty">输入 “/” 选择「场景标题」来创建第一场</p>'}</div>`);
      }
      if (type === 'cover') return '';   // 封面不需要侧栏信息板块
      if (type === 'synopsis' || type === 'outline') {
        return ctxSection('文档目录', navHead('标题号', '— 节'), `<div data-context-fill="doc-outline"></div>`);
      }
      if (type === 'storyboard') {
        const boardId = file?.id || state.activeStoryboardId, shots = state.shots.filter(sh => (sh.boardFileId || 'film-storyboard-list') === boardId);
        // 只列镜头号，便于快速定位；不带画面描述
        return ctxSection('镜头导航', navHead('镜头号', `${shots.length} 个镜头`), ctxNav(shots.map((sh, i) => ({ no: String(i + 1).padStart(2, '0'), title: `SHOT ${String(i + 1).padStart(2, '0')}`, jump: `[data-record="${sh.id}"]`, active: state.selectedShots?.has(sh.id) }))), 'compact-nav');
      }
      if (type === 'scriptOrder') {
        const rows = productionRowsOf(file, type), minutes = sumBy(rows, 3);
        return ctxSection('统筹概览', '按剧本顺序', ctxStats([[rows.length, '场次'], [sumBy(rows, 2).toFixed(3), '剧本页'], [`${Math.round(minutes)} min`, '预计拍摄'], [(minutes / 480).toFixed(1), '折合工作日']]))
          + ctxSection('场次导航', '', ctxNav(rows.map((r, i) => ({ no: String(r[1] || i + 1).padStart(2, '0'), title: `${r[4] || '—'} · ${r[5] || ''}${r[6] || ''}`, sub: `${r[2] || '—'} 页 · ${r[3] || '—'} min`, jump: `.production-table tbody tr:nth-child(${i + 1})` }))));
      }
      if (type === 'locationBreakdown') {
        const rows = productionRowsOf(file, type), groups = [];
        rows.forEach((r, i) => { let g = groups.find(x => x.name === r[0]); if (!g) { g = { name: r[0], rows: [], first: i }; groups.push(g); } g.rows.push(r); });
        const minutes = sumBy(rows, 4);
        return ctxSection('分景概览', '按场景归并', ctxStats([[groups.length, '场景'], [rows.length, '场次'], [sumBy(rows, 3).toFixed(3), '剧本页'], [`${Math.round(minutes)} min`, '预计拍摄']]))
          + ctxSection('场景导航', '', ctxNav(groups.map((g, i) => ({ no: String(i + 1).padStart(2, '0'), title: g.name, sub: `${g.rows.length} 场 · ${g.rows.map(r => r[2]).join('、')}`, jump: `.production-table tbody tr:nth-child(${g.first + 1})` }))));
      }
      if (type === 'dailySchedule') {
        const meta = file?.productionData?.callSheetMeta || state.callSheetMeta || {}, rows = productionRowsOf(file, type);
        return ctxSection('通告概览', meta.shootDay || '', ctxMeta([['日期', meta.date], ['集合', meta.generalCall], ['首镜', meta.firstShot], ['用餐', meta.meal], ['预计收工', meta.estWrap], ['天气', meta.weather], ['基地', meta.basecamp]]))
          + ctxSection('时间线', `${rows.length} 项`, ctxNav(rows.map((r, i) => ({ no: (r[0] || '').split('–')[0].slice(0, 5), title: `${r[1] || '—'}${r[2] && r[2] !== '—' ? ` · 场 ${r[2]}` : ''}`, sub: (r[6] || '').slice(0, 24), jump: `.production-table tbody tr:nth-child(${i + 1})` }))));
      }
      if (type === 'custom') return blankPageContext(file);
      return ctxSection('文档信息', '', ctxMeta([['类型', docDef(type)?.name || type], ['版本', file?.title || '—'], ['更新', file?.updated || '—']]));
    }
    // 依赖稿纸 DOM 的部分（字数、段落、标题）在稿纸渲染完成后填充
    function fillContextSections(){
      const panel = $('#writing-panel');
      if (!panel || !panel.querySelector('[data-context-fill]')) return;
      const { root } = contextDocInfo();
      const paper = $(`${root} .paper`);
      const text = el => (el?.innerText || '').replace(/\s+/g, '');
      panel.querySelectorAll('[data-context-fill]').forEach(slot => {
        const kind = slot.dataset.contextFill;
        if (kind === 'versions') { moodioVersions.fillSlot(slot); return; }
        if (!paper) { slot.innerHTML = '<p class="writing-folders-empty">稿纸未打开</p>'; return; }
        if (kind === 'text-stats') {
          const paras = $$('p', paper), chars = paras.reduce((n, el) => n + text(el).length, 0);
          slot.innerHTML = ctxStats([[chars.toLocaleString(), '字数'], [paras.length, '段落'], [$$('h2', paper).length || '—', '章节'], [`${Math.max(1, Math.round(chars / 400))}′`, '朗读时长']]);
        }
        if (kind === 'doc-outline') {
          $$('[data-cdoc-body] [data-cdoc-h]', paper).forEach(el => el.removeAttribute('data-cdoc-h'));
          const heads = $$('[data-cdoc-body] h1, [data-cdoc-body] h2, [data-cdoc-body] h3', paper).filter(el => (el.innerText || '').trim());   // 空标题不计入目录
          heads.forEach((el, i) => { el.dataset.cdocH = String(i + 1); });
          slot.innerHTML = heads.length ? ctxNav(heads.map((el, i) => ({ no: String(i + 1).padStart(2, '0'), title: (el.innerText || '').trim().slice(0, 24), sub: `${el.tagName} · ${text(el.nextElementSibling)?.length || 0} 字`, jump: `[data-cdoc-h="${i + 1}"]` }))) : '<p class="writing-folders-empty">正文里的标题 1 / 2 / 3 会出现在这里</p>';
          const count = slot.closest('.writing-section')?.querySelector('.scene-locate small'); if (count) count.textContent = `/ ${heads.length} 节`;
        }
        if (kind === 'doc-stats') {
          const body = $('[data-cdoc-body]', paper); if (!body) { slot.innerHTML = '<p class="writing-folders-empty">稿纸未打开</p>'; return; }
          const chars = text(body).length, paras = $$('p, li, h1, h2, h3, blockquote, pre', body).length;
          const file = findFile(paper.dataset.pageFile), open = (file?.comments || []).filter(c => !c.resolved).length;
          slot.innerHTML = ctxStats([[chars.toLocaleString(), '字数'], [paras, '段落'], [$$('figure.cdoc-media', body).length, '图片 / 视频'], [open, '待处理评论']]);
        }
        if (kind === 'doc-comments') {
          const file = findFile(paper.dataset.pageFile), list = (file?.comments || []).filter(c => !c.resolved);
          slot.innerHTML = list.length ? list.map(c => `<button class="ctx-comment" data-cdoc-comment-jump="${c.id}"><span>${escapeHtml(c.quote || '（无引用）')}</span><small>${c.thread.length ? escapeHtml(c.thread[c.thread.length - 1].text).slice(0, 40) : '暂无回复'} · ${c.thread.length} 条</small></button>`).join('') : '<p class="writing-folders-empty">选中正文文字后点击浮动工具条的「评论」</p>';
        }
        if (kind === 'sheet-stats') {
          const file = findFile(paper.dataset.pageFile); if (!file?.sheets && !file?.sheet) { slot.innerHTML = ''; return; }
          const sh = sheetBook(file); const filled = Object.values(sh.cells).filter(c => (c.v || '').trim()), formulas = filled.filter(c => c.v.startsWith('='));
          slot.innerHTML = ctxStats([[file.sheets.length, '工作表'], [`${sh.rows} × ${sh.cols}`, '行 × 列'], [filled.length, '已填单元格'], [formulas.length, '公式']]);
        }
        if (kind === 'cv-stats') {
          const file = findFile(paper.dataset.pageFile), cv = file?.canvas; if (!cv) { slot.innerHTML = ''; return; }
          slot.innerHTML = ctxStats([[cv.notes.length, '便签'], [cv.strokes.length, '笔画'], [cv.notes.filter(n => (n.text || '').trim()).length, '有内容'], [`${cv.w}×${cv.h}`, '画布尺寸']]);
        }
        if (kind === 'cv-notes') {
          const file = findFile(paper.dataset.pageFile), cv = file?.canvas; if (!cv) { slot.innerHTML = ''; return; }
          slot.innerHTML = cv.notes.length ? cv.notes.map((n, i) => `<button class="writing-scene" data-cv-jump="${n.id}"><span>${String(i + 1).padStart(2, '0')}</span><span><strong>${escapeHtml((n.text || '').trim().slice(0, 20) || '（空便签）')}</strong><small>${Math.round(n.x)}, ${Math.round(n.y)}</small></span></button>`).join('') : '<p class="writing-folders-empty">用「便签」工具或双击画布添加</p>';
          const count = slot.closest('.writing-section')?.querySelector('.scene-locate small'); if (count) count.textContent = `/ ${cv.notes.length} 张`;
        }
        if (kind === 'mm-outline') {
          const file = findFile(paper.dataset.pageFile), mm = file?.mindmap; if (!mm) { slot.innerHTML = ''; return; }
          const rows = []; (function walk(n, d) { rows.push({ n, d }); n.children.forEach(c => walk(c, d + 1)); })(mm.root, 0);
          slot.innerHTML = rows.map((r, i) => `<button class="writing-scene ${mm.selected === r.n.id ? 'active' : ''}" data-mm-jump="${r.n.id}" style="padding-left:${8 + r.d * 12}px"><span>${String(i + 1).padStart(2, '0')}</span><span><strong>${escapeHtml(r.n.text || '未命名')}</strong><small>${r.n.children.length ? `${r.n.children.length} 个子节点` : `第 ${r.d} 层`}</small></span></button>`).join('');
          const count = slot.closest('.writing-section')?.querySelector('.scene-locate small'); if (count) count.textContent = `/ ${rows.length} 节点`;
        }
        if (kind === 'paragraphs') {
          const paras = $$('p[contenteditable]', paper);
          slot.innerHTML = ctxNav(paras.map((el, i) => ({ no: String(i + 1).padStart(2, '0'), title: (el.innerText || '').trim().slice(0, 18) || '（空段落）', sub: `${text(el).length} 字`, jump: `p[contenteditable]:nth-of-type(${i + 1})` })));
          const count = slot.closest('.writing-section')?.querySelector('.scene-locate small'); if (count) count.textContent = `/ ${paras.length} 段`;
        }
        if (kind === 'headings') {
          const heads = $$('h2', paper);
          slot.innerHTML = ctxNav(heads.map((el, i) => ({ no: String(i + 1).padStart(2, '0'), title: (el.innerText || '').trim(), sub: `${text(el.nextElementSibling)?.length || 0} 字`, jump: `h2:nth-of-type(${i + 1})` })));
          const count = slot.closest('.writing-section')?.querySelector('.scene-locate small'); if (count) count.textContent = `/ ${heads.length} 幕`;
        }
      });
    }
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-context-jump]');
      if (!button || !button.closest('#writing-panel')) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const { root } = contextDocInfo();
      const host = $(`${root} .paper, ${root} .board-shell`);
      const target = host && button.dataset.contextJump ? $(button.dataset.contextJump, host) : null;
      if (!target) return showToast('目标不在当前稿纸上');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.classList.add('context-flash'); setTimeout(() => target.classList.remove('context-flash'), 1200);
      button.closest('.writing-scene-list')?.querySelectorAll('.writing-scene.active').forEach(el => el.classList.remove('active')); button.classList.add('active');
    }, true);
    const renderBeforeContext = render;
    render = () => { renderBeforeContext(); fillContextSections(); };
    fillContextSections();


    /* ===== 导入文档：先选择放进哪个板块 ===== */
    const IMPORT_TARGETS = [['synopsis', '故事梗概', '一页故事概述'], ['outline', '故事大纲', '分幕结构与节拍'], ['script', '剧本正文', '剧本、Fountain、FDX'], ['custom', '空白页面', '不归类的自由文稿']];
    function openImportTargetDialog(){
      state.importTarget = null;
      openFlowDialog('导入文档到哪个板块？', `<div class="import-target-grid">${IMPORT_TARGETS.map(([id, name, hint]) => `<button class="import-target" data-import-target="${id}"><span class="writing-doc-icon">${icons[docDef(id).icon] || icons.custom}</span><span><strong>${name}</strong><small>${hint}</small></span></button>`).join('')}</div><p>导入的文档会成为该板块的最新版本；支持 TXT、Markdown、Fountain、FDX、RTF、Word、PDF。</p>`, flowButton('close-dialog', '取消'));
    }
    document.addEventListener('click', event => {
      const target = event.target.closest('[data-import-target]');
      if (!target) return;
      event.preventDefault(); event.stopImmediatePropagation();
      state.importTarget = target.dataset.importTarget;
      closeFlowDialog();
      $('#text-import-input').click();
    }, true);
    // 导入进来的是纯文本，用文本稿纸呈现，但归属于所选板块（分镜表除外）
    function renderImportedDocument(file){
      const def = docDef(file.type), name = def.name === '新建空白页面' ? '空白页面' : def.name;
      const body = file.content ? escapeHtml(file.content) : '（空文档）';
      return paperWrap(`
        <div class="paper-kicker">${escapeHtml(name)} · 导入文档${file.sourceName ? ` · ${escapeHtml(file.sourceName)}` : ''}</div>
        <h1 contenteditable="true">${escapeHtml(file.title)}</h1>
        <p class="doc-lead imported-text" contenteditable="true">${body}</p>
      `, { page: '1' });
    }
    const documentBeforeImport = renderDocument;
    renderDocument = (type, options = {}) => {
      const file = findFile(options.fileId);
      if (!file?.importedText || file.type === 'storyboard' || file.type === 'custom') return documentBeforeImport(type, options);
      state.renderContext = { docId: type, normalized: type === 'episodeOutline' ? 'outline' : type === 'episodeScript' ? 'script' : type, slot: options.slot || 'left', fileId: file.id };
      try { return renderImportedDocument(file); } finally { state.renderContext = null; }
    };




    /* ===== 侧栏全局搜索：标题、正文、分镜描述一起搜 ===== */
    function searchState(){ return searchState.s || (searchState.s = { q: '' }); }
    function renderWritingSearch(){
      const q = searchState().q;
      return `<div class="writing-search"><svg class="icon sm" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg><input type="search" data-global-search placeholder="搜索全部文稿、镜头…" value="${escapeHtml(q)}" aria-label="全局搜索" autocomplete="off"><button class="writing-search-clear ${q ? '' : 'hidden'}" data-global-search-clear aria-label="清空搜索">${flowIcon('close')}</button></div><div class="writing-search-results ${q ? '' : 'hidden'}">${q ? renderSearchResults(q) : ''}</div>`;
    }
    const SEARCHABLE_TYPES = ['synopsis', 'outline', 'script', 'cover', 'storyboard', 'custom'];
    function fileSearchText(file){
      // 把稿纸渲染到内存里、套上用户的编辑，再按阅读顺序取纯文本（标题单独匹配，不进摘要）
      try {
        const holder = document.createElement('div');
        holder.innerHTML = renderDocument(file.type, { fileId: file.id, slot: 'left' }) || '';
        $$('[contenteditable="true"]', holder).forEach((el, i) => { const key = editableContentKey(el, i); if (file.editableText && Object.prototype.hasOwnProperty.call(file.editableText, key)) el.textContent = file.editableText[key]; });
        holder.querySelectorAll('select, button, .paper-page-number, .page-drag-handle, .paper-doc-tabs, .script-meta, .paper-kicker').forEach(el => el.remove());
        holder.querySelectorAll('div, p, h1, h2, h3, li, tr').forEach(el => el.prepend('\n'));
        return holder.textContent.replace(/[ \t]+/g, ' ').replace(/\n{2,}/g, '\n').trim();
      } catch (_) {
        return [file.content || '', ...Object.values(file.editableText || {})].join('\n');
      }
    }
    function searchSnippet(text, q){
      const i = text.toLowerCase().indexOf(q.toLowerCase());
      if (i < 0) return '';
      const start = Math.max(0, i - 24), end = Math.min(text.length, i + q.length + 36);
      const before = escapeHtml(text.slice(start, i)), hit = escapeHtml(text.slice(i, i + q.length)), after = escapeHtml(text.slice(i + q.length, end));
      return `${start > 0 ? '…' : ''}${before}<mark>${hit}</mark>${after}${end < text.length ? '…' : ''}`.replace(/\n/g, ' ');
    }
    function renderSearchResults(q){
      const needle = q.trim().toLowerCase();
      if (!needle) return '';
      const results = [];
      SEARCHABLE_TYPES.forEach(type => filesForType(type).forEach(file => {
        const name = docDef(type).name === '新建空白页面' ? '空白页面' : docDef(type).name;
        const titleHit = file.title.toLowerCase().includes(needle);
        const text = fileSearchText(file);
        const snippet = titleHit ? '' : searchSnippet(text, q.trim());
        if (titleHit || snippet) results.push({ icon: icons[docDef(type).icon] || icons.custom, title: displayFileTitle(file), meta: name, snippet: snippet || `<mark>${escapeHtml(file.title)}</mark>`, fileId: file.id, q: q.trim() });
      }));
      state.shots.forEach(shot => {
        const boardId = shot.boardFileId || 'film-storyboard-list', boardShots = state.shots.filter(s => (s.boardFileId || 'film-storyboard-list') === boardId);
        const text = [shot.description || '', shot.scene ? `场 ${shot.scene}` : ''].join(' ');
        const snippet = searchSnippet(text, q.trim());
        if (snippet) results.push({ icon: icons.storyboard, title: `SHOT ${String(boardShots.indexOf(shot) + 1).padStart(2, '0')}`, meta: findFile(boardId)?.title || '分镜表', snippet, fileId: boardId, shotId: shot.id });
      });
      if (!results.length) return `<p class="writing-folders-empty">没有找到「${escapeHtml(q.trim())}」</p>`;
      return `<div class="writing-search-count">${results.length} 个结果</div>` + results.map(r => `<button class="writing-search-hit" data-search-file="${r.fileId}" ${r.shotId ? `data-search-shot="${r.shotId}"` : ''} data-search-q="${escapeHtml(r.q || q.trim())}"><span class="writing-doc-icon">${r.icon}</span><span class="writing-search-body"><strong>${escapeHtml(r.title)}<small>${escapeHtml(r.meta)}</small></strong><span class="writing-search-snippet">${r.snippet}</span></span></button>`).join('');
    }
    let searchTimer = null;
    document.addEventListener('input', event => {
      const input = event.target.closest?.('[data-global-search]');
      if (!input) return;
      searchState().q = input.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const panel = $('#writing-panel'); if (!panel) return;
        const q = searchState().q;
        $('.writing-folders', panel)?.classList.toggle('hidden', !!q.trim());
        $('.writing-search-clear', panel)?.classList.toggle('hidden', !q);
        const box = $('.writing-search-results', panel);
        if (box) { box.classList.toggle('hidden', !q.trim()); box.innerHTML = q.trim() ? renderSearchResults(q) : ''; }
      }, 160);
    });
    function clearGlobalSearch(){ searchState().q = ''; renderWritingPanel(); $('[data-global-search]')?.focus(); }
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && event.target.closest?.('[data-global-search]') && searchState().q) { event.stopImmediatePropagation(); clearGlobalSearch(); }
    }, true);
    document.addEventListener('click', event => {
      if (event.target.closest('[data-global-search-clear]')) { event.preventDefault(); event.stopImmediatePropagation(); return clearGlobalSearch(); }
      const hit = event.target.closest('[data-search-hit], .writing-search-hit');
      if (!hit) return;
      event.preventDefault(); event.stopImmediatePropagation();
      const { searchFile, searchShot, searchQ } = hit.dataset;
      if (state.view === 'compare') state.selectedPageSlot = 'left';
      selectFile(searchFile);
      setTimeout(() => {
        const { root } = contextDocInfo();
        let target = null;
        if (searchShot) target = $(`${root} [data-record="${searchShot}"]`);
        else if (searchQ) target = $$(`${root} [contenteditable], ${root} .script-block, ${root} h2, ${root} p`).find(el => (el.innerText || '').toLowerCase().includes(searchQ.toLowerCase()));
        if (target) { target.scrollIntoView({ behavior: 'smooth', block: 'center' }); target.classList.add('context-flash'); setTimeout(() => target.classList.remove('context-flash'), 1200); }
      }, 120);
    }, true);


    /* ===== 滚动条自动隐藏：滚动时给容器加 is-scrolling，停下 0.8s 后移除 ===== */
    (function autoHideScrollbars(){
      const timers = new WeakMap();
      document.addEventListener('scroll', event => {
        const el = event.target === document ? document.documentElement : event.target;
        if (!el || !el.classList) return;
        el.classList.add('is-scrolling');
        clearTimeout(timers.get(el));
        timers.set(el, setTimeout(() => el.classList.remove('is-scrolling'), 800));
      }, true);
    })();

    /* ===== 导航定位：输入编号回车，定位到本区列表里编号一致的那一项（场次 / 镜头 / 段落 / 章节通用） ===== */
    document.addEventListener('keydown', event => {
      const input = event.target.closest?.('[data-nav-locate]');
      if (!input || event.key !== 'Enter') return;
      event.preventDefault(); event.stopImmediatePropagation();
      const raw = input.value.trim().replace(/^[场镜段幕]/, '');
      if (!raw) return;
      const wanted = String(parseInt(raw, 10)).padStart(2, '0'), label = input.placeholder.replace(/号$/, '');
      const section = input.closest('.writing-section');
      const row = Array.from(section?.querySelectorAll('.writing-scene') || []).find(b => (b.querySelector('span')?.textContent || '').trim() === wanted);
      if (!row) { showToast(`没有找到${label} ${wanted}`); input.select(); return; }
      row.click();
      requestAnimationFrame(() => { const next = $('[data-nav-locate]'); if (next) next.value = ''; });
      showToast(`已定位到${label} ${wanted}`);
    }, true);

    // 剧本格式菜单：点击「剧本」tab 右侧的箭头，切换美式 / 中式剧本（默认美式）
    (function scriptFormatMenu() {
      const FORMATS = [['american', '美式剧本', 'Hollywood'], ['chinese', '中式剧本', '国内常用']];
      const check = '<svg viewBox="0 0 24 24" class="icon"><path d="m5 12 5 5 9-10"/></svg>';
      function menuEl() {
        let menu = $('#script-format-menu');
        if (!menu) { document.body.insertAdjacentHTML('beforeend', '<div class="script-format-menu hidden" id="script-format-menu" role="menu" aria-label="剧本格式"></div>'); menu = $('#script-format-menu'); }
        return menu;
      }
      function closeMenu() {
        const menu = $('#script-format-menu'); if (!moodioMenuFx.isOpen(menu)) return;
        moodioMenuFx.close(menu, () => menu.classList.add('hidden'));
        $$('[data-script-format-menu][aria-expanded="true"]').forEach(b => b.setAttribute('aria-expanded', 'false'));
      }
      function openMenu(anchor) {
        const menu = menuEl();
        menu.innerHTML = FORMATS.map(([id, name, hint]) => `<button class="format-option ${state.scriptLayout === id ? 'active' : ''}" role="menuitemradio" aria-checked="${state.scriptLayout === id}" data-script-format="${id}">${name}<small>${hint}</small>${check}</button>`).join('');
        menu.classList.remove('hidden');
        const r = anchor.getBoundingClientRect(), w = menu.offsetWidth, h = menu.offsetHeight;
        menu.style.left = Math.max(8, Math.min(r.left, window.innerWidth - w - 8)) + 'px';
        menu.style.top = (r.bottom + 6 + h > window.innerHeight ? r.top - h - 6 : r.bottom + 6) + 'px';
        anchor.setAttribute('aria-expanded', 'true');
        moodioMenuFx.open(menu);
      }
      document.addEventListener('click', event => {
        const trigger = event.target.closest('[data-script-format-menu]');
        if (trigger) {
          event.preventDefault(); event.stopImmediatePropagation();
          const wasOpen = trigger.getAttribute('aria-expanded') === 'true';
          closeMenu();
          if (!wasOpen) openMenu(trigger);
          return;
        }
        const option = event.target.closest('[data-script-format]');
        if (option) {
          event.preventDefault(); event.stopImmediatePropagation();
          const next = option.dataset.scriptFormat;
          closeMenu();
          if (next !== state.scriptLayout) {
            captureVisibleEdits?.();
            state.scriptLayout = next;
            render();
            persistWorkspace?.();
            showToast(`剧本格式已切换为${next === 'chinese' ? '中式剧本' : '美式剧本'}`);
          }
          return;
        }
        if (!event.target.closest('#script-format-menu')) closeMenu();
      }, true);
      document.addEventListener('keydown', event => { if (event.key === 'Escape') closeMenu(); });
      document.addEventListener('scroll', () => closeMenu(), true);
      window.addEventListener('resize', closeMenu);
    })();

    /* ===== 空白页面 = 云文档编辑器：标题、富文本正文、字体/字号/样式工具、图片视频、划线评论 ===== */
