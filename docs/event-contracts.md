# Event Contracts — Healthcare Appointment Platform

> Canonical source of truth for all events exchanged between `backend` (producer) and `worker` (consumer). Both services implement against this document independently — neither imports code from the other.

---

## 0. Conventions

- **Broker**: RabbitMQ
- **Exchange**: `appointment.events` (topic exchange, durable)
- **Serialization**: JSON, UTF-8.
- **Envelope**: every event uses the same outer shape; only `eventType` and `payload` vary.
- **Timestamps**: ISO-8601, UTC, e.g. `2026-06-23T10:00:00Z`.
- **IDs**: UUID v4 strings.
- **Versioning**: envelope carries `schemaVersion` (integer). Breaking payload changes bump this; consumers should reject/DLQ unknown major versions rather than guess.
- **Naming rule**: `<domain>.<past-tense-verb>`. All routing keys follow this pattern.

### Standard Envelope

```json
{
  "eventId": "uuid",
  "eventType": "APPOINTMENT_CONFIRMED",
  "schemaVersion": 1,
  "occurredAt": "2026-06-23T10:00:00Z",
  "source": "backend",
  "payload": { }
}
```

| Field | Type | Notes |
|---|---|---|
| `eventId` | UUID | Unique per event instance. Used by consumer for idempotency tracking. Never reused on redelivery of the *same* event. |
| `eventType` | string | One of the enum values defined in §2. |
| `schemaVersion` | int | Starts at `1`. Bumped on breaking changes only. |
| `occurredAt` | datetime | When the domain event happened (not when published). |
| `source` | string | Always `"backend"` for now; reserved for future producers. |
| `payload` | object | Event-specific data, defined per type below. |

---

## 1. Topics & Queues

### 1.1 Routing Keys & Queues

| Routing Key | Event Type | Dedicated Queue | Producer | Consumer |
|---|---|---|---|---|
| `appointment.confirmed` | `APPOINTMENT_CONFIRMED` | `worker.appointment.confirmed` | backend | worker |
| `appointment.cancelled` | `APPOINTMENT_CANCELLED` | `worker.appointment.cancelled` | backend | worker |
| `appointment.completed` | `APPOINTMENT_COMPLETED` | `worker.appointment.completed` | backend | worker |
| `appointment.reservation.released` | `APPOINTMENT_RESERVATION_RELEASED` | `worker.reservation.released` | backend | worker |
| `doctor.provisioned` | `DOCTOR_PROVISIONED` | `worker.doctor.provisioned` | backend | worker |
| `doctor.availability.updated` | `DOCTOR_AVAILABILITY_UPDATED` | `worker.availability.updated` | backend | worker |
| `organisation.registered` | `ORGANISATION_REGISTERED` | `worker.organisation.registered` | backend | worker |
| `appointment.dlq` | *(error envelope)* | `worker.dlq` | worker | ops / replay tool |

> **Migration note**: The legacy routing key `appointment.created` and its single shared queue `worker.appointment.queue` are **deprecated**. The event is renamed `APPOINTMENT_CONFIRMED` with routing key `appointment.confirmed`. New deployments should use the per-event queue topology above.

---

## 2. Event Types & Payloads

### 2.1 `APPOINTMENT_CONFIRMED`

**Routing key**: `appointment.confirmed`  
**Published**: after `confirmAppointmentPayment()` transaction commits — payment accepted, slot permanently locked.

