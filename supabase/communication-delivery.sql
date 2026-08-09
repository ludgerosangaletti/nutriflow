-- Persistent, provider-independent idempotency for direct communications.
-- This migration is also applied in production through the Supabase SQL API.
create table if not exists public.communication_deliveries (
  delivery_key text primary key,
  channel text not null,
  notification_type text not null,
  recipient text not null,
  status text not null check (status in ('processing','sent','failed')),
  attempts integer not null default 0,
  provider_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  sent_at timestamptz
);
create index if not exists communication_deliveries_status_idx on public.communication_deliveries(status, updated_at);
alter table public.communication_deliveries enable row level security;
create or replace function public.claim_communication_delivery(
  p_delivery_key text, p_channel text, p_notification_type text, p_recipient text
) returns table(claimed boolean, current_status text, attempt_count integer)
language plpgsql security definer set search_path = public
as $$
begin
  insert into public.communication_deliveries(delivery_key, channel, notification_type, recipient, status, attempts)
  values (p_delivery_key, p_channel, p_notification_type, p_recipient, 'processing', 1)
  on conflict (delivery_key) do nothing;
  if found then return query select true, 'processing'::text, 1; return; end if;
  update public.communication_deliveries
  set status = 'processing', attempts = attempts + 1, last_error = null, updated_at = now()
  where delivery_key = p_delivery_key
    and (status = 'failed' or (status = 'processing' and updated_at < now() - interval '10 minutes'));
  if found then
    return query select true, status, attempts from public.communication_deliveries where delivery_key = p_delivery_key;
    return;
  end if;
  return query select false, status, attempts from public.communication_deliveries where delivery_key = p_delivery_key;
end;
$$;
revoke execute on function public.claim_communication_delivery(text,text,text,text) from public, anon, authenticated;
grant execute on function public.claim_communication_delivery(text,text,text,text) to service_role;
