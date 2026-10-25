import type { IAtomicCache, Optional } from '@xeno-js/core'
import { Guards, StringHelper } from '@xeno-js/core'
import type { Redis } from 'ioredis'

/**
 * @description The RedisCache class provides an implementation of the ICache interface using Redis as the underlying caching mechanism. This class allows for storing, retrieving, and managing cached values in a Redis database, supporting features such as time-to-live (TTL) for cache entries and atomic operations for setting values only if they do not already exist. The RedisCache class abstracts away the details of interacting with Redis, providing a simple and consistent interface for caching operations within the application.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export class RedisCache implements IAtomicCache {
  /**
   * @description Constructs a new instance of the RedisCache class, which takes an instance of the Redis client as a parameter. This client is used to perform caching operations such as setting, getting, and removing values from the Redis database. The constructor initializes the RedisCache with the provided Redis client, allowing it to interact with the Redis server for all caching operations defined in the ICache interface.
   * @param _redisClient An instance of the Redis client from the ioredis library, used to perform caching operations in the Redis database.
   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
  constructor(private readonly _redisClient: Redis) {}

  public async increment(key: string, ttlSeconds: Optional<number | string>): Promise<number> {
    const results = await this._redisClient.multi().incr(key).exec();
    const newValue = (results?.[0]?.[1] as number) ?? 1;

    if (newValue === 1) {
      const ttl = !Guards.isNullOrEmpty(ttlSeconds) ? Number(ttlSeconds) : 60;
      await this._redisClient.expire(key, ttl);
    }

    return newValue;
  }

  public async get<T>(key: string): Promise<Optional<T>> {
    const value: string | null = await this._redisClient.get(key)
    if (!Guards.isDefined(value)) {
      return undefined
    }
    return JSON.parse(value) as T
  }

  public async set<T>(key: string, value: T, ttl: Optional<number>): Promise<void> {
    const stringValue = StringHelper.safeStringify(value)
    const ttlOption = Guards.isDefined(ttl) ? ttl : 86400 

    await this._redisClient.set(key, stringValue, 'EX', ttlOption)
  }

  public async setIfAbsent<T>(key: string, value: T, ttl: Optional<number>): Promise<boolean> {
    const stringValue = StringHelper.safeStringify(value)
    const ttlOption = Guards.isDefined(ttl) ? ttl : 300 
    const result = await this._redisClient.set(key, stringValue, 'EX', ttlOption, 'NX')
    return result === 'OK'
  }

  public async remove(key: string): Promise<void> {
    await this._redisClient.del(key)
  }

  public async has(key: string): Promise<boolean> {
    const exists = await this._redisClient.exists(key)
    return exists === 1
  }

  public async clear(): Promise<void> {
    await this._redisClient.flushdb()
  }

  public async removePattern(pattern: string): Promise<void> {
    const keys = await this._redisClient.keys(pattern)
    if (Guards.isDefined(keys) && keys.length > 0) {
      await this._redisClient.del(...keys)
    }
  }
}
