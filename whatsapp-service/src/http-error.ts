export class HttpError extends Error {
  public code: string;

  constructor(
    public statusCode: number,
    message: string,
    code = "http_error"
  ) {
    super(message);
    this.code = code;
  }
}
