-- Reorder 'opening-your-accm-account': (1) free demo in the MT5 app (no ACCM
-- registration), (2) check the broker's licence for your country, (3) optional
-- cents account via the IB link (real money, start small, 1% risk, stop-loss).
-- Also replaces the lesson's IB disclosure with the site-wide compliance-baseline
-- text (no "no extra cost" claim, no unverified licensing claim). This is the
-- ONLY published lesson containing the IB disclosure (checked read-only).
-- No quiz on this lesson (interactive_config is null): no correct_index impact.
--
-- Guarded + idempotent: updates only while content has today's live md5
-- b1aba773c9d9fa07df2147e622441953; after apply md5 = 8efeefd190a9c4ae11d15687c52c7094, so re-runs are no-ops.
-- NOT APPLIED. Sorts after every recorded version (latest 20261011130426) and
-- after all repo migration files.

update public.lessons
set content = $gfx$This lesson shows the general steps to get started with ACCM, the broker used in the Academy's examples. You can use any broker you choose, or not trade at all.

Disclosure: GFX's founder is an Introducing Broker (IB) for ACCM. If you open an ACCM account through our link or code bqqaoy, ACCM may pay us a commission or rebate, which under ACCM's IB program is usually based on trading volume. That means we earn more when referred clients trade more. That's why we teach demo first, max 1% risk, and never push over-trading. You don't have to use our link or any broker. The Academy is free. The ACCM link opens a live cents account registration (real money; check the current minimum deposit and funding methods on ACCM's site); free demos are opened in the MT5 app. Check the broker's licensing for your country before opening an account. Trading involves real risk of loss. Education only, not financial advice.

Steps to get started:
1. Create a free DEMO account in the MT5 app first. No ACCM registration is needed: install MT5, open the menu, choose to open a new account, search for your broker's demo server, and fill in the short demo form. Practise there for several weeks (1% max risk, stop-loss on every trade).
2. Check the broker's licence for your country and the legal entity you would sign up with, on the regulator's own public register.
3. Optional, and only after several weeks of following your trading plan consistently on demo: register a cents account (real money; balance shown in cents, very small lot sizes) through GFX's IB link, complete KYC (ID + selfie), and start small with money you can afford to lose. Max 1% risk per trade, stop-loss on every trade.

Sa Taglish: Demo muna sa MT5 app, walang ACCM registration. I-check ang licence ng broker para sa bansa mo. Optional lang ang cents account: real money, start small, max 1% risk, laging may stop-loss.$gfx$,
    key_takeaways = $gfx$["Start with a free demo in the MT5 app (no broker registration needed), then check the broker's licence for your country.", "A cents account through the IB link is optional and uses real money: only after weeks of following your plan on demo, start small, max 1% risk per trade, stop-loss on every trade.", "GFX's founder is an IB for ACCM; ACCM may pay GFX a commission or rebate, usually based on trading volume. You can use any broker you choose."]$gfx$::jsonb,
    learning_objective = $gfx$Understand how to start on a free MT5 demo, check a broker's licence for your country, and the optional step to a cents account.$gfx$,
    updated_at = now()
where slug = 'opening-your-accm-account'
  and md5(content) = 'b1aba773c9d9fa07df2147e622441953';
