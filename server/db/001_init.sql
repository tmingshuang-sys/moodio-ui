-- WoW 后端初始库表。
-- 几条贯穿全表的约定：
--   ① 一开始只有一个用户，但所有业务表都挂 user_id，以后开放注册不用改结构（这是现在补最便宜、以后补最贵的地方）。
--   ② 主键沿用前端已经在用的字符串 id（uid('d') / uid('m') 这种），这样同步不需要做 id 映射。
--   ③ updated_at 是同步的依据：推上来的记录比库里新才覆盖（last-write-wins），冲突不做合并，由前端在 UI 上提示。
--   ④ 删除一律软删：deleted_at 有值即视为已删，这样删除也能同步出去，而不是「没推上来 = 不知道删没删」。
--   ⑤ 媒体二进制不进库，放对象存储（OSS / 本机磁盘），这里只记 object_key 与元数据。

create table if not exists users (
  id            text primary key,
  email         text unique not null,
  name          text not null default '',
  password_hash text not null,
  created_at    timestamptz not null default now()
);

create table if not exists sessions (
  token      text primary key,
  user_id    text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists sessions_user on sessions(user_id);

create table if not exists projects (
  id         text primary key,
  user_id    text not null references users(id) on delete cascade,
  title      text not null default '新创作',
  brief      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists projects_user on projects(user_id, updated_at desc);

create table if not exists docs (
  id         text primary key,
  project_id text not null references projects(id) on delete cascade,
  name       text not null,
  kind       text not null default 'md',          -- md / json / txt
  content    text not null default '',
  by         text not null default 'agent',       -- agent / user / import
  chat_id    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists docs_project on docs(project_id, updated_at desc);

create table if not exists media (
  id         text primary key,
  project_id text not null references projects(id) on delete cascade,
  name       text not null,
  kind       text not null,                       -- image / video / audio
  mime       text not null default '',
  size       bigint not null default 0,
  grp        text not null default '其他',         -- 分区：人物 / 场景 / 产品 / 成片 / 配乐 / 配音 …
  by         text not null default 'agent',
  width      int,
  height     int,
  model      text,                                -- 生成它的模型名；代码渲染的写「代码渲染」
  duration   double precision,
  voice_id   text,
  compose    jsonb,                               -- 成片的配方：片段、字幕、配乐
  object_key text,                                -- 对象存储里的键；为空表示文件还没上传上来
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists media_project on media(project_id, updated_at desc);

create table if not exists chats (
  id         text primary key,
  project_id text not null references projects(id) on delete cascade,
  title      text not null default '新对话',
  messages   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index if not exists chats_project on chats(project_id, updated_at desc);

-- 服务端渲染任务。画面方案整份存进来，渲染机只认这一份，和前端的文稿解耦：
-- 用户在前端改了方案再渲是新建一条任务，老任务与它产出的成片仍然对得上。
create table if not exists render_jobs (
  id          text primary key,
  user_id     text not null references users(id) on delete cascade,
  project_id  text references projects(id) on delete set null,
  doc_id      text,                               -- 来自哪份「画面-NN.json」
  spec        jsonb not null,
  status      text not null default 'queued',     -- queued / running / done / failed / canceled
  stage       text not null default '',           -- 当前在干什么：渲染画面 / 合成配音 / 混音 / 封装
  progress    double precision not null default 0,
  error       text,
  readcheck   jsonb,                              -- 可读时间自检的结果
  media_id    text,                               -- 渲染产出的成片，对应 media.id
  object_key  text,
  created_at  timestamptz not null default now(),
  started_at  timestamptz,
  finished_at timestamptz
);
create index if not exists render_jobs_user on render_jobs(user_id, created_at desc);
create index if not exists render_jobs_pending on render_jobs(status) where status in ('queued', 'running');
