# GFX Society Privacy Notice

**Taglish summary:** Kinokolekta lang namin ang pangalan, email, trading experience level mo, at basic usage data ng site para maibigay ang Academy at education emails. Hindi namin ibinebenta o shine-share ang data mo sa brokers unless pumayag ka. Pwede mong i-access, itama, o ipa-delete ang data mo anytime — email lang sa goldfx.society@gmail.com, o i-delete mo mismo ang account mo sa Account settings. Kung sasali ka sa Discord community namin, ginagamit lang namin ang join application answers mo para i-verify na nag-register ka sa ACCM through our link. Kung mag-a-apply ka for deposit verification para sa members-only channels, ang deposit screenshot mo ay para lang sa verification, binubura ito ng bot, at isang decision log lang ang tinatago namin.

Last updated: 11 Nov 2026 · Version: 1.5

**What changed in v1.5 (11 Nov 2026):** if you request Trading System access with an ACCM email that is different from your Academy email, we now send a one-time confirmation link to that ACCM email. We keep that address in a private table only until you confirm it, then remove it (section 2, "Access request", and section 7). The link is sent from our Gmail account (Google, section 5). It only applies if you give a different ACCM email. Walang nagbago sa ibang paggamit namin ng data mo.

**What changed in v1.4 (11 Nov 2026):** the members area now uses your normal Academy login (email + password, with a confirmed email) instead of a 6-digit email code (section 2, "Members area verification"). We added the optional Trading System access request and its data (section 2 and section 7). It only applies if you choose to request access. Walang nagbago sa ibang paggamit namin ng data mo.

**What changed in v1.3 (2 Nov 2026):** we added the members area verification for the GFX Trading System (section 2, "Members area verification"): passwordless login with a 6-digit email code, sent only to emails on our ACCM member list, plus its retention rules (section 7). It only applies if you choose to join the members area. Walang nagbago sa ibang paggamit namin ng data mo.

**What changed in v1.2 (18 Oct 2026):** we added the optional Discord deposit verification for members-only channels (section 2), Cloudflare as a provider and the verification log in Supabase (section 5), and its retention rules (section 7). It only applies if you choose to apply for deposit verification. Walang nagbago sa ibang paggamit namin ng data mo.

**What changed in v1.1 (18 Oct 2026):** the GFX Society Messenger community was replaced by the GFX Society Discord community. We added the Discord join application (section 2) and Discord Inc. as a provider (section 5). No change to how we handle your Academy account data.

## 1. Who we are (Personal Information Controller)
GoldFX Society ("GFX", "we", "us") operates https://gfx-society.vercel.app, the GFX Society Academy, and the GFX Society Discord community, which is open to members who registered with ACCM through our link. GFX is the personal information controller (PIC) under the Data Privacy Act of 2012 (Republic Act No. 10173), its Implementing Rules and Regulations, and National Privacy Commission (NPC) issuances.
- Controller: GoldFX Society (GFX), an independent education community operated by its founder
- Address: Philippines
- Privacy contact: goldfx.society@gmail.com
- Contact for all requests: goldfx.society@gmail.com

## 2. What personal data we collect
| Category | Examples | Source |
|---|---|---|
| Identity and contact | First name, email address | You, at signup or Starter Kit/Academy form |
| Account data | Password (stored hashed by our authentication provider; we cannot see it) | You, at signup |
| Experience level | "Never traded", "Demo only", "Trading live" | You, at signup |
| Learning data | Lesson progress, quiz and diagnostic answers, competency results, demo journal entries you submit | Your use of the Academy |
| Consent records | Which boxes you ticked, consent text version, date/time, and a one-way hash of your email (so the record can be matched to you without storing the email itself) | Automatically, at signup |
| Usage and analytics | Pages visited, custom events (e.g. button clicks on the Gold Starter page), referral/UTM campaign tags, device and browser type, country | Automatically, via Vercel Web Analytics (cookieless; see "Website analytics" below) |
| Learning activity events (logged-in users only) | Quiz started/passed/failed, diagnostic started, "continue learning" clicks, ACCM link clicks (page only) | Automatically, stored with your learning data in our database |

