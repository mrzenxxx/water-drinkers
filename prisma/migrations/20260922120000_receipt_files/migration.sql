-- Чеки: размер файла и сами байты (SPEC §8.4, §11, ADR-0003).

ALTER TABLE "receipts" ADD COLUMN "byte_size" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "receipt_files" (
  "receipt_id" UUID PRIMARY KEY,
  "bytes"      BYTEA NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
  CONSTRAINT "receipt_files_receipt_id_fkey"
    FOREIGN KEY ("receipt_id") REFERENCES "receipts"("id")
    ON DELETE NO ACTION ON UPDATE NO ACTION
);
