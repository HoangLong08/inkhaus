import { execFileSync } from "node:child_process";
import path from "node:path";

const repoRoot = path.resolve(__dirname, "../../..");

/**
 * The account tests assert on a shopper with a history, so that history has to
 * be a known quantity before the first test. `db:seed` puts the catalogue in
 * place (the fixture order needs a real product/colour pairing) and
 * `db:seed:e2e` files one guest order under the test shopper's address.
 */
export default function globalSetup() {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const run = (args: string[]) =>
    execFileSync(npm, args, { cwd: repoRoot, stdio: "inherit", shell: process.platform === "win32" });

  console.log("\n[e2e] seeding catalogue + storefront fixtures...");
  run(["run", "db:seed", "-w", "@inkhaus/api"]);
  run(["run", "db:seed:e2e", "-w", "@inkhaus/api"]);
}
