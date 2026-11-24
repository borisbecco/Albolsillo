-- AlterTable
ALTER TABLE "users" ADD COLUMN     "other_income_currency" "Currency" NOT NULL DEFAULT 'USD',
ADD COLUMN     "salary_currency" "Currency" NOT NULL DEFAULT 'ARS';