```json
{
  "eventId": "8f14e45f-ceea-4d49-a8c2-1b4f6e3a9a11",
  "eventType": "APPOINTMENT_CONFIRMED",
  "schemaVersion": 1,
  "occurredAt": "2026-06-23T10:00:00Z",
  "source": "backend",
  "payload": {
    "appointmentId": "3b9d6e2c-1a2b-4c3d-9e8f-7a6b5c4d3e2f",
    "patientName": "John Doe",
    "patientEmail": "patient@example.com",
    "patientPhone": "+91XXXXXXXXXX",
    "doctorId": "9f8e7d6c-5b4a-3c2d-1e0f-a9b8c7d6e5f4",
    "doctorName": "Dr. Dave Smith",
    "orgId": "00000000-0000-0000-0000-000000000001",
    "orgName": "Antigravity Clinic",
    "orgSlug": "antigravity-clinic",
    "slotStartTime": "2026-06-25T09:00:00Z",
    "slotEndTime": "2026-06-25T09:30:00Z",
    "paymentMethod": "CASH",
    "status": "CONFIRMED"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `appointmentId` | UUID | yes | Primary key of the appointment row |
| `patientName` | string | yes | Full name of the patient |
| `patientEmail` | string | no | May be null if patient did not provide email |
| `patientPhone` | string | yes | Phone number for SMS notification |
| `doctorId` | UUID | yes | Doctor who will see the patient |
| `doctorName` | string | yes | Display name, e.g. `"Dr. Dave Smith"` |
| `orgId` | UUID | yes | Organisation the appointment belongs to |
| `orgName` | string | yes | Human-readable clinic name for email branding |
| `orgSlug` | string | yes | URL slug for booking link context |
| `slotStartTime` / `slotEndTime` | datetime | yes | UTC |
| `paymentMethod` | string | yes | `CASH`, `CARD`, or `UPI` |
| `status` | string | yes | Always `CONFIRMED` for this event |

**Consumer responsibilities** (`worker`):
1. Check `eventId` against `processed_events` — if found, ack and skip (idempotency).
2. Send confirmation email to `patientEmail` (if present) using `orgName` for branding.
3. Send confirmation SMS to `patientPhone`.
4. Record `(appointmentId, fromStatus=PENDING_PAYMENT, toStatus=CONFIRMED)` in `appointment_logs`.
5. On failure, publish to `appointment.dlq` then ack original.

---

### 2.2 `APPOINTMENT_CANCELLED`

**Routing key**: `appointment.cancelled`  
**Published**: after `cancelAppointment()` transaction commits.

```json
{
  "eventId": "5c6d7e8f-9a0b-1c2d-3e4f-5a6b7c8d9e0f",
  "eventType": "APPOINTMENT_CANCELLED",
  "schemaVersion": 1,
  "occurredAt": "2026-06-23T11:15:00Z",
  "source": "backend",
  "payload": {
    "appointmentId": "3b9d6e2c-1a2b-4c3d-9e8f-7a6b5c4d3e2f",
    "patientName": "John Doe",
    "patientEmail": "patient@example.com",
    "patientPhone": "+91XXXXXXXXXX",
    "doctorId": "9f8e7d6c-5b4a-3c2d-1e0f-a9b8c7d6e5f4",
    "doctorName": "Dr. Dave Smith",
    "orgName": "Antigravity Clinic",
    "orgSlug": "antigravity-clinic",
    "slotStartTime": "2026-06-25T09:00:00Z",
    "previousStatus": "CONFIRMED",
    "status": "CANCELLED",
    "cancelledBy": "USER",
    "reason": "User requested cancellation"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `appointmentId` | UUID | yes | |
| `patientName` | string | yes | |
| `patientEmail` | string | no | May be null |
| `patientPhone` | string | yes | |
| `doctorId` | UUID | yes | |
| `doctorName` | string | yes | |
| `orgName` | string | yes | For email branding |
| `orgSlug` | string | yes | |
| `slotStartTime` | datetime | yes | UTC |
| `previousStatus` | string | yes | Status before cancellation — typically `CONFIRMED` |
| `status` | string | yes | Always `CANCELLED` |
| `cancelledBy` | string | yes | `PATIENT`, `ADMIN`, or `DOCTOR` |
| `reason` | string | no | Free text |

**Consumer responsibilities**: idempotency check → send cancellation email/SMS → log status transition.

---

### 2.3 `APPOINTMENT_COMPLETED` *(new)*

**Routing key**: `appointment.completed`  
**Published**: after `completeAppointment()` transaction commits — doctor/admin has marked the visit as done.

```json
{
  "eventId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "eventType": "APPOINTMENT_COMPLETED",
  "schemaVersion": 1,
  "occurredAt": "2026-06-25T09:35:00Z",
  "source": "backend",
  "payload": {
    "appointmentId": "3b9d6e2c-1a2b-4c3d-9e8f-7a6b5c4d3e2f",
    "patientName": "John Doe",
    "patientEmail": "patient@example.com",
    "patientPhone": "+91XXXXXXXXXX",
    "doctorId": "9f8e7d6c-5b4a-3c2d-1e0f-a9b8c7d6e5f4",
    "doctorName": "Dr. Dave Smith",
    "orgName": "Antigravity Clinic",
    "orgSlug": "antigravity-clinic",
    "slotStartTime": "2026-06-25T09:00:00Z",
    "slotEndTime": "2026-06-25T09:30:00Z",
    "completedBy": "dr.dave@antigravity-clinic.com",
    "status": "COMPLETED"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `appointmentId` | UUID | yes | |
| `patientName` | string | yes | |
| `patientEmail` | string | no | May be null |
| `patientPhone` | string | yes | |
| `doctorId` | UUID | yes | |
| `doctorName` | string | yes | |
| `orgName` | string | yes | |
| `orgSlug` | string | yes | |
| `slotStartTime` / `slotEndTime` | datetime | yes | UTC |
| `completedBy` | string | yes | Email or name of the staff member who completed the appointment |
| `status` | string | yes | Always `COMPLETED` |

**Consumer responsibilities**:
1. Idempotency check.
2. Send post-visit feedback request email/SMS to patient.
3. Record `(appointmentId, fromStatus=CONFIRMED, toStatus=COMPLETED)` in `appointment_logs`.
4. Update any billing/projection tables marking the visit as serviced.

---

### 2.4 `APPOINTMENT_RESERVATION_RELEASED` *(new)*

**Routing key**: `appointment.reservation.released`  
**Published**: after `releaseAppointmentReservation()` executes — either the 30-second payment window expired or the patient explicitly cancelled before paying.

```json
{
  "eventId": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
  "eventType": "APPOINTMENT_RESERVATION_RELEASED",
  "schemaVersion": 1,
  "occurredAt": "2026-06-23T10:00:31Z",
  "source": "backend",
  "payload": {
    "appointmentId": "3b9d6e2c-1a2b-4c3d-9e8f-7a6b5c4d3e2f",
    "doctorId": "9f8e7d6c-5b4a-3c2d-1e0f-a9b8c7d6e5f4",
    "orgId": "00000000-0000-0000-0000-000000000001",
    "orgSlug": "antigravity-clinic",
    "slotStartTime": "2026-06-25T09:00:00Z",
    "reservedAt": "2026-06-23T10:00:00Z",
    "releasedAt": "2026-06-23T10:00:31Z",
    "reason": "EXPIRED"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `appointmentId` | UUID | yes | The appointment record that was deleted/released |
| `doctorId` | UUID | yes | |
| `orgId` | UUID | yes | |
| `orgSlug` | string | yes | |
| `slotStartTime` | datetime | yes | The slot that is now free again |
| `reservedAt` | datetime | yes | When the hold was created |
| `releasedAt` | datetime | yes | When it was released |
| `reason` | string | yes | `EXPIRED` (timer elapsed) or `USER_CANCELLED` (explicit cancel before payment) |

**Consumer responsibilities**:
1. Idempotency check.
2. Log abandonment metric (useful for conversion analytics: reserved → abandoned rate).
3. Optionally notify any waitlisted patients that the slot is now available (future feature).
4. No `appointment_logs` write needed since the appointment row is deleted, not transitioned.

> **Note**: Because the appointment row is hard-deleted on release, this event is the only durable record of the hold attempt. The worker must persist the relevant fields in its own store if analytics are required.

---

### 2.5 `DOCTOR_PROVISIONED` *(new)*

**Routing key**: `doctor.provisioned`  
**Published**: after `provisionDoctor()` transaction commits — admin has created a new doctor account.

```json
{
  "eventId": "c3d4e5f6-a7b8-9012-cdef-012345678902",
  "eventType": "DOCTOR_PROVISIONED",
  "schemaVersion": 1,
  "occurredAt": "2026-06-23T08:00:00Z",
  "source": "backend",
  "payload": {
    "doctorId": "9f8e7d6c-5b4a-3c2d-1e0f-a9b8c7d6e5f4",
    "doctorEmail": "dr.dave@antigravity-clinic.com",
    "firstName": "Dave",
    "lastName": "Smith",
    "department": "Cardiology",
    "degrees": "MD, FACC",
    "orgId": "00000000-0000-0000-0000-000000000001",
    "orgName": "Antigravity Clinic",
    "orgSlug": "antigravity-clinic",
    "provisionedBy": "admin@antigravity-clinic.com"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `doctorId` | UUID | yes | New doctor's user ID |
| `doctorEmail` | string | yes | Doctor's login email |
| `firstName` / `lastName` | string | yes | |
| `department` | string | yes | Specialty department |
| `degrees` | string | no | Credentials string |
| `orgId` | UUID | yes | Organisation they belong to |
| `orgName` | string | yes | For email branding |
| `orgSlug` | string | yes | |
| `provisionedBy` | string | yes | Email of the admin who created the account |

**Consumer responsibilities**:
1. Idempotency check.
2. Send welcome email to `doctorEmail` with login instructions, portal URL (`/login`), and the `orgName` context.
3. Optionally notify HR/SSO systems (future integration point).

---

### 2.6 `DOCTOR_AVAILABILITY_UPDATED` *(new)*

**Routing key**: `doctor.availability.updated`  
**Published**: after `updateAvailability()` transaction commits — a doctor's weekly schedule has been modified by an admin.

```json
{
  "eventId": "d4e5f6a7-b8c9-0123-defa-123456789003",
  "eventType": "DOCTOR_AVAILABILITY_UPDATED",
  "schemaVersion": 1,
  "occurredAt": "2026-06-23T09:00:00Z",
  "source": "backend",
  "payload": {
    "doctorId": "9f8e7d6c-5b4a-3c2d-1e0f-a9b8c7d6e5f4",
    "doctorName": "Dr. Dave Smith",
    "orgId": "00000000-0000-0000-0000-000000000001",
    "orgSlug": "antigravity-clinic",
    "updatedBy": "admin@antigravity-clinic.com",
    "updatedSchedule": [
      { "dayOfWeek": "MONDAY",    "startTime": "09:00:00", "endTime": "17:00:00", "enabled": true },
      { "dayOfWeek": "WEDNESDAY", "startTime": "10:00:00", "endTime": "14:00:00", "enabled": true },
      { "dayOfWeek": "SATURDAY",  "startTime": null,        "endTime": null,        "enabled": false }
    ]
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `doctorId` | UUID | yes | |
| `doctorName` | string | yes | |
| `orgId` | UUID | yes | |
| `orgSlug` | string | yes | |
| `updatedBy` | string | yes | Admin email who made the change |
| `updatedSchedule` | array | yes | Full set of all 7 days after the update. `enabled: false` entries have null times. |

**Consumer responsibilities**:
1. Idempotency check.
2. Invalidate any cached slot grids for this doctor.
3. Optionally broadcast a WebSocket or Server-Sent Event to frontend clients currently viewing this doctor's availability (future feature).
4. Log the change for audit purposes.

---

### 2.7 `ORGANISATION_REGISTERED` *(new)*

**Routing key**: `organisation.registered`  
**Published**: after `registerAdmin()` transaction commits — a new clinic/tenant and its admin account have been created.

```json
{
  "eventId": "e5f6a7b8-c9d0-1234-efab-234567890004",
  "eventType": "ORGANISATION_REGISTERED",
  "schemaVersion": 1,
  "occurredAt": "2026-06-23T07:00:00Z",
  "source": "backend",
  "payload": {
    "orgId": "00000000-0000-0000-0000-000000000001",
    "orgName": "Antigravity Clinic",
    "orgSlug": "antigravity-clinic",
    "adminId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "adminEmail": "admin@antigravity-clinic.com",
    "adminFirstName": "Admin",
    "adminLastName": "User",
    "registeredAt": "2026-06-23T07:00:00Z"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `orgId` | UUID | yes | New organisation's ID |
| `orgName` | string | yes | Human-readable name |
| `orgSlug` | string | yes | URL slug — unique across all tenants |
| `adminId` | UUID | yes | The admin user created alongside the org |
| `adminEmail` | string | yes | Admin's login email |
| `adminFirstName` / `adminLastName` | string | yes | |
| `registeredAt` | datetime | yes | Same as `occurredAt` for convenience |

**Consumer responsibilities**:
1. Idempotency check.
2. Send welcome/onboarding email to `adminEmail` with:
   - Patient booking link: `/o/<orgSlug>`
   - Admin portal link: `/admin`
   - Getting-started checklist (provision doctors, set availability).
3. Optionally trigger a trial billing record or CRM entry (future integration point).

---

### 2.8 Dead-Letter Envelope — `appointment.dlq`

Worker republishes the **original envelope**, wrapped with failure metadata — the original payload is never mutated:

```json
{
  "originalEvent": { "...": "the full original envelope, untouched" },
  "error": {
    "message": "Connection to notification provider timed out",
    "failedAt": "2026-06-23T10:00:05Z",
    "retryCount": 1
  }
}
```

DLQ messages are for manual inspection/replay only. No automatic consumer reprocesses this topic in v1.

---

## 3. Idempotency Contract

- Every consumer **must** persist `eventId` (and `eventType`) in a `processed_events` table before considering the event done, and check it first thing on receipt.
- Recommended schema:

```sql
CREATE TABLE processed_events (
    id          UUID PRIMARY KEY,         -- stores eventId
    event_type  VARCHAR(100) NOT NULL,
    processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
```

- Redelivery (at-least-once broker semantics) is expected and normal. This table makes "process twice" safe.

---

## 4. Ordering Guarantees

- RabbitMQ provides no native ordering guarantee across consumers. The consumer must compare `occurredAt` / current DB state before applying a transition (e.g. ignore a `CANCELLED` event with an older `occurredAt` than the last applied state).

---

## 5. Versioning & Compatibility Rules

- **Additive, optional fields** → no version bump required; consumers must ignore unknown fields.
- **Removing a field, changing a type, or renaming** → bump `schemaVersion`; consumer must branch on version or reject to DLQ with a clear error rather than silently misparse.
- **Never reuse** an `eventType` string for a different payload shape — create a new type instead.
- The deprecated `APPOINTMENT_CREATED` type (v1) is replaced by `APPOINTMENT_CONFIRMED`. Any consumer still receiving `APPOINTMENT_CREATED` should route it to DLQ with reason `"deprecated_event_type"`.

---

## 6. Producer Rules (backend)

- Publish **only after** the DB transaction commits — use `@TransactionalEventListener(phase = AFTER_COMMIT)` so no event is published for a write that gets rolled back.
- Set message `delivery_mode = 2` (persistent) so messages survive broker restarts.
- Each event **must** have a freshly generated `eventId` (UUID v4) — never reuse an ID even on a retry.

---

## 7. RabbitMQ Configuration

### Exchange
- Name: `appointment.events`
- Type: `topic` (durable)

### Queues & Bindings

```
appointment.events (topic exchange)
  ├── appointment.confirmed              → worker.appointment.confirmed
  ├── appointment.cancelled              → worker.appointment.cancelled
  ├── appointment.completed              → worker.appointment.completed
  ├── appointment.reservation.released  → worker.reservation.released
  ├── doctor.provisioned                 → worker.doctor.provisioned
  ├── doctor.availability.updated        → worker.availability.updated
  └── organisation.registered           → worker.organisation.registered

appointment.dlq (direct exchange)
  └── appointment.dlq                   → worker.dlq
```

All queues are declared **durable**. Workers use `prefetch_count=1` (one message at a time).

### Deprecated / Legacy
- Routing key `appointment.created` → `worker.appointment.queue` — **do not use in new deployments**. Retained only for backward compatibility during migration window.