    const icons = {
      cover: '<svg viewBox="0 0 24 24" class="icon"><path d="M5 3h14v18H5z"/><path d="M8 7h8M8 11h5"/></svg>',
      synopsis: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 5h16M4 10h16M4 15h11M4 20h8"/></svg>',
      outline: '<svg viewBox="0 0 24 24" class="icon"><path d="M8 6h13M8 12h13M8 18h13"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
      treatment: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 4h16v16H4z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
      style: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 19 15.5 7.5l1 1L5 20H4z"/><path d="m14 5 2-2 5 5-2 2M4 4h5M4 8h3M17 16h3M15 20h5"/></svg>',
      script: '<svg viewBox="0 0 24 24" class="icon"><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 12h6M9 16h6"/></svg>',
      production: '<svg viewBox="0 0 24 24" class="icon"><path d="M3 5h18v14H3zM3 10h18M9 5v14M16 5v14"/></svg>',
      ledger: '<svg viewBox="0 0 24 24" class="icon"><path d="M5 3h14v18H5zM8 7h8M8 11h8M8 15h5"/><path d="M15 18h4M17 16v4"/></svg>',
      storyboard: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="4" width="18" height="16" rx="1"/><path d="M8 4v16M16 4v16M3 10h18M3 15h18"/></svg>',
      custom: '<svg viewBox="0 0 24 24" class="icon"><path d="M5 3h10l4 4v14H5zM15 3v5h4M9 15h6M12 12v6"/></svg>',
      check: '<svg viewBox="0 0 24 24" class="icon sm"><path d="m5 12 4 4L19 6"/></svg>',
      link: '<svg viewBox="0 0 24 24" class="icon sm"><path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1.1M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1.1"/></svg>',
      chevron: '<svg viewBox="0 0 24 24" class="icon sm"><path d="m8 10 4 4 4-4"/></svg>',
      trash: '<svg viewBox="0 0 24 24" class="icon sm"><path d="M4 7h16M9 7V4h6v3M7 7l1 14h8l1-14M10 11v6M14 11v6"/></svg>',
      plus: '<svg viewBox="0 0 24 24" class="icon sm"><path d="M12 5v14M5 12h14"/></svg>',
      image: '<svg viewBox="0 0 24 24" class="icon"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9" r="1.5"/><path d="m21 15-5-5L5 20"/></svg>',
      upload: '<svg viewBox="0 0 24 24" class="icon sm"><path d="M12 16V3M7 8l5-5 5 5M4 14v6h16v-6"/></svg>',
      canvas: '<svg viewBox="0 0 24 24" class="icon sm"><path d="M4 4h16v16H4zM8 16l8-8M8 8h.01M16 16h.01"/></svg>',
      beatBoard: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 4h7v6H4zM13 4h7v6h-7zM4 13h7v7H4zM13 13h7v7h-7z"/><path d="M7 10v3M16 10v3"/></svg>',
      ideaCanvas: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 3a6 6 0 0 0-4 10.5c.7.7 1 1.3 1 2.5h6c0-1.2.3-1.8 1-2.5A6 6 0 0 0 12 3zM9 20h6M10 17h4"/></svg>',
      spark: '<svg viewBox="0 0 24 24" class="icon"><path d="M12 2l1.9 6.1L20 10l-6.1 1.9L12 18l-1.9-6.1L4 10l6.1-1.9z"/></svg>',
      search: '<svg viewBox="0 0 24 24" class="icon sm"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></svg>'
      ,preparation: '<svg viewBox="0 0 24 24" class="icon"><path d="M5 4h14v16H5zM9 4V2M15 4V2M8 9h8M8 13h8M8 17h5"/></svg>'
      ,coreCreate: '<svg viewBox="0 0 24 24" class="icon"><path d="M5 19 8 8l8-5 5 5-5 8-11 3zM13 6l5 5M5 19l5-5"/></svg>'
      ,breakdownCreate: '<svg viewBox="0 0 24 24" class="icon"><path d="M4 5h7v6H4zM13 5h7v6h-7zM4 13h7v6H4zM13 13h7v6h-7z"/></svg>'
      ,customCreate: '<svg viewBox="0 0 24 24" class="icon"><path d="M5 3h10l4 4v14H5zM15 3v5h4M12 11v7M8.5 14.5h7"/></svg>'
    };

    const docDefinitions = {
      film: [
        { id: 'cover', name: '封面', en: 'Cover', group: '前置准备', icon: 'cover' },
        { id: 'synopsis', name: '故事梗概', en: 'Synopsis', group: '前置准备', icon: 'synopsis' },
        { id: 'outline', name: '故事大纲', en: 'Outline', group: '前置准备', icon: 'outline' },
        { id: 'treatment', name: '故事阐述', en: 'Treatment', group: '前置准备', icon: 'treatment' },
        { id: 'script', name: '剧本正文', en: 'Script', group: '核心创作', icon: 'script', core: true },
        { id: 'styleTreatment', name: '风格阐述', en: 'Style treatment', group: '核心创作', icon: 'style' },
        { id: 'scriptOrder', name: '顺场表', en: 'Script order & shot breakdown', group: '后置拆解', icon: 'production' },
        { id: 'locationBreakdown', name: '分景表', en: 'Scene-by-location breakdown', group: '后置拆解', icon: 'production' },
        { id: 'dailyReport', name: '拍摄日报', en: 'Daily production report', group: '后置拆解', icon: 'production' },
        { id: 'dailySchedule', name: '通告单', en: 'Call sheet / rundown', group: '后置拆解', icon: 'production' },
        { id: 'storyboard', name: '分镜表', en: 'Storyboard', group: '后置拆解', icon: 'storyboard' },
        { id: 'productionLedger', name: '项目制作账本', en: 'Production ledger', group: '后置拆解', icon: 'ledger' },
        { id: 'custom', name: '新建空白页面', en: 'Blank document', group: '自定义', icon: 'custom', add: true }
      ],
      series: [
        { id: 'cover', name: '封面', en: 'Cover', group: '前置准备', icon: 'cover' },
        { id: 'synopsis', name: '故事梗概', en: 'Synopsis', group: '前置准备', icon: 'synopsis' },
        { id: 'episodeOutline', name: '分集大纲', en: 'Episode outline', group: '前置准备', icon: 'outline', episodes: true },
        { id: 'episodeScript', name: '分集剧本', en: 'Episode script', group: '核心创作', icon: 'script', core: true, episodes: true },
        { id: 'styleTreatment', name: '风格阐述', en: 'Style treatment', group: '核心创作', icon: 'style' },
        { id: 'scriptOrder', name: '顺场表', en: 'Script order & shot breakdown', group: '后置拆解', icon: 'production' },
        { id: 'locationBreakdown', name: '分景表', en: 'Scene-by-location breakdown', group: '后置拆解', icon: 'production' },
        { id: 'dailyReport', name: '拍摄日报', en: 'Daily production report', group: '后置拆解', icon: 'production' },
        { id: 'dailySchedule', name: '通告单', en: 'Call sheet / rundown', group: '后置拆解', icon: 'production' },
        { id: 'storyboard', name: '分集分镜表', en: 'Episode storyboard', group: '后置拆解', icon: 'storyboard', episodes: true },
        { id: 'productionLedger', name: '项目制作账本', en: 'Production ledger', group: '后置拆解', icon: 'ledger' },
        { id: 'custom', name: '新建空白页面', en: 'Blank document', group: '自定义', icon: 'custom', add: true }
      ]
    };

    const cameraOptions = {
      '景别': ['大全景', '全景', '中景', '近景', '特写'],
      '镜头运动': ['固定', '推镜', '拉镜', '横移', '跟拍', '环绕'],
      '摄影机角度': ['平视', '低角度', '高角度', '鸟瞰', '荷兰角'],
      '透视关系': ['广角透视', '标准透视', '长焦压缩'],
      '景深强度': ['深景深', '浅景深', '焦点转移'],
      '光影效果': ['自然光', '低调光', '轮廓光', '霓虹实景']
    };

    const screenplayFormats = [
      { id: 'scene', name: 'Scene', className: 'scene-line', icon: '<path d="M4 5h16v14H4zM4 10h16M9 5v14"/>' },
      { id: 'action', name: 'Action', className: '', icon: '<path d="M3 12h5l2-7 4 14 2-7h5"/>' },
      { id: 'character', name: 'Character', className: 'character', icon: '<circle cx="12" cy="8" r="3"/><path d="M5 21a7 7 0 0 1 14 0"/>' },
      { id: 'paren', name: 'Paren', className: 'parenthetical', icon: '<path d="M9 4c-4 4-4 12 0 16M15 4c4 4 4 12 0 16"/>' },
      { id: 'dialogue', name: 'Dialogue', className: 'dialogue', icon: '<path d="M4 5h16v12H8l-4 4z"/>' },
      { id: 'transition', name: 'Transition', className: 'transition', icon: '<path d="M4 8h13M14 5l3 3-3 3M20 16H7M10 13l-3 3 3 3"/>' },
      { id: 'subtitle', name: 'Subtitle', className: 'subtitle', icon: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 15h4M13 15h4"/>' }
    ];

    const sceneOptions = {
      interior: ['INT', 'EXT', 'INT/EXT'],
      location: ['雨夜车内', '商场后门', '记忆档案室', '吴老师实验室'],
      time: ['晨', '日', '黄昏', '夜', '连续']
    };

    // 仅用于识别旧版未编辑的示例字段；新工作区由真实识别或手工创建资产。
    const legacyAssetExamples = {
      character: [
        { id: 'char-mengyu', name: '梦雨', meta: '女 · 22岁 · 侵入者（记忆搜查科新人）', usage: '8 场', dialogue: '23 句', description: '全 AI 判定的精英新人。积极、热情、相信基拉式的体系，渴望参与大案证明自己；随着“来夏”反复出现，她对系统的信任开始松动。' },
        { id: 'char-wu', name: '吴老师', meta: '男 · 48岁 · 记忆搜查科导师', usage: '12 场', dialogue: '31 句', description: '克制、冷静，习惯把关心包装成控制。他掌握旧实验室的关键记录，也清楚梦雨的记忆并非第一次被改写。' },
        { id: 'char-pizza', name: '披萨', meta: '猫 · 年龄未知 · 情绪识别载体', usage: '9 场', dialogue: '6 句', description: '能听见人最想遗忘的记忆。它不是喜剧配角，而是故事里最直接的情绪判断者。' },
        { id: 'char-tiffany', name: 'Tiffany', meta: '女 · 29岁 · 记忆档案管理员', usage: '5 场', dialogue: '14 句', description: '负责维护原始档案，语言精确、情绪难以读取。她保留着一份不该存在的梦雨童年记录。' }
      ],
      location: [
        { id: 'loc-rain-car', name: '雨夜车内', meta: '旧轿车 · 城市高架 · 夜 / 雨', usage: '3 场', dialogue: '11 镜', description: '潮湿玻璃切碎城市反光，右侧街灯提供冷色主光。空间狭窄，人物始终隔着座椅、后视镜与车窗被二次构图。' },
        { id: 'loc-mall-back', name: '商场后门', meta: '城市商业区 · 外景 · 夜', usage: '2 场', dialogue: '8 镜', description: '卷帘门、装卸坡道与残留广告灯组成冷硬的服务通道；远处商场灯光与人物形成明确明暗边界。' },
        { id: 'loc-archive', name: '记忆档案室', meta: '地下设施 · 内景 · 日', usage: '4 场', dialogue: '17 镜', description: '精确重复的存储阵列形成秩序感，未来感来自尺度与重复，不使用透明 HUD 或无来源霓虹。' },
        { id: 'loc-lab', name: '吴老师实验室', meta: '旧研究楼 · 内景 · 黄昏', usage: '3 场', dialogue: '13 镜', description: '被停用的早期实验室，保留物理介质、磨损操作台和钨丝残光，是故事中最有时间痕迹的空间。' }
      ],
      prop: [
        { id: 'prop-file', name: '文件', meta: '纸质档案 · A4 · 旧版本', usage: '4 场', dialogue: '7 镜', description: '边缘受潮、装订处反复拆开，封面没有机构标识；它承载的是无法被系统检索的离线证据。' },
        { id: 'prop-chip', name: '记忆芯片', meta: '银灰金属 · 磨砂保护层', usage: '6 场', dialogue: '12 镜', description: '银灰金属主体与磨砂半透明保护层，边角带实际磨损；不透明发光，不呈现悬浮界面。' },
        { id: 'prop-car', name: '旧轿车', meta: '深灰 · 服役 12 年', usage: '3 场', dialogue: '11 镜', description: '真实使用痕迹明显，内饰吸收大部分环境光；后视镜与湿玻璃是场 02 的主要构图层级。' },
        { id: 'prop-door', name: '卷帘门', meta: '镀锌钢 · 半开启', usage: '2 场', dialogue: '5 镜', description: '只升到人物腰部高度，既是空间阻隔，也是披萨第一次带出记忆芯片的视觉门槛。' }
      ]
    };

    const assetCatalog = {character:[],location:[],prop:[],style:[]};

    const initialFileStores = {
      film: {
        cover: [
          { id: 'film-cover-1', type: 'cover', title: '封面', updated: '刚刚', preview: '霸道总裁别爱上我家猫。编剧：李孟哲 Koi。' }
        ],
        synopsis: [
          { id: 'film-synopsis-1', type: 'synopsis', title: '故事梗概 01', updated: '2 天前', preview: '梦雨一直相信，记忆是唯一不该被买卖的东西。直到一只名叫披萨的猫闯进她的生活。' },
          { id: 'film-synopsis-2', type: 'synopsis', title: '故事梗概 02', updated: '昨天', preview: '城市正通过情绪适配技术复制人的选择，梦雨必须决定留下真相还是善意的谎言。' }
        ],
        outline: [
          { id: 'film-outline-1', type: 'outline', title: '故事大纲 · 初稿', updated: '3 天前', preview: '开端：被闯入的日常。发展：错误的同盟。转折：记忆里的自己。' },
          { id: 'film-outline-2', type: 'outline', title: '故事大纲 · 制片版', updated: '2 天前', preview: '按四幕结构整理的制片沟通版本，包含核心情节点和场次范围。' },
          { id: 'film-outline-3', type: 'outline', title: '故事大纲 · 当前版', updated: '今天', preview: '梦雨没有摧毁系统，而是公开所有修改记录，让每个人获得恢复记忆的权利。' }
        ],
        script: [
          { id: 'film-script-1', type: 'script', title: '剧本正文 · 第一稿', updated: '刚刚', preview: '场 2 · 雨夜车内。雨打在挡风玻璃上，梦雨坐在副驾，膝盖上放着一份文件。' }
        ],
        scriptOrder: [
          { id: 'film-script-order-1', type: 'scriptOrder', title: '顺场表 · 全片', updated: '刚刚', preview: '按剧本场次与场内镜头顺序，逐条拆解摄影、声音、表演和制作要素。' }
        ],
        locationBreakdown: [
          { id: 'film-location-breakdown-1', type: 'locationBreakdown', title: '分景表 · 全片', updated: '刚刚', preview: '按物理场景归并全片所有 Scene、人物矩阵与服化道车辆需求。' }
        ],
        dailyReport: [
          { id: 'film-daily-report-1', type: 'dailyReport', title: '拍摄日报 · DAY 03', updated: '刚刚', preview: '记录实际到离场、开拍收工、已拍内容、完成质量、素材卷与未完成项。' }
        ],
        dailySchedule: [
          { id: 'film-daily-schedule-1', type: 'dailySchedule', title: '通告单 · DAY 03', updated: '刚刚', preview: '按当天时间顺序排列场次、转场、演员通告、场地医疗与部门准备。' }
        ],
        storyboard: [
          { id: 'film-storyboard-1', type: 'storyboard', title: '分镜 01 · 雨夜车内', updated: '刚刚', preview: '雨刷扫过挡风玻璃。镜头从副驾位置观察梦雨。', shotId: 1 },
          { id: 'film-storyboard-2', type: 'storyboard', title: '分镜 02 · 吴老师', updated: '刚刚', preview: '缓慢推近吴老师，梦雨的倒影从他脸上滑过。', shotId: 2 },
          { id: 'film-storyboard-3', type: 'storyboard', title: '分镜 03 · 下车', updated: '刚刚', preview: '车门打开，远处商场的冷光切进车内。', shotId: 3 }
        ]
      },
      series: {
        cover: [{ id: 'series-cover-1', type: 'cover', title: '剧集封面', updated: '刚刚', preview: '霸道总裁别爱上我家猫 · Series Bible。' }],
        synopsis: [{ id: 'series-synopsis-1', type: 'synopsis', title: '全剧故事梗概', updated: '昨天', preview: '八集都市奇幻剧集总梗概。' }],
        episodeOutline: [{ id: 'series-outline-1', type: 'episodeOutline', title: 'EP01 分集大纲', updated: '今天', preview: '第一集：披萨带着一枚失踪客户的记忆芯片出现。' }],
        episodeScript: [{ id: 'series-script-1', type: 'episodeScript', title: 'EP01 分集剧本', updated: '刚刚', preview: '第一集剧本正文，共 9 场。' }],
        scriptOrder: [{ id: 'series-script-order-1', type: 'scriptOrder', title: '顺场表 · EP01', updated: '刚刚', preview: '按分集剧本顺序拆解场次与镜头。' }],
        locationBreakdown: [{ id: 'series-location-breakdown-1', type: 'locationBreakdown', title: '分景表 · 全剧', updated: '刚刚', preview: '按物理场景汇总跨集 Scene 与制作需求。' }],
        dailyReport: [{ id: 'series-daily-report-1', type: 'dailyReport', title: '拍摄日报 · DAY 03', updated: '刚刚', preview: '记录当天实际拍摄结果、进度、素材与异常。' }],
        dailySchedule: [{ id: 'series-daily-schedule-1', type: 'dailySchedule', title: '通告单 · DAY 03', updated: '刚刚', preview: '当天场次顺序、转场、演员通告、场地医疗和部门准备。' }]
      }
    };

    const WORKSPACE_STORAGE_KEY = moodioProjects.key('moodio-ui-refined-storyboard-v1');   // 按当前项目隔离
    const restoredWorkspace = (() => {
      try {
        const saved = localStorage.getItem(WORKSPACE_STORAGE_KEY);
        return saved ? JSON.parse(saved) : null;
      } catch (error) {
        console.warn('Moodio 本地稿件读取失败', error);
        return null;
      }
    })();

    const uid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const initialStoryBeats = [
      { id: 'beat-1', act: 'act1', type: 'OPENING IMAGE', title: '雨夜车内', summary: '梦雨在暴雨中第一次听见披萨读出的陌生记忆。', scenes: '02–03', plot: 'A 线', characters: '梦雨、披萨', shift: '封闭 → 警觉', color: '#76949d' },
      { id: 'beat-2', act: 'act1', type: 'INCITING INCIDENT', title: '披萨说出她被抹掉的童年', summary: '猫说出只有梦雨父亲知道的一句话。', scenes: '08–10', plot: 'A 线', characters: '梦雨、披萨、吴老师', shift: '拒绝 → 卷入', color: '#8d7c9d' },
      { id: 'beat-3', act: 'act2a', type: 'PROGRESSIVE COMPLICATION', title: '追查记忆档案室', summary: '梦雨带着披萨潜入保存人类记忆样本的地下档案室。', scenes: '16–22', plot: 'A / B 线', characters: '梦雨、披萨、吴老师', shift: '对抗 → 合作', color: '#7d8e75' },
      { id: 'beat-4', act: 'act2a', type: 'REVELATION', title: '吴老师认识她的父亲', summary: '旧档案显示吴老师参与过梦雨父亲的记忆研究。', scenes: '27–28', plot: 'B 线', characters: '梦雨、吴老师', shift: '怀疑 → 戒备', color: '#a88963' },
      { id: 'beat-5', act: 'act2b', type: 'MIDPOINT', title: '读取记忆的人才是实验对象', summary: '梦雨发现披萨不是工具，她自己才是实验持续运行的载体。', scenes: '34–36', plot: 'A / B 线', characters: '梦雨、披萨', shift: '找真相 → 夺选择', color: '#8d6b72' },
      { id: 'beat-6', act: 'act2b', type: 'REVERSAL', title: '披萨主动封存一段记忆', summary: '披萨为保护梦雨，拒绝交出她最关键的一段童年记忆。', scenes: '47–49', plot: 'B 线', characters: '梦雨、披萨', shift: '依赖 → 背叛感', color: '#7f7695' },
      { id: 'beat-7', act: 'act3', type: 'ALL IS LOST', title: '删除关于披萨的全部记忆', summary: '梦雨主动清除与披萨的共同记忆，以阻止实验继续追踪它。', scenes: '61', plot: 'A 线', characters: '梦雨、披萨', shift: '紧握 → 放手', color: '#a36f60' },
      { id: 'beat-8', act: 'act3', type: 'FINALE', title: '让城市自己选择记住什么', summary: '梦雨公开记忆读取协议，让所有人决定是否保留自己的过去。', scenes: '68–72', plot: 'A / B 线', characters: '梦雨、披萨、吴老师', shift: '被定义 → 自定义', color: '#668a80' }
    ];

    const initialStoryCards = [
      ...initialStoryBeats.map((beat,index) => ({ ...beat, kind:'beat', order:index + 1, pageGoal:[1,12,25,38,55,72,88,108][index], x:150 + index * 300, y:420, w:238, h:178, source:index < 2 ? '剧本正文 + 故事大纲' : '故事大纲 + Scene 关联', parentId:null })),
      { id:'sub-1',kind:'sub',parentId:'beat-2',order:null,x:430,y:150,w:190,h:112,type:'FORESHADOW',title:'父亲留下的离线录音',summary:'不能被记忆系统检索，证明有人预见了覆盖。',scenes:'09',plot:'伏笔',characters:'梦雨父亲',shift:'—',color:'#8d7c9d',source:'大纲发散' },
      { id:'sub-2',kind:'sub',parentId:'beat-2',order:null,x:670,y:170,w:190,h:112,type:'CHARACTER QUESTION',title:'她为什么抗拒被定义',summary:'梦雨曾因“适配结果”失去一次真实选择。',scenes:'待写',plot:'人物',characters:'梦雨',shift:'顺从 → 抗拒',color:'#a88963',source:'人物小传' },
      { id:'sub-3',kind:'sub',parentId:'beat-5',order:null,x:1310,y:150,w:190,h:112,type:'WORLD RULE',title:'流浪猫保存失踪者记忆',summary:'猫不是读取器，而是记忆逃逸后的临时载体。',scenes:'35',plot:'世界观',characters:'披萨',shift:'工具 → 生命',color:'#668a80',source:'灵感画布' },
      { id:'sub-4',kind:'sub',parentId:'beat-6',order:null,x:1620,y:730,w:190,h:112,type:'RELATIONSHIP BRANCH',title:'披萨第一次主动隐瞒',summary:'它的沉默不是背叛，而是在练习自己的选择。',scenes:'48',plot:'关系',characters:'梦雨、披萨',shift:'依赖 → 平等',color:'#7f7695',source:'灵感画布' }
    ];

    const initialStoryEdges = [
      ...initialStoryBeats.slice(0,-1).map((beat,index) => ({ id:`story-edge-${index + 1}`,from:beat.id,to:initialStoryBeats[index + 1].id,kind:'main' })),
      { id:'story-edge-sub-1',from:'beat-2',to:'sub-1',kind:'branch' },
      { id:'story-edge-sub-2',from:'beat-2',to:'sub-2',kind:'branch' },
      { id:'story-edge-sub-3',from:'beat-5',to:'sub-3',kind:'branch' },
      { id:'story-edge-sub-4',from:'beat-6',to:'sub-4',kind:'branch' }
    ];

    const initialIdeaNodes = [
      { id:'idea-1',type:'note',x:110,y:92,w:230,h:142,text:'梦雨为什么如此抗拒被任何身份定义？',tags:['人物','人物动机'],color:'#f1e5bc' },
      { id:'idea-2',type:'note',x:430,y:122,w:270,h:136,text:'“记忆不是证据，是别人留在你身上的指纹。”',tags:['对白','主题'],color:'#e4e9ee' },
      { id:'idea-3',type:'note',x:790,y:92,w:226,h:126,text:'人与猫不是主人和宠物，而是彼此记忆的保管者。',tags:['主题','关系'],color:'#e9e5eb' },
      { id:'idea-4',type:'note',x:1080,y:196,w:292,h:142,text:'城市里每只流浪猫都保存着一个失踪者的记忆。',tags:['世界观'],color:'#ffffff' },
      { id:'idea-5',type:'note',x:560,y:430,w:260,h:150,text:'自由不是没有过去，而是选择哪些过去值得留下。',tags:['主题'],color:'#e5e5e3' },
      { id:'idea-6',type:'note',x:1010,y:476,w:268,h:142,text:'吴老师每次撒谎前都会先摸猫的耳朵。',tags:['人物','动作伏笔'],color:'#eee4df' }
    ];

    const initialIdeaEdges = [
      { id:'idea-edge-1',from:'idea-1',to:'idea-5' },
      { id:'idea-edge-2',from:'idea-2',to:'idea-3' }
    ];

    function productionMatrixRow(base, castValues, tail) {
      const cast = Array(20).fill('—');
      castValues.slice(0,20).forEach((value,index) => { cast[index] = value || '—'; });
      return [...base,...cast,...tail];
    }

    const initialProductionRows = {
      scriptOrder: [
        productionMatrixRow(['1','02','2.375','55','雨夜车内','夜','内','梦雨在雨夜车内第一次听见披萨读出的陌生记忆。'],['梦雨','吴老师'],['司机替身×1','梦雨灰蓝风衣；湿发 C-02','旧轿车、文件、湿玻璃','热饮×4','旧轿车×1','READY']),
        productionMatrixRow(['2','03','1.625','65','商场后门','夜','外','披萨从卷帘门下钻出，叼着一枚记忆芯片。'],['梦雨','吴老师','披萨'],['装卸工 BG×6','雨衣 C-03；动物安全背带','卷帘门、芯片、货箱','猫粮、饮水','货车×2','TECH SCOUT']),
        productionMatrixRow(['3','08','3.250','90','记忆档案室','日','内','梦雨与 Tiffany 找到被覆盖的童年档案。'],['梦雨','—','—','Tiffany'],['档案员 BG×4','管理员制服 W-04','档案盒、读取器、芯片','矿泉水×12','器材车×1','LOCKED']),
        productionMatrixRow(['4','27','2.500','80','吴老师实验室','黄昏','内','旧实验记录揭示吴老师参与过梦雨父亲的研究。'],['梦雨','吴老师','披萨'],['消防员×2','结局服装 C-11；灰尘妆','旧终端、纸档案、火盆','—','器材车×1','PERMIT'])
      ],
      locationBreakdown: [
        productionMatrixRow(['雨夜车内','棚拍车厢','E1S02','2.375','55','夜','内','右侧主光固定；雨量 R2；后视镜方向不可反。'],['梦雨','吴老师'],['司机替身×1','梦雨 C-02；吴老师 C-01','旧轿车、文件、湿玻璃','热饮×4','旧轿车×1','TECH SCOUT']),
        productionMatrixRow(['雨夜车内','高架 Plate','E1S18','2.750','45','夜','内','车窗 Plate 方向与 E1S02 连续；仅拍插入镜头。'],['梦雨'],['司机×1','同上','方向盘、后视镜','—','摄影车×1','HOLD']),
        productionMatrixRow(['商场后门','物流通道','E1S03','1.625','65','夜','外','卷帘门 90cm；地面湿度与雨夜车内连续。'],['梦雨','吴老师','披萨'],['装卸工 BG×6','雨衣 C-03；动物背带','卷帘门、芯片、货箱','猫粮、饮水','货车×2','PERMIT']),
        productionMatrixRow(['记忆档案室','阵列区','E1S08','3.250','90','日','内','阵列编号、灯带方向和透明屏内容必须连续。'],['梦雨','—','—','Tiffany'],['档案员 BG×4','管理员制服 W-04','档案盒、芯片、读取器','矿泉水×12','器材车×1','CONFIRMED'])
      ],
      dailyReport: [
        ['1','03','商场后门','海港百货物流通道','06:45','07:45','09:45','03-01 A–C','1.625','完成','A001–A004','可用 / Approved','雨势延迟 12 min','动物表演一次通过'],
        ['2','19','商场后门','装卸区西侧','09:45','10:00','11:30','19-02 B','0.375','完成','A005–A007','可用 / Approved','居民区控噪','补录环境声'],
        ['3','02','雨夜车内','Stage B','12:30','13:30','16:45','02-01 A / 02-02 B','2.375','部分完成','B001–B006','需补拍 / Pickup','车窗反射不连续','欠 02-02B 反打'],
        ['4','08','记忆档案室','市档案馆 B2','—','—','—','—','0','未拍','—','—','场地方提前收场','顺延 DAY 04']
      ],
      dailySchedule: [
        ['06:30–07:00','General Call / 早餐','—','—','—','—','全组签到、早餐、晨间安全说明。','商场后门 / Base Camp','全组','雨衣连续性检查','夜戏湿滑风险','无线电发放、雨效预检','30','0','CONFIRMED'],
        ['07:00–07:35','走位 / 灯光','03','03-01 · A','NIGHT','1 5/8','披萨从卷帘门下进入，梦雨与吴老师停下。','商场后门 / 海港百货','1、2、3；BG 6','芯片、货箱；雨衣 C-03','动物表演；雨效','低轨、雾机；动物安全员到位','35','10','READY'],
        ['07:45–08:30','拍摄','03','03-01 A–C','NIGHT','1 5/8','全景、梦雨反应、披萨特写。','商场后门 / 海港百货','1、2、3；BG 6','同上','芯片微光 VFX','同期声静场；居民区降噪','45','15','NOT STARTED'],
        ['08:45–09:20','拍摄','19','19-02 B','NIGHT','3/8','吴老师在货车后向未知联系人发送坐标。','商场后门 / 装卸区西侧','2；BG 2','手机、货车；外套 C-05','屏幕替换 VFX','75 mm、无线图传','35','20','NOT STARTED'],
        ['09:40–10:30','转场 / Prelight','02','02-01 · A','NIGHT','2 3/8','移动至 Stage B，演员进入妆发，车内预灯。','Stage B','1、2','风衣 C-02；旧轿车','雨效 R2；LED Plate','车摇台、LED Wall、吸盘机位','50','10','NOT STARTED'],
        ['10:40–12:05','拍摄','02','02-01 A / 02-02 B','NIGHT','2 3/8','雨夜车内双人覆盖及吴老师近景。','Stage B','1、2','文件、湿玻璃','雨效；反射合成','偏振镜、短滑轨','85','0','NOT STARTED']
      ]
    };

    const initialCallSheetMeta = {
      shootDay: 'DAY 03 / 18', date: '2026 / 09 / 12', unit: 'A UNIT', generalCall: '06:30', firstShot: '07:45', meal: '12:30', estWrap: '18:30', weather: '22–27°C · 60% 雨', sun: '05:42 / 18:16', basecamp: '海港百货 P3', hospital: '市一院 · 12 min', safety: '夜戏、湿滑地面、动物表演'
    };

    const initialDailyReportMeta = {
      shootDay: 'DAY 03 / 18', date: '2026 / 09 / 12', unit: 'A UNIT', director: '李孟哲', producer: 'Koi', generalCall: '06:30', firstShot: '07:45', wrap: '18:30', breakfast: '06:00', lunch: '12:30', dinner: '17:30', midnightMeal: '—', remarks: '外景雨势延迟 12 分钟；场 02 反打因反射连续性列入补拍。'
    };

    const initialDailyReportCastActuals = [
      ['1','梦雨 / 林诗','06:29','07:00','07:45','18:00','FINISH','无异常'],
      ['2','吴老师 / 孙宁','06:35','07:15','07:45','18:00','FINISH','补录环境声'],
      ['3','披萨 / 动物演员','06:45','—','07:45','09:45','FINISH','动物安全员全程']
    ];

    const initialCastCalls = [
      ['1','梦雨','SW','05:50','06:20','06:40','07:00','18:00','雨衣 C-03 → 风衣 C-02'],
      ['2','吴老师','SW','06:00','06:30','06:45','07:00','18:00','外套 C-05 → 车内 C-01'],
      ['3','披萨','W','06:10','—','—','06:45','09:00','动物安全员全程在场'],
      ['BG','装卸工 6','W','06:10','06:25','06:35','06:50','09:30','自带深色雨衣，禁品牌标识']
    ];

    const state = {
      mode: 'film',
      workspaceMode: 'document',
      storyBeats: restoredWorkspace?.storyBeats || JSON.parse(JSON.stringify(initialStoryCards)),
      storyEdges: restoredWorkspace?.storyEdges || JSON.parse(JSON.stringify(initialStoryEdges)),
      storyTool: 'select',
      storyGridSnap: restoredWorkspace?.storyGridSnap ?? true,
      storyTargetPages: restoredWorkspace?.storyTargetPages || 110,
      storyZoom: restoredWorkspace?.storyZoom || .72,
      selectedStoryCard: null,
      selectedStoryEdge: null,
      storyConnectFrom: null,
      storyEdgeMenu: null,
      suppressStoryPortClick: false,
      ideaNodes: restoredWorkspace?.ideaNodes || JSON.parse(JSON.stringify(initialIdeaNodes)),
      ideaEdges: restoredWorkspace?.ideaEdges || JSON.parse(JSON.stringify(initialIdeaEdges)),
      ideaLayoutGroups: restoredWorkspace?.ideaLayoutGroups || [],
      ideaTool: 'select',
      ideaConnectFrom: null,
      ideaTagMenu: null,
      ideaContextMenu: null,
      ideaUploadPosition: null,
      ideaZoom: restoredWorkspace?.ideaZoom || .72,
      selectedIdea: null,
      canvasAgentOpen: false,
      productionRows: restoredWorkspace?.productionRows || JSON.parse(JSON.stringify(initialProductionRows)),
      callSheetMeta: restoredWorkspace?.callSheetMeta || { ...initialCallSheetMeta },
      castCalls: restoredWorkspace?.castCalls || JSON.parse(JSON.stringify(initialCastCalls)),
      dailyReportMeta: restoredWorkspace?.dailyReportMeta || { ...initialDailyReportMeta },
      dailyReportCastActuals: restoredWorkspace?.dailyReportCastActuals || JSON.parse(JSON.stringify(initialDailyReportCastActuals)),
      draggedBeatId: null,
      draggedProductionRow: null,
      currentDoc: restoredWorkspace?.currentDoc || 'script',
      compareDoc: restoredWorkspace?.compareDoc || 'outline',
      currentFileId: restoredWorkspace?.currentFileId || 'film-script-1',
      compareFileId: restoredWorkspace?.compareFileId || 'film-outline-3',
      compareMemo: restoredWorkspace?.compareMemo || null,
      fanPosition: restoredWorkspace?.fanPosition || null,
      folderOrder: restoredWorkspace?.folderOrder || [],
      view: 'focus',
      episode: 1,
      brief: restoredWorkspace?.brief && typeof restoredWorkspace.brief === 'object' ? restoredWorkspace.brief : null,   // 创作纲领（项目级）
      trash: Array.isArray(restoredWorkspace?.trash) ? restoredWorkspace.trash : [],   // Agent 删除的文档先进回收站（7 天）
      fileStores: restoredWorkspace?.fileStores || JSON.parse(JSON.stringify(initialFileStores)),
      expandedStack: null,
      contextFileId: null,
      renamingFileId: null,
      scriptLayout: restoredWorkspace?.scriptLayout || 'american',
      selectedScriptId: null,
      locatedScriptId: null,
      activeScriptBlockId: null,
      formatAssignments: restoredWorkspace?.formatAssignments || {},
      assetsRecognized: restoredWorkspace?.assetsRecognized || false,
      assetOverrides: restoredWorkspace?.assetOverrides || {},
      activeAssetInstance: null,
      draggedFile: null,
      dragSource: null,
      dropSide: 'right',
      openCreateMenu: null,
      createMenuVisible: false,
      exportSelection: new Set(),
      paginationMode: 'pages',
      workspacePaneHeight: restoredWorkspace?.workspacePaneHeight ?? null,
      sidebarCollapsed: false,
      selectedPageSlot: 'left',
      suppressPageHandleClick: false,
      activeScene: 'scene1',
      characterAssignments: { s4: '吴老师', s6: '梦雨' },
      scenes: {
        scene1: { number: 2, interior: 'INT', location: '雨夜车内', time: '夜', cast: ['梦雨', '吴老师'] },
        scene2: { number: 3, interior: 'EXT', location: '商场后门', time: '夜', cast: ['梦雨', '吴老师', '披萨'] }
      },
      storyboardEnabled: true,
      shotTab: { 1: 'description', 2: 'description', 3: 'reference' },
      recentShotId: null,
      selectedShots: new Set(),
      openTagMenu: null,
      openMediaMenu: null,
      shots: [
        {
          id: 1,
          sourceId: 's3',
          sourceLabel: '场 1 · 动作段落 3',
          description: '雨刷扫过挡风玻璃。镜头从副驾位置观察梦雨，她没有看吴老师，街灯在车窗上糊成一团。',
          tags: { '景别': ['中景'], '镜头运动': ['固定'], '摄影机角度': ['平视'], '透视关系': ['标准透视'], '景深强度': ['浅景深'], '光影效果': ['霓虹实景'] },
          media: null
        },
        {
          id: 2,
          sourceId: 's5',
          sourceLabel: '场 1 · 对白段落 5',
          description: '缓慢推近吴老师。说到“适配者就是工具”时，梦雨的倒影从他脸上滑过。',
          tags: { '景别': ['近景'], '镜头运动': ['推镜'], '摄影机角度': ['低角度'], '透视关系': ['长焦压缩'], '景深强度': ['焦点转移'], '光影效果': ['低调光'] },
          media: 'visual'
        },
        {
          id: 3,
          sourceId: 's8',
          sourceLabel: '场 1 · 动作段落 8',
          description: '车门打开，远处商场的冷光切进车内。梦雨先下车，吴老师停顿半拍才跟上。',
          tags: { '景别': ['全景'], '镜头运动': ['跟拍'], '摄影机角度': ['平视'], '透视关系': ['广角透视'], '景深强度': ['深景深'], '光影效果': ['自然光'] },
          media: 'audio'
        }
      ]
    };

    if (!Array.isArray(state.productionRows.scriptOrder) || state.productionRows.scriptOrder.some(row => row.length !== 34)) state.productionRows.scriptOrder = JSON.parse(JSON.stringify(initialProductionRows.scriptOrder));
    if (!Array.isArray(state.productionRows.locationBreakdown) || state.productionRows.locationBreakdown.some(row => row.length !== 34)) state.productionRows.locationBreakdown = JSON.parse(JSON.stringify(initialProductionRows.locationBreakdown));
    if (!Array.isArray(state.productionRows.dailyReport) || state.productionRows.dailyReport.some(row => row.length !== 14)) state.productionRows.dailyReport = JSON.parse(JSON.stringify(initialProductionRows.dailyReport));
    if (!Array.isArray(state.productionRows.dailySchedule) || state.productionRows.dailySchedule.some(row => row.length !== 15)) state.productionRows.dailySchedule = JSON.parse(JSON.stringify(initialProductionRows.dailySchedule));
    ['film','series'].forEach(mode => {
      if (!state.fileStores[mode].dailyReport) state.fileStores[mode].dailyReport = JSON.parse(JSON.stringify(initialFileStores[mode].dailyReport));
      if (!state.fileStores[mode].dailySchedule) state.fileStores[mode].dailySchedule = JSON.parse(JSON.stringify(initialFileStores[mode].dailySchedule));
    });

    if (Array.isArray(restoredWorkspace?.shots)) state.shots = restoredWorkspace.shots;

    const $ = (selector, root = document) => root.querySelector(selector);
    const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
    const docList = () => docDefinitions.film;
    const docDef = id => docList().find(doc => doc.id === id) || { id, name: id, en: 'Custom document', icon: 'custom' };
    const escapeHtml = value => String(value).replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
    const fileStore = () => state.fileStores.film;
    const filesForType = type => fileStore()[type] || [];
    const allFiles = () => Object.values(fileStore()).flat();
    const findFile = fileId => allFiles().find(file => file.id === fileId) || null;
    const latestFile = type => filesForType(type).at(-1) || null;
    const activeFile = slot => findFile(slot === 'right' ? state.compareFileId : state.currentFileId);
    const uniqueFileId = type => `film-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    let storageWarningShown = false;
    function persistWorkspace() {
      const payload = {
        version: 4,
        workspaceMode: state.workspaceMode,
        storyBeats: state.storyBeats,
        storyEdges: state.storyEdges,
        storyGridSnap: state.storyGridSnap,
        storyTargetPages: state.storyTargetPages,
        storyZoom: state.storyZoom,
        ideaNodes: state.ideaNodes,
        ideaEdges: state.ideaEdges,
        ideaLayoutGroups: state.ideaLayoutGroups,
        ideaZoom: state.ideaZoom,
        productionRows: state.productionRows,
        callSheetMeta: state.callSheetMeta,
        castCalls: state.castCalls,
        dailyReportMeta: state.dailyReportMeta,
        dailyReportCastActuals: state.dailyReportCastActuals,
        currentDoc: state.currentDoc,
        compareDoc: state.compareDoc,
        currentFileId: state.currentFileId,
        compareFileId: state.compareFileId,
        compareMemo: state.compareMemo,
        fanPosition: state.fanPosition,
        folderOrder: state.folderOrder,
        workspacePaneHeight: state.workspacePaneHeight,
        episodes: (state.episodes || []).map(ep => ep.id === state.activeEpisodeId ? { id: ep.id, title: ep.title, workspace: null } : ep),
        activeEpisodeId: state.activeEpisodeId || null,
        fileStores: state.fileStores,
        scriptLayout: state.scriptLayout,
        formatAssignments: state.formatAssignments,
        assetsRecognized: state.assetsRecognized,
        assetOverrides: state.assetOverrides,
        shots: state.shots,
        chunks: state.chunks,
        trash: state.trash || [],
        brief: state.brief || null,
        catalog: assetCatalog,
        writingOpen: state.writingOpen,
        assetRecognition: state.assetRecognition, mediaLibrary: state.mediaLibrary, activeStoryboardId: state.activeStoryboardId
      };
      try {
        localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(payload));
        moodioProjects.touch();
        document.dispatchEvent(new CustomEvent('moodio:assets-updated'));
        return true;
      } catch (error) {
        console.warn('Moodio 本地稿件保存失败', error);
        if (!storageWarningShown) {
          storageWarningShown = true;
          showToast('当前浏览器禁止本地存储；本次打开期间仍会保留修改');
        }
        return false;
      }
    }

    function defaultFileTitle(type, count) {
      const def = docDef(type);
      if (type === 'episodeOutline' || type === 'episodeScript' || (type === 'storyboard' && state.mode === 'series')) return `EP${String(state.episode).padStart(2, '0')} ${def.name}`;
      return count > 1 ? `${def.name} ${String(count).padStart(2, '0')}` : def.name;
    }

    // 列表中的兜底名称仅用于识别文档，不作为正文标题保存。
    function displayFileTitle(file) { return file?.title || '无标题文档'; }

    function addFile(type, options = {}) {
      if (!fileStore()[type]) fileStore()[type] = [];
      const count = fileStore()[type].length + 1;
      const file = {
        id: uniqueFileId(type),
        type,
        title: options.title ?? defaultFileTitle(type, count),
        updated: '刚刚',
        preview: options.preview || templateDescriptions[type] || '新的创作文档',
        content: options.content || '',
        shotId: options.shotId || null,
        sourceId: options.sourceId || null
      };
      fileStore()[type].push(file);
      return file;
    }

    const creationGroups = [
      { id: '前置准备', name: '前置准备', icon: 'preparation', hint: '从故事资料开始' },
      { id: '核心创作', name: '核心创作', icon: 'coreCreate', hint: '剧本与视觉风格' },
      { id: '后置拆解', name: '后置拆解', icon: 'breakdownCreate', hint: '统筹、分镜与制作记忆' },
      { id: '自定义', name: '自定义', icon: 'customCreate', hint: '自由空白稿纸' }
    ];

    const templateDescriptions = {
      cover: '剧本名、作者与一句话故事',
      synopsis: '完整故事的浓缩叙述',
      outline: '按阶段组织故事结构',
      episodeOutline: '按集管理情节与节奏',
      treatment: '场景化展开叙事与人物行动',
      script: '电影剧本的核心写作稿纸',
      episodeScript: '按集选择与编辑剧本正文',
      styleTreatment: '给 Agent 的视觉规则、生成语法与验收约束',
      scriptOrder: '按剧本顺序拆解 Scene 与场内 Shot',
      locationBreakdown: '按物理场景归并全部 Scene 与制作要素',
      dailyReport: '记录当天实际拍摄结果、素材与异常',
      dailySchedule: '按拍摄日时间线生成通告单与 Rundown',
      storyboard: '把剧本段落拆成连续镜头',
      productionLedger: '记录决策、资产、版本、成本与交付',
      custom: '从一张完全空白的稿纸开始'
    };

    function documentCount(id) {
      return filesForType(id).length;
    }

    function renderCreationToolbar() {
      const toolbar = $('#creation-toolbar');
      const trigger = $('#create-template-trigger');
      if (!toolbar || !trigger) return;
      trigger.setAttribute('aria-expanded', String(state.createMenuVisible));
      toolbar.classList.toggle('hidden', !state.createMenuVisible);
      if (!state.createMenuVisible) {
        toolbar.innerHTML = '';
        return;
      }
      if (!state.openCreateMenu) {
        toolbar.innerHTML = `<div class="create-menu-label">选择创作阶段</div>${creationGroups.map(group => `
          <button class="create-group-option" data-create-group="${group.id}" role="menuitem">
            ${icons[group.icon]}
            <span class="create-group-copy"><strong>${group.name}</strong><span>${group.hint}</span></span>
            <svg viewBox="0 0 24 24" class="icon chevron"><path d="m8 10 4 4 4-4"/></svg>
          </button>`).join('')}`;
        positionCreationMenu();
        return;
      }
      const group = creationGroups.find(item => item.id === state.openCreateMenu);
      const templates = docList().filter(doc => doc.group === state.openCreateMenu);
      toolbar.innerHTML = `<div class="create-menu-header"><button class="create-menu-back" data-create-menu-back aria-label="返回创作阶段"><svg viewBox="0 0 24 24" class="icon sm"><path d="m15 18-6-6 6-6"/></svg></button><strong>${group?.name || state.openCreateMenu}</strong></div>
        ${templates.map(doc => `<button class="template-option" data-create-template="${doc.id}" role="menuitem">
          ${icons[doc.icon]}<span class="template-copy"><strong>${doc.name}</strong><span>${templateDescriptions[doc.id]}</span></span><span class="template-count" aria-label="已有 ${documentCount(doc.id)} 个文件">${documentCount(doc.id)}</span>
        </button>`).join('')}`;
      positionCreationMenu();
    }

    function positionCreationMenu() {
      const toolbar = $('#creation-toolbar');
      const trigger = $('#create-template-trigger');
      if (!toolbar || !trigger || toolbar.classList.contains('hidden')) return;
      requestAnimationFrame(() => {
        const anchor = trigger.getBoundingClientRect();
        const menu = toolbar.getBoundingClientRect();
        const gutter = 10;
        const left = Math.min(window.innerWidth - menu.width - gutter, Math.max(gutter, anchor.left + anchor.width / 2 - menu.width / 2));
        const top = Math.max(56, anchor.top - menu.height - 10);
        toolbar.style.right = 'auto';
        toolbar.style.bottom = 'auto';
        toolbar.style.left = `${Math.round(left)}px`;
        toolbar.style.top = `${Math.round(top)}px`;
      });
    }

    const writingDocumentActions = $('.writing-head');
    function renderWritingPanel() {
      const panel = $('#writing-panel');
      const actionFocus = writingDocumentActions.contains(document.activeElement) ? document.activeElement : null;
      const selectedSlot = state.view === 'compare' ? state.selectedPageSlot : 'left';
      const sceneRows = [
        { id: 'scene1', number: '02', slug: 'INT · 雨夜车内 · 夜', meta: '梦雨、吴老师', script: 's1' },
        { id: 'scene2', number: '03', slug: 'EXT · 商场后门 · 夜', meta: '梦雨、吴老师、披萨', script: 's9' },
        { id: 'scene3', number: '08', slug: 'INT · 记忆档案室 · 日', meta: '梦雨、Tiffany', script: 's10' }
      ];
      panel.innerHTML = `
        <section class="writing-section">
          <button class="writing-blank-cta" data-writing-blank>${icons.plus}<span>新建空白页面</span></button>
          ${renderWritingSearch()}
          <div class="writing-folders ${searchState().q ? 'hidden' : ''}">${renderWritingFolders()}</div>
        </section>
        <section class="writing-section">
          <div class="writing-section-head"><span>剧本概况</span><span>实时</span></div>
          <div class="writing-stat-grid">
            <div class="writing-stat"><strong>8,432</strong><span>字数</span></div>
            <div class="writing-stat"><strong>36</strong><span>场次</span></div>
            <div class="writing-stat"><strong>112</strong><span>页数</span></div>
            <div class="writing-stat"><strong>104′</strong><span>预计时长</span></div>
          </div>
        </section>
        <div class="writing-context">${renderContextSections(sceneRows)}</div>`;
      $('.writing-search', panel)?.insertAdjacentElement('afterend', writingDocumentActions);
      actionFocus?.focus({preventScroll:true});
      if (state.workspaceMode !== 'document') {
        const story = state.workspaceMode === 'beatboard';
        const sections = panel.querySelectorAll('.writing-section');
        Array.from(sections).slice(1).forEach(section => section.remove());
        panel.insertAdjacentHTML('beforeend', `<section class="writing-section workspace-guidance"><div class="writing-section-head"><span>画布概况</span></div><p>${story ? `${state.storyBeats.filter(c => c.kind === 'beat').length} 张主线卡 · ${state.storyBeats.filter(c => c.kind === 'sub').length} 张支线卡<br>${state.storyEdges.length} 条连线` : `${state.ideaNodes.filter(n => n.type !== 'media').length} 张便签 · ${state.ideaNodes.filter(n => n.type === 'media').length} 份媒体<br>${new Set(state.ideaNodes.flatMap(n => n.tags || [])).size} 个标签`}</p></section><section class="writing-section workspace-guidance"><div class="writing-section-head"><span>${story ? '从故事骨架开始' : '随时记录'}</span></div>${story ? '<p><strong>故事卡 / Beat</strong><br>一个推动故事的变化或转折，可以关联多个场次。</p><p><strong>支线卡 / Sub card</strong><br>补充人物动机、场景细节或另一种剧情走向。</p><p class="guide-example">拖连接点到空白处，即可新建一张相连的支线卡。</p>' : '<p><strong>任何内容都可以是一张便签</strong><br>人物、对白、世界观是标签，直接输入 # 即可创建。</p><p class="guide-example">她在每一场雨后失去一段记忆。 #人物 #故事种子</p><p>按第一个标签自动分组，随时可以继续拖动、改写。</p>'}</section>`);
      }
      panel.insertAdjacentHTML('beforeend', `<section class="writing-section"><div class="writing-section-head"><span>专业制作模板</span></div>${[['scriptOrder','顺场表','按剧本顺序拆场与镜头'],['locationBreakdown','分景表','汇总同一场景的全部场次'],['dailyReport','日报表','记录实际拍摄与完成情况'],['dailySchedule','通告单','安排当日镜头与到场时间']].map(([id,name,desc]) => `<button class="template-shortcut" data-open-production="${id}" title="打开${name}">${icons.script}<span><strong>${name}</strong><small>${desc}</small></span></button>`).join('')}</section>`);
    }

    function renderCreatePlaceholder() {
      return `<section class="stack-create" aria-label="创建模板稿纸">
        <div class="stack-create-card">
          <div>
            <button class="stack-create-trigger" id="create-template-trigger" aria-label="创建模板" aria-haspopup="menu" aria-expanded="${state.createMenuVisible}">
              <svg viewBox="0 0 24 24" class="icon"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <span class="stack-create-copy">创建模板</span>
          </div>
        </div>
        <nav class="stack-create-menu hidden" id="creation-toolbar" aria-label="创建模板"></nav>
      </section>`;
    }

    function renderStack() {
      const stack = $('#stack-list');
      const ordered = docList().filter(doc => filesForType(doc.id).length);
      const totalFiles = allFiles().length;
      const expandedDoc = state.expandedStack ? docDef(state.expandedStack) : null;
      const expandedFiles = expandedDoc ? filesForType(expandedDoc.id) : [];
      $('.paper-stack').dataset.stackView = expandedDoc ? 'files' : 'types';
      $('#stack-back').classList.toggle('hidden', !expandedDoc);
      $('#stack-title').textContent = expandedDoc ? expandedDoc.name : '我的创作 My writings';
      $('#stack-count').textContent = expandedDoc ? `${expandedFiles.length} 个文件` : `${totalFiles} 份`;
      $('#stack-help').textContent = expandedDoc ? '点击文件切换页面；点击“+”创建模板。' : '拖拽稿纸到上方；点击占位卡“+”创建模板。';
      if (expandedDoc) {
        stack.innerHTML = expandedFiles.map(file => `<div class="stack-file-row ${state.currentFileId === file.id || state.compareFileId === file.id ? 'active' : ''}" data-file-id="${file.id}" data-drag-file="${file.id}" draggable="true" role="button" tabindex="0" aria-label="打开${escapeHtml(displayFileTitle(file))}">
          <span class="stack-file-copy">${state.renamingFileId === file.id ? `<input class="stack-rename-input" data-rename-input="${file.id}" value="${escapeHtml(file.title)}" maxlength="80" aria-label="重命名文件">` : `<strong>${escapeHtml(displayFileTitle(file))}</strong><span>${escapeHtml(file.updated)} · 自动保存</span>`}</span>
          <span class="stack-file-preview">${escapeHtml(file.preview || templateDescriptions[file.type] || '空白稿纸')}</span>
          <svg viewBox="0 0 24 24" class="icon sm stack-file-more" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg>
        </div>`).join('') + renderCreatePlaceholder();
      } else {
        stack.innerHTML = ordered.map(doc => {
          const files = filesForType(doc.id);
          const latest = files.at(-1);
          const active = state.currentDoc === doc.id || state.compareDoc === doc.id;
          return `<section class="stack-group">
            <div class="stack-card ${active ? 'active' : ''}" data-stack-type="${doc.id}" data-drag-file="${latest.id}" draggable="true" role="button" tabindex="0" aria-label="展开${escapeHtml(doc.name)}纸堆，共 ${files.length} 个文件">
              <div class="stack-sheet">
                <div class="stack-type-row"><div class="stack-type">${doc.en.toUpperCase()}</div><span class="stack-file-count">${files.length} 个文件</span><span class="stack-expand-mark">${icons.chevron}</span></div>
                <div class="stack-name">${escapeHtml(doc.name)}</div>
                <div class="stack-meta">${escapeHtml(latest.updated)} · 自动保存</div>
              </div>
            </div>
          </section>`;
        }).join('') + renderCreatePlaceholder();
      }
      requestAnimationFrame(() => {
        const active = $('.stack-file-row.active', stack);
        active?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        if (state.renamingFileId) {
          const input = $(`[data-rename-input="${state.renamingFileId}"]`);
          input?.focus();
          input?.select();
        }
      });
    }

    function render() {
      const oldViewport=$('.story-board-viewport,.idea-canvas-viewport');
      const previousCanvas=oldViewport ? {story:oldViewport.classList.contains('story-board-viewport'),x:oldViewport.scrollLeft,y:oldViewport.scrollTop,mapOpen:$('.story-map-details')?.open} : null;
      captureVisibleEdits();
      closeAssetMenu();
      hideAssetCard();
      renderWritingPanel();
      renderStack();
      renderCreationToolbar();
      $$('[data-recognize-assets]').forEach(button => button.classList.toggle('active', assetHighlightsEnabled(button.dataset.sourceFileId)));
      $('.workspace').classList.toggle('sidebar-collapsed', state.sidebarCollapsed);
      $('.writing-sidebar').classList.toggle('collapsed', state.sidebarCollapsed);
      $('.stage').classList.toggle('canvas-workspace-active', state.workspaceMode !== 'document');
      $('#sidebar-toggle').setAttribute('aria-expanded', String(!state.sidebarCollapsed));
      $('#sidebar-toggle').setAttribute('aria-label', state.sidebarCollapsed ? '展开写作信息侧栏' : '收起写作信息侧栏');
      $('#sidebar-toggle').setAttribute('data-tooltip', state.sidebarCollapsed ? '展开侧栏' : '收起侧栏');
      if (state.workspaceMode !== 'document') {
        $('#canvas-viewport').classList.remove('compare-mode');
        $('#focus-layout').classList.remove('hidden');
        $('#compare-layout').classList.add('hidden');
        $('#focus-layout').innerHTML = state.workspaceMode === 'beatboard' ? renderStoryBeatBoard() : renderIdeaCanvas();
        bindScriptCanvasInteractions();
        if(previousCanvas && previousCanvas.story === (state.workspaceMode === 'beatboard')) {
          const viewport=$('.story-board-viewport,.idea-canvas-viewport');viewport.scrollLeft=previousCanvas.x;viewport.scrollTop=previousCanvas.y;
          if($('.story-map-details')) $('.story-map-details').open=previousCanvas.mapOpen;
        }
        persistWorkspace();
        return;
      }
      $('#canvas-viewport').classList.toggle('compare-mode', state.view === 'compare');
      $$('.view-dock [data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view === state.view));
      $('#focus-layout').classList.toggle('hidden', state.view !== 'focus');
      $('#compare-layout').classList.toggle('hidden', state.view !== 'compare');
      if (state.view === 'focus') {
        $('#compare-script').innerHTML = ''; $('#compare-secondary').innerHTML = '';
        $('#focus-layout').innerHTML = renderDocument(state.currentDoc, { compare: false, slot: 'left', fileId: state.currentFileId });
      } else {
        $('#focus-layout').innerHTML = '';
        $('#compare-script').innerHTML = renderDocument(state.currentDoc, { compare: true, slot: 'left', fileId: state.currentFileId });
        $('#compare-secondary').innerHTML = renderDocument(state.compareDoc, { compare: true, slot: 'right', fileId: state.compareFileId });
      }
      bindEditableSave();
      bindProductionInteractions();
      persistWorkspace();
    }

    function renderCanvasAgent(kind) {
      if (!state.canvasAgentOpen) return '';
      const beatCopy = `<h3>结构诊断示例</h3><p>以下为当前示例剧本的预置建议，尚未连接实时 Agent。</p><p>目前中点的身份反转清楚，但第二幕 A 的“吴老师认识父亲”仍偏信息揭示，缺少一个可见的行动后果。</p><ul><li>把“披萨拒绝读取”提前到中点前，让它先成为有选择权的角色。</li><li>场 27–28 之后增加梦雨主动测试吴老师的 Beat。</li><li>第三幕保留“主动删除记忆”，它是主题选择而不是被动牺牲。</li></ul><div class="canvas-agent-actions"><button class="canvas-action primary" data-canvas-action="apply-beat-agent">添加示例建议卡</button><button class="canvas-action" data-canvas-action="close-canvas-agent">关闭</button></div>`;
      return `<aside class="canvas-agent-panel">${beatCopy}</aside>`;
    }

    function cardPortPoint(card,port = 'auto',otherCard = null) {
      if (!card) return null;
      if (!port || port === 'auto') {
        const center = { x:card.x + card.w / 2,y:card.y + card.h / 2 };
        const other = otherCard ? { x:otherCard.x + otherCard.w / 2,y:otherCard.y + otherCard.h / 2 } : { x:center.x + 1,y:center.y };
        const dx = other.x - center.x,dy = other.y - center.y;
        port = Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : (dy >= 0 ? 'bottom' : 'top');
      }
      const points = {
        left:{ x:card.x,y:card.y + card.h / 2,vx:-1,vy:0,port:'left' },
        right:{ x:card.x + card.w,y:card.y + card.h / 2,vx:1,vy:0,port:'right' },
        top:{ x:card.x + card.w / 2,y:card.y,vx:0,vy:-1,port:'top' },
        bottom:{ x:card.x + card.w / 2,y:card.y + card.h,vx:0,vy:1,port:'bottom' }
      };
      return points[port] || points.right;
    }

