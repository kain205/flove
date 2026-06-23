export const FPT_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@fpt\.edu\.vn$/;

export function isFptEmail(email: string): boolean {
  return FPT_EMAIL_REGEX.test(email.trim());
}

export function assertFptEmail(email: string): void {
  if (!isFptEmail(email)) {
    throw new Error('Chi chap nhan email FPT (@fpt.edu.vn)');
  }
}
