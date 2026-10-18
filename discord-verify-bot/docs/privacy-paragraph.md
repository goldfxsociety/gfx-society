# Draft: Privacy Notice paragraph — Discord VIP verification

**Status:** DRAFT for the founder's review together with the site PR. Not yet in `src/content/legal/privacy-notice.md` (this PR does not edit the live notice).
**Placement suggestion:** new subsection under §2 "What personal data we collect", plus one row each in §5 (sharing) and §7 (retention).

---

### Discord VIP verification

Kung mag-a-apply ka for the **@VIP role** sa PDE x GFX Society Discord server, mag-u-upload ka ng deposit screenshot gamit ang aming official verification bot. The screenshot is used **only to verify VIP access** (community access, not results). Admins lang ang makakakita nito sa isang private channel, at **binubura ito ng bot pagkatapos ng review** (o after 7 days kung hindi na-review). We do not store the image, amounts, account numbers or names. Ang itinatago lang namin ay isang **decision log**: your Discord user ID, the reviewing admin's Discord ID, the date and time, the decision (approved, rejected or expired) and a reject reason code. We keep this log for **[12 months — to be confirmed]**, then delete it. We process this based on your consent when you submit, and our legitimate interest in managing community access. The bot runs on Cloudflare and the log is stored in Supabase; Discord handles the upload itself under its own privacy policy, and these providers may process data outside the Philippines. Puwede mong takpan ang account number bago mag-upload. Questions or requests: goldfx.society@gmail.com.

---

**§5 sharing table rows (suggested):**

| Recipient | Purpose | Location |
|---|---|---|
| Discord | VIP verification upload and messages, only if you choose to verify | Global |
| Cloudflare (Workers) | Runs the verification bot (screenshot passes through memory only, never saved) | Global |

Supabase is already listed (Singapore): extend its purpose to "Database and authentication; Discord VIP decision log". If the Messenger → Discord site PR already adds a Discord row, extend that row instead of adding a second one.

**§7 retention row (suggested):**

| Data | Retention |
|---|---|
| Discord VIP verification | Screenshot: deleted by the bot right after the admin's decision, or after 7 days if not reviewed. Decision log (IDs, time, decision, reason code): [12 months — to be confirmed], then deleted. |
