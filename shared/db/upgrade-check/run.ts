// Check that the current migrations apply to a database that already exists.
// CI otherwise only migrates an empty database, but staging and production
// already hold tables, rows, and a migration history. This builds that state
// in a scratch `upgrade_check` database: migrate and seed it with the code at
// <base-ref>, then run the current `pnpm db:migrate` on top.
//
// It catches migrations that fail on existing rows (e.g. a NOT NULL column
// with no default) and squashed or renamed migrations, which Drizzle matches
// by folder name and so tries to re-run against tables that already exist.
//
// Usage: pnpm db:upgrade-check <base-ref>

/* eslint-disable no-console -- CLI script; progress goes to the terminal */
import "dotenv/config";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { sql } from "drizzle-orm";
import { closeDatabase, createDb } from "../../../server/db/connection";

const SCRATCH_DB = "upgrade_check";
const MIGRATIONS_DIR = "shared/db/migrations";

const baseRef = process.argv[2];
const { DATABASE_URL, APP_DATABASE_URL } = process.env;

if (!baseRef) throw new Error("Usage: pnpm db:upgrade-check <base-ref>");
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set");
if (!APP_DATABASE_URL) throw new Error("APP_DATABASE_URL is not set");

const { hostname } = new URL(DATABASE_URL);
const local = ["localhost", "127.0.0.1", "::1", "[::1]"].includes(hostname);

if (!local && !process.env.CI) {
  throw new Error(`Refusing to create a scratch database on "${hostname}"`);
}

const onScratchDb = (url: string) => {
  const scratch = new URL(url);
  scratch.pathname = `/${SCRATCH_DB}`;
  return scratch.toString();
};

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8" }).trim();

const pnpm = (cwd: string, script: string) => {
  console.log(`\n$ pnpm ${script}   (${cwd === root ? "current" : baseRef})`);
  execFileSync("pnpm", [script], {
    cwd,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: onScratchDb(DATABASE_URL),
      APP_DATABASE_URL: onScratchDb(APP_DATABASE_URL),
    },
  });
};

const root = git("rev-parse", "--show-toplevel");
const baseSha = git("rev-parse", "--verify", `${baseRef}^{commit}`);

if (!git("ls-tree", "--name-only", baseSha, `${MIGRATIONS_DIR}/`)) {
  console.log(`${baseRef} has no migrations; nothing to upgrade from.`);
  process.exit(0);
}

const admin = createDb(DATABASE_URL, process.env.DATABASE_SSL === "true");
const recreateScratchDb = async (create: boolean) => {
  await admin.execute(
    sql`drop database if exists ${sql.identifier(SCRATCH_DB)} with (force)`,
  );
  if (create) {
    await admin.execute(sql`create database ${sql.identifier(SCRATCH_DB)}`);
  }
};

const worktree = mkdtempSync(join(tmpdir(), "upgrade-check-"));

try {
  await recreateScratchDb(true);

  git("worktree", "add", "--detach", worktree, baseSha);
  symlinkSync(resolve(root, "node_modules"), join(worktree, "node_modules"));

  pnpm(worktree, "db:migrate");
  pnpm(worktree, "db:seed");
  pnpm(root, "db:migrate");

  console.log(`\nMigrations upgrade a database built from ${baseRef}.`);
} finally {
  git("worktree", "remove", "--force", worktree);
  rmSync(worktree, { recursive: true, force: true });
  await recreateScratchDb(false);
  await closeDatabase(admin);
}
