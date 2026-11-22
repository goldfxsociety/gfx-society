/** Pure builders for Discord payloads (unit-tested). Never include an ACCM IB email in anything built here. */
import {
  BTN_CLIENT,
  BTN_IB,
  DENY_LABELS,
  MODAL,
  PRIVACY_NOTICE,
  START_HERE_PANEL,
  TRANSFER_OPTION_LABEL,
  TRANSFER_OPTION_VALUE,
  VERIFY_PANEL,
} from "./copy";
import { ButtonStyle, CallbackType, ComponentType, EPHEMERAL, type AppType, type IbLine } from "./types";

export const CID = {
  client: "uu:client",
  ib: "uu:ib",
  clientSubmit: "uu:cs", // + optional ":{lineId}" (slash-command fallback with a fixed IB)
  ibSubmit: "uu:is", // + optional ":{lineId}"
  approve: "uu:ap:",
  deny: "uu:dn:",
  email: "uu:em:",
  denyModal: "uu:dm:",
  fAccm: "f:accm",
  fType: "f:type",
  fLine: "f:line",
  fShot: "f:shot",
  fEmail: "f:email",
  fReason: "f:reason",
  fNote: "f:note",
} as const;

/** Discord: max 25 options in a String Select. One slot is reserved for the transfer option. */
export const SELECT_MAX = 25;
export const MAX_LINES_IN_SELECT = SELECT_MAX - 1;

export const NO_MENTIONS = { parse: [] as string[] };

export function ephemeral(content: string) {
  return { type: CallbackType.CHANNEL_MESSAGE_WITH_SOURCE, data: { content, flags: EPHEMERAL, allowed_mentions: NO_MENTIONS } };
}
export const deferEphemeral = () => ({ type: CallbackType.DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE, data: { flags: EPHEMERAL } });
export const deferUpdate = () => ({ type: CallbackType.DEFERRED_UPDATE_MESSAGE });

