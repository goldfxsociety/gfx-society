/** Worker bindings. Secrets (marked) are set with `wrangler secret put`, never in wrangler.toml or a tracked file. */
export interface Env {
  DB: D1Database;
  DISCORD_APP_ID: string;
  GUILD_ID: string;
  /** Comma-separated Admin / Mod role id(s). */
  ADMIN_ROLE_IDS: string;
  COACH_ROLE_ID: string;
  UNVERIFIED_ROLE_ID: string;
  FREE_ROLE_ID: string;
  VIP_ROLE_ID: string;
  SUB_IB_ROLE_ID: string;
  VERIFY_CHANNEL_ID: string;
  ADMIN_LOG_CHANNEL_ID: string;
  /** Optional: category for auto-created #review-{line} channels. */
  REVIEW_CATEGORY_ID?: string;
  /** Comma-separated. Both of Coach Mike's accounts review for the ONE Coach Mike line. */
  COACH_MIKE_DISCORD_USER_IDS: string;
  BEN_DISCORD_USER_ID?: string;
  MAX_UPLOAD_BYTES?: string;
  /** secret */
  DISCORD_PUBLIC_KEY: string;
  /** secret */
  DISCORD_BOT_TOKEN: string;
}

export interface Config {
  appId: string;
  guildId: string;
  adminRoleIds: string[];
  coachRoleId: string;
  unverifiedRoleId: string;
  freeRoleId: string;
  vipRoleId: string;
  subIbRoleId: string;
  verifyChannelId: string;
  adminLogChannelId: string;
  reviewCategoryId: string | null;
  coachMikeUserIds: string[];
  maxUploadBytes: number;
  publicKey: string;
  botToken: string;
}

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
  AUTOCOMPLETE_RESULT: 8,
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
  global_name?: string | null;
  bot?: boolean;
}

export interface GuildMember {
  user?: DiscordUser;
  nick?: string | null;
  roles: string[];
  permissions?: string;
}

export interface Attachment {
  id: string;
  filename: string;
  size: number;
  url: string;
  proxy_url?: string;
  content_type?: string;
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

export interface CommandOption {
  name: string;
  type: number;
  value?: string | number | boolean;
  focused?: boolean;
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
    options?: CommandOption[];
    components?: ModalComponent[];
    resolved?: { attachments?: Record<string, Attachment> };
  };
}

export type Tier = "unverified" | "free" | "vip";
export type AppType = "free" | "vip" | "ib";
export type AppStatus = "pending" | "approved" | "denied" | "transferred";
export type AboveMin = "yes" | "no" | null;

export interface IbLine {
  id: number;
  slug: string;
  display_name: string;
  discord_user_id: string;
  /** PRIVATE, admin-only. */
  accm_ib_email: string | null;
  upline_line_id: number | null;
  role_id: string | null;
  review_channel_id: string | null;
  is_seed: number;
  active: number;
  created_at: string;
}

export interface MemberRow {
  discord_user_id: string;
  display_name: string | null;
  accm_user_id: string | null;
  referring_ib_line_id: number | null;
  tier: Tier;
  is_sub_ib: number;
  own_ib_line_id: number | null;
  vip_above_min: AboveMin;
  vip_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Application {
  id: string;
  applicant_discord_id: string;
  applicant_display_name: string | null;
  type: AppType;
  accm_user_id: string | null;
  accm_ib_email: string | null;
  target_ib_line_id: number | null;
  current_reviewer_line_id: number | null;
  escalation_hops: number;
  review_channel_id: string | null;
  review_message_id: string | null;
  screenshot_url: string | null;
  screenshot_deleted_at: string | null;
  status: AppStatus;
  decision_reason: string | null;
  decided_by_discord_id: string | null;
  vip_above_min: AboveMin;
  flags: string;
  created_at: string;
  escalate_after_at: string | null;
  decided_at: string | null;
}

export type AppFlag = "dup_user_id" | "dup_ib_email" | "returning" | "upline_differs" | "top_alerted" | "screenshot_missing" | "member_left";

export type DenyCode = "wrong_ib" | "not_tree" | "unclear" | "duplicate" | "below_min" | "other";