### Discord community join application
Kung mag-a-apply ka sa Discord community namin, hihingin ng join application ang: (1) sino ang nag-invite sa'yo, (2) kung registered ka na sa ACCM through our link (yes/no), (3) ang ACCM User ID mo o ang pangalan sa ACCM account mo, at (4) pag-agree sa community rules.

We use these answers **only to verify that you registered with ACCM through our link**, by comparing them with the client list in our ACCM introducing-broker (IB) portal, and then to approve or decline your join request. We don't use them for marketing, and we don't sell or share them with anyone else. Hindi namin hihingin ang password, OTP, ID documents, o balance mo.

Who can see your answers: Discord and the admins of our Discord community. Retention: deleted from our records 30 days after your application is decided.

Discord itself is run by Discord Inc., and **Discord's own Privacy Policy (https://discord.com/privacy) applies** to your Discord account and everything you post there.

Questions or deletion requests: **goldfx.society@gmail.com**, subject "Privacy Request".

### Discord deposit verification
Optional ito. Kung mag-a-apply ka for the **members-only role** sa Discord server namin, mag-u-upload ka ng ACCM deposit screenshot gamit ang official verification bot namin. The screenshot is used **only for deposit verification para sa members-only channels**. Community access lang ang mga channel na ito, not trading results, and we make no income or results claims.

- **Who reviews:** admins lang na may configured admin role ang makakakita ng screenshot, sa isang private review channel.
- **Screenshot:** we never store it ourselves. Dumadaan lang ito sa bot, na nagpo-post ng copy sa review channel namin. Usually, binubura ng bot ang copy sa review channel namin right after the decision, o after 7 days kung hindi na-review. Kung i-block ng Discord ang delete, the bot retries every hour and our admins are alerted para i-delete ito manually. Ang original upload mo ay nasa Discord, under Discord's own privacy policy. Pwede mong takpan ang account number mo bago mag-upload.
- **Admin notes:** pwedeng mag-send ang admin ng "Need more info" note, o ng optional note kasama ng rejection, via DM. Ipinapadala lang ito sa DM mo and we don't save it; nananatili ito sa Discord DMs mo.
- **What we log:** your Discord user ID, the reviewing admin's Discord ID, the date and time, the decision (approved, rejected, needs_info or expired) and a reason code, plus technical IDs at status flags (e.g. request, server and message IDs, retry timestamps, and flags like "DM failed" or "already verified"). Wala nang iba: no image, amounts, account numbers or names.
- **Admin log channel copy:** each decision is also posted as one line in a private admin log channel: member ID, admin ID, decision, time, reason code and flags. Binubura ito kasabay ng log after 12 months.
- **Retention:** the decision log and its copy in the admin log channel are kept for **12 months**, then automatically deleted.
- **Legal basis:** your consent when you submit (Sec. 12(a), RA 10173), plus our legitimate interest in managing community access (Sec. 12(f)).
- **Providers:** the bot runs on Cloudflare, the log is stored in Supabase, and Discord Inc. handles the upload and the server under its own privacy policy. These providers may process data outside the Philippines (see Sections 5 and 6).

Questions or requests: **goldfx.society@gmail.com**, subject "Privacy Request".

### Members area verification (GFX Trading System)
Optional ito. Members-only ang GFX Trading System, para sa mga ACCM client na naka-register sa ilalim ng Introducing Broker (IB) line ng GFX Society. Partner broker ng GFX ang ACCM. Optional ang ACCM, at bukas pa rin sa lahat ang free Academy lessons.

