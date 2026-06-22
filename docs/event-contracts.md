# Event Contracts — Healthcare Appointment Platform

> Canonical source of truth for all events exchanged between `backend` (producer) and `worker` (consumer). Both services implement against this document independently — neither imports code from the other.

---

## 0. Conventions

- **Broker**: RabbitMQ
- **Serialization**: JSON, UTF-8.
- **Envelope**: every event uses the same outer shape; only `eventType` and `payload` vary.
- **Timestamps**: ISO-8601, UTC, e.g. `2026-06-23T10:00:00Z`.
- **IDs**: UUID v4 strings.
- **Versioning**: envelope carries `schemaVersion` (integer). Breaking payload changes bump this; consumers should reject/DLQ unknown major versions rather than guess.

### Standard Envelope

```json
{
  "eventId": "uuid",
  "eventType": "APPOINTMENT_CREATED",
  "schemaVersion": 1,
  "occurredAt": "2026-06-23T10:00:00Z",
  "source": "backend",
  "payload": { }
}
```

| Field | Type | Notes |
|---|---|---|
| `eventId` | UUID | Unique per event instance. Used by consumer for idempotency tracking. Never reused on redelivery of the *same* event. |
| `eventType` | string | One of the enum values in §2. |
| `schemaVersion` | int | Starts at `1`. |
| `occurredAt` | datetime | When the domain event happened (not when published). |
| `source` | string | Always `"backend"` for now; reserved for future producers. |
| `payload` | object | Event-specific data, defined per type below. |

---

## 1. Topics

| Topic | Purpose | Producer | Consumer |
|---|---|---|---|
| `appointment.created` | New appointment booked | backend | worker |
| `appointment.cancelled` | Appointment cancelled | backend | worker |
| `appointment.dlq` | Dead-letter queue for failed processing | worker | (manual/ops, or replay tool) |

Naming rule: `<domain>.<past-tense-event>`. New events follow this pattern (e.g. `appointment.completed` if added later).

---

## 2. Event Types & Payloads

### 2.1 `APPOINTMENT_CREATED`

**Topic**: `appointment.created`
**Published**: after the booking transaction commits successfully (DB-confirmed, slot locked).

