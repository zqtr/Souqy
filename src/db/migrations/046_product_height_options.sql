alter table if exists products
  add column if not exists height_options jsonb not null default '[]'::jsonb;

update products
set height_options = '["156","165","178"]'::jsonb
where requires_height_input = true
  and (
    height_options is null
    or jsonb_typeof(height_options) <> 'array'
    or jsonb_array_length(height_options) = 0
  );
