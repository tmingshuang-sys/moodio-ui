-- 两件小事：
--   ① media.purged_at —— 删掉超过 30 天的媒体，文件从存储里清掉之后记在这里（行不删，同步还要靠它知道「这条删了」）
--   ② users.disabled_at —— 停用账号：登不进、会话全作废、数据原样留着，随时恢复
alter table media add column if not exists purged_at timestamptz;
alter table users add column if not exists disabled_at timestamptz;
create index if not exists media_purge on media(deleted_at) where deleted_at is not null and purged_at is null and object_key is not null;
