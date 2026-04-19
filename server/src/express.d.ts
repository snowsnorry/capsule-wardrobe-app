declare namespace Express {
  interface Request {
    user: {
      email: string;
    };
    auth: {
      sessionId: string;
      csrfToken: string;
    };
  }
}
