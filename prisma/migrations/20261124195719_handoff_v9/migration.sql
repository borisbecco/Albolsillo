-- CreateEnum
CREATE TYPE "TxSource" AS ENUM ('manual', 'import', 'mail', 'share');

-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'joined', 'cancelled', 'expired');

-- CreateEnum
CREATE TYPE "SourceKind" AS ENUM ('forward', 'share');

-- CreateEnum
CREATE TYPE "SourceStatus" AS ENUM ('pending', 'active', 'disabled');

-- CreateEnum
CREATE TYPE "DetectedOrigin" AS ENUM ('mail', 'share');

-- CreateEnum
CREATE TYPE "DetectedStatus" AS ENUM ('pending', 'confirmed', 'discarded');

-- AlterEnum
ALTER TYPE "TxType" ADD VALUE 'card_payment';

-- AlterTable
ALTER TABLE "card_installments" ADD COLUMN     "cancelled_at" TIMESTAMPTZ,
ADD COLUMN     "category_id" TEXT,
ADD COLUMN     "first_transaction_id" UUID,
ADD COLUMN     "total" DECIMAL(14,2);

-- AlterTable
ALTER TABLE "cards" ADD COLUMN     "balance_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cycle_paid" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cycle_paid_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "cycle_start" DATE;

-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "lender" TEXT;

-- AlterTable
ALTER TABLE "push_subscriptions" ADD COLUMN     "user_agent" TEXT;

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "detected_expense_id" UUID,
ADD COLUMN     "installment_id" UUID,
ADD COLUMN     "installment_number" INTEGER,
ADD COLUMN     "loan_id" UUID,
ADD COLUMN     "source" "TxSource" NOT NULL DEFAULT 'manual';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "android_waitlist" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "invited_by" UUID,
ADD COLUMN     "invites_quota" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "tour_done_at" TIMESTAMPTZ;

-- CreateTable
CREATE TABLE "card_statements" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "card_id" UUID NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL,
    "balance_usd" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "minimum" DECIMAL(14,2) NOT NULL,
    "close_day" INTEGER NOT NULL,
    "due_day" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "card_statements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invites" (
    "id" UUID NOT NULL,
    "inviter_id" UUID,
    "email" CITEXT NOT NULL,
    "code" CHAR(9) NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "expires_at" TIMESTAMPTZ NOT NULL,
    "joined_user_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_sources" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "kind" "SourceKind" NOT NULL,
    "address_code" CHAR(6),
    "confirmation_code" TEXT,
    "confirmation_link" TEXT,
    "status" "SourceStatus" NOT NULL DEFAULT 'pending',
    "last_received_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "detected_expenses" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "source_id" UUID,
    "origin" "DetectedOrigin" NOT NULL,
    "external_id" TEXT,
    "wallet" TEXT,
    "merchant" TEXT NOT NULL,
    "merchant_domain" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "date" DATE NOT NULL,
    "suggested_category_id" TEXT,
    "suggested_account_id" UUID,
    "possible_duplicate_of" UUID,
    "learned" BOOLEAN NOT NULL DEFAULT false,
    "status" "DetectedStatus" NOT NULL DEFAULT 'pending',
    "transaction_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "detected_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_rules" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "merchant_key" TEXT NOT NULL,
    "merchant_label" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "merchant_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unknown_senders" (
    "sender" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,
    "last_seen" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unknown_senders_pkey" PRIMARY KEY ("sender")
);

-- CreateIndex
CREATE INDEX "card_statements_card_id_created_at_idx" ON "card_statements"("card_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "invites_code_key" ON "invites"("code");

-- CreateIndex
CREATE INDEX "invites_inviter_id_idx" ON "invites"("inviter_id");

-- CreateIndex
CREATE UNIQUE INDEX "expense_sources_address_code_key" ON "expense_sources"("address_code");

-- CreateIndex
CREATE INDEX "expense_sources_user_id_idx" ON "expense_sources"("user_id");

-- CreateIndex
CREATE INDEX "detected_expenses_user_id_status_idx" ON "detected_expenses"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "detected_expenses_user_id_external_id_key" ON "detected_expenses"("user_id", "external_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_rules_user_id_merchant_key_key" ON "merchant_rules"("user_id", "merchant_key");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_loan_id_fkey" FOREIGN KEY ("loan_id") REFERENCES "loans"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_installment_id_fkey" FOREIGN KEY ("installment_id") REFERENCES "card_installments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_statements" ADD CONSTRAINT "card_statements_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invites" ADD CONSTRAINT "invites_inviter_id_fkey" FOREIGN KEY ("inviter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_sources" ADD CONSTRAINT "expense_sources_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detected_expenses" ADD CONSTRAINT "detected_expenses_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "detected_expenses" ADD CONSTRAINT "detected_expenses_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "expense_sources"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_rules" ADD CONSTRAINT "merchant_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
