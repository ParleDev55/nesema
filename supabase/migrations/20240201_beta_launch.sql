-- ─────────────────────────────────────────
-- Beta launch migration
-- Adds notification_preferences to practitioners and patients
-- Adds reminder_sent to appointments
-- ─────────────────────────────────────────

-- Notification preferences for practitioners (jsonb)
alter table public.practitioners
  add column if not exists notification_preferences jsonb default '{
    "new_booking": true,
    "appointment_reminder": true,
    "patient_checkin": true,
    "new_message": true,
    "lab_result_uploaded": true,
    "payment_received": true
  }'::jsonb;

-- Notification preferences for patients (jsonb)
alter table public.patients
  add column if not exists notification_preferences jsonb default '{
    "appointment_reminder": true,
    "checkin_reminder": true,
    "new_message": true,
    "care_plan_updated": true,
    "checkin_reminder_time": "08:00"
  }'::jsonb;

-- Reminder sent flag on appointments (prevents duplicate reminder emails)
alter table public.appointments
  add column if not exists reminder_sent boolean default false;
