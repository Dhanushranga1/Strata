import { sanitizeRedirect } from '@/lib/sanitize-redirect';

describe('sanitizeRedirect', () => {
  it('passes through a plain relative path', () => {
    expect(sanitizeRedirect('/dashboard')).toBe('/dashboard');
    expect(sanitizeRedirect('/tickets/123?tab=notes')).toBe(
      '/tickets/123?tab=notes'
    );
  });

  it('falls back for null/undefined/empty input', () => {
    expect(sanitizeRedirect(null)).toBe('/dashboard');
    expect(sanitizeRedirect(undefined)).toBe('/dashboard');
    expect(sanitizeRedirect('')).toBe('/dashboard');
  });

  it('respects a custom fallback', () => {
    expect(sanitizeRedirect(null, '/login')).toBe('/login');
    expect(sanitizeRedirect('https://evil.com', '/login')).toBe('/login');
  });

  it('rejects absolute URLs', () => {
    expect(sanitizeRedirect('https://evil.com')).toBe('/dashboard');
    expect(sanitizeRedirect('http://evil.com/path')).toBe('/dashboard');
  });

  it('rejects paths not starting with a slash', () => {
    expect(sanitizeRedirect('evil.com')).toBe('/dashboard');
    expect(sanitizeRedirect('dashboard')).toBe('/dashboard');
  });

  it('rejects protocol-relative URLs', () => {
    expect(sanitizeRedirect('//evil.com')).toBe('/dashboard');
  });

  it('rejects backslash and scheme-relative variants', () => {
    expect(sanitizeRedirect('/\\evil.com')).toBe('/dashboard');
    expect(sanitizeRedirect('/path\\evil.com')).toBe('/dashboard');
  });

  it('rejects paths carrying CRLF header injection', () => {
    const crlfPayload =
      '/path' + String.fromCharCode(13, 10) + 'Set-Cookie: x=1';
    expect(sanitizeRedirect(crlfPayload)).toBe('/dashboard');
  });

  it('rejects paths carrying a null byte', () => {
    const nullBytePayload = '/path' + String.fromCharCode(0) + 'evil';
    expect(sanitizeRedirect(nullBytePayload)).toBe('/dashboard');
  });
});
