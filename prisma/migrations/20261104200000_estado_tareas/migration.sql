-- AlterTable
ALTER TABLE "Task" ADD COLUMN     "status" TEXT NOT NULL DEFAULT 'todo';

-- Las tareas ya completadas empiezan en su columna.
UPDATE "Task" SET "status" = 'done' WHERE "done" = true;
