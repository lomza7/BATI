-- iCloud Calendar (CalDAV) integration
-- Stores app-specific password credentials for iCloud CalDAV sync

create table if not exists icloud_calendar_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  apple_id text not null,
  app_password text not null,
  caldav_url text not null default 'https://caldav.icloud.com',
  calendar_url text,
  sync_token text,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id)
);

alter table icloud_calendar_connections enable row level security;

create policy "Users can manage their own iCloud connection"
  on icloud_calendar_connections
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Add icloud_event_id to calendar_events for tracking synced events
alter table calendar_events add column if not exists icloud_event_id text;
create index if not exists idx_calendar_events_icloud_event_id on calendar_events(icloud_event_id);
