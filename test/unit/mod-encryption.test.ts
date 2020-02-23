/**
 * test agains the encryption-module
 * @file src/plugins/encryption.js
 */
import assert from 'assert';
import * as util from '../../dist/lib/util';
import * as encryption from '../../dist/lib/plugins/encryption';

describe('mod-encrytion.test.js : .encrypt()', () => {
    it('should encrypt properly', () => {
        const value = 'foobar';
        const pwd = 'pwd';
        const encrypted = encryption.encrypt(value, pwd);
        assert.notStrictEqual(value, encrypted);
        assert.ok(encrypted.length > value.length);
        assert.strictEqual(typeof encrypted, 'string');
    });
    it('should decrypt properly', () => {
        const value = 'foobar';
        const pwd = 'pwd';
        const encrypted = encryption.encrypt(value, pwd);
        const decrypted = encryption.decrypt(encrypted, pwd);
        assert.notStrictEqual(decrypted, encrypted);
        assert.strictEqual(value, decrypted);
    });
    it('should encrypt and decrypt an extremly long string', () => {
        const value = util.randomCouchString(5000);
        const pwd = 'pwd';
        const encrypted = encryption.encrypt(value, pwd);
        const decrypted = encryption.decrypt(encrypted, pwd);
        assert.notStrictEqual(value, encrypted);
        assert.ok(encrypted.length > value.length);
        assert.strictEqual(typeof encrypted, 'string');
        assert.strictEqual(value, decrypted);
    });
    it('should encrypt and decrypt an extremly long password', () => {
        const value = 'foobar';
        const pwd = util.randomCouchString(5000);
        const encrypted = encryption.encrypt(value, pwd);
        const decrypted = encryption.decrypt(encrypted, pwd);
        assert.notStrictEqual(value, encrypted);
        assert.ok(encrypted.length > value.length);
        assert.strictEqual(typeof encrypted, 'string');
        assert.strictEqual(value, decrypted);
    });
});
