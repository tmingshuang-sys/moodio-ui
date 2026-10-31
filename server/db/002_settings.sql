-- 服务端配置：模型 key 等。以前只能改 .env 再重启，意味着每次都要进终端，
-- 现在存库、界面上改、立刻生效。.env 里的值作为兜底：库里没有这一项时用 .env 的。
--
-- 安全上要清楚：key 在库里是明文，和放在 .env 里是同一个量级的风险（能读到库 = 能读到机器上的文件）。
-- 换来的是不用再开终端。真要再紧一档，得上 KMS 或者密钥托管，那是以后的事。
create table if not exists settings (
  key        text primary key,
  value      text not null default '',
  updated_at timestamptz not null default now(),
  updated_by text
);

-- 首次安装时写进来的一次性口令：没有任何用户时，拿着它才能创建第一个账号。
-- 用完即删——否则它就是一把permanent的后门钥匙。
create table if not exists setup_tokens (
  token      text primary key,
  created_at timestamptz not null default now(),
  used_at    timestamptz
);
