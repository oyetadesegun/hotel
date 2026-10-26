-- Online membership sign-up: pay first, fill in the application form afterwards.
-- A membership paid online starts as 'profile_pending' until the person completes the form.

-- AlterEnum
ALTER TYPE "application_status" ADD VALUE 'profile_pending' BEFORE 'paid_waiting_review';

-- AlterTable
ALTER TABLE "memberships" ADD COLUMN     "profile" JSONB,
ADD COLUMN     "profile_completed_at" TIMESTAMPTZ(6);
