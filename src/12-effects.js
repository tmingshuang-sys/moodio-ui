    document.addEventListener('pointerdown', event => {
      const row = event.target.closest('[data-record]');
      if (!row || state.recentShotId === null) return;
      if (Number(row.dataset.record) !== state.recentShotId) return;
      state.recentShotId = null;
      $$('.shot-record.is-new').forEach(el => el.classList.remove('is-new'));
    }, true);

    // Local appearance preference: never rerender, edit manuscript data or call a service while choosing colors.
    (() => {
      const KEY = 'moodio-workspace-background-v1', DEFAULT = '#F7F7F7';
      const viewport = $('#canvas-viewport'), control = $('.workspace-bg-control'), dock = $('.view-dock');
      const trigger = $('#workspace-bg-trigger'), panel = $('#workspace-bg-panel');
      const color = $('#workspace-bg-color'), hex = $('#workspace-bg-hex');
      const error = $('#workspace-bg-error'), status = $('#workspace-bg-status');
      if (!trigger || !panel) { try { localStorage.removeItem(KEY); } catch (_) {} return; }   // 背景设置功能已移除
      let current = DEFAULT;
      function normalize(value) {
        const text = String(value || '').trim().replace(/^#/, '');
        if (/^[0-9a-f]{6}$/i.test(text)) return '#' + text.toUpperCase();
        if (/^[0-9a-f]{3}$/i.test(text)) return '#' + [...text].map(char => char + char).join('').toUpperCase();
        return null;
      }
      function clearError() { hex.setAttribute('aria-invalid', 'false'); error.textContent = ''; }
      function apply(value, { persist = true, keepDraft = false } = {}) {
        const next = normalize(value); if (!next) return false;
        current = next;
        if (next === DEFAULT) viewport.style.removeProperty('--workspace-background');
        else viewport.style.setProperty('--workspace-background', next);
        color.value = next.toLowerCase();
        if (!keepDraft) hex.value = next;
        $$('[data-workspace-bg]', panel).forEach(button => button.setAttribute('aria-pressed', String(button.dataset.workspaceBg === next)));
        clearError();
        if (persist) {
          try {
            if (next === DEFAULT) localStorage.removeItem(KEY); else localStorage.setItem(KEY, next);
            status.textContent = next === DEFAULT ? '已恢复默认背景。' : '背景偏好已保存到本机。';
          } catch (_) { status.textContent = '已预览；浏览器未允许保存，本次页面内仍可使用。'; }
        }
        return true;
      }
      function close(restoreFocus = false) {
        panel.hidden = true; trigger.setAttribute('aria-expanded', 'false');
        hex.value = current; clearError();
        if (restoreFocus) trigger.focus({ preventScroll: true });
      }
      function commitHex() {
        if (apply(hex.value)) return true;
        hex.setAttribute('aria-invalid', 'true'); error.textContent = '请输入有效色值，例如 #F7F7F7 或 #FFF。';
        return false;
      }
      try {
        const saved = normalize(localStorage.getItem(KEY));
        // 只迁移旧版默认暖白，保留用户自选色以及其余本地数据。
        apply(saved === '#FBFAF8' ? DEFAULT : saved || DEFAULT, { persist: false });
        if (saved === '#FBFAF8') { try { localStorage.removeItem(KEY); } catch (_) {} }
      }
      catch (_) { apply(DEFAULT, { persist: false }); }
      trigger.addEventListener('click', () => {
        if (!panel.hidden) return close();
        panel.hidden = false; trigger.setAttribute('aria-expanded', 'true');
        hex.value = current; clearError(); hex.focus({ preventScroll: true }); hex.select();
      });
      $('#workspace-bg-close').addEventListener('click', () => close(true));
      $('#workspace-bg-reset').addEventListener('click', () => apply(DEFAULT));
      $$('[data-workspace-bg]', panel).forEach(button => button.addEventListener('click', () => apply(button.dataset.workspaceBg)));
      color.addEventListener('input', () => apply(color.value));
      color.addEventListener('change', () => apply(color.value));
      hex.addEventListener('input', () => { clearError(); if (normalize(hex.value)) apply(hex.value, { keepDraft: true }); });
      hex.addEventListener('change', commitHex);
      panel.addEventListener('keydown', event => {
        if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close(true); }
        if (event.key === 'Enter' && event.target === hex) { event.preventDefault(); event.stopPropagation(); commitHex(); }
      });
      // Window capture precedes sidebar handlers that stop document-level click propagation.
      ['pointerdown', 'click', 'focusin'].forEach(type => window.addEventListener(type, event => {
        if (!panel.hidden && !control.contains(event.target)) close();
      }, true));
      new MutationObserver(() => { if (dock.style.display === 'none' || dock.classList.contains('hidden')) close(); })
        .observe(dock, { attributes: true, attributeFilter: ['style', 'class'] });
    })();

    // 渐变光标：在 contenteditable 编辑区内替代原生光标（原生光标不支持渐变色）
    (() => {
      const caret = document.createElement('div');
      caret.id = 'gradient-caret'; caret.hidden = true; caret.setAttribute('aria-hidden', 'true');
      document.body.appendChild(caret);
      let frame = 0, owner = null, lastGeometry = '', composing = false;
      const editableRoot = () => {
        const el = document.activeElement;
        if (!(el instanceof HTMLElement)) return null;
        return el.closest('[contenteditable="true"]');
      };
      function hide() {
        if (!caret.hidden) caret.hidden = true;
        if (owner) { owner.classList.remove('has-gradient-caret'); owner = null; }
        lastGeometry = '';
      }
      function caretRect(range) {
        const rects = range.getClientRects();
        if (rects.length && (rects[0].height || rects[0].width)) { const r = rects[0]; return { left: r.left, top: r.top, height: r.height }; }
        // 空行 / 只有 <br> 的块：按元素位置和对齐方式推算
        let node = range.startContainer;
        const el = node.nodeType === 1 ? node : node.parentElement; if (!el) return null;
        if (node.nodeType === 1 && range.startOffset > 0) {
          const prev = node.childNodes[range.startOffset - 1];
          if (prev && prev.nodeType === 1 && prev.nodeName !== 'BR') { const pr = prev.getBoundingClientRect(); if (pr.height) return { left: pr.right, top: pr.top, height: pr.height }; }
        }
        const cr = el.getBoundingClientRect(), cs = getComputedStyle(el);
        const lh = parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.5;
        let left = cr.left + parseFloat(cs.paddingLeft);
        if (cs.textAlign === 'center') left = cr.left + cr.width / 2; else if (cs.textAlign === 'right' || cs.textAlign === 'end') left = cr.right - parseFloat(cs.paddingRight);
        return { left, top: cr.top + parseFloat(cs.paddingTop), height: lh };
      }
      function paint() {
        frame = 0;
        const root = editableRoot(), sel = window.getSelection();
        if (!root || composing || document.hidden || !sel || !sel.rangeCount || !sel.isCollapsed) { hide(); return; }
        const range = sel.getRangeAt(0);
        if (!root.contains(range.startContainer)) { hide(); return; }
        const rect = caretRect(range);
        if (!rect || !rect.height) { hide(); return; }
        // 滚动容器外不显示
        for (let parent = root; parent && parent !== document.body; parent = parent.parentElement) {
          const st = getComputedStyle(parent);
          if (/(auto|scroll|hidden|clip)/.test(st.overflow + st.overflowX + st.overflowY)) {
            const pr = parent.getBoundingClientRect();
            if (rect.top + rect.height < pr.top || rect.top > pr.bottom || rect.left < pr.left - 2 || rect.left > pr.right + 2) { hide(); return; }
          }
        }
        if (owner !== root) { if (owner) owner.classList.remove('has-gradient-caret'); owner = root; root.classList.add('has-gradient-caret'); }
        const geometry = [Math.round(rect.left), Math.round(rect.top), Math.round(rect.height)].join('|');
        if (geometry !== lastGeometry) {
          caret.style.left = Math.round(rect.left) + 'px'; caret.style.top = Math.round(rect.top) + 'px'; caret.style.height = Math.round(rect.height) + 'px';
          caret.style.animation = 'none'; void caret.offsetWidth; caret.style.animation = '';   // 位置变化时重置闪烁，输入过程中保持常亮
          lastGeometry = geometry;
        }
        caret.hidden = false;
        frame = requestAnimationFrame(paint);
      }
      const refresh = () => { if (!frame) frame = requestAnimationFrame(paint); };
      document.addEventListener('selectionchange', refresh);
      ['focusin', 'input', 'keydown', 'pointerup'].forEach(type => window.addEventListener(type, refresh, true));
      window.addEventListener('scroll', refresh, true);
      window.addEventListener('resize', refresh);
      window.addEventListener('focusout', () => { cancelAnimationFrame(frame); frame = 0; hide(); }, true);
      window.addEventListener('blur', () => { cancelAnimationFrame(frame); frame = 0; hide(); });
      window.addEventListener('compositionstart', () => { composing = true; hide(); }, true);
      window.addEventListener('compositionend', () => { composing = false; refresh(); }, true);
      document.addEventListener('visibilitychange', () => { if (document.hidden) hide(); else refresh(); });
    })();

    // One non-interactive focus ring for inputs and keyboard controls, outside saved content.
    (() => {
      const maskSupported = CSS.supports?.('mask-composite', 'exclude') || CSS.supports?.('-webkit-mask-composite', 'xor');
      if (!maskSupported) return; // Keep the visible, solid-blue CSS fallback.
      const ring = document.createElement('div');
      ring.id = 'gradient-focus-ring'; ring.hidden = true; ring.setAttribute('aria-hidden', 'true');
      const topLayer = typeof ring.showPopover === 'function';
      if (topLayer) ring.setAttribute('popover', 'manual');
      document.body.appendChild(ring);
      const contrast = matchMedia('(forced-colors: active)');
      let frame = 0, lastGeometry = '', owner = null, clips = [];
      function clear() {
        ring.hidden = true; document.documentElement.removeAttribute('data-gradient-focus-active');
        if (topLayer && ring.matches(':popover-open')) ring.hidePopover();
        owner = null; clips = []; lastGeometry = '';
      }
      function focusTarget() {
        const el = document.activeElement;
        if (!(el instanceof HTMLElement) || el.closest('[hidden], .hidden, [inert]') || el.matches(':disabled')) return null;
        if (el.closest('.agent-composer')) return null;   // Agent 输入区不画渐变光圈
        if (el.matches('input:not([type="hidden"]):not([type="checkbox"]):not([type="radio"]), textarea, select')) return el.closest('.gen-prompt') || el;
        if (el.matches('[contenteditable="true"]') && !el.matches('.script-blocks, .script-block, .cdoc-body, figcaption, .idea-node-copy, .sh-title, .cv-note-text, .mm-text, .node-copy')) return el;
        if (el.matches('button, summary, input[type="checkbox"], input[type="radio"], [role="button"], .sheet-wrap, .mm-viewport') && el.matches(':focus-visible') && !el.matches('.writing-divider')) return el.querySelector('.fan-label') || el;
        return null;
      }
      function paint() {
        frame = 0;
        const target = focusTarget();
        if (!target || document.hidden || contrast.matches || (!topLayer && target.closest('dialog[open]'))) { clear(); return; }
        const changed = owner !== target;
        if (changed) {
          clear(); owner = target;
          for (let parent = target.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
            const style = getComputedStyle(parent);
            if (/(auto|scroll|hidden|clip)/.test(style.overflow + style.overflowX + style.overflowY)) clips.push(parent);
          }
        }
        const r = target.getBoundingClientRect();
        if (!r.width || !r.height || getComputedStyle(target).visibility === 'hidden') { clear(); return; }
        let left = 0, top = 0, right = innerWidth, bottom = innerHeight;
        for (const parent of clips) {
          const p = parent.getBoundingClientRect();
          left = Math.max(left, p.left); top = Math.max(top, p.top); right = Math.min(right, p.right); bottom = Math.min(bottom, p.bottom);
        }
        const margin = 3, x = r.left - margin, y = r.top - margin, width = r.width + margin * 2, height = r.height + margin * 2;
        if (r.right <= left || r.left >= right || r.bottom <= top || r.top >= bottom) { clear(); return; }
        const style = getComputedStyle(target);
        const radius = ['borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomRightRadius', 'borderBottomLeftRadius'].map(key => {
          const value = style[key] || style.borderRadius || '0'; return value.includes('%') ? value : (parseFloat(value) || 0) + margin + 'px';
        }).join(' ');
        const geometry = [x, y, width, height, radius, left, top, right, bottom].join('|');
        if (geometry !== lastGeometry) {
          Object.assign(ring.style, {left:x+'px', top:y+'px', width:width+'px', height:height+'px', borderRadius:radius,
            clipPath:`inset(${Math.max(0, top-y)}px ${Math.max(0, x+width-right)}px ${Math.max(0, y+height-bottom)}px ${Math.max(0, left-x)}px)`});
          lastGeometry = geometry;
        }
        ring.hidden = false;
        if (topLayer && !ring.matches(':popover-open')) {
          try { ring.showPopover(); } catch (_) { clear(); return; }
        }
        if (!document.documentElement.hasAttribute('data-gradient-focus-active')) document.documentElement.setAttribute('data-gradient-focus-active', '');
        frame = requestAnimationFrame(paint); // Also follows panel transforms and layout transitions.
      }
      function refresh() { if (!frame) frame = requestAnimationFrame(paint); }
      function stop() { cancelAnimationFrame(frame); frame = 0; clear(); }
      window.addEventListener('focusin', refresh, true);
      window.addEventListener('focusout', stop, true);
      window.addEventListener('pointerdown', refresh, true);
      window.addEventListener('keydown', refresh, true);
      window.addEventListener('scroll', refresh, true);
      window.addEventListener('resize', refresh);
      window.addEventListener('blur', stop);
      window.addEventListener('focus', refresh);
      document.addEventListener('visibilitychange', () => document.hidden ? stop() : refresh());
      contrast.addEventListener?.('change', refresh);
      refresh();
    })();

    // Local, opt-out guidance only: no model calls, generated answers or manuscript mutations.
    const agentHintController = (() => {
      const KEY = 'moodio-agent-proactive-hints-v1', SESSION_KEY = 'moodio-agent-hint-session-v1';
      // 约 10 秒一轮：显示 SHOW_MS 后自动收起，REPEAT_GAP 后弹下一条；COOLDOWN 兜底避免更密
      const DELAY = 4000, COOLDOWN = 9000, SESSION_DURATION = 30 * 60 * 1000, MAX_HINTS = Infinity, SHOW_MS = 7000, REPEAT_GAP = 3000;
      const fab = $('#agent-fab'), panel = $('#agent-panel'), bubble = $('#agent-hint');
      const text = $('#agent-hint-text'), action = $('#agent-hint-action');
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
      let enabled = true, focusedWindow = true, hovered = false, active = null;
      let pendingTimer = null, hideTimer = null, autoTimer = null, session;
      const freshSession = () => ({startedAt:Date.now(), lastShownAt:0, count:0, seen:[]});
      try { enabled = localStorage.getItem(KEY) !== '0'; } catch (_) {}
      try { session = JSON.parse(sessionStorage.getItem(SESSION_KEY)); } catch (_) {}
      if (!session || !Number.isFinite(session.startedAt) || !Number.isFinite(session.lastShownAt) || !Number.isInteger(session.count) || session.count < 0 || !Array.isArray(session.seen) || Date.now() - session.startedAt > SESSION_DURATION) session = freshSession();
      session.seen = session.seen.filter(key => typeof key === 'string').slice(-32);
      const saveSession = () => { try { sessionStorage.setItem(SESSION_KEY, JSON.stringify(session)); } catch (_) {} };
      const clearPending = () => { clearTimeout(pendingTimer); pendingTimer = null; };
      const clamp = (n, min, max) => Math.max(min, Math.min(Math.max(min, max), n));
      function candidate() {
        const page = state.projectPage || 'scripts';
        const file = activeFile(state.view === 'compare' ? state.selectedPageSlot : 'left');
        const prefix = `${state.activeEpisodeId || state.mode}:${page}:${file?.id || ''}:`;
        const tip = (kind, message, label, prompt, target = null) => ({key:prefix + kind, message, label, prompt, target});
        if (page === 'assets') return tip('assets', '角色、场景和道具，可以一起梳理。需要我帮你检查有没有遗漏吗？', '帮我梳理', '请帮我梳理当前剧本中的角色、场景和道具，先给出建议，不要直接创建资产。');
        if (page === 'create') return tip('create', '把镜头的画面、运动和氛围说清楚，创作会更有方向。', '完善画面描述', '请帮我完善当前生成单元的画面描述，先给出可供确认的建议。');
        if (page !== 'scripts' || state.workspaceMode !== 'document' || !file) return null;
        const scope = state.view === 'compare' ? (state.selectedPageSlot === 'right' ? $('#compare-secondary') : $('#compare-script')) : $('#focus-layout');
        if (!scope) return null;
        if (file.type === 'script') {
          const root = $('[data-script-blocks]', scope);
          if (!root) return null; // Cover pages and non-script views are not empty screenplay editors.
          const content = root.textContent.trim();
          if (!scriptHasText(content)) return tip('script-start', '还在寻找开场的灵感？给我一个人物或一个念头，我们一起把故事写下去。', '一起构思', '我想从零构思这个剧本，请先问我故事类型、主角和核心冲突，再一起设计第一场戏。');
          const target = $('[data-toggle-storyboard]', scope);
          if (content.length >= 80 && target && !target.disabled) return tip('script-shots', '这段剧本已经有画面了。可以先拆成镜头，再逐项检查和调整。', '看看怎么拆分', '', target);
          return null;
        }
        if (file.type === 'storyboard') {
          const selected = $$('[data-shot-select]:checked', scope).length;
          const target = $('[data-flow="combine-chunk"]', scope);
          if (selected >= 2 && target && !target.disabled) return tip('board-combine', `选中了 ${selected} 个镜头。可以把它们放进同一个生成单元，一起组织画面。`, '合并创建', '', target);
          if (!$('[data-record]', scope)) return tip('board-empty', '先从剧本选中一段文字，就能建立第一个分镜；也可以让我帮你规划。', '一起规划分镜', '请根据当前剧本帮我规划分镜，先给出建议，等我确认后再创建。');
          return null;
        }
        if (['synopsis', 'outline', 'custom'].includes(file.type) && (!file.kind || file.kind === 'doc')) {
          const root = $('[data-cdoc-body]', scope);
          if (root && !scriptHasText(root.textContent)) return tip('document-start', '不用一次写完整。先搭一个简单框架，再慢慢填进你的想法。', '帮我搭框架', '请根据当前文档的用途，帮我构思一个简洁的内容框架，先给出建议，不直接写入。');
        }
        return null;
      }
      function blocked() {
        const focused = document.activeElement;
        return !enabled || !focusedWindow || document.hidden || !panel.classList.contains('hidden') || fab.inert || fab.classList.contains('dragging') ||
          !!focused?.closest('input:not([type="checkbox"]):not([type="radio"]):not([type="button"]):not([type="submit"]), textarea, select, [contenteditable="true"]') ||
          !!$('dialog[open], .export-dialog-backdrop:not(.hidden), #agent-live:not(.hidden), #workspace-bg-panel:not([hidden]), #asset-detail:not(.hidden)') ||
          !!window.getSelection()?.toString().trim();
      }
      function position() {
        const r = fab.getBoundingClientRect(), width = bubble.offsetWidth, height = bubble.offsetHeight;
        if (!r.width || !r.height || !width || !height || innerWidth < width + 24 || innerHeight < height + 24) return false;
        const cx = r.left + r.width / 2, cy = r.top + r.height / 2, gap = 12, margin = 12;
        let left = clamp(cx - width / 2, margin, innerWidth - width - margin), top, side;
        if (r.top - height - gap >= margin) { top = r.top - height - gap; side = 'bottom'; }
        else if (r.bottom + height + gap <= innerHeight - margin) { top = r.bottom + gap; side = 'top'; }
        else if (r.left - width - gap >= margin) { left = r.left - width - gap; top = clamp(cy - height / 2, margin, innerHeight - height - margin); side = 'right'; }
        else if (r.right + width + gap <= innerWidth - margin) { left = r.right + gap; top = clamp(cy - height / 2, margin, innerHeight - height - margin); side = 'left'; }
        else return false;
        bubble.style.left = left + 'px'; bubble.style.top = top + 'px'; bubble.dataset.side = side;
        bubble.style.setProperty('--hint-arrow-x', clamp(cx - left - 5, 14, width - 24) + 'px');
        bubble.style.setProperty('--hint-arrow-y', clamp(cy - top - 5, 14, height - 24) + 'px');
        return true;
      }
      function dismiss(restoreFocus = false) {
        clearTimeout(autoTimer); clearTimeout(hideTimer); active = null; hovered = false;
        bubble.classList.remove('is-visible'); bubble.inert = true;
        if (restoreFocus && bubble.contains(document.activeElement)) fab.focus({preventScroll:true});
        const finish = () => { bubble.hidden = true; text.textContent = ''; };
        if (reducedMotion.matches || bubble.hidden) finish(); else hideTimer = setTimeout(finish, 180);
      }
      function armAutoHide() {
        clearTimeout(autoTimer);
        if (active && !hovered && !bubble.contains(document.activeElement)) autoTimer = setTimeout(() => { dismiss(); schedule(REPEAT_GAP); }, SHOW_MS);
      }
      function schedule(delay = DELAY) {
        clearPending();
        if (!enabled || active) return;
        pendingTimer = setTimeout(() => {
          pendingTimer = null;
          if (blocked()) { schedule(COOLDOWN); return; }   // 正在输入或有弹窗时稍后再试
          if (Date.now() - session.startedAt > SESSION_DURATION) session = freshSession();
          const next = candidate();
          if (!next) { schedule(COOLDOWN); return; }
          if (session.count >= MAX_HINTS || (session.count && Date.now() - session.lastShownAt < COOLDOWN)) { schedule(COOLDOWN); return; }
          clearTimeout(hideTimer); text.textContent = next.message; action.textContent = next.label;
          action.setAttribute('aria-description', next.target ? '打开此操作的确认窗口' : '打开 Agent 并填入问题，由你确认发送');
          bubble.hidden = false;
          if (!position()) { bubble.hidden = true; text.textContent = ''; return; }
          active = next; bubble.inert = false;
          requestAnimationFrame(() => { if (active === next) bubble.classList.add('is-visible'); });
          session.count++; session.lastShownAt = Date.now(); session.seen = session.seen.slice(-31); session.seen.push(next.key); saveSession(); armAutoHide();
        }, delay);
      }
      function settingDescription() { return enabled ? '每隔约 10 秒给出与你操作相关的建议' : '已关闭，不再弹出提示气泡'; }
      function settingsMarkup() {
        return `<button type="button" class="cdoc-bm-item agent-hint-setting" data-agent-hints-toggle role="switch" aria-label="Agent 主动提示" aria-checked="${enabled}" data-no-tip><span>主动提示<small>${settingDescription()}</small></span><span class="agent-hint-switch" aria-hidden="true"></span></button>`;
      }
      function setEnabled(value, persist = true) {
        enabled = value; clearPending(); if (!enabled) dismiss(true);
        let saved = true;
        if (persist) try { localStorage.setItem(KEY, enabled ? '1' : '0'); } catch (_) { saved = false; }
        $$('[data-agent-hints-toggle]').forEach(button => {
          button.setAttribute('aria-checked', String(enabled));
          $('small', button).textContent = saved ? settingDescription() : '已在本页生效；浏览器未允许保存设置';
        });
        if (enabled) schedule();
        return saved;
      }
      $('#agent-hint-close').addEventListener('click', () => dismiss(true));
      $('#agent-hint-disable').addEventListener('click', () => {
        const saved = setEnabled(false);
        showToast(saved ? '已关闭主动提示，可在 Agent 的快捷菜单中重新开启。' : '本页已关闭主动提示；浏览器未允许保存设置。');
      });
      action.addEventListener('click', () => {
        const next = candidate(), chosen = active;
        if (!chosen || next?.key !== chosen.key || next.message !== chosen.message) { dismiss(true); return; }
        dismiss(); clearPending();
        if (next.target?.isConnected && !next.target.disabled) { next.target.click(); return; }
        if (!next.prompt) return;
        panel.classList.remove('hidden');
        if ($('#agent-back').getAttribute('aria-pressed') === 'true') $('#agent-back').click();
        const input = $('#agent-input');
        if (!input.value.trim()) { input.value = chosen.prompt; input.dispatchEvent(new Event('input', {bubbles:true})); }
        else showToast('已打开 Agent，保留了你尚未发送的内容。');
        input.focus({preventScroll:true});
      });
      bubble.addEventListener('pointerenter', () => { hovered = true; clearTimeout(autoTimer); });
      bubble.addEventListener('pointerleave', () => { hovered = false; armAutoHide(); });
      bubble.addEventListener('focusin', () => clearTimeout(autoTimer));
      bubble.addEventListener('focusout', () => setTimeout(armAutoHide, 0));
      window.addEventListener('click', event => {
        const toggle = event.target.closest('[data-agent-hints-toggle]');
        if (toggle) { event.preventDefault(); event.stopImmediatePropagation(); setEnabled(!enabled); return; }
        if (!bubble.contains(event.target)) { if (active) dismiss(); schedule(); }
      }, true);
      window.addEventListener('pointerdown', event => { if (!bubble.contains(event.target)) { if (active) dismiss(); clearPending(); } }, true);
      window.addEventListener('keydown', event => {
        if (event.key === 'Escape' && active) { event.preventDefault(); dismiss(true); clearPending(); return; }
        if (!bubble.contains(event.target)) { if (active) dismiss(); clearPending(); }
      }, true);
      ['input', 'change', 'focusout'].forEach(type => window.addEventListener(type, event => {
        if (!bubble.contains(event.target)) { if (active) dismiss(); schedule(); }
      }, true));
      window.addEventListener('focusin', event => { if (!bubble.contains(event.target)) { if (active) dismiss(); clearPending(); } }, true);
      window.addEventListener('blur', () => { focusedWindow = false; clearPending(); dismiss(); });
      window.addEventListener('focus', () => { focusedWindow = true; schedule(); });
      document.addEventListener('visibilitychange', () => { clearPending(); dismiss(); if (!document.hidden) schedule(); });
      window.addEventListener('resize', () => { if (active && !position()) dismiss(); });
      window.addEventListener('storage', event => { if (event.key === KEY) setEnabled(event.newValue !== '0', false); });
      new MutationObserver(() => {
        if (blocked()) { clearPending(); if (active) dismiss(); }
        else { if (active && !position()) dismiss(); schedule(); }
      }).observe(fab, {attributes:true, attributeFilter:['class', 'style', 'inert']});
      const onContextChange = () => {
        const next = active && candidate();
        if (active && (blocked() || next?.key !== active.key || next.message !== active.message)) dismiss();
        schedule();
      };
      new MutationObserver(onContextChange).observe(panel, {attributes:true, attributeFilter:['class']});
      const views = new MutationObserver(onContextChange);
      ['#focus-layout', '#compare-layout', '#project-surface'].forEach(selector => { const node = $(selector); if (node) views.observe(node, {childList:true, subtree:true}); });
      const dialogs = new MutationObserver(onContextChange);
      ['#flow-dialog', '#export-dialog-backdrop', '#workspace-bg-panel', '#asset-detail'].forEach(selector => { const node = $(selector); if (node) dialogs.observe(node, {attributes:true, attributeFilter:['class', 'open', 'hidden']}); });
      schedule();
      return {settingsMarkup};
    })();
