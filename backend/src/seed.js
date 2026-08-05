import { randomUUID } from "node:crypto";
import { pool } from "./db.js";
import { hashPassword } from "./password.js";

const DEMO_USERS = Array.from({ length: 10 }, (_, index) => ({
  email: `demo${String(index + 1).padStart(2, "0")}@example.test`,
  displayName: `테스트 회원 ${String(index + 1).padStart(2, "0")}`,
  role: index === 0 ? "ADMIN" : "MEMBER",
  membershipTier: index < 3 ? "PREMIUM" : "BASIC",
}));

export async function seedDemoUsers() {
  if (process.env.SEED_DEMO_USERS !== "true") return { inserted: 0, enabled: false };

  const password = process.env.DEMO_USER_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error("DEMO_USER_PASSWORD must be at least 12 characters when SEED_DEMO_USERS=true");
  }

  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query("BEGIN");
    for (const user of DEMO_USERS) {
      const existing = await client.query("SELECT id FROM users WHERE email = $1", [user.email]);
      if (existing.rowCount) continue;

      const userId = randomUUID();
      const passwordHash = await hashPassword(password);
      await client.query(
        `INSERT INTO users (id, email, display_name, status, role, membership_tier)
         VALUES ($1, $2, $3, 'ACTIVE', $4, $5)`,
        [userId, user.email, user.displayName, user.role, user.membershipTier],
      );
      await client.query(
        "INSERT INTO credentials (user_id, password_hash) VALUES ($1, $2)",
        [userId, passwordHash],
      );
      inserted += 1;
    }
    await client.query("COMMIT");
    return { inserted, enabled: true };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export { DEMO_USERS };
