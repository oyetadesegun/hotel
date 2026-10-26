-- Two staff roles instead of four: Recreation Manager and IT admin become admin,
-- Recreation Team and Finance become staff. Existing accounts keep working.
CREATE TYPE "staff_role_new" AS ENUM ('admin', 'staff');

ALTER TABLE "staff_users"
  ALTER COLUMN "role" TYPE "staff_role_new"
  USING (CASE WHEN "role"::text IN ('manager', 'it_admin') THEN 'admin' ELSE 'staff' END)::"staff_role_new";

DROP TYPE "staff_role";
ALTER TYPE "staff_role_new" RENAME TO "staff_role";
