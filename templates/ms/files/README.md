# {{projectName}}

{{description}}

This microservice was generated using `scl-cli`. It is built on top of [Bun](https://bun.sh) and [Hono](https://hono.dev).

## Getting Started

### Prerequisites

You need [Bun](https://bun.sh) installed.

### Development

To start the development server with hot-reloading:

```bash
bun dev
```

The server will be running on [http://localhost:{{port}}](http://localhost:{{port}}).

### Production

To run in production:

```bash
bun start
```

## API Routes

- `GET /` - Root endpoint (welcome message)
- `GET /health` - Liveness/readiness probe
