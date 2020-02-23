/**
 * this plugin adds the encryption-capabilities to rxdb
 * It's using crypto-js/aes for password-encryption
 * @link https://github.com/brix/crypto-js
 */
import AES from 'crypto-js/aes';
import * as cryptoEnc from 'crypto-js/enc-utf8';
import { newRxTypeError, newRxError } from '../rx-error';
var minPassLength = 8;
export function encrypt(value, password) {
  var encrypted = AES.encrypt(value, password);
  return encrypted.toString();
}
export function decrypt(cipherText, password) {
  var decrypted = AES.decrypt(cipherText, password);
  return decrypted.toString(cryptoEnc);
}

var _encryptValue = function _encryptValue(value) {
  return encrypt(JSON.stringify(value), this.password);
};

var _decryptValue = function _decryptValue(encryptedValue) {
  var decrypted = decrypt(encryptedValue, this.password);
  return JSON.parse(decrypted);
};

export var rxdb = true;
export var prototypes = {
  /**
   * set crypto-functions for the Crypter.prototype
   */
  Crypter: function Crypter(proto) {
    proto._encryptValue = _encryptValue;
    proto._decryptValue = _decryptValue;
  }
};
export var overwritable = {
  validatePassword: function validatePassword(password) {
    if (password && typeof password !== 'string') {
      throw newRxTypeError('EN1', {
        password: password
      });
    }

    if (password && password.length < minPassLength) {
      throw newRxError('EN2', {
        minPassLength: minPassLength,
        password: password
      });
    }
  }
};
export default {
  rxdb: rxdb,
  prototypes: prototypes,
  overwritable: overwritable
};
//# sourceMappingURL=encryption.js.map