- **How login works:** mag-log in ka gamit ang normal Academy account mo (email + password) sa /login. Kailangang confirmed ang email ng account mo (via the confirmation link na pinadala sa signup). Pagka-log in, sa /system/join ti-tick mo ang email-check consent box, at chine-check namin kung ang confirmed email ng account mo ay nasa private list namin ng ACCM accounts (naka-register sa IB line namin). Walang code o email na pinapadala para sa check na ito, at ikaw lang ang makakakita ng sarili mong result. Every time you open the members area, chine-check ulit namin kung nasa list pa ang email ng account mo.
- **What we check:** email mo lang, ikinukumpara sa list. Hindi namin hinihingi ang ACCM password, account number o balance mo.
- **Purpose:** only to confirm na eligible ka sa members area. Hindi namin ito ginagamit for marketing, at hindi kami nagsha-share nito sa broker.
- **Source of the list:** we export it from the ACCM partner (IB) portal. Bago i-load, tinatanggal namin lahat maliban sa email at kung IB o client ang account. We do **not** receive or store your name, balance, deposits, volume, account number or trades for this purpose.
- **No raw email list:** hindi namin sine-save ang list as plain emails. Each email is stored only as a one-way hash (with a secret key kept in our database), plus the IB/client role. Our admin manually deletes the raw export file after each import, at bilang (counts) lang ng added/unchanged/removed ang nilo-log namin.
- **Monthly refresh:** manually ina-update ng admin namin ang list buwan-buwan (every 1st of the month). Kung kaka-register mo lang sa ACCM, baka sa susunod na refresh ka pa ma-verify.
- **Access request (optional):** kung hindi ka pa ma-verify, pwede kang mag-request sa /system/join. Kung mag-request ka ng access, sine-save namin ang Academy email mo, ACCM email (kung binigay), at IB name (kung binigay) para i-check sa ACCM member data sa bawat monthly update. Hindi namin ito auto-dine-delete. Kung gusto mong burahin ang data na ito, mag-email sa goldfx.society@gmail.com. *In English:* if you request access, we save your Academy email, your ACCM email (if you give one), and your IB name (if you give one), so we can check them against ACCM member data at each monthly update. We don't delete this data automatically. To ask us to delete it, email goldfx.society@gmail.com. The emails are stored as one-way hashes (same secret key as the list). A different ACCM email counts only after you click the confirmation link we send to that address; until then we keep that address in a private table only to send the link, and we remove it once it is confirmed. Every request is checked at each monthly refresh until it matches; on a match you are added automatically and the request record is kept. Bilang (counts) lang ang nire-report namin, walang email list.
- **Unmatched data:** emails na wala na sa ACCM list ay binubura sa list namin **within 30 days after the next monthly list refresh**. Kung walang match ang email mo at hindi ka nag-request, wala kaming sine-save na email para dito (consent date + version lang, linked sa account mo).
- **Rate limits:** para ma-limit ang abuse, nagse-save kami ng user ID + timestamp sa bawat verify attempt (5 per hour; binubura after 1 day), at user ID + one-way hash ng IP address + timestamp sa bawat access request submit (3 per user at 10 per IP per 24 hours; binubura after 2 days). Walang plain IP na sine-save.
- **After removal:** kung wala na sa list ang email ng isang member, may **14-day grace period** with a notice, tapos matatapos ang members access.
- **What we keep about you:** a membership record linked to your account (status, IB/client role, verification date, and the date and version of the consent you gave). Deleted together with your account. If you tick the email-check box but don't match yet, we keep that consent (date + version) so we don't ask again; deleted with your account.
- **Legal basis:** your consent when you tick the email-check box (Sec. 12(a), RA 10173). Pwede mong i-withdraw anytime by emailing us; matatapos ang members access mo.
- **Your rights:** under the Data Privacy Act of 2012 (RA 10173), may karapatan kang ma-inform, mag-access, mag-correct, mag-object, ipa-erase o ipa-block, data portability, mag-withdraw ng consent, at mag-file ng complaint sa National Privacy Commission (see Sections 9 and 10).
- **Operator:** GoldFX Society (GFX). Questions or requests: **goldfx.society@gmail.com**, subject "Privacy Request".

