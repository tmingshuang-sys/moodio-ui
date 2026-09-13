    // 下拉菜单开合动效（仿 React Bits 的 CardNav）：容器高度 0.4s power3.out 从 0 展开，各行从下方错开淡入；关闭时反向收起后再隐藏。
    // 用法：菜单先移除 hidden 并摆好位置，再 moodioMenuFx.open(menu)；关闭时 moodioMenuFx.close(menu, () => menu.classList.add('hidden'))。
    // 纯 CSS 过渡（样式见 styles.css 末尾的 .fx-menu 规则），不依赖动画库；prefers-reduced-motion 下退回瞬时开合。
    // 放在最前面加载，任何文件的开合代码都能直接调用。渲染驱动、每次重绘都重建的菜单（标签菜单、创建模板菜单等）改用 CSS 关键帧入场，见 styles.css。
    var moodioMenuFx = (function () {
      const OPEN_MS = 400, CLOSE_MS = 320, STAGGER_MS = 80, STAGGER_START_MS = 300, MAX_STAGGER_ROWS = 9;
      const timers = new WeakMap(), tokens = new WeakMap();
      let serial = 0;
      const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      function settle(menu) {
        clearTimeout(timers.get(menu));
        menu.classList.remove('fx-entering', 'fx-closing');
        menu.style.height = ''; menu.style.overflow = '';
      }
      function isOpen(menu) { return !!menu && !menu.classList.contains('hidden') && !menu.classList.contains('fx-closing'); }
      function open(menu) {
        if (!menu) return;
        menu.classList.add('fx-menu');
        const wasClosing = menu.classList.contains('fx-closing');
        settle(menu);
        if (reduced() || wasClosing) return;                       // 收起中途重新打开：直接定格，不再从 0 展开
        const token = ++serial; tokens.set(menu, token);
        const target = menu.offsetHeight;                           // 先量自然高度，再从 0 过渡到该高度
        menu.style.overflow = 'hidden'; menu.style.height = '0px';
        menu.classList.add('fx-entering'); void menu.offsetHeight;
        menu.style.height = target + 'px';
        const wait = STAGGER_START_MS + Math.min(menu.children.length, MAX_STAGGER_ROWS) * STAGGER_MS + OPEN_MS + 20;
        timers.set(menu, setTimeout(() => { if (tokens.get(menu) === token) settle(menu); }, wait));
      }
      function close(menu, onHidden) {
        if (!menu || menu.classList.contains('hidden') || menu.classList.contains('fx-closing')) return;
        if (reduced()) { settle(menu); onHidden(); return; }
        const token = ++serial; tokens.set(menu, token);
        const from = menu.offsetHeight;
        settle(menu);
        menu.style.overflow = 'hidden'; menu.style.height = from + 'px'; void menu.offsetHeight;
        menu.classList.add('fx-closing'); menu.style.height = '0px';
        timers.set(menu, setTimeout(() => { if (tokens.get(menu) !== token) return; settle(menu); onHidden(); }, CLOSE_MS + 20));
      }
      return { open, close, settle, isOpen };
    })();
