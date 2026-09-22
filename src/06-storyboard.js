    document.addEventListener('focusout', event => {
      if (event.target.matches('[data-production-cell]')) {
        const [type,,columnIndex] = event.target.dataset.productionCell.split(':');
        if (type === 'dailySchedule' && (Number(columnIndex) === 12 || Number(columnIndex) === 13)) { recalcDailySchedule(); render(); return; }
      }
      if (event.target.matches('[data-call-meta="generalCall"]')) { recalcDailySchedule(); render(); return; }
      const renameInput = event.target.closest('[data-rename-input]');
      if (renameInput && state.renamingFileId === renameInput.dataset.renameInput) renameFile(renameInput.dataset.renameInput, renameInput.value || findFile(renameInput.dataset.renameInput)?.title || '未命名文档');
    });

    document.addEventListener('change', event => {
      const cat = event.target.closest('[data-export-cat]');
      if (cat) { if (cat.checked) state.exportSelection.add(cat.dataset.exportCat); else state.exportSelection.delete(cat.dataset.exportCat); renderExportDialog(); return; }

      const fmt = event.target.closest('[data-export-format]');
      if (fmt) { state.exportFormat = fmt.value; renderExportDialog(); }
    });
    // 版本下拉键：点开才看到历史版本
    document.addEventListener('click', event => {
      const btn = event.target.closest('[data-export-version-menu]');
      if (btn) {
        event.preventDefault(); event.stopImmediatePropagation();
        const key = btn.dataset.exportVersionMenu; const cat = exportCategories().find(c => c.key === key); if (!cat) return;
        const pop = cdocPop('export-version-pop', 'cdoc-float-pop export-version-pop');
        if (!pop.classList.contains('hidden') && pop.dataset.key === key) return pop.classList.add('hidden');
        const latest = cat.files[cat.files.length - 1]; const pick = state.exportVersions[key] && cat.files.some(f => f.id === state.exportVersions[key]) ? state.exportVersions[key] : latest.id;
        pop.dataset.key = key;
        pop.innerHTML = cat.files.map((f, i) => `<button type="button" class="cdoc-bm-item ${f.id === pick ? 'active' : ''}" data-export-pick="${escapeHtml(key)}|${f.id}"><span>${f === latest ? '最新 · ' : ''}v${i + 1} · ${escapeHtml(displayFileTitle(f))}</span><small style="margin-left:auto;color:var(--ink-3)">${escapeHtml(f.updated || '')}</small></button>`).reverse().join('');
        pop.classList.remove('hidden'); cdocPlace(pop, btn.getBoundingClientRect(), 6); return;
      }
      const pick = event.target.closest('[data-export-pick]');
      if (pick) { event.preventDefault(); event.stopImmediatePropagation(); const [key, id] = pick.dataset.exportPick.split('|'); state.exportVersions[key] = id; state.exportSelection.add(key); $('#export-version-pop')?.classList.add('hidden'); renderExportDialog(); return; }
      if (!event.target.closest('#export-version-pop')) $('#export-version-pop')?.classList.add('hidden');
    }, true);

    document.addEventListener('focusin', event => {
      const block = scriptBlockFromEvent(event);
      if (block) requestAnimationFrame(() => positionCaretToolbar(block));
    });

    document.addEventListener('mouseup', event => {
      const block = scriptBlockFromEvent(event);
      if (block) requestAnimationFrame(() => positionCaretToolbar(block));
    });

    document.addEventListener('keyup', event => {
      const block = scriptBlockFromEvent(event);
      if (block) requestAnimationFrame(() => positionCaretToolbar(block));
    });

    // 双击剧本正文：唤出格式工具栏（无需先选中文字），选好格式后直接输入
    document.addEventListener('dblclick', event => {
      const block = event.target.closest?.('.script-paper .script-block') || (event.target.closest?.('[data-script-blocks]') ? scriptBlockFromSelection() : null);
      if (!block) return;
      state.selectedScriptId = block.dataset.scriptId; $$('.script-block.selected').forEach(b => b.classList.toggle('selected', b === block));
      requestAnimationFrame(() => positionCaretToolbar(block, true));
    });

    // 鼠标拖选过程中不弹格式框，松开鼠标后再出现
    let scriptMouseSelecting = false;
    document.addEventListener('pointerdown', event => { if (event.button === 0 && event.target.closest?.('.script-paper [data-script-blocks]')) { scriptMouseSelecting = true; hideCaretToolbar(); } }, true);
    document.addEventListener('pointerup', () => { if (!scriptMouseSelecting) return; scriptMouseSelecting = false; const block = scriptBlockFromSelection(); if (block) requestAnimationFrame(() => positionCaretToolbar(block)); }, true);
    document.addEventListener('selectionchange', () => {
      const selection = window.getSelection();
      const anchor = selection?.anchorNode?.nodeType === Node.TEXT_NODE ? selection.anchorNode.parentElement : selection?.anchorNode;
      const block = anchor?.closest?.('.script-paper .script-block');
      $$('.script-block.caret-here').forEach(b => { if (b !== block) b.classList.remove('caret-here'); });
      if (block) { block.classList.add('caret-here'); if (!scriptMouseSelecting) requestAnimationFrame(() => positionCaretToolbar(block)); }
      else hideCaretToolbar();
    });
    document.addEventListener('focusout', event => { if (event.target.closest?.('[data-script-blocks]')) setTimeout(() => { if (!document.activeElement?.closest?.('[data-script-blocks]')) $$('.script-block.caret-here').forEach(b => b.classList.remove('caret-here')); }, 0); });

    document.addEventListener('mousedown', event => {
      if (event.target.closest('.editor-ribbon button')) event.preventDefault();
    });

    document.addEventListener('contextmenu', event => {
      const storyEdge = event.target.closest('[data-story-edge-select]');
      if (state.workspaceMode === 'beatboard' && storyEdge) {
        event.preventDefault();
        state.selectedStoryEdge = storyEdge.dataset.storyEdgeSelect;
        state.selectedStoryCard = null;
        state.storyConnectFrom = null;
        state.storyTool = 'select';
        state.storyEdgeMenu = {
          clientX:Math.min(event.clientX,window.innerWidth - 190),
          clientY:Math.min(event.clientY,window.innerHeight - 250)
        };
        render();
        return;
      }
      const ideaSurface = event.target.closest('.idea-canvas-surface');
      if (state.workspaceMode === 'ideas' && ideaSurface && !event.target.closest('[data-idea-node]')) {
        event.preventDefault();
        const rect = ideaSurface.getBoundingClientRect();
        const zoom = state.ideaZoom || .72;
        state.ideaContextMenu = {
          x:Math.max(0,(event.clientX - rect.left) / zoom - 115),
          y:Math.max(0,(event.clientY - rect.top) / zoom - 70),
          clientX:Math.min(event.clientX,window.innerWidth - 190),
          clientY:Math.min(event.clientY,window.innerHeight - 90)
        };
        state.ideaTagMenu = null;
        render();
        return;
      }
      const row = event.target.closest('[data-file-id]');
      if (!row) return;
      event.preventDefault();
      state.contextFileId = row.dataset.fileId;
      const menu = $('#file-context-menu');
      menu.classList.remove('hidden');
      const width = 150;
      const height = 148;
      menu.style.left = `${Math.min(event.clientX, window.innerWidth - width - 10)}px`;
      menu.style.top = `${Math.min(event.clientY, window.innerHeight - height - 10)}px`;
      moodioMenuFx.open(menu);
    });

    document.addEventListener('dragstart', event => {
      const pageHandle = event.target.closest('[data-page-drag]');
      const page = pageHandle?.closest('.paper, .board-shell');
      if (pageHandle && page) {
        state.dragSource = 'page';
        state.suppressPageHandleClick = true;
        state.draggedFile = { fileId: page.dataset.pageFile, type: page.dataset.pageType, slot: page.dataset.pageSlot };
        page.classList.add('page-dragging');
        event.dataTransfer.effectAllowed = 'move';
        event.dataTransfer.setData('text/plain', page.dataset.pageFile);
        return;
      }
      const source = event.target.closest('[data-drag-file][draggable="true"]');
      if (!source || event.target.closest('[data-rename-input]')) return;
      const file = findFile(source.dataset.dragFile);
      if (!file) return;
      state.dragSource = 'stack';
      state.draggedFile = { fileId: file.id, type: file.type };
      source.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/plain', file.id);
    });

    document.addEventListener('dragenter', event => {
      if (state.dragSource === 'stack' && event.target.closest('#canvas-viewport')) $('#canvas-viewport').classList.add('stack-drag-active');
      if (state.dragSource === 'page' && event.target.closest('.paper-stack')) $('.paper-stack').classList.add('page-return-active');
    });

    document.addEventListener('dragover', event => {
      if (state.dragSource === 'stack' && event.target.closest('#canvas-viewport')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        const viewport = $('#canvas-viewport');
        const rect = viewport.getBoundingClientRect();
        const relativeX = (event.clientX - rect.left) / rect.width;
        state.dropSide = relativeX < .34 ? 'left' : relativeX > .66 ? 'right' : 'center';
        viewport.classList.add('stack-drag-active');
        $$('.drop-page-zone').forEach(zone => zone.classList.toggle('active', zone.dataset.dropZone === state.dropSide));
      }
      if (state.dragSource === 'page' && event.target.closest('.paper-stack')) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        $('.paper-stack').classList.add('page-return-active');
      }
    });

    document.addEventListener('drop', event => {
      if (state.dragSource === 'stack' && event.target.closest('#canvas-viewport')) {
        event.preventDefault();
        const fileId = event.dataTransfer.getData('text/plain') || state.draggedFile?.fileId;
        placeFileInWorkspace(fileId, state.dropSide);
        return;
      }
      if (state.dragSource === 'page' && event.target.closest('.paper-stack')) {
        event.preventDefault();
        returnPageToStack(state.draggedFile?.slot);
      }
    });

    // 对照视图：把稿纸手柄拖到另一侧槽位，两页左右互换（目标为空则直接移过去）
    function swapComparePages(fromSlot, toSlot) {
      if (state.view !== 'compare' || !fromSlot || !toSlot || fromSlot === toSlot) return clearStackDragState();
      const left = { doc: state.currentDoc, fileId: state.currentFileId };
      const right = { doc: state.compareDoc, fileId: state.compareFileId };
      const moved = activeFile(fromSlot);
      state.currentDoc = right.doc; state.currentFileId = right.fileId;
      state.compareDoc = left.doc; state.compareFileId = left.fileId;
      if (!state.currentDoc) {
        // 左页空了：把右页挪回左页，退回专注视图
        state.currentDoc = state.compareDoc; state.currentFileId = state.compareFileId;
        state.compareDoc = null; state.compareFileId = null;
        state.view = 'focus'; state.selectedPageSlot = 'left';
      } else {
        state.selectedPageSlot = toSlot;
      }
      clearStackDragState();
      render();
      const arrived = toSlot === 'left' ? $('#compare-script') : $('#compare-secondary');
      if (arrived && state.view === 'compare') { arrived.classList.add('drop-arrived'); setTimeout(() => arrived.classList.remove('drop-arrived'), 420); }
      showToast(moved ? `“${moved.title}”已移到${toSlot === 'left' ? '左页' : '右页'}，两页已互换` : '两页已互换');
    }
    const compareSlotOf = target => target.closest?.('.compare-layout .page-slot');
    document.addEventListener('dragover', event => {
      if (state.dragSource !== 'page') return;
      const slot = compareSlotOf(event.target);
      if (!slot) return;
      event.preventDefault();
      const isOther = slot.dataset.pageSlot !== state.draggedFile?.slot;
      event.dataTransfer.dropEffect = isOther ? 'move' : 'none';
      $$('.page-slot.page-swap-target').forEach(el => { if (el !== slot) el.classList.remove('page-swap-target'); });
      slot.classList.toggle('page-swap-target', isOther);
    });
    document.addEventListener('dragleave', event => {
      if (state.dragSource !== 'page') return;
      const slot = compareSlotOf(event.target);
      if (slot && !slot.contains(event.relatedTarget)) slot.classList.remove('page-swap-target');
    });
    document.addEventListener('drop', event => {
      if (state.dragSource !== 'page') return;
      const slot = compareSlotOf(event.target);
      if (!slot) return;
      event.preventDefault();
      swapComparePages(state.draggedFile?.slot, slot.dataset.pageSlot);
    });

    document.addEventListener('dragend', () => {
      clearStackDragState();
      setTimeout(() => { state.suppressPageHandleClick = false; }, 0);
    });
    $('#canvas-viewport').addEventListener('scroll', () => {
      closeAssetMenu();
      hideAssetCard();
      const block = state.activeScriptElement?.isConnected ? state.activeScriptElement : null;
      if (block && $('#caret-format-toolbar')?.classList.contains('visible')) positionCaretToolbar(block);
    }, { passive: true });
    document.addEventListener('scroll', event => {
      if (!event.target?.matches?.('.paper')) return;
      closeAssetMenu();
      hideAssetCard();
      const block = state.activeScriptElement?.isConnected ? state.activeScriptElement : null;
      if (block && $('#caret-format-toolbar')?.classList.contains('visible')) positionCaretToolbar(block);
    }, { passive: true, capture: true });
    window.addEventListener('resize', () => {
      closeAssetMenu();
      hideAssetCard();
      const block = state.activeScriptElement?.isConnected ? state.activeScriptElement : null;
      if (block && $('#caret-format-toolbar')?.classList.contains('visible')) positionCaretToolbar(block);
    });

    $('#import-text-button').addEventListener('click', () => openImportTargetDialog());
    // 图片加载异常时恢复文字入口，避免影响已有对话功能。
    (() => {
      const fab = $('#agent-fab'), image = $('#agent-mascot-image');
      const fallback = () => {
        if (!fab.classList.contains('agent-mascot')) return;
        image.closest('picture').remove(); fab.classList.remove('agent-mascot');
        window.dispatchEvent(new Event('resize'));
      };
      image.addEventListener('error', fallback, {once:true});
      if (image.complete && image.getAttribute('src') && !image.naturalWidth) fallback();
    })();
    // 浮动入口位置独立保存，不改变 Agent 对话或工作区数据。
    (() => {
      const fab = $('#agent-fab');
      const POSITION_KEY = 'moodio-agent-fab-position-v1';
      const GAP = 8, DRAG_THRESHOLD = 5;
      let position = null, drag = null, suppressClick = false;
      try {
        const saved = JSON.parse(localStorage.getItem(POSITION_KEY));
        if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) position = {x:saved.x,y:saved.y};
      } catch (_) {}
      const save = () => { if (position) try { localStorage.setItem(POSITION_KEY,JSON.stringify(position)); } catch (_) {} };
      function place(x,y) {
        const r = fab.getBoundingClientRect();
        // 隐藏或尚未完成布局时，等可见后再恢复，避免用零尺寸定位。
        if (!r.width || !r.height) return;
        const maxX = Math.max(0,window.innerWidth-r.width), maxY = Math.max(0,window.innerHeight-r.height);
        const marginX = Math.min(GAP,maxX/2), marginY = Math.min(GAP,maxY/2);
        position = {x:Math.min(maxX-marginX,Math.max(marginX,x)),y:Math.min(maxY-marginY,Math.max(marginY,y))};
        fab.style.left = position.x+'px'; fab.style.top = position.y+'px';
        fab.style.right = 'auto'; fab.style.bottom = 'auto';
      }
      function move(event) {
        if (!drag || event.pointerId !== drag.id) return;
        const dx = event.clientX-drag.x, dy = event.clientY-drag.y;
        if (!drag.moved && Math.hypot(dx,dy) < DRAG_THRESHOLD) return;
        drag.moved = true; suppressClick = true;
        fab.classList.add('dragging');
        place(drag.left+dx,drag.top+dy);
        if (event.cancelable) event.preventDefault();
      }
      function finish(event) {
        if (!drag || (event.pointerId != null && event.pointerId !== drag.id)) return;
        if (event.type === 'pointerup') move(event);
        const finished = drag; drag = null;
        fab.classList.remove('dragging');
        document.removeEventListener('pointermove',move,true);
        document.removeEventListener('pointerup',finish,true);
        document.removeEventListener('pointercancel',finish,true);
        window.removeEventListener('blur',finish);
        try { if (fab.hasPointerCapture?.(finished.id)) fab.releasePointerCapture(finished.id); } catch (_) {}
        if (finished.moved) save();
      }
      fab.addEventListener('pointerdown',event => {
        if (fab.inert || drag || event.button !== 0 || event.isPrimary === false) return;
        suppressClick = false;
        const r = fab.getBoundingClientRect();
        drag = {id:event.pointerId,x:event.clientX,y:event.clientY,left:r.left,top:r.top,moved:false};
        try { fab.setPointerCapture?.(event.pointerId); } catch (_) {}
        document.addEventListener('pointermove',move,{capture:true,passive:false});
        document.addEventListener('pointerup',finish,true);
        document.addEventListener('pointercancel',finish,true);
        window.addEventListener('blur',finish);
      });
      fab.addEventListener('lostpointercapture',finish);
      fab.addEventListener('moodio:agent-fab-hide',finish);
      fab.addEventListener('dragstart',event => event.preventDefault());
      fab.addEventListener('keydown',event => { if (event.key === 'Enter' || event.key === ' ') suppressClick = false; });
      // 捕获阶段拦截拖动产生的 click，不影响原有开关、聚焦与滚动到最新消息。
      fab.addEventListener('click',event => {
        if (fab.inert) { event.preventDefault(); event.stopImmediatePropagation(); return; }
        if (!suppressClick) return;
        suppressClick = false; event.preventDefault(); event.stopImmediatePropagation();
      },true);
      const restore = () => {
        if (drag) finish({type:'resize'});
        const r = fab.getBoundingClientRect();
        if (position) { place(position.x,position.y); save(); }
        else if (r.width && r.height && (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight)) place(r.left,r.top);
      };
      window.addEventListener('resize',restore);
      window.addEventListener('load',restore,{once:true});
      requestAnimationFrame(restore);
    })();
    // 显隐只以面板的 hidden 状态为准：按钮、识别流程、选中文字等入口统一联动。
    (() => {
      const panel = $('#agent-panel'), fab = $('#agent-fab');
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      const contents = [panel.querySelector('.agent-head'), panel.querySelector('.agent-body'), panel.querySelector('.agent-composer')].filter(Boolean);
      const surface = panel.querySelector('.agent-motion-surface');
      let previousOpen = null, motion = null;
      function stopAgentMotion() {
        const previous = motion; motion = null;
        previous?.animations.forEach(animation => animation.cancel());
      }
      function animateAgentVisibility(open) {
        // offset* 不受正在播放的 transform 影响；按钮隐藏时也保留原尺寸与位置。
        const anchor = fab.getBoundingClientRect();
        const width = panel.offsetWidth, height = panel.offsetHeight;
        if (reducedMotion.matches || typeof panel.animate !== 'function' || !surface ||
            ![anchor.left,anchor.top,anchor.width,anchor.height,width,height].every(Number.isFinite) ||
            anchor.width <= 0 || anchor.height <= 0 || width <= 0 || height <= 0) {
          stopAgentMotion(); return;
        }
        const sx = anchor.width / width, sy = anchor.height / height;
        const transform = `translate(${anchor.left-panel.offsetLeft}px, ${anchor.top-panel.offsetTop}px) scale(${sx}, ${sy})`;
        const radius = parseFloat(getComputedStyle(fab).borderTopLeftRadius) || 6;
        const continuing = motion && motion.main.playState !== 'finished' && motion.main.playState !== 'idle';
        const openRadius = continuing ? motion.openRadius : (getComputedStyle(panel).borderTopLeftRadius || '12px');
        const collapsed = {transform, opacity:0, borderRadius:`${radius/sx}px / ${radius/sy}px`};
        const expanded = {transform:'none', opacity:1, borderRadius:openRadius};
        // 快速反向操作从正在显示的那一帧继续，而不是重新跳回端点。
        const current = continuing ? getComputedStyle(panel) : null;
        const from = current ? {transform:current.transform, opacity:Number(current.opacity), borderRadius:current.borderRadius} : (open ? collapsed : expanded);
        const contentOpacity = contents.map(element => continuing ? Number(getComputedStyle(element).opacity) : (open ? 0 : 1));
        const surfaceOpacity = continuing ? Number(getComputedStyle(surface).opacity) : (open ? 1 : 0);
        stopAgentMotion();
        const target = open ? expanded : collapsed;
        const options = {duration:open ? 540 : 420, easing:open ? 'cubic-bezier(.22,1,.36,1)' : 'cubic-bezier(.4,0,.2,1)'};
        const run = {animations:[], main:null, openRadius};
        motion = run;
        const track = animation => { run.animations.push(animation); animation.finished.catch(() => {}); return animation; };
        try {
          run.main = track(panel.animate([
            {...from, visibility:'visible', offset:0},
            {opacity:open ? 1 : from.opacity, visibility:'visible', offset:open ? .35 : .78},
            {...target, visibility:'visible', offset:1}
          ], options));
          contents.forEach((element,index) => track(element.animate([
            {opacity:contentOpacity[index], offset:0},
            {opacity:open ? contentOpacity[index] : 0, offset:open ? .18 : .25},
            {opacity:open ? 1 : 0, offset:open ? .64 : 1},
            {opacity:open ? 1 : 0, offset:1}
          ], options)));
          track(surface.animate([
            {opacity:surfaceOpacity, offset:0},
            {opacity:open ? 0 : 1, offset:open ? .48 : .8},
            {opacity:open ? 0 : 1, offset:1}
          ], options));
          // 旧动画取消或完成都不能覆盖新一轮的显隐状态。
          Promise.all(run.animations.map(animation => animation.finished)).then(() => {
            if (motion === run) stopAgentMotion();
          }, () => { if (motion === run) stopAgentMotion(); });
        } catch (_) { stopAgentMotion(); }
      }
      function syncAgentVisibility() {
        const open = !panel.classList.contains('hidden');
        if (open === previousOpen) return;
        const initial = previousOpen === null;
        previousOpen = open;
        const focused = document.activeElement;
        const returnFocus = !open && panel.contains(focused);
        const focusComposer = open && focused === fab;
        if (open) fab.dispatchEvent(new Event('moodio:agent-fab-hide'));
        if (!initial) animateAgentVisibility(open);
        fab.classList.toggle('agent-panel-open',open);
        fab.setAttribute('aria-expanded',String(open));
        fab.inert = open;
        panel.inert = !open;
        if (focusComposer) $('#agent-input')?.focus({preventScroll:true});
        if (returnFocus) fab.focus({preventScroll:true});
        fab.setAttribute('aria-hidden',String(open));
        panel.setAttribute('aria-hidden',String(!open));
        if (!open) $('#agent-quick-pop')?.classList.add('hidden');
      }
      new MutationObserver(syncAgentVisibility).observe(panel,{attributes:true,attributeFilter:['class']});
      // 用户接管拖动/缩放时结束过渡，避免用变换后的矩形保存窗口尺寸。
      document.addEventListener('pointerdown',event => {
        if (event.button !== 0 || panel.classList.contains('hidden') || event.target.closest('button')) return;
        if (event.target.closest('#agent-panel [data-agent-drag], #agent-panel [data-agent-resize]')) stopAgentMotion();
      },true);
      window.addEventListener('resize',stopAgentMotion);
      reducedMotion.addEventListener?.('change',() => { if (reducedMotion.matches) stopAgentMotion(); });
      syncAgentVisibility();
    })();
    $('#agent-fab').addEventListener('click', () => $('#agent-panel').classList.toggle('hidden'));
    $('#agent-close').addEventListener('click', () => $('#agent-panel').classList.add('hidden'));
    document.addEventListener('click', event => {
      const button = event.target.closest('[data-toggle-storyboard]');
      if (!button) return;
      event.preventDefault();
      // 先说明接下来的流程，确认后再展开 Agent；不反转功能状态。
      requestAgentRecognition('shots',button.dataset.sourceFileId||button.closest('[data-page-file]')?.dataset.pageFile);
    });

    /* THESIS: Script passages become ordered shots and reusable 生成单元 canvases.
       OWN-WORLD: Extend Refined's neutral shell; reference-specified rounded shot cards.
       STORY: Write, select a passage, design shots, then combine a production unit.
       FIRST VIEWPORT: Left collapsible writing list, centered editor, no bottom writing tray.
       FORM: Existing app extension; supplied screenshots and 3.0 component code are authority. */
    const flowIcon = (kind) => `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${({plus:'<path d="M12 5v14M5 12h14"/>',grip:'<circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>',image:'<rect x="3" y="3" width="18" height="18" rx="4"/><circle cx="8" cy="8" r="1.5"/><path d="m4 18 5-5 4 3 7-8"/>',person:'<circle cx="12" cy="8" r="4"/><path d="M4 22a8 8 0 0 1 16 0"/>',close:'<path d="m6 6 12 12M18 6 6 18"/>',up:'<path d="m6 15 6-6 6 6"/>',down:'<path d="m6 9 6 6 6-6"/>',grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',link:'<path d="m9 15 6-6M8 17l-2 2a4 4 0 0 1-5-5l4-4a4 4 0 0 1 5 0M16 7l2-2a4 4 0 0 1 5 5l-4 4a4 4 0 0 1-5 0"/>',upload:'<path d="M12 16V3m-5 5 5-5 5 5M4 15v6h16v-6"/>'})[kind] || '<rect x="5" y="3" width="14" height="18" rx="1"/><path d="M8 8h8M8 12h8M8 16h5"/>'}</svg>`;
    const flowButton = (action,label,extra='',primary=false) => `<button class="canvas-action ${primary?'primary':''}" data-flow="${action}" ${extra}>${label}</button>`;
    state.chunks = restoredWorkspace?.chunks || [];
    // Migrate only generated default names; preserve custom names and stored IDs.
    state.chunks.forEach(unit=>{if(/^Chunk \d+$/.test(unit.title))unit.title=unit.title.replace(/^Chunk /,'生成单元 ');});
    state.writingOpen = false;
    state.assetRecognition = restoredWorkspace?.assetRecognition || {};
    state.projectPage = 'scripts'; state.assetFilter='all'; state.selectedChunk=state.chunks[0]?.id || null;
    if (restoredWorkspace?.catalog) Object.assign(assetCatalog,restoredWorkspace.catalog);
    const boardFile = state.fileStores.film.storyboard?.find(f=>f.id==='film-storyboard-list') || {id:'film-storyboard-list',type:'storyboard',title:'分镜表',updated:'刚刚',preview:'镜头按拍摄叙事顺序排列'};
    state.fileStores.film.storyboard=restoredWorkspace?.fileStores?.film?.storyboard || [boardFile];
    if(!state.fileStores.film.storyboard.some(f=>f.id===boardFile.id))state.fileStores.film.storyboard.unshift(boardFile);
    if(state.currentDoc==='storyboard'&&!findFile(state.currentFileId))state.currentFileId=boardFile.id;
    if(state.compareDoc==='storyboard'&&!findFile(state.compareFileId))state.compareFileId=boardFile.id;
    const originalRender=render, originalRenderWriting=renderWritingPanel, originalRenderStack=renderStack;
    const originalSelectFile=selectFile,originalCreateTemplate=createTemplate,originalExportMarkup=exportMarkupForFile;
    exportMarkupForFile=(file)=>file.type!=='storyboard'?originalExportMarkup(file):`<h1>分镜列表</h1><table style="border-collapse:collapse;width:100%" border="1" cellpadding="8"><thead><tr>${['镜号','场次','画面参考','画面内容','其他'].map(t=>`<th>${t}</th>`).join('')}</tr></thead><tbody>${state.shots.map((s,i)=>`<tr><td>${i+1}</td><td>${escapeHtml(s.scene||'')}</td><td>${s.reference?.data?.startsWith('data:image/')?`<img src="${s.reference.data}" width="160">`:escapeHtml(s.reference?.name||'')}</td><td>${escapeHtml(s.description)}</td><td>${escapeHtml(s.notes||'')}</td></tr>`).join('')}</tbody></table>`;
    const sourceBlocks=(fileId)=>{
      const file=findFile(fileId); if(!file)return [];
      const blocks=scriptBlocksOf(file);let n=0;
      return blocks.map(b=>{if(b.type==='scene')n++;return {id:b.id,format:b.type,scene:String(Math.max(1,n)).padStart(2,'0'),text:b.text};});
    };
    state.shots.forEach(shot=>{
      shot.sourceFileId ||= latestFile('script')?.id;
      shot.sourceText ??= sourceBlocks(shot.sourceFileId).find(b=>b.id===shot.sourceId)?.text || '';
      shot.sourceIds ||= shot.sourceId ? [shot.sourceId] : [];
      shot.scene ||= '02'; shot.duration ??= 5; shot.sound ||= '';shot.notes ||= '';
      shot.camera ||= {size:shot.tags?.['景别']?.[0] || '中景 (MS)',angle:shot.tags?.['摄影机角度']?.[0] || '平视',movement:shot.tags?.['镜头运动']?.[0] || '固定',lens:'35mm'};
    });
    const paperTray=$('.paper-stack');$('.writing-sidebar').insertBefore(paperTray,$('.sidebar-foot'));
    $('.stack-title-row').insertAdjacentHTML('beforeend',`<button class="tray-toggle" data-flow="toggle-writing" aria-label="收纳或上拉展开 My Writing" aria-expanded="${state.writingOpen}">${flowIcon('up')}</button>`);
    document.body.insertAdjacentHTML('beforeend','<section id="project-surface" class="hidden" aria-label="项目工作区"></section><dialog id="flow-dialog" class="flow-dialog"></dialog><input type="file" id="flow-media-input" accept="image/*,video/*,audio/*" hidden><input type="file" id="flow-asset-input" accept="image/*" hidden>');
    $$('.top-nav button').forEach((button,i)=>{button.dataset.flow=['page-scripts','page-assets','page-create'][i];button.removeAttribute('aria-disabled');});
    renderWritingPanel=()=>{
      originalRenderWriting();
      $('.script-workspaces')?.insertAdjacentHTML('beforeend',`<button class="script-workspace-button ${state.currentDoc==='storyboard'?'active':''}" data-flow="open-board">${flowIcon('grid')}<span><strong>分镜列表</strong><small>${state.shots.length} 个镜头 · ${state.chunks.length} 个 生成单元</small></span></button>`);
      const sections=$$('.writing-section',$('#writing-panel'));
      sections.filter(s=>['剧本概况','专业制作模板'].includes($('.writing-section-head > span',s)?.textContent.trim())).forEach(s=>s.remove());
    };
    renderStack=()=>{
      if(state.expandedStack==='storyboard')state.expandedStack=null;
      originalRenderStack();
      $('[data-stack-type="storyboard"]')?.closest('.stack-group')?.remove();
      paperTray.classList.toggle('folded',!state.writingOpen);
      $('.tray-toggle').setAttribute('aria-expanded',String(state.writingOpen));
      if(!state.expandedStack)$('#stack-title').textContent='My Writing';
      $('#stack-count').textContent=state.expandedStack?`${filesForType(state.expandedStack).length} 份`:`${allFiles().filter(f=>f.type!=='storyboard').length} 份`;
    };
    selectFile=(id)=>{if(findFile(id)?.type==='storyboard')return openBoard();state.projectPage='scripts';originalSelectFile(id);};
    createTemplate=(type)=>{if(type==='storyboard'){state.createMenuVisible=false;return openBoard();}state.projectPage='scripts';originalCreateTemplate(type);};
    const cameraChoices={size:['大远景 (EWS)','远景 (WS)','全景 (FS)','中景 (MS)','近景 (MCU)','特写 (CU)','大特写 (ECU)'],angle:['平视','低位仰拍','高位俯拍','俯视','荷兰角','POV'],movement:['固定','推拉','推镜','拉镜','横摇','俯仰','跟拍','手持','环绕'],lens:['14mm','18mm','24mm','35mm','50mm','85mm','100mm','135mm']};
    const cameraLabels={size:'景别',angle:'角度',movement:'运动',lens:'焦段'};
    const safeMedia=(media)=>typeof media==='string'&&/^data:(image\/(png|jpeg|webp|gif)|video\/(mp4|webm|quicktime)|audio\/[\w.+-]+);base64,/.test(media);
    function shotMedia(shot){const url=shot.reference?.data;if(!safeMedia(url))return `<div class="shot-media-placeholder">${flowIcon('image')}<span>暂无参考媒体</span></div>`;return url.startsWith('data:image/')?`<img src="${url}" alt="${escapeHtml(shot.reference.name)}">`:url.startsWith('data:video/')?`<video src="${url}" controls preload="metadata"></video>`:`<audio src="${url}" controls preload="metadata"></audio>`;}
    const shotLabel=shot=>`SHOT ${String(state.shots.filter(s=>(s.boardFileId||boardFile.id)===(shot.boardFileId||boardFile.id)).indexOf(shot)+1).padStart(2,'0')}`;
    function renderShotRecord(shot){
      const camera=state.shotTab[shot.id]==='camera',selected=state.selectedShots.has(shot.id);
      return `<article class="shot-record ${selected?'is-selected':''} ${state.recentShotId===shot.id?'is-new':''}" data-record="${shot.id}">
        <header class="shot-record-head"><button class="shot-grip" draggable="true" data-drag-shot="${shot.id}" aria-label="拖拽调整 ${shotLabel(shot)} 顺序">${flowIcon('grip')}</button><label class="shot-select"><input type="checkbox" data-shot-select="${shot.id}" ${selected?'checked':''} aria-label="选择 ${shotLabel(shot)}"><span class="shot-number">${shotLabel(shot)}</span></label><span class="shot-scene">SCENE ${escapeHtml(shot.scene)}</span><button class="source-link" data-flow="locate-shot" data-id="${shot.id}" ${!shot.sourceText?'disabled':''}>${flowIcon('link')} 定位剧本正文</button></header>
        <div class="shot-body-grid"><div><div class="shot-media">${shotMedia(shot)}<span class="shot-media-label">${shotLabel(shot)}</span><button class="shot-upload" data-flow="shot-upload" data-id="${shot.id}" aria-label="上传 ${shotLabel(shot)} 参考媒体">${flowIcon('upload')}</button></div>${shot.reference?`<small>${escapeHtml(shot.reference.name)}</small>`:''}</div><div>
        <div class="shot-tabs" role="tablist" aria-label="${shotLabel(shot)} 内容切换"><button role="tab" aria-selected="${!camera}" class="${!camera?'active':''}" data-flow="shot-description" data-id="${shot.id}"><i></i>分镜</button><button role="tab" aria-selected="${camera}" class="${camera?'active':''}" data-flow="shot-camera" data-id="${shot.id}"><i></i>镜头语言</button></div>
        ${camera?`<div class="shot-camera-grid">${Object.entries(cameraChoices).map(([key,choices])=>`<label>${cameraLabels[key]}<select data-shot-camera="${key}" data-id="${shot.id}" aria-label="${shotLabel(shot)} ${cameraLabels[key]}">${[...new Set([shot.camera[key],...choices])].map(v=>`<option ${v===shot.camera[key]?'selected':''}>${escapeHtml(v)}</option>`).join('')}</select></label>`).join('')}</div>`:`<div class="shot-tags"><span>${shotLabel(shot)}</span>${Object.values(shot.camera).map(v=>`<span>${escapeHtml(v)}</span>`).join('')}</div><textarea class="shot-text" data-shot-field="description" data-id="${shot.id}" aria-label="${shotLabel(shot)} 画面描述">${escapeHtml(shot.description)}</textarea>`}</div></div>
        <div class="shot-details"><label>时长 / 秒<input type="number" min="0" max="3600" step="0.5" data-shot-field="duration" data-id="${shot.id}" value="${shot.duration}"></label><label>声音 / 对白<textarea data-shot-field="sound" data-id="${shot.id}" rows="2">${escapeHtml(shot.sound)}</textarea></label><label>其他 / 制作备注<textarea data-shot-field="notes" data-id="${shot.id}" rows="2">${escapeHtml(shot.notes)}</textarea></label></div>
        <footer class="shot-bottom"><span class="chunk-badges">${state.chunks.filter(c=>c.shotIds.includes(shot.id)).map(c=>escapeHtml(c.title)).join(' · ')||'尚未编入 生成单元'}</span><button class="flow-icon-button" data-flow="shot-up" data-id="${shot.id}" aria-label="上移 ${shotLabel(shot)}" ${state.shots.indexOf(shot)===0?'disabled':''}>${flowIcon('up')}</button><button class="flow-icon-button" data-flow="shot-down" data-id="${shot.id}" aria-label="下移 ${shotLabel(shot)}" ${state.shots.indexOf(shot)===state.shots.length-1?'disabled':''}>${flowIcon('down')}</button>${flowButton('single-chunk','创建 生成单元',`data-id="${shot.id}"`)}</footer>
      </article>`;
    }
    renderStoryboard=()=>`<section class="board-shell" aria-label="分镜列表"><header class="board-head"><div><h1>分镜列表 <small style="font-size:12px;color:var(--tx2)">${state.shots.length} SHOTS</small></h1><p>每个镜头保留剧本来源，拖动手柄调整顺序。</p></div><div class="board-actions">${flowButton('script-selection','选取剧本创建')}${flowButton('agent-shots','Agent 拆分镜')}${flowButton('page-create','查看 生成单元')}</div></header><div class="board-selection"><label><input type="checkbox" data-select-all-shots ${state.selectedShots.size===state.shots.length&&state.shots.length?'checked':''} aria-label="全选镜头"> 全选</label><strong>已选 ${state.selectedShots.size} 个镜头</strong>${flowButton('combine-chunk','创建 生成单元',state.selectedShots.size?'':'disabled',true)}</div><div class="shot-list">${state.shots.map(renderShotRecord).join('')||`<div class="board-empty"><h2>从剧本的第一个画面开始</h2><p>选中正文创建分镜，或通过 Agent 导入拆分结果。</p>${flowButton('script-selection','打开剧本')}</div>`}</div></section>`;
    function openBoard(){captureVisibleEdits();state.projectPage='scripts';state.workspaceMode='document';state.currentDoc='storyboard';state.currentFileId=boardFile.id;state.view='focus';state.selectedPageSlot='left';state.createMenuVisible=false;render();}
    function selectProjectPage(page){captureVisibleEdits();state.projectPage=page;hideCaretToolbar();hideAssetCard();closeAssetMenu();render();}
    render=()=>{
      const home=state.projectPage==='home';   // 首页：点顶栏 logo 进入，页面本身就是放大的 Agent 对话框（入口在 src/18-home.js，面板行为在 src/11 的 agentHomeMode）
      $$('.top-nav button').forEach(b=>b.classList.toggle('active',b.dataset.flow==='page-'+state.projectPage));
      document.body.classList.toggle('home-page',home);   // 先切 body 类（浮动入口随之隐藏），再让面板进入 / 退出首页模式
      $('#home-surface')?.classList.toggle('hidden',!home);
      $('#project-surface').classList.toggle('hidden',state.projectPage==='scripts'||home);
      $('.workspace').style.visibility=state.projectPage==='scripts'?'visible':'hidden';
      $('#agent-fab').style.removeProperty('visibility');   // 入口显隐由面板状态统一控制
      if(typeof agentHomeMode==='function')agentHomeMode(home);
      if(home){if(typeof renderHomePage==='function')renderHomePage();persistWorkspace();return;}
      if(state.projectPage==='create'){renderCreatePage();persistWorkspace();return;}
      if(state.projectPage==='assets'){renderAssetsPage();persistWorkspace();return;}
      $('#project-surface').innerHTML='';
      originalRender();
      if(state.currentDoc==='storyboard'&&state.view==='focus')$('.view-dock').style.display='none';else $('.view-dock').style.display='';
    };
    function sourceSelection(){
      const sel=window.getSelection();if(!sel?.rangeCount||sel.isCollapsed)return null;
      const range=sel.getRangeAt(0),node=range.startContainer.nodeType===3?range.startContainer.parentElement:range.startContainer;
      const paper=node.closest('[data-paper]');if(!paper?.classList.contains('script-paper'))return null;
      const blocks=$$('[data-script-id]',paper).filter(b=>range.intersectsNode(b));
      if(!blocks.length)return null;
      return {sourceFileId:paper.dataset.pageFile,sourceId:blocks[0].dataset.scriptId,sourceIds:blocks.map(b=>b.dataset.scriptId),sourceText:sel.toString().trim(),scene:sourceBlocks(paper.dataset.pageFile).find(b=>b.id===blocks[0].dataset.scriptId)?.scene||'02'};
    }
    let savedShotSelection=null;
    document.addEventListener('selectionchange',()=>{const selection=sourceSelection();if(selection)savedShotSelection=selection;});
    function appendShot(source,description){
      const shot={id:Math.max(0,...state.shots.map(s=>s.id))+1,boardFileId:activeStoryboardId(),...source,description:description||source.sourceText,sourceLabel:'已选剧本正文',camera:{size:'中景 (MS)',angle:'平视',movement:'固定',lens:'35mm'},duration:5,sound:'',notes:'',tags:{},media:null};
      // 按剧本里的先后位置插入：找到同一分镜表里第一个"来源段落排在本段之后"的镜头，插在它前面；没有就追加到末尾
      const order=source.sourceFileId?sourceBlocks(source.sourceFileId).map(b=>b.id):[];
      const rank=s=>{const i=order.indexOf(s?.sourceId);return i<0?-1:i;};
      const mine=rank(shot);
      const next=mine<0?null:state.shots.find(s=>s.boardFileId===shot.boardFileId&&rank(s)>mine);
      if(next)state.shots.splice(state.shots.indexOf(next),0,shot);else state.shots.push(shot);
      return shot;
    }
    createShotFromSelection=()=>{
      captureVisibleEdits();const source=sourceSelection()||savedShotSelection;
      if(!source?.sourceText){showToast('请先用鼠标选中剧本正文');return;}
      const shot=appendShot(source);state.recentShotId=shot.id;state.projectPage='scripts';state.workspaceMode='document';state.currentDoc='script';state.currentFileId=source.sourceFileId;state.compareDoc='storyboard';state.compareFileId=shot.boardFileId;state.view='compare';state.selectedPageSlot='right';hideCaretToolbar();savedShotSelection=null;window.getSelection()?.removeAllRanges();render();
      requestAnimationFrame(()=>$(`[data-record="${shot.id}"]`)?.scrollIntoView({block:'center',behavior:'smooth'}));showToast(`${shotLabel(shot)} 已加入分镜列表，保留所选正文`);
    };
    function locateShot(shotId){const shot=state.shots.find(s=>s.id===shotId);if(!shot)return;captureVisibleEdits();state.projectPage='scripts';state.workspaceMode='document';state.currentDoc='script';state.currentFileId=shot.sourceFileId;state.compareDoc='storyboard';state.compareFileId=boardFile.id;state.view='compare';state.selectedPageSlot='left';state.locatedScriptId=shot.sourceId;render();requestAnimationFrame(()=>{const block=$(`#compare-script [data-script-id="${shot.sourceId}"]`);block?.scrollIntoView({block:'center',behavior:'smooth'});$(`[data-record="${shot.id}"]`)?.scrollIntoView({block:'center',behavior:'smooth'});});}
    function moveShot(id,targetIndex){const index=state.shots.findIndex(s=>s.id===id);if(index<0)return;const [shot]=state.shots.splice(index,1);state.shots.splice(Math.max(0,Math.min(targetIndex,state.shots.length)),0,shot);render();}
    function makeChunk(ids){
      const shots=state.shots.filter(s=>ids.includes(s.id));if(!shots.length)return;
      const chunk={id:'chunk-'+Date.now()+'-'+Math.random().toString(36).slice(2,6),title:`生成单元 ${String(state.chunks.length+1).padStart(2,'0')}`,shotIds:shots.map(s=>s.id),nodes:[]};
      // 画布只同步分镜节点（不再生成剧本来源节点），两列排布
      shots.forEach((shot,i)=>{chunk.nodes.push({id:'shot-'+shot.id,kind:'shot',shotId:shot.id,x:60+(i%2)*400,y:50+Math.floor(i/2)*300});});
      state.chunks.push(chunk);state.selectedChunk=chunk.id;state.selectedShots.clear();selectProjectPage('create');showToast(`已创建 ${chunk.title}，包含 ${shots.length} 个分镜及对应剧本节点`);
    }
    // 合并创建 生成单元 前的说明性确认弹窗
    let pendingChunkIds=[];
    function confirmCombineChunk(ids){
      const shots=state.shots.filter(s=>ids.includes(s.id));if(!shots.length){showToast('请先勾选要合并的分镜');return;}
      pendingChunkIds=shots.map(s=>s.id);
      const title=`生成单元 ${String(state.chunks.length+1).padStart(2,'0')}`;
      const list=shots.map(s=>`<li><strong>${shotLabel(s)}</strong><span>场 ${escapeHtml(s.scene)}</span><em>${escapeHtml((s.description||s.sourceText||'').replace(/\s+/g,' ').slice(0,42))}${(s.description||s.sourceText||'').length>42?'…':''}</em></li>`).join('');
      openFlowDialog('合并创建 生成单元',
        `<p>将把当前勾选的 <strong>${shots.length} 个分镜</strong> 合并为一个新的生成单元 <strong>${title}</strong>。</p>
         <ul class="chunk-confirm-list">${list}</ul>
         <div class="chunk-confirm-steps"><span>接下来会：</span><ol>
           <li>为每个分镜生成一个分镜节点（画面描述与分镜列表同步），节点上可一键定位剧本与分镜；</li>
           <li>跳转到「创作」页的生成单元画布，可拖动节点、重命名单元；</li>
           <li>分镜仍保留在分镜列表中，勾选状态会清空，同一分镜可重复编入其他单元。</li>
         </ol></div>`,
        flowButton('close-dialog','取消')+flowButton('confirm-combine-chunk',`确认创建（${shots.length} 个分镜）`,'',true));
    }
    // 单个分镜「创建 生成单元」：仅第一次点击时弹说明窗，之后直接创建
    const SINGLE_CHUNK_HINT_KEY='moodio-single-chunk-hint-seen';
    function singleChunkHintSeen(){try{return localStorage.getItem(SINGLE_CHUNK_HINT_KEY)==='1';}catch(e){return false;}}
    function markSingleChunkHintSeen(){try{localStorage.setItem(SINGLE_CHUNK_HINT_KEY,'1');}catch(e){}}
    function singleChunkWithHint(id){
      const shot=state.shots.find(s=>s.id===id);if(!shot)return;
      if(singleChunkHintSeen())return makeChunk([id]);
      pendingChunkIds=[id];
      const title=`生成单元 ${String(state.chunks.length+1).padStart(2,'0')}`;
      const excerpt=(shot.description||shot.sourceText||'').replace(/\s+/g,' ');
      openFlowDialog('创建 生成单元',
        `<p>将以 <strong>${shotLabel(shot)}</strong> 单独创建一个新的生成单元 <strong>${title}</strong>。</p>
         <ul class="chunk-confirm-list"><li><strong>${shotLabel(shot)}</strong><span>场 ${escapeHtml(shot.scene)}</span><em>${escapeHtml(excerpt.slice(0,42))}${excerpt.length>42?'…':''}</em></li></ul>
         <div class="chunk-confirm-steps"><span>接下来会：</span><ol>
           <li>为这个分镜生成一个分镜节点（画面描述与分镜列表同步），节点上可一键定位剧本与分镜；</li>
           <li>跳转到「创作」页的生成单元画布，可拖动节点、重命名单元；</li>
           <li>分镜仍保留在分镜列表中，之后也可以勾选多个分镜「合并创建」。</li>
         </ol></div>
         <p class="chunk-confirm-note">此说明仅在第一次创建时显示，之后点击会直接创建。</p>`,
        flowButton('close-dialog','取消')+flowButton('confirm-single-chunk','知道了，创建','',true));
    }
    function nodeText(node){const shot=state.shots.find(s=>s.id===node.shotId);return node.kind==='script'?shot?.sourceText||'来源段落暂不可用':shot?.description||'';}
    function chunkWorld(chunk){
      if(!chunk)return `<div class="board-empty"><h2>把分镜组织成一个生成单元</h2><p>从分镜列表选择一个或多个镜头，即可生成 生成单元 画布。</p>${flowButton('open-board','前往分镜列表','',true)}</div>`;
      const nodes=chunk.nodes.filter(n=>n.kind==='shot'||n.kind==='gen');   // 旧数据里的剧本节点不再显示
      const height=Math.max(660,...nodes.map(n=>n.y+320)),width=Math.max(1000,...nodes.map(n=>n.x+400));
      chunk.edges=chunk.edges||[];
      return `<div class="chunk-world" style="height:${height}px;width:${width}px"><svg class="chunk-edges" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><marker id="chunk-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9 z" fill="#8a8c88"/></marker><marker id="chunk-arrow-active" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M1 1 L9 5 L1 9 z" fill="#191917"/></marker></defs></svg>${nodes.map(node=>{if(node.kind==='gen')return genNodeHtml(node);const shot=state.shots.find(s=>s.id===node.shotId);return `<article class="chunk-node" data-node="${node.id}" style="left:${node.x}px;top:${node.y}px"><button type="button" class="node-port left" data-node-port="${node.id}" data-side="left" title="拖到其他节点建立连线" aria-label="从左侧连接其他节点">+</button><button type="button" class="node-port right" data-node-port="${node.id}" data-side="right" title="拖到其他节点建立连线" aria-label="从右侧连接其他节点">+</button><header class="node-head" data-node-grip="${node.id}">${flowIcon('grid')} ${shot?shotLabel(shot):'分镜'}<small>${shot?`场 ${escapeHtml(shot.scene)}`:''}</small></header><div class="node-copy" contenteditable="false" data-node-text="${node.shotId}" role="textbox" aria-label="分镜节点文本">${escapeHtml(nodeText(node))}</div><div class="node-actions"><button class="node-source" data-flow="node-edit" data-id="${node.shotId}">${flowIcon('document')} 编辑</button><button class="node-source" data-flow="locate-shot" data-id="${node.shotId}" ${shot?.sourceText?'':'disabled'}>${flowIcon('link')} 定位剧本</button><button class="node-source" data-flow="locate-shot-board" data-id="${node.shotId}">${flowIcon('grid')} 定位分镜</button></div></article>`;}).join('')}</div>`;
    }
    // 画布节点文本编辑：点「编辑」进入编辑；首次点击弹出同步说明
    const NODE_EDIT_HINT_KEY='moodio-node-edit-hint-seen';
    let pendingNodeEdit=null;
    function nodeEditBegin(copy){
      const node=copy.closest('.chunk-node');copy.contentEditable='true';copy.classList.add('editing');copy.focus();
      const r=document.createRange();r.selectNodeContents(copy);r.collapse(false);const sel=window.getSelection();sel.removeAllRanges();sel.addRange(r);
      const btn=node?.querySelector('[data-flow="node-edit"]');if(btn)btn.innerHTML=`${flowIcon('document')} 完成`;
    }
    function nodeEditEnd(copy){
      const node=copy.closest('.chunk-node');copy.contentEditable='false';copy.classList.remove('editing');
      const shot=state.shots.find(s=>s.id===Number(copy.dataset.nodeText));if(shot){shot.description=copy.innerText.replace(/\n+$/,'');persistWorkspace();}
      const btn=node?.querySelector('[data-flow="node-edit"]');if(btn)btn.innerHTML=`${flowIcon('document')} 编辑`;
    }
    function nodeEditStart(control,shotId){
      const copy=control.closest('.chunk-node')?.querySelector('.node-copy');if(!copy)return;
      if(copy.contentEditable==='true')return nodeEditEnd(copy);
      let seen=false;try{seen=localStorage.getItem(NODE_EDIT_HINT_KEY)==='1';}catch(e){}
      if(seen)return nodeEditBegin(copy);
      pendingNodeEdit=shotId;
      openFlowDialog('在画布上编辑分镜',`<p>你将直接修改这个分镜节点的画面描述。</p><div class="chunk-confirm-steps"><span>请注意：</span><ol><li>这里的修改会<strong>实时同步到「剧本」板块分镜表里对应镜头</strong>的画面内容，两处始终保持一致；</li><li>点「完成」或点击节点外部即保存；用「定位分镜」可以随时回到分镜表核对。</li></ol></div><p class="chunk-confirm-note">此说明仅在第一次编辑时显示。</p>`,flowButton('close-dialog','取消')+flowButton('confirm-node-edit','知道了，开始编辑','',true));
    }
    document.addEventListener('dblclick',event=>{const copy=event.target.closest?.('.chunk-node .node-copy');if(!copy||copy.contentEditable==='true')return;event.preventDefault();const btn=copy.closest('.chunk-node')?.querySelector('[data-flow="node-edit"]');if(btn)nodeEditStart(btn,Number(copy.dataset.nodeText));});
    document.addEventListener('focusout',event=>{const copy=event.target.closest?.('.chunk-node .node-copy[contenteditable="true"]');if(!copy)return;setTimeout(()=>{if(document.activeElement!==copy&&copy.isConnected&&copy.contentEditable==='true')nodeEditEnd(copy);},0);});
    document.addEventListener('keydown',event=>{const copy=event.target.closest?.('.chunk-node .node-copy[contenteditable="true"]');if(!copy)return;if(event.key==='Escape'){event.preventDefault();copy.blur();}});
    // 底部生成单元卡片：双击重命名（顶部标题栏已移除）
    document.addEventListener('dblclick',event=>{const card=event.target.closest?.('[data-flow="select-chunk"]');if(!card)return;event.preventDefault();state.selectedChunk=card.dataset.chunk;const c=state.chunks.find(c=>c.id===state.selectedChunk);if(!c)return;openFlowDialog('重命名 生成单元',`<label>名称<input id="chunk-name" value="${escapeHtml(c.title)}" maxlength="60"></label>`,flowButton('close-dialog','取消')+flowButton('save-chunk-name','保存','',true));setTimeout(()=>$('#chunk-name')?.select(),30);});
    // ---- 生成节点：从 + 拖到空白处创建；选中后展开创作框 ----
