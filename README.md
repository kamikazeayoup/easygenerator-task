# Easygenerator authentication

- **Frontend** ([apps/web](./apps/web)) — A React app where users can register, sign in, and open their protected account page.
- **Backend** ([apps/api](./apps/api)) — A NestJS API that stores accounts in MongoDB through TypeORM. It uses JWTs in HttpOnly cookies and revokes the login on sign-out.

## Run with Docker

With Docker running, start both apps and MongoDB from the repository root.

```sh
docker compose up --build
```

Open [localhost:8080](http://localhost:8080), create an account, and sign in. Run `docker compose down` to stop the stack and keep your data.

## Run without Docker

Use Node.js 24.22.2, npm 11.19.1, and MongoDB 7.0 running on `127.0.0.1:27017`. From the repository root, install dependencies and start the API.

```sh
npm install
npm run build -w @easygenerator/api
export JWT_SECRET="$(openssl rand -hex 32)"
ALLOW_INSECURE_HTTP=true PUBLIC_ORIGIN=http://localhost:5173 npm start
```

In a second terminal, run `npm run dev` from the root and open [localhost:5173](http://localhost:5173). Vite forwards API requests to port 3000.

## API endpoints

| Endpoint | What it does |
| --- | --- |
| `POST /api/auth/sign-up` | Accepts `name`, `email`, and `password`. Returns `204` when the account is created or `409` with an email field error when the address is already registered. |
| `POST /api/auth/sign-in` | Accepts `email` and `password`. Sets the auth cookies on success (`204`). |
| `GET /api/auth/me` | Returns the signed-in user's `id`, `name`, and `email`, or `401` when signed out. |
| `POST /api/auth/refresh` | Uses the refresh cookie to renew both tokens (`204`). |
| `POST /api/auth/logout` | Revokes the login and clears both cookies (`204`). |
| `GET /api/health/ready` | Returns `200` when the API and database are ready. |

For manual POST requests, set the `Origin` header to the frontend URL. Use `Content-Type: application/json` when sending a body.

## Tests

After `npm install`, run `npm test`. To include the MongoDB integration tests, run `TEST_MONGODB_URI=mongodb://127.0.0.1:27017 npm test` with MongoDB running locally.

GitHub Actions runs the unit and integration tests on pull requests and pushes to `main`. [Test workflow](./.github/workflows/tests.yml)