### Website analytics
We use **Vercel Web Analytics** (provided by Vercel Inc., our hosting provider, acting as our processor). It is cookieless: it does not set cookies or use device fingerprinting to track you, and it does not track you across other websites. It gives us **aggregate** reports of page views and of custom events (for example, button clicks on the Gold Starter page). We do not send your name, email, account ID or other personal data in these events. When you arrive through a link with UTM campaign parameters (e.g. utm_source, utm_campaign), we read those parameters, and keep them in your browser's session storage for that visit, so we can measure which links bring visitors. Vercel may process this data outside the Philippines (see Sections 5 and 6). Purpose: to understand, in aggregate, which pages and links work so we can improve the site. Legal basis: our legitimate interests (Sec. 12(f), RA 10173).

We do **not** ask for your phone number, ID, bank details, broker account numbers (other than the ACCM User ID in the Discord join application above; you can cover account numbers in a deposit verification screenshot) or account size. Please do not send us sensitive personal information (e.g. government IDs, financial account details, health information). We do not knowingly collect data from anyone under 18.

## 3. Why we use it (purposes)
1. To create and manage your account and give you access to the Academy, diagnostic and dashboard.
2. To save your learning progress and personalise lessons by experience level.
3. To send the Starter Kit and education emails you requested (only with your consent).
4. To send community news and updates (only if you separately opt in).
5. To measure which content and channels work, in aggregated form, and improve the site.
6. To keep the site secure, prevent abuse, and keep records of consent.
7. To comply with legal obligations and respond to lawful requests.

We do not use your data for automated decisions that produce legal or similarly significant effects on you.

## 4. Legal basis
- **Consent** (Sec. 12(a), RA 10173) — education emails, marketing updates, and any broker referral data sharing. You can withdraw consent anytime.
- **Contract / your request** (Sec. 12(b)) — providing the account and Academy you signed up for.
- **Legitimate interests** (Sec. 12(f)) — security, fraud prevention, and aggregated analytics, balanced against your rights.
- **Legal obligation** (Sec. 12(c)) — where the law requires us to keep or disclose data.

## 5. Who we share it with
We share personal data only with service providers that help us run GFX, under agreements requiring them to protect it:
| Provider | Purpose | Location |
|---|---|---|
| Supabase | Database and authentication (including Academy account emails such as signup confirmation links, through the email provider Supabase uses); Discord deposit verification log | Singapore (ap-southeast-1) |
| Vercel Inc. | Website hosting and cookieless analytics (Vercel Web Analytics) | United States and other regions |
| Google LLC (Gmail) | Sending the one-time confirmation link to a different ACCM email you give in an access request (from our Gmail account), only if you give one | United States and other regions |
| Email service provider (when we start sending education emails) | Sending double opt-in and education emails | May be outside the Philippines; we will name it here before use |
| Discord Inc. | Discord community and join application, only if you apply to join; deposit verification upload and messages, only if you apply for deposit verification | United States and other regions |
| Cloudflare, Inc. | Runs the Discord deposit verification bot (the screenshot passes through memory only and is never saved), only if you apply for deposit verification | Global network |

**We do not share your personal data with any broker** (including ACCM, our partner broker) unless you give separate, explicit consent for a specific referral. Signing up through a broker link on our site happens on the broker's own website under the broker's privacy policy. If you open an ACCM account through our link, ACCM may share your account and trading activity with GFX so we can track commissions.

We do not sell your personal data. We may disclose data if required by law, court order, or a government authority.

## 6. International transfers
Some providers store or process data outside the Philippines (e.g. Singapore, USA). We remain responsible for your data and require providers to apply comparable protection.

