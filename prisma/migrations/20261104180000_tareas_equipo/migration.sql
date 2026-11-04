-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "teamId" TEXT,
ADD COLUMN     "assigneeId" TEXT;

-- CreateIndex
CREATE INDEX "Task_teamId_done_idx" ON "Task"("teamId", "done");

-- CreateIndex
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
