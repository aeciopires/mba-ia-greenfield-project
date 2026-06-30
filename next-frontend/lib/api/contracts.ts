/**
 * BFF ↔ Components contracts barrel.
 *
 * This file is the **only** module in the project authorized to import `paths`
 * from `./types.gen`. Every Route Handler and every Component consumes BFF
 * shapes via named aliases exported from here — never by indexing `paths`
 * directly elsewhere.
 */
import type { paths } from "./types.gen";

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type RegisterDto =
  paths["/auth/register"]["post"]["requestBody"]["content"]["application/json"];

export type LoginDto =
  paths["/auth/login"]["post"]["requestBody"]["content"]["application/json"];

export type ForgotPasswordDto =
  paths["/auth/forgot-password"]["post"]["requestBody"]["content"]["application/json"];

export type RefreshTokenDto =
  paths["/auth/refresh"]["post"]["requestBody"]["content"]["application/json"];

export type RegisterResponse =
  paths["/auth/register"]["post"]["responses"][201]["content"]["application/json"];

export type LoginTokenPair =
  paths["/auth/login"]["post"]["responses"][200]["content"]["application/json"];

export type RefreshTokenPair =
  paths["/auth/refresh"]["post"]["responses"][200]["content"]["application/json"];

export type ApiErrorEnvelope =
  paths["/auth/register"]["post"]["responses"][400]["content"]["application/json"];

// ─── Categories ───────────────────────────────────────────────────────────────

export interface Category {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

// ─── Channels ─────────────────────────────────────────────────────────────────

export type MyChannel =
  paths["/channels/me"]["get"]["responses"][200]["content"]["application/json"];

export interface Channel {
  id: string;
  name: string;
  nickname: string;
  description: string | null;
  user_id: string;
  subscribers_count: number;
  created_at: string;
  updated_at: string;
}

export interface UpdateChannelDto {
  name?: string;
  description?: string;
}

// ─── Videos ───────────────────────────────────────────────────────────────────

export type VideoStatus = "draft" | "processing" | "ready" | "error";
export type VideoVisibility = "public" | "unlisted";
export type VoteType = "like" | "dislike";

export interface Video {
  id: string;
  channel_id: string;
  category_id: string | null;
  title: string;
  description: string | null;
  status: VideoStatus;
  visibility: VideoVisibility;
  storage_key: string | null;
  thumbnail_key: string | null;
  duration: number | null;
  metadata: Record<string, unknown> | null;
  slug: string;
  error_message: string | null;
  view_count: number;
  likes_count: number;
  dislikes_count: number;
  comments_count: number;
  published_at: string | null;
  created_at: string;
  updated_at: string;
  channel?: Channel;
  category?: Category | null;
}

export interface VideoListResponse {
  data: Video[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateVideoDto {
  title: string;
  description?: string;
  content_type: string;
}

export interface UpdateVideoDto {
  title?: string;
  description?: string;
  category_id?: string;
  visibility?: VideoVisibility;
}

export interface InitiateUploadResponse {
  video: Video;
  presigned_upload_url: string;
}

export interface VoteSummary {
  likes_count: number;
  dislikes_count: number;
  user_vote: VoteType | null;
}

// ─── Comments ─────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  video_id: string;
  user_id: string;
  parent_id: string | null;
  content: string;
  likes_count: number;
  dislikes_count: number;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    email: string;
  };
  replies?: Comment[];
}

export interface CommentListResponse {
  data: Comment[];
  total: number;
}

export interface CreateCommentDto {
  content: string;
}
