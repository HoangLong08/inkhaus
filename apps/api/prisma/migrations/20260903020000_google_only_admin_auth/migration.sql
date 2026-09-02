-- Sign-in for the back office is Google-only, so there is no password to store.
-- Written by hand rather than by `migrate dev`: dropping a populated column
-- needs an interactive confirmation the CLI cannot get in a non-tty shell.
-- The dropped values are argon2 hashes and are not recoverable or wanted.
ALTER TABLE "admin_users" DROP COLUMN "passwordHash";

-- Google's `sub` claim. Stable across an email change, and bound to the row on
-- the first successful sign-in, so a recycled address cannot take over an
-- existing account. Null until then.
ALTER TABLE "admin_users" ADD COLUMN "googleSub" TEXT;

CREATE UNIQUE INDEX "admin_users_googleSub_key" ON "admin_users"("googleSub");
