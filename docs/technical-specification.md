# Healthcare Appointment Platform — Technical Specification

> **Purpose of this document**: This is the authoritative reference for building this project. It defines folder structure, coding standards, naming conventions, architectural rules, and quality gates. Follow it exactly. Where a decision is not covered here, default to the principle in §0 (Guiding Principles).

---

## 0. Guiding Principles

1. **Clean architecture over cleverness.** Every service is layered: API → Service → Repository/Domain. No business logic in controllers. No SQL in services.
2. **Explicit over implicit.** No magic strings, no hidden config, no untyped payloads between services.
3. **Idempotent and concurrency-safe by default.** Every write endpoint and every event consumer must be safe to retry.
4. **Fail loud, fail typed.** Use custom exceptions and structured error responses — never swallow exceptions silently.
5. **One repo, isolated services.** Monorepo, but each service must be independently buildable/runnable (its own Dockerfile, its own dependency manifest).
6. **Everything documented at the point of use.** Swagger for REST APIs, docstrings/Javadoc for non-obvious logic, ADRs for architectural decisions.

---

## 1. Repository Structure

```
healthcare-appointment-platform/
├── backend/                 # Java service — core API
│   ├── src/main/java/com/healthapp/appointment/
│   │   ├── AppointmentApplication.java
│   │   ├── config/                     # Security, RabbitMQ, Swagger, CORS configs
│   │   ├── controller/                 # REST controllers (thin)
│   │   ├── dto/                        # Request/response DTOs (never expose entities)
│   │   │   ├── request/
│   │   │   └── response/
│   │   ├── entity/                     # JPA entities
│   │   ├── repository/                 # Spring Data repositories
│   │   ├── service/
│   │   │   ├── impl/
│   │   │   └── (interfaces here)
│   │   ├── event/                      # RabbitMQ producers + event payload classes
│   │   ├── exception/                  # Custom exceptions + GlobalExceptionHandler
│   │   ├── security/                   # JWT filter, UserDetailsService, etc.
│   │   ├── mapper/                     # Entity <-> DTO mappers (MapStruct or manual)
│   │   └── util/
│   ├── src/main/resources/
│   │   ├── application.yml
│   │   ├── application-dev.yml
│   │   ├── application-prod.yml
│   │   └── db/migration/               # Flyway migrations: V1__init.sql, V2__...
│   ├── src/test/java/...               # Mirrors main structure
│   ├── Dockerfile
│   ├── pom.xml
│   └── README.md
│
├── worker/                      # Python event consumer/worker
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                     # Entry point / consumer bootstrap
│   │   ├── config.py                   # Env-based settings (pydantic-settings)
│   │   ├── consumers/                  # RabbitMQ consumer handlers
│   │   ├── services/                   # Business logic (notification, status update)
│   │   ├── models/                     # Pydantic models / ORM models
│   │   ├── repositories/                # DB access layer
│   │   ├── exceptions/
│   │   └── utils/
│   ├── tests/                          # Mirrors app structure
│   ├── requirements.txt / pyproject.toml
│   ├── Dockerfile
│   └── README.md
│
├── frontend/                           # ViteJS or Next.js
│   ├── src/
│   │   ├── api/                        # API client modules (one per resource)
│   │   ├── components/
│   │   │   ├── common/
│   │   │   └── appointment/
│   │   ├── pages/ (or routes/)
│   │   ├── hooks/
│   │   ├── store/                      # State management (Zustand/Redux/Context)
│   │   ├── types/                      # TS interfaces matching backend DTOs
│   │   └── utils/
│   ├── Dockerfile
│   ├── package.json
│   └── README.md
│
├── docs/
│   ├── api/                            # Exported OpenAPI/Swagger JSON
│   ├── db-schema.png / .sql
│   ├── architecture-diagram.png
│   ├── event-contracts.md              # Canonical event schema definitions
│   └── adr/                            # Architecture Decision Records, ADR-001..N
│
├── docker-compose.yml                  # Spins up: postgres, rabbitmq, all 3 services
├── .env.example
├── .gitignore
└── README.md                           # Root: project overview + setup instructions
```

**Rule**: No service may import code directly from another service's folder. Cross-service contracts live only in `docs/event-contracts.md` and are implemented independently on each side.

---

## 2. Naming Conventions

