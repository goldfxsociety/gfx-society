-- ==========================================================
-- Phase 2A: GFX Academy Diagnostic
--
-- Additive only. Does not touch lessons, levels, lesson_progress,
-- assessment_attempts, analytics_events, or any Phase 0/1 RLS policy.
-- This is the first versioned migration file in this repo — Phase 0/1
-- were applied as one-off SQL and are intentionally NOT retroactively
-- captured here.
-- ==========================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------
-- 1. diagnostic_questions — canonical question bank.
-- question_type/difficulty are plain text (no CHECK constraint),
-- matching this project's existing convention for lessons.lesson_type,
-- which is also an unconstrained text column.
-- ----------------------------------------------------------
create table diagnostic_questions (
  id uuid primary key default gen_random_uuid(),
  question_key text unique not null,
  competency_key text not null,
  question text not null,
  options jsonb not null,
  correct_index integer not null,
  explanation text not null,
  chart jsonb,
  question_type text not null,
  difficulty text not null,
  order_index integer not null,
  is_published boolean not null default true
);

-- ----------------------------------------------------------
-- 2. diagnostic_sessions — one row per diagnostic attempt.
-- ----------------------------------------------------------
create table diagnostic_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  status text not null default 'in_progress',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  competency_scores jsonb,
  recommended_level_id uuid references levels(id),
  recommended_lesson_id uuid references lessons(id)
);

-- ----------------------------------------------------------
-- 3. diagnostic_answers — one row per answered (or skipped) question.
-- UNIQUE(session_id, question_id) makes re-submission idempotent
-- (upsert, not a duplicate row) so a double-click or network retry
-- can never inflate the answered-count denominator or duplicate a
-- correct/incorrect tally.
-- ----------------------------------------------------------
create table diagnostic_answers (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references diagnostic_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  question_id uuid not null references diagnostic_questions(id),
  competency_key text not null,
  selected_index integer,     -- null = explicitly skipped
  correct boolean,            -- null = skipped; set ONLY by submit_diagnostic_answer, never client-supplied
  answered_at timestamptz not null default now(),
  unique (session_id, question_id)
);

-- ==========================================================
-- RLS
-- ==========================================================

alter table diagnostic_questions enable row level security;
create policy "anyone can read published diagnostic questions" on diagnostic_questions
  for select using (is_published = true);

alter table diagnostic_sessions enable row level security;
create policy "users can view own diagnostic sessions" on diagnostic_sessions
  for select using (auth.uid() = user_id);
create policy "users can insert own diagnostic sessions" on diagnostic_sessions
  for insert with check (auth.uid() = user_id);
create policy "users can update own diagnostic sessions" on diagnostic_sessions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
-- No delete policy — sessions are never deleted by the client.

alter table diagnostic_answers enable row level security;
create policy "users can view own diagnostic answers" on diagnostic_answers
  for select using (auth.uid() = user_id);
-- Deliberately NO insert/update/delete policy for anon/authenticated.
-- An insert policy that only checked auth.uid() = user_id would let a
-- client write {correct: true} directly for any question, bypassing
-- grading entirely. The only legitimate write path is through
-- submit_diagnostic_answer / skip_diagnostic_question, which are
-- SECURITY DEFINER and therefore execute as the function owner — a
-- role with BYPASSRLS — so they can write here even with no policy
-- granting the calling role direct access.

-- ==========================================================
-- Column-level privilege restriction on diagnostic_questions
--
-- RLS is row-level only — a policy that lets a role SELECT a row hands
-- over every column in that row, including correct_index/explanation.
-- Column-level GRANTs are a separate, orthogonal Postgres privilege
-- system that this restricts independently of the RLS policy above.
-- ==========================================================

revoke select on diagnostic_questions from anon, authenticated;

grant select (
  id,
  question_key,
  competency_key,
  question,
  options,
  chart,
  question_type,
  difficulty,
  order_index
) on diagnostic_questions to anon, authenticated;

-- anon is included only for defense-in-depth consistency with the
-- rest of this table's grants; the diagnostic itself is login-required
-- to start, per the approved design, so anon never actually reaches
-- this table in normal app usage.

-- ==========================================================
-- Server-side grading RPC
--
-- SECURITY DEFINER lets this function read correct_index internally
-- even though the calling role's column grant (above) forbids it from
-- doing so directly. search_path is pinned to prevent search_path
-- hijacking (there is no prior SECURITY DEFINER function in this
-- project to follow a precedent from, so this establishes the
-- baseline convention going forward).
-- ==========================================================

