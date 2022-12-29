# RESTful API Cloudflare Workers Boilerplate
A boilerplate/starter project for quickly building RESTful APIs using
[Cloudflare Workers](https://workers.cloudflare.com/), [Hono](https://honojs.dev/), and
[PlanetScale](https://planetscale.com/). Inspired by
[node-express-boilerplate](https://github.com/hagopj13/node-express-boilerplate) by hagopj13.

## Quick Start

To create a project, simply run:

```bash
npx create-cf-planetscale-app <project-name>
```

Or

```bash
npm init create-cf-planetscale-app <project-name>
```

## Table of Contents

- [RESTful API Cloudflare Workers Boilerplate](#restful-api-cloudflare-workers-boilerplate)
  - [Quick Start](#quick-start)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Commands](#commands)
  - [Error Handling](#error-handling)
  - [Validation](#validation)
  - [Authentication](#authentication)
  - [Emails](#emails)
  - [Authorisation](#authorisation)
  - [Contributing](#contributing)
  - [Inspirations](#inspirations)
  - [License](#license)

## Features

- **SQL database**: [PlanetScale](https://planetscale.com/) using
[Kysely](https://github.com/koskimas/kysely) as a type-safe SQl query builder
- **Authentication and authorization**: using JWT
- **Validation**: request data validation using [Zod](https://github.com/colinhacks/zod)
- **Logging**: using [Sentry](https://sentry.io/)
- **Testing**: unit and integration tests using [Jest](https://jestjs.io)
- **Error handling**: centralised error handling mechanism provided by [Hono](https://honojs.dev/)
- **Git hooks**: with [Husky](https://github.com/typicode/husky)
- **Linting**: with [ESLint](https://eslint.org) and [Prettier](https://prettier.io)
- **Emails**: with [Amazon SES](https://aws.amazon.com/ses/)
- **Oauth**: Support for Discord, Github, Spotify, Google and Facebook. Support coming for Apple and
  Twitter.

## Commands

Running locally:

```bash
npm run dev
```

Testing:

```bash
# run all tests
npm run tests

# run test coverage
npm run tests:coverage

# run test coverage summary
npm run tests:summary
```

Linting:

```bash
# run ESLint
npm run lint

# fix ESLint errors
npm run lint:fix

# run prettier
npm run prettier

# fix prettier errors
npm run prettier:fix
```

Migrations:

```bash
# run all migrations for dev/test/prod
npm run migrate:dev:latest
npm run migrate:test:latest
npm run migrate:prod:latest

# remove all migrations for dev/test/prod
npm run migrate:dev:none
npm run migrate:test:none
npm run migrate:prod:none

# revert last migration for dev/test/prod
npm run migrate:dev:down
npm run migrate:test:down
npm run migrate:prod:down
```

Deploy to Cloudflare:

```bash
npm run deploy
```

## Error Handling

The app has a centralized error handling mechanism provided by [Hono](https://honojs.dev/).

```javascript
app.onError(errorHandler)
```

All errors will be caught by the errorHandler which converts the error to an ApiError and formats
it in a JSON response. Any errors that aren't intentionally thrown, e.g. 500 errors, are logged to
Sentry.

The error handling middleware sends an error response, which has the following format:

```json
{
  "code": 404,
  "message": "Not found"
}
```

When running in development mode, the error response also contains the error stack.

## Validation

Request data is validated using [Zod](https://github.com/colinhacks/zod).

The validation schemas are defined in the `src/validations` directory and are used in the
controllers by getting either the query or body and then calling the parse on the relevant
validation function:


```javascript
const getUsers: Handler<{ Bindings: Bindings }> = async (c) => {
  const config = getConfig(c.env)
  const queryParse = c.req.query()
  const query = userValidation.getUsers.parse(queryParse)
  const filter = { email: query.email }
  const options = { sortBy: query.sort_by, limit: query.limit, page: query.page }
  const result = await userService.queryUsers(filter, options, config.database)
  return c.json(result, httpStatus.OK as StatusCode)
}
```

## Authentication

To require authentication for certain routes, you can use the `auth` middleware.

```javascript
import { Hono } from 'hono'
import * as userController from '../controllers/user.controller'
import { auth } from '../middlewares/auth'

const route = new Hono<{ Bindings: Bindings }>()

route.post('/', auth(), userController.createUser)

export { route }

```

These routes require a valid JWT access token in the Authorization request header using the Bearer
schema. If the request does not contain a valid access token, an Unauthorized (401) error is thrown.

## Emails

Support for Email sending using [Amazon SES](https://aws.amazon.com/ses/). Just call the `sendEmail`
function in `src/services/email.service.ts`:

```javascript
const sendResetPasswordEmail = async (email: string, emailData: EmailData, config: Config) => {
  const message = {
    Subject: {
      Data: 'Reset your password',
      Charset: 'UTF-8'
    },
    Body: {
      Text: {
        Charset: 'UTF-8',
        Data: `
          Hello ${emailData.name}
          Please reset your password by clicking the following link:
          ${emailData.token}
        `
      }
    }
  }
  await sendEmail(email, config.email.sender, message, config.aws)
}
```

## Authorisation

The `auth` middleware can also be used to require certain rights/permissions to access a route.

```javascript
import { Hono } from 'hono'
import * as userController from '../controllers/user.controller'
import { auth } from '../middlewares/auth'

const route = new Hono<{ Bindings: Bindings }>()

route.post('/', auth('manageUsers'), userController.createUser)

export { route }
```

In the example above, an authenticated user can access this route only if that user has the
`manageUsers` permission.

The permissions are role-based. You can view the permissions/rights of each role in the
`src/config/roles.ts` file.

If the user making the request does not have the required permissions to access this route, a
Forbidden (403) error is thrown.

## Contributing

Contributions are more than welcome!

## Inspirations

- [hagopj13/node-express-boilerplate](https://github.com/hagopj13/node-express-boilerplate)

## License

[MIT](LICENSE)
