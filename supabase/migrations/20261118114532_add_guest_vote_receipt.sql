create schema if not exists pickdrop_private;
revoke all on schema pickdrop_private from public;
grant usage on schema pickdrop_private to anon, authenticated;

-- A guest's random per-ballot UUID is the credential. Neither the share URL
-- nor any response contains this key. Only the matching ballot is readable.
create function pickdrop_private.vote_receipt(
  p_poll_id uuid, p_client_key uuid, p_option_id text,
  p_note text, p_voter_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  ballot public.votes%rowtype;
  target_poll public.polls%rowtype;
begin
  if p_poll_id is null or p_client_key is null then return null; end if;

  if p_option_id is null then
    select * into ballot from public.votes
    where poll_id = p_poll_id and client_key = p_client_key;
    if not found then return null; end if;
  else
    if length(p_option_id) not between 1 and 100
       or length(coalesce(p_note, '')) > 200
       or length(coalesce(p_voter_name, '')) > 30 then
      raise exception 'Invalid vote data';
    end if;

    select * into target_poll from public.polls where id = p_poll_id for share;
    if not found then raise exception 'Poll not found'; end if;
    if target_poll.expires_at <= clock_timestamp() then raise exception 'Poll is closed'; end if;
    if not exists (
      select 1 from jsonb_array_elements(target_poll.options) as candidate
      where candidate->>'id' = p_option_id
    ) then raise exception 'Invalid option'; end if;

    update public.votes set
      option_id = p_option_id, note = nullif(btrim(p_note), ''),
      voter_name = nullif(btrim(p_voter_name), '')
    where poll_id = p_poll_id and client_key = p_client_key
      and target_poll.expires_at > clock_timestamp()
    returning * into ballot;
    if not found then
      if target_poll.expires_at <= clock_timestamp() then raise exception 'Poll is closed'; end if;
      return null;
    end if;
  end if;

  return jsonb_build_object('option_id', ballot.option_id, 'note', ballot.note, 'voter_name', ballot.voter_name);
end;
$$;

revoke all on function pickdrop_private.vote_receipt(uuid, uuid, text, text, text) from public;
grant execute on function pickdrop_private.vote_receipt(uuid, uuid, text, text, text) to anon, authenticated;

create function public.pickdrop_vote_receipt(
  p_poll_id uuid, p_client_key uuid, p_option_id text default null,
  p_note text default null, p_voter_name text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select pickdrop_private.vote_receipt(p_poll_id, p_client_key, p_option_id, p_note, p_voter_name);
$$;

revoke all on function public.pickdrop_vote_receipt(uuid, uuid, text, text, text) from public;
grant execute on function public.pickdrop_vote_receipt(uuid, uuid, text, text, text) to anon, authenticated;
