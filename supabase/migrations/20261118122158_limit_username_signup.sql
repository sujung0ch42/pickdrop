create table pickdrop_private.signup_rate (
  caller_hash text not null,
  bucket timestamptz not null,
  attempts integer not null,
  primary key (caller_hash, bucket)
);
alter table pickdrop_private.signup_rate enable row level security;
revoke all on pickdrop_private.signup_rate from public, anon, authenticated;
grant select, insert, update, delete on pickdrop_private.signup_rate to service_role;
grant usage on schema pickdrop_private to service_role;

create function public.pickdrop_limit_signup(caller text)
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
declare
  slot timestamptz := date_trunc('minute', now());
  used integer;
begin
  delete from pickdrop_private.signup_rate where bucket < slot - interval '5 minutes';
  insert into pickdrop_private.signup_rate(caller_hash, bucket, attempts)
  values (md5(left(caller, 128)), slot, 1)
  on conflict (caller_hash, bucket) do update
    set attempts = pickdrop_private.signup_rate.attempts + 1
    where pickdrop_private.signup_rate.attempts < 5
  returning attempts into used;
  return used is not null;
end;
$$;
revoke all on function public.pickdrop_limit_signup(text) from public, anon, authenticated;
grant execute on function public.pickdrop_limit_signup(text) to service_role;