create or replace function submit_diagnostic_answer(
  p_session_id uuid,
  p_question_id uuid,
  p_selected_index integer
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_correct_index integer;
  v_competency text;
  v_is_correct boolean;
begin
  -- Ownership check: this is the entire defense against one user
  -- submitting into another user's session.
  if not exists (
    select 1 from diagnostic_sessions
    where id = p_session_id and user_id = auth.uid()
  ) then
    raise exception 'not your session';
  end if;

  select correct_index, competency_key
    into v_correct_index, v_competency
    from diagnostic_questions
    where id = p_question_id and is_published = true;

  if v_correct_index is null then
    raise exception 'question not found or not published';
  end if;

  v_is_correct := (p_selected_index = v_correct_index);

  insert into diagnostic_answers (session_id, question_id, competency_key, selected_index, correct)
  values (p_session_id, p_question_id, v_competency, p_selected_index, v_is_correct)
  on conflict (session_id, question_id)
  do update set selected_index = excluded.selected_index,
                correct = excluded.correct,
                answered_at = now();

  insert into analytics_events (event_name, entity_id, metadata, user_id)
  values (
    'diagnostic_question_answered',
    p_question_id,
    jsonb_build_object('competency_key', v_competency, 'correct', v_is_correct, 'skipped', false),
    auth.uid()
  );

  return v_is_correct;
end;
$$;

revoke execute on function submit_diagnostic_answer(uuid, uuid, integer) from public;
grant execute on function submit_diagnostic_answer(uuid, uuid, integer) to authenticated;

-- ==========================================================
-- Skip-a-question path — same ownership/shape guarantees as above,
-- but with no correctness to compute (selected_index/correct both
-- null). Kept as a separate function rather than overloading
-- submit_diagnostic_answer with a nullable selected_index, so the
-- "skip" intent is explicit at the call site and can never be
-- confused with an accidental null submission.
-- ==========================================================

create or replace function skip_diagnostic_question(
  p_session_id uuid,
  p_question_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_competency text;
begin
  if not exists (
    select 1 from diagnostic_sessions
    where id = p_session_id and user_id = auth.uid()
  ) then
    raise exception 'not your session';
  end if;

  select competency_key into v_competency
    from diagnostic_questions
    where id = p_question_id and is_published = true;

  if v_competency is null then
    raise exception 'question not found or not published';
  end if;

  insert into diagnostic_answers (session_id, question_id, competency_key, selected_index, correct)
  values (p_session_id, p_question_id, v_competency, null, null)
  on conflict (session_id, question_id)
  do update set selected_index = null, correct = null, answered_at = now();

  insert into analytics_events (event_name, entity_id, metadata, user_id)
  values (
    'diagnostic_question_answered',
    p_question_id,
    jsonb_build_object('competency_key', v_competency, 'correct', null, 'skipped', true),
    auth.uid()
  );
end;
$$;

revoke execute on function skip_diagnostic_question(uuid, uuid) from public;
grant execute on function skip_diagnostic_question(uuid, uuid) to authenticated;

-- ==========================================================
-- Post-completion results/review RPC
--
-- Only ever returns correct_index/explanation for a session that is
-- already 'completed' and owned by the caller — safe at that point
-- because the diagnostic is over.
-- ==========================================================

create or replace function get_diagnostic_results(p_session_id uuid)
returns table (
  question_id uuid,
  question text,
  options jsonb,
  selected_index integer,
  correct boolean,
  correct_index integer,
  explanation text,
  competency_key text
)
language sql
security definer
set search_path = public, pg_temp
as $$
  select
    q.id,
    q.question,
    q.options,
    a.selected_index,
    a.correct,
    q.correct_index,
    q.explanation,
    q.competency_key
  from diagnostic_answers a
  join diagnostic_questions q on q.id = a.question_id
  join diagnostic_sessions s on s.id = a.session_id
  where a.session_id = p_session_id
    and s.user_id = auth.uid()
    and s.status = 'completed';
$$;

revoke execute on function get_diagnostic_results(uuid) from public;
grant execute on function get_diagnostic_results(uuid) to authenticated;

-- ==========================================================
-- Seed: 22 approved diagnostic questions.
-- Idempotent — safe to re-run; question_key is the stable identity.
-- ==========================================================

insert into diagnostic_questions
  (question_key, competency_key, question, options, correct_index, explanation, chart, question_type, difficulty, order_index)
values
  (
    'foundations_going_long', 'foundations',
    'You buy Gold at $2,300 because you expect the price to rise. What is this trading direction called?',
    '["Going long (buy first, sell higher later)", "Going short", "Hedging", "Scalping"]'::jsonb,
    0,
    'Going long means buying first and selling higher later — the most basic way traders aim to profit.',
    null, 'scenario', 'beginner', 1
  ),
  (
    'foundations_safe_haven', 'foundations',
    'Why is Gold often called a "safe-haven" asset?',
    '["Investors often move money into Gold during fear or uncertainty, which tends to support its price", "Gold always rises every single day no matter what", "Gold carries no price risk at all", "Gold is immune to market crashes"]'::jsonb,
    0,
    'Gold is considered a safe-haven because investors often seek it out during uncertain times — but "tends to" isn''t a guarantee; Gold can still fall even during uncertainty.',
    null, 'mcq', 'beginner', 2
  ),
  (
    'foundations_spread_calculation', 'foundations',
    'Bid is $2,300.00, Ask is $2,300.30. What is the spread?',
    '["30 pips", "0 pips", "300 pips", "$2,300.30"]'::jsonb,
    0,
    'The spread is the gap between Bid and Ask — here, $0.30 = 30 pips on Gold.',
    null, 'calculation', 'beginner', 3
  ),
  (
    'platform_order_types', 'platform',
    'You want to buy Gold only if price drops to a specific lower level. Which order fits?',
    '["Limit order", "Market order", "Stop order", "Take-profit order"]'::jsonb,
    0,
    'A limit order executes at a specific price or better — exactly this situation.',
    null, 'scenario', 'intermediate', 4
  ),
  (
    'platform_demo_purpose', 'platform',
    'You want to test a brand-new strategy without risking real money. What should you use first?',
    '["A demo account", "Maximum leverage", "A live account with a small deposit", "Skip testing and go straight to live"]'::jsonb,
    0,
    'A demo account uses virtual money on real market data — the safe way to test anything new.',
    null, 'scenario', 'beginner', 5
  ),
  (
    'price_action_bullish_bearish', 'price_action',
    'Is this candle bullish or bearish?',
    '["Bullish — close is above open", "Bearish", "Neither, it''s a doji", "Can''t tell without volume"]'::jsonb,
    0,
    'Close above open = bullish (green) candle.',
    '[{"o":2300,"h":2318,"l":2298,"c":2314}]'::jsonb,
    'chart_interpretation', 'beginner', 6
  ),
  (
    'price_action_doji', 'price_action',
    'What does this candle shape typically represent?',
    '["Indecision between buyers and sellers (Doji)", "Strong bullish momentum", "Strong bearish momentum", "A broken chart"]'::jsonb,
    0,
    'A Doji''s tiny body with wicks on both sides signals indecision, not a clear winner between buyers and sellers.',
    '[{"o":2306,"h":2314,"l":2298,"c":2306.5}]'::jsonb,
    'identification', 'intermediate', 7
  ),
  (
    'price_action_patterns_not_guaranteed', 'price_action',
    'Does a candlestick pattern guarantee what price does next?',
    '["No — it''s a clue, always wait for confirmation", "Yes, patterns always play out", "Yes, but only on Gold", "No, patterns never matter"]'::jsonb,
    0,
    'A pattern is a clue, not a guarantee — confirmation matters more than the shape alone.',
    null, 'mcq', 'beginner', 8
  ),
  (
    'market_structure_uptrend', 'market_structure',
    'What trend is this price action showing?',
    '["Uptrend (Higher Highs, Higher Lows)", "Downtrend", "Sideways range", "Reversal"]'::jsonb,
    0,
    'Each high and low is higher than the last — the definition of an uptrend.',
    '[{"o":2280,"h":2290,"l":2276,"c":2288},{"o":2288,"h":2300,"l":2284,"c":2298},{"o":2298,"h":2308,"l":2292,"c":2305},{"o":2305,"h":2318,"l":2300,"c":2315}]'::jsonb,
    'chart_interpretation', 'beginner', 9
  ),
  (
    'market_structure_support', 'market_structure',
    'Price keeps bouncing off this level without breaking through. What is it?',
    '["Support", "Resistance", "A pivot order", "The spread"]'::jsonb,
    0,
    'A level where buying pressure repeatedly overpowers selling pressure is support.',
    '[{"o":2310,"h":2312,"l":2291,"c":2305},{"o":2305,"h":2308,"l":2298,"c":2302},{"o":2302,"h":2306,"l":2290,"c":2304},{"o":2304,"h":2309,"l":2295,"c":2300},{"o":2300,"h":2303,"l":2290,"c":2301}]'::jsonb,
    'chart_interpretation', 'beginner', 10
  ),
  (
    'market_structure_role_reversal', 'market_structure',
    'Price breaks above resistance, pulls back, and holds above it. What does that old resistance usually become?',
    '["New support (role reversal)", "It disappears completely", "It becomes the spread", "It becomes a stop loss"]'::jsonb,
    0,
    'Broken resistance often flips into new support — role reversal.',
    null, 'scenario', 'intermediate', 11
  ),
  (
    'technical_tools_rsi_overbought', 'technical_tools',
    'RSI is reading 75. What does this generally suggest?',
    '["Possibly overbought — a potential (not guaranteed) pullback zone", "A guaranteed sell signal", "A meaningless number", "An oversold condition"]'::jsonb,
    0,
    'Above 70 suggests overbought, but it''s never a guaranteed reversal signal on its own.',
    null, 'scenario', 'intermediate', 12
  ),
  (
    'technical_tools_timeframes', 'technical_tools',
    'A trader checks the Daily chart before entering any trade on a lower timeframe. What is the Daily chart mainly helping them decide?',
    '["The overall trend direction", "The exact entry price", "The spread cost", "The lot size"]'::jsonb,
    0,
    'Higher timeframes set the trend bias; lower timeframes are for timing the entry.',
    null, 'scenario', 'intermediate', 13
  ),
  (
    'gold_session_volatility', 'gold',
    'Gold tends to be most active during which window (Manila time)?',
    '["The London–New York overlap, roughly 9 PM–12 AM", "Early Manila morning, 6–8 AM", "Equally active 24 hours a day", "Only during weekends"]'::jsonb,
    0,
    'The London-NY overlap is generally the highest-volatility window of the trading day.',
    null, 'scenario', 'intermediate', 14
  ),
  (
    'setups_trading_plan_purpose', 'setups',
    'You''re about to enter a trade but haven''t decided your stop loss, target, or risk amount in advance. What is this missing?',
    '["A trading plan", "A broker account", "A demo account", "The spread"]'::jsonb,
    0,
    'A trading plan defines entry, SL/TP, and risk rules in advance — exactly what''s missing here.',
    null, 'scenario', 'beginner', 15
  ),
  (
    'setups_backtesting_purpose', 'setups',
    'Before risking real money on a new trading rule, what should a trader do first to see how it would have performed?',
    '["Backtest it against historical price action", "Use maximum leverage immediately", "Skip straight to live trading", "Ask a broker to guarantee results"]'::jsonb,
    0,
    'Backtesting tests a rule against the past before any real money is on the line.',
    null, 'scenario', 'intermediate', 16
  ),
  (
    'risk_management_risk_per_trade', 'risk_management',
    'Account = $1,000, following the 1–2% rule. Roughly how much should you risk per trade?',
    '["$10–$20", "$100–$200", "$500", "The whole account"]'::jsonb,
    0,
    '1–2% of $1,000 is $10–$20.',
    null, 'calculation', 'beginner', 17
  ),
  (
    'risk_management_stop_loss', 'risk_management',
    'Is it ever okay to skip your stop loss if you''re very confident about a trade?',
    '["No — never trade without a stop loss, no exceptions", "Yes, if experienced", "Yes, always skip it on Gold", "Only on demo accounts"]'::jsonb,
    0,
    'A stop loss is non-negotiable regardless of confidence level.',
    null, 'scenario', 'beginner', 18
  ),
  (
    'risk_management_rr_win_rate', 'risk_management',
    'A strategy wins 40% of the time at 1:2 RR (risk $10 to make $20). Over many trades, this is:',
    '["Likely profitable overall, even though it loses more often than it wins", "Guaranteed to lose money", "Guaranteed to make a fixed profit", "Impossible to evaluate"]'::jsonb,
    0,
    'Win rate and risk-reward together determine profitability — 40%×$20 − 60%×$10 is positive expectancy.',
    null, 'calculation', 'intermediate', 19
  ),
  (
    'psychology_revenge_trading', 'psychology',
    'You lose 3 trades in a row, so you open a much bigger position to "win it back" fast. This is:',
    '["Revenge trading", "A solid trading plan", "Smart risk management", "Dollar-cost averaging"]'::jsonb,
    0,
    'Trying to immediately recover losses with a bigger, unplanned trade is the definition of revenge trading.',
    null, 'scenario', 'beginner', 20
  ),
  (
    'psychology_fomo', 'psychology',
    'Gold spikes 50 pips without you in the trade, so you jump in immediately with no plan. This is:',
    '["FOMO (Fear Of Missing Out)", "Backtesting", "A trading plan", "Risk management"]'::jsonb,
    0,
    'Jumping in on a move you missed, with no plan, is the textbook definition of FOMO.',
    null, 'scenario', 'beginner', 21
  ),
  (
    'journaling_reason_for_entry', 'journaling',
    'Two trades both lose money. One followed the trading plan exactly; the other was an impulsive entry with no plan. Should a journal record them the same way?',
    '["No — the reason for entry matters, not just the result", "Yes, a loss is a loss", "Only wins should be journaled", "Journaling is only for taxes"]'::jsonb,
    0,
    'The same result (a loss) means something very different depending on whether the entry was planned or impulsive.',
    null, 'scenario', 'intermediate', 22
  )
on conflict (question_key) do nothing;
