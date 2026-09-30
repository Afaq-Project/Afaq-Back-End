export interface VerificationEmailJobPayload {
  to: string;
  url: string;
  userId: string;
}

export interface PasswordResetEmailJobPayload {
  to: string;
  url: string;
  userId: string;
}
