/**
 * Unit tests for typed error variants exported by the SDK.
 */

import { describe, it, expect } from 'vitest';
import {
  AbortError,
  CliInitError,
  CliNotFoundError,
  InputClosedError,
  TransportError,
  isAbortError,
  isCliInitError,
  isCliNotFoundError,
  isInputClosedError,
  isTransportError,
} from '../../src/types/errors.js';

describe('SDK typed errors', () => {
  describe('AbortError', () => {
    it('has a stable name and is identified by isAbortError', () => {
      const err = new AbortError();
      expect(err.name).toBe('AbortError');
      expect(isAbortError(err)).toBe(true);
    });

    it('isAbortError returns false for other Error instances', () => {
      expect(isAbortError(new Error('plain'))).toBe(false);
      expect(isAbortError(new TransportError('boom'))).toBe(false);
      expect(isAbortError(null)).toBe(false);
      expect(isAbortError('string')).toBe(false);
    });

    it('uses default message when none given', () => {
      expect(new AbortError().message).toBe('Operation aborted');
    });
  });

  describe('CliNotFoundError', () => {
    it('has a stable name and is identified by isCliNotFoundError', () => {
      const err = new CliNotFoundError('not found');
      expect(err.name).toBe('CliNotFoundError');
      expect(isCliNotFoundError(err)).toBe(true);
    });

    it('only matches its own variant', () => {
      expect(isCliNotFoundError(new TransportError('x'))).toBe(false);
    });
  });

  describe('CliInitError', () => {
    it('captures exitCode and stderr when given', () => {
      const err = new CliInitError('exited', { exitCode: 1, stderr: 'oops' });
      expect(err.name).toBe('CliInitError');
      expect(err.exitCode).toBe(1);
      expect(err.stderr).toBe('oops');
      expect(isCliInitError(err)).toBe(true);
    });

    it('defaults exitCode to null and stderr to undefined', () => {
      const err = new CliInitError('boom');
      expect(err.exitCode).toBe(null);
      expect(err.stderr).toBeUndefined();
    });

    it('isCliInitError does not confuse with TransportError', () => {
      expect(isCliInitError(new TransportError('x'))).toBe(false);
    });
  });

  describe('TransportError', () => {
    it('captures exitCode when given', () => {
      const err = new TransportError('died', { exitCode: 137 });
      expect(err.name).toBe('TransportError');
      expect(err.exitCode).toBe(137);
      expect(isTransportError(err)).toBe(true);
    });

    it('defaults exitCode to null', () => {
      expect(new TransportError('boom').exitCode).toBe(null);
    });
  });

  describe('InputClosedError', () => {
    it('uses default message and matches its guard', () => {
      const err = new InputClosedError();
      expect(err.name).toBe('InputClosedError');
      expect(err.message).toBe('Input stream closed');
      expect(isInputClosedError(err)).toBe(true);
    });
  });

  describe('cross-variant guards', () => {
    it('every guard returns false for plain Error', () => {
      const plain = new Error('plain');
      expect(isAbortError(plain)).toBe(false);
      expect(isCliNotFoundError(plain)).toBe(false);
      expect(isCliInitError(plain)).toBe(false);
      expect(isTransportError(plain)).toBe(false);
      expect(isInputClosedError(plain)).toBe(false);
    });

    it('every guard returns false for non-Error inputs', () => {
      for (const value of [
        undefined,
        null,
        42,
        'oops',
        { name: 'AbortError' },
      ]) {
        expect(isAbortError(value)).toBe(false);
        expect(isTransportError(value)).toBe(false);
      }
    });
  });
});
