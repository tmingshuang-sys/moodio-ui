    /* ===== 首页：点击顶栏 logo 或「返回项目列表」进入，参考正式版首页——问候语 + 居中输入框。
     * 输入框就是 Agent 面板自己的输入框（进入首页时面板被搬进 #home-agent-slot，见 src/11 的 agentHomeMode / homeSync）；
     * 一旦有对话内容，面板铺满整个页面（body.home-chatting，样式见 styles.css 末尾「首页」段）。页面切换见 src/06 的 render 覆盖。 ===== */
    function renderHomePage(){
      const nameEl=$('#home-user-name'); if(nameEl) nameEl.textContent=(typeof USER_PROFILE!=='undefined'&&USER_PROFILE?.name)||$('#topbar-me')?.title||'Thomas';
      let chats=null; try{ chats=JSON.parse(localStorage.getItem(moodioProjects.key('moodio-agent-chats'))||'null')?.chats; }catch(_){}
      $('#home-history-link')?.toggleAttribute('hidden',!(Array.isArray(chats)&&chats.some(c=>c.messages?.length)));   // 有过对话才显示「查看历史对话」
    }
    (function homePage(){
      const goHome=()=>{
        if(state.projectPage==='home'){
          if(document.body.classList.contains('home-chatting')){ const back=$('#agent-back'); if(back?.getAttribute('aria-pressed')==='true') back.click(); else $('#agent-new')?.click(); }   // 对话中再点 logo：开始新对话回到问候页，旧对话留在历史里
          else $('#agent-input')?.focus({preventScroll:true});
          return;
        }
        selectProjectPage('home');
      };
      const logo=$('.topbar .logo[data-go-home]');
      logo?.addEventListener('click',goHome);
      logo?.addEventListener('keydown',event=>{ if(event.key==='Enter'||event.key===' '){ event.preventDefault(); goHome(); } });
      $('.project-identity .bare-button')?.addEventListener('click',event=>{ event.preventDefault(); goHome(); });   // 「返回项目列表」按钮同样回到首页
      $('#home-surface')?.addEventListener('click',event=>{
        const t=event.target;
        if(t.closest('[data-home-history]')){ const back=$('#agent-back'); if(back&&back.getAttribute('aria-pressed')!=='true') back.click(); return; }
        if(t.closest('[data-home-foot]')) showToast('当前设计稿仅演示剧本工作区，此入口待接入');
      });
    })();
