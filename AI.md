# How I used AI on this project

I started with Google's Elephant-Goldfish Model (EGM). I gave Codex the assignment requirements, my project plan, and the architecture I wanted it to implement. React would handle the browser flow, NestJS would expose the auth API, and TypeORM would manage user accounts in MongoDB. I also specified that a reviewer should be able to start the application with one Docker Compose command. [Elephant-Goldfish Model](https://github.com/google/elephant-goldfish-model)

Codex helped me review and document that plan. For example, the design review raised the question of what to show after a duplicate registration. I chose the same sign-in prompt for new and existing accounts to avoid disclosing whether an email was registered. Codex captured the design and review findings in the concepts brief and used the brief to draft the implementation plan. I reviewed both documents and asked for revisions where the wording or proposed behavior differed from what I intended. [Concepts brief](./concepts_brief.md) · [Implementation plan](./implementation-plan.md)

## What Codex implemented

I split implementation into four phases. Codex wrote the code for each phase. I compared it with the plan, requested specific changes, and reviewed the revised implementation.

1. **Backend.** Codex scaffolded the npm workspaces and NestJS modules, then implemented registration, password hashing, request validation, rate limiting, and the protected account endpoint.
2. **Authentication changes.** During review, we chose to migrate from Express sessions to JWTs. I wanted the project to use a widely adopted access and refresh token pattern that other engineers would recognize. Codex implemented token issuance and rotation in the API and automatic renewal in the browser.
3. **Frontend.** Codex built the React forms, validation messages, and protected account screen. It connected them to the API with a Zustand store. The auth screen artwork was also AI-generated. After reviewing the initial design, I supplied Easygenerator's site as a reference and asked for its wordmark and color palette.
4. **Tests and handoff.** Codex wrote validation and MongoDB integration tests, configured Docker Compose and Nginx, and documented the startup and manual API checks in the [README](./README.md).

## Prompts that worked well

- **Give the plan and scope the first change.** I pointed Codex to the implementation plan and asked it to “start for now with the backend only”. That let me review the endpoint responses and request validation before the React forms depended on them.
- **Describe behavior that can be tested.** For the JWT migration, I specified five-minute access tokens, an eight-hour deadline measured from sign-in, and immediate logout. Those constraints gave us concrete review cases. Refreshing near the deadline must not extend the login, and a cookie saved before logout must receive a 401 if used afterward.

## What I changed during review

- **Account persistence.** I had specified TypeORM, but Codex's first version accessed the users collection directly through the native MongoDB driver. I caught the mismatch when I reviewed the account repository and asked Codex to map the existing documents to a TypeORM entity. In the revised code, registration and account lookups go through TypeORM's `MongoRepository<User>`. [User entity](./apps/api/src/auth/entities/user.entity.ts) · [Account repository](./apps/api/src/auth/repositories/users.repository.ts)
- **Validation ownership.** The first implementation followed the brief's suggestion to share Zod schemas across the API and browser. I asked Codex to remove the shared package and put the API rules on NestJS request DTOs using standard decorators. That removed a workspace dependency, with the trade-off that edits to field rules now need review in both apps. For example, both layers must trim and lowercase email addresses while preserving passwords exactly as typed. [API DTOs](./apps/api/src/auth/dto/auth.dto.ts) · [Browser schemas](./apps/web/src/auth/auth-schemas.ts) · [Validation tests](./apps/api/test/auth-input.test.mjs)
- **Logout semantics.** When I chose JWTs, I kept immediate revocation from the original session design. I accepted a MongoDB lookup on each protected request so deleting the active login invalidates even a copied access token with time left on it. The integration test exercises both credentials after logout and expects 401 from both the account and refresh endpoints. [Integration tests](./apps/api/test/auth.integration.test.mjs)

## Continuous integration

I asked Codex to build a basic CI workflow whose only job was to run the project's tests. Codex set up GitHub Actions to start MongoDB and run `npm test`, and I reviewed the finished workflow.
