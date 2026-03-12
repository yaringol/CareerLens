export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(404, message);
    this.name = 'NotFoundError';
  }
}

export class UnprocessableError extends AppError {
  constructor(message: string) {
    super(422, message);
    this.name = 'UnprocessableError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string) {
    super(500, message);
    this.name = 'DatabaseError';
  }
}

export class CvExtractionError extends AppError {
  constructor(message: string) {
    super(422, message);
    this.name = 'CvExtractionError';
  }
}

export class DsModelError extends AppError {
  constructor(message: string, statusCode: 502 | 503 = 502) {
    super(statusCode, message);
    this.name = 'DsModelError';
  }
}
