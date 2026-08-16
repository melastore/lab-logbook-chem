// One password policy for the whole app, so a self-service change and an
// admin-set password can't disagree about what counts as acceptable.
//
// Following NIST SP 800-63B: length is the requirement that matters, and
// composition rules ("must contain a symbol") are not imposed. Instead we
// reject the things that actually get chosen — the shared initial password,
// the account name, and single repeated characters.

export const MIN_PASSWORD_LENGTH = 10;

export function passwordProblem(password: string, opts: { username?: string } = {}): string | null {
  const value = password || "";

  if (value.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (value.length > 200) {
    return "Password must be 200 characters or fewer.";
  }

  const lower = value.toLowerCase();

  const initial = process.env.LAB_INITIAL_PASSWORD || "";
  if (initial && value === initial) {
    return "Choose a password different from the shared initial password.";
  }

  const username = (opts.username || "").toLowerCase();
  if (username.length >= 3 && lower.includes(username)) {
    return "Password must not contain your username.";
  }

  if (/^(.)\1+$/.test(value)) {
    return "Password must not be a single repeated character.";
  }

  return null;
}
