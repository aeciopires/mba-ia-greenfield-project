export abstract class DomainException extends Error {
  constructor(
    public readonly errorCode: string,
    public readonly httpStatus: number,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class EmailAlreadyExistsException extends DomainException {
  constructor() {
    super('EMAIL_ALREADY_EXISTS', 409, 'Email is already registered');
  }
}

export class InvalidCredentialsException extends DomainException {
  constructor() {
    super('INVALID_CREDENTIALS', 401, 'Invalid email or password');
  }
}

export class EmailNotConfirmedException extends DomainException {
  constructor() {
    super('EMAIL_NOT_CONFIRMED', 403, 'Email address has not been confirmed');
  }
}

export class InvalidTokenException extends DomainException {
  constructor() {
    super('INVALID_TOKEN', 401, 'Token is invalid');
  }
}

export class TokenExpiredException extends DomainException {
  constructor() {
    super('TOKEN_EXPIRED', 401, 'Token has expired');
  }
}

export class TokenReuseDetectedException extends DomainException {
  constructor() {
    super(
      'TOKEN_REUSE_DETECTED',
      401,
      'Token reuse detected — all sessions revoked',
    );
  }
}

export class VideoNotFoundException extends DomainException {
  constructor() {
    super('VIDEO_NOT_FOUND', 404, 'Video not found');
  }
}

export class VideoNotInDraftStatusException extends DomainException {
  constructor() {
    super('VIDEO_NOT_IN_DRAFT_STATUS', 409, 'Video is not in draft status');
  }
}

export class VideoNotReadyException extends DomainException {
  constructor() {
    super(
      'VIDEO_NOT_READY',
      409,
      'Video must be in ready status to perform this action',
    );
  }
}

export class VideoAlreadyPublishedException extends DomainException {
  constructor() {
    super('VIDEO_ALREADY_PUBLISHED', 409, 'Video is already published');
  }
}

export class CategoryNotFoundException extends DomainException {
  constructor() {
    super('CATEGORY_NOT_FOUND', 404, 'Category not found');
  }
}

export class ChannelNotFoundException extends DomainException {
  constructor() {
    super('CHANNEL_NOT_FOUND', 404, 'Channel not found');
  }
}

export class CommentNotFoundException extends DomainException {
  constructor() {
    super('COMMENT_NOT_FOUND', 404, 'Comment not found');
  }
}

export class CommentNestingNotAllowedException extends DomainException {
  constructor() {
    super(
      'COMMENT_NESTING_NOT_ALLOWED',
      422,
      'Replies to replies are not allowed',
    );
  }
}

export class AlreadySubscribedException extends DomainException {
  constructor() {
    super('ALREADY_SUBSCRIBED', 409, 'Already subscribed to this channel');
  }
}

export class NotSubscribedException extends DomainException {
  constructor() {
    super('NOT_SUBSCRIBED', 409, 'Not subscribed to this channel');
  }
}
