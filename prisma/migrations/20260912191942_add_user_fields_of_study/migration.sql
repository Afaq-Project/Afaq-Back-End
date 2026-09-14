-- CreateTable
CREATE TABLE "user_fields_of_study" (
    "user_id" UUID NOT NULL,
    "field_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_fields_of_study_pkey" PRIMARY KEY ("user_id","field_id")
);

-- AddForeignKey
ALTER TABLE "user_fields_of_study" ADD CONSTRAINT "user_fields_of_study_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_fields_of_study" ADD CONSTRAINT "user_fields_of_study_field_id_fkey" FOREIGN KEY ("field_id") REFERENCES "fields_of_study"("id") ON DELETE CASCADE ON UPDATE CASCADE;