| Item | Convention | Example |
|---|---|---|
| Java packages | lowercase, dot-separated | `com.healthapp.appointment.service` |
| Java classes | PascalCase | `AppointmentService`, `AppointmentController` |
| Java interfaces | PascalCase, no `I` prefix | `AppointmentService` (interface), `AppointmentServiceImpl` (impl) |
| Java methods/vars | camelCase | `createAppointment()` |
| Python modules/files | snake_case | `appointment_consumer.py` |
| Python classes | PascalCase | `AppointmentEvent` |
| Python functions/vars | snake_case | `process_notification()` |
| REST endpoints | kebab-case, plural nouns | `/api/v1/appointments`, `/api/v1/available-slots` |
| DB tables | snake_case, plural | `appointments`, `users`, `appointment_logs` |
| DB columns | snake_case | `created_at`, `user_id` |
| RabbitMQ topics | dot-separated, domain.event | `appointment.created`, `appointment.cancelled` |
| Env vars | UPPER_SNAKE_CASE | `DB_PASSWORD` |
| Frontend components | PascalCase files | `AppointmentCard.tsx` |
| Frontend hooks | camelCase, `use` prefix | `useAppointments.ts` |

---

## 3. API Design Rules

- All endpoints versioned: `/api/v1/...`
- Use proper HTTP verbs/status codes (`201` on create, `204` on delete, `409` on conflict/duplicate booking, `422` on validation failure).
- Every endpoint must have a Swagger/OpenAPI annotation with summary, request/response schema, and example.
- Request validation via `@Valid` + Bean Validation annotations (Java) / Pydantic models (Python) — never manual `if` checks for required fields.
- Pagination required on list endpoints (`page`, `size` query params), default page size 20.
- Standard error response shape across all services:
```json
{
  "timestamp": "2026-06-23T10:00:00Z",
  "status": 409,
  "error": "DUPLICATE_BOOKING",
  "message": "This slot is already booked.",
  "path": "/api/v1/appointments"
}
```

### Required Endpoints (minimum)
| Method | Path | Description |
|---|---|---|
| POST | `/api/v1/auth/register` | Register user |
| POST | `/api/v1/auth/login` | Login, returns JWT |
| POST | `/api/v1/appointments` | Create appointment |
| DELETE | `/api/v1/appointments/{id}` | Cancel appointment |
| GET | `/api/v1/appointments` | Fetch user's appointments (paginated) |
| GET | `/api/v1/slots/available` | Fetch available slots (query by date/doctor) |

---

## 4. Database & Concurrency Rules

- **Migrations only** — no `ddl-auto: update` in any environment beyond local dev experimentation. Use Flyway. Every schema change is a new versioned `.sql` file, never edited after merge.
- **Prevent duplicate booking**: enforce with a DB-level unique constraint (e.g. unique index on `(doctor_id, slot_start_time)` where status != CANCELLED), not just application logic. Application logic is the first line of defense; the constraint is the guarantee.
- **Concurrency**: use optimistic locking (`@Version` field in JPA) on the `Appointment` entity, or `SELECT ... FOR UPDATE` for the slot-booking transaction. Document which one you chose and why in an ADR.
- **Status enums** stored as strings, not ordinals: `PENDING`, `CONFIRMED`, `CANCELLED`, `COMPLETED`.
- **Audit fields** on every table: `created_at`, `updated_at`. `AppointmentLog` table records every state transition (who, when, from-status, to-status).
- All timestamps stored in UTC; conversion to local time happens only at the presentation layer.

---

## 5. Event-Driven Communication Rules

- Canonical event schema documented in `docs/event-contracts.md` before either service implements it. Example:
```json
{
  "eventId": "uuid",
  "eventType": "APPOINTMENT_CREATED",
  "occurredAt": "2026-06-23T10:00:00Z",
  "payload": {
    "appointmentId": "uuid",
    "userId": "uuid",
    "doctorId": "uuid",
    "slotStartTime": "2026-06-25T09:00:00Z"
  }
}
```
- Every event has a unique `eventId` (UUID) — Python consumer must track processed IDs (e.g. in a `processed_events` table) to guarantee **idempotent** processing on redelivery.
- Spring Boot publishes events **after** the DB transaction commits (use `@TransactionalEventListener(phase = AFTER_COMMIT)`), never inside the transaction, to avoid publishing events for rolled-back writes.
- Python consumer wraps processing in try/except; on failure, log + push to a dead-letter topic/queue (`appointment.dlq`) rather than dropping the message or crashing the consumer loop.
- No service calls another service's REST API synchronously for the appointment workflow — only async via broker. Synchronous calls are allowed only for auth/lookup type operations if absolutely needed, and must be documented as an exception in an ADR.

---

## 6. Security Rules

