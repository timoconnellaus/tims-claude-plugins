import { describe, it, expect, test } from "bun:test";

describe("Auth", () => {
  it("validates login credentials", () => {
    const result = validateLogin("user@example.com", "password123");
    expect(result.success).toBe(true);
  });

  it("handles invalid password", () => {
    const result = validateLogin("user@example.com", "wrong");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Invalid password");
  });

  test("handles empty email", () => {
    const result = validateLogin("", "password123");
    expect(result.success).toBe(false);
  });
});

function validateLogin(email: string, password: string) {
  if (!email) return { success: false, error: "Email required" };
  if (password !== "password123") return { success: false, error: "Invalid password" };
  return { success: true };
}
