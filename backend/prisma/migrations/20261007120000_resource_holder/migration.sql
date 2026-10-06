-- AlterTable
ALTER TABLE "resources" ADD COLUMN     "holder_id" UUID;

-- AlterTable
ALTER TABLE "resource_logs" ADD COLUMN     "holder_id" UUID;

-- AddForeignKey
ALTER TABLE "resources" ADD CONSTRAINT "resources_holder_id_fkey" FOREIGN KEY ("holder_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource_logs" ADD CONSTRAINT "resource_logs_holder_id_fkey" FOREIGN KEY ("holder_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
