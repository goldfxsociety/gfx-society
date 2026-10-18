/** Worker bindings. Secrets (marked) are set with `wrangler secret put`, never in wrangler.toml or the website env. */
export interface Env {
  DISCORD_APP_ID: string;
  GUILD_ID: string;
  VIP_ROLE_ID: string;
  ADMIN_ROLE_IDS: string;
  VERIFY_CHANNEL_ID: string;
  APPROVALS_CHANNEL_ID: string;
  LOG_CHANNEL_ID: string;
  SUPABASE_URL: string;
  MAX_UPLOAD_BYTES: string;
  /** secret */
  DISCORD_PUBLIC_KEY: string;
  /** secret */
  DISCORD_BOT_TOKEN: string;
  /** secret */
  SUPABASE_SERVICE_ROLE_KEY: string;
}

export interface Config {
  appId: string;
  guildId: string;
  vipRoleId: string;
  adminRoleIds: string[];
  verifyChannelId: string;
  approvalsChannelId: string;
  logChannelId: string;
  supabaseUrl: string;
  maxUploadBytes: number;
  publicKey: string;
  botToken: string;
  supabaseKey: string;
}

/** Minimal background-work context (ExecutionContext.waitUntil). */
export interface WaitCtx {
  waitUntil(promise: Promise<unknown>): void;
}

export const InteractionType = {
  PING: 1,
  APPLICATION_COMMAND: 2,
  MESSAGE_COMPONENT: 3,
  APPLICATION_COMMAND_AUTOCOMPLETE: 4,
  MODAL_SUBMIT: 5,
} as const;

export const CallbackType = {
  PONG: 1,
  CHANNEL_MESSAGE_WITH_SOURCE: 4,
  DEFERRED_CHANNEL_MESSAGE_WITH_SOURCE: 5,
  DEFERRED_UPDATE_MESSAGE: 6,
  UPDATE_MESSAGE: 7,
  MODAL: 9,
} as const;

export const ComponentType = {
  ACTION_ROW: 1,
  BUTTON: 2,
  STRING_SELECT: 3,
  TEXT_INPUT: 4,
  TEXT_DISPLAY: 10,
  LABEL: 18,
  FILE_UPLOAD: 19,
} as const;

export const ButtonStyle = { PRIMARY: 1, SECONDARY: 2, SUCCESS: 3, DANGER: 4 } as const;

export const EPHEMERAL = 1 << 6;

export interface DiscordUser {
  id: string;
  username?: string;
  bot?: boolean;
}

export interface GuildMember {
  user?: DiscordUser;
  roles: string[];
  /** Total permissions of the member in the channel, as a decimal string bitfield. */
  permissions?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url?: string;
  content_type?: string;
  ephemeral?: boolean;
}

export interface ModalComponent {
  type: number;
  id?: number;
  custom_id?: string;
  value?: string;
  values?: string[];
  component?: ModalComponent;
  components?: ModalComponent[];
}

export interface Interaction {
  id: string;
  application_id: string;
  type: number;
  token: string;
  guild_id?: string;
  channel_id?: string;
  member?: GuildMember;
  user?: DiscordUser;
  attachment_size_limit?: number;
  message?: { id: string; channel_id?: string };
  data?: {
    name?: string;
    custom_id?: string;
    component_type?: number;
    values?: string[];
    components?: ModalComponent[];
    resolved?: { attachments?: Record<string, Attachment> };
  };
}

export type RequestStatus = "pending" | "approved" | "rejected" | "needs_info" | "expired";
export type ReasonCode = "unclear" | "wrong_screen" | "not_accm" | "too_old" | "cant_confirm" | "other";
export type LogFlag = "dm_failed" | "already_vip" | "member_left";

/** One row of public.discord_vip_requests. Ids only. No images, URLs, names or amounts. */
export interface RequestRow {
  request_id: string;
  guild_id: string;
  member_id: string;
  status: RequestStatus;
  admin_id: string | null;
  reason_code: ReasonCode | null;
  flags: LogFlag[];
  approval_message_id: string | null;
  /** Id of the bot's one-line #vip-log mirror message (so the 12-month purge can delete it). */
  log_message_id: string | null;
  created_at: string;
  decided_at: string | null;
}
