<div align="center">
  <img src="logo/logo.png" alt="Xeno.JS Logo" width="140" />

  <h1>Xeno.JS Redis</h1>
  <p><strong>A Typescript application framework architecture for Node.js, designed for lower technical debt, and faster infrastructure migrations.</strong></p>
  <p>Build long-lived applications with explicit dependency injection, DDD, CQRS, and transport-independent business logic.</p>

  <p>
    <a href="https://www.npmjs.com/package/@xeno-js/redis"><img src="https://img.shields.io/npm/v/@xeno-js/redis?style=flat-square" alt="NPM Version" /></a>
    <a href="https://github.com/xeno-js/redis"><img src="https://img.shields.io/badge/Powered%20by-Xeno-blueviolet?style=flat-square" alt="Powered by Xeno" /></a>
    <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=flat-square" alt="License: MIT" /></a>
    <a href="https://buymeacoffee.com/xenojs">
      <img src="https://img.shields.io/badge/Buy%20Me%20A%20Coffee-Support-FFdd00?style=flat-square&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me A Coffee" />
    </a>
  </p>
</div>

---

---

`@xeno-js/redis` provides Redis caching and atomic operations integration for the Xeno.JS ecosystem. It leverages `ioredis` to manage distributed caching, atomic increments, conditional sets (`setIfAbsent`), and flexible fallback options.

## Installation

```bash
npm install @xeno-js/redis ioredis

```

The package requires `@xeno-js/core` as a peer dependency.

---

## 1. Plugin Configuration and Redis Connection

**Problem.** Distributed enterprise applications require centralized, reliable caching layers with configurable connection endpoints and environment-based toggles (e.g., enabling Redis only in production while using in-memory caching for local testing).

**Principle.** Cache provider configuration must be explicit, declarative, and easily integrated through the application builder plugins.

**Mechanism.** The `withRedis` function exposes a cache plugin that initializes `RedisCacheFactory` with connection parameters (host, port, credentials) and registers the `CacheModule` into the dependency injection container.

**Implementation:**

```ts
import { XenoAppBuilder } from '@xeno-js/core';
import { withRedis } from '@xeno-js/redis';

const app = await new XenoAppBuilder()
  .addCache(
    withRedis((options, config) => {
      options.isEnabled = config.getEnvironment() === 'production';
      options.host = config.get('REDIS_HOST') ?? 'localhost';
      options.port = config.getNumber('REDIS_PORT') ?? 6379;
    })
  )
  .build();

```

**Behavior:** During bootstrap, the plugin checks the `isEnabled` flag. If false, it seamlessly falls back to an in-memory cache provider; otherwise, it configures and starts the Redis cache client.

**Boundary:** The plugin handles cache connection initialization and module registration, delegating low-level operations to the underlying Redis client implementation.

---

## 2. Atomic Caching Operations (`RedisCache`)

**Problem.** Standard key-value caching often lacks thread-safe atomic primitives, leading to race conditions during counter increments or distributed lock acquisitions (`set-if-not-exists`).

**Principle.** Cache operations requiring concurrency control must utilize atomic Redis commands (such as transactions and conditional flags).

**Mechanism:** `RedisCache` implements the `IAtomicCache` interface, wrapping `ioredis` to provide robust methods for JSON serialization, atomic increments with TTL handling, conditional sets (`NX`), and pattern-based key deletions.

**Implementation:**

The cache client is resolved automatically via container tokens or injected into application services:

```ts
import { TOKENS } from '@xeno-js/core';

// Inside a service or handler
const cache = container.resolve(TOKENS.CACHE);
await cache.set('user:101', { name: 'Alice' }, 3600);
const user = await cache.get('user:101');

```

**Behavior:** Methods such as `increment` utilize multi/exec transactions to ensure atomic execution, while `setIfAbsent` leverages Redis native `NX` and `EX` parameters to safely handle distributed locks and idempotent checks.

**Boundary:** `RedisCache` abstracts Redis client interactions into clean domain contracts, keeping caching logic decoupled from business rules.

---

## License

Released under the MIT [License](LICENSE).
