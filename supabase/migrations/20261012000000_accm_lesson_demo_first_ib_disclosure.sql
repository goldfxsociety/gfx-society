-- Reorder 'opening-your-accm-account': (1) free demo in the MT5 app (no ACCM
-- registration), (2) check the broker's licence for your country, (3) optional
-- cents account via the IB link (real money, start small, 1% risk, stop-loss).
-- Also replaces the lesson's IB disclosure with the short site-wide line
-- (no unverified licensing or cost claims). This is the
-- ONLY published lesson containing the IB disclosure (checked read-only).
-- No quiz on this lesson (interactive_config is null): no correct_index impact.
--
-- Guarded + idempotent: updates only while content has today's live md5
-- b1aba773c9d9fa07df2147e622441953; after apply md5 = 8ff402abb8997fc42d0fed9c551ef5d7, so re-runs are no-ops.
-- NOT APPLIED. Sorts after every recorded version (latest 20261011130426) and
-- after all repo migration files.

update public.lessons
set content = $gfx$This lesson shows the general steps to get started with ACCM, the broker used in the Academy's examples. You can use any broker you choose, or not trade at all.

Disclosure: GFX's founder is an Introducing Broker (IB) for ACCM. GFX may earn a commission from ACCM if you sign up through our link. You can use any broker you choose. Education only, not financial advice.

Steps to get started:
1. Create a free DEMO account in the MT5 app first. No ACCM registration is needed: install MT5, open the menu, choose to open a new account, search for your broker's demo server, and fill in the short demo form. Practise there for several weeks (1% max risk, stop-loss on every trade).
2. Check the broker's licence for your country and the legal entity you would sign up with, on the regulator's own public register.
3. Optional, and only after several weeks of following your trading plan consistently on demo: register a cents account (real money; balance shown in cents, very small lot sizes) through GFX's IB link, complete KYC (ID + selfie), and start small with money you can afford to lose. Minimum deposit: $50 (as of Oct 2026), via GCash, Maya, or other e-wallets; check ACCM's site for current terms. Max 1% risk per trade, stop-loss on every trade.

Sa Taglish: Demo muna sa MT5 app, walang ACCM registration. I-check ang licence ng broker para sa bansa mo. Optional lang ang cents account: real money, start small, max 1% risk, laging may stop-loss.$gfx$,
    key_takeaways = $gfx$["Start with a free demo in the MT5 app (no broker registration needed), then check the broker's licence for your country.", "A cents account through the IB link is optional and uses real money: only after weeks of following your plan on demo, start small, max 1% risk per trade, stop-loss on every trade.", "GFX's founder is an IB for ACCM. GFX may earn a commission from ACCM if you sign up through our link. You can use any broker you choose."]$gfx$::jsonb,
    learning_objective = $gfx$Understand how to start on a free MT5 demo, check a broker's licence for your country, and the optional step to a cents account.$gfx$,
    updated_at = now()
where slug = 'opening-your-accm-account'
  and md5(content) = 'b1aba773c9d9fa07df2147e622441953';
