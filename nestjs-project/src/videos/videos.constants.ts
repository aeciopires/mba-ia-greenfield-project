export const CONTENT_TYPE_TO_EXTENSION: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/ogg': '.ogg',
  'video/quicktime': '.mov',
} as const;

export const DEFAULT_VIDEO_EXTENSION = '.mp4';
