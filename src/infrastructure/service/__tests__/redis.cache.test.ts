import type { Redis } from 'ioredis'
import { describe, expect, it, vi } from 'vitest'

import { RedisCache } from '../redis.cache'

function makeDeps() {
  const getMock = vi.fn()
  const setMock = vi.fn()
  const delMock = vi.fn()
  const existsMock = vi.fn()
  const flushdbMock = vi.fn()
  const expireMock = vi.fn()
  const incrMock = vi.fn(function (this: { exec: unknown }) {
    return this
  })
  const execMock = vi.fn()
  const multiMock = {
    incr: incrMock,
    exec: execMock,
  }
  const multiFactoryMock = vi.fn().mockReturnValue(multiMock)

  const redisClient = {
    get: getMock,
    set: setMock,
    del: delMock,
    exists: existsMock,
    flushdb: flushdbMock,
    expire: expireMock,
    multi: multiFactoryMock,
  } as unknown as Redis

  return {
    redisClient,
    mocks: {
      getMock,
      setMock,
      delMock,
      existsMock,
      flushdbMock,
      expireMock,
      incrMock,
      execMock,
      multiFactoryMock,
    },
  }
}

describe('RedisCache', () => {
  it('get returns undefined when redis value is null', async () => {
    const { redisClient, mocks } = makeDeps()
    mocks.getMock.mockResolvedValue(null)

    const cache = new RedisCache(redisClient)

    await expect(cache.get('missing')).resolves.toBeUndefined()
    expect(mocks.getMock).toHaveBeenCalledWith('missing')
  })

  it('get parses and returns stored json value', async () => {
    const { redisClient, mocks } = makeDeps()
    const value = { user: 'alice', roles: ['admin'] }
    mocks.getMock.mockResolvedValue(JSON.stringify(value))

    const cache = new RedisCache(redisClient)

    await expect(cache.get<typeof value>('k1')).resolves.toEqual(value)
  })

  it('get propagates parse error for invalid json', async () => {
    const { redisClient, mocks } = makeDeps()
    mocks.getMock.mockResolvedValue('{invalid-json}')

    const cache = new RedisCache(redisClient)

    await expect(cache.get('k1')).rejects.toBeInstanceOf(SyntaxError)
  })

  it('increment uses a transactional multi command and returns the atomic result', async () => {
    const { redisClient, mocks } = makeDeps()
    mocks.execMock.mockResolvedValue([
      [null, 3],
      [null, true],
    ])

    const cache = new RedisCache(redisClient)
    const result = await cache.increment('counter', 90)

    expect(result).toBe(3)
    expect(mocks.multiFactoryMock).toHaveBeenCalledOnce()
    expect(mocks.incrMock).toHaveBeenCalledWith('counter')
    expect(mocks.expireMock).not.toHaveBeenCalled()
    expect(mocks.execMock).toHaveBeenCalledOnce()
  })

  it('increment falls back to 1 when the transaction result is unavailable', async () => {
    const { redisClient, mocks } = makeDeps()
    mocks.execMock.mockResolvedValue(undefined)

    const cache = new RedisCache(redisClient)

    await expect(cache.increment('counter', undefined)).resolves.toBe(1)
    expect(mocks.expireMock).toHaveBeenCalledWith('counter', 60)
  })

  it('increment keeps concurrent calls in independent transactions without leaking state', async () => {
    const { redisClient, mocks } = makeDeps()
    mocks.execMock
      .mockResolvedValueOnce([
        [null, 1],
        [null, true],
      ])
      .mockResolvedValueOnce([
        [null, 2],
        [null, true],
      ])

    const cache = new RedisCache(redisClient)
    const [first, second] = await Promise.all([
      cache.increment('counter', 5),
      cache.increment('counter', 5),
    ])

    expect(first).toBe(1)
    expect(second).toBe(2)
    expect(mocks.multiFactoryMock).toHaveBeenCalledTimes(2)
    expect(mocks.incrMock).toHaveBeenCalledTimes(2)
    expect(mocks.expireMock).toHaveBeenCalledTimes(1)
  })

  it('set stores stringified value with provided ttl', async () => {
    const { redisClient, mocks } = makeDeps()
    const payload = { id: '1' }

    const cache = new RedisCache(redisClient)
    await cache.set('key', payload, 42)

    expect(mocks.setMock).toHaveBeenCalledWith('key', JSON.stringify(payload), 'EX', 42)
  })

  it('set uses default ttl when ttl is undefined', async () => {
    const { redisClient, mocks } = makeDeps()

    const cache = new RedisCache(redisClient)
    await cache.set('key', { id: '1' }, undefined)

    expect(mocks.setMock).toHaveBeenCalledWith('key', JSON.stringify({ id: '1' }), 'EX', 86400)
  })

  it('setIfAbsent returns true when redis replies OK and uses provided ttl', async () => {
    const { redisClient, mocks } = makeDeps()
    mocks.setMock.mockResolvedValue('OK')

    const cache = new RedisCache(redisClient)

    await expect(cache.setIfAbsent('lock', { lock: true }, 20)).resolves.toBe(true)
    expect(mocks.setMock).toHaveBeenCalledWith(
      'lock',
      JSON.stringify({ lock: true }),
      'EX',
      20,
      'NX',
    )
  })

  it('setIfAbsent returns false when redis does not reply OK and uses default ttl', async () => {
    const { redisClient, mocks } = makeDeps()
    mocks.setMock.mockResolvedValue(null)

    const cache = new RedisCache(redisClient)

    await expect(cache.setIfAbsent('lock', { lock: true }, undefined)).resolves.toBe(false)
    expect(mocks.setMock).toHaveBeenCalledWith(
      'lock',
      JSON.stringify({ lock: true }),
      'EX',
      300,
      'NX',
    )
  })

  it('remove calls redis del', async () => {
    const { redisClient, mocks } = makeDeps()

    const cache = new RedisCache(redisClient)
    await cache.remove('k1')

    expect(mocks.delMock).toHaveBeenCalledWith('k1')
  })

  it('has returns true only when redis exists returns 1', async () => {
    const { redisClient, mocks } = makeDeps()
    const cache = new RedisCache(redisClient)

    mocks.existsMock.mockResolvedValueOnce(1)
    await expect(cache.has('k1')).resolves.toBe(true)

    mocks.existsMock.mockResolvedValueOnce(0)
    await expect(cache.has('k2')).resolves.toBe(false)
  })

  it('clear calls redis flushdb', async () => {
    const { redisClient, mocks } = makeDeps()

    const cache = new RedisCache(redisClient)
    await cache.clear()

    expect(mocks.flushdbMock).toHaveBeenCalledTimes(1)
  })
})
