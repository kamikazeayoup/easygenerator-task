# Authentication module implementation plan

Reviewed on 2026-11-18. The [concepts brief](./concepts_brief.md) records the design review. This plan describes work to implement and verify.

## Scope and proposed defaults

The agreed stack is a TypeScript monorepo, a Vite/React frontend with React Router, Zustand and Zod, a NestJS API, and MongoDB with TypeORM for accounts. Docker Compose must start the app from a fresh clone in one command. Sign-up and sign-in have independent IP and email limits. Delivery speed is not a planning constraint.

The supported Compose topology is one web proxy, one API process, and one MongoDB instance. Browser authentication uses JWT access and refresh tokens with immediate server-side logout.

## 1. Establish the workspace and contracts

- Put React in `apps/web` and NestJS in `apps/api`. Keep request validation, database models, and secrets in the API. Keep browser form and public-user schemas in the frontend.
- Select the latest compatible stable packages at setup, verify Node support, pin the runtime and package manager, and commit the lockfile. Run advisory checks against the resolved versions and document any outstanding findings.
- Treat email addresses as case-insensitive account identifiers for this app. Trim and lowercase consistently for sign-up, lookup, and throttling. Preserve dots and plus suffixes. Validate email format, trim the name before its three-character minimum, and preserve the password exactly as entered.
- Sign-up requires at least eight password characters including a letter, a number, and a special character. Define the backend character classes in one place and cover their boundaries with tests. Sign-in only requires a valid email and a nonempty password. Bound input lengths and the request body before hashing. Apply the NestJS validation pipe to every sign-up and sign-in request.

## 2. Register users and authenticate requests

Use an auth controller for HTTP requests and responses, an auth service for registration and credential verification, and a users repository for MongoDB queries and duplicate-key handling. Keep schema validation in a NestJS pipe. Verify the JWT and its active login in a guard before looking up the account. Keep rate-limit logic close to the auth module. Add small helpers when they own a concrete rule shared by callers.

