begin;

update updates
   set title = case
         when title ~* '\bdpl_[a-z0-9_]+\b|deployment|deployed|deploy|production|vercel'
           then 'Souqna update'
         else title
       end,
       body = case
         when body ~* '\bdpl_[a-z0-9_]+\b|deployment|deployed|deploy|production|vercel'
           then 'Souqna improvements are ready to explore.'
         else body
       end,
       summary = case
         when summary is null
           or summary ~* '\bdpl_[a-z0-9_]+\b|deployment|deployed|deploy|production|vercel'
           then 'Souqna improvements are ready to explore.'
         else summary
       end,
       badge = 'Update',
       version = case
         when version ~* '^(push|deployment):'
           then 'update:' || left(id::text, 8)
         else version
       end,
       preview_payload = jsonb_build_object(
         'kind', 'souqna-update',
         'route', '/account',
         'source', 'souqna'
       ),
       banner_payload = '{}'::jsonb,
       updated_at = now()
 where version ~* '^(push|deployment):'
    or title ~* '\bdpl_[a-z0-9_]+\b|deployment|deployed|deploy|production|vercel'
    or body ~* '\bdpl_[a-z0-9_]+\b|deployment|deployed|deploy|production|vercel'
    or coalesce(summary, '') ~* '\bdpl_[a-z0-9_]+\b|deployment|deployed|deploy|production|vercel';

commit;
