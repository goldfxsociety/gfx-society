/** Pure builders for Discord payloads (unit-tested). */
import {
  approvalCardText,
  MODAL_NOTICE,
  MODAL_TITLE,
  PANEL_BUTTON,
  PANEL_TEXT,
  REASONS,
  UPLOAD_DESCRIPTION,
  UPLOAD_LABEL,
} from "./copy";
import { ButtonStyle, CallbackType, ComponentType, EPHEMERAL, type ReasonCode } from "./types";

export const CID = {
  start: "vip:start",
  submitModal: "vip:submit",
  upload: "vip:file",
  approve: "vip:approve:",
  reject: "vip:reject:",
  rejectModal: "vip:rejectmodal:",
  info: "vip:info:",
  infoModal: "vip:infomodal:",
  reason: "vip:reason",
  note: "vip:note",
} as const;

/** Never ping anyone from bot messages unless explicitly listed. */
export const NO_MENTIONS = { parse: [] as string[] };

export function ephemeral(content: string) {
  return { type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content, flags: EPHEMERAL, allowed_mentions: NO_MENTIONS } };
}

export const deferEphemeral = () => ({ type: CallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: EPHEMERAL } });
export const deferUpdate = () => ({ type: CallbackType.DEFERRED_UPDATE_MESSAGE });

/** Upload modal: requirement + privacy notice + IB line (Text Display) shown above the File Upload (Label → File Upload, images only, 1 file). */
export function uploadModal() {
  return {
    type: CallbackType.MODAL,
    data: {
      custom_id: CID.submitModal,
      title: MODAL_TITLE,
      components: [
        { type: ComponentType.TEXT_DISPLAY, content: MODAL_NOTICE },
        {
          type: ComponentType.LABEL,
          label: UPLOAD_LABEL,
          description: UPLOAD_DESCRIPTION,
          component: {
            type: ComponentType.FILE_UPLOAD,
            custom_id: CID.upload,
            min_values: 1,
            max_values: 1,
            required: true,
            file_types: ["image"],
          },
        },
      ],
    },
  };
}

/** Reject modal: reason preset (String Select) + optional note (Text Input). The note is DM-only, never stored. */
export function rejectModal(requestId: string) {
  return {
    type: CallbackType.MODAL,
    data: {
      custom_id: CID.rejectModal + requestId,
      title: "Reject VIP request",
      components: [
        {
          type: ComponentType.LABEL,
          label: "Reason",
          component: {
            type: ComponentType.STRING_SELECT,
            custom_id: CID.reason,
            required: true,
            min_values: 1,
            max_values: 1,
            options: (Object.keys(REASONS) as ReasonCode[]).map((code) => ({ label: REASONS[code].label, value: code })),
          },
        },
        {
          type: ComponentType.LABEL,
          label: "Note para sa member (optional)",
          description: "Kasama lang sa DM. Hindi ito sine-save. Huwag maglagay ng amount o account details.",
          component: { type: ComponentType.TEXT_INPUT, custom_id: CID.note, style: 2, required: false, max_length: 300 },
        },
      ],
    },
  };
}

/** "Need more info" modal: short admin note (required). The note goes into the DM only, never stored. */
export function infoModal(requestId: string) {
  return {
    type: CallbackType.MODAL,
    data: {
      custom_id: CID.infoModal + requestId,
      title: "Need more info",
      components: [
        {
          type: ComponentType.LABEL,
          label: "Ano ang kailangan from the member?",
          description: "Kasama lang sa DM. Hindi ito sine-save. Huwag maglagay ng amount o account details.",
          component: { type: ComponentType.TEXT_INPUT, custom_id: CID.note, style: 2, required: true, min_length: 5, max_length: 300 },
        },
      ],
    },
  };
}

export function decisionButtons(requestId: string, disabled = false) {
  return [
    {
      type: ComponentType.ACTION_ROW,
      components: [
        { type: ComponentType.BUTTON, style: ButtonStyle.SUCCESS, label: "Approve VIP", custom_id: CID.approve + requestId, disabled },
        { type: ComponentType.BUTTON, style: ButtonStyle.SECONDARY, label: "Need more info", custom_id: CID.info + requestId, disabled },
        { type: ComponentType.BUTTON, style: ButtonStyle.DANGER, label: "Reject", custom_id: CID.reject + requestId, disabled },
      ],
    },
  ];
}

/** #vip-approvals card. The screenshot is re-uploaded as attachment 0 with a neutral filename (never the member's filename). */
export function approvalCard(requestId: string, memberId: string, createdUnix: number, ext: string) {
  const filename = `vip-${requestId}.${ext}`;
  return {
    filename,
    payload: {
      content: approvalCardText(requestId, memberId, createdUnix),
      allowed_mentions: NO_MENTIONS,
      attachments: [{ id: 0, filename, description: "Deposit screenshot for VIP verification" }],
      components: decisionButtons(requestId),
    },
  };
}

/** Pinned panel for #verify (posted by scripts/post-verify-panel.ts). */
export function verifyPanel() {
  return {
    content: PANEL_TEXT,
    allowed_mentions: NO_MENTIONS,
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [{ type: ComponentType.BUTTON, style: ButtonStyle.PRIMARY, label: PANEL_BUTTON, custom_id: CID.start, emoji: { name: "🔐" } }],
      },
    ],
  };
}

/** Guild slash commands (registered by scripts/register-commands.ts). Guild-only (contexts [0]). */
export function commandDefinitions() {
  return [
    {
      name: "verify-deposit",
      type: 1,
      description: "Upload your deposit screenshot para sa VIP verification (admins lang ang makakakita).",
      contexts: [0],
      integration_types: [0],
    },
    {
      name: "verify-status",
      type: 1,
      description: "Check the status ng VIP verification mo (ikaw lang ang makakakita).",
      contexts: [0],
      integration_types: [0],
    },
  ];
}

export type DecisionAction = "approve" | "reject" | "rejectModal" | "info" | "infoModal";

export function parseDecisionId(customId: string | undefined): { action: DecisionAction; requestId: string } | null {
  if (!customId) return null;
  const m = /^vip:(approve|reject|rejectmodal|info|infomodal):([0-9]{17,20})$/.exec(customId);
  if (!m) return null;
  const map: Record<string, DecisionAction> = { approve: "approve", reject: "reject", rejectmodal: "rejectModal", info: "info", infomodal: "infoModal" };
  return { action: map[m[1]!]!, requestId: m[2]! };
}

/** Reads a value from a submitted modal by custom_id (Label → child). */
export function modalValue(
  components: Array<{ component?: { custom_id?: string; value?: string; values?: string[] }; components?: unknown[] }> | undefined,
  customId: string,
): string | string[] | undefined {
  for (const c of components ?? []) {
    const child = c.component;
    if (child?.custom_id === customId) return child.values ?? child.value;
    for (const inner of (c.components ?? []) as Array<{ custom_id?: string; value?: string; values?: string[] }>) {
      if (inner.custom_id === customId) return inner.values ?? inner.value;
    }
  }
  return undefined;
}