## 7. How long we keep it
| Data | Retention |
|---|---|
| Account and learning data | While your account is active, then deleted or anonymised within 90 days of account deletion |
| Email list data | Until you unsubscribe or withdraw consent; then suppression record (email only) kept to honour the opt-out |
| Inactive accounts | Deleted after 24 months of no activity, after a reminder email |
| Consent records | For the duration of the relationship plus 3 years as evidence of consent. If you delete your account, the consent record is kept for those 3 years, linked only by the email hash |
| Discord deposit verification screenshot (ang copy sa review channel namin) | Usually deleted by the bot right after the admin's decision, or after 7 days if not reviewed. Kung i-block ng Discord ang delete, the bot retries every hour and our admins are alerted para i-delete ito manually. We never store it ourselves; ang original upload ay nasa Discord under its policy |
| Discord deposit verification log and admin log channel copy | 12 months (Discord IDs, time, decision, reason code, flags and technical IDs), then automatically deleted, together with the line in the admin log channel |
| Members area verification list | Hashed emails + IB/client role only, refreshed monthly; emails no longer on the ACCM list are deleted within 30 days after the next monthly list refresh. Raw export deleted after import |
| Members area membership record (status, role, verification date, consent date + version) | While your account exists (members access ends 14 days after your email leaves the list); deleted with your account |
| Trading System access request (hashed Academy email, hashed ACCM email if given, IB name if given, consent version, status and check dates) | Kept so we can check membership at each monthly refresh, including after a match. Not deleted automatically. Removed when you delete your Academy account, or when you ask at goldfx.society@gmail.com (subject "Privacy Request") |
| Different ACCM email waiting for confirmation (plain email, private table) | Only until you click the confirmation link, then removed (the hash stays with the request). The link itself works once and expires after 24 hours |
| Members area rate-limit logs | Verify attempts: user ID + timestamp, deleted after 1 day. Access request submits: user ID + hashed IP + timestamp, deleted after 2 days |
| Members area raw ACCM export file | Deleted manually by our admin right after each monthly import |
| Analytics | Vercel Web Analytics: aggregated reports, kept for the retention period of our Vercel plan. Learning activity events: as account and learning data |

## 8. How we protect it
Access controls (row-level security on every database table), encrypted connections (HTTPS), hashed passwords handled by our authentication provider, and limited access to admin tools. No system is 100% secure. If a breach likely to cause you serious harm occurs, we will notify you and the NPC as required (within 72 hours of becoming aware of it, under the applicable NPC rules).

## 9. Your rights
Under RA 10173 you have the right to:
- **Be informed** about how your data is processed;
- **Access** a copy of your data;
- **Object** to processing, including direct marketing;
- **Correct** inaccurate data;
- **Erasure or blocking** of your data;
- **Data portability** — get your data in a commonly used electronic format;
- **Withdraw consent** at any time (this does not affect processing done before withdrawal);
- **Damages** and to **file a complaint** with the National Privacy Commission (https://privacy.gov.ph).

## 10. How to make a request or delete your data
- **Unsubscribe:** click "Unsubscribe" in any email — effective immediately.
- **Delete your account and data:** while logged in, go to **Progress → Account settings → Delete my account** and type DELETE to confirm. This immediately deletes your account, profile, lesson progress, quiz attempts, diagnostic results, activity events and any Trading System access request. Your consent record is kept for 3 years, linked only by the email hash (see Section 7). You can also email goldfx.society@gmail.com with subject "Data Deletion Request" from the email address on your account.
- **Access, correction, portability, objection:** email goldfx.society@gmail.com with the subject "Privacy Request".
We may ask you to confirm your identity. We will respond within 15 working days. Requests are free.

## 11. Changes
We will post updates here with a new date and, for material changes, notify you by email before they take effect.

## 12. Contact
GoldFX Society (GFX), Philippines — goldfx.society@gmail.com · Privacy contact: goldfx.society@gmail.com