- JWT only, stateless. No server-side sessions.
- Password hashing: BCrypt, min strength 10.
- JWT secret and DB credentials only via environment variables — never hardcoded, never committed (`.env` must be in `.gitignore`; `.env.example` checked in with dummy values).
- Role-based access: `DOCTOR`, and `ADMIN`. Endpoints annotated with `@PreAuthorize`.
- All input sanitized/validated before hitting the DB layer (prevents injection regardless of ORM use).
- CORS explicitly configured (no wildcard `*` in any environment beyond local dev).

---

## 7. Error Handling & Logging

- Java: centralized `@RestControllerAdvice` / `GlobalExceptionHandler` mapping custom exceptions (`DuplicateBookingException`, `SlotNotAvailableException`, `ResourceNotFoundException`) to the standard error response shape.
- Python: centralized exception handler in the consumer loop; never let an unhandled exception kill the consumer process.
- Structured logging (JSON logs preferred) with correlation/trace ID propagated from HTTP request → RabbitMQ event → Python processing, so a single appointment's flow can be traced end-to-end.
- No `print()` statements in Python, no `System.out.println` in Java — use the language's logging framework (`logging` / SLF4J).
- Never log secrets, passwords, or raw JWTs.

---

## 8. Testing Standards

- Minimum coverage expectation: service layer and repository-adjacent logic (duplicate booking prevention, concurrency) must have unit tests.
- Java: JUnit5 + Mockito for unit tests; `@SpringBootTest` or Testcontainers for integration tests against a real Postgres in CI.
- Python: `pytest`, mock the broker client in unit tests; one integration test proving end-to-end event consumption.
- Every bug-prone area (duplicate booking, concurrent slot booking, event idempotency) must have an explicit test case, not just happy-path coverage.

---

## 9. Frontend Standards

- TypeScript required (no plain JS).
- API calls isolated in `src/api/*` — components never call `fetch`/`axios` directly.
- Loading/processing states shown explicitly per the assignment's required UX copy ("Fetching available slots...", "Booking appointment...", etc.) — implement as a shared `<StatusBanner>` or toast component, not ad-hoc per page.
- Form validation client-side mirrors backend validation rules (don't duplicate logic by hand — keep a single source of truth for rules like "slot must be in the future").
- Environment-based API base URL (`.env` → `VITE_API_BASE_URL`), never hardcoded.

---

## 10. Docker & Local Dev Rules

- Each service: standalone multi-stage `Dockerfile` (build stage + slim runtime stage).
- Root `docker-compose.yml` must bring up: Postgres, RabbitMQ, backend, worker, frontend — with healthchecks and proper `depends_on` ordering.
- All inter-service config (DB host, broker host) via environment variables injected by `docker-compose`, matching `.env.example` keys.
- `docker compose up --build` must be sufficient to run the entire system from a clean clone — this is the primary acceptance test for "Dockerized deployment."

---

## 11. Documentation Deliverables (map to assignment requirements)

| Deliverable | Location |
|---|---|
| README with setup instructions | `/README.md` (root) + per-service README for service-specific notes |
| API Docs & Swagger link | Auto-generated via springdoc-openapi; exported snapshot in `docs/api/` |
| Database schema | `docs/db-schema.sql` (generated from Flyway migrations) + ER diagram image |
| Event contracts | `docs/event-contracts.md` |
| Architecture decisions | `docs/adr/ADR-001-...md` per significant decision (e.g. "Why optimistic locking over pessimistic locking") |
| Demo video/screenshots | `docs/demo/` |

---

## 12. Commit & Workflow Rules

- Conventional commits: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`, `chore:`.
- One logical change per commit; do not bundle unrelated service changes.
- Never commit secrets, `.env`, build artifacts, or `node_modules`/`target`/`__pycache__` (root `.gitignore` must cover all three stacks).
- Before considering a feature "done": code compiles/builds, relevant tests pass, Swagger reflects the new endpoint, and the relevant README section is updated.

---

## 13. Definition of Done (per feature)

A feature (e.g. "Create Appointment") is complete only when:
1. Endpoint implemented with DTO validation and Swagger annotation.
2. Business rule enforced at both application and DB level (where applicable, e.g. duplicate booking).
3. Event published (if applicable) matching the documented contract.
4. Python consumer handles the event idempotently and updates status.
5. Frontend screen calls the real API and reflects live status text.
6. Unit test(s) covering the core rule (happy path + at least one failure/edge case).
7. Logged with correlation ID; errors return the standard error shape.