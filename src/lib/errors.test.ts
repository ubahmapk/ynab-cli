import { describe, it, expect } from 'vitest';
import { sanitizeErrorMessage, sanitizeApiError } from './errors.js';

describe('sanitizeErrorMessage', () => {
  it.each([
    {
      pattern: 'Bearer tokens',
      input: 'Authorization: Bearer abc123token456',
      shouldNotContain: 'abc123token456',
    },
    {
      pattern: 'token key-value pairs',
      input: 'Error: token=my-secret-token-value',
      shouldNotContain: 'my-secret-token-value',
    },
    {
      pattern: 'API keys',
      input: 'Failed: api_key=super-secret-key',
      shouldNotContain: 'super-secret-key',
    },
    {
      pattern: 'access_token value',
      input: 'Error: access_token=supersecret',
      shouldNotContain: 'supersecret',
    },
    {
      pattern: 'access_token key-value entirely',
      input: 'Error: access_token=supersecret',
      shouldNotContain: 'access_token=',
    },
    {
      pattern: 'secret key-value pairs',
      input: 'Failed: secret=my-secret-value',
      shouldNotContain: 'my-secret-value',
    },
    {
      pattern: 'token as JSON string value',
      input: '{"access_token": "supersecret"}',
      shouldNotContain: 'supersecret',
    },
  ])('should redact $pattern', ({ input, shouldNotContain }) => {
    const result = sanitizeErrorMessage(input);
    expect(result).not.toContain(shouldNotContain);
    expect(result).toContain('[REDACTED]');
  });

  it('should handle multiple sensitive patterns in one message', () => {
    const message = 'Auth failed: Bearer token123 with api_key=secret';
    const result = sanitizeErrorMessage(message);
    expect(result).not.toContain('token123');
    expect(result).not.toContain('secret');
  });

  it('should truncate long messages', () => {
    const longMessage = 'Error: ' + 'x'.repeat(600);
    const result = sanitizeErrorMessage(longMessage);
    expect(result.length).toBe(503);
    expect(result.endsWith('...')).toBe(true);
  });

  it('should not modify safe messages', () => {
    const message = 'Transaction not found';
    const result = sanitizeErrorMessage(message);
    expect(result).toBe(message);
  });
});

describe('sanitizeApiError', () => {
  it('should sanitize error detail', () => {
    const error = {
      name: 'unauthorized',
      detail: 'Invalid token: Bearer abc123',
    };
    const result = sanitizeApiError(error);
    expect(result.name).toBe('unauthorized');
    expect(result.detail).not.toContain('abc123');
    expect(result.detail).toContain('[REDACTED]');
  });

  it('should handle errors with message field', () => {
    const error = {
      message: 'Failed with api_key=secret123',
    };
    const result = sanitizeApiError(error);
    expect(result.name).toBe('api_error');
    expect(result.detail).not.toContain('secret123');
  });

  it('should handle minimal error objects', () => {
    const error = {};
    const result = sanitizeApiError(error);
    expect(result.name).toBe('api_error');
    expect(result.detail).toBe('An error occurred');
  });

  it('should preserve error id if present', () => {
    const error = {
      id: 'err-12345',
      name: 'bad_request',
      detail: 'Invalid input',
    };
    const result = sanitizeApiError(error);
    expect(result.id).toBe('err-12345');
  });
});
