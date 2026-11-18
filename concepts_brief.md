# Authentication module concepts brief

**Author** Mohamed Ayoub  
**Date** 2026-11-18

## Overview

A reviewer should be able to start the stack from a fresh clone with `docker compose up --build`, register, sign in, and see “Welcome to the application.” Refreshing the page should restore an active session. Requesting the protected endpoint from a signed-out browser should return HTTP 401. The review below records the original design. The [implementation plan](./implementation-plan.md) describes the later JWT migration.

The assignment requires TypeScript, a React or Vue frontend, a NestJS API, MongoDB, a protected endpoint, a README, and an `AI.md` describing actual AI use and corrections. The plan selects React, Vite, React Router, Zustand, React Hook Form, shared Zod schemas, independent IP and email rate limits, and a Docker Compose stack. The repository contained the plan alone at review time. The suggestions below are proposals for implementation. [Working plan](implementation-plan.md)

## Analysis

| Priority | Open decision | Recommendation and verification |
| --- | --- | --- |
| Major | Which data survives an API restart? | Keep accounts and unexpired sessions in MongoDB. Use a maintained session adapter and a fixed server-enforced expiry. Check expiry on every protected read, since MongoDB removes expired records asynchronously. Recreate the API with the same volume, then try the original browser cookie and a fresh sign-in. [MongoDB TTL behavior](https://www.mongodb.com/docs/manual/core/index-ttl/#timing-of-the-delete-operation) |
| Major | How does first-run setup stay private? | If the session middleware signs cookies, generate a private key on first local startup, persist it across container recreation and inject a managed secret in a hosted environment. This keeps the local startup command usable without a committed key. Reusing MongoDB adds a lookup per protected request. Signed cookies also require a key lifecycle. |
| Major | What does a reviewer see after registration? | The proposed default returns 204 for both first and duplicate valid sign-ups and directs both users to sign-in with the same neutral message. An explicit duplicate message gives clearer recovery but discloses registration status. Successful sign-in returns 204 and invalid credentials receive the same 401. Show password requirements before submission. |
| Major | When is Compose ready? | Wait for MongoDB, confirm the unique email index on both first and repeat startup, then have the API report ready. Preserve the volume if initialization fails and identify the failed step in the API logs. Give the actual local URL in the README. Verify a direct visit to `/app` and the public `/api/auth/me` path through the web proxy. [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/) |
| Major | Which rate limits apply? | For one API process, use bounded counters with expiry and document that a restart clears them. Track the route’s IP and normalized-email limits independently. A shared network can carry many distinct users, and an email limit can affect its owner, so use a broad IP limit, a short email window and a generic 429 with a retry delay. Choose defaults against these cases. If concurrent password verification strains the API container, measure Argon2id memory and latency before adding a concurrency cap. |
| Major | Who decides what the browser renders? | Let one Zustand action coordinate the initial session lookup and subsequent changes. A 401 leads to sign-in. An unavailable API gives the user a retry action. A delayed lookup must yield to a newer sign-in or logout. A delayed-response check can verify this without extra infrastructure. |
| Minor | Where do rules and diagnostics live? | Infer public request and response types from the shared Zod schemas. NestJS validates incoming data, React Hook Form owns form fields, and browser-only state stays in the web app. If structured logs are selected, include a request ID and the limit that fired. Omit passwords, cookies, session identifiers and raw email addresses. |

The existing MongoDB service can hold revocable sessions. Generating the local signing secret on first startup and keeping it across restarts lets the reviewer use one command without copying a key or losing an active session when the API container is recreated.

## Goals vs. Non-Goals

- **Core flow.** Validate email format, a name of at least three characters, and a password of at least eight characters containing a letter, a number and a special character. Preserve the password exactly. Apply the same public rules at the API. Verify the welcome text and authenticated and anonymous access to the protected endpoint.
- **Delivery.** Document setup and record actual AI-assisted work in `AI.md`. The assignment calls for a public repository and a recruiter link at submission. The delivery estimate is open.
- **Candidate additions.** Logout, a browser session test, enhanced accessible feedback, concurrency and throttling integration tests, basic CI and structured logs still need a scope decision. If logout is selected, verify that the original cookie receives 401 immediately after revocation. Basic form labels and understandable error messages already belong in the proposed pages.
- **Outside this review.** The workspace has no existing accounts, clients or application code to migrate. Multi-instance deployment, implementation and publication are outside this brainstorm.

## Alternatives Weighed

- **In-memory sessions** simplify startup but sign out every browser on API recreation. A Mongo-backed adapter reuses a required service and supports the proposed restart behavior.
- **Shared throttling counters** preserve limits across replicas and can survive restarts. The single-process option keeps the demonstration small and makes its reset behavior explicit. Revisit the store if either persistence or replicas become a deployment requirement.
- **Separate web and API field definitions** allow independent changes but require coordinating every validation edit. Shared public schemas keep the assignment’s field rules consistent while preserving the API’s own validation boundary.

## Key Decisions & Staging for Next Steps

1. Review the proposed registration handoff, session lifetime, counter defaults and candidate additions. For this browser-only API, the proposed request-forgery defense requires the exact configured browser origin on every mutating route, including sign-in and any logout. Require JSON for routes with a payload and allow requests only from the same origin. If selected, logout returns 204 on success.
2. Implement one complete registration and sign-in flow through the public origin. Verify that `/api/auth/me` returns 401 for a signed-out user and 200 with public user fields for a signed-in user. Confirm an expired session also receives 401.
3. On the same MongoDB volume, repeat startup and verify account and session behavior separately. Record the actual URL, commands and results in the README. Add the chosen automated checks and update `AI.md` with concrete examples from implementation.

### Reviewer coverage

All seven reviewers completed independent reads of their assigned persona, standard, the working plan and both assignment pages.

| Reviewer | Main contribution |
| --- | --- |
| Design | Session lifetime, password-hashing capacity and optional-work scope |
| Codebase details | Startup diagnostics, internal throttle reasons and restart expectations |
| Zoom out | Reuse MongoDB and shared schemas, size the limiter for one API |
| Comprehension | Registration handoff, public URL, field errors and retry guidance |
| Implementation readiness | Repeatable index setup and verification with the pre-restart cookie |
| Structural | Ownership of client state and handling of late session responses |
| Inventive catalyst | Private, persistent local signing material and one-command session setup |
