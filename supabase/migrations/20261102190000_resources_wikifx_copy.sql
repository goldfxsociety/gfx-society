-- GFX post-launch fix 1, item 1: /resources WikiFX card. NOT APPLIED. Re-runnable (data only).
-- Removes the sentence "Before depositing with any broker, check it on WikiFX — ..." completely.
-- What is left ("ACCM is verified here.") does not read well alone, so the description is cleared;
-- the card keeps its title "WikiFX — Broker Checker" and link. Only touches the exact old text.
update public.resources
   set description = null
 where title = 'WikiFX — Broker Checker'
   and description = 'Before depositing with any broker, check it on WikiFX — an independent platform that verifies broker legitimacy worldwide. ACCM is verified here.';
