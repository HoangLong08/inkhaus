import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../..");

/**
 * The suite asserts on who is allowed in, so the allowlist has to be a known
 * quantity before the first test. Seeds the owners from ADMIN_BOOTSTRAP_EMAILS
 * and the one STAFF account the role tests need.
 */
export default function globalSetup() {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const run = (args: string[]) =>
    execFileSync(npm, args, { cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32" });

  console.log("\n[e2e] seeding admin allowlist + fixtures...");
  run(["run", "db:seed", "-w", "@inkhaus/api"]);
  run(["run", "db:seed:e2e", "-w", "@inkhaus/api"]);
}
