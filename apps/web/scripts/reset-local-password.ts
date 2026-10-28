import { and, eq } from "drizzle-orm";
import { hashPassword } from "better-auth/crypto";
import { hmacIndex, safeDecrypt } from "@norish/auth/crypto";
import { db, resetDbConnection } from "@norish/db/drizzle";
import { accounts, sessions, users } from "@norish/db/schema";

interface CliOptions {
  email?: string;
  password?: string;
  keepSessions: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    email: process.env.NORISH_RESET_EMAIL,
    password: process.env.NORISH_RESET_PASSWORD,
    keepSessions: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    const next = argv[i + 1];

    if (arg === "--email" && next) {
      options.email = next;
      i += 1;
      continue;
    }

    if (arg === "--password" && next) {
      options.password = next;
      i += 1;
      continue;
    }

    if (arg === "--keep-sessions") {
      options.keepSessions = true;
    }
  }

  return options;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function findUserByEmail(email: string) {
  const normalizedEmail = normalizeEmail(email);
  const candidateHashes = new Set([hmacIndex(normalizedEmail), hmacIndex(email.trim()), hmacIndex(email)]);

  for (const emailHmac of candidateHashes) {
    const [user] = await db.select().from(users).where(eq(users.emailHmac, emailHmac)).limit(1);

    if (user) return user;
  }

  const allUsers = await db.select().from(users);

  return (
    allUsers.find((user) => {
      const decryptedEmail = safeDecrypt(user.email);

      return decryptedEmail ? normalizeEmail(decryptedEmail) === normalizedEmail : false;
    }) ?? null
  );
}

async function resetPassword() {
  const options = parseArgs(process.argv.slice(2));
  const email = options.email?.trim();
  const password = options.password;

  if (!email) {
    throw new Error("Missing email. Pass --email or set NORISH_RESET_EMAIL.");
  }

  if (!password) {
    throw new Error("Missing password. Pass --password or set NORISH_RESET_PASSWORD.");
  }

  if (password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const user = await findUserByEmail(email);

  if (!user) {
    throw new Error(`No user found for ${email}.`);
  }

  const passwordHash = await hashPassword(password);
  const now = new Date();
  const [credentialAccount] = await db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, user.id), eq(accounts.providerId, "credential")))
    .limit(1);

  if (credentialAccount) {
    await db
      .update(accounts)
      .set({
        password: passwordHash,
        updatedAt: now,
      })
      .where(eq(accounts.id, credentialAccount.id));
  } else {
    await db.insert(accounts).values({
      userId: user.id,
      providerId: "credential",
      accountId: user.id,
      password: passwordHash,
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!options.keepSessions) {
    await db.delete(sessions).where(eq(sessions.userId, user.id));
  }

  console.log(`Password reset for ${email}. Existing sessions ${options.keepSessions ? "kept" : "revoked"}.`);
}

resetPassword()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await resetDbConnection();
  });
