import type {
  CachePlugin,
  IConfigurationService,
  SetupAction,
  XenoRegistry,
} from '@xeno-js/core'
import { CacheModule, definePlugin } from '@xeno-js/core'

import { RedisCacheFactory, type RedisConfig } from './factories/redis-cache.factory'

interface ExtendedRedisConfig extends RedisConfig {
  /** 
   * Rather to enable Redis cache. If false, the in-memory cache is added.
   * Eg.
   * .addCache(withRedis((opts, config) => opts.isEnabled = config.getEnvironment() === 'development'))
   * This, it will add redis only in production
   */
  isEnabled: boolean
}

/**
 * @description Plugin for integrating Redis caching into an application. This plugin provides a convenient way to set up Redis caching with the specified configuration options. It leverages the RedisCacheFactory to create instances of RedisCache based on the provided configuration. The plugin also registers the RedisCacheFactory as a service in the application's dependency injection container.
 *
 * @author Xeno
 * @version 1.0.0
 * @since 2025-09-30
 * @link https://github.com/xeno-js/xeno-js
 */
export const withRedis = <TRegistry extends XenoRegistry = XenoRegistry>(
  setupAction: SetupAction<ExtendedRedisConfig, IConfigurationService>
): CachePlugin<TRegistry> => {
  return definePlugin('cache', (builder, config) => {
    const options: ExtendedRedisConfig = {
      isEnabled: true,
      port: config.getNumber('REDIS_PORT') ?? 6379,
      host: config.get('REDIS_HOST') ?? 'localhost',
      options: {
        username: config.get('REDIS_USERNAME'),
        password: config.get('REDIS_PASSWORD')
      }
    }
    setupAction(options, config)

    if (!options.isEnabled) {
      builder.addModule('CacheModule', async () => new CacheModule<TRegistry>(), { inMemory: true }, 2)
    } else {
      builder.addModule('CacheModule', async () => new CacheModule<TRegistry>(), { inMemory: false, provider: () => new RedisCacheFactory().create(options) }, 2)
    }
  })
}
