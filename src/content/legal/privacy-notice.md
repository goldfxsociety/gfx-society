# GFX Society Privacy Notice

**Taglish summary:** Kinokolekta lang namin ang pangalan, email, trading experience level mo, at basic usage data ng site para maibigay ang Academy at education emails. Hindi namin ibinebenta o shine-share ang data mo sa brokers unless pumayag ka. Pwede mong i-access, itama, o ipa-delete ang data mo anytime — email lang sa goldfx.society@gmail.com, o i-delete mo mismo ang account mo sa Account settings. Kung sasali ka sa Discord community namin, ginagamit lang namin ang join application answers mo para i-verify na nag-register ka sa ACCM through our link. Kung mag-a-apply ka for @VIP, ang deposit screenshot mo ay para lang sa verification, binubura ito ng bot, at isang decision log lang ang tinatago namin.

Last updated: 18 Oct 2026 · Version: 1.2

**What changed in v1.2 (18 Oct 2026):** we added the optional Discord VIP verification (section 2), Cloudflare as a provider and the VIP log in Supabase (section 5), and the VIP retention rules (section 7). It only applies if you choose to apply for @VIP. Walang nagbago sa ibang paggamit namin ng data mo.

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

### Discord VIP verification
Optional ito. Kung mag-a-apply ka for the **@VIP role** sa Discord server namin, mag-u-upload ka ng ACCM deposit screenshot gamit ang official verification bot namin. The screenshot is used **only to verify VIP access**. VIP is community access, not trading results, and we make no income or results claims.

- **Who reviews:** admins lang na may configured admin role ang makakakita ng screenshot, sa isang private review channel.
- **Screenshot:** we never store it ourselves. Dumadaan lang ito sa bot, na nagpo-post ng copy sa review channel namin. Usually, binubura ng bot ang copy sa review channel namin right after the decision, o after 7 days kung hindi na-review. Kung i-block ng Discord ang delete, the bot retries every hour and our admins are alerted para i-delete ito manually. Ang original upload mo ay nasa Discord, under Discord's own privacy policy. Pwede mong takpan ang account number mo bago mag-upload.
- **Admin notes:** pwedeng mag-send ang admin ng "Need more info" note, o ng optional note kasama ng rejection, via DM. Ipinapadala lang ito sa DM mo and we don't save it; nananatili ito sa Discord DMs mo.
- **What we log:** your Discord user ID, the reviewing admin's Discord ID, the date and time, the decision (approved, rejected, needs_info or expired) and a reason code, plus technical IDs at status flags (e.g. request, server and message IDs, retry timestamps, and flags like "DM failed" or "already VIP"). Wala nang iba: no image, amounts, account numbers or names.
- **Log channel copy:** each decision is also posted as one line in a private admin channel (#vip-log): member ID, admin ID, decision, time, reason code and flags. Binubura ito kasabay ng log after 12 months.
- **Retention:** the decision log and its #vip-log copy are kept for **12 months**, then automatically deleted.
- **Legal basis:** your consent when you submit (Sec. 12(a), RA 10173), plus our legitimate interest in managing community access (Sec. 12(f)).
- **Providers:** the bot runs on Cloudflare, the log is stored in Supabase, and Discord Inc. handles the upload and the server under its own privacy policy. These providers may process data outside the Philippines (see Sections 5 and 6).

Questions or requests: **goldfx.society@gmail.com**, subject "Privacy Request".

### Website analytics
We use **Vercel Web Analytics** (provided by Vercel Inc., our hosting provider, acting as our processor). It is cookieless: it does not set cookies or use device fingerprinting to track you, and it does not track you across other websites. It gives us **aggregate** reports of page views and of custom events (for example, button clicks on the Gold Starter page). We do not send your name, email, account ID or other personal data in these events. When you arrive through a link with UTM campaign parameters (e.g. utm_source, utm_campaign), we read those parameters, and keep them in your browser's session storage for that visit, so we can measure which links bring visitors. Vercel may process this data outside the Philippines (see Sections 5 and 6). Purpose: to understand, in aggregate, which pages and links work so we can improve the site. Legal basis: our legitimate interests (Sec. 12(f), RA 10173).

We do **not** ask for your phone number, ID, bank details, broker account numbers (other than the ACCM User ID in the Discord join application above; you can cover account numbers in a VIP screenshot) or account size. Please do not send us sensitive personal information (e.g. government IDs, financial account details, health information). We do not knowingly collect data from anyone under 18.

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
| Supabase | Database and authentication; Discord VIP decision log | Singapore (ap-southeast-1) |
| Vercel Inc. | Website hosting and cookieless analytics (Vercel Web Analytics) | United States and other regions |
| Email service provider (when we start sending education emails) | Sending double opt-in and education emails | May be outside the Philippines; we will name it here before use |
| Discord Inc. | Discord community and join application, only if you apply to join; VIP verification upload and messages, only if you apply for @VIP | United States and other regions |
| Cloudflare, Inc. | Runs the Discord VIP verification bot (the screenshot passes through memory only and is never saved), only if you apply for @VIP | Global network |

**We do not share your personal data with any broker** (including our partner brokers) unless you give separate, explicit consent for a specific referral. Signing up through a broker link on our site happens on the broker's own website under the broker's privacy policy. If you open an ACCM account through our link, ACCM may share your account and trading activity with GFX so we can track commissions.

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
| Discord VIP screenshot (ang copy sa review channel namin) | Usually deleted by the bot right after the admin's decision, or after 7 days if not reviewed. Kung i-block ng Discord ang delete, the bot retries every hour and our admins are alerted para i-delete ito manually. We never store it ourselves; ang original upload ay nasa Discord under its policy |
| Discord VIP decision log and #vip-log copy | 12 months (Discord IDs, time, decision, reason code, flags and technical IDs), then automatically deleted, together with the #vip-log line |
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
- **Delete your account and data:** while logged in, go to **Progress → Account settings → Delete my account** and type DELETE to confirm. This immediately deletes your account, profile, lesson progress, quiz attempts, diagnostic results and activity events. Your consent record is kept for 3 years, linked only by the email hash (see Section 7). You can also email goldfx.society@gmail.com with subject "Data Deletion Request" from the email address on your account.
- **Access, correction, portability, objection:** email goldfx.society@gmail.com with the subject "Privacy Request".
We may ask you to confirm your identity. We will respond within 15 working days. Requests are free.

## 11. Changes
We will post updates here with a new date and, for material changes, notify you by email before they take effect.

## 12. Contact
GoldFX Society (GFX), Philippines — goldfx.society@gmail.com · Privacy contact: goldfx.society@gmail.com
