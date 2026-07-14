-- Run once in the linked project after deploying process-ai-jobs.
-- Replace placeholders interactively; never commit real values.
-- The same worker secret must be configured as the Edge secret AI_WORKER_SECRET.

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault;

select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'flove_project_url',
  'F-Love Edge Functions base URL'
);

select vault.create_secret(
  'REPLACE_WITH_A_LONG_RANDOM_WORKER_SECRET',
  'flove_ai_worker_secret',
  'Authenticates the durable F-Love AI queue consumer'
);

select cron.schedule(
  'flove-ai-worker-every-minute',
  '* * * * *',
  $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'flove_project_url')
      || '/functions/v1/process-ai-jobs',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Worker-Secret', (select decrypted_secret from vault.decrypted_secrets where name = 'flove_ai_worker_secret')
    ),
    body := '{"batchSize":5}'::jsonb,
    timeout_milliseconds := 55000
  );
  $$
);
