-- V3__make_patient_email_optional.sql
ALTER TABLE appointments ALTER COLUMN patient_email DROP NOT NULL;
