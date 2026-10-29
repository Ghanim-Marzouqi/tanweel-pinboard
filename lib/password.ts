import { hash, verify } from '@node-rs/argon2';

// @node-rs/argon2 defaults to argon2id with m=19 MiB, t=2, p=1 — the OWASP
// recommended baseline — so no tuning parameters are passed here.

export function hashPassword(plain: string): Promise<string> {
  return hash(plain);
}

export async function verifyPassword(passwordHash: string, plain: string): Promise<boolean> {
  try {
    return await verify(passwordHash, plain);
  } catch {
    return false;
  }
}

// Verified against when the username doesn't exist, so a failed lookup takes
// about as long as a wrong password and doesn't reveal which usernames exist.
let dummyHash: Promise<string> | undefined;

export async function burnPasswordCheck(plain: string): Promise<void> {
  dummyHash ??= hash('dummy-password-for-timing');
  await verifyPassword(await dummyHash, plain);
}
