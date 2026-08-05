import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/password.js";

test("password hash never contains plaintext and verifies only the original", async () => {
  const password = "DemoPass!2026";
  const encoded = await hashPassword(password);
  assert.equal(encoded.includes(password), false);
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword("wrong-password", encoded), false);
});
