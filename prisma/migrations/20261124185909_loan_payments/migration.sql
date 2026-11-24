-- AlterTable
ALTER TABLE "loans" ADD COLUMN     "last_paid_month" CHAR(7),
ADD COLUMN     "last_payment_tx_id" UUID;
