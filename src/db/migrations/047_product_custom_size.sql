alter table if exists products
  add column if not exists allow_custom_size boolean not null default false;