Create the unique normalized-email index before the API reports ready. Hash passwords with Argon2id. On sign-in, perform a password verification of comparable cost for unknown users and use the same invalid-credentials response as for incorrect passwords. [MongoDB unique indexes](https://www.mongodb.com/docs/manual/core/index-unique/) · [OWASP authentication guidance](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)

| Browser endpoint | Outcome |
| --- | --- |
| `POST /api/auth/sign-up` | A valid submission returns 204 and the UI opens sign-in. An existing normalized email gets the same response and its stored credentials stay intact. Invalid fields return 400 with field errors. |
| `POST /api/auth/sign-in` | Valid credentials create a login and return 204 with the access and refresh cookies. Invalid credentials return 401. Invalid fields return 400. |
| `GET /api/auth/me` | Returns 200 with the public user ID, name, and email. Missing, expired, or revoked access tokens return 401. Send `Cache-Control: no-store`. |
| `POST /api/auth/refresh` | A valid refresh token is consumed once and replaced alongside the new access token. Success returns 204 and unusable tokens return 401. |
| `POST /api/auth/logout` | Revokes the login, clears both cookies, and returns 204. Repeated logout also returns 204. |

On mutating routes, require the browser's Origin to match the configured public origin, reject missing or mismatched origins with 403, and enable no cross-origin access. Require a JSON content type for requests carrying a payload. Document the required Origin for manual API checks. [OWASP CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)

## 3. Set token and rate-limit lifetimes

**Tokens.** Sign short-lived access JWTs and rotating refresh JWTs with `jose`. Create an eight-hour deadline at sign-in and limit each access token to five minutes or the remaining login lifetime. Store the active login ID, user ID, current refresh token ID, and expiry in MongoDB. Verify the JWT and active login on each protected request. Use a conditional update to consume a refresh token once. Logout deletes the login so both credentials stop working immediately. MongoDB TTL cleanup removes expired records. Use host-only `HttpOnly` cookies with `SameSite=Lax` and `Secure` over HTTPS. A stable signing key preserves logins across API restarts. [JWT best practices](https://www.rfc-editor.org/rfc/rfc8725.html) · [MongoDB TTL behavior](https://www.mongodb.com/docs/manual/core/index-ttl/)

**Limits.** Use a separate counter for each route and identifier. For example, a sign-in for one email from two IPs draws on the same email budget and two different IP budgets. Proposed starting values are configurable and should be tested against a shared-office IP.

| Route | IP budget | Normalized-email budget |
| --- | --- | --- |
| Sign-in | 60 requests per 5 minutes | 5 failed attempts per 5 minutes |
| Sign-up | 20 requests per 15 minutes | 5 valid submissions per 15 minutes |

Check the IP before expensive work. On sign-in, reserve email capacity before asynchronous password verification and release that request's reservation on success. Count failures equally for known and unknown users. Bound and expire counters in the single API process. Return a generic 429 when either budget is exhausted, with a Retry-After value in seconds covering the applicable limits. Rejected retries do not extend the window. Take the client IP only from the configured proxy, which overwrites client-supplied forwarding headers. [NestJS rate limiting](https://docs.nestjs.com/security/rate-limiting) · [OWASP login throttling](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#login-throttling)

| After recreating the Compose API container | Expected result |
| --- | --- |
| User records | Persist in the MongoDB volume. Existing users can sign in. |
| Active logins | Remain valid with the same MongoDB volume and JWT signing key until the eight-hour deadline. |
| Rate-limit counters | Reset with the single API process. Introduce a shared counter store before running multiple API processes or requiring restart-persistent throttling. |

## 4. Build the browser flow

- Use React Hook Form with frontend schemas that follow the API field rules. Provide labels, password-manager autocomplete, keyboard-accessible error feedback, and a retry message for 429s. Keep passwords confined to the form and request.
- Use a Zustand store for the public user and the current authentication status. Keep both credentials in HttpOnly cookies.
- Implement `/sign-up`, `/sign-in`, and `/app`. After a valid sign-up submission, show a neutral prompt to sign in. At startup, after sign-in, and at access-token expiry, load `/api/auth/me`. On 401, try one token refresh and repeat the lookup. If refresh also returns 401, show sign-in. A network error offers retry. Finish an in-flight refresh before signing out.

## 5. Make one-command startup verifiable

- From a fresh clone, `docker compose up --build` serves one documented local URL, proposed as `http://localhost:8080`. Publish only the web port. Serve the Vite build, forward the `/api/` prefix consistently to NestJS, and fall back to the React entry point for browser routes. API errors must keep their API status and body.
- Generate a random local signing secret once into a private named volume on first startup. Reuse it on container recreation. Production requires an externally supplied secret and HTTPS.
- Wait for MongoDB health, ensure required indexes exist, then report API readiness. Check a direct refresh of `/app` and a protected API request through the published web port. [Docker Compose startup order](https://docs.docker.com/compose/how-tos/startup-order/)

## 6. Verify and submit

| Check | Acceptance condition |
| --- | --- |
| Registration | Invalid fields fail in the browser and the API. Two concurrent valid sign-ups for the same normalized email leave one account. A duplicate registration cannot replace its password. |
| Protected flow | Signed-out access returns 401 via the proxy. Sign up, sign in, see the exact welcome text, renew access, then log out and confirm both tokens are rejected. Check access expiry and the eight-hour deadline. |
| Throttling | Cover one IP with many emails, one email across IPs, concurrent attempts, known and unknown emails, 429 retry times, and recovery after expiry. |
| Browser request security | Same-origin submissions work, cross-origin mutations are rejected, and logs and response bodies exclude credentials and token identifiers. |
| Fresh clone and restart | Verify one-command startup, public URL, API routing, and the three restart expectations above. |
| Handoff | Write setup, configuration, API examples, limitations, and verification commands in README.md. Record actual prompts, AI-assisted work, and corrections in AI.md. The assignment calls for publishing the finished repository and sharing its link with the recruiter at submission. |

Record structured logs for completed sign-in and sign-up requests using only the action, HTTP status, and outcome in the event payload. Keep credentials and request identifiers out of the payload. Basic CI remains proposed. Use a frozen install, type-check, test, build, and check dependencies.
