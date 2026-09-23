# Scheduled jobs

One job so far: the **group-chat digest**, which emails people about
messages they've missed. It does nothing until something calls it on a
schedule — the code is deployed, but until you do one of the two setups
below, no digest emails are ever sent.

Everything here is a dashboard/console task. None of it lives in the
repo, because both options need secrets.

---

## What the job does

`POST /api/hooks/chat-digest` looks for members with unread group-chat
messages, batches them into one email per person, and records what it
sent. Full rules are in `supabase/migrations/0043_group_chat_digest.sql`.

It is **safe to call often**. Every send is recorded against the exact
newest message it covered, so a double-fire or an overlapping run sends
nothing twice. Calling it every 15 minutes is fine; so is every hour.

Requirements before it can send anything:

| Variable | Where | Why |
| --- | --- | --- |
| `NOTIFICATION_WEBHOOK_SECRET` | Vercel | Authenticates the caller. Without it the route returns 401 and never runs. |
| `RESEND_API_KEY` | Vercel | Without it `sendEmail()` is a silent no-op — the job runs and reports success, but nobody gets mail. |
| `EMAIL_FROM` | Vercel | The from address; same no-op rule as above. |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel | The job reads recipients' email addresses, which RLS hides. |

Vercel only applies environment variables to deployments created *after*
they're added. If something here is visibly set but behaving as if it
isn't, redeploy.

---

## Option A — Supabase pg_cron (recommended)

Works on the free tier, and keeps the schedule next to the data. Run
this once in the Supabase SQL editor, replacing the two placeholders:

```sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'chat-digest',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := 'https://YOUR-DOMAIN/api/hooks/chat-digest',
    headers := jsonb_build_object(
      'Content-Type',     'application/json',
      'x-webhook-secret', 'YOUR-NOTIFICATION-WEBHOOK-SECRET'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

Check it is running:

```sql
select * from cron.job;                                  -- is it scheduled?
select * from cron.job_run_details order by start_time desc limit 10;  -- did it fire?
```

To change the frequency, `select cron.unschedule('chat-digest');` then
schedule it again. Note the secret is stored in the job definition, so
anyone with SQL-editor access can read it — that's the same trust level
as the service-role key, which they'd already have.

## Option B — Vercel Cron

Add `vercel.json` at the repo root:

```json
{
  "crons": [{ "path": "/api/hooks/chat-digest", "schedule": "*/15 * * * *" }]
}
```

Two catches:

1. **Hobby plans only allow one run per day**, which makes the digest
   nearly useless. Frequent schedules need Pro.
2. Vercel Cron sends no custom headers, so the route's shared-secret
   check would reject it. Using this option means also accepting
   Vercel's `Authorization: Bearer $CRON_SECRET` header in
   `app/api/hooks/chat-digest/route.ts`.

Option A avoids both, which is why it's the recommendation.

---

## Tuning

Both constants are at the top of `app/api/hooks/chat-digest/route.ts`:

- `QUIET_MINUTES` (30) — how long a message must sit unanswered before
  it counts. Raise it if people feel emailed mid-conversation.
- `COOLDOWN_MINUTES` (180) — the most often one person can be emailed
  about one group. Raise it if the digest feels naggy.

Neither needs a migration; they're passed into the SQL function as
arguments.

## Checking it by hand

```bash
curl -X POST https://YOUR-DOMAIN/api/hooks/chat-digest \
  -H "x-webhook-secret: YOUR-NOTIFICATION-WEBHOOK-SECRET"
```

Returns `{"sent":N,"recipients":N}`. `{"sent":0}` usually means nobody
has qualifying unread messages — which is the normal, healthy answer
most of the time.
