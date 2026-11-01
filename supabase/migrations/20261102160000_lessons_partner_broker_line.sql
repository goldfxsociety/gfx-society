-- PR #54: lesson copy aligned with the partner-broker line (Ben, 2 Nov 2026, relayed by Jarvis:
-- "1. Accm lang wag na gumamit ng ibang broker 2. Yup align"). Design decisions C1/C2:
-- /workspace/gfx/design/trading-system/pr-54-broker-copy-decisions.md
--  C1: drop "You can use any broker you choose" (+ attached "or not trade at all");
--      lesson disclosure lines use only "ACCM is GFX's partner broker." (no commission wording).
--  C2: "Verify any broker's licence" -> "Verify a broker's licence";
--      "What should you check before choosing any broker?" -> "...before opening a broker account?"
--  C3 generic teaching untouched. Snapshots untouched.
-- Content-only, idempotent (plain text replace; a second run changes 0 rows).
-- NOT APPLIED: needs Ben's OK at PR review.
begin;

create or replace function pg_temp.gfx_pb(t text) returns text language sql immutable as $f$
  select replace(replace(replace(replace(replace(replace(replace(replace(replace(t,
    'Disclosure: GFX Society''s founder is an Introducing Broker (IB) for ACCM. GFX may earn a commission or rebate from partner brokers when you open an account or trade through our links. You can use any broker you choose.',
    'Disclosure: ACCM is GFX''s partner broker.'),
    'Disclosure: GFX''s founder is an Introducing Broker (IB) for ACCM. GFX may earn a commission from ACCM if you sign up through our link. You can use any broker you choose.',
    'Disclosure: ACCM is GFX''s partner broker.'),
    'GFX''s founder is an IB for ACCM and GFX may earn a commission or rebate; you can use any broker you choose.',
    'ACCM is GFX''s partner broker.'),
    'GFX''s founder is an IB for ACCM. GFX may earn a commission from ACCM if you sign up through our link. You can use any broker you choose.',
    'ACCM is GFX''s partner broker.'),
    'Verify any broker''s licence and legal entity yourself before depositing; GFX''s founder is an IB for ACCM and GFX may earn a commission or rebate.',
    'Verify a broker''s licence and legal entity yourself before depositing. ACCM is GFX''s partner broker.'),
    ' You can use any broker you choose, or not trade at all.', ''),
    ' You can use any broker you choose.', ''),
    'Verify any broker''s licence', 'Verify a broker''s licence'),
    'What should you check before choosing any broker?', 'What should you check before opening a broker account?')
$f$;

update public.lessons set
  content            = pg_temp.gfx_pb(content),
  learning_objective = pg_temp.gfx_pb(learning_objective),
  key_takeaways      = pg_temp.gfx_pb(key_takeaways::text)::jsonb,
  examples           = pg_temp.gfx_pb(examples::text)::jsonb,
  interactive_config = pg_temp.gfx_pb(interactive_config::text)::jsonb,
  updated_at         = now()
where content            is distinct from pg_temp.gfx_pb(content)
   or learning_objective is distinct from pg_temp.gfx_pb(learning_objective)
   or key_takeaways::text      is distinct from pg_temp.gfx_pb(key_takeaways::text)
   or examples::text           is distinct from pg_temp.gfx_pb(examples::text)
   or interactive_config::text is distinct from pg_temp.gfx_pb(interactive_config::text);

commit;
