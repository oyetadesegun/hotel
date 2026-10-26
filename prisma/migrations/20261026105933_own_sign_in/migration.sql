-- Sign-in now lives in this app (accounts, sessions), not Supabase Auth.
-- staff_users.id is a foreign key to accounts.id, so the old check against auth.users goes.
DROP TRIGGER IF EXISTS staff_users_require_auth_user ON "staff_users";
DROP FUNCTION IF EXISTS staff_users_require_auth_user();

-- Same rule as every other table: no access through Supabase's Data API by default.
ALTER TABLE "accounts"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "sessions"       ENABLE ROW LEVEL SECURITY;
ALTER TABLE "account_tokens" ENABLE ROW LEVEL SECURITY;
