-- V4__add_appointment_reservation.sql
ALTER TABLE appointments ADD COLUMN reserved_until TIMESTAMP WITH TIME ZONE;