```json
{
  "eventId": "8f14e45f-ceea-4d49-a8c2-1b4f6e3a9a11",
  "eventType": "APPOINTMENT_CREATED",
  "schemaVersion": 1,
  "occurredAt": "2026-06-23T10:00:00Z",
  "source": "backend",
  "payload": {
    "appointmentId": "3b9d6e2c-1a2b-4c3d-9e8f-7a6b5c4d3e2f",
    "userId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "doctorId": "9f8e7d6c-5b4a-3c2d-1e0f-a9b8c7d6e5f4",
    "slotStartTime": "2026-06-25T09:00:00Z",
    "slotEndTime": "2026-06-25T09:30:00Z",
    "status": "CONFIRMED",
    "userEmail": "patient@example.com",
    "userPhone": "+91XXXXXXXXXX"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `appointmentId` | UUID | yes | Primary key of the appointment row |
| `userId` | UUID | yes | Patient who booked |
| `doctorId` | UUID | yes | Doctor/resource booked |
| `slotStartTime` / `slotEndTime` | datetime | yes | UTC |
| `status` | string | yes | Always `CONFIRMED` for this event |
| `userEmail` | string | yes | Needed by worker for notification dispatch |
| `userPhone` | string | no | Optional, only if SMS notification is implemented |

**Consumer responsibilities** (`worker`):
1. Check `eventId` against `processed_events` table — if already processed, ack and skip (idempotency).
2. Send confirmation notification (email/SMS/log-simulated).
3. Insert/update local `appointment_status` projection if the worker maintains one.
4. Record entry in `appointment_logs` style table: `(appointmentId, fromStatus=null, toStatus=CONFIRMED, source=event, occurredAt)`.
5. On any failure, publish a copy of the original message to `appointment.dlq` with an added `error` field, then ack the original (do not requeue indefinitely).

---

### 2.2 `APPOINTMENT_CANCELLED`

**Topic**: `appointment.cancelled`
**Published**: after a cancellation transaction commits.

```json
{
  "eventId": "5c6d7e8f-9a0b-1c2d-3e4f-5a6b7c8d9e0f",
  "eventType": "APPOINTMENT_CANCELLED",
  "schemaVersion": 1,
  "occurredAt": "2026-06-23T11:15:00Z",
  "source": "backend",
  "payload": {
    "appointmentId": "3b9d6e2c-1a2b-4c3d-9e8f-7a6b5c4d3e2f",
    "userId": "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d",
    "doctorId": "9f8e7d6c-5b4a-3c2d-1e0f-a9b8c7d6e5f4",
    "previousStatus": "CONFIRMED",
    "status": "CANCELLED",
    "cancelledBy": "USER",
    "reason": "User requested cancellation",
    "userEmail": "patient@example.com"
  }
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `appointmentId` | UUID | yes | |
| `userId` | UUID | yes | |
| `doctorId` | UUID | yes | |
| `previousStatus` | string | yes | Status before cancellation (almost always `CONFIRMED`) |
| `status` | string | yes | Always `CANCELLED` |
| `cancelledBy` | string | yes | `USER` or `ADMIN` |
| `reason` | string | no | Free text, optional |
| `userEmail` | string | yes | For notification |

**Consumer responsibilities**: same idempotency check, send cancellation notification, log the status transition, free up the slot in any local projection.

---

### 2.3 Dead-Letter Envelope — `appointment.dlq`

Worker republishes the **original envelope**, wrapped, with failure metadata appended — never mutates the original payload:

```json
{
  "originalEvent": { "...": "the full original envelope, untouched" },
  "error": {
    "message": "Connection to notification provider timed out",
    "failedAt": "2026-06-23T10:00:05Z",
    "retryCount": 3
  }
}
```

DLQ messages are for manual inspection/replay only — no automatic consumer reprocesses this topic in v1.

---

## 3. Idempotency Contract

- Every consumer **must** persist `eventId` (and ideally `eventType`) in a `processed_events` table/collection before considering the event done, and check it first thing on receipt.
- Recommended schema:
```sql
CREATE TABLE processed_events (
    event_id UUID PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    processed_at TIMESTAMP NOT NULL DEFAULT now()
);
```
- Redelivery (broker at-least-once semantics) is expected and normal — this table is what makes "process twice" safe.

---

## 4. Ordering Guarantees

- RabbitMQ: no native ordering guarantee across consumers — if using RabbitMQ, the consumer must check `occurredAt` / current DB status before applying a transition (e.g. ignore a `CANCELLED` event with an older `occurredAt` than the last applied state).

---

## 5. Versioning & Compatibility Rules

- Additive, optional fields → no version bump, consumers must ignore unknown fields.
- Removing a field, changing a field's type, or renaming → bump `schemaVersion`, and the consumer must explicitly branch on version or reject with a clear DLQ error rather than silently misparsing.
- Never reuse an `eventType` string for a different payload shape — create a new type instead.

---

## 6. Producer Rules (backend)

- Publish only **after** the DB transaction commits (`@TransactionalEventListener(phase = AFTER_COMMIT)`), so no event is ever published for a write that gets rolled back.
- Use `appointmentId` as the RabbitMQ message routing key.
- Producer must set `acks=all` to avoid silent message loss.

## 7. RabbitMQ Configuration

- Exchange: `appointment.events` (topic exchange)
- Routing keys mirror topic names: `appointment.created`, `appointment.cancelled`
- Queue: `worker.appointment.queue` bound to both routing keys
- DLQ: configure a dead-letter-exchange on the main queue rather than manual republish.