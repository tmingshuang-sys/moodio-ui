    /* ===== 首页：点击顶栏 logo 进入。页面本身就是 Agent 对话框——#agent-panel 在首页模式下固定居中放大
     * （样式见 styles.css 末尾「首页」段，面板行为见 src/11 的 agentHomeMode，页面切换见 src/06 的 render 覆盖），
     * 这里只负责入口、吉祥物与示例提示。 ===== */
    (function homePage(){
      const logo=$('.topbar .logo[data-go-home]'); if(!logo) return;
      const goHome=()=>{ if(state.projectPage==='home'){ $('#agent-input')?.focus({preventScroll:true}); return; } selectProjectPage('home'); };
      logo.addEventListener('click',goHome);
      logo.addEventListener('keydown',event=>{ if(event.key==='Enter'||event.key===' '){ event.preventDefault(); goHome(); } });
      // 吉祥物沿用浮动入口的图片，不再存一份
      const mascot=$('#home-mascot'), source=$('#agent-mascot-image');
      if(mascot&&source){ const src=source.currentSrc||source.src; if(src){ mascot.addEventListener('error',()=>{ mascot.hidden=true; },{once:true}); mascot.src=src; mascot.hidden=false; } }
      // 示例提示：填入输入框并直接发送（走 Agent 面板原有的发送逻辑）
      $('#home-surface')?.addEventListener('click',event=>{
        const chip=event.target.closest('[data-home-prompt]'); if(!chip) return;
        const input=$('#agent-input'), send=$('#agent-send'); if(!input||!send) return;
        if(input.value.trim()){ showToast('输入框中有未发送内容，请先发送或清空。'); input.focus(); return; }
        input.value=chip.dataset.homePrompt; input.dispatchEvent(new Event('input',{bubbles:true})); send.click();
      });
    })();
