revoke select on public.votes from authenticated;
grant select (id, poll_id, option_id, voter_name, note, created_at) on public.votes to authenticated;
