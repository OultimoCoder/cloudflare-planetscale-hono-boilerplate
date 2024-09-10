import httpStatus from 'http-status'
import { test, describe, expect } from 'vitest'
import { request } from '../utils/test-request'

describe('Basic routing', () => {
  test('should return 404 if route not found', async () => {
    const res = await request('/idontexist', {
      method: 'GET'
    })
    expect(res.status).toBe(httpStatus.NOT_FOUND)
  })
})
