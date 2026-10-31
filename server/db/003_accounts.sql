-- 账号第二步：管理员、邀请码注册、密码重置。
-- 第一个建的账号就是管理员（装机时用一次性口令建的那个）。只有管理员能改服务器设置（模型 key、邀请码、OSS）、
-- 看账号列表、给别人生成密码重置链接；普通账号只能动自己的数据。
alter table users add column if not exists is_admin boolean not null default false;
update users set is_admin = true where id = (select id from users order by created_at asc limit 1);

-- 密码重置链接。存的是 token 的 SHA-256 而不是 token 本身：库泄露了也拿不到能用的链接。
-- 用过即标 used_at，24 小时过期；两者之一不满足就作废。
create table if not exists password_resets (
  token_hash text primary key,
  user_id    text not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);
create index if not exists password_resets_user on password_resets(user_id);
