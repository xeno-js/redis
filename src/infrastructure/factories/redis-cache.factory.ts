import type { IAtomicCache, IFactory } from '@xeno-js/core';
import { Guards } from '@xeno-js/core'
import type { RedisOptions } from 'ioredis'
import { Redis } from 'ioredis'

import { RedisCache } from '../service/redis.cache'

export interface RedisConfig {
  /** Redis server port */
  port: number; 
  /** Redis server host */
  host: string; 
  /** Redis Options */
  options: RedisOptions
}

/**
 * @description Factory class responsible for creating instances of RedisCache based on the provided configuration. It implements the IFactory interface, allowing for easy integration with dependency injection systems. The factory encapsulates the creation logic for the RedisCache, including the initialization of the underlying Redis instance with the specified configuration options such as host, port, and authentication settings. This design promotes separation of concerns and allows for flexibility in managing RedisCache instances across the application.
   * 
   * @author Xeno
   * @version 1.0.0
   * @since 2025-09-30
   * @link https://github.com/xeno-js/xeno-js 
   */
export class RedisCacheFactory implements IFactory<RedisConfig, IAtomicCache> {
  public create(config: RedisConfig): IAtomicCache {
    if (Guards.isNullOrEmpty(config.port) || Guards.isNullOrEmpty(config.host))
      throw new Error('Please provide a valid port and host for redis')

    if(Guards.isNullOrEmpty(config.options.password) || Guards.isNullOrEmpty(config.options.username))
      throw new Error('Please provide a valid username and password for redis')

    const nativeRedisInstance = new Redis(config)
    return new RedisCache(nativeRedisInstance)
  }
}