const truncate = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1)}…`);

/** Dropdown options: Discord display names ONLY (never the IB email). Description shows the upline to tell clashes apart. */
export function lineOptions(lines: IbLine[], defaultId: number | null, byId: Map<number, IbLine>) {
  return lines.map((l) => {
    const up = l.upline_line_id ? byId.get(l.upline_line_id) : undefined;
    return {
      label: truncate(l.display_name, 100),
      value: String(l.id),
      ...(up ? { description: truncate(`Upline: ${up.display_name}`, 100) } : {}),
      ...(defaultId === l.id ? { default: true } : {}),
    };
  });
}

export interface ClientModalInput {
  allowed: Array<"free" | "vip">;
  lines: IbLine[];
  defaultLineId: number | null;
  prefillAccm: string | null;
  /** Slash-command fallback: IB already chosen, so no dropdown in the modal. */
  fixedLineId?: number | null;
}

export function clientModal(x: ClientModalInput) {
  const byId = new Map(x.lines.map((l) => [l.id, l]));
  const vipOnly = x.allowed.length === 1 && x.allowed[0] === "vip";
  const components: unknown[] = [
    { type: ComponentType.TEXT_DISPLAY, content: PRIVACY_NOTICE },
    {
      type: ComponentType.LABEL,
      label: MODAL.accmLabel,
      description: MODAL.accmDesc,
      component: {
        type: ComponentType.TEXT_INPUT,
        custom_id: CID.fAccm,
        style: 1,
        min_length: 6,
        max_length: 6,
        required: true,
        ...(x.prefillAccm ? { value: x.prefillAccm } : {}),
      },
    },
    {
      type: ComponentType.LABEL,
      label: MODAL.typeLabel,
      ...(x.allowed.length === 1 && x.allowed[0] === "free" ? { description: MODAL.typeFreeOnlyDesc } : {}),
      component: {
        type: ComponentType.STRING_SELECT,
        custom_id: CID.fType,
        required: true,
        min_values: 1,
        max_values: 1,
        options: x.allowed.map((t) => ({
          label: t === "free" ? MODAL.typeFreeLabel : MODAL.typeVipLabel,
          value: t,
          ...(x.allowed.length === 1 ? { default: true } : {}),
        })),
      },
    },
  ];
  if (!x.fixedLineId) {
    components.push({
      type: ComponentType.LABEL,
      label: MODAL.lineLabel,
      description: MODAL.lineDesc,
      component: {
        type: ComponentType.STRING_SELECT,
        custom_id: CID.fLine,
        required: true,
        min_values: 1,
        max_values: 1,
        options: [
          ...lineOptions(x.lines.slice(0, MAX_LINES_IN_SELECT), x.defaultLineId, byId),
          { label: TRANSFER_OPTION_LABEL, value: TRANSFER_OPTION_VALUE },
        ],
      },
    });
  }
  components.push({
    type: ComponentType.LABEL,
    label: MODAL.shotLabel,
    description: vipOnly ? MODAL.shotDescVip : MODAL.shotDescFree,
    component: { type: ComponentType.FILE_UPLOAD, custom_id: CID.fShot, min_values: 1, max_values: 1, required: true, file_types: ["image"] },
  });
  return {
    type: CallbackType.MODAL,
    data: { custom_id: x.fixedLineId ? `${CID.clientSubmit}:${x.fixedLineId}` : CID.clientSubmit, title: MODAL.clientTitle, components },
  };
}

export function ibModal(x: { lines: IbLine[]; defaultLineId: number | null; fixedLineId?: number | null }) {
  const byId = new Map(x.lines.map((l) => [l.id, l]));
  const components: unknown[] = [
    { type: ComponentType.TEXT_DISPLAY, content: PRIVACY_NOTICE },
    {
      type: ComponentType.LABEL,
      label: MODAL.emailLabel,
      component: { type: ComponentType.TEXT_INPUT, custom_id: CID.fEmail, style: 1, min_length: 6, max_length: 254, required: true },
    },
  ];
  if (!x.fixedLineId) {
    components.push({
      type: ComponentType.LABEL,
      label: MODAL.uplineLabel,
      description: MODAL.lineDesc,
      component: {
        type: ComponentType.STRING_SELECT,
        custom_id: CID.fLine,
        required: true,
        min_values: 1,
        max_values: 1,
        options: lineOptions(x.lines.slice(0, SELECT_MAX), x.defaultLineId, byId),
      },
    });
  }
  return {
    type: CallbackType.MODAL,
    data: { custom_id: x.fixedLineId ? `${CID.ibSubmit}:${x.fixedLineId}` : CID.ibSubmit, title: MODAL.ibTitle, components },
  };
}

export function denyCodesFor(type: AppType): string[] {
  if (type === "ib") return ["wrong_upline", "not_tree", "duplicate_email", "other"];
  if (type === "vip") return ["wrong_ib", "not_tree", "unclear", "below_min", "duplicate", "other"];
  return ["wrong_ib", "not_tree", "unclear", "duplicate", "other"];
}

export function denyModal(appId: string, type: AppType) {
  return {
    type: CallbackType.MODAL,
    data: {
      custom_id: CID.denyModal + appId,
      title: MODAL.denyTitle,
      components: [
        {
          type: ComponentType.LABEL,
          label: MODAL.denyReasonLabel,
          component: {
            type: ComponentType.STRING_SELECT,
            custom_id: CID.fReason,
            required: true,
            min_values: 1,
            max_values: 1,
            options: denyCodesFor(type).map((c) => ({ label: DENY_LABELS[c]!, value: c })),
          },
        },
        {
          type: ComponentType.LABEL,
          label: MODAL.denyNoteLabel,
          description: MODAL.denyNoteDesc,
          component: { type: ComponentType.TEXT_INPUT, custom_id: CID.fNote, style: 2, required: false, max_length: 300 },
        },
      ],
    },
  };
}

export function reviewButtons(appId: string, type: AppType) {
  const row: unknown[] = [
    { type: ComponentType.BUTTON, style: ButtonStyle.SUCCESS, label: type === "vip" ? "Approve VIP ($50+)" : "Approve", custom_id: CID.approve + appId },
    { type: ComponentType.BUTTON, style: ButtonStyle.DANGER, label: "Deny", custom_id: CID.deny + appId },
  ];
  if (type === "ib") row.push({ type: ComponentType.BUTTON, style: ButtonStyle.SECONDARY, label: "Admin: View IB Email", custom_id: CID.email + appId });
  return [{ type: ComponentType.ACTION_ROW, components: row }];
}

export function verifyPanel() {
  return {
    content: VERIFY_PANEL,
    allowed_mentions: NO_MENTIONS,
    components: [
      {
        type: ComponentType.ACTION_ROW,
        components: [
          { type: ComponentType.BUTTON, style: ButtonStyle.PRIMARY, label: BTN_CLIENT, custom_id: CID.client },
          { type: ComponentType.BUTTON, style: ButtonStyle.SECONDARY, label: BTN_IB, custom_id: CID.ib },
        ],
      },
    ],
  };
}

export const startHerePanel = () => ({ content: START_HERE_PANEL, allowed_mentions: NO_MENTIONS });

/** Guild slash commands. /verify-client and /verify-ib are the search fallback when there are more than 24 lines. */
export function commandDefinitions() {
  return [
    { name: "uu-status", type: 1, description: "Tingnan ang status ng huling application mo (ikaw lang ang makakakita).", contexts: [0], integration_types: [0] },
    {
      name: "verify-client",
      type: 1,
      description: "Client ako: hanapin ang referring IB mo kapag marami na sa list.",
      contexts: [0],
      integration_types: [0],
      options: [{ type: 3, name: "referring_ib", description: "Discord display name ng referring IB mo", required: true, autocomplete: true }],
    },
    {
      name: "verify-ib",
      type: 1,
      description: "IB ako: hanapin ang upline IB mo kapag marami na sa list.",
      contexts: [0],
      integration_types: [0],
      options: [{ type: 3, name: "upline_ib", description: "Discord display name ng upline IB mo", required: true, autocomplete: true }],
    },
  ];
}

/** Autocomplete choices: display names only, max 25. */
export function autocompleteChoices(lines: IbLine[], query: string, includeTransfer: boolean) {
  const q = query.trim().toLowerCase();
  const hits = lines.filter((l) => !q || l.display_name.toLowerCase().includes(q)).map((l) => ({ name: truncate(l.display_name, 100), value: String(l.id) }));
  const out = includeTransfer ? [...hits.slice(0, MAX_LINES_IN_SELECT), { name: TRANSFER_OPTION_LABEL, value: TRANSFER_OPTION_VALUE }] : hits.slice(0, SELECT_MAX);
  return { type: CallbackType.AUTOCOMPLETE_RESULT, data: { choices: out } };
}

export type ReviewAction = "approve" | "deny" | "email" | "denyModal";
export function parseReviewId(customId: string | undefined): { action: ReviewAction; appId: string } | null {
  const m = /^uu:(ap|dn|em|dm):([0-9]{17,20})$/.exec(customId ?? "");
  if (!m) return null;
  const map: Record<string, ReviewAction> = { ap: "approve", dn: "deny", em: "email", dm: "denyModal" };
  return { action: map[m[1]!]!, appId: m[2]! };
}

/** Reads a value from a submitted modal by custom_id (Label → child, or Action Row → child). */
export function modalValue(components: unknown, customId: string): string | string[] | undefined {
  let found: string | string[] | undefined;
  const walk = (c: unknown): void => {
    if (found !== undefined || !c || typeof c !== "object") return;
    const o = c as { custom_id?: string; value?: string; values?: string[]; component?: unknown; components?: unknown[] };
    if (o.custom_id === customId && (o.values !== undefined || o.value !== undefined)) {
      found = o.values ?? o.value;
      return;
    }
    if (o.component) walk(o.component);
    if (Array.isArray(o.components)) o.components.forEach(walk);
  };
  (Array.isArray(components) ? components : []).forEach(walk);
  return found;
}

export const firstValue = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
