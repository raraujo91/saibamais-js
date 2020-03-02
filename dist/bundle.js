(function () {
            'use strict';

            var global$1 = (typeof global !== "undefined" ? global :
                        typeof self !== "undefined" ? self :
                        typeof window !== "undefined" ? window : {});

            // from https://github.com/kumavis/browser-process-hrtime/blob/master/index.js
            var performance = global$1.performance || {};
            var performanceNow =
              performance.now        ||
              performance.mozNow     ||
              performance.msNow      ||
              performance.oNow       ||
              performance.webkitNow  ||
              function(){ return (new Date()).getTime() };

            var commonjsGlobal = typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : typeof global !== 'undefined' ? global : typeof self !== 'undefined' ? self : {};

            function unwrapExports (x) {
            	return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, 'default') ? x['default'] : x;
            }

            function createCommonjsModule(fn, module) {
            	return module = { exports: {} }, fn(module, module.exports), module.exports;
            }

            var lookup = [];
            var revLookup = [];
            var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array;
            var inited = false;
            function init () {
              inited = true;
              var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
              for (var i = 0, len = code.length; i < len; ++i) {
                lookup[i] = code[i];
                revLookup[code.charCodeAt(i)] = i;
              }

              revLookup['-'.charCodeAt(0)] = 62;
              revLookup['_'.charCodeAt(0)] = 63;
            }

            function toByteArray (b64) {
              if (!inited) {
                init();
              }
              var i, j, l, tmp, placeHolders, arr;
              var len = b64.length;

              if (len % 4 > 0) {
                throw new Error('Invalid string. Length must be a multiple of 4')
              }

              // the number of equal signs (place holders)
              // if there are two placeholders, than the two characters before it
              // represent one byte
              // if there is only one, then the three characters before it represent 2 bytes
              // this is just a cheap hack to not do indexOf twice
              placeHolders = b64[len - 2] === '=' ? 2 : b64[len - 1] === '=' ? 1 : 0;

              // base64 is 4/3 + up to two characters of the original data
              arr = new Arr(len * 3 / 4 - placeHolders);

              // if there are placeholders, only get up to the last complete 4 chars
              l = placeHolders > 0 ? len - 4 : len;

              var L = 0;

              for (i = 0, j = 0; i < l; i += 4, j += 3) {
                tmp = (revLookup[b64.charCodeAt(i)] << 18) | (revLookup[b64.charCodeAt(i + 1)] << 12) | (revLookup[b64.charCodeAt(i + 2)] << 6) | revLookup[b64.charCodeAt(i + 3)];
                arr[L++] = (tmp >> 16) & 0xFF;
                arr[L++] = (tmp >> 8) & 0xFF;
                arr[L++] = tmp & 0xFF;
              }

              if (placeHolders === 2) {
                tmp = (revLookup[b64.charCodeAt(i)] << 2) | (revLookup[b64.charCodeAt(i + 1)] >> 4);
                arr[L++] = tmp & 0xFF;
              } else if (placeHolders === 1) {
                tmp = (revLookup[b64.charCodeAt(i)] << 10) | (revLookup[b64.charCodeAt(i + 1)] << 4) | (revLookup[b64.charCodeAt(i + 2)] >> 2);
                arr[L++] = (tmp >> 8) & 0xFF;
                arr[L++] = tmp & 0xFF;
              }

              return arr
            }

            function tripletToBase64 (num) {
              return lookup[num >> 18 & 0x3F] + lookup[num >> 12 & 0x3F] + lookup[num >> 6 & 0x3F] + lookup[num & 0x3F]
            }

            function encodeChunk (uint8, start, end) {
              var tmp;
              var output = [];
              for (var i = start; i < end; i += 3) {
                tmp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2]);
                output.push(tripletToBase64(tmp));
              }
              return output.join('')
            }

            function fromByteArray (uint8) {
              if (!inited) {
                init();
              }
              var tmp;
              var len = uint8.length;
              var extraBytes = len % 3; // if we have 1 byte left, pad 2 bytes
              var output = '';
              var parts = [];
              var maxChunkLength = 16383; // must be multiple of 3

              // go through the array every three bytes, we'll deal with trailing stuff later
              for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
                parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)));
              }

              // pad the end with zeros, but make sure to not forget the extra bytes
              if (extraBytes === 1) {
                tmp = uint8[len - 1];
                output += lookup[tmp >> 2];
                output += lookup[(tmp << 4) & 0x3F];
                output += '==';
              } else if (extraBytes === 2) {
                tmp = (uint8[len - 2] << 8) + (uint8[len - 1]);
                output += lookup[tmp >> 10];
                output += lookup[(tmp >> 4) & 0x3F];
                output += lookup[(tmp << 2) & 0x3F];
                output += '=';
              }

              parts.push(output);

              return parts.join('')
            }

            function read (buffer, offset, isLE, mLen, nBytes) {
              var e, m;
              var eLen = nBytes * 8 - mLen - 1;
              var eMax = (1 << eLen) - 1;
              var eBias = eMax >> 1;
              var nBits = -7;
              var i = isLE ? (nBytes - 1) : 0;
              var d = isLE ? -1 : 1;
              var s = buffer[offset + i];

              i += d;

              e = s & ((1 << (-nBits)) - 1);
              s >>= (-nBits);
              nBits += eLen;
              for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

              m = e & ((1 << (-nBits)) - 1);
              e >>= (-nBits);
              nBits += mLen;
              for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

              if (e === 0) {
                e = 1 - eBias;
              } else if (e === eMax) {
                return m ? NaN : ((s ? -1 : 1) * Infinity)
              } else {
                m = m + Math.pow(2, mLen);
                e = e - eBias;
              }
              return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
            }

            function write (buffer, value, offset, isLE, mLen, nBytes) {
              var e, m, c;
              var eLen = nBytes * 8 - mLen - 1;
              var eMax = (1 << eLen) - 1;
              var eBias = eMax >> 1;
              var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0);
              var i = isLE ? 0 : (nBytes - 1);
              var d = isLE ? 1 : -1;
              var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

              value = Math.abs(value);

              if (isNaN(value) || value === Infinity) {
                m = isNaN(value) ? 1 : 0;
                e = eMax;
              } else {
                e = Math.floor(Math.log(value) / Math.LN2);
                if (value * (c = Math.pow(2, -e)) < 1) {
                  e--;
                  c *= 2;
                }
                if (e + eBias >= 1) {
                  value += rt / c;
                } else {
                  value += rt * Math.pow(2, 1 - eBias);
                }
                if (value * c >= 2) {
                  e++;
                  c /= 2;
                }

                if (e + eBias >= eMax) {
                  m = 0;
                  e = eMax;
                } else if (e + eBias >= 1) {
                  m = (value * c - 1) * Math.pow(2, mLen);
                  e = e + eBias;
                } else {
                  m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
                  e = 0;
                }
              }

              for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

              e = (e << mLen) | m;
              eLen += mLen;
              for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

              buffer[offset + i - d] |= s * 128;
            }

            var toString = {}.toString;

            var isArray = Array.isArray || function (arr) {
              return toString.call(arr) == '[object Array]';
            };

            var INSPECT_MAX_BYTES = 50;

            /**
             * If `Buffer.TYPED_ARRAY_SUPPORT`:
             *   === true    Use Uint8Array implementation (fastest)
             *   === false   Use Object implementation (most compatible, even IE6)
             *
             * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
             * Opera 11.6+, iOS 4.2+.
             *
             * Due to various browser bugs, sometimes the Object implementation will be used even
             * when the browser supports typed arrays.
             *
             * Note:
             *
             *   - Firefox 4-29 lacks support for adding new properties to `Uint8Array` instances,
             *     See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
             *
             *   - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
             *
             *   - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
             *     incorrect length in some situations.

             * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they
             * get the Object implementation, which is slower but behaves correctly.
             */
            Buffer.TYPED_ARRAY_SUPPORT = global$1.TYPED_ARRAY_SUPPORT !== undefined
              ? global$1.TYPED_ARRAY_SUPPORT
              : true;

            function kMaxLength () {
              return Buffer.TYPED_ARRAY_SUPPORT
                ? 0x7fffffff
                : 0x3fffffff
            }

            function createBuffer (that, length) {
              if (kMaxLength() < length) {
                throw new RangeError('Invalid typed array length')
              }
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                // Return an augmented `Uint8Array` instance, for best performance
                that = new Uint8Array(length);
                that.__proto__ = Buffer.prototype;
              } else {
                // Fallback: Return an object instance of the Buffer class
                if (that === null) {
                  that = new Buffer(length);
                }
                that.length = length;
              }

              return that
            }

            /**
             * The Buffer constructor returns instances of `Uint8Array` that have their
             * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
             * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
             * and the `Uint8Array` methods. Square bracket notation works as expected -- it
             * returns a single octet.
             *
             * The `Uint8Array` prototype remains unmodified.
             */

            function Buffer (arg, encodingOrOffset, length) {
              if (!Buffer.TYPED_ARRAY_SUPPORT && !(this instanceof Buffer)) {
                return new Buffer(arg, encodingOrOffset, length)
              }

              // Common case.
              if (typeof arg === 'number') {
                if (typeof encodingOrOffset === 'string') {
                  throw new Error(
                    'If encoding is specified then the first argument must be a string'
                  )
                }
                return allocUnsafe(this, arg)
              }
              return from(this, arg, encodingOrOffset, length)
            }

            Buffer.poolSize = 8192; // not used by this implementation

            // TODO: Legacy, not needed anymore. Remove in next major version.
            Buffer._augment = function (arr) {
              arr.__proto__ = Buffer.prototype;
              return arr
            };

            function from (that, value, encodingOrOffset, length) {
              if (typeof value === 'number') {
                throw new TypeError('"value" argument must not be a number')
              }

              if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
                return fromArrayBuffer(that, value, encodingOrOffset, length)
              }

              if (typeof value === 'string') {
                return fromString(that, value, encodingOrOffset)
              }

              return fromObject(that, value)
            }

            /**
             * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
             * if value is a number.
             * Buffer.from(str[, encoding])
             * Buffer.from(array)
             * Buffer.from(buffer)
             * Buffer.from(arrayBuffer[, byteOffset[, length]])
             **/
            Buffer.from = function (value, encodingOrOffset, length) {
              return from(null, value, encodingOrOffset, length)
            };

            if (Buffer.TYPED_ARRAY_SUPPORT) {
              Buffer.prototype.__proto__ = Uint8Array.prototype;
              Buffer.__proto__ = Uint8Array;
            }

            function assertSize (size) {
              if (typeof size !== 'number') {
                throw new TypeError('"size" argument must be a number')
              } else if (size < 0) {
                throw new RangeError('"size" argument must not be negative')
              }
            }

            function alloc (that, size, fill, encoding) {
              assertSize(size);
              if (size <= 0) {
                return createBuffer(that, size)
              }
              if (fill !== undefined) {
                // Only pay attention to encoding if it's a string. This
                // prevents accidentally sending in a number that would
                // be interpretted as a start offset.
                return typeof encoding === 'string'
                  ? createBuffer(that, size).fill(fill, encoding)
                  : createBuffer(that, size).fill(fill)
              }
              return createBuffer(that, size)
            }

            /**
             * Creates a new filled Buffer instance.
             * alloc(size[, fill[, encoding]])
             **/
            Buffer.alloc = function (size, fill, encoding) {
              return alloc(null, size, fill, encoding)
            };

            function allocUnsafe (that, size) {
              assertSize(size);
              that = createBuffer(that, size < 0 ? 0 : checked(size) | 0);
              if (!Buffer.TYPED_ARRAY_SUPPORT) {
                for (var i = 0; i < size; ++i) {
                  that[i] = 0;
                }
              }
              return that
            }

            /**
             * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
             * */
            Buffer.allocUnsafe = function (size) {
              return allocUnsafe(null, size)
            };
            /**
             * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
             */
            Buffer.allocUnsafeSlow = function (size) {
              return allocUnsafe(null, size)
            };

            function fromString (that, string, encoding) {
              if (typeof encoding !== 'string' || encoding === '') {
                encoding = 'utf8';
              }

              if (!Buffer.isEncoding(encoding)) {
                throw new TypeError('"encoding" must be a valid string encoding')
              }

              var length = byteLength(string, encoding) | 0;
              that = createBuffer(that, length);

              var actual = that.write(string, encoding);

              if (actual !== length) {
                // Writing a hex string, for example, that contains invalid characters will
                // cause everything after the first invalid character to be ignored. (e.g.
                // 'abxxcd' will be treated as 'ab')
                that = that.slice(0, actual);
              }

              return that
            }

            function fromArrayLike (that, array) {
              var length = array.length < 0 ? 0 : checked(array.length) | 0;
              that = createBuffer(that, length);
              for (var i = 0; i < length; i += 1) {
                that[i] = array[i] & 255;
              }
              return that
            }

            function fromArrayBuffer (that, array, byteOffset, length) {
              array.byteLength; // this throws if `array` is not a valid ArrayBuffer

              if (byteOffset < 0 || array.byteLength < byteOffset) {
                throw new RangeError('\'offset\' is out of bounds')
              }

              if (array.byteLength < byteOffset + (length || 0)) {
                throw new RangeError('\'length\' is out of bounds')
              }

              if (byteOffset === undefined && length === undefined) {
                array = new Uint8Array(array);
              } else if (length === undefined) {
                array = new Uint8Array(array, byteOffset);
              } else {
                array = new Uint8Array(array, byteOffset, length);
              }

              if (Buffer.TYPED_ARRAY_SUPPORT) {
                // Return an augmented `Uint8Array` instance, for best performance
                that = array;
                that.__proto__ = Buffer.prototype;
              } else {
                // Fallback: Return an object instance of the Buffer class
                that = fromArrayLike(that, array);
              }
              return that
            }

            function fromObject (that, obj) {
              if (internalIsBuffer(obj)) {
                var len = checked(obj.length) | 0;
                that = createBuffer(that, len);

                if (that.length === 0) {
                  return that
                }

                obj.copy(that, 0, 0, len);
                return that
              }

              if (obj) {
                if ((typeof ArrayBuffer !== 'undefined' &&
                    obj.buffer instanceof ArrayBuffer) || 'length' in obj) {
                  if (typeof obj.length !== 'number' || isnan(obj.length)) {
                    return createBuffer(that, 0)
                  }
                  return fromArrayLike(that, obj)
                }

                if (obj.type === 'Buffer' && isArray(obj.data)) {
                  return fromArrayLike(that, obj.data)
                }
              }

              throw new TypeError('First argument must be a string, Buffer, ArrayBuffer, Array, or array-like object.')
            }

            function checked (length) {
              // Note: cannot use `length < kMaxLength()` here because that fails when
              // length is NaN (which is otherwise coerced to zero.)
              if (length >= kMaxLength()) {
                throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                                     'size: 0x' + kMaxLength().toString(16) + ' bytes')
              }
              return length | 0
            }
            Buffer.isBuffer = isBuffer;
            function internalIsBuffer (b) {
              return !!(b != null && b._isBuffer)
            }

            Buffer.compare = function compare (a, b) {
              if (!internalIsBuffer(a) || !internalIsBuffer(b)) {
                throw new TypeError('Arguments must be Buffers')
              }

              if (a === b) return 0

              var x = a.length;
              var y = b.length;

              for (var i = 0, len = Math.min(x, y); i < len; ++i) {
                if (a[i] !== b[i]) {
                  x = a[i];
                  y = b[i];
                  break
                }
              }

              if (x < y) return -1
              if (y < x) return 1
              return 0
            };

            Buffer.isEncoding = function isEncoding (encoding) {
              switch (String(encoding).toLowerCase()) {
                case 'hex':
                case 'utf8':
                case 'utf-8':
                case 'ascii':
                case 'latin1':
                case 'binary':
                case 'base64':
                case 'ucs2':
                case 'ucs-2':
                case 'utf16le':
                case 'utf-16le':
                  return true
                default:
                  return false
              }
            };

            Buffer.concat = function concat (list, length) {
              if (!isArray(list)) {
                throw new TypeError('"list" argument must be an Array of Buffers')
              }

              if (list.length === 0) {
                return Buffer.alloc(0)
              }

              var i;
              if (length === undefined) {
                length = 0;
                for (i = 0; i < list.length; ++i) {
                  length += list[i].length;
                }
              }

              var buffer = Buffer.allocUnsafe(length);
              var pos = 0;
              for (i = 0; i < list.length; ++i) {
                var buf = list[i];
                if (!internalIsBuffer(buf)) {
                  throw new TypeError('"list" argument must be an Array of Buffers')
                }
                buf.copy(buffer, pos);
                pos += buf.length;
              }
              return buffer
            };

            function byteLength (string, encoding) {
              if (internalIsBuffer(string)) {
                return string.length
              }
              if (typeof ArrayBuffer !== 'undefined' && typeof ArrayBuffer.isView === 'function' &&
                  (ArrayBuffer.isView(string) || string instanceof ArrayBuffer)) {
                return string.byteLength
              }
              if (typeof string !== 'string') {
                string = '' + string;
              }

              var len = string.length;
              if (len === 0) return 0

              // Use a for loop to avoid recursion
              var loweredCase = false;
              for (;;) {
                switch (encoding) {
                  case 'ascii':
                  case 'latin1':
                  case 'binary':
                    return len
                  case 'utf8':
                  case 'utf-8':
                  case undefined:
                    return utf8ToBytes(string).length
                  case 'ucs2':
                  case 'ucs-2':
                  case 'utf16le':
                  case 'utf-16le':
                    return len * 2
                  case 'hex':
                    return len >>> 1
                  case 'base64':
                    return base64ToBytes(string).length
                  default:
                    if (loweredCase) return utf8ToBytes(string).length // assume utf8
                    encoding = ('' + encoding).toLowerCase();
                    loweredCase = true;
                }
              }
            }
            Buffer.byteLength = byteLength;

            function slowToString (encoding, start, end) {
              var loweredCase = false;

              // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
              // property of a typed array.

              // This behaves neither like String nor Uint8Array in that we set start/end
              // to their upper/lower bounds if the value passed is out of range.
              // undefined is handled specially as per ECMA-262 6th Edition,
              // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
              if (start === undefined || start < 0) {
                start = 0;
              }
              // Return early if start > this.length. Done here to prevent potential uint32
              // coercion fail below.
              if (start > this.length) {
                return ''
              }

              if (end === undefined || end > this.length) {
                end = this.length;
              }

              if (end <= 0) {
                return ''
              }

              // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
              end >>>= 0;
              start >>>= 0;

              if (end <= start) {
                return ''
              }

              if (!encoding) encoding = 'utf8';

              while (true) {
                switch (encoding) {
                  case 'hex':
                    return hexSlice(this, start, end)

                  case 'utf8':
                  case 'utf-8':
                    return utf8Slice(this, start, end)

                  case 'ascii':
                    return asciiSlice(this, start, end)

                  case 'latin1':
                  case 'binary':
                    return latin1Slice(this, start, end)

                  case 'base64':
                    return base64Slice(this, start, end)

                  case 'ucs2':
                  case 'ucs-2':
                  case 'utf16le':
                  case 'utf-16le':
                    return utf16leSlice(this, start, end)

                  default:
                    if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                    encoding = (encoding + '').toLowerCase();
                    loweredCase = true;
                }
              }
            }

            // The property is used by `Buffer.isBuffer` and `is-buffer` (in Safari 5-7) to detect
            // Buffer instances.
            Buffer.prototype._isBuffer = true;

            function swap (b, n, m) {
              var i = b[n];
              b[n] = b[m];
              b[m] = i;
            }

            Buffer.prototype.swap16 = function swap16 () {
              var len = this.length;
              if (len % 2 !== 0) {
                throw new RangeError('Buffer size must be a multiple of 16-bits')
              }
              for (var i = 0; i < len; i += 2) {
                swap(this, i, i + 1);
              }
              return this
            };

            Buffer.prototype.swap32 = function swap32 () {
              var len = this.length;
              if (len % 4 !== 0) {
                throw new RangeError('Buffer size must be a multiple of 32-bits')
              }
              for (var i = 0; i < len; i += 4) {
                swap(this, i, i + 3);
                swap(this, i + 1, i + 2);
              }
              return this
            };

            Buffer.prototype.swap64 = function swap64 () {
              var len = this.length;
              if (len % 8 !== 0) {
                throw new RangeError('Buffer size must be a multiple of 64-bits')
              }
              for (var i = 0; i < len; i += 8) {
                swap(this, i, i + 7);
                swap(this, i + 1, i + 6);
                swap(this, i + 2, i + 5);
                swap(this, i + 3, i + 4);
              }
              return this
            };

            Buffer.prototype.toString = function toString () {
              var length = this.length | 0;
              if (length === 0) return ''
              if (arguments.length === 0) return utf8Slice(this, 0, length)
              return slowToString.apply(this, arguments)
            };

            Buffer.prototype.equals = function equals (b) {
              if (!internalIsBuffer(b)) throw new TypeError('Argument must be a Buffer')
              if (this === b) return true
              return Buffer.compare(this, b) === 0
            };

            Buffer.prototype.inspect = function inspect () {
              var str = '';
              var max = INSPECT_MAX_BYTES;
              if (this.length > 0) {
                str = this.toString('hex', 0, max).match(/.{2}/g).join(' ');
                if (this.length > max) str += ' ... ';
              }
              return '<Buffer ' + str + '>'
            };

            Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
              if (!internalIsBuffer(target)) {
                throw new TypeError('Argument must be a Buffer')
              }

              if (start === undefined) {
                start = 0;
              }
              if (end === undefined) {
                end = target ? target.length : 0;
              }
              if (thisStart === undefined) {
                thisStart = 0;
              }
              if (thisEnd === undefined) {
                thisEnd = this.length;
              }

              if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
                throw new RangeError('out of range index')
              }

              if (thisStart >= thisEnd && start >= end) {
                return 0
              }
              if (thisStart >= thisEnd) {
                return -1
              }
              if (start >= end) {
                return 1
              }

              start >>>= 0;
              end >>>= 0;
              thisStart >>>= 0;
              thisEnd >>>= 0;

              if (this === target) return 0

              var x = thisEnd - thisStart;
              var y = end - start;
              var len = Math.min(x, y);

              var thisCopy = this.slice(thisStart, thisEnd);
              var targetCopy = target.slice(start, end);

              for (var i = 0; i < len; ++i) {
                if (thisCopy[i] !== targetCopy[i]) {
                  x = thisCopy[i];
                  y = targetCopy[i];
                  break
                }
              }

              if (x < y) return -1
              if (y < x) return 1
              return 0
            };

            // Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
            // OR the last index of `val` in `buffer` at offset <= `byteOffset`.
            //
            // Arguments:
            // - buffer - a Buffer to search
            // - val - a string, Buffer, or number
            // - byteOffset - an index into `buffer`; will be clamped to an int32
            // - encoding - an optional encoding, relevant is val is a string
            // - dir - true for indexOf, false for lastIndexOf
            function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
              // Empty buffer means no match
              if (buffer.length === 0) return -1

              // Normalize byteOffset
              if (typeof byteOffset === 'string') {
                encoding = byteOffset;
                byteOffset = 0;
              } else if (byteOffset > 0x7fffffff) {
                byteOffset = 0x7fffffff;
              } else if (byteOffset < -0x80000000) {
                byteOffset = -0x80000000;
              }
              byteOffset = +byteOffset;  // Coerce to Number.
              if (isNaN(byteOffset)) {
                // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
                byteOffset = dir ? 0 : (buffer.length - 1);
              }

              // Normalize byteOffset: negative offsets start from the end of the buffer
              if (byteOffset < 0) byteOffset = buffer.length + byteOffset;
              if (byteOffset >= buffer.length) {
                if (dir) return -1
                else byteOffset = buffer.length - 1;
              } else if (byteOffset < 0) {
                if (dir) byteOffset = 0;
                else return -1
              }

              // Normalize val
              if (typeof val === 'string') {
                val = Buffer.from(val, encoding);
              }

              // Finally, search either indexOf (if dir is true) or lastIndexOf
              if (internalIsBuffer(val)) {
                // Special case: looking for empty string/buffer always fails
                if (val.length === 0) {
                  return -1
                }
                return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
              } else if (typeof val === 'number') {
                val = val & 0xFF; // Search for a byte value [0-255]
                if (Buffer.TYPED_ARRAY_SUPPORT &&
                    typeof Uint8Array.prototype.indexOf === 'function') {
                  if (dir) {
                    return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
                  } else {
                    return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
                  }
                }
                return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
              }

              throw new TypeError('val must be string, number or Buffer')
            }

            function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
              var indexSize = 1;
              var arrLength = arr.length;
              var valLength = val.length;

              if (encoding !== undefined) {
                encoding = String(encoding).toLowerCase();
                if (encoding === 'ucs2' || encoding === 'ucs-2' ||
                    encoding === 'utf16le' || encoding === 'utf-16le') {
                  if (arr.length < 2 || val.length < 2) {
                    return -1
                  }
                  indexSize = 2;
                  arrLength /= 2;
                  valLength /= 2;
                  byteOffset /= 2;
                }
              }

              function read (buf, i) {
                if (indexSize === 1) {
                  return buf[i]
                } else {
                  return buf.readUInt16BE(i * indexSize)
                }
              }

              var i;
              if (dir) {
                var foundIndex = -1;
                for (i = byteOffset; i < arrLength; i++) {
                  if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
                    if (foundIndex === -1) foundIndex = i;
                    if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
                  } else {
                    if (foundIndex !== -1) i -= i - foundIndex;
                    foundIndex = -1;
                  }
                }
              } else {
                if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength;
                for (i = byteOffset; i >= 0; i--) {
                  var found = true;
                  for (var j = 0; j < valLength; j++) {
                    if (read(arr, i + j) !== read(val, j)) {
                      found = false;
                      break
                    }
                  }
                  if (found) return i
                }
              }

              return -1
            }

            Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
              return this.indexOf(val, byteOffset, encoding) !== -1
            };

            Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
              return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
            };

            Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
              return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
            };

            function hexWrite (buf, string, offset, length) {
              offset = Number(offset) || 0;
              var remaining = buf.length - offset;
              if (!length) {
                length = remaining;
              } else {
                length = Number(length);
                if (length > remaining) {
                  length = remaining;
                }
              }

              // must be an even number of digits
              var strLen = string.length;
              if (strLen % 2 !== 0) throw new TypeError('Invalid hex string')

              if (length > strLen / 2) {
                length = strLen / 2;
              }
              for (var i = 0; i < length; ++i) {
                var parsed = parseInt(string.substr(i * 2, 2), 16);
                if (isNaN(parsed)) return i
                buf[offset + i] = parsed;
              }
              return i
            }

            function utf8Write (buf, string, offset, length) {
              return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
            }

            function asciiWrite (buf, string, offset, length) {
              return blitBuffer(asciiToBytes(string), buf, offset, length)
            }

            function latin1Write (buf, string, offset, length) {
              return asciiWrite(buf, string, offset, length)
            }

            function base64Write (buf, string, offset, length) {
              return blitBuffer(base64ToBytes(string), buf, offset, length)
            }

            function ucs2Write (buf, string, offset, length) {
              return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
            }

            Buffer.prototype.write = function write (string, offset, length, encoding) {
              // Buffer#write(string)
              if (offset === undefined) {
                encoding = 'utf8';
                length = this.length;
                offset = 0;
              // Buffer#write(string, encoding)
              } else if (length === undefined && typeof offset === 'string') {
                encoding = offset;
                length = this.length;
                offset = 0;
              // Buffer#write(string, offset[, length][, encoding])
              } else if (isFinite(offset)) {
                offset = offset | 0;
                if (isFinite(length)) {
                  length = length | 0;
                  if (encoding === undefined) encoding = 'utf8';
                } else {
                  encoding = length;
                  length = undefined;
                }
              // legacy write(string, encoding, offset, length) - remove in v0.13
              } else {
                throw new Error(
                  'Buffer.write(string, encoding, offset[, length]) is no longer supported'
                )
              }

              var remaining = this.length - offset;
              if (length === undefined || length > remaining) length = remaining;

              if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
                throw new RangeError('Attempt to write outside buffer bounds')
              }

              if (!encoding) encoding = 'utf8';

              var loweredCase = false;
              for (;;) {
                switch (encoding) {
                  case 'hex':
                    return hexWrite(this, string, offset, length)

                  case 'utf8':
                  case 'utf-8':
                    return utf8Write(this, string, offset, length)

                  case 'ascii':
                    return asciiWrite(this, string, offset, length)

                  case 'latin1':
                  case 'binary':
                    return latin1Write(this, string, offset, length)

                  case 'base64':
                    // Warning: maxLength not taken into account in base64Write
                    return base64Write(this, string, offset, length)

                  case 'ucs2':
                  case 'ucs-2':
                  case 'utf16le':
                  case 'utf-16le':
                    return ucs2Write(this, string, offset, length)

                  default:
                    if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
                    encoding = ('' + encoding).toLowerCase();
                    loweredCase = true;
                }
              }
            };

            Buffer.prototype.toJSON = function toJSON () {
              return {
                type: 'Buffer',
                data: Array.prototype.slice.call(this._arr || this, 0)
              }
            };

            function base64Slice (buf, start, end) {
              if (start === 0 && end === buf.length) {
                return fromByteArray(buf)
              } else {
                return fromByteArray(buf.slice(start, end))
              }
            }

            function utf8Slice (buf, start, end) {
              end = Math.min(buf.length, end);
              var res = [];

              var i = start;
              while (i < end) {
                var firstByte = buf[i];
                var codePoint = null;
                var bytesPerSequence = (firstByte > 0xEF) ? 4
                  : (firstByte > 0xDF) ? 3
                  : (firstByte > 0xBF) ? 2
                  : 1;

                if (i + bytesPerSequence <= end) {
                  var secondByte, thirdByte, fourthByte, tempCodePoint;

                  switch (bytesPerSequence) {
                    case 1:
                      if (firstByte < 0x80) {
                        codePoint = firstByte;
                      }
                      break
                    case 2:
                      secondByte = buf[i + 1];
                      if ((secondByte & 0xC0) === 0x80) {
                        tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F);
                        if (tempCodePoint > 0x7F) {
                          codePoint = tempCodePoint;
                        }
                      }
                      break
                    case 3:
                      secondByte = buf[i + 1];
                      thirdByte = buf[i + 2];
                      if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
                        tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F);
                        if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
                          codePoint = tempCodePoint;
                        }
                      }
                      break
                    case 4:
                      secondByte = buf[i + 1];
                      thirdByte = buf[i + 2];
                      fourthByte = buf[i + 3];
                      if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
                        tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F);
                        if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
                          codePoint = tempCodePoint;
                        }
                      }
                  }
                }

                if (codePoint === null) {
                  // we did not generate a valid codePoint so insert a
                  // replacement char (U+FFFD) and advance only 1 byte
                  codePoint = 0xFFFD;
                  bytesPerSequence = 1;
                } else if (codePoint > 0xFFFF) {
                  // encode to utf16 (surrogate pair dance)
                  codePoint -= 0x10000;
                  res.push(codePoint >>> 10 & 0x3FF | 0xD800);
                  codePoint = 0xDC00 | codePoint & 0x3FF;
                }

                res.push(codePoint);
                i += bytesPerSequence;
              }

              return decodeCodePointsArray(res)
            }

            // Based on http://stackoverflow.com/a/22747272/680742, the browser with
            // the lowest limit is Chrome, with 0x10000 args.
            // We go 1 magnitude less, for safety
            var MAX_ARGUMENTS_LENGTH = 0x1000;

            function decodeCodePointsArray (codePoints) {
              var len = codePoints.length;
              if (len <= MAX_ARGUMENTS_LENGTH) {
                return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
              }

              // Decode in chunks to avoid "call stack size exceeded".
              var res = '';
              var i = 0;
              while (i < len) {
                res += String.fromCharCode.apply(
                  String,
                  codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
                );
              }
              return res
            }

            function asciiSlice (buf, start, end) {
              var ret = '';
              end = Math.min(buf.length, end);

              for (var i = start; i < end; ++i) {
                ret += String.fromCharCode(buf[i] & 0x7F);
              }
              return ret
            }

            function latin1Slice (buf, start, end) {
              var ret = '';
              end = Math.min(buf.length, end);

              for (var i = start; i < end; ++i) {
                ret += String.fromCharCode(buf[i]);
              }
              return ret
            }

            function hexSlice (buf, start, end) {
              var len = buf.length;

              if (!start || start < 0) start = 0;
              if (!end || end < 0 || end > len) end = len;

              var out = '';
              for (var i = start; i < end; ++i) {
                out += toHex(buf[i]);
              }
              return out
            }

            function utf16leSlice (buf, start, end) {
              var bytes = buf.slice(start, end);
              var res = '';
              for (var i = 0; i < bytes.length; i += 2) {
                res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256);
              }
              return res
            }

            Buffer.prototype.slice = function slice (start, end) {
              var len = this.length;
              start = ~~start;
              end = end === undefined ? len : ~~end;

              if (start < 0) {
                start += len;
                if (start < 0) start = 0;
              } else if (start > len) {
                start = len;
              }

              if (end < 0) {
                end += len;
                if (end < 0) end = 0;
              } else if (end > len) {
                end = len;
              }

              if (end < start) end = start;

              var newBuf;
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                newBuf = this.subarray(start, end);
                newBuf.__proto__ = Buffer.prototype;
              } else {
                var sliceLen = end - start;
                newBuf = new Buffer(sliceLen, undefined);
                for (var i = 0; i < sliceLen; ++i) {
                  newBuf[i] = this[i + start];
                }
              }

              return newBuf
            };

            /*
             * Need to make sure that buffer isn't trying to write out of bounds.
             */
            function checkOffset (offset, ext, length) {
              if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
              if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
            }

            Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) checkOffset(offset, byteLength, this.length);

              var val = this[offset];
              var mul = 1;
              var i = 0;
              while (++i < byteLength && (mul *= 0x100)) {
                val += this[offset + i] * mul;
              }

              return val
            };

            Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) {
                checkOffset(offset, byteLength, this.length);
              }

              var val = this[offset + --byteLength];
              var mul = 1;
              while (byteLength > 0 && (mul *= 0x100)) {
                val += this[offset + --byteLength] * mul;
              }

              return val
            };

            Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 1, this.length);
              return this[offset]
            };

            Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 2, this.length);
              return this[offset] | (this[offset + 1] << 8)
            };

            Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 2, this.length);
              return (this[offset] << 8) | this[offset + 1]
            };

            Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);

              return ((this[offset]) |
                  (this[offset + 1] << 8) |
                  (this[offset + 2] << 16)) +
                  (this[offset + 3] * 0x1000000)
            };

            Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);

              return (this[offset] * 0x1000000) +
                ((this[offset + 1] << 16) |
                (this[offset + 2] << 8) |
                this[offset + 3])
            };

            Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) checkOffset(offset, byteLength, this.length);

              var val = this[offset];
              var mul = 1;
              var i = 0;
              while (++i < byteLength && (mul *= 0x100)) {
                val += this[offset + i] * mul;
              }
              mul *= 0x80;

              if (val >= mul) val -= Math.pow(2, 8 * byteLength);

              return val
            };

            Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) checkOffset(offset, byteLength, this.length);

              var i = byteLength;
              var mul = 1;
              var val = this[offset + --i];
              while (i > 0 && (mul *= 0x100)) {
                val += this[offset + --i] * mul;
              }
              mul *= 0x80;

              if (val >= mul) val -= Math.pow(2, 8 * byteLength);

              return val
            };

            Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 1, this.length);
              if (!(this[offset] & 0x80)) return (this[offset])
              return ((0xff - this[offset] + 1) * -1)
            };

            Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 2, this.length);
              var val = this[offset] | (this[offset + 1] << 8);
              return (val & 0x8000) ? val | 0xFFFF0000 : val
            };

            Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 2, this.length);
              var val = this[offset + 1] | (this[offset] << 8);
              return (val & 0x8000) ? val | 0xFFFF0000 : val
            };

            Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);

              return (this[offset]) |
                (this[offset + 1] << 8) |
                (this[offset + 2] << 16) |
                (this[offset + 3] << 24)
            };

            Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);

              return (this[offset] << 24) |
                (this[offset + 1] << 16) |
                (this[offset + 2] << 8) |
                (this[offset + 3])
            };

            Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);
              return read(this, offset, true, 23, 4)
            };

            Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 4, this.length);
              return read(this, offset, false, 23, 4)
            };

            Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 8, this.length);
              return read(this, offset, true, 52, 8)
            };

            Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
              if (!noAssert) checkOffset(offset, 8, this.length);
              return read(this, offset, false, 52, 8)
            };

            function checkInt (buf, value, offset, ext, max, min) {
              if (!internalIsBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
              if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
              if (offset + ext > buf.length) throw new RangeError('Index out of range')
            }

            Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
              value = +value;
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) {
                var maxBytes = Math.pow(2, 8 * byteLength) - 1;
                checkInt(this, value, offset, byteLength, maxBytes, 0);
              }

              var mul = 1;
              var i = 0;
              this[offset] = value & 0xFF;
              while (++i < byteLength && (mul *= 0x100)) {
                this[offset + i] = (value / mul) & 0xFF;
              }

              return offset + byteLength
            };

            Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
              value = +value;
              offset = offset | 0;
              byteLength = byteLength | 0;
              if (!noAssert) {
                var maxBytes = Math.pow(2, 8 * byteLength) - 1;
                checkInt(this, value, offset, byteLength, maxBytes, 0);
              }

              var i = byteLength - 1;
              var mul = 1;
              this[offset + i] = value & 0xFF;
              while (--i >= 0 && (mul *= 0x100)) {
                this[offset + i] = (value / mul) & 0xFF;
              }

              return offset + byteLength
            };

            Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0);
              if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
              this[offset] = (value & 0xff);
              return offset + 1
            };

            function objectWriteUInt16 (buf, value, offset, littleEndian) {
              if (value < 0) value = 0xffff + value + 1;
              for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; ++i) {
                buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
                  (littleEndian ? i : 1 - i) * 8;
              }
            }

            Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value & 0xff);
                this[offset + 1] = (value >>> 8);
              } else {
                objectWriteUInt16(this, value, offset, true);
              }
              return offset + 2
            };

            Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 8);
                this[offset + 1] = (value & 0xff);
              } else {
                objectWriteUInt16(this, value, offset, false);
              }
              return offset + 2
            };

            function objectWriteUInt32 (buf, value, offset, littleEndian) {
              if (value < 0) value = 0xffffffff + value + 1;
              for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; ++i) {
                buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff;
              }
            }

            Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset + 3] = (value >>> 24);
                this[offset + 2] = (value >>> 16);
                this[offset + 1] = (value >>> 8);
                this[offset] = (value & 0xff);
              } else {
                objectWriteUInt32(this, value, offset, true);
              }
              return offset + 4
            };

            Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 24);
                this[offset + 1] = (value >>> 16);
                this[offset + 2] = (value >>> 8);
                this[offset + 3] = (value & 0xff);
              } else {
                objectWriteUInt32(this, value, offset, false);
              }
              return offset + 4
            };

            Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) {
                var limit = Math.pow(2, 8 * byteLength - 1);

                checkInt(this, value, offset, byteLength, limit - 1, -limit);
              }

              var i = 0;
              var mul = 1;
              var sub = 0;
              this[offset] = value & 0xFF;
              while (++i < byteLength && (mul *= 0x100)) {
                if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
                  sub = 1;
                }
                this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
              }

              return offset + byteLength
            };

            Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) {
                var limit = Math.pow(2, 8 * byteLength - 1);

                checkInt(this, value, offset, byteLength, limit - 1, -limit);
              }

              var i = byteLength - 1;
              var mul = 1;
              var sub = 0;
              this[offset + i] = value & 0xFF;
              while (--i >= 0 && (mul *= 0x100)) {
                if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
                  sub = 1;
                }
                this[offset + i] = ((value / mul) >> 0) - sub & 0xFF;
              }

              return offset + byteLength
            };

            Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80);
              if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value);
              if (value < 0) value = 0xff + value + 1;
              this[offset] = (value & 0xff);
              return offset + 1
            };

            Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value & 0xff);
                this[offset + 1] = (value >>> 8);
              } else {
                objectWriteUInt16(this, value, offset, true);
              }
              return offset + 2
            };

            Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 8);
                this[offset + 1] = (value & 0xff);
              } else {
                objectWriteUInt16(this, value, offset, false);
              }
              return offset + 2
            };

            Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value & 0xff);
                this[offset + 1] = (value >>> 8);
                this[offset + 2] = (value >>> 16);
                this[offset + 3] = (value >>> 24);
              } else {
                objectWriteUInt32(this, value, offset, true);
              }
              return offset + 4
            };

            Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
              value = +value;
              offset = offset | 0;
              if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000);
              if (value < 0) value = 0xffffffff + value + 1;
              if (Buffer.TYPED_ARRAY_SUPPORT) {
                this[offset] = (value >>> 24);
                this[offset + 1] = (value >>> 16);
                this[offset + 2] = (value >>> 8);
                this[offset + 3] = (value & 0xff);
              } else {
                objectWriteUInt32(this, value, offset, false);
              }
              return offset + 4
            };

            function checkIEEE754 (buf, value, offset, ext, max, min) {
              if (offset + ext > buf.length) throw new RangeError('Index out of range')
              if (offset < 0) throw new RangeError('Index out of range')
            }

            function writeFloat (buf, value, offset, littleEndian, noAssert) {
              if (!noAssert) {
                checkIEEE754(buf, value, offset, 4);
              }
              write(buf, value, offset, littleEndian, 23, 4);
              return offset + 4
            }

            Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
              return writeFloat(this, value, offset, true, noAssert)
            };

            Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
              return writeFloat(this, value, offset, false, noAssert)
            };

            function writeDouble (buf, value, offset, littleEndian, noAssert) {
              if (!noAssert) {
                checkIEEE754(buf, value, offset, 8);
              }
              write(buf, value, offset, littleEndian, 52, 8);
              return offset + 8
            }

            Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
              return writeDouble(this, value, offset, true, noAssert)
            };

            Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
              return writeDouble(this, value, offset, false, noAssert)
            };

            // copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
            Buffer.prototype.copy = function copy (target, targetStart, start, end) {
              if (!start) start = 0;
              if (!end && end !== 0) end = this.length;
              if (targetStart >= target.length) targetStart = target.length;
              if (!targetStart) targetStart = 0;
              if (end > 0 && end < start) end = start;

              // Copy 0 bytes; we're done
              if (end === start) return 0
              if (target.length === 0 || this.length === 0) return 0

              // Fatal error conditions
              if (targetStart < 0) {
                throw new RangeError('targetStart out of bounds')
              }
              if (start < 0 || start >= this.length) throw new RangeError('sourceStart out of bounds')
              if (end < 0) throw new RangeError('sourceEnd out of bounds')

              // Are we oob?
              if (end > this.length) end = this.length;
              if (target.length - targetStart < end - start) {
                end = target.length - targetStart + start;
              }

              var len = end - start;
              var i;

              if (this === target && start < targetStart && targetStart < end) {
                // descending copy from end
                for (i = len - 1; i >= 0; --i) {
                  target[i + targetStart] = this[i + start];
                }
              } else if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
                // ascending copy from start
                for (i = 0; i < len; ++i) {
                  target[i + targetStart] = this[i + start];
                }
              } else {
                Uint8Array.prototype.set.call(
                  target,
                  this.subarray(start, start + len),
                  targetStart
                );
              }

              return len
            };

            // Usage:
            //    buffer.fill(number[, offset[, end]])
            //    buffer.fill(buffer[, offset[, end]])
            //    buffer.fill(string[, offset[, end]][, encoding])
            Buffer.prototype.fill = function fill (val, start, end, encoding) {
              // Handle string cases:
              if (typeof val === 'string') {
                if (typeof start === 'string') {
                  encoding = start;
                  start = 0;
                  end = this.length;
                } else if (typeof end === 'string') {
                  encoding = end;
                  end = this.length;
                }
                if (val.length === 1) {
                  var code = val.charCodeAt(0);
                  if (code < 256) {
                    val = code;
                  }
                }
                if (encoding !== undefined && typeof encoding !== 'string') {
                  throw new TypeError('encoding must be a string')
                }
                if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
                  throw new TypeError('Unknown encoding: ' + encoding)
                }
              } else if (typeof val === 'number') {
                val = val & 255;
              }

              // Invalid ranges are not set to a default, so can range check early.
              if (start < 0 || this.length < start || this.length < end) {
                throw new RangeError('Out of range index')
              }

              if (end <= start) {
                return this
              }

              start = start >>> 0;
              end = end === undefined ? this.length : end >>> 0;

              if (!val) val = 0;

              var i;
              if (typeof val === 'number') {
                for (i = start; i < end; ++i) {
                  this[i] = val;
                }
              } else {
                var bytes = internalIsBuffer(val)
                  ? val
                  : utf8ToBytes(new Buffer(val, encoding).toString());
                var len = bytes.length;
                for (i = 0; i < end - start; ++i) {
                  this[i + start] = bytes[i % len];
                }
              }

              return this
            };

            // HELPER FUNCTIONS
            // ================

            var INVALID_BASE64_RE = /[^+\/0-9A-Za-z-_]/g;

            function base64clean (str) {
              // Node strips out invalid characters like \n and \t from the string, base64-js does not
              str = stringtrim(str).replace(INVALID_BASE64_RE, '');
              // Node converts strings with length < 2 to ''
              if (str.length < 2) return ''
              // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
              while (str.length % 4 !== 0) {
                str = str + '=';
              }
              return str
            }

            function stringtrim (str) {
              if (str.trim) return str.trim()
              return str.replace(/^\s+|\s+$/g, '')
            }

            function toHex (n) {
              if (n < 16) return '0' + n.toString(16)
              return n.toString(16)
            }

            function utf8ToBytes (string, units) {
              units = units || Infinity;
              var codePoint;
              var length = string.length;
              var leadSurrogate = null;
              var bytes = [];

              for (var i = 0; i < length; ++i) {
                codePoint = string.charCodeAt(i);

                // is surrogate component
                if (codePoint > 0xD7FF && codePoint < 0xE000) {
                  // last char was a lead
                  if (!leadSurrogate) {
                    // no lead yet
                    if (codePoint > 0xDBFF) {
                      // unexpected trail
                      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                      continue
                    } else if (i + 1 === length) {
                      // unpaired lead
                      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                      continue
                    }

                    // valid lead
                    leadSurrogate = codePoint;

                    continue
                  }

                  // 2 leads in a row
                  if (codePoint < 0xDC00) {
                    if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                    leadSurrogate = codePoint;
                    continue
                  }

                  // valid surrogate pair
                  codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000;
                } else if (leadSurrogate) {
                  // valid bmp char, but last char was a lead
                  if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD);
                }

                leadSurrogate = null;

                // encode utf8
                if (codePoint < 0x80) {
                  if ((units -= 1) < 0) break
                  bytes.push(codePoint);
                } else if (codePoint < 0x800) {
                  if ((units -= 2) < 0) break
                  bytes.push(
                    codePoint >> 0x6 | 0xC0,
                    codePoint & 0x3F | 0x80
                  );
                } else if (codePoint < 0x10000) {
                  if ((units -= 3) < 0) break
                  bytes.push(
                    codePoint >> 0xC | 0xE0,
                    codePoint >> 0x6 & 0x3F | 0x80,
                    codePoint & 0x3F | 0x80
                  );
                } else if (codePoint < 0x110000) {
                  if ((units -= 4) < 0) break
                  bytes.push(
                    codePoint >> 0x12 | 0xF0,
                    codePoint >> 0xC & 0x3F | 0x80,
                    codePoint >> 0x6 & 0x3F | 0x80,
                    codePoint & 0x3F | 0x80
                  );
                } else {
                  throw new Error('Invalid code point')
                }
              }

              return bytes
            }

            function asciiToBytes (str) {
              var byteArray = [];
              for (var i = 0; i < str.length; ++i) {
                // Node's code seems to be doing this and not & 0x7F..
                byteArray.push(str.charCodeAt(i) & 0xFF);
              }
              return byteArray
            }

            function utf16leToBytes (str, units) {
              var c, hi, lo;
              var byteArray = [];
              for (var i = 0; i < str.length; ++i) {
                if ((units -= 2) < 0) break

                c = str.charCodeAt(i);
                hi = c >> 8;
                lo = c % 256;
                byteArray.push(lo);
                byteArray.push(hi);
              }

              return byteArray
            }


            function base64ToBytes (str) {
              return toByteArray(base64clean(str))
            }

            function blitBuffer (src, dst, offset, length) {
              for (var i = 0; i < length; ++i) {
                if ((i + offset >= dst.length) || (i >= src.length)) break
                dst[i + offset] = src[i];
              }
              return i
            }

            function isnan (val) {
              return val !== val // eslint-disable-line no-self-compare
            }


            // the following is from is-buffer, also by Feross Aboukhadijeh and with same lisence
            // The _isBuffer check is for Safari 5-7 support, because it's missing
            // Object.prototype.constructor. Remove this eventually
            function isBuffer(obj) {
              return obj != null && (!!obj._isBuffer || isFastBuffer(obj) || isSlowBuffer(obj))
            }

            function isFastBuffer (obj) {
              return !!obj.constructor && typeof obj.constructor.isBuffer === 'function' && obj.constructor.isBuffer(obj)
            }

            // For Node v0.10 support. Remove this eventually.
            function isSlowBuffer (obj) {
              return typeof obj.readFloatLE === 'function' && typeof obj.slice === 'function' && isFastBuffer(obj.slice(0, 0))
            }

            var zoid_frame = createCommonjsModule(function (module, exports) {
            (function webpackUniversalModuleDefinition(root, factory) {
            	module.exports = factory();
            })((typeof self !== 'undefined' ? self : commonjsGlobal), function() {
            return /******/ (function(modules) { // webpackBootstrap
            /******/ 	// The module cache
            /******/ 	var installedModules = {};
            /******/
            /******/ 	// The require function
            /******/ 	function __webpack_require__(moduleId) {
            /******/
            /******/ 		// Check if module is in cache
            /******/ 		if(installedModules[moduleId]) {
            /******/ 			return installedModules[moduleId].exports;
            /******/ 		}
            /******/ 		// Create a new module (and put it into the cache)
            /******/ 		var module = installedModules[moduleId] = {
            /******/ 			i: moduleId,
            /******/ 			l: false,
            /******/ 			exports: {}
            /******/ 		};
            /******/
            /******/ 		// Execute the module function
            /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
            /******/
            /******/ 		// Flag the module as loaded
            /******/ 		module.l = true;
            /******/
            /******/ 		// Return the exports of the module
            /******/ 		return module.exports;
            /******/ 	}
            /******/
            /******/
            /******/ 	// expose the modules object (__webpack_modules__)
            /******/ 	__webpack_require__.m = modules;
            /******/
            /******/ 	// expose the module cache
            /******/ 	__webpack_require__.c = installedModules;
            /******/
            /******/ 	// define getter function for harmony exports
            /******/ 	__webpack_require__.d = function(exports, name, getter) {
            /******/ 		if(!__webpack_require__.o(exports, name)) {
            /******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
            /******/ 		}
            /******/ 	};
            /******/
            /******/ 	// define __esModule on exports
            /******/ 	__webpack_require__.r = function(exports) {
            /******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
            /******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
            /******/ 		}
            /******/ 		Object.defineProperty(exports, '__esModule', { value: true });
            /******/ 	};
            /******/
            /******/ 	// create a fake namespace object
            /******/ 	// mode & 1: value is a module id, require it
            /******/ 	// mode & 2: merge all properties of value into the ns
            /******/ 	// mode & 4: return value when already ns object
            /******/ 	// mode & 8|1: behave like require
            /******/ 	__webpack_require__.t = function(value, mode) {
            /******/ 		if(mode & 1) value = __webpack_require__(value);
            /******/ 		if(mode & 8) return value;
            /******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
            /******/ 		var ns = Object.create(null);
            /******/ 		__webpack_require__.r(ns);
            /******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
            /******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
            /******/ 		return ns;
            /******/ 	};
            /******/
            /******/ 	// getDefaultExport function for compatibility with non-harmony modules
            /******/ 	__webpack_require__.n = function(module) {
            /******/ 		var getter = module && module.__esModule ?
            /******/ 			function getDefault() { return module['default']; } :
            /******/ 			function getModuleExports() { return module; };
            /******/ 		__webpack_require__.d(getter, 'a', getter);
            /******/ 		return getter;
            /******/ 	};
            /******/
            /******/ 	// Object.prototype.hasOwnProperty.call
            /******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
            /******/
            /******/ 	// __webpack_public_path__
            /******/ 	__webpack_require__.p = "";
            /******/
            /******/
            /******/ 	// Load entry module and return exports
            /******/ 	return __webpack_require__(__webpack_require__.s = 0);
            /******/ })
            /************************************************************************/
            /******/ ([
            /* 0 */
            /***/ (function(module, __webpack_exports__, __webpack_require__) {
            __webpack_require__.r(__webpack_exports__);
            // CONCATENATED MODULE: ./node_modules/@babel/runtime/helpers/esm/extends.js
            function _extends() {
              _extends = Object.assign || function (target) {
                for (var i = 1; i < arguments.length; i++) {
                  var source = arguments[i];

                  for (var key in source) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                      target[key] = source[key];
                    }
                  }
                }

                return target;
              };

              return _extends.apply(this, arguments);
            }
            // CONCATENATED MODULE: ./node_modules/zalgo-promise/src/utils.js
            function utils_isPromise(item) {
              try {
                if (!item) {
                  return false;
                }

                if (typeof Promise !== 'undefined' && item instanceof Promise) {
                  return true;
                }

                if (typeof window !== 'undefined' && typeof window.Window === 'function' && item instanceof window.Window) {
                  return false;
                }

                if (typeof window !== 'undefined' && typeof window.constructor === 'function' && item instanceof window.constructor) {
                  return false;
                }

                var _toString = {}.toString;

                if (_toString) {
                  var name = _toString.call(item);

                  if (name === '[object Window]' || name === '[object global]' || name === '[object DOMWindow]') {
                    return false;
                  }
                }

                if (typeof item.then === 'function') {
                  return true;
                }
              } catch (err) {
                return false;
              }

              return false;
            }
            // CONCATENATED MODULE: ./node_modules/zalgo-promise/src/exceptions.js
            var dispatchedErrors = [];
            var possiblyUnhandledPromiseHandlers = [];
            function dispatchPossiblyUnhandledError(err, promise) {
              if (dispatchedErrors.indexOf(err) !== -1) {
                return;
              }

              dispatchedErrors.push(err);
              setTimeout(function () {

                throw err;
              }, 1);

              for (var j = 0; j < possiblyUnhandledPromiseHandlers.length; j++) {
                // $FlowFixMe
                possiblyUnhandledPromiseHandlers[j](err, promise);
              }
            }
            function exceptions_onPossiblyUnhandledException(handler) {
              possiblyUnhandledPromiseHandlers.push(handler);
              return {
                cancel: function cancel() {
                  possiblyUnhandledPromiseHandlers.splice(possiblyUnhandledPromiseHandlers.indexOf(handler), 1);
                }
              };
            }
            // CONCATENATED MODULE: ./node_modules/zalgo-promise/src/flush.js
            var activeCount = 0;
            var flushPromise;

            function flushActive() {
              if (!activeCount && flushPromise) {
                var promise = flushPromise;
                flushPromise = null;
                promise.resolve();
              }
            }

            function startActive() {
              activeCount += 1;
            }
            function endActive() {
              activeCount -= 1;
              flushActive();
            }
            function awaitActive(Zalgo) {
              // eslint-disable-line no-undef
              var promise = flushPromise = flushPromise || new Zalgo();
              flushActive();
              return promise;
            }
            // CONCATENATED MODULE: ./node_modules/zalgo-promise/src/promise.js



            var promise_ZalgoPromise =
            /*#__PURE__*/
            function () {
              function ZalgoPromise(handler) {
                var _this = this;

                this.resolved = void 0;
                this.rejected = void 0;
                this.errorHandled = void 0;
                this.value = void 0;
                this.error = void 0;
                this.handlers = void 0;
                this.dispatching = void 0;
                this.stack = void 0;
                this.resolved = false;
                this.rejected = false;
                this.errorHandled = false;
                this.handlers = [];

                if (handler) {
                  var _result;

                  var _error;

                  var resolved = false;
                  var rejected = false;
                  var isAsync = false;
                  startActive();

                  try {
                    handler(function (res) {
                      if (isAsync) {
                        _this.resolve(res);
                      } else {
                        resolved = true;
                        _result = res;
                      }
                    }, function (err) {
                      if (isAsync) {
                        _this.reject(err);
                      } else {
                        rejected = true;
                        _error = err;
                      }
                    });
                  } catch (err) {
                    endActive();
                    this.reject(err);
                    return;
                  }

                  endActive();
                  isAsync = true;

                  if (resolved) {
                    // $FlowFixMe
                    this.resolve(_result);
                  } else if (rejected) {
                    this.reject(_error);
                  }
                }
              }

              var _proto = ZalgoPromise.prototype;

              _proto.resolve = function resolve(result) {
                if (this.resolved || this.rejected) {
                  return this;
                }

                if (utils_isPromise(result)) {
                  throw new Error('Can not resolve promise with another promise');
                }

                this.resolved = true;
                this.value = result;
                this.dispatch();
                return this;
              };

              _proto.reject = function reject(error) {
                var _this2 = this;

                if (this.resolved || this.rejected) {
                  return this;
                }

                if (utils_isPromise(error)) {
                  throw new Error('Can not reject promise with another promise');
                }

                if (!error) {
                  // $FlowFixMe
                  var _err = error && typeof error.toString === 'function' ? error.toString() : Object.prototype.toString.call(error);

                  error = new Error("Expected reject to be called with Error, got " + _err);
                }

                this.rejected = true;
                this.error = error;

                if (!this.errorHandled) {
                  setTimeout(function () {
                    if (!_this2.errorHandled) {
                      dispatchPossiblyUnhandledError(error, _this2);
                    }
                  }, 1);
                }

                this.dispatch();
                return this;
              };

              _proto.asyncReject = function asyncReject(error) {
                this.errorHandled = true;
                this.reject(error);
                return this;
              };

              _proto.dispatch = function dispatch() {
                var dispatching = this.dispatching,
                    resolved = this.resolved,
                    rejected = this.rejected,
                    handlers = this.handlers;

                if (dispatching) {
                  return;
                }

                if (!resolved && !rejected) {
                  return;
                }

                this.dispatching = true;
                startActive();

                var chain = function chain(firstPromise, secondPromise) {
                  return firstPromise.then(function (res) {
                    secondPromise.resolve(res);
                  }, function (err) {
                    secondPromise.reject(err);
                  });
                };

                for (var i = 0; i < handlers.length; i++) {
                  var _handlers$i = handlers[i],
                      onSuccess = _handlers$i.onSuccess,
                      onError = _handlers$i.onError,
                      promise = _handlers$i.promise;

                  var _result2 = void 0;

                  if (resolved) {
                    try {
                      _result2 = onSuccess ? onSuccess(this.value) : this.value;
                    } catch (err) {
                      promise.reject(err);
                      continue;
                    }
                  } else if (rejected) {
                    if (!onError) {
                      promise.reject(this.error);
                      continue;
                    }

                    try {
                      _result2 = onError(this.error);
                    } catch (err) {
                      promise.reject(err);
                      continue;
                    }
                  }

                  if (_result2 instanceof ZalgoPromise && (_result2.resolved || _result2.rejected)) {
                    if (_result2.resolved) {
                      promise.resolve(_result2.value);
                    } else {
                      promise.reject(_result2.error);
                    }

                    _result2.errorHandled = true;
                  } else if (utils_isPromise(_result2)) {
                    if (_result2 instanceof ZalgoPromise && (_result2.resolved || _result2.rejected)) {
                      if (_result2.resolved) {
                        promise.resolve(_result2.value);
                      } else {
                        promise.reject(_result2.error);
                      }
                    } else {
                      // $FlowFixMe
                      chain(_result2, promise);
                    }
                  } else {
                    promise.resolve(_result2);
                  }
                }

                handlers.length = 0;
                this.dispatching = false;
                endActive();
              };

              _proto.then = function then(onSuccess, onError) {
                if (onSuccess && typeof onSuccess !== 'function' && !onSuccess.call) {
                  throw new Error('Promise.then expected a function for success handler');
                }

                if (onError && typeof onError !== 'function' && !onError.call) {
                  throw new Error('Promise.then expected a function for error handler');
                }

                var promise = new ZalgoPromise();
                this.handlers.push({
                  promise: promise,
                  onSuccess: onSuccess,
                  onError: onError
                });
                this.errorHandled = true;
                this.dispatch();
                return promise;
              };

              _proto.catch = function _catch(onError) {
                return this.then(undefined, onError);
              };

              _proto.finally = function _finally(onFinally) {
                if (onFinally && typeof onFinally !== 'function' && !onFinally.call) {
                  throw new Error('Promise.finally expected a function');
                }

                return this.then(function (result) {
                  return ZalgoPromise.try(onFinally).then(function () {
                    return result;
                  });
                }, function (err) {
                  return ZalgoPromise.try(onFinally).then(function () {
                    throw err;
                  });
                });
              };

              _proto.timeout = function timeout(time, err) {
                var _this3 = this;

                if (this.resolved || this.rejected) {
                  return this;
                }

                var timeout = setTimeout(function () {
                  if (_this3.resolved || _this3.rejected) {
                    return;
                  }

                  _this3.reject(err || new Error("Promise timed out after " + time + "ms"));
                }, time);
                return this.then(function (result) {
                  clearTimeout(timeout);
                  return result;
                });
              } // $FlowFixMe
              ;

              _proto.toPromise = function toPromise() {
                // $FlowFixMe
                if (typeof Promise === 'undefined') {
                  throw new TypeError("Could not find Promise");
                } // $FlowFixMe


                return Promise.resolve(this); // eslint-disable-line compat/compat
              };

              ZalgoPromise.resolve = function resolve(value) {
                if (value instanceof ZalgoPromise) {
                  return value;
                }

                if (utils_isPromise(value)) {
                  // $FlowFixMe
                  return new ZalgoPromise(function (resolve, reject) {
                    return value.then(resolve, reject);
                  });
                }

                return new ZalgoPromise().resolve(value);
              };

              ZalgoPromise.reject = function reject(error) {
                return new ZalgoPromise().reject(error);
              };

              ZalgoPromise.asyncReject = function asyncReject(error) {
                return new ZalgoPromise().asyncReject(error);
              };

              ZalgoPromise.all = function all(promises) {
                // eslint-disable-line no-undef
                var promise = new ZalgoPromise();
                var count = promises.length;
                var results = [];

                if (!count) {
                  promise.resolve(results);
                  return promise;
                }

                var chain = function chain(i, firstPromise, secondPromise) {
                  return firstPromise.then(function (res) {
                    results[i] = res;
                    count -= 1;

                    if (count === 0) {
                      promise.resolve(results);
                    }
                  }, function (err) {
                    secondPromise.reject(err);
                  });
                };

                for (var i = 0; i < promises.length; i++) {
                  var prom = promises[i];

                  if (prom instanceof ZalgoPromise) {
                    if (prom.resolved) {
                      results[i] = prom.value;
                      count -= 1;
                      continue;
                    }
                  } else if (!utils_isPromise(prom)) {
                    results[i] = prom;
                    count -= 1;
                    continue;
                  }

                  chain(i, ZalgoPromise.resolve(prom), promise);
                }

                if (count === 0) {
                  promise.resolve(results);
                }

                return promise;
              };

              ZalgoPromise.hash = function hash(promises) {
                // eslint-disable-line no-undef
                var result = {};
                return ZalgoPromise.all(Object.keys(promises).map(function (key) {
                  return ZalgoPromise.resolve(promises[key]).then(function (value) {
                    result[key] = value;
                  });
                })).then(function () {
                  return result;
                });
              };

              ZalgoPromise.map = function map(items, method) {
                // $FlowFixMe
                return ZalgoPromise.all(items.map(method));
              };

              ZalgoPromise.onPossiblyUnhandledException = function onPossiblyUnhandledException(handler) {
                return exceptions_onPossiblyUnhandledException(handler);
              };

              ZalgoPromise.try = function _try(method, context, args) {
                if (method && typeof method !== 'function' && !method.call) {
                  throw new Error('Promise.try expected a function');
                }

                var result;
                startActive();

                try {
                  // $FlowFixMe
                  result = method.apply(context, args || []);
                } catch (err) {
                  endActive();
                  return ZalgoPromise.reject(err);
                }

                endActive();
                return ZalgoPromise.resolve(result);
              };

              ZalgoPromise.delay = function delay(_delay) {
                return new ZalgoPromise(function (resolve) {
                  setTimeout(resolve, _delay);
                });
              };

              ZalgoPromise.isPromise = function isPromise(value) {
                if (value && value instanceof ZalgoPromise) {
                  return true;
                }

                return utils_isPromise(value);
              };

              ZalgoPromise.flush = function flush() {
                return awaitActive(ZalgoPromise);
              };

              return ZalgoPromise;
            }();
            // CONCATENATED MODULE: ./node_modules/zalgo-promise/src/index.js

            // CONCATENATED MODULE: ./node_modules/cross-domain-utils/src/util.js
            function isRegex(item) {
              return Object.prototype.toString.call(item) === '[object RegExp]';
            } // eslint-disable-next-line no-unused-vars

            function noop() {// pass
            }
            // CONCATENATED MODULE: ./node_modules/cross-domain-utils/src/constants.js
            var PROTOCOL = {
              MOCK: 'mock:',
              FILE: 'file:',
              ABOUT: 'about:'
            };
            var WILDCARD = '*';
            var WINDOW_TYPE = {
              IFRAME: 'iframe',
              POPUP: 'popup'
            };
            // CONCATENATED MODULE: ./node_modules/cross-domain-utils/src/utils.js
            /* eslint max-lines: 0 */


            var IE_WIN_ACCESS_ERROR = 'Call was rejected by callee.\r\n';
            function isAboutProtocol(win) {
              if (win === void 0) {
                win = window;
              }

              return win.location.protocol === PROTOCOL.ABOUT;
            }
            function getParent(win) {
              if (win === void 0) {
                win = window;
              }

              if (!win) {
                return;
              }

              try {
                if (win.parent && win.parent !== win) {
                  return win.parent;
                }
              } catch (err) {// pass
              }
            }
            function getOpener(win) {
              if (win === void 0) {
                win = window;
              }

              if (!win) {
                return;
              } // Make sure we're not actually an iframe which has had window.open() called on us


              if (getParent(win)) {
                return;
              }

              try {
                return win.opener;
              } catch (err) {// pass
              }
            }
            function canReadFromWindow(win) {
              try {
                // $FlowFixMe
                noop(win && win.location && win.location.href);
                return true;
              } catch (err) {// pass
              }

              return false;
            }
            function getActualDomain(win) {
              if (win === void 0) {
                win = window;
              }

              var location = win.location;

              if (!location) {
                throw new Error("Can not read window location");
              }

              var protocol = location.protocol;

              if (!protocol) {
                throw new Error("Can not read window protocol");
              }

              if (protocol === PROTOCOL.FILE) {
                return PROTOCOL.FILE + "//";
              }

              if (protocol === PROTOCOL.ABOUT) {
                var parent = getParent(win);

                if (parent && canReadFromWindow(parent)) {
                  // $FlowFixMe
                  return getActualDomain(parent);
                }

                return PROTOCOL.ABOUT + "//";
              }

              var host = location.host;

              if (!host) {
                throw new Error("Can not read window host");
              }

              return protocol + "//" + host;
            }
            function utils_getDomain(win) {
              if (win === void 0) {
                win = window;
              }

              var domain = getActualDomain(win);

              if (domain && win.mockDomain && win.mockDomain.indexOf(PROTOCOL.MOCK) === 0) {
                return win.mockDomain;
              }

              return domain;
            }
            function isBlankDomain(win) {
              try {
                // $FlowFixMe
                if (!win.location.href) {
                  return true;
                }

                if (win.location.href === 'about:blank') {
                  return true;
                }
              } catch (err) {// pass
              }

              return false;
            }
            function isActuallySameDomain(win) {
              try {
                if (win === window) {
                  return true;
                }
              } catch (err) {// pass
              }

              try {
                var desc = Object.getOwnPropertyDescriptor(win, 'location');

                if (desc && desc.enumerable === false) {
                  return false;
                }
              } catch (err) {// pass
              }

              try {
                // $FlowFixMe
                if (isAboutProtocol(win) && canReadFromWindow(win)) {
                  return true;
                }
              } catch (err) {// pass
              }

              try {
                // $FlowFixMe
                if (getActualDomain(win) === getActualDomain(window)) {
                  return true;
                }
              } catch (err) {// pass
              }

              return false;
            }
            function isSameDomain(win) {
              if (!isActuallySameDomain(win)) {
                return false;
              }

              try {
                if (win === window) {
                  return true;
                } // $FlowFixMe


                if (isAboutProtocol(win) && canReadFromWindow(win)) {
                  return true;
                } // $FlowFixMe


                if (utils_getDomain(window) === utils_getDomain(win)) {
                  return true;
                }
              } catch (err) {// pass
              }

              return false;
            }
            function assertSameDomain(win) {
              if (!isSameDomain(win)) {
                throw new Error("Expected window to be same domain");
              } // $FlowFixMe


              return win;
            }
            function getParents(win) {
              var result = [];

              try {
                while (win.parent !== win) {
                  result.push(win.parent);
                  win = win.parent;
                }
              } catch (err) {// pass
              }

              return result;
            }
            function isAncestorParent(parent, child) {
              if (!parent || !child) {
                return false;
              }

              var childParent = getParent(child);

              if (childParent) {
                return childParent === parent;
              }

              if (getParents(child).indexOf(parent) !== -1) {
                return true;
              }

              return false;
            }
            function getFrames(win) {
              var result = [];
              var frames;

              try {
                frames = win.frames;
              } catch (err) {
                frames = win;
              }

              var len;

              try {
                len = frames.length;
              } catch (err) {// pass
              }

              if (len === 0) {
                return result;
              }

              if (len) {
                for (var i = 0; i < len; i++) {
                  var frame = void 0;

                  try {
                    frame = frames[i];
                  } catch (err) {
                    continue;
                  }

                  result.push(frame);
                }

                return result;
              }

              for (var _i = 0; _i < 100; _i++) {
                var _frame = void 0;

                try {
                  _frame = frames[_i];
                } catch (err) {
                  return result;
                }

                if (!_frame) {
                  return result;
                }

                result.push(_frame);
              }

              return result;
            }
            function getAllChildFrames(win) {
              var result = [];

              for (var _i3 = 0, _getFrames2 = getFrames(win); _i3 < _getFrames2.length; _i3++) {
                var frame = _getFrames2[_i3];
                result.push(frame);

                for (var _i5 = 0, _getAllChildFrames2 = getAllChildFrames(frame); _i5 < _getAllChildFrames2.length; _i5++) {
                  var childFrame = _getAllChildFrames2[_i5];
                  result.push(childFrame);
                }
              }

              return result;
            }
            function getTop(win) {
              if (win === void 0) {
                win = window;
              }

              try {
                if (win.top) {
                  return win.top;
                }
              } catch (err) {// pass
              }

              if (getParent(win) === win) {
                return win;
              }

              try {
                if (isAncestorParent(window, win) && window.top) {
                  return window.top;
                }
              } catch (err) {// pass
              }

              try {
                if (isAncestorParent(win, window) && window.top) {
                  return window.top;
                }
              } catch (err) {// pass
              }

              for (var _i7 = 0, _getAllChildFrames4 = getAllChildFrames(win); _i7 < _getAllChildFrames4.length; _i7++) {
                var frame = _getAllChildFrames4[_i7];

                try {
                  if (frame.top) {
                    return frame.top;
                  }
                } catch (err) {// pass
                }

                if (getParent(frame) === frame) {
                  return frame;
                }
              }
            }
            function getAllFramesInWindow(win) {
              var top = getTop(win);

              if (!top) {
                throw new Error("Can not determine top window");
              }

              return [].concat(getAllChildFrames(top), [top]);
            }
            function isFrameWindowClosed(frame) {
              if (!frame.contentWindow) {
                return true;
              }

              if (!frame.parentNode) {
                return true;
              }

              var doc = frame.ownerDocument;

              if (doc && doc.documentElement && !doc.documentElement.contains(frame)) {
                return true;
              }

              return false;
            }

            function safeIndexOf(collection, item) {
              for (var i = 0; i < collection.length; i++) {
                try {
                  if (collection[i] === item) {
                    return i;
                  }
                } catch (err) {// pass
                }
              }

              return -1;
            }

            var iframeWindows = [];
            var iframeFrames = [];
            function isWindowClosed(win, allowMock) {
              if (allowMock === void 0) {
                allowMock = true;
              }

              try {
                if (win === window) {
                  return false;
                }
              } catch (err) {
                return true;
              }

              try {
                if (!win) {
                  return true;
                }
              } catch (err) {
                return true;
              }

              try {
                if (win.closed) {
                  return true;
                }
              } catch (err) {
                // I love you so much IE
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return false;
                }

                return true;
              }

              if (allowMock && isSameDomain(win)) {
                try {
                  // $FlowFixMe
                  if (win.mockclosed) {
                    return true;
                  }
                } catch (err) {// pass
                }
              } // Mobile safari


              try {
                if (!win.parent || !win.top) {
                  return true;
                }
              } catch (err) {} // pass
              // Yes, this actually happens in IE. win === win errors out when the window
              // is from an iframe, and the iframe was removed from the page.


              try {
                noop(win === win); // eslint-disable-line no-self-compare
              } catch (err) {
                return true;
              } // IE orphaned frame


              var iframeIndex = safeIndexOf(iframeWindows, win);

              if (iframeIndex !== -1) {
                var frame = iframeFrames[iframeIndex];

                if (frame && isFrameWindowClosed(frame)) {
                  return true;
                }
              }

              return false;
            }

            function cleanIframes() {
              for (var i = 0; i < iframeWindows.length; i++) {
                var closed = false;

                try {
                  closed = iframeWindows[i].closed;
                } catch (err) {// pass
                }

                if (closed) {
                  iframeFrames.splice(i, 1);
                  iframeWindows.splice(i, 1);
                }
              }
            }

            function linkFrameWindow(frame) {
              cleanIframes();

              if (frame && frame.contentWindow) {
                try {
                  iframeWindows.push(frame.contentWindow);
                  iframeFrames.push(frame);
                } catch (err) {// pass
                }
              }
            }
            function utils_getUserAgent(win) {
              win = win || window;
              return win.navigator.mockUserAgent || win.navigator.userAgent;
            }
            function getAncestor(win) {
              if (win === void 0) {
                win = window;
              }

              win = win || window;
              var opener = getOpener(win);

              if (opener) {
                return opener;
              }

              var parent = getParent(win);

              if (parent) {
                return parent;
              }
            }
            function isAncestor(parent, child) {
              var actualParent = getAncestor(child);

              if (actualParent) {
                if (actualParent === parent) {
                  return true;
                }

                return false;
              }

              if (child === parent) {
                return false;
              }

              if (getTop(child) === child) {
                return false;
              }

              for (var _i15 = 0, _getFrames8 = getFrames(parent); _i15 < _getFrames8.length; _i15++) {
                var frame = _getFrames8[_i15];

                if (frame === child) {
                  return true;
                }
              }

              return false;
            }

            function anyMatch(collection1, collection2) {
              for (var _i17 = 0; _i17 < collection1.length; _i17++) {
                var item1 = collection1[_i17];

                for (var _i19 = 0; _i19 < collection2.length; _i19++) {
                  var item2 = collection2[_i19];

                  if (item1 === item2) {
                    return true;
                  }
                }
              }

              return false;
            }

            function getDistanceFromTop(win) {
              if (win === void 0) {
                win = window;
              }

              var distance = 0;
              var parent = win;

              while (parent) {
                parent = getParent(parent);

                if (parent) {
                  distance += 1;
                }
              }

              return distance;
            }
            function getNthParent(win, n) {
              if (n === void 0) {
                n = 1;
              }

              var parent = win;

              for (var i = 0; i < n; i++) {
                if (!parent) {
                  return;
                }

                parent = getParent(parent);
              }

              return parent;
            }
            function getNthParentFromTop(win, n) {
              if (n === void 0) {
                n = 1;
              }

              return getNthParent(win, getDistanceFromTop(win) - n);
            }
            function isSameTopWindow(win1, win2) {
              var top1 = getTop(win1) || win1;
              var top2 = getTop(win2) || win2;

              try {
                if (top1 && top2) {
                  if (top1 === top2) {
                    return true;
                  }

                  return false;
                }
              } catch (err) {// pass
              }

              var allFrames1 = getAllFramesInWindow(win1);
              var allFrames2 = getAllFramesInWindow(win2);

              if (anyMatch(allFrames1, allFrames2)) {
                return true;
              }

              var opener1 = getOpener(top1);
              var opener2 = getOpener(top2);

              if (opener1 && anyMatch(getAllFramesInWindow(opener1), allFrames2)) {
                return false;
              }

              if (opener2 && anyMatch(getAllFramesInWindow(opener2), allFrames1)) {
                return false;
              }

              return false;
            }
            function matchDomain(pattern, origin) {
              if (typeof pattern === 'string') {
                if (typeof origin === 'string') {
                  return pattern === WILDCARD || origin === pattern;
                }

                if (isRegex(origin)) {
                  return false;
                }

                if (Array.isArray(origin)) {
                  return false;
                }
              }

              if (isRegex(pattern)) {
                if (isRegex(origin)) {
                  return pattern.toString() === origin.toString();
                }

                if (Array.isArray(origin)) {
                  return false;
                } // $FlowFixMe


                return Boolean(origin.match(pattern));
              }

              if (Array.isArray(pattern)) {
                if (Array.isArray(origin)) {
                  return JSON.stringify(pattern) === JSON.stringify(origin);
                }

                if (isRegex(origin)) {
                  return false;
                }

                return pattern.some(function (subpattern) {
                  return matchDomain(subpattern, origin);
                });
              }

              return false;
            }
            function stringifyDomainPattern(pattern) {
              if (Array.isArray(pattern)) {
                return "(" + pattern.join(' | ') + ")";
              } else if (isRegex(pattern)) {
                return "RegExp(" + pattern.toString();
              } else {
                return pattern.toString();
              }
            }
            function getDomainFromUrl(url) {
              var domain;

              if (url.match(/^(https?|mock|file):\/\//)) {
                domain = url;
              } else {
                return utils_getDomain();
              }

              domain = domain.split('/').slice(0, 3).join('/');
              return domain;
            }
            function onCloseWindow(win, callback, delay, maxtime) {
              if (delay === void 0) {
                delay = 1000;
              }

              if (maxtime === void 0) {
                maxtime = Infinity;
              }

              var timeout;

              var check = function check() {
                if (isWindowClosed(win)) {
                  if (timeout) {
                    clearTimeout(timeout);
                  }

                  return callback();
                }

                if (maxtime <= 0) {
                  clearTimeout(timeout);
                } else {
                  maxtime -= delay;
                  timeout = setTimeout(check, delay);
                }
              };

              check();
              return {
                cancel: function cancel() {
                  if (timeout) {
                    clearTimeout(timeout);
                  }
                }
              };
            } // eslint-disable-next-line complexity

            function isWindow(obj) {
              try {
                if (obj === window) {
                  return true;
                }
              } catch (err) {
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return true;
                }
              }

              try {
                if (Object.prototype.toString.call(obj) === '[object Window]') {
                  return true;
                }
              } catch (err) {
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return true;
                }
              }

              try {
                if (window.Window && obj instanceof window.Window) {
                  return true;
                }
              } catch (err) {
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return true;
                }
              }

              try {
                if (obj && obj.self === obj) {
                  return true;
                }
              } catch (err) {
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return true;
                }
              }

              try {
                if (obj && obj.parent === obj) {
                  return true;
                }
              } catch (err) {
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return true;
                }
              }

              try {
                if (obj && obj.top === obj) {
                  return true;
                }
              } catch (err) {
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return true;
                }
              }

              try {
                if (noop(obj === obj) === '__unlikely_value__') {
                  // eslint-disable-line no-self-compare
                  return false;
                }
              } catch (err) {
                return true;
              }

              try {
                if (obj && obj.__cross_domain_utils_window_check__ === '__unlikely_value__') {
                  return false;
                }
              } catch (err) {
                return true;
              }

              return false;
            }
            function isMockDomain(domain) {
              return domain.indexOf(PROTOCOL.MOCK) === 0;
            }
            function normalizeMockUrl(url) {
              if (!isMockDomain(getDomainFromUrl(url))) {
                return url;
              }

              {
                throw new Error("Mock urls not supported out of test mode");
              }
            }
            function closeWindow(win) {
              try {
                win.close();
              } catch (err) {// pass
              }
            }
            function getFrameForWindow(win) {
              if (isSameDomain(win)) {
                return assertSameDomain(win).frameElement;
              }

              for (var _i21 = 0, _document$querySelect2 = document.querySelectorAll('iframe'); _i21 < _document$querySelect2.length; _i21++) {
                var frame = _document$querySelect2[_i21];

                if (frame && frame.contentWindow && frame.contentWindow === win) {
                  return frame;
                }
              }
            }
            // CONCATENATED MODULE: ./node_modules/cross-domain-utils/src/index.js



            // CONCATENATED MODULE: ./node_modules/cross-domain-safe-weakmap/src/native.js
            function hasNativeWeakMap() {
              if (typeof WeakMap === 'undefined') {
                return false;
              }

              if (typeof Object.freeze === 'undefined') {
                return false;
              }

              try {
                var testWeakMap = new WeakMap();
                var testKey = {};
                var testValue = '__testvalue__';
                Object.freeze(testKey);
                testWeakMap.set(testKey, testValue);

                if (testWeakMap.get(testKey) === testValue) {
                  return true;
                }

                return false;
              } catch (err) {
                return false;
              }
            }
            // CONCATENATED MODULE: ./node_modules/cross-domain-safe-weakmap/src/util.js
            function util_safeIndexOf(collection, item) {
              for (var i = 0; i < collection.length; i++) {
                try {
                  if (collection[i] === item) {
                    return i;
                  }
                } catch (err) {// pass
                }
              }

              return -1;
            } // eslint-disable-next-line no-unused-vars

            function util_noop() {// pass
            }
            // CONCATENATED MODULE: ./node_modules/cross-domain-safe-weakmap/src/weakmap.js



            var weakmap_CrossDomainSafeWeakMap =
            /*#__PURE__*/
            function () {
              function CrossDomainSafeWeakMap() {
                this.name = void 0;
                this.weakmap = void 0;
                this.keys = void 0;
                this.values = void 0;
                // eslint-disable-next-line no-bitwise
                this.name = "__weakmap_" + (Math.random() * 1e9 >>> 0) + "__";

                if (hasNativeWeakMap()) {
                  try {
                    this.weakmap = new WeakMap();
                  } catch (err) {// pass
                  }
                }

                this.keys = [];
                this.values = [];
              }

              var _proto = CrossDomainSafeWeakMap.prototype;

              _proto._cleanupClosedWindows = function _cleanupClosedWindows() {
                var weakmap = this.weakmap;
                var keys = this.keys;

                for (var i = 0; i < keys.length; i++) {
                  var value = keys[i];

                  if (isWindow(value) && isWindowClosed(value)) {
                    if (weakmap) {
                      try {
                        weakmap.delete(value);
                      } catch (err) {// pass
                      }
                    }

                    keys.splice(i, 1);
                    this.values.splice(i, 1);
                    i -= 1;
                  }
                }
              };

              _proto.isSafeToReadWrite = function isSafeToReadWrite(key) {
                if (isWindow(key)) {
                  return false;
                }

                try {
                  util_noop(key && key.self);
                  util_noop(key && key[this.name]);
                } catch (err) {
                  return false;
                }

                return true;
              };

              _proto.set = function set(key, value) {
                if (!key) {
                  throw new Error("WeakMap expected key");
                }

                var weakmap = this.weakmap;

                if (weakmap) {
                  try {
                    weakmap.set(key, value);
                  } catch (err) {
                    delete this.weakmap;
                  }
                }

                if (this.isSafeToReadWrite(key)) {
                  try {
                    var name = this.name;
                    var entry = key[name];

                    if (entry && entry[0] === key) {
                      entry[1] = value;
                    } else {
                      Object.defineProperty(key, name, {
                        value: [key, value],
                        writable: true
                      });
                    }

                    return;
                  } catch (err) {// pass
                  }
                }

                this._cleanupClosedWindows();

                var keys = this.keys;
                var values = this.values;
                var index = util_safeIndexOf(keys, key);

                if (index === -1) {
                  keys.push(key);
                  values.push(value);
                } else {
                  values[index] = value;
                }
              };

              _proto.get = function get(key) {
                if (!key) {
                  throw new Error("WeakMap expected key");
                }

                var weakmap = this.weakmap;

                if (weakmap) {
                  try {
                    if (weakmap.has(key)) {
                      return weakmap.get(key);
                    }
                  } catch (err) {
                    delete this.weakmap;
                  }
                }

                if (this.isSafeToReadWrite(key)) {
                  try {
                    var entry = key[this.name];

                    if (entry && entry[0] === key) {
                      return entry[1];
                    }

                    return;
                  } catch (err) {// pass
                  }
                }

                this._cleanupClosedWindows();

                var keys = this.keys;
                var index = util_safeIndexOf(keys, key);

                if (index === -1) {
                  return;
                }

                return this.values[index];
              };

              _proto.delete = function _delete(key) {
                if (!key) {
                  throw new Error("WeakMap expected key");
                }

                var weakmap = this.weakmap;

                if (weakmap) {
                  try {
                    weakmap.delete(key);
                  } catch (err) {
                    delete this.weakmap;
                  }
                }

                if (this.isSafeToReadWrite(key)) {
                  try {
                    var entry = key[this.name];

                    if (entry && entry[0] === key) {
                      entry[0] = entry[1] = undefined;
                    }
                  } catch (err) {// pass
                  }
                }

                this._cleanupClosedWindows();

                var keys = this.keys;
                var index = util_safeIndexOf(keys, key);

                if (index !== -1) {
                  keys.splice(index, 1);
                  this.values.splice(index, 1);
                }
              };

              _proto.has = function has(key) {
                if (!key) {
                  throw new Error("WeakMap expected key");
                }

                var weakmap = this.weakmap;

                if (weakmap) {
                  try {
                    if (weakmap.has(key)) {
                      return true;
                    }
                  } catch (err) {
                    delete this.weakmap;
                  }
                }

                if (this.isSafeToReadWrite(key)) {
                  try {
                    var entry = key[this.name];

                    if (entry && entry[0] === key) {
                      return true;
                    }

                    return false;
                  } catch (err) {// pass
                  }
                }

                this._cleanupClosedWindows();

                var index = util_safeIndexOf(this.keys, key);
                return index !== -1;
              };

              _proto.getOrSet = function getOrSet(key, getter) {
                if (this.has(key)) {
                  // $FlowFixMe
                  return this.get(key);
                }

                var value = getter();
                this.set(key, value);
                return value;
              };

              return CrossDomainSafeWeakMap;
            }();
            // CONCATENATED MODULE: ./node_modules/cross-domain-safe-weakmap/src/index.js

            // CONCATENATED MODULE: ./node_modules/belter/src/util.js
            /* eslint max-lines: 0 */


            function getFunctionName(fn) {
              return fn.name || fn.__name__ || fn.displayName || 'anonymous';
            }
            function setFunctionName(fn, name) {
              try {
                delete fn.name;
                fn.name = name;
              } catch (err) {// pass
              }

              fn.__name__ = fn.displayName = name;
              return fn;
            }
            function base64encode(str) {
              if (typeof btoa === 'function') {
                return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (m, p1) {
                  return String.fromCharCode(parseInt(p1, 16));
                }));
              }

              if (typeof Buffer !== 'undefined') {
                return Buffer.from(str, 'utf8').toString('base64');
              }

              throw new Error("Can not find window.btoa or Buffer");
            }
            function base64decode(str) {
              if (typeof atob === 'function') {
                return decodeURIComponent(Array.prototype.map.call(atob(str), function (c) {
                  // eslint-disable-next-line prefer-template
                  return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
              }

              if (typeof Buffer !== 'undefined') {
                return Buffer.from(str, 'base64').toString('utf8');
              }

              throw new Error("Can not find window.atob or Buffer");
            }
            function uniqueID() {
              var chars = '0123456789abcdef';
              var randomID = 'xxxxxxxxxx'.replace(/./g, function () {
                return chars.charAt(Math.floor(Math.random() * chars.length));
              });
              var timeID = base64encode(new Date().toISOString().slice(11, 19).replace('T', '.')).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              return randomID + "_" + timeID;
            }
            var objectIDs;
            function getObjectID(obj) {
              objectIDs = objectIDs || new weakmap_CrossDomainSafeWeakMap();

              if (obj === null || obj === undefined || typeof obj !== 'object' && typeof obj !== 'function') {
                throw new Error("Invalid object");
              }

              var uid = objectIDs.get(obj);

              if (!uid) {
                uid = typeof obj + ":" + uniqueID();
                objectIDs.set(obj, uid);
              }

              return uid;
            }

            function serializeArgs(args) {
              try {
                return JSON.stringify(Array.prototype.slice.call(args), function (subkey, val) {
                  if (typeof val === 'function') {
                    return "memoize[" + getObjectID(val) + "]";
                  }

                  return val;
                });
              } catch (err) {
                throw new Error("Arguments not serializable -- can not be used to memoize");
              }
            }

            function memoizePromise(method) {
              var cache = {}; // eslint-disable-next-line flowtype/no-weak-types

              function memoizedPromiseFunction() {
                var _arguments = arguments,
                    _this2 = this;

                for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                  args[_key2] = arguments[_key2];
                }

                var key = serializeArgs(args);

                if (cache.hasOwnProperty(key)) {
                  return cache[key];
                }

                cache[key] = promise_ZalgoPromise.try(function () {
                  return method.apply(_this2, _arguments);
                }).finally(function () {
                  delete cache[key];
                });
                return cache[key];
              }

              memoizedPromiseFunction.reset = function () {
                cache = {};
              };

              return setFunctionName(memoizedPromiseFunction, getFunctionName(method) + "::promiseMemoized");
            } // eslint-disable-next-line flowtype/no-weak-types

            function inlineMemoize(method, logic, args) {
              if (args === void 0) {
                args = [];
              }

              // $FlowFixMe
              var cache = method.__inline_memoize_cache__ = method.__inline_memoize_cache__ || {};
              var key = serializeArgs(args);

              if (cache.hasOwnProperty(key)) {
                return cache[key];
              }

              var result = cache[key] = logic.apply(void 0, args);
              return result;
            } // eslint-disable-next-line no-unused-vars

            function src_util_noop() {// pass
            }
            function once(method) {
              var called = false;

              var onceFunction = function onceFunction() {
                if (!called) {
                  called = true;
                  return method.apply(this, arguments);
                }
              };

              return setFunctionName(onceFunction, getFunctionName(method) + "::once");
            }
            function stringifyError(err, level) {
              if (level === void 0) {
                level = 1;
              }

              if (level >= 3) {
                return 'stringifyError stack overflow';
              }

              try {
                if (!err) {
                  return "<unknown error: " + Object.prototype.toString.call(err) + ">";
                }

                if (typeof err === 'string') {
                  return err;
                }

                if (err instanceof Error) {
                  var stack = err && err.stack;
                  var message = err && err.message;

                  if (stack && message) {
                    if (stack.indexOf(message) !== -1) {
                      return stack;
                    } else {
                      return message + "\n" + stack;
                    }
                  } else if (stack) {
                    return stack;
                  } else if (message) {
                    return message;
                  }
                }

                if (err && err.toString && typeof err.toString === 'function') {
                  // $FlowFixMe
                  return err.toString();
                }

                return Object.prototype.toString.call(err);
              } catch (newErr) {
                // eslint-disable-line unicorn/catch-error-name
                return "Error while stringifying error: " + stringifyError(newErr, level + 1);
              }
            }
            function stringify(item) {
              if (typeof item === 'string') {
                return item;
              }

              if (item && item.toString && typeof item.toString === 'function') {
                // $FlowFixMe
                return item.toString();
              }

              return Object.prototype.toString.call(item);
            }
            function extend(obj, source) {
              if (!source) {
                return obj;
              }

              if (Object.assign) {
                return Object.assign(obj, source);
              }

              for (var key in source) {
                if (source.hasOwnProperty(key)) {
                  obj[key] = source[key];
                }
              }

              return obj;
            }
            function util_values(obj) {
              var result = [];

              for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                  result.push(obj[key]);
                }
              }

              return result;
            }
            function safeInterval(method, time) {
              var timeout;

              function loop() {
                timeout = setTimeout(function () {
                  method();
                  loop();
                }, time);
              }

              loop();
              return {
                cancel: function cancel() {
                  clearTimeout(timeout);
                }
              };
            }
            function serializePrimitive(value) {
              return value.toString();
            }
            function dotify(obj, prefix, newobj) {
              if (prefix === void 0) {
                prefix = '';
              }

              if (newobj === void 0) {
                newobj = {};
              }

              prefix = prefix ? prefix + "." : prefix;

              for (var key in obj) {
                if (!obj.hasOwnProperty(key) || obj[key] === undefined || obj[key] === null || typeof obj[key] === 'function') {
                  continue;
                } else if (obj[key] && Array.isArray(obj[key]) && obj[key].length && obj[key].every(function (val) {
                  return typeof val !== 'object';
                })) {
                  newobj["" + prefix + key + "[]"] = obj[key].join(',');
                } else if (obj[key] && typeof obj[key] === 'object') {
                  newobj = dotify(obj[key], "" + prefix + key, newobj);
                } else {
                  newobj["" + prefix + key] = serializePrimitive(obj[key]);
                }
              }

              return newobj;
            }
            function eventEmitter() {
              var triggered = {};
              var handlers = {};
              return {
                on: function on(eventName, handler) {
                  var handlerList = handlers[eventName] = handlers[eventName] || [];
                  handlerList.push(handler);
                  var cancelled = false;
                  return {
                    cancel: function cancel() {
                      if (!cancelled) {
                        cancelled = true;
                        handlerList.splice(handlerList.indexOf(handler), 1);
                      }
                    }
                  };
                },
                once: function once(eventName, handler) {
                  var listener = this.on(eventName, function () {
                    listener.cancel();
                    handler();
                  });
                  return listener;
                },
                trigger: function trigger(eventName) {
                  for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
                    args[_key3 - 1] = arguments[_key3];
                  }

                  var handlerList = handlers[eventName];
                  var promises = [];

                  if (handlerList) {
                    var _loop = function _loop(_i2) {
                      var handler = handlerList[_i2];
                      promises.push(promise_ZalgoPromise.try(function () {
                        return handler.apply(void 0, args);
                      }));
                    };

                    for (var _i2 = 0; _i2 < handlerList.length; _i2++) {
                      _loop(_i2);
                    }
                  }

                  return promise_ZalgoPromise.all(promises).then(src_util_noop);
                },
                triggerOnce: function triggerOnce(eventName) {
                  if (triggered[eventName]) {
                    return promise_ZalgoPromise.resolve();
                  }

                  triggered[eventName] = true;

                  for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
                    args[_key4 - 1] = arguments[_key4];
                  }

                  return this.trigger.apply(this, [eventName].concat(args));
                },
                reset: function reset() {
                  handlers = {};
                }
              };
            }
            function arrayFrom(item) {
              // eslint-disable-line no-undef
              return Array.prototype.slice.call(item);
            }
            function isDefined(value) {
              return value !== null && value !== undefined;
            }
            function util_isRegex(item) {
              return Object.prototype.toString.call(item) === '[object RegExp]';
            }
            function util_getOrSet(obj, key, getter) {
              if (obj.hasOwnProperty(key)) {
                return obj[key];
              }

              var val = getter();
              obj[key] = val;
              return val;
            }
            function cleanup(obj) {
              var tasks = [];
              var cleaned = false;
              return {
                set: function set(name, item) {
                  if (!cleaned) {
                    obj[name] = item;
                    this.register(function () {
                      delete obj[name];
                    });
                  }

                  return item;
                },
                register: function register(method) {
                  if (cleaned) {
                    method();
                  } else {
                    tasks.push(once(method));
                  }
                },
                all: function all() {
                  var results = [];
                  cleaned = true;

                  while (tasks.length) {
                    var task = tasks.pop();
                    results.push(task());
                  }

                  return promise_ZalgoPromise.all(results).then(src_util_noop);
                }
              };
            }
            function assertExists(name, thing) {
              if (thing === null || typeof thing === 'undefined') {
                throw new Error("Expected " + name + " to be present");
              }

              return thing;
            }
            // CONCATENATED MODULE: ./node_modules/belter/src/dom.js


            /* eslint max-lines: off */






            function isDocumentReady() {
              return Boolean(document.body) && document.readyState === 'complete';
            }
            function urlEncode(str) {
              return str.replace(/\?/g, '%3F').replace(/&/g, '%26').replace(/#/g, '%23').replace(/\+/g, '%2B');
            }
            function waitForDocumentReady() {
              return inlineMemoize(waitForDocumentReady, function () {
                return new promise_ZalgoPromise(function (resolve) {
                  if (isDocumentReady()) {
                    return resolve();
                  }

                  var interval = setInterval(function () {
                    if (isDocumentReady()) {
                      clearInterval(interval);
                      return resolve();
                    }
                  }, 10);
                });
              });
            }
            function waitForDocumentBody() {
              return waitForDocumentReady().then(function () {
                if (document.body) {
                  return document.body;
                }

                throw new Error('Document ready but document.body not present');
              });
            }
            function parseQuery(queryString) {
              return inlineMemoize(parseQuery, function () {
                var params = {};

                if (!queryString) {
                  return params;
                }

                if (queryString.indexOf('=') === -1) {
                  return params;
                }

                for (var _i2 = 0, _queryString$split2 = queryString.split('&'); _i2 < _queryString$split2.length; _i2++) {
                  var pair = _queryString$split2[_i2];
                  pair = pair.split('=');

                  if (pair[0] && pair[1]) {
                    params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
                  }
                }

                return params;
              }, [queryString]);
            }
            function formatQuery(obj) {
              if (obj === void 0) {
                obj = {};
              }

              return Object.keys(obj).filter(function (key) {
                return typeof obj[key] === 'string';
              }).map(function (key) {
                return urlEncode(key) + "=" + urlEncode(obj[key]);
              }).join('&');
            }
            function extendQuery(originalQuery, props) {
              if (props === void 0) {
                props = {};
              }

              if (!props || !Object.keys(props).length) {
                return originalQuery;
              }

              return formatQuery(_extends({}, parseQuery(originalQuery), {}, props));
            }
            function extendUrl(url, options) {
              if (options === void 0) {
                options = {};
              }

              var query = options.query || {};
              var hash = options.hash || {};
              var originalUrl;
              var originalQuery;
              var originalHash;

              var _url$split = url.split('#');

              originalUrl = _url$split[0];
              originalHash = _url$split[1];

              var _originalUrl$split = originalUrl.split('?');

              originalUrl = _originalUrl$split[0];
              originalQuery = _originalUrl$split[1];
              var queryString = extendQuery(originalQuery, query);
              var hashString = extendQuery(originalHash, hash);

              if (queryString) {
                originalUrl = originalUrl + "?" + queryString;
              }

              if (hashString) {
                originalUrl = originalUrl + "#" + hashString;
              }

              return originalUrl;
            }
            function appendChild(container, child) {
              container.appendChild(child);
            }
            function isElement(element) {
              if (element instanceof window.Element) {
                return true;
              }

              if (element !== null && typeof element === 'object' && element.nodeType === 1 && typeof element.style === 'object' && typeof element.ownerDocument === 'object') {
                return true;
              }

              return false;
            }
            function getElementSafe(id, doc) {
              if (doc === void 0) {
                doc = document;
              }

              if (isElement(id)) {
                // $FlowFixMe
                return id;
              }

              if (typeof id === 'string') {
                return doc.querySelector(id);
              }
            }
            function getElement(id, doc) {
              if (doc === void 0) {
                doc = document;
              }

              var element = getElementSafe(id, doc);

              if (element) {
                return element;
              }

              throw new Error("Can not find element: " + stringify(id));
            }
            function elementReady(id) {
              return new promise_ZalgoPromise(function (resolve, reject) {
                var name = stringify(id);
                var el = getElementSafe(id);

                if (el) {
                  return resolve(el);
                }

                if (isDocumentReady()) {
                  return reject(new Error("Document is ready and element " + name + " does not exist"));
                }

                var interval = setInterval(function () {
                  el = getElementSafe(id);

                  if (el) {
                    clearInterval(interval);
                    return resolve(el);
                  }

                  if (isDocumentReady()) {
                    clearInterval(interval);
                    return reject(new Error("Document is ready and element " + name + " does not exist"));
                  }
                }, 10);
              });
            }
            function PopupOpenError(message) {
              this.message = message;
            }
            PopupOpenError.prototype = Object.create(Error.prototype);
            function writeToWindow(win, html) {
              try {
                win.document.open();
                win.document.write(html);
                win.document.close();
              } catch (err) {
                try {
                  win.location = "javascript: document.open(); document.write(" + JSON.stringify(html) + "); document.close();";
                } catch (err2) {// pass
                }
              }
            }
            function writeElementToWindow(win, el) {
              var tag = el.tagName.toLowerCase();

              if (tag !== 'html') {
                throw new Error("Expected element to be html, got " + tag);
              }

              var documentElement = win.document.documentElement;

              for (var _i6 = 0, _arrayFrom2 = arrayFrom(documentElement.children); _i6 < _arrayFrom2.length; _i6++) {
                var child = _arrayFrom2[_i6];
                documentElement.removeChild(child);
              }

              for (var _i8 = 0, _arrayFrom4 = arrayFrom(el.children); _i8 < _arrayFrom4.length; _i8++) {
                var _child = _arrayFrom4[_i8];
                documentElement.appendChild(_child);
              }
            }
            function setStyle(el, styleText, doc) {
              if (doc === void 0) {
                doc = window.document;
              }

              // $FlowFixMe
              if (el.styleSheet) {
                // $FlowFixMe
                el.styleSheet.cssText = styleText;
              } else {
                el.appendChild(doc.createTextNode(styleText));
              }
            }
            var awaitFrameLoadPromises;
            function awaitFrameLoad(frame) {
              awaitFrameLoadPromises = awaitFrameLoadPromises || new weakmap_CrossDomainSafeWeakMap();

              if (awaitFrameLoadPromises.has(frame)) {
                var _promise = awaitFrameLoadPromises.get(frame);

                if (_promise) {
                  return _promise;
                }
              }

              var promise = new promise_ZalgoPromise(function (resolve, reject) {
                frame.addEventListener('load', function () {
                  linkFrameWindow(frame);
                  resolve(frame);
                });
                frame.addEventListener('error', function (err) {
                  if (frame.contentWindow) {
                    resolve(frame);
                  } else {
                    reject(err);
                  }
                });
              });
              awaitFrameLoadPromises.set(frame, promise);
              return promise;
            }
            function awaitFrameWindow(frame) {
              return awaitFrameLoad(frame).then(function (loadedFrame) {
                if (!loadedFrame.contentWindow) {
                  throw new Error("Could not find window in iframe");
                }

                return loadedFrame.contentWindow;
              });
            }
            function createElement(tag, options, container) {
              if (tag === void 0) {
                tag = 'div';
              }

              if (options === void 0) {
                options = {};
              }

              tag = tag.toLowerCase();
              var element = document.createElement(tag);

              if (options.style) {
                extend(element.style, options.style);
              }

              if (options.class) {
                element.className = options.class.join(' ');
              }

              if (options.id) {
                element.setAttribute('id', options.id);
              }

              if (options.attributes) {
                for (var _i10 = 0, _Object$keys2 = Object.keys(options.attributes); _i10 < _Object$keys2.length; _i10++) {
                  var key = _Object$keys2[_i10];
                  element.setAttribute(key, options.attributes[key]);
                }
              }

              if (options.styleSheet) {
                setStyle(element, options.styleSheet);
              }

              if (container) {
                appendChild(container, element);
              }

              if (options.html) {
                if (tag === 'iframe') {
                  // $FlowFixMe
                  if (!container || !element.contentWindow) {
                    throw new Error("Iframe html can not be written unless container provided and iframe in DOM");
                  } // $FlowFixMe


                  writeToWindow(element.contentWindow, options.html);
                } else {
                  element.innerHTML = options.html;
                }
              }

              return element;
            }
            function dom_iframe(options, container) {
              if (options === void 0) {
                options = {};
              }

              var attributes = options.attributes || {};
              var style = options.style || {};
              var frame = createElement('iframe', {
                attributes: _extends({
                  allowTransparency: 'true'
                }, attributes),
                style: _extends({
                  backgroundColor: 'transparent',
                  border: 'none'
                }, style),
                html: options.html,
                class: options.class
              });
              var isIE = window.navigator.userAgent.match(/MSIE|Edge/i);

              if (!frame.hasAttribute('id')) {
                frame.setAttribute('id', uniqueID());
              } // $FlowFixMe


              awaitFrameLoad(frame);

              if (container) {
                var el = getElement(container);
                el.appendChild(frame);
              }

              if (options.url || isIE) {
                frame.setAttribute('src', options.url || 'about:blank');
              } // $FlowFixMe


              return frame;
            }
            function addEventListener(obj, event, handler) {
              obj.addEventListener(event, handler);
              return {
                cancel: function cancel() {
                  obj.removeEventListener(event, handler);
                }
              };
            }
            var STYLE = {
              DISPLAY: {
                NONE: 'none',
                BLOCK: 'block'
              },
              VISIBILITY: {
                VISIBLE: 'visible',
                HIDDEN: 'hidden'
              },
              IMPORTANT: 'important'
            };
            function showElement(element) {
              element.style.setProperty('display', '');
            }
            function hideElement(element) {
              element.style.setProperty('display', STYLE.DISPLAY.NONE, STYLE.IMPORTANT);
            }
            function destroyElement(element) {
              if (element && element.parentNode) {
                element.parentNode.removeChild(element);
              }
            }
            function isElementClosed(el) {
              if (!el || !el.parentNode) {
                return true;
              }

              return false;
            }
            function watchElementForClose(element, handler) {
              handler = once(handler);
              var interval;

              if (isElementClosed(element)) {
                handler();
              } else {
                interval = safeInterval(function () {
                  if (isElementClosed(element)) {
                    interval.cancel();
                    handler();
                  }
                }, 50);
              }

              return {
                cancel: function cancel() {
                  if (interval) {
                    interval.cancel();
                  }
                }
              };
            }
            function onResize(el, handler, _temp) {
              var _ref2 = _temp === void 0 ? {} : _temp,
                  _ref2$width = _ref2.width,
                  width = _ref2$width === void 0 ? true : _ref2$width,
                  _ref2$height = _ref2.height,
                  height = _ref2$height === void 0 ? true : _ref2$height,
                  _ref2$interval = _ref2.interval,
                  interval = _ref2$interval === void 0 ? 100 : _ref2$interval,
                  _ref2$win = _ref2.win,
                  win = _ref2$win === void 0 ? window : _ref2$win;

              var currentWidth = el.offsetWidth;
              var currentHeight = el.offsetHeight;
              handler({
                width: currentWidth,
                height: currentHeight
              });

              var check = function check() {
                var newWidth = el.offsetWidth;
                var newHeight = el.offsetHeight;

                if (width && newWidth !== currentWidth || height && newHeight !== currentHeight) {
                  handler({
                    width: newWidth,
                    height: newHeight
                  });
                }

                currentWidth = newWidth;
                currentHeight = newHeight;
              };

              var observer;
              var timeout;

              if (typeof win.ResizeObserver !== 'undefined') {
                observer = new win.ResizeObserver(check);
                observer.observe(el);
              } else if (typeof win.MutationObserver !== 'undefined') {
                observer = new win.MutationObserver(check);
                observer.observe(el, {
                  attributes: true,
                  childList: true,
                  subtree: true,
                  characterData: false
                });
                win.addEventListener('resize', check);
              } else {
                var loop = function loop() {
                  check();
                  timeout = setTimeout(loop, interval);
                };

                loop();
              }

              return {
                cancel: function cancel() {
                  observer.disconnect();
                  window.removeEventListener('resize', check);
                  clearTimeout(timeout);
                }
              };
            }
            // CONCATENATED MODULE: ./node_modules/belter/src/css.js
            function isPerc(str) {
              return typeof str === 'string' && /^[0-9]+%$/.test(str);
            }
            function isPx(str) {
              return typeof str === 'string' && /^[0-9]+px$/.test(str);
            }
            function toNum(val) {
              if (typeof val === 'number') {
                return val;
              }

              var match = val.match(/^([0-9]+)(px|%)$/);

              if (!match) {
                throw new Error("Could not match css value from " + val);
              }

              return parseInt(match[1], 10);
            }
            function toPx(val) {
              return toNum(val) + "px";
            }
            function toCSS(val) {
              if (typeof val === 'number') {
                return toPx(val);
              }

              return isPerc(val) ? val : toPx(val);
            }
            var CHILD_WINDOW_TIMEOUT = 5000;
            var ACK_TIMEOUT = 2000;
            var ACK_TIMEOUT_KNOWN = 10000;
            var RES_TIMEOUT =   -1;
            var RESPONSE_CYCLE_TIME = 500;
            // CONCATENATED MODULE: ./node_modules/post-robot/src/conf/constants.js
            var MESSAGE_TYPE = {
              REQUEST: 'postrobot_message_request',
              RESPONSE: 'postrobot_message_response',
              ACK: 'postrobot_message_ack'
            };
            var MESSAGE_ACK = {
              SUCCESS: 'success',
              ERROR: 'error'
            };
            var MESSAGE_NAME = {
              METHOD: 'postrobot_method',
              HELLO: 'postrobot_hello',
              OPEN_TUNNEL: 'postrobot_open_tunnel'
            };
            var SEND_STRATEGY = {
              POST_MESSAGE: 'postrobot_post_message',
              BRIDGE: 'postrobot_bridge',
              GLOBAL: 'postrobot_global'
            };
            var constants_WILDCARD = '*';
            var SERIALIZATION_TYPE = {
              CROSS_DOMAIN_ZALGO_PROMISE: 'cross_domain_zalgo_promise',
              CROSS_DOMAIN_FUNCTION: 'cross_domain_function',
              CROSS_DOMAIN_WINDOW: 'cross_domain_window'
            };
            // CONCATENATED MODULE: ./node_modules/post-robot/src/conf/index.js


            // CONCATENATED MODULE: ./node_modules/post-robot/src/global.js


            function global_getGlobal(win) {
              if (win === void 0) {
                win = window;
              }

              if (win !== window) {
                return win["__post_robot_10_0_29__"];
              }

              var global = win["__post_robot_10_0_29__"] = win["__post_robot_10_0_29__"] || {};
              return global;
            }
            function deleteGlobal() {
              delete window["__post_robot_10_0_29__"];
            }

            var getObj = function getObj() {
              return {};
            };

            function globalStore(key, defStore) {
              if (key === void 0) {
                key = 'store';
              }

              if (defStore === void 0) {
                defStore = getObj;
              }

              return util_getOrSet(global_getGlobal(), key, function () {
                var store = defStore();
                return {
                  has: function has(storeKey) {
                    return store.hasOwnProperty(storeKey);
                  },
                  get: function get(storeKey, defVal) {
                    // $FlowFixMe
                    return store.hasOwnProperty(storeKey) ? store[storeKey] : defVal;
                  },
                  set: function set(storeKey, val) {
                    store[storeKey] = val;
                    return val;
                  },
                  del: function del(storeKey) {
                    delete store[storeKey];
                  },
                  getOrSet: function getOrSet(storeKey, getter) {
                    // $FlowFixMe
                    return util_getOrSet(store, storeKey, getter);
                  },
                  reset: function reset() {
                    store = defStore();
                  },
                  keys: function keys() {
                    return Object.keys(store);
                  }
                };
              });
            }
            var WildCard = function WildCard() {};
            function getWildcard() {
              var global = global_getGlobal();
              global.WINDOW_WILDCARD = global.WINDOW_WILDCARD || new WildCard();
              return global.WINDOW_WILDCARD;
            }
            function windowStore(key, defStore) {
              if (key === void 0) {
                key = 'store';
              }

              if (defStore === void 0) {
                defStore = getObj;
              }

              return globalStore('windowStore').getOrSet(key, function () {
                var winStore = new weakmap_CrossDomainSafeWeakMap();

                var getStore = function getStore(win) {
                  return winStore.getOrSet(win, defStore);
                };

                return {
                  has: function has(win) {
                    var store = getStore(win);
                    return store.hasOwnProperty(key);
                  },
                  get: function get(win, defVal) {
                    var store = getStore(win); // $FlowFixMe

                    return store.hasOwnProperty(key) ? store[key] : defVal;
                  },
                  set: function set(win, val) {
                    var store = getStore(win);
                    store[key] = val;
                    return val;
                  },
                  del: function del(win) {
                    var store = getStore(win);
                    delete store[key];
                  },
                  getOrSet: function getOrSet(win, getter) {
                    var store = getStore(win);
                    return util_getOrSet(store, key, getter);
                  }
                };
              });
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/lib/hello.js






            function getInstanceID() {
              return globalStore('instance').getOrSet('instanceID', uniqueID);
            }

            function getHelloPromise(win) {
              var helloPromises = windowStore('helloPromises');
              return helloPromises.getOrSet(win, function () {
                return new promise_ZalgoPromise();
              });
            }

            function resolveHelloPromise(win, _ref) {
              var domain = _ref.domain;
              var helloPromises = windowStore('helloPromises');
              var existingPromise = helloPromises.get(win);

              if (existingPromise) {
                existingPromise.resolve({
                  domain: domain
                });
              }

              var newPromise = promise_ZalgoPromise.resolve({
                domain: domain
              });
              helloPromises.set(win, newPromise);
              return newPromise;
            }

            function listenForHello(_ref2) {
              var on = _ref2.on;
              return on(MESSAGE_NAME.HELLO, {
                domain: constants_WILDCARD
              }, function (_ref3) {
                var source = _ref3.source,
                    origin = _ref3.origin;
                resolveHelloPromise(source, {
                  domain: origin
                });
                return {
                  instanceID: getInstanceID()
                };
              });
            }

            function sayHello(win, _ref4) {
              var send = _ref4.send;
              return send(win, MESSAGE_NAME.HELLO, {
                instanceID: getInstanceID()
              }, {
                domain: constants_WILDCARD,
                timeout: -1
              }).then(function (_ref5) {
                var origin = _ref5.origin,
                    instanceID = _ref5.data.instanceID;
                resolveHelloPromise(win, {
                  domain: origin
                });
                return {
                  win: win,
                  domain: origin,
                  instanceID: instanceID
                };
              });
            }
            function getWindowInstanceID(win, _ref6) {
              var send = _ref6.send;
              return windowStore('windowInstanceIDPromises').getOrSet(win, function () {
                return sayHello(win, {
                  send: send
                }).then(function (_ref7) {
                  var instanceID = _ref7.instanceID;
                  return instanceID;
                });
              });
            }
            function initHello(_ref8) {
              var on = _ref8.on,
                  send = _ref8.send;
              return globalStore('builtinListeners').getOrSet('helloListener', function () {
                var listener = listenForHello({
                  on: on
                });
                var parent = getAncestor();

                if (parent) {
                  sayHello(parent, {
                    send: send
                  }).catch(src_util_noop);
                }

                return listener;
              });
            }
            function awaitWindowHello(win, timeout, name) {
              if (timeout === void 0) {
                timeout = 5000;
              }

              if (name === void 0) {
                name = 'Window';
              }

              var promise = getHelloPromise(win);

              if (timeout !== -1) {
                promise = promise.timeout(timeout, new Error(name + " did not load after " + timeout + "ms"));
              }

              return promise;
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/lib/compat.js

            function needsGlobalMessagingForBrowser() {
              if (utils_getUserAgent(window).match(/MSIE|rv:11|trident|edge\/12|edge\/13/i)) {
                return true;
              }

              return false;
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/lib/windows.js

            function markWindowKnown(win) {
              var knownWindows = windowStore('knownWindows');
              knownWindows.set(win, true);
            }
            function isWindowKnown(win) {
              var knownWindows = windowStore('knownWindows');
              return knownWindows.get(win, false);
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/lib/index.js



            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/constants.js
            var TYPE = {
              FUNCTION: 'function',
              ERROR: 'error',
              PROMISE: 'promise',
              REGEX: 'regex',
              DATE: 'date',
              ARRAY: 'array',
              OBJECT: 'object',
              STRING: 'string',
              NUMBER: 'number',
              BOOLEAN: 'boolean',
              NULL: 'null',
              UNDEFINED: 'undefined'
            };
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/common.js

            function isSerializedType(item) {
              return typeof item === 'object' && item !== null && typeof item.__type__ === 'string';
            }
            function determineType(val) {
              if (typeof val === 'undefined') {
                return TYPE.UNDEFINED;
              }

              if (val === null) {
                return TYPE.NULL;
              }

              if (Array.isArray(val)) {
                return TYPE.ARRAY;
              }

              if (typeof val === 'function') {
                return TYPE.FUNCTION;
              }

              if (typeof val === 'object') {
                if (val instanceof Error) {
                  return TYPE.ERROR;
                }

                if (typeof val.then === 'function') {
                  return TYPE.PROMISE;
                }

                if (Object.prototype.toString.call(val) === '[object RegExp]') {
                  return TYPE.REGEX;
                }

                if (Object.prototype.toString.call(val) === '[object Date]') {
                  return TYPE.DATE;
                }

                return TYPE.OBJECT;
              }

              if (typeof val === 'string') {
                return TYPE.STRING;
              }

              if (typeof val === 'number') {
                return TYPE.NUMBER;
              }

              if (typeof val === 'boolean') {
                return TYPE.BOOLEAN;
              }
            }
            function serializeType(type, val) {
              return {
                __type__: type,
                __val__: val
              };
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/array.js
            function serializeArray(val) {
              return val;
            }
            function deserializeArray(val) {
              return val;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/boolean.js
            function serializeBoolean(val) {
              return val;
            }
            function deserializeBoolean(val) {
              return val;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/date.js


            function serializeDate(val) {
              return serializeType(TYPE.DATE, val.toJSON());
            }
            function deserializeDate(val) {
              return new Date(val);
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/error.js


            // $FlowFixMe
            function serializeError(_ref) {
              var message = _ref.message,
                  stack = _ref.stack,
                  code = _ref.code;
              return serializeType(TYPE.ERROR, {
                message: message,
                stack: stack,
                code: code
              });
            }
            function deserializeError(_ref2) {
              var message = _ref2.message,
                  stack = _ref2.stack,
                  code = _ref2.code;
              var error = new Error(message); // $FlowFixMe

              error.code = code;
              error.stack = stack + "\n\n" + error.stack;
              return error;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/function.js
            function serializeFunction() {// pass
            }
            function deserializeFunction() {
              throw new Error("Function serialization is not implemented; nothing to deserialize");
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/number.js
            function serializeNumber(val) {
              return val;
            }
            function deserializeNumber(val) {
              return val;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/object.js
            function serializeObject(val) {
              return val;
            }
            function deserializeObject(val) {
              return val;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/promise.js
            function serializePromise() {// pass
            }
            function deserializePromise() {
              throw new Error("Promise serialization is not implemented; nothing to deserialize");
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/regex.js


            function serializeRegex(val) {
              return serializeType(TYPE.REGEX, val.source);
            }
            function deserializeRegex(val) {
              // eslint-disable-next-line security/detect-non-literal-regexp
              return new RegExp(val);
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/string.js
            function serializeString(val) {
              return val;
            }
            function deserializeString(val) {
              return val;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/null.js
            function serializeNull(val) {
              return val;
            }
            function deserializeNull(val) {
              return val;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/index.js











            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serialize.js
            var _SERIALIZER;




            var SERIALIZER = (_SERIALIZER = {}, _SERIALIZER[TYPE.FUNCTION] = serializeFunction, _SERIALIZER[TYPE.ERROR] = serializeError, _SERIALIZER[TYPE.PROMISE] = serializePromise, _SERIALIZER[TYPE.REGEX] = serializeRegex, _SERIALIZER[TYPE.DATE] = serializeDate, _SERIALIZER[TYPE.ARRAY] = serializeArray, _SERIALIZER[TYPE.OBJECT] = serializeObject, _SERIALIZER[TYPE.STRING] = serializeString, _SERIALIZER[TYPE.NUMBER] = serializeNumber, _SERIALIZER[TYPE.BOOLEAN] = serializeBoolean, _SERIALIZER[TYPE.NULL] = serializeNull, _SERIALIZER); // $FlowFixMe

            var defaultSerializers = {};
            function serialize(obj, serializers) {
              if (serializers === void 0) {
                serializers = defaultSerializers;
              }

              function replacer(key) {
                var val = this[key];

                if (isSerializedType(this)) {
                  return val;
                }

                var type = determineType(val);

                if (!type) {
                  return val;
                } // $FlowFixMe


                var serializer = serializers[type] || SERIALIZER[type];

                if (!serializer) {
                  return val;
                }

                return serializer(val, key);
              }

              var result = JSON.stringify(obj, replacer);

              if (typeof result === 'undefined') {
                return TYPE.UNDEFINED;
              }

              return result;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/deserialize.js
            var _DESERIALIZER;




            // $FlowFixMe
            var DESERIALIZER = (_DESERIALIZER = {}, _DESERIALIZER[TYPE.FUNCTION] = deserializeFunction, _DESERIALIZER[TYPE.ERROR] = deserializeError, _DESERIALIZER[TYPE.PROMISE] = deserializePromise, _DESERIALIZER[TYPE.REGEX] = deserializeRegex, _DESERIALIZER[TYPE.DATE] = deserializeDate, _DESERIALIZER[TYPE.ARRAY] = deserializeArray, _DESERIALIZER[TYPE.OBJECT] = deserializeObject, _DESERIALIZER[TYPE.STRING] = deserializeString, _DESERIALIZER[TYPE.NUMBER] = deserializeNumber, _DESERIALIZER[TYPE.BOOLEAN] = deserializeBoolean, _DESERIALIZER[TYPE.NULL] = deserializeNull, _DESERIALIZER); // $FlowFixMe

            var defaultDeserializers = {};
            function deserialize_deserialize(str, deserializers) {
              if (deserializers === void 0) {
                deserializers = defaultDeserializers;
              }

              if (str === TYPE.UNDEFINED) {
                // $FlowFixMe
                return;
              }

              function replacer(key, val) {
                if (isSerializedType(this)) {
                  return val;
                }

                var type;
                var value;

                if (isSerializedType(val)) {
                  type = val.__type__;
                  value = val.__val__;
                } else {
                  type = determineType(val);
                  value = val;
                }

                if (!type) {
                  return value;
                } // $FlowFixMe


                var deserializer = deserializers[type] || DESERIALIZER[type];

                if (!deserializer) {
                  return value;
                }

                return deserializer(value, key);
              }

              return JSON.parse(str, replacer);
            }
            var documentBodyReady = new promise_ZalgoPromise(function (resolve) {
              if (window.document && window.document.body) {
                return resolve(window.document.body);
              }

              var interval = setInterval(function () {
                if (window.document && window.document.body) {
                  clearInterval(interval);
                  return resolve(window.document.body);
                }
              }, 10);
            });
            // CONCATENATED MODULE: ./node_modules/post-robot/src/bridge/index.js





            // CONCATENATED MODULE: ./node_modules/post-robot/src/serialize/window.js









            function cleanupProxyWindows() {
              var idToProxyWindow = globalStore('idToProxyWindow');

              for (var _i2 = 0, _idToProxyWindow$keys2 = idToProxyWindow.keys(); _i2 < _idToProxyWindow$keys2.length; _i2++) {
                var id = _idToProxyWindow$keys2[_i2];

                // $FlowFixMe
                if (idToProxyWindow.get(id).shouldClean()) {
                  idToProxyWindow.del(id);
                }
              }
            }

            function getSerializedWindow(winPromise, _ref) {
              var send = _ref.send,
                  _ref$id = _ref.id,
                  id = _ref$id === void 0 ? uniqueID() : _ref$id;
              var windowNamePromise = winPromise.then(function (win) {
                if (isSameDomain(win)) {
                  return assertSameDomain(win).name;
                }
              });
              return {
                id: id,
                getType: function getType() {
                  return winPromise.then(function (win) {
                    return getOpener(win) ? WINDOW_TYPE.POPUP : WINDOW_TYPE.IFRAME;
                  });
                },
                getInstanceID: memoizePromise(function () {
                  return winPromise.then(function (win) {
                    return getWindowInstanceID(win, {
                      send: send
                    });
                  });
                }),
                close: function close() {
                  return winPromise.then(closeWindow);
                },
                getName: function getName() {
                  return winPromise.then(function (win) {
                    if (isWindowClosed(win)) {
                      return;
                    }

                    if (isSameDomain(win)) {
                      return assertSameDomain(win).name;
                    }

                    return windowNamePromise;
                  });
                },
                focus: function focus() {
                  return winPromise.then(function (win) {
                    win.focus();
                  });
                },
                isClosed: function isClosed() {
                  return winPromise.then(function (win) {
                    return isWindowClosed(win);
                  });
                },
                setLocation: function setLocation(href) {
                  return winPromise.then(function (win) {
                    if (isSameDomain(win)) {
                      try {
                        if (win.location && typeof win.location.replace === 'function') {
                          // $FlowFixMe
                          win.location.replace(href);
                          return;
                        }
                      } catch (err) {// pass
                      }
                    }

                    win.location = href;
                  });
                },
                setName: function setName(name) {
                  return winPromise.then(function (win) {

                    var sameDomain = isSameDomain(win);
                    var frame = getFrameForWindow(win);

                    if (!sameDomain) {
                      throw new Error("Can not set name for cross-domain window: " + name);
                    }

                    assertSameDomain(win).name = name;

                    if (frame) {
                      frame.setAttribute('name', name);
                    }

                    windowNamePromise = promise_ZalgoPromise.resolve(name);
                  });
                }
              };
            }

            var window_ProxyWindow =
            /*#__PURE__*/
            function () {
              function ProxyWindow(_ref2) {
                var send = _ref2.send,
                    win = _ref2.win,
                    serializedWindow = _ref2.serializedWindow;
                this.id = void 0;
                this.isProxyWindow = true;
                this.serializedWindow = void 0;
                this.actualWindow = void 0;
                this.actualWindowPromise = void 0;
                this.send = void 0;
                this.name = void 0;
                this.actualWindowPromise = new promise_ZalgoPromise();
                this.serializedWindow = serializedWindow || getSerializedWindow(this.actualWindowPromise, {
                  send: send
                });
                globalStore('idToProxyWindow').set(this.getID(), this);

                if (win) {
                  this.setWindow(win, {
                    send: send
                  });
                }
              }

              var _proto = ProxyWindow.prototype;

              _proto.getID = function getID() {
                return this.serializedWindow.id;
              };

              _proto.getType = function getType() {
                return this.serializedWindow.getType();
              };

              _proto.isPopup = function isPopup() {
                return this.getType().then(function (type) {
                  return type === WINDOW_TYPE.POPUP;
                });
              };

              _proto.setLocation = function setLocation(href) {
                var _this = this;

                return this.serializedWindow.setLocation(href).then(function () {
                  return _this;
                });
              };

              _proto.getName = function getName() {
                return this.serializedWindow.getName();
              };

              _proto.setName = function setName(name) {
                var _this2 = this;

                return this.serializedWindow.setName(name).then(function () {
                  return _this2;
                });
              };

              _proto.close = function close() {
                var _this3 = this;

                return this.serializedWindow.close().then(function () {
                  return _this3;
                });
              };

              _proto.focus = function focus() {
                var _this4 = this;

                var isPopupPromise = this.isPopup();
                var getNamePromise = this.getName();
                var reopenPromise = promise_ZalgoPromise.hash({
                  isPopup: isPopupPromise,
                  name: getNamePromise
                }).then(function (_ref3) {
                  var isPopup = _ref3.isPopup,
                      name = _ref3.name;

                  if (isPopup && name) {
                    window.open('', name);
                  }
                });
                var focusPromise = this.serializedWindow.focus();
                return promise_ZalgoPromise.all([reopenPromise, focusPromise]).then(function () {
                  return _this4;
                });
              };

              _proto.isClosed = function isClosed() {
                return this.serializedWindow.isClosed();
              };

              _proto.getWindow = function getWindow() {
                return this.actualWindow;
              };

              _proto.setWindow = function setWindow(win, _ref4) {
                var send = _ref4.send;
                this.actualWindow = win;
                this.actualWindowPromise.resolve(this.actualWindow);
                this.serializedWindow = getSerializedWindow(this.actualWindowPromise, {
                  send: send,
                  id: this.getID()
                });
                windowStore('winToProxyWindow').set(win, this);
              };

              _proto.awaitWindow = function awaitWindow() {
                return this.actualWindowPromise;
              };

              _proto.matchWindow = function matchWindow(win, _ref5) {
                var _this5 = this;

                var send = _ref5.send;
                return promise_ZalgoPromise.try(function () {
                  if (_this5.actualWindow) {
                    return win === _this5.actualWindow;
                  }

                  return promise_ZalgoPromise.hash({
                    proxyInstanceID: _this5.getInstanceID(),
                    knownWindowInstanceID: getWindowInstanceID(win, {
                      send: send
                    })
                  }).then(function (_ref6) {
                    var proxyInstanceID = _ref6.proxyInstanceID,
                        knownWindowInstanceID = _ref6.knownWindowInstanceID;
                    var match = proxyInstanceID === knownWindowInstanceID;

                    if (match) {
                      _this5.setWindow(win, {
                        send: send
                      });
                    }

                    return match;
                  });
                });
              };

              _proto.unwrap = function unwrap() {
                return this.actualWindow || this;
              };

              _proto.getInstanceID = function getInstanceID() {
                return this.serializedWindow.getInstanceID();
              };

              _proto.shouldClean = function shouldClean() {
                return Boolean(this.actualWindow && isWindowClosed(this.actualWindow));
              };

              _proto.serialize = function serialize() {
                return this.serializedWindow;
              };

              ProxyWindow.unwrap = function unwrap(win) {
                return ProxyWindow.isProxyWindow(win) // $FlowFixMe
                ? win.unwrap() : win;
              };

              ProxyWindow.serialize = function serialize(win, _ref7) {
                var send = _ref7.send;
                cleanupProxyWindows();
                return ProxyWindow.toProxyWindow(win, {
                  send: send
                }).serialize();
              };

              ProxyWindow.deserialize = function deserialize(serializedWindow, _ref8) {
                var send = _ref8.send;
                cleanupProxyWindows();
                return globalStore('idToProxyWindow').get(serializedWindow.id) || new ProxyWindow({
                  serializedWindow: serializedWindow,
                  send: send
                });
              };

              ProxyWindow.isProxyWindow = function isProxyWindow(obj) {
                // $FlowFixMe
                return Boolean(obj && !isWindow(obj) && obj.isProxyWindow);
              };

              ProxyWindow.toProxyWindow = function toProxyWindow(win, _ref9) {
                var send = _ref9.send;
                cleanupProxyWindows();

                if (ProxyWindow.isProxyWindow(win)) {
                  // $FlowFixMe
                  return win;
                } // $FlowFixMe


                var actualWindow = win;
                return windowStore('winToProxyWindow').get(actualWindow) || new ProxyWindow({
                  win: actualWindow,
                  send: send
                });
              };

              return ProxyWindow;
            }();
            function serializeWindow(destination, domain, win, _ref10) {
              var send = _ref10.send;
              return serializeType(SERIALIZATION_TYPE.CROSS_DOMAIN_WINDOW, window_ProxyWindow.serialize(win, {
                send: send
              }));
            }
            function deserializeWindow(source, origin, win, _ref11) {
              var send = _ref11.send;
              return window_ProxyWindow.deserialize(win, {
                send: send
              });
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/serialize/function.js








            function addMethod(id, val, name, source, domain) {
              var methodStore = windowStore('methodStore');
              var proxyWindowMethods = globalStore('proxyWindowMethods');

              if (window_ProxyWindow.isProxyWindow(source)) {
                proxyWindowMethods.set(id, {
                  val: val,
                  name: name,
                  domain: domain,
                  source: source
                });
              } else {
                proxyWindowMethods.del(id); // $FlowFixMe

                var methods = methodStore.getOrSet(source, function () {
                  return {};
                });
                methods[id] = {
                  domain: domain,
                  name: name,
                  val: val,
                  source: source
                };
              }
            }

            function lookupMethod(source, id) {
              var methodStore = windowStore('methodStore');
              var proxyWindowMethods = globalStore('proxyWindowMethods');
              var methods = methodStore.getOrSet(source, function () {
                return {};
              });
              return methods[id] || proxyWindowMethods.get(id);
            }

            function listenForFunctionCalls(_ref) {
              var on = _ref.on,
                  send = _ref.send;
              return globalStore('builtinListeners').getOrSet('functionCalls', function () {
                return on(MESSAGE_NAME.METHOD, {
                  domain: constants_WILDCARD
                }, function (_ref2) {
                  var source = _ref2.source,
                      origin = _ref2.origin,
                      data = _ref2.data;
                  var id = data.id,
                      name = data.name;
                  var meth = lookupMethod(source, id);

                  if (!meth) {
                    throw new Error("Could not find method '" + name + "' with id: " + data.id + " in " + utils_getDomain(window));
                  }

                  var methodSource = meth.source,
                      domain = meth.domain,
                      val = meth.val;
                  return promise_ZalgoPromise.try(function () {
                    if (!matchDomain(domain, origin)) {
                      // $FlowFixMe
                      throw new Error("Method '" + data.name + "' domain " + JSON.stringify(util_isRegex(meth.domain) ? meth.domain.source : meth.domain) + " does not match origin " + origin + " in " + utils_getDomain(window));
                    }

                    if (window_ProxyWindow.isProxyWindow(methodSource)) {
                      // $FlowFixMe
                      return methodSource.matchWindow(source, {
                        send: send
                      }).then(function (match) {
                        if (!match) {
                          throw new Error("Method call '" + data.name + "' failed - proxy window does not match source in " + utils_getDomain(window));
                        }
                      });
                    }
                  }).then(function () {
                    return val.apply({
                      source: source,
                      origin: origin
                    }, data.args);
                  }, function (err) {
                    return promise_ZalgoPromise.try(function () {
                      if (val.onError) {
                        return val.onError(err);
                      }
                    }).then(function () {
                      // $FlowFixMe
                      if (err.stack) {
                        // $FlowFixMe
                        err.stack = "Remote call to " + name + "()\n\n" + err.stack;
                      }

                      throw err;
                    });
                  }).then(function (result) {
                    return {
                      result: result,
                      id: id,
                      name: name
                    };
                  });
                });
              });
            }

            function function_serializeFunction(destination, domain, val, key, _ref3) {
              var on = _ref3.on,
                  send = _ref3.send;
              listenForFunctionCalls({
                on: on,
                send: send
              });
              var id = val.__id__ || uniqueID();
              destination = window_ProxyWindow.unwrap(destination);
              var name = val.__name__ || val.name || key;

              if (typeof name === 'string' && typeof name.indexOf === 'function' && name.indexOf('anonymous::') === 0) {
                name = name.replace('anonymous::', key + "::");
              }

              if (window_ProxyWindow.isProxyWindow(destination)) {
                addMethod(id, val, name, destination, domain); // $FlowFixMe

                destination.awaitWindow().then(function (win) {
                  addMethod(id, val, name, win, domain);
                });
              } else {
                addMethod(id, val, name, destination, domain);
              }

              return serializeType(SERIALIZATION_TYPE.CROSS_DOMAIN_FUNCTION, {
                id: id,
                name: name
              });
            }
            function function_deserializeFunction(source, origin, _ref4, _ref5) {
              var id = _ref4.id,
                  name = _ref4.name;
              var send = _ref5.send;

              var getDeserializedFunction = function getDeserializedFunction(opts) {
                if (opts === void 0) {
                  opts = {};
                }

                function crossDomainFunctionWrapper() {
                  var _arguments = arguments;

                  return window_ProxyWindow.toProxyWindow(source, {
                    send: send
                  }).awaitWindow().then(function (win) {
                    var meth = lookupMethod(win, id);

                    if (meth && meth.val !== crossDomainFunctionWrapper) {
                      return meth.val.apply({
                        source: window,
                        origin: utils_getDomain()
                      }, _arguments);
                    } else {
                      // $FlowFixMe
                      var options = {
                        domain: origin,
                        fireAndForget: opts.fireAndForget
                      };

                      var _args = Array.prototype.slice.call(_arguments);

                      return send(win, MESSAGE_NAME.METHOD, {
                        id: id,
                        name: name,
                        args: _args
                      }, options).then(function (res) {
                        if (!opts.fireAndForget) {
                          return res.data.result;
                        }
                      });
                    }
                  }).catch(function (err) {

                    throw err;
                  });
                }

                crossDomainFunctionWrapper.__name__ = name;
                crossDomainFunctionWrapper.__origin__ = origin;
                crossDomainFunctionWrapper.__source__ = source;
                crossDomainFunctionWrapper.__id__ = id;
                crossDomainFunctionWrapper.origin = origin;
                return crossDomainFunctionWrapper;
              };

              var crossDomainFunctionWrapper = getDeserializedFunction();
              crossDomainFunctionWrapper.fireAndForget = getDeserializedFunction({
                fireAndForget: true
              });
              return crossDomainFunctionWrapper;
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/serialize/promise.js





            function promise_serializePromise(destination, domain, val, key, _ref) {
              var on = _ref.on,
                  send = _ref.send;
              return serializeType(SERIALIZATION_TYPE.CROSS_DOMAIN_ZALGO_PROMISE, {
                then: function_serializeFunction(destination, domain, function (resolve, reject) {
                  return val.then(resolve, reject);
                }, key, {
                  on: on,
                  send: send
                })
              });
            }
            function promise_deserializePromise(source, origin, _ref2) {
              var then = _ref2.then;
              return new promise_ZalgoPromise(then);
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/serialize/serialize.js






            function serializeMessage(destination, domain, obj, _ref) {
              var _serialize;

              var on = _ref.on,
                  send = _ref.send;
              return serialize(obj, (_serialize = {}, _serialize[TYPE.PROMISE] = function (val, key) {
                return promise_serializePromise(destination, domain, val, key, {
                  on: on,
                  send: send
                });
              }, _serialize[TYPE.FUNCTION] = function (val, key) {
                return function_serializeFunction(destination, domain, val, key, {
                  on: on,
                  send: send
                });
              }, _serialize[TYPE.OBJECT] = function (val) {
                return isWindow(val) || window_ProxyWindow.isProxyWindow(val) ? serializeWindow(destination, domain, val, {
                  on: on,
                  send: send
                }) : val;
              }, _serialize));
            }
            function deserializeMessage(source, origin, message, _ref2) {
              var _deserialize;

              var on = _ref2.on,
                  send = _ref2.send;
              return deserialize_deserialize(message, (_deserialize = {}, _deserialize[SERIALIZATION_TYPE.CROSS_DOMAIN_ZALGO_PROMISE] = function (serializedPromise) {
                return promise_deserializePromise(source, origin, serializedPromise);
              }, _deserialize[SERIALIZATION_TYPE.CROSS_DOMAIN_FUNCTION] = function (serializedFunction) {
                return function_deserializeFunction(source, origin, serializedFunction, {
                  on: on,
                  send: send
                });
              }, _deserialize[SERIALIZATION_TYPE.CROSS_DOMAIN_WINDOW] = function (serializedWindow) {
                return deserializeWindow(source, origin, serializedWindow, {
                  send: send
                });
              }, _deserialize));
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/serialize/index.js




            // CONCATENATED MODULE: ./node_modules/post-robot/src/drivers/send/strategies.js





            var SEND_MESSAGE_STRATEGIES = {};

            SEND_MESSAGE_STRATEGIES[SEND_STRATEGY.POST_MESSAGE] = function (win, serializedMessage, domain) {

              var domains;

              if (Array.isArray(domain)) {
                domains = domain;
              } else if (typeof domain === 'string') {
                domains = [domain];
              } else {
                domains = [constants_WILDCARD];
              }

              domains = domains.map(function (dom) {

                if (dom.indexOf(PROTOCOL.FILE) === 0) {
                  return constants_WILDCARD;
                }

                return dom;
              });
              domains.forEach(function (dom) {
                win.postMessage(serializedMessage, dom);
              });
            };

            {
              SEND_MESSAGE_STRATEGIES[SEND_STRATEGY.GLOBAL] = function (win, serializedMessage) {
                if (!needsGlobalMessagingForBrowser()) {
                  throw new Error("Global messaging not needed for browser");
                }

                if (!isSameDomain(win)) {
                  throw new Error("Post message through global disabled between different domain windows");
                }

                if (isSameTopWindow(window, win) !== false) {
                  throw new Error("Can only use global to communicate between two different windows, not between frames");
                } // $FlowFixMe


                var foreignGlobal = global_getGlobal(win);

                if (!foreignGlobal) {
                  throw new Error("Can not find postRobot global on foreign window");
                }

                foreignGlobal.receiveMessage({
                  source: window,
                  origin: utils_getDomain(),
                  data: serializedMessage
                });
              };
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/drivers/send/index.js





            function send_sendMessage(win, domain, message, _ref) {
              var _serializeMessage;

              var on = _ref.on,
                  send = _ref.send;

              if (isWindowClosed(win)) {
                throw new Error('Window is closed');
              }

              var serializedMessage = serializeMessage(win, domain, (_serializeMessage = {}, _serializeMessage["__post_robot_10_0_29__"] = _extends({
                id: uniqueID(),
                origin: utils_getDomain(window)
              }, message), _serializeMessage), {
                on: on,
                send: send
              });
              var strategies = Object.keys(SEND_MESSAGE_STRATEGIES);
              var errors = [];

              for (var _i2 = 0; _i2 < strategies.length; _i2++) {
                var strategyName = strategies[_i2];

                try {
                  SEND_MESSAGE_STRATEGIES[strategyName](win, serializedMessage, domain);
                } catch (err) {
                  errors.push(err);
                }
              }

              if (errors.length === strategies.length) {
                throw new Error("All post-robot messaging strategies failed:\n\n" + errors.map(function (err, i) {
                  return i + ". " + stringifyError(err);
                }).join('\n\n'));
              }
            }
            var __DOMAIN_REGEX__ = '__domain_regex__';
            function addResponseListener(hash, listener) {
              var responseListeners = globalStore('responseListeners');
              responseListeners.set(hash, listener);
            }
            function getResponseListener(hash) {
              var responseListeners = globalStore('responseListeners');
              return responseListeners.get(hash);
            }
            function deleteResponseListener(hash) {
              var responseListeners = globalStore('responseListeners');
              responseListeners.del(hash);
            }
            function cancelResponseListeners() {
              var responseListeners = globalStore('responseListeners');

              for (var _i2 = 0, _responseListeners$ke2 = responseListeners.keys(); _i2 < _responseListeners$ke2.length; _i2++) {
                var hash = _responseListeners$ke2[_i2];
                var listener = responseListeners.get(hash);

                if (listener) {
                  listener.cancelled = true;
                }

                responseListeners.del(hash);
              }
            }
            function markResponseListenerErrored(hash) {
              var erroredResponseListeners = globalStore('erroredResponseListeners');
              erroredResponseListeners.set(hash, true);
            }
            function isResponseListenerErrored(hash) {
              var erroredResponseListeners = globalStore('erroredResponseListeners');
              return erroredResponseListeners.has(hash);
            }
            function getRequestListener(_ref) {
              var name = _ref.name,
                  win = _ref.win,
                  domain = _ref.domain;
              var requestListeners = windowStore('requestListeners');

              if (win === constants_WILDCARD) {
                win = null;
              }

              if (domain === constants_WILDCARD) {
                domain = null;
              }

              if (!name) {
                throw new Error("Name required to get request listener");
              }

              for (var _i4 = 0, _ref3 = [win, getWildcard()]; _i4 < _ref3.length; _i4++) {
                var winQualifier = _ref3[_i4];

                if (!winQualifier) {
                  continue;
                }

                var nameListeners = requestListeners.get(winQualifier);

                if (!nameListeners) {
                  continue;
                }

                var domainListeners = nameListeners[name];

                if (!domainListeners) {
                  continue;
                }

                if (domain && typeof domain === 'string') {
                  if (domainListeners[domain]) {
                    return domainListeners[domain];
                  }

                  if (domainListeners[__DOMAIN_REGEX__]) {
                    for (var _i6 = 0, _domainListeners$__DO2 = domainListeners[__DOMAIN_REGEX__]; _i6 < _domainListeners$__DO2.length; _i6++) {
                      var _domainListeners$__DO3 = _domainListeners$__DO2[_i6],
                          regex = _domainListeners$__DO3.regex,
                          listener = _domainListeners$__DO3.listener;

                      if (matchDomain(regex, domain)) {
                        return listener;
                      }
                    }
                  }
                }

                if (domainListeners[constants_WILDCARD]) {
                  return domainListeners[constants_WILDCARD];
                }
              }
            }
            function addRequestListener(_ref4, listener) {
              var name = _ref4.name,
                  win = _ref4.win,
                  domain = _ref4.domain;
              var requestListeners = windowStore('requestListeners');

              if (!name || typeof name !== 'string') {
                throw new Error("Name required to add request listener");
              }

              if (Array.isArray(win)) {
                var listenersCollection = [];

                for (var _i8 = 0, _win2 = win; _i8 < _win2.length; _i8++) {
                  var item = _win2[_i8];
                  listenersCollection.push(addRequestListener({
                    name: name,
                    domain: domain,
                    win: item
                  }, listener));
                }

                return {
                  cancel: function cancel() {
                    for (var _i10 = 0; _i10 < listenersCollection.length; _i10++) {
                      var cancelListener = listenersCollection[_i10];
                      cancelListener.cancel();
                    }
                  }
                };
              }

              if (Array.isArray(domain)) {
                var _listenersCollection = [];

                for (var _i12 = 0, _domain2 = domain; _i12 < _domain2.length; _i12++) {
                  var _item = _domain2[_i12];

                  _listenersCollection.push(addRequestListener({
                    name: name,
                    win: win,
                    domain: _item
                  }, listener));
                }

                return {
                  cancel: function cancel() {
                    for (var _i14 = 0; _i14 < _listenersCollection.length; _i14++) {
                      var cancelListener = _listenersCollection[_i14];
                      cancelListener.cancel();
                    }
                  }
                };
              }

              var existingListener = getRequestListener({
                name: name,
                win: win,
                domain: domain
              });

              if (!win || win === constants_WILDCARD) {
                win = getWildcard();
              }

              domain = domain || constants_WILDCARD;

              if (existingListener) {
                if (win && domain) {
                  throw new Error("Request listener already exists for " + name + " on domain " + domain.toString() + " for " + (win === getWildcard() ? 'wildcard' : 'specified') + " window");
                } else if (win) {
                  throw new Error("Request listener already exists for " + name + " for " + (win === getWildcard() ? 'wildcard' : 'specified') + " window");
                } else if (domain) {
                  throw new Error("Request listener already exists for " + name + " on domain " + domain.toString());
                } else {
                  throw new Error("Request listener already exists for " + name);
                }
              }

              var nameListeners = requestListeners.getOrSet(win, function () {
                return {};
              });
              var domainListeners = util_getOrSet(nameListeners, name, function () {
                return {};
              });
              var strDomain = domain.toString();
              var regexListeners;
              var regexListener;

              if (util_isRegex(domain)) {
                regexListeners = util_getOrSet(domainListeners, __DOMAIN_REGEX__, function () {
                  return [];
                });
                regexListener = {
                  regex: domain,
                  listener: listener
                };
                regexListeners.push(regexListener);
              } else {
                domainListeners[strDomain] = listener;
              }

              return {
                cancel: function cancel() {
                  delete domainListeners[strDomain];

                  if (regexListener) {
                    regexListeners.splice(regexListeners.indexOf(regexListener, 1));

                    if (!regexListeners.length) {
                      delete domainListeners[__DOMAIN_REGEX__];
                    }
                  }

                  if (!Object.keys(domainListeners).length) {
                    delete nameListeners[name];
                  }

                  if (win && !Object.keys(nameListeners).length) {
                    requestListeners.del(win);
                  }
                }
              };
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/drivers/receive/types.js


            var _RECEIVE_MESSAGE_TYPE;







            var RECEIVE_MESSAGE_TYPES = (_RECEIVE_MESSAGE_TYPE = {}, _RECEIVE_MESSAGE_TYPE[MESSAGE_TYPE.REQUEST] = function (source, origin, message, _ref) {
              var on = _ref.on,
                  send = _ref.send;
              var options = getRequestListener({
                name: message.name,
                win: source,
                domain: origin
              });
              var logName = message.name === MESSAGE_NAME.METHOD && message.data && typeof message.data.name === 'string' ? message.data.name + "()" : message.name;

              function sendResponse(type, ack, response) {
                if (response === void 0) {
                  response = {};
                }

                if (message.fireAndForget || isWindowClosed(source)) {
                  return;
                }

                try {
                  // $FlowFixMe
                  send_sendMessage(source, origin, _extends({
                    type: type,
                    ack: ack,
                    hash: message.hash,
                    name: message.name
                  }, response), {
                    on: on,
                    send: send
                  });
                } catch (err) {
                  throw new Error("Send response message failed for " + logName + " in " + utils_getDomain() + "\n\n" + stringifyError(err));
                }
              }

              return promise_ZalgoPromise.all([sendResponse(MESSAGE_TYPE.ACK), promise_ZalgoPromise.try(function () {
                if (!options) {
                  throw new Error("No handler found for post message: " + message.name + " from " + origin + " in " + window.location.protocol + "//" + window.location.host + window.location.pathname);
                }

                if (!matchDomain(options.domain, origin)) {
                  throw new Error("Request origin " + origin + " does not match domain " + options.domain.toString());
                }

                var data = message.data;
                return options.handler({
                  source: source,
                  origin: origin,
                  data: data
                });
              }).then(function (data) {
                return sendResponse(MESSAGE_TYPE.RESPONSE, MESSAGE_ACK.SUCCESS, {
                  data: data
                });
              }, function (error) {
                return sendResponse(MESSAGE_TYPE.RESPONSE, MESSAGE_ACK.ERROR, {
                  error: error
                });
              })]).then(src_util_noop).catch(function (err) {
                if (options && options.handleError) {
                  return options.handleError(err);
                } else {
                  throw err;
                }
              });
            }, _RECEIVE_MESSAGE_TYPE[MESSAGE_TYPE.ACK] = function (source, origin, message) {
              if (isResponseListenerErrored(message.hash)) {
                return;
              }

              var options = getResponseListener(message.hash);

              if (!options) {
                throw new Error("No handler found for post message ack for message: " + message.name + " from " + origin + " in " + window.location.protocol + "//" + window.location.host + window.location.pathname);
              }

              try {
                if (!matchDomain(options.domain, origin)) {
                  throw new Error("Ack origin " + origin + " does not match domain " + options.domain.toString());
                }

                if (source !== options.win) {
                  throw new Error("Ack source does not match registered window");
                }
              } catch (err) {
                options.promise.reject(err);
              }

              options.ack = true;
            }, _RECEIVE_MESSAGE_TYPE[MESSAGE_TYPE.RESPONSE] = function (source, origin, message) {
              if (isResponseListenerErrored(message.hash)) {
                return;
              }

              var options = getResponseListener(message.hash);

              if (!options) {
                throw new Error("No handler found for post message response for message: " + message.name + " from " + origin + " in " + window.location.protocol + "//" + window.location.host + window.location.pathname);
              }

              if (!matchDomain(options.domain, origin)) {
                throw new Error("Response origin " + origin + " does not match domain " + stringifyDomainPattern(options.domain));
              }

              if (source !== options.win) {
                throw new Error("Response source does not match registered window");
              }

              deleteResponseListener(message.hash);
              var logName = message.name === MESSAGE_NAME.METHOD && message.data && typeof message.data.name === 'string' ? message.data.name + "()" : message.name;

              if (message.ack === MESSAGE_ACK.ERROR) {

                options.promise.reject(message.error);
              } else if (message.ack === MESSAGE_ACK.SUCCESS) {

                options.promise.resolve({
                  source: source,
                  origin: origin,
                  data: message.data
                });
              }
            }, _RECEIVE_MESSAGE_TYPE);
            // CONCATENATED MODULE: ./node_modules/post-robot/src/drivers/receive/index.js







            function parseMessage(message, source, origin, _ref) {
              var on = _ref.on,
                  send = _ref.send;
              var parsedMessage;

              try {
                parsedMessage = deserializeMessage(source, origin, message, {
                  on: on,
                  send: send
                });
              } catch (err) {
                return;
              }

              if (!parsedMessage) {
                return;
              }

              if (typeof parsedMessage !== 'object' || parsedMessage === null) {
                return;
              }

              parsedMessage = parsedMessage["__post_robot_10_0_29__"];

              if (!parsedMessage || typeof parsedMessage !== 'object' || parsedMessage === null) {
                return;
              }

              if (!parsedMessage.type || typeof parsedMessage.type !== 'string') {
                return;
              }

              if (!RECEIVE_MESSAGE_TYPES[parsedMessage.type]) {
                return;
              }

              return parsedMessage;
            }

            function receive_receiveMessage(event, _ref2) {
              var on = _ref2.on,
                  send = _ref2.send;
              var receivedMessages = globalStore('receivedMessages');

              try {
                if (!window || window.closed || !event.source) {
                  return;
                }
              } catch (err) {
                return;
              }

              var source = event.source,
                  origin = event.origin,
                  data = event.data;

              var message = parseMessage(data, source, origin, {
                on: on,
                send: send
              });

              if (!message) {
                return;
              }

              markWindowKnown(source);

              if (receivedMessages.has(message.id)) {
                return;
              }

              receivedMessages.set(message.id, true);

              if (isWindowClosed(source) && !message.fireAndForget) {
                return;
              }

              if (message.origin.indexOf(PROTOCOL.FILE) === 0) {
                origin = PROTOCOL.FILE + "//";
              }

              RECEIVE_MESSAGE_TYPES[message.type](source, origin, message, {
                on: on,
                send: send
              });
            }
            function setupGlobalReceiveMessage(_ref3) {
              var on = _ref3.on,
                  send = _ref3.send;
              var global = global_getGlobal();

              global.receiveMessage = global.receiveMessage || function (message) {
                return receive_receiveMessage(message, {
                  on: on,
                  send: send
                });
              };
            }
            function messageListener(event, _ref4) {
              var on = _ref4.on,
                  send = _ref4.send;

              try {
                src_util_noop(event.source);
              } catch (err) {
                return;
              }

              var source = event.source || event.sourceElement;
              var origin = event.origin || event.originalEvent && event.originalEvent.origin;
              var data = event.data;

              if (origin === 'null') {
                origin = PROTOCOL.FILE + "//";
              }

              if (!source) {
                return;
              }

              if (!origin) {
                throw new Error("Post message did not have origin domain");
              }

              receive_receiveMessage({
                source: source,
                origin: origin,
                data: data
              }, {
                on: on,
                send: send
              });
            }
            function listenForMessages(_ref5) {
              var on = _ref5.on,
                  send = _ref5.send;
              return globalStore().getOrSet('postMessageListener', function () {
                return addEventListener(window, 'message', function (event) {
                  // $FlowFixMe
                  messageListener(event, {
                    on: on,
                    send: send
                  });
                });
              });
            }
            function stopListenForMessages() {
              var listener = globalStore().get('postMessageListener');

              if (listener) {
                listener.cancel();
              }
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/drivers/index.js



            // CONCATENATED MODULE: ./node_modules/post-robot/src/public/on.js



            function on_on(name, options, handler) {
              if (!name) {
                throw new Error('Expected name');
              }

              if (typeof options === 'function') {
                handler = options; // $FlowFixMe

                options = {};
              }

              if (!handler) {
                throw new Error('Expected handler');
              }

              options = options || {};
              options.name = name;
              options.handler = handler || options.handler;
              var win = options.window;
              var domain = options.domain;
              var listenerOptions = {
                handler: options.handler,
                handleError: options.errorHandler || function (err) {
                  throw err;
                },
                window: win,
                domain: domain || constants_WILDCARD,
                name: name
              };
              var requestListener = addRequestListener({
                name: name,
                win: win,
                domain: domain
              }, listenerOptions);
              return {
                cancel: function cancel() {
                  requestListener.cancel();
                }
              };
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/public/send.js









            function validateOptions(name, win, domain) {
              if (!name) {
                throw new Error('Expected name');
              }

              if (domain) {
                if (typeof domain !== 'string' && !Array.isArray(domain) && !util_isRegex(domain)) {
                  throw new TypeError("Expected domain to be a string, array, or regex");
                }
              }

              if (isWindowClosed(win)) {
                throw new Error('Target window is closed');
              }
            }

            function normalizeDomain(win, targetDomain, actualDomain, _ref) {
              var send = _ref.send;

              if (typeof targetDomain === 'string') {
                return promise_ZalgoPromise.resolve(targetDomain);
              }

              return promise_ZalgoPromise.try(function () {
                return actualDomain || sayHello(win, {
                  send: send
                }).then(function (_ref2) {
                  var domain = _ref2.domain;
                  return domain;
                });
              }).then(function (normalizedDomain) {
                if (!matchDomain(targetDomain, targetDomain)) {
                  throw new Error("Domain " + stringify(targetDomain) + " does not match " + stringify(targetDomain));
                }

                return normalizedDomain;
              });
            }

            var send_send = function send(win, name, data, options) {
              options = options || {};
              var domain = options.domain || constants_WILDCARD;
              var responseTimeout = options.timeout || RES_TIMEOUT;
              var childTimeout = options.timeout || CHILD_WINDOW_TIMEOUT;
              var fireAndForget = options.fireAndForget || false; // $FlowFixMe

              return promise_ZalgoPromise.try(function () {
                validateOptions(name, win, domain);

                if (isAncestor(window, win)) {
                  return awaitWindowHello(win, childTimeout);
                }
              }).then(function (_temp) {
                var _ref3 = _temp === void 0 ? {} : _temp,
                    actualDomain = _ref3.domain;

                return normalizeDomain(win, domain, actualDomain, {
                  send: send
                });
              }).then(function (targetDomain) {
                domain = targetDomain;
                var logName = name === MESSAGE_NAME.METHOD && data && typeof data.name === 'string' ? data.name + "()" : name;

                var promise = new promise_ZalgoPromise();
                var hash = name + "_" + uniqueID();

                if (!fireAndForget) {
                  var responseListener = {
                    name: name,
                    win: win,
                    domain: domain,
                    promise: promise
                  };
                  addResponseListener(hash, responseListener);
                  var reqPromises = windowStore('requestPromises').getOrSet(win, function () {
                    return [];
                  });
                  reqPromises.push(promise);
                  promise.catch(function () {
                    markResponseListenerErrored(hash);
                    deleteResponseListener(hash);
                  });
                  var totalAckTimeout = isWindowKnown(win) ? ACK_TIMEOUT_KNOWN : ACK_TIMEOUT;
                  var totalResTimeout = responseTimeout;
                  var ackTimeout = totalAckTimeout;
                  var resTimeout = totalResTimeout;
                  var interval = safeInterval(function () {
                    if (isWindowClosed(win)) {
                      return promise.reject(new Error("Window closed for " + name + " before " + (responseListener.ack ? 'response' : 'ack')));
                    }

                    if (responseListener.cancelled) {
                      return promise.reject(new Error("Response listener was cancelled for " + name));
                    }

                    ackTimeout = Math.max(ackTimeout - RESPONSE_CYCLE_TIME, 0);

                    if (resTimeout !== -1) {
                      resTimeout = Math.max(resTimeout - RESPONSE_CYCLE_TIME, 0);
                    }

                    if (!responseListener.ack && ackTimeout === 0) {
                      return promise.reject(new Error("No ack for postMessage " + logName + " in " + utils_getDomain() + " in " + totalAckTimeout + "ms"));
                    } else if (resTimeout === 0) {
                      return promise.reject(new Error("No response for postMessage " + logName + " in " + utils_getDomain() + " in " + totalResTimeout + "ms"));
                    }
                  }, RESPONSE_CYCLE_TIME);
                  promise.finally(function () {
                    interval.cancel();
                    reqPromises.splice(reqPromises.indexOf(promise, 1));
                  }).catch(src_util_noop);
                }

                try {
                  send_sendMessage(win, domain, {
                    type: MESSAGE_TYPE.REQUEST,
                    hash: hash,
                    name: name,
                    data: data,
                    fireAndForget: fireAndForget
                  }, {
                    on: on_on,
                    send: send
                  });
                } catch (err) {
                  throw new Error("Send request message failed for " + logName + " in " + utils_getDomain() + "\n\n" + stringifyError(err));
                }

                return fireAndForget ? promise.resolve() : promise;
              });
            };
            // CONCATENATED MODULE: ./node_modules/post-robot/src/public/index.js


            // CONCATENATED MODULE: ./node_modules/post-robot/src/setup.js






            function setup_serializeMessage(destination, domain, obj) {
              return serializeMessage(destination, domain, obj, {
                on: on_on,
                send: send_send
              });
            }
            function setup_deserializeMessage(source, origin, message) {
              return deserializeMessage(source, origin, message, {
                on: on_on,
                send: send_send
              });
            }
            function setup_toProxyWindow(win) {
              return window_ProxyWindow.toProxyWindow(win, {
                send: send_send
              });
            }
            function setup() {
              if (!global_getGlobal().initialized) {
                global_getGlobal().initialized = true;
                setupGlobalReceiveMessage({
                  on: on_on,
                  send: send_send
                });
                listenForMessages({
                  on: on_on,
                  send: send_send
                });

                initHello({
                  on: on_on,
                  send: send_send
                });
              }
            }
            function setup_destroy() {
              cancelResponseListeners();
              stopListenForMessages();
              deleteGlobal();
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/clean.js


            function cleanUpWindow(win) {
              var requestPromises = windowStore('requestPromises');

              for (var _i2 = 0, _requestPromises$get2 = requestPromises.get(win, []); _i2 < _requestPromises$get2.length; _i2++) {
                var promise = _requestPromises$get2[_i2];
                promise.reject(new Error("Window cleaned up before response")).catch(src_util_noop);
              }
            }
            // CONCATENATED MODULE: ./src/lib/global.js

            function lib_global_getGlobal(win) {
              if (win === void 0) {
                win = window;
              }

              if (!isSameDomain(win)) {
                throw new Error("Can not get global for window on different domain");
              }

              if (!win["__zoid_9_0_37__"]) {
                win["__zoid_9_0_37__"] = {};
              }

              return win["__zoid_9_0_37__"];
            }
            function destroyGlobal() {
              delete window["__zoid_9_0_37__"];
            }
            // CONCATENATED MODULE: ./src/lib/serialize.js

            function getProxyObject(obj) {
              return {
                get: function get() {
                  var _this = this;

                  return promise_ZalgoPromise.try(function () {
                    if (_this.source && _this.source !== window) {
                      throw new Error("Can not call get on proxy object from a remote window");
                    }

                    return obj;
                  });
                }
              };
            }
            // CONCATENATED MODULE: ./src/lib/index.js


            // CONCATENATED MODULE: ./src/constants.js

            var ZOID = "zoid";
            var POST_MESSAGE = {
              DELEGATE: ZOID + "_delegate",
              ALLOW_DELEGATE: ZOID + "_allow_delegate"
            };
            var PROP_TYPE = {
              STRING: "string",
              OBJECT: "object",
              FUNCTION: "function",
              BOOLEAN: "boolean",
              NUMBER: "number",
              ARRAY: "array"
            };
            var INITIAL_PROPS = {
              RAW: 'raw',
              UID: 'uid'
            };
            var WINDOW_REFERENCES = {
              OPENER: 'opener',
              PARENT: 'parent',
              GLOBAL: 'global'
            };
            var PROP_SERIALIZATION = {
              JSON: 'json',
              DOTIFY: 'dotify',
              BASE64: 'base64'
            };
            var CONTEXT = WINDOW_TYPE;
            var src_constants_WILDCARD = '*';
            var DEFAULT_DIMENSIONS = {
              WIDTH: '300px',
              HEIGHT: '150px'
            };
            var EVENT = {
              RENDER: 'zoid-render',
              RENDERED: 'zoid-rendered',
              DISPLAY: 'zoid-display',
              ERROR: 'zoid-error',
              CLOSE: 'zoid-close',
              PROPS: 'zoid-props',
              RESIZE: 'zoid-resize',
              FOCUS: 'zoid-focus'
            };
            // CONCATENATED MODULE: ./src/child/props.js

            function normalizeChildProp(component, props, key, value, helpers) {
              // $FlowFixMe
              var prop = component.getPropDefinition(key);

              if (!prop) {
                return value;
              }

              if (typeof prop.childDecorate === 'function') {
                var close = helpers.close,
                    focus = helpers.focus,
                    onError = helpers.onError,
                    onProps = helpers.onProps,
                    resize = helpers.resize,
                    getParent = helpers.getParent,
                    getParentDomain = helpers.getParentDomain,
                    show = helpers.show,
                    hide = helpers.hide;
                return prop.childDecorate({
                  value: value,
                  close: close,
                  focus: focus,
                  onError: onError,
                  onProps: onProps,
                  resize: resize,
                  getParent: getParent,
                  getParentDomain: getParentDomain,
                  show: show,
                  hide: hide
                });
              }

              return value;
            } // eslint-disable-next-line max-params

            function normalizeChildProps(parentComponentWindow, component, props, origin, helpers, isUpdate) {
              if (isUpdate === void 0) {
                isUpdate = false;
              }

              var result = {};

              for (var _i2 = 0, _Object$keys2 = Object.keys(props); _i2 < _Object$keys2.length; _i2++) {
                var key = _Object$keys2[_i2];
                var prop = component.getPropDefinition(key);

                if (prop && prop.sameDomain && (origin !== utils_getDomain(window) || !isSameDomain(parentComponentWindow))) {
                  continue;
                } // $FlowFixMe


                var value = normalizeChildProp(component, props, key, props[key], helpers);
                result[key] = value;

                if (prop && prop.alias && !result[prop.alias]) {
                  result[prop.alias] = value;
                }
              }

              if (!isUpdate) {
                for (var _i4 = 0, _component$getPropNam2 = component.getPropNames(); _i4 < _component$getPropNam2.length; _i4++) {
                  var _key = _component$getPropNam2[_i4];

                  if (!props.hasOwnProperty(_key)) {
                    result[_key] = normalizeChildProp(component, props, _key, props[_key], helpers);
                  }
                }
              } // $FlowFixMe


              return result;
            }
            // CONCATENATED MODULE: ./src/child/window.js



            function parseChildWindowName(windowName) {
              return inlineMemoize(parseChildWindowName, function () {
                if (!windowName) {
                  throw new Error("No window name");
                }

                var _windowName$split = windowName.split('__'),
                    zoidcomp = _windowName$split[1],
                    name = _windowName$split[2],
                    encodedPayload = _windowName$split[3];

                if (zoidcomp !== ZOID) {
                  throw new Error("Window not rendered by zoid - got " + zoidcomp);
                }

                if (!name) {
                  throw new Error("Expected component name");
                }

                if (!encodedPayload) {
                  throw new Error("Expected encoded payload");
                }

                try {
                  return JSON.parse(base64decode(encodedPayload));
                } catch (err) {
                  throw new Error("Can not decode window name payload: " + encodedPayload + ": " + stringifyError(err));
                }
              }, [windowName]);
            }

            function getChildPayload() {
              try {
                return parseChildWindowName(window.name);
              } catch (err) {// pass
              }
            }
            // CONCATENATED MODULE: ./src/child/index.js
            /* eslint max-lines: 0 */










            /*  Child Component
                ---------------

                This is the portion of code which runs inside the frame or popup window containing the component's implementation.

                When the component author calls myComponent.attach(), it creates a new instance of ChildComponent, which is then
                responsible for managing the state and messaging back up to the parent, and providing props for the component to
                utilize.
            */
            var child_ChildComponent =
            /*#__PURE__*/
            function () {
              // eslint-disable-line flowtype/no-mutable-array
              function ChildComponent(component) {
                var _this = this;

                this.component = void 0;
                this.props = void 0;
                this.context = void 0;
                this.parent = void 0;
                this.parentDomain = void 0;
                this.parentComponentWindow = void 0;
                this.onPropHandlers = void 0;
                this.autoResize = void 0;
                promise_ZalgoPromise.try(function () {
                  _this.component = component;
                  _this.onPropHandlers = [];
                  var childPayload = getChildPayload();

                  if (!childPayload) {
                    throw new Error("No child payload found");
                  }

                  if (childPayload.version !== "9_0_36") {
                    throw new Error("Parent window has zoid version " + childPayload.version + ", child window has version " + "9_0_36");
                  }

                  var parent = childPayload.parent,
                      parentDomain = childPayload.parentDomain,
                      exports = childPayload.exports,
                      context = childPayload.context,
                      props = childPayload.props;
                  _this.context = context;
                  _this.parentComponentWindow = _this.getParentComponentWindow(parent);
                  _this.parentDomain = parentDomain;
                  _this.parent = setup_deserializeMessage(_this.parentComponentWindow, parentDomain, exports);

                  _this.checkParentDomain(parentDomain);

                  var initialProps = _this.getPropsByRef(_this.parentComponentWindow, parentDomain, props);

                  _this.setProps(initialProps, parentDomain);

                  markWindowKnown(_this.parentComponentWindow);

                  _this.watchForClose();

                  return _this.parent.init(_this.buildExports());
                }).then(function () {
                  return _this.watchForResize();
                }).catch(function (err) {
                  _this.onError(err);
                });
              }

              var _proto = ChildComponent.prototype;

              _proto.getHelpers = function getHelpers() {
                var _this2 = this;

                return {
                  focus: function focus() {
                    return _this2.focus();
                  },
                  close: function close() {
                    return _this2.close();
                  },
                  resize: function resize(_ref) {
                    var width = _ref.width,
                        height = _ref.height;
                    return _this2.resize({
                      width: width,
                      height: height
                    });
                  },
                  onError: function onError(err) {
                    return _this2.onError(err);
                  },
                  onProps: function onProps(handler) {
                    return _this2.onProps(handler);
                  },
                  getParent: function getParent() {
                    return _this2.parentComponentWindow;
                  },
                  getParentDomain: function getParentDomain() {
                    return _this2.parentDomain;
                  },
                  show: function show() {
                    return _this2.show();
                  },
                  hide: function hide() {
                    return _this2.hide();
                  }
                };
              };

              _proto.show = function show() {
                return this.parent.show();
              };

              _proto.hide = function hide() {
                return this.parent.hide();
              };

              _proto.checkParentDomain = function checkParentDomain(domain) {
                if (!matchDomain(this.component.allowedParentDomains, domain)) {
                  throw new Error("Can not be rendered by domain: " + domain);
                }
              };

              _proto.onProps = function onProps(handler) {
                this.onPropHandlers.push(handler);
              };

              _proto.getPropsByRef = function getPropsByRef(parentComponentWindow, domain, _ref2) {
                var type = _ref2.type,
                    value = _ref2.value,
                    uid = _ref2.uid;
                var props;

                if (type === INITIAL_PROPS.RAW) {
                  props = value;
                } else if (type === INITIAL_PROPS.UID) {
                  if (!isSameDomain(parentComponentWindow)) {
                    throw new Error("Parent component window is on a different domain - expected " + utils_getDomain() + " - can not retrieve props");
                  }

                  var global = lib_global_getGlobal(parentComponentWindow);
                  props = assertExists('props', global && global.props[uid]);
                }

                if (!props) {
                  throw new Error("Could not find props");
                }

                return setup_deserializeMessage(parentComponentWindow, domain, props);
              };

              _proto.getParentComponentWindow = function getParentComponentWindow(ref) {
                var type = ref.type;

                if (type === WINDOW_REFERENCES.OPENER) {
                  return assertExists('opener', getOpener(window));
                } else if (type === WINDOW_REFERENCES.PARENT && typeof ref.distance === 'number') {
                  return assertExists('parent', getNthParentFromTop(window, ref.distance));
                } else if (type === WINDOW_REFERENCES.GLOBAL && ref.uid && typeof ref.uid === 'string') {
                  var uid = ref.uid;
                  var ancestor = getAncestor(window);

                  if (!ancestor) {
                    throw new Error("Can not find ancestor window");
                  }

                  for (var _i2 = 0, _getAllFramesInWindow2 = getAllFramesInWindow(ancestor); _i2 < _getAllFramesInWindow2.length; _i2++) {
                    var frame = _getAllFramesInWindow2[_i2];

                    if (isSameDomain(frame)) {
                      var global = lib_global_getGlobal(frame);

                      if (global && global.windows && global.windows[uid]) {
                        return global.windows[uid];
                      }
                    }
                  }
                }

                throw new Error("Unable to find " + type + " parent component window");
              };

              _proto.getProps = function getProps() {
                // $FlowFixMe
                this.props = this.props || {};
                return this.props;
              };

              _proto.setProps = function setProps(props, origin, isUpdate) {
                if (isUpdate === void 0) {
                  isUpdate = false;
                }

                var helpers = this.getHelpers();
                var existingProps = this.getProps();
                var normalizedProps = normalizeChildProps(this.parentComponentWindow, this.component, props, origin, helpers, isUpdate);
                extend(existingProps, normalizedProps);

                for (var _i4 = 0, _this$onPropHandlers2 = this.onPropHandlers; _i4 < _this$onPropHandlers2.length; _i4++) {
                  var handler = _this$onPropHandlers2[_i4];
                  handler.call(this, existingProps);
                }
              };

              _proto.watchForClose = function watchForClose() {
                var _this3 = this;

                window.addEventListener('beforeunload', function () {
                  _this3.parent.checkClose.fireAndForget();
                });
                window.addEventListener('unload', function () {
                  _this3.parent.checkClose.fireAndForget();
                });
                onCloseWindow(this.parentComponentWindow, function () {
                  _this3.destroy();
                });
              };

              _proto.getAutoResize = function getAutoResize() {
                var _ref3 = this.autoResize || this.component.autoResize || {},
                    _ref3$width = _ref3.width,
                    width = _ref3$width === void 0 ? false : _ref3$width,
                    _ref3$height = _ref3.height,
                    height = _ref3$height === void 0 ? false : _ref3$height,
                    _ref3$element = _ref3.element,
                    element = _ref3$element === void 0 ? 'body' : _ref3$element;

                element = getElementSafe(element);
                return {
                  width: width,
                  height: height,
                  element: element
                };
              };

              _proto.watchForResize = function watchForResize() {
                var _this4 = this;

                return waitForDocumentBody().then(function () {
                  var _this4$getAutoResize = _this4.getAutoResize(),
                      width = _this4$getAutoResize.width,
                      height = _this4$getAutoResize.height,
                      element = _this4$getAutoResize.element;

                  if (!element || !width && !height || _this4.context === CONTEXT.POPUP) {
                    return;
                  }

                  onResize(element, function (_ref4) {
                    var newWidth = _ref4.width,
                        newHeight = _ref4.height;

                    _this4.resize({
                      width: width ? newWidth : undefined,
                      height: height ? newHeight : undefined
                    });
                  }, {
                    width: width,
                    height: height
                  });
                });
              };

              _proto.buildExports = function buildExports() {
                var self = this;
                return {
                  updateProps: function updateProps(props) {
                    var _this5 = this;

                    return promise_ZalgoPromise.try(function () {
                      return self.setProps(props, _this5.__origin__, true);
                    });
                  },
                  close: function close() {
                    return promise_ZalgoPromise.try(function () {
                      return self.destroy();
                    });
                  }
                };
              };

              _proto.resize = function resize(_ref5) {
                var width = _ref5.width,
                    height = _ref5.height;
                return this.parent.resize.fireAndForget({
                  width: width,
                  height: height
                });
              };

              _proto.close = function close() {
                return this.parent.close();
              };

              _proto.destroy = function destroy() {
                return promise_ZalgoPromise.try(function () {
                  window.close();
                });
              };

              _proto.focus = function focus() {
                return promise_ZalgoPromise.try(function () {
                  window.focus();
                });
              };

              _proto.onError = function onError(err) {
                var _this6 = this;

                return promise_ZalgoPromise.try(function () {
                  if (_this6.parent && _this6.parent.onError) {
                    return _this6.parent.onError(err);
                  } else {
                    throw err;
                  }
                });
              };

              return ChildComponent;
            }();
            // CONCATENATED MODULE: ./src/parent/drivers.js







            var RENDER_DRIVERS = {};
            RENDER_DRIVERS[CONTEXT.IFRAME] = {
              openFrame: function openFrame(_ref) {
                var windowName = _ref.windowName;
                return getProxyObject(dom_iframe({
                  attributes: _extends({
                    name: windowName,
                    title: this.component.name
                  }, this.component.attributes.iframe)
                }));
              },
              open: function open(_ref2) {
                var _this = this;

                var proxyFrame = _ref2.proxyFrame;

                if (!proxyFrame) {
                  throw new Error("Expected proxy frame to be passed");
                }

                return proxyFrame.get().then(function (frame) {
                  return awaitFrameWindow(frame).then(function (win) {
                    var frameWatcher = watchElementForClose(frame, function () {
                      return _this.close();
                    });

                    _this.clean.register(function () {
                      return frameWatcher.cancel();
                    });

                    _this.clean.register(function () {
                      return destroyElement(frame);
                    });

                    _this.clean.register(function () {
                      return cleanUpWindow(win);
                    });

                    return win;
                  });
                });
              },
              openPrerenderFrame: function openPrerenderFrame() {
                return getProxyObject(dom_iframe({
                  attributes: _extends({
                    name: "__zoid_prerender_frame__" + this.component.name + "_" + uniqueID() + "__",
                    title: "prerender__" + this.component.name
                  }, this.component.attributes.iframe)
                }));
              },
              openPrerender: function openPrerender(proxyWin, proxyPrerenderFrame) {
                var _this2 = this;

                if (!proxyPrerenderFrame) {
                  throw new Error("Expected proxy frame to be passed");
                }

                return proxyPrerenderFrame.get().then(function (prerenderFrame) {
                  _this2.clean.register(function () {
                    return destroyElement(prerenderFrame);
                  });

                  return awaitFrameWindow(prerenderFrame).then(function (prerenderFrameWindow) {
                    return assertSameDomain(prerenderFrameWindow);
                  }).then(function (win) {
                    return setup_toProxyWindow(win);
                  });
                });
              },
              delegate: ['getProxyWindow', 'getProxyContainer', 'renderContainer', 'openFrame', 'openPrerenderFrame', 'prerender', 'open', 'openPrerender', 'show', 'hide']
            };
            // CONCATENATED MODULE: ./src/parent/props.js




            /*  Normalize Props
                ---------------

                Turn props into normalized values, using defaults, function options, etc.
            */
            function extendProps(component, props, inputProps, helpers, isUpdate) {
              if (isUpdate === void 0) {
                isUpdate = false;
              }

              // eslint-disable-line complexity
              // $FlowFixMe
              inputProps = inputProps || {};
              extend(props, inputProps);
              var propNames = isUpdate ? [] : [].concat(component.getPropNames());

              for (var _i2 = 0, _Object$keys2 = Object.keys(inputProps); _i2 < _Object$keys2.length; _i2++) {
                var key = _Object$keys2[_i2];

                if (propNames.indexOf(key) === -1) {
                  propNames.push(key);
                }
              }

              var aliases = [];
              var state = helpers.state,
                  close = helpers.close,
                  focus = helpers.focus,
                  event = helpers.event,
                  onError = helpers.onError;

              for (var _i4 = 0; _i4 < propNames.length; _i4++) {
                var _key = propNames[_i4];
                var propDef = component.getPropDefinition(_key);
                var value = inputProps[_key];

                if (!propDef) {
                  continue;
                }

                var alias = propDef.alias;

                if (alias) {
                  if (!isDefined(value) && isDefined(inputProps[alias])) {
                    value = inputProps[alias];
                  }

                  aliases.push(alias);
                }

                if (propDef.value) {
                  value = propDef.value({
                    props: props,
                    state: state,
                    close: close,
                    focus: focus,
                    event: event,
                    onError: onError
                  });
                }

                if (!isDefined(value) && propDef.default) {
                  value = propDef.default({
                    props: props,
                    state: state,
                    close: close,
                    focus: focus,
                    event: event,
                    onError: onError
                  });
                }

                if (isDefined(value)) {
                  if (propDef.type === 'array' ? !Array.isArray(value) : typeof value !== propDef.type) {
                    throw new TypeError("Prop is not of type " + propDef.type + ": " + _key);
                  }
                } // $FlowFixMe


                props[_key] = value;
              }

              for (var _i6 = 0; _i6 < aliases.length; _i6++) {
                var _alias = aliases[_i6];
                delete props[_alias];
              } // $FlowFixMe


              for (var _i8 = 0, _Object$keys4 = Object.keys(props); _i8 < _Object$keys4.length; _i8++) {
                var _key2 = _Object$keys4[_i8];

                var _propDef = component.getPropDefinition(_key2);

                var _value = props[_key2];

                if (!_propDef) {
                  continue;
                }

                if (isDefined(_value) && _propDef.validate) {
                  // $FlowFixMe
                  _propDef.validate({
                    value: _value,
                    props: props
                  });
                }

                if (isDefined(_value) && _propDef.decorate) {
                  props[_key2] = _propDef.decorate({
                    value: _value,
                    props: props,
                    state: state,
                    close: close,
                    focus: focus,
                    event: event,
                    onError: onError
                  });
                }
              }

              for (var _i10 = 0, _component$getPropNam2 = component.getPropNames(); _i10 < _component$getPropNam2.length; _i10++) {
                var _key3 = _component$getPropNam2[_i10];

                var _propDef2 = component.getPropDefinition(_key3);

                if (_propDef2.required !== false && !isDefined(props[_key3])) {
                  throw new Error("Expected prop \"" + _key3 + "\" to be defined");
                }
              }
            } // $FlowFixMe

            function props_getQueryParam(prop, key, value) {
              return promise_ZalgoPromise.try(function () {
                if (typeof prop.queryParam === 'function') {
                  return prop.queryParam({
                    value: value
                  });
                } else if (typeof prop.queryParam === 'string') {
                  return prop.queryParam;
                } else {
                  return key;
                }
              });
            } // $FlowFixMe


            function getQueryValue(prop, key, value) {
              return promise_ZalgoPromise.try(function () {
                if (typeof prop.queryValue === 'function' && isDefined(value)) {
                  return prop.queryValue({
                    value: value
                  });
                } else {
                  return value;
                }
              });
            }

            function propsToQuery(propsDef, props) {
              var params = {}; // $FlowFixMe

              var keys = Object.keys(props);
              return promise_ZalgoPromise.all(keys.map(function (key) {
                var prop = propsDef[key];

                if (!prop) {
                  return; // eslint-disable-line array-callback-return
                }

                return promise_ZalgoPromise.resolve().then(function () {
                  var value = props[key];

                  if (!value) {
                    return;
                  }

                  if (!prop.queryParam) {
                    return;
                  }

                  return value;
                }).then(function (value) {
                  if (value === null || typeof value === 'undefined') {
                    return;
                  }

                  return promise_ZalgoPromise.all([props_getQueryParam(prop, key, value), getQueryValue(prop, key, value)]).then(function (_ref) {
                    var queryParam = _ref[0],
                        queryValue = _ref[1];
                    var result;

                    if (typeof queryValue === 'boolean') {
                      result = queryValue.toString();
                    } else if (typeof queryValue === 'string') {
                      result = queryValue.toString();
                    } else if (typeof queryValue === 'object' && queryValue !== null) {
                      if (prop.serialization === PROP_SERIALIZATION.JSON) {
                        result = JSON.stringify(queryValue);
                      } else if (prop.serialization === PROP_SERIALIZATION.BASE64) {
                        result = btoa(JSON.stringify(queryValue));
                      } else if (prop.serialization === PROP_SERIALIZATION.DOTIFY || !prop.serialization) {
                        result = dotify(queryValue, key);

                        for (var _i12 = 0, _Object$keys6 = Object.keys(result); _i12 < _Object$keys6.length; _i12++) {
                          var dotkey = _Object$keys6[_i12];
                          params[dotkey] = result[dotkey];
                        }

                        return;
                      }
                    } else if (typeof queryValue === 'number') {
                      result = queryValue.toString();
                    }

                    params[queryParam] = result;
                  });
                });
              })).then(function () {
                return params;
              });
            }
            // CONCATENATED MODULE: ./src/parent/index.js


            /* eslint max-lines: 0 */








            var parent_ParentComponent =
            /*#__PURE__*/
            function () {
              // eslint-disable-line flowtype/no-mutable-array
              function ParentComponent(component, props) {
                var _this = this;

                this.component = void 0;
                this.driver = void 0;
                this.clean = void 0;
                this.event = void 0;
                this.initPromise = void 0;
                this.handledErrors = void 0;
                this.props = void 0;
                this.state = void 0;
                this.child = void 0;
                this.proxyContainer = void 0;
                this.proxyWin = void 0;
                this.visible = true;
                this.initPromise = new promise_ZalgoPromise();
                this.handledErrors = []; // $FlowFixMe

                this.props = {};
                this.clean = cleanup(this);
                this.state = {};
                this.component = component;
                this.setupEvents(props.onError);
                this.setProps(props);
                this.component.registerActiveComponent(this);
                this.clean.register(function () {
                  return _this.component.destroyActiveComponent(_this);
                });
                this.watchForUnload();
              }

              var _proto = ParentComponent.prototype;

              _proto.setupEvents = function setupEvents(onError) {
                var _this2 = this;

                this.event = eventEmitter();
                this.event.on(EVENT.RENDER, function () {
                  return _this2.props.onRender();
                });
                this.event.on(EVENT.DISPLAY, function () {
                  return _this2.props.onDisplay();
                });
                this.event.on(EVENT.RENDERED, function () {
                  return _this2.props.onRendered();
                });
                this.event.on(EVENT.CLOSE, function () {
                  return _this2.props.onClose();
                });
                this.event.on(EVENT.RESIZE, function () {
                  return _this2.props.onResize();
                });
                this.event.on(EVENT.FOCUS, function () {
                  return _this2.props.onFocus();
                });
                this.event.on(EVENT.PROPS, function (props) {
                  return _this2.props.onProps(props);
                });
                this.event.on(EVENT.ERROR, function (err) {
                  if (_this2.props && _this2.props.onError) {
                    return _this2.props.onError(err);
                  } else if (onError) {
                    return onError(err);
                  } else {
                    return _this2.initPromise.reject(err).then(function () {
                      setTimeout(function () {
                        throw err;
                      }, 1);
                    });
                  }
                });
                this.clean.register(function () {
                  return _this2.event.reset();
                });
              };

              _proto.render = function render(target, container, context) {
                var _this3 = this;

                return promise_ZalgoPromise.try(function () {
                  _this3.component.log("render");

                  _this3.driver = RENDER_DRIVERS[context];
                  var uid = ZOID + "-" + _this3.component.tag + "-" + uniqueID();

                  var domain = _this3.getDomain();

                  var childDomain = _this3.getChildDomain();

                  _this3.component.checkAllowRender(target, domain, container);

                  if (target !== window) {
                    _this3.delegate(context, target);
                  }

                  var windowProp = _this3.props.window;
                  var init = _this3.initPromise;

                  var buildUrl = _this3.buildUrl();

                  var onRender = _this3.event.trigger(EVENT.RENDER);

                  var getProxyContainer = _this3.getProxyContainer(container);

                  var getProxyWindow = _this3.getProxyWindow();

                  var buildWindowName = getProxyWindow.then(function (proxyWin) {
                    return _this3.buildWindowName({
                      proxyWin: proxyWin,
                      childDomain: childDomain,
                      domain: domain,
                      target: target,
                      context: context,
                      uid: uid
                    });
                  });
                  var openFrame = buildWindowName.then(function (windowName) {
                    return _this3.openFrame({
                      windowName: windowName
                    });
                  });

                  var openPrerenderFrame = _this3.openPrerenderFrame();

                  var renderContainer = promise_ZalgoPromise.hash({
                    proxyContainer: getProxyContainer,
                    proxyFrame: openFrame,
                    proxyPrerenderFrame: openPrerenderFrame
                  }).then(function (_ref) {
                    var proxyContainer = _ref.proxyContainer,
                        proxyFrame = _ref.proxyFrame,
                        proxyPrerenderFrame = _ref.proxyPrerenderFrame;
                    return _this3.renderContainer(proxyContainer, {
                      context: context,
                      uid: uid,
                      proxyFrame: proxyFrame,
                      proxyPrerenderFrame: proxyPrerenderFrame,
                      visible: _this3.visible
                    });
                  }).then(function (proxyContainer) {
                    _this3.proxyContainer = proxyContainer;
                    return proxyContainer;
                  });
                  var open = promise_ZalgoPromise.hash({
                    windowName: buildWindowName,
                    proxyFrame: openFrame,
                    proxyWin: getProxyWindow
                  }).then(function (_ref2) {
                    var windowName = _ref2.windowName,
                        proxyWin = _ref2.proxyWin,
                        proxyFrame = _ref2.proxyFrame;
                    return windowProp ? proxyWin : _this3.open({
                      windowName: windowName,
                      proxyWin: proxyWin,
                      proxyFrame: proxyFrame
                    });
                  });
                  var openPrerender = promise_ZalgoPromise.hash({
                    proxyWin: open,
                    proxyPrerenderFrame: openPrerenderFrame
                  }).then(function (_ref3) {
                    var proxyWin = _ref3.proxyWin,
                        proxyPrerenderFrame = _ref3.proxyPrerenderFrame;
                    return _this3.openPrerender(proxyWin, proxyPrerenderFrame);
                  });
                  var setState = open.then(function (proxyWin) {
                    _this3.proxyWin = proxyWin;
                    return _this3.setProxyWin(proxyWin);
                  });
                  var prerender = promise_ZalgoPromise.hash({
                    proxyPrerenderWin: openPrerender,
                    state: setState
                  }).then(function (_ref4) {
                    var proxyPrerenderWin = _ref4.proxyPrerenderWin;
                    return _this3.prerender(proxyPrerenderWin, {
                      context: context,
                      uid: uid
                    });
                  });
                  var setWindowName = promise_ZalgoPromise.hash({
                    proxyWin: open,
                    windowName: buildWindowName
                  }).then(function (_ref5) {
                    var proxyWin = _ref5.proxyWin,
                        windowName = _ref5.windowName;

                    if (windowProp) {
                      return proxyWin.setName(windowName);
                    }
                  });
                  var loadUrl = promise_ZalgoPromise.hash({
                    proxyWin: open,
                    url: buildUrl,
                    windowName: setWindowName,
                    prerender: prerender
                  }).then(function (_ref6) {
                    var proxyWin = _ref6.proxyWin,
                        url = _ref6.url;
                    return proxyWin.setLocation(url);
                  });
                  var watchForClose = open.then(function (proxyWin) {
                    _this3.watchForClose(proxyWin);
                  });
                  var onDisplay = promise_ZalgoPromise.hash({
                    container: renderContainer,
                    prerender: prerender
                  }).then(function () {
                    return _this3.event.trigger(EVENT.DISPLAY);
                  });
                  var openBridge = open.then(function (proxyWin) {
                    return _this3.openBridge(proxyWin, childDomain, context);
                  });
                  var runTimeout = loadUrl.then(function () {
                    return _this3.runTimeout();
                  });
                  var onRendered = init.then(function () {
                    return _this3.event.trigger(EVENT.RENDERED);
                  });
                  return promise_ZalgoPromise.hash({
                    init: init,
                    buildUrl: buildUrl,
                    onRender: onRender,
                    getProxyContainer: getProxyContainer,
                    openFrame: openFrame,
                    openPrerenderFrame: openPrerenderFrame,
                    renderContainer: renderContainer,
                    open: open,
                    openPrerender: openPrerender,
                    setState: setState,
                    prerender: prerender,
                    loadUrl: loadUrl,
                    buildWindowName: buildWindowName,
                    setWindowName: setWindowName,
                    watchForClose: watchForClose,
                    onDisplay: onDisplay,
                    openBridge: openBridge,
                    runTimeout: runTimeout,
                    onRendered: onRendered
                  });
                }).catch(function (err) {
                  return promise_ZalgoPromise.all([_this3.onError(err), _this3.destroy(err)]).then(function () {
                    throw err;
                  }, function () {
                    throw err;
                  });
                }).then(src_util_noop);
              };

              _proto.getProxyWindow = function getProxyWindow() {
                var _this4 = this;

                return promise_ZalgoPromise.try(function () {
                  var windowProp = _this4.props.window;

                  if (windowProp) {
                    var proxyWin = setup_toProxyWindow(windowProp);

                    _this4.clean.register(function () {
                      return windowProp.close();
                    });

                    return proxyWin;
                  }

                  return new window_ProxyWindow({
                    send: send_send
                  });
                });
              };

              _proto.getProxyContainer = function getProxyContainer(container) {
                return promise_ZalgoPromise.try(function () {
                  return elementReady(container);
                }).then(function (containerElement) {
                  return getProxyObject(containerElement);
                });
              };

              _proto.buildWindowName = function buildWindowName(_ref7) {
                var proxyWin = _ref7.proxyWin,
                    childDomain = _ref7.childDomain,
                    domain = _ref7.domain,
                    target = _ref7.target,
                    uid = _ref7.uid,
                    context = _ref7.context;
                var childPayload = this.buildChildPayload({
                  proxyWin: proxyWin,
                  childDomain: childDomain,
                  domain: domain,
                  target: target,
                  context: context,
                  uid: uid
                });
                return "__" + ZOID + "__" + this.component.name + "__" + base64encode(JSON.stringify(childPayload)) + "__";
              };

              _proto.getPropsRef = function getPropsRef(proxyWin, childDomain, domain, uid) {
                var value = setup_serializeMessage(proxyWin, domain, this.getPropsForChild(domain));
                var propRef = childDomain === utils_getDomain() ? {
                  type: INITIAL_PROPS.UID,
                  uid: uid
                } : {
                  type: INITIAL_PROPS.RAW,
                  value: value
                };

                if (propRef.type === INITIAL_PROPS.UID) {
                  var global = lib_global_getGlobal(window);
                  global.props = global.props || {};
                  global.props[uid] = value;
                  this.clean.register(function () {
                    delete global.props[uid];
                  });
                }

                return propRef;
              };

              _proto.buildChildPayload = function buildChildPayload(_temp) {
                var _ref8 = _temp === void 0 ? {} : _temp,
                    proxyWin = _ref8.proxyWin,
                    childDomain = _ref8.childDomain,
                    domain = _ref8.domain,
                    _ref8$target = _ref8.target,
                    target = _ref8$target === void 0 ? window : _ref8$target,
                    context = _ref8.context,
                    uid = _ref8.uid;

                return {
                  uid: uid,
                  context: context,
                  version: "9_0_36",
                  childDomain: childDomain,
                  parentDomain: utils_getDomain(window),
                  tag: this.component.tag,
                  parent: this.getWindowRef(target, childDomain, uid, context),
                  props: this.getPropsRef(proxyWin, childDomain, domain, uid),
                  exports: setup_serializeMessage(proxyWin, domain, this.buildParentExports(proxyWin))
                };
              };

              _proto.setProxyWin = function setProxyWin(proxyWin) {
                var _this5 = this;

                return promise_ZalgoPromise.try(function () {
                  _this5.proxyWin = proxyWin;
                });
              };

              _proto.getHelpers = function getHelpers() {
                var _this6 = this;

                return {
                  state: this.state,
                  event: this.event,
                  close: function close() {
                    return _this6.close();
                  },
                  focus: function focus() {
                    return _this6.focus();
                  },
                  resize: function resize(_ref9) {
                    var width = _ref9.width,
                        height = _ref9.height;
                    return _this6.resize({
                      width: width,
                      height: height
                    });
                  },
                  onError: function onError(err) {
                    return _this6.onError(err);
                  },
                  updateProps: function updateProps(props) {
                    return _this6.updateProps(props);
                  },
                  show: function show() {
                    return _this6.show();
                  },
                  hide: function hide() {
                    return _this6.hide();
                  }
                };
              };

              _proto.show = function show() {
                var _this7 = this;

                return promise_ZalgoPromise.try(function () {
                  _this7.visible = true;

                  if (_this7.proxyContainer) {
                    return _this7.proxyContainer.get().then(showElement);
                  }
                });
              };

              _proto.hide = function hide() {
                var _this8 = this;

                return promise_ZalgoPromise.try(function () {
                  _this8.visible = false;

                  if (_this8.proxyContainer) {
                    return _this8.proxyContainer.get().then(hideElement);
                  }
                });
              };

              _proto.setProps = function setProps(props, isUpdate) {
                if (isUpdate === void 0) {
                  isUpdate = false;
                }

                if (this.component.validate) {
                  this.component.validate({
                    props: props
                  });
                }

                var helpers = this.getHelpers();
                extendProps(this.component, this.props, props, helpers, isUpdate);
              };

              _proto.buildUrl = function buildUrl() {
                var _this9 = this;

                return propsToQuery(_extends({}, this.component.props, {}, this.component.builtinProps), this.props).then(function (query) {
                  return extendUrl(normalizeMockUrl(_this9.component.getUrl(_this9.props)), {
                    query: query
                  });
                });
              };

              _proto.getDomain = function getDomain() {
                return this.component.getDomain(this.props);
              };

              _proto.getChildDomain = function getChildDomain() {
                return this.component.getChildDomain(this.props);
              };

              _proto.getPropsForChild = function getPropsForChild(domain) {
                var result = {};

                for (var _i2 = 0, _Object$keys2 = Object.keys(this.props); _i2 < _Object$keys2.length; _i2++) {
                  var key = _Object$keys2[_i2];
                  var prop = this.component.getPropDefinition(key);

                  if (prop && prop.sendToChild === false) {
                    continue;
                  }

                  if (prop && prop.sameDomain && !matchDomain(domain, utils_getDomain(window))) {
                    continue;
                  }

                  result[key] = this.props[key];
                } // $FlowFixMe


                return result;
              };

              _proto.updateProps = function updateProps(props) {
                var _this10 = this;

                this.setProps(props, true);
                return this.initPromise.then(function () {
                  if (_this10.child) {
                    return _this10.child.updateProps(_this10.getPropsForChild(_this10.getDomain())).catch(function (err) {
                      if (!_this10.child || !_this10.proxyWin) {
                        return;
                      }

                      return _this10.checkClose(_this10.proxyWin).then(function () {
                        if (_this10.child) {
                          throw err;
                        }
                      });
                    });
                  }
                });
              };

              _proto.openFrame = function openFrame(_ref10) {
                var _this11 = this;

                var windowName = _ref10.windowName;
                return promise_ZalgoPromise.try(function () {
                  if (_this11.driver.openFrame) {
                    return _this11.driver.openFrame.call(_this11, {
                      windowName: windowName
                    });
                  }
                });
              };

              _proto.openPrerenderFrame = function openPrerenderFrame() {
                var _this12 = this;

                return promise_ZalgoPromise.try(function () {
                  if (_this12.driver.openPrerenderFrame) {
                    return _this12.driver.openPrerenderFrame.call(_this12);
                  }
                });
              };

              _proto.open = function open(_ref11) {
                var _this13 = this;

                var proxyWin = _ref11.proxyWin,
                    proxyFrame = _ref11.proxyFrame,
                    windowName = _ref11.windowName;
                return promise_ZalgoPromise.try(function () {
                  _this13.component.log("open");

                  return _this13.driver.open.call(_this13, {
                    windowName: windowName,
                    proxyFrame: proxyFrame
                  }).then(function (win) {
                    proxyWin.setWindow(win, {
                      send: send_send
                    });
                    return proxyWin;
                  });
                });
              };

              _proto.openPrerender = function openPrerender(proxyWin, proxyPrerenderFrame) {
                var _this14 = this;

                return promise_ZalgoPromise.try(function () {
                  return _this14.driver.openPrerender.call(_this14, proxyWin, proxyPrerenderFrame);
                });
              };

              _proto.focus = function focus() {
                var _this15 = this;

                return promise_ZalgoPromise.try(function () {
                  var proxyWin = _this15.proxyWin;

                  if (proxyWin) {
                    _this15.event.trigger(EVENT.FOCUS);

                    return proxyWin.focus().then(src_util_noop);
                  }
                });
              };

              _proto.delegate = function delegate(context, target) {
                var _this16 = this;

                this.component.log("delegate");
                var props = {};

                for (var _i4 = 0, _this$component$getPr2 = this.component.getPropNames(); _i4 < _this$component$getPr2.length; _i4++) {
                  var propName = _this$component$getPr2[_i4];

                  if (this.component.getPropDefinition(propName).allowDelegate) {
                    props[propName] = this.props[propName];
                  }
                }

                var overridesPromise = send_send(target, POST_MESSAGE.DELEGATE + "_" + this.component.name, {
                  context: context,
                  props: props,
                  overrides: {
                    event: this.event,
                    close: function close() {
                      return _this16.close();
                    },
                    onError: function onError(err) {
                      return _this16.onError(err);
                    }
                  }
                }).then(function (_ref12) {
                  var data = _ref12.data;

                  _this16.clean.register(data.destroy);

                  return data.overrides;
                }).catch(function (err) {
                  throw new Error("Unable to delegate rendering. Possibly the component is not loaded in the target window.\n\n" + stringifyError(err));
                });

                var _loop = function _loop(_i6, _this$driver$delegate2) {
                  var key = _this$driver$delegate2[_i6];

                  // $FlowFixMe
                  _this16[key] = function overriddenFunction() {
                    var _arguments = arguments,
                        _this17 = this;

                    return overridesPromise.then(function (overrides) {
                      return overrides[key].apply(_this17, _arguments);
                    });
                  };
                };

                for (var _i6 = 0, _this$driver$delegate2 = this.driver.delegate; _i6 < _this$driver$delegate2.length; _i6++) {
                  _loop(_i6, _this$driver$delegate2);
                }
              };

              _proto.getWindowRef = function getWindowRef(target, domain, uid, context) {
                if (domain === utils_getDomain(window)) {
                  var global = lib_global_getGlobal(window);
                  global.windows = global.windows || {};
                  global.windows[uid] = window;
                  this.clean.register(function () {
                    delete global.windows[uid];
                  });
                  return {
                    type: WINDOW_REFERENCES.GLOBAL,
                    uid: uid
                  };
                }

                if (context === CONTEXT.POPUP) {
                  return {
                    type: WINDOW_REFERENCES.OPENER
                  };
                }

                return {
                  type: WINDOW_REFERENCES.PARENT,
                  distance: getDistanceFromTop(window)
                };
              };

              _proto.watchForClose = function watchForClose(proxyWin) {
                var _this18 = this;

                var cancelled = false;
                this.clean.register(function () {
                  cancelled = true;
                });
                return promise_ZalgoPromise.delay(2000).then(function () {
                  return proxyWin.isClosed();
                }).then(function (isClosed) {
                  if (isClosed) {
                    _this18.component.log("detect_close_child");

                    return _this18.close();
                  } else if (!cancelled) {
                    return _this18.watchForClose(proxyWin);
                  }
                });
              };

              _proto.watchForUnload = function watchForUnload() {
                var _this19 = this;

                var unloadWindowListener = addEventListener(window, 'unload', once(function () {
                  _this19.component.log("navigate_away");

                  _this19.destroy(new Error("Window navigated away"));
                }));
                this.clean.register(unloadWindowListener.cancel);
              };

              _proto.runTimeout = function runTimeout() {
                var _this20 = this;

                return promise_ZalgoPromise.try(function () {
                  var timeout = _this20.props.timeout;

                  if (timeout) {
                    return _this20.initPromise.timeout(timeout, new Error("Loading component timed out after " + timeout + " milliseconds"));
                  }
                });
              };

              _proto.initChild = function initChild(child) {
                var _this21 = this;

                return promise_ZalgoPromise.try(function () {
                  _this21.clean.set('child', child);

                  _this21.initPromise.resolve();
                });
              };

              _proto.buildParentExports = function buildParentExports(win) {
                var _this22 = this;

                var onError = function onError(err) {
                  return _this22.onError(err);
                };

                var init = function init(child) {
                  return _this22.initChild(child);
                };

                var close = function close() {
                  return _this22.close();
                };

                var checkClose = function checkClose() {
                  return _this22.checkClose(win);
                };

                var resize = function resize(_ref13) {
                  var width = _ref13.width,
                      height = _ref13.height;
                  return _this22.resize({
                    width: width,
                    height: height
                  });
                };

                var show = function show() {
                  return _this22.show();
                };

                var hide = function hide() {
                  return _this22.hide();
                };

                init.onError = onError;
                return {
                  init: init,
                  close: close,
                  checkClose: checkClose,
                  resize: resize,
                  onError: onError,
                  show: show,
                  hide: hide
                };
              };

              _proto.resize = function resize(_ref14) {
                var _this23 = this;

                var width = _ref14.width,
                    height = _ref14.height;
                return promise_ZalgoPromise.try(function () {
                  _this23.event.trigger(EVENT.RESIZE, {
                    width: width,
                    height: height
                  });
                });
              };

              _proto.checkClose = function checkClose(win) {
                var _this24 = this;

                return win.isClosed().then(function (closed) {
                  if (closed) {
                    return _this24.close();
                  }

                  return promise_ZalgoPromise.delay(200).then(function () {
                    return win.isClosed();
                  }).then(function (secondClosed) {
                    if (secondClosed) {
                      return _this24.close();
                    }
                  });
                });
              };

              _proto.close = function close() {
                var _this25 = this;

                return promise_ZalgoPromise.try(function () {
                  _this25.component.log("close");

                  return _this25.event.trigger(EVENT.CLOSE);
                }).then(function () {
                  if (_this25.child) {
                    _this25.child.close.fireAndForget().catch(src_util_noop);
                  }

                  return _this25.destroy(new Error("Window closed"));
                });
              };

              _proto.prerender = function prerender(proxyPrerenderWin, _ref15) {
                var _this26 = this;

                var context = _ref15.context,
                    uid = _ref15.uid;
                return promise_ZalgoPromise.try(function () {
                  var prerenderTemplate = _this26.component.prerenderTemplate;

                  if (!prerenderTemplate) {
                    return;
                  }

                  var prerenderWindow = proxyPrerenderWin.getWindow();

                  if (!prerenderWindow || !isSameDomain(prerenderWindow) || !isBlankDomain(prerenderWindow)) {
                    return;
                  }

                  prerenderWindow = assertSameDomain(prerenderWindow);
                  var doc = prerenderWindow.document;

                  var el = _this26.renderTemplate(prerenderTemplate, {
                    context: context,
                    uid: uid,
                    doc: doc
                  });

                  if (!el) {
                    return;
                  }

                  if (el.ownerDocument !== doc) {
                    throw new Error("Expected prerender template to have been created with document from child window");
                  }

                  writeElementToWindow(prerenderWindow, el);

                  var _ref16 = _this26.component.autoResize || {},
                      _ref16$width = _ref16.width,
                      width = _ref16$width === void 0 ? false : _ref16$width,
                      _ref16$height = _ref16.height,
                      height = _ref16$height === void 0 ? false : _ref16$height,
                      _ref16$element = _ref16.element,
                      element = _ref16$element === void 0 ? 'body' : _ref16$element;

                  element = getElementSafe(element, doc);

                  if (element && (width || height)) {
                    onResize(element, function (_ref17) {
                      var newWidth = _ref17.width,
                          newHeight = _ref17.height;

                      _this26.resize({
                        width: width ? newWidth : undefined,
                        height: height ? newHeight : undefined
                      });
                    }, {
                      width: width,
                      height: height,
                      win: prerenderWindow
                    });
                  }
                });
              };

              _proto.renderTemplate = function renderTemplate(renderer, _ref18) {
                var _this27 = this;

                var context = _ref18.context,
                    uid = _ref18.uid,
                    container = _ref18.container,
                    doc = _ref18.doc,
                    frame = _ref18.frame,
                    prerenderFrame = _ref18.prerenderFrame;
                // $FlowFixMe
                return renderer.call(this, {
                  container: container,
                  context: context,
                  uid: uid,
                  doc: doc,
                  frame: frame,
                  prerenderFrame: prerenderFrame,
                  focus: function focus() {
                    return _this27.focus();
                  },
                  close: function close() {
                    return _this27.close();
                  },
                  state: this.state,
                  props: this.props,
                  tag: this.component.tag,
                  dimensions: this.component.dimensions,
                  event: this.event
                });
              };

              _proto.renderContainer = function renderContainer(proxyContainer, _ref19) {
                var _this28 = this;

                var proxyFrame = _ref19.proxyFrame,
                    proxyPrerenderFrame = _ref19.proxyPrerenderFrame,
                    context = _ref19.context,
                    uid = _ref19.uid,
                    visible = _ref19.visible;
                return promise_ZalgoPromise.hash({
                  container: proxyContainer.get().then(elementReady),
                  // $FlowFixMe
                  frame: proxyFrame ? proxyFrame.get() : null,
                  // $FlowFixMe
                  prerenderFrame: proxyPrerenderFrame ? proxyPrerenderFrame.get() : null
                }).then(function (_ref20) {
                  var container = _ref20.container,
                      frame = _ref20.frame,
                      prerenderFrame = _ref20.prerenderFrame;

                  var innerContainer = _this28.renderTemplate(_this28.component.containerTemplate, {
                    context: context,
                    uid: uid,
                    container: container,
                    frame: frame,
                    prerenderFrame: prerenderFrame,
                    doc: document
                  });

                  if (innerContainer) {
                    if (!visible) {
                      hideElement(innerContainer);
                    }

                    appendChild(container, innerContainer);

                    _this28.clean.register(function () {
                      return destroyElement(innerContainer);
                    });

                    _this28.proxyContainer = getProxyObject(innerContainer);
                    return getProxyObject(innerContainer);
                  }
                });
              };

              _proto.destroy = function destroy(err) {
                var _this29 = this;

                return promise_ZalgoPromise.try(function () {
                  return _this29.clean.all();
                }).then(function () {
                  _this29.initPromise.asyncReject(err || new Error('Component destroyed'));

                  _this29.component.log("destroy");
                });
              };

              _proto.onError = function onError(err) {
                var _this30 = this;

                return promise_ZalgoPromise.try(function () {
                  if (_this30.handledErrors.indexOf(err) !== -1) {
                    return;
                  }

                  _this30.handledErrors.push(err);

                  _this30.initPromise.asyncReject(err);

                  return _this30.event.trigger(EVENT.ERROR, err);
                });
              };

              _proto.openBridge = function openBridge(proxyWin, domain, context) {
              };

              return ParentComponent;
            }();
            // CONCATENATED MODULE: ./src/delegate/index.js






            var delegate_DelegateComponent =
            /*#__PURE__*/
            function () {
              function DelegateComponent(component, source, options) {
                var _this = this;

                this.component = void 0;
                this.source = void 0;
                this.context = void 0;
                this.driver = void 0;
                this.props = void 0;
                this.clean = void 0;
                this.focus = void 0;
                this.resize = void 0;
                this.renderTemplate = void 0;
                this.close = void 0;
                this.onError = void 0;
                this.event = void 0;
                this.component = component;
                this.context = options.context;
                this.driver = RENDER_DRIVERS[options.context];
                this.clean = cleanup(this);
                this.focus = parent_ParentComponent.prototype.focus;
                this.resize = parent_ParentComponent.prototype.resize;
                this.renderTemplate = parent_ParentComponent.prototype.renderTemplate; // $FlowFixMe

                this.props = {};

                for (var _i2 = 0, _Object$keys2 = Object.keys(options.props); _i2 < _Object$keys2.length; _i2++) {
                  var propName = _Object$keys2[_i2];
                  var propDef = this.component.getPropDefinition(propName);

                  if (propDef && propDef.allowDelegate && options.props[propName]) {
                    // $FlowFixMe
                    this.props[propName] = options.props[propName];
                  }
                }

                this.close = options.overrides.close;
                this.onError = options.overrides.onError;
                this.event = options.overrides.event;
                this.component.registerActiveComponent(this);
                this.clean.register(function () {
                  return _this.component.destroyActiveComponent(_this);
                });
                this.watchForSourceClose(source);
              }

              var _proto = DelegateComponent.prototype;

              _proto.getDelegate = function getDelegate() {
                var _this2 = this;

                return {
                  overrides: this.getOverrides(),
                  destroy: function destroy() {
                    return _this2.destroy();
                  }
                };
              };

              _proto.watchForSourceClose = function watchForSourceClose(source) {
                var _this3 = this;

                var closeSourceWindowListener = onCloseWindow(source, function () {
                  return _this3.destroy();
                }, 3000);
                this.clean.register(closeSourceWindowListener.cancel);
              };

              _proto.getOverrides = function getOverrides() {
                var overrides = {};
                var self = this;

                var _loop = function _loop(_i4, _this$driver$delegate2) {
                  var key = _this$driver$delegate2[_i4];

                  overrides[key] = function delegateOverride() {
                    // $FlowFixMe
                    return parent_ParentComponent.prototype[key].apply(self, arguments);
                  };

                  overrides[key].__name__ = key;
                };

                for (var _i4 = 0, _this$driver$delegate2 = this.driver.delegate; _i4 < _this$driver$delegate2.length; _i4++) {
                  _loop(_i4, _this$driver$delegate2);
                }

                return overrides;
              };

              _proto.destroy = function destroy() {
                return this.clean.all();
              };

              return DelegateComponent;
            }();
            // CONCATENATED MODULE: ./src/drivers/index.js




            // CONCATENATED MODULE: ./src/component/validate.js



            function validatePropDefinitions(options) {
              if (options.props && !(typeof options.props === 'object')) {
                throw new Error("Expected options.props to be an object");
              }

              var PROP_TYPE_LIST = util_values(PROP_TYPE);

              if (options.props) {
                for (var _i2 = 0, _Object$keys2 = Object.keys(options.props); _i2 < _Object$keys2.length; _i2++) {
                  var key = _Object$keys2[_i2];
                  var prop = options.props[key];

                  if (!prop || !(typeof prop === 'object')) {
                    throw new Error("Expected options.props." + key + " to be an object");
                  }

                  if (!prop.type) {
                    throw new Error("Expected prop.type");
                  }

                  if (PROP_TYPE_LIST.indexOf(prop.type) === -1) {
                    throw new Error("Expected prop.type to be one of " + PROP_TYPE_LIST.join(', '));
                  }

                  if (prop.required && prop.default) {
                    throw new Error("Required prop can not have a default value");
                  }

                  if (prop.type === PROP_TYPE.FUNCTION && prop.queryParam && !prop.queryValue) {
                    throw new Error("Do not pass queryParam for function prop");
                  }
                }
              }
            } // eslint-disable-next-line complexity


            function validate_validate(options) {
              // eslint-ignore-line
              if (!options) {
                throw new Error("Expected options to be passed");
              } // eslint-disable-next-line security/detect-unsafe-regex, unicorn/no-unsafe-regex


              if (!options.tag || !options.tag.match(/^([a-z0-9][a-z0-9-]*)+[a-z0-9]+$/)) {
                throw new Error("Invalid options.tag: " + options.tag);
              }

              validatePropDefinitions(options);

              if (options.dimensions) {
                if (options.dimensions && !isPx(options.dimensions.width) && !isPerc(options.dimensions.width)) {
                  throw new Error("Expected options.dimensions.width to be a px or % string value");
                }

                if (options.dimensions && !isPx(options.dimensions.height) && !isPerc(options.dimensions.height)) {
                  throw new Error("Expected options.dimensions.height to be a px or % string value");
                }
              }

              if (options.defaultContext) {
                if (options.defaultContext !== CONTEXT.IFRAME && options.defaultContext !== CONTEXT.POPUP) {
                  throw new Error("Unsupported context type: " + (options.defaultContext || 'unknown'));
                }
              }

              if (!options.url) {
                throw new Error("Must pass url");
              }

              if (typeof options.url !== 'string' && typeof options.url !== 'function') {
                throw new TypeError("Expected url to be string or function");
              }

              if (options.prerenderTemplate && typeof options.prerenderTemplate !== 'function') {
                throw new Error("Expected options.prerenderTemplate to be a function");
              }

              if ((options.containerTemplate || !true) && typeof options.containerTemplate !== 'function') {
                throw new Error("Expected options.containerTemplate to be a function");
              }
            }
            // CONCATENATED MODULE: ./src/component/templates/container.js
            /* eslint react/react-in-jsx-scope: off */


            var CLASS = {
              VISIBLE: 'visible',
              INVISIBLE: 'invisible'
            };
            function defaultContainerTemplate(_ref) {
              var uid = _ref.uid,
                  frame = _ref.frame,
                  prerenderFrame = _ref.prerenderFrame,
                  doc = _ref.doc,
                  props = _ref.props,
                  event = _ref.event,
                  _ref$dimensions = _ref.dimensions,
                  width = _ref$dimensions.width,
                  height = _ref$dimensions.height;

              {
                if (!frame || !prerenderFrame) {
                  return;
                }

                var div = doc.createElement('div');
                div.setAttribute('id', uid);
                var style = doc.createElement('style');

                if (props.cspNonce) {
                  style.setAttribute('nonce', props.cspNonce);
                }

                style.appendChild(doc.createTextNode("\n            #" + uid + " {\n                display: inline-block;\n                position: relative;\n                width: " + width + ";\n                height: " + height + ";\n            }\n\n            #" + uid + " > iframe {\n                display: inline-block;\n                position: absolute;\n                width: 100%;\n                height: 100%;\n                top: 0;\n                left: 0;\n                transition: opacity .2s ease-in-out;\n            }\n\n            #" + uid + " > iframe." + CLASS.INVISIBLE + " {\n                opacity: 0;\n            }\n\n            #" + uid + " > iframe." + CLASS.VISIBLE + " {\n                opacity: 1;\n        }\n        "));
                div.appendChild(frame);
                div.appendChild(prerenderFrame);
                div.appendChild(style);
                prerenderFrame.classList.add(CLASS.VISIBLE);
                frame.classList.add(CLASS.INVISIBLE);
                event.on(EVENT.RENDERED, function () {
                  prerenderFrame.classList.remove(CLASS.VISIBLE);
                  prerenderFrame.classList.add(CLASS.INVISIBLE);
                  frame.classList.remove(CLASS.INVISIBLE);
                  frame.classList.add(CLASS.VISIBLE);
                  setTimeout(function () {
                    destroyElement(prerenderFrame);
                  }, 1);
                });
                event.on(EVENT.RESIZE, function (_ref2) {
                  var newWidth = _ref2.width,
                      newHeight = _ref2.height;

                  if (typeof newWidth === 'number') {
                    div.style.width = toCSS(newWidth);
                  }

                  if (typeof newHeight === 'number') {
                    div.style.height = toCSS(newHeight);
                  }
                });
                return div;
              }
            }
            // CONCATENATED MODULE: ./src/component/templates/component.js
            /* eslint react/react-in-jsx-scope: off */
            function defaultPrerenderTemplate(_ref) {
              var doc = _ref.doc,
                  props = _ref.props;

              {
                var html = doc.createElement('html');
                var body = doc.createElement('body');
                var style = doc.createElement('style');
                var spinner = doc.createElement('div');
                spinner.classList.add('spinner');

                if (props.cspNonce) {
                  style.setAttribute('nonce', props.cspNonce);
                }

                html.appendChild(body);
                body.appendChild(spinner);
                body.appendChild(style);
                style.appendChild(doc.createTextNode("\n            html, body {\n                width: 100%;\n                height: 100%;\n            }\n\n            .spinner {\n                position: fixed;\n                max-height: 60vmin;\n                max-width: 60vmin;\n                height: 40px;\n                width: 40px;\n                top: 50%;\n                left: 50%;\n                box-sizing: border-box;\n                border: 3px solid rgba(0, 0, 0, .2);\n                border-top-color: rgba(33, 128, 192, 0.8);\n                border-radius: 100%;\n                animation: rotation .7s infinite linear;\n            }\n\n            @keyframes rotation {\n                from {\n                    transform: translateX(-50%) translateY(-50%) rotate(0deg);\n                }\n                to {\n                    transform: translateX(-50%) translateY(-50%) rotate(359deg);\n                }\n            }\n        "));
                return html;
              }
            }
            // CONCATENATED MODULE: ./src/component/templates/index.js


            // CONCATENATED MODULE: ./src/component/props.js






            var props_defaultNoop = function defaultNoop() {
              return src_util_noop;
            };

            var props_decorateOnce = function decorateOnce(_ref) {
              var value = _ref.value;
              return once(value);
            };

            function getBuiltInProps() {
              return {
                window: {
                  type: 'object',
                  sendToChild: false,
                  required: false,
                  allowDelegate: true,
                  validate: function validate(_ref2) {
                    var value = _ref2.value;

                    if (!isWindow(value) && !window_ProxyWindow.isProxyWindow(value)) {
                      throw new Error("Expected Window or ProxyWindow");
                    }

                    if (isWindow(value)) {
                      // $FlowFixMe
                      if (isWindowClosed(value)) {
                        throw new Error("Window is closed");
                      } // $FlowFixMe


                      if (!isSameDomain(value)) {
                        throw new Error("Window is not same domain");
                      }
                    }
                  },
                  decorate: function decorate(_ref3) {
                    var value = _ref3.value;
                    return setup_toProxyWindow(value);
                  }
                },
                timeout: {
                  type: 'number',
                  required: false,
                  sendToChild: false
                },
                close: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref4) {
                    var close = _ref4.close;
                    return close;
                  }
                },
                focus: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref5) {
                    var focus = _ref5.focus;
                    return focus;
                  }
                },
                resize: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref6) {
                    var resize = _ref6.resize;
                    return resize;
                  }
                },
                cspNonce: {
                  type: 'string',
                  required: false
                },
                getParent: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref7) {
                    var getParent = _ref7.getParent;
                    return getParent;
                  }
                },
                getParentDomain: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref8) {
                    var getParentDomain = _ref8.getParentDomain;
                    return getParentDomain;
                  }
                },
                show: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref9) {
                    var show = _ref9.show;
                    return show;
                  }
                },
                hide: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref10) {
                    var hide = _ref10.hide;
                    return hide;
                  }
                },
                onDisplay: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  allowDelegate: true,
                  default: props_defaultNoop,
                  decorate: props_decorateOnce
                },
                onRendered: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  default: props_defaultNoop,
                  decorate: props_decorateOnce
                },
                onRender: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  default: props_defaultNoop,
                  decorate: props_decorateOnce
                },
                onClose: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  allowDelegate: true,
                  default: props_defaultNoop,
                  decorate: props_decorateOnce
                },
                onResize: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  allowDelegate: true,
                  default: props_defaultNoop
                },
                onFocus: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  allowDelegate: true,
                  default: props_defaultNoop
                },
                onError: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref11) {
                    var onError = _ref11.onError;
                    return onError;
                  }
                },
                onProps: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  default: props_defaultNoop,
                  childDecorate: function childDecorate(_ref12) {
                    var onProps = _ref12.onProps;
                    return onProps;
                  }
                }
              };
            }
            // CONCATENATED MODULE: ./src/component/component.js


            /* eslint max-lines: 0 */













            var component_Component =
            /*#__PURE__*/
            function () {
              function Component(options) {
                this.tag = void 0;
                this.name = void 0;
                this.url = void 0;
                this.domain = void 0;
                this.bridgeUrl = void 0;
                this.props = void 0;
                this.builtinProps = void 0;
                this.dimensions = void 0;
                this.autoResize = void 0;
                this.allowedParentDomains = void 0;
                this.defaultContext = void 0;
                this.attributes = void 0;
                this.containerTemplate = void 0;
                this.prerenderTemplate = void 0;
                this.validate = void 0;
                this.driverCache = void 0;
                this.xprops = void 0;
                this.logger = void 0;
                this.propNames = void 0;
                validate_validate(options); // The tag name of the component. Used by some drivers (e.g. angular) to turn the component into an html element,
                // e.g. <my-component>

                this.tag = options.tag;
                this.name = this.tag.replace(/-/g, '_');
                this.allowedParentDomains = options.allowedParentDomains || src_constants_WILDCARD;
                var global = lib_global_getGlobal();
                global.components = global.components || {};

                if (global.components[this.tag]) {
                  throw new Error("Can not register multiple components with the same tag: " + this.tag);
                } // A json based spec describing what kind of props the component accepts. This is used to validate any props before
                // they are passed down to the child.


                this.builtinProps = getBuiltInProps();
                this.props = options.props || {}; // The dimensions of the component, e.g. { width: '300px', height: '150px' }

                var _ref = options.dimensions || {},
                    _ref$width = _ref.width,
                    width = _ref$width === void 0 ? DEFAULT_DIMENSIONS.WIDTH : _ref$width,
                    _ref$height = _ref.height,
                    height = _ref$height === void 0 ? DEFAULT_DIMENSIONS.HEIGHT : _ref$height;

                this.dimensions = {
                  width: width,
                  height: height
                };
                this.url = options.url;
                this.domain = options.domain;
                this.bridgeUrl = options.bridgeUrl;
                this.attributes = options.attributes || {};
                this.attributes.iframe = this.attributes.iframe || {};
                this.attributes.popup = this.attributes.popup || {};
                this.defaultContext = options.defaultContext || CONTEXT.IFRAME;
                this.autoResize = options.autoResize;

                if (options.containerTemplate) {
                  this.containerTemplate = options.containerTemplate;
                } else {
                  this.containerTemplate = defaultContainerTemplate;
                }

                if (options.prerenderTemplate) {
                  this.prerenderTemplate = options.prerenderTemplate;
                } else {
                  this.prerenderTemplate = defaultPrerenderTemplate;
                }

                this.validate = options.validate;
                this.logger = options.logger || {
                  debug: src_util_noop,
                  info: src_util_noop,
                  warn: src_util_noop,
                  error: src_util_noop
                };
                this.registerChild();
                this.listenDelegate();
                global.components[this.tag] = this;
              }

              var _proto = Component.prototype;

              _proto.getPropNames = function getPropNames() {
                if (this.propNames) {
                  return this.propNames;
                }

                var propNames = Object.keys(this.props);

                for (var _i2 = 0, _Object$keys2 = Object.keys(this.builtinProps); _i2 < _Object$keys2.length; _i2++) {
                  var key = _Object$keys2[_i2];

                  if (propNames.indexOf(key) === -1) {
                    propNames.push(key);
                  }
                }

                this.propNames = propNames;
                return propNames;
              };

              _proto.getPropDefinition = function getPropDefinition(name) {
                return this.props[name] || this.builtinProps[name];
              };

              _proto.driver = function driver(name, dep) {
                {
                  throw new Error("Driver support not enabled");
                }
              };

              _proto.registerChild = function registerChild() {
                if (this.isChild()) {
                  if (window.xprops) {
                    throw new Error("Can not register " + this.name + " as child - can not attach multiple components to the same window");
                  }

                  var child = new child_ChildComponent(this);
                  window.xprops = this.xprops = child.getProps();
                }
              };

              _proto.listenDelegate = function listenDelegate() {
                var _this = this;

                on_on(POST_MESSAGE.ALLOW_DELEGATE + "_" + this.name, function () {
                  return true;
                });
                on_on(POST_MESSAGE.DELEGATE + "_" + this.name, function (_ref2) {
                  var source = _ref2.source,
                      _ref2$data = _ref2.data,
                      context = _ref2$data.context,
                      props = _ref2$data.props,
                      overrides = _ref2$data.overrides;
                  var delegate = new delegate_DelegateComponent(_this, source, {
                    context: context,
                    props: props,
                    overrides: overrides
                  });
                  return delegate.getDelegate();
                });
              };

              _proto.canRenderTo = function canRenderTo(win) {
                return send_send(win, POST_MESSAGE.ALLOW_DELEGATE + "_" + this.name).then(function (_ref3) {
                  var data = _ref3.data;
                  return data;
                }).catch(function () {
                  return false;
                });
              };

              _proto.getUrl = function getUrl(props) {
                if (typeof this.url === 'function') {
                  return this.url({
                    props: props
                  });
                }

                return this.url;
              };

              _proto.getChildDomain = function getChildDomain(props) {
                if (this.domain && typeof this.domain === 'string') {
                  return this.domain;
                }

                return getDomainFromUrl(this.getUrl(props));
              };

              _proto.getDomain = function getDomain(props) {
                if (this.domain && util_isRegex(this.domain)) {
                  return this.domain;
                }

                return this.getChildDomain(props);
              };

              _proto.getBridgeUrl = function getBridgeUrl() {
                if (this.bridgeUrl) {
                  return this.bridgeUrl;
                }
              };

              _proto.isChild = function isChild() {
                var payload = getChildPayload();
                return Boolean(payload && payload.tag === this.tag && payload.childDomain === utils_getDomain());
              };

              _proto.getDefaultContainer = function getDefaultContainer(context, container) {
                if (container) {
                  if (typeof container !== 'string' && !isElement(container)) {
                    throw new TypeError("Expected string or element selector to be passed");
                  }

                  return container;
                }

                if (context === CONTEXT.POPUP) {
                  return 'body';
                }

                throw new Error("Expected element to be passed to render iframe");
              };

              _proto.getDefaultContext = function getDefaultContext(context, props) {
                var _this2 = this;

                return promise_ZalgoPromise.try(function () {
                  if (props.window) {
                    return setup_toProxyWindow(props.window).getType();
                  }

                  if (context) {
                    if (context !== CONTEXT.IFRAME && context !== CONTEXT.POPUP) {
                      throw new Error("Unrecognized context: " + context);
                    }

                    return context;
                  }

                  return _this2.defaultContext;
                });
              };

              _proto.init = function init(props) {
                var _this3 = this;

                // $FlowFixMe
                props = props || {};
                var parent = new parent_ParentComponent(this, props);

                var _render = function render(target, container, context) {
                  return promise_ZalgoPromise.try(function () {
                    if (!isWindow(target)) {
                      throw new Error("Must pass window to renderTo");
                    }

                    return _this3.getDefaultContext(context, props);
                  }).then(function (finalContext) {
                    container = _this3.getDefaultContainer(finalContext, container);
                    return parent.render(target, container, finalContext);
                  });
                };

                return _extends({}, parent.getHelpers(), {
                  render: function render(container, context) {
                    return _render(window, container, context);
                  },
                  renderTo: function renderTo(target, container, context) {
                    return _render(target, container, context);
                  }
                });
              };

              _proto.checkAllowRender = function checkAllowRender(target, domain, container) {
                if (target === window) {
                  return;
                }

                if (!isSameTopWindow(window, target)) {
                  throw new Error("Can only renderTo an adjacent frame");
                }

                var origin = utils_getDomain();

                if (!matchDomain(domain, origin) && !isSameDomain(target)) {
                  throw new Error("Can not render remotely to " + domain.toString() + " - can only render to " + origin);
                }

                if (container && typeof container !== 'string') {
                  throw new Error("Container passed to renderTo must be a string selector, got " + typeof container + " }");
                }
              };

              _proto.log = function log(event, payload) {
                this.logger.info(this.name + "_" + event, payload);
              };

              _proto.registerActiveComponent = function registerActiveComponent(instance) {
                var global = lib_global_getGlobal();
                global.activeComponents = global.activeComponents || [];
                global.activeComponents.push(instance);
              };

              _proto.destroyActiveComponent = function destroyActiveComponent(instance) {
                var global = lib_global_getGlobal();
                global.activeComponents = global.activeComponents || [];
                global.activeComponents.splice(global.activeComponents.indexOf(instance), 1);
              };

              return Component;
            }();
            function create(options) {
              setup();
              var component = new component_Component(options);

              var init = function init(props) {
                return component.init(props);
              };

              init.driver = function (name, dep) {
                return component.driver(name, dep);
              };

              init.isChild = function () {
                return component.isChild();
              };

              init.canRenderTo = function (win) {
                return component.canRenderTo(win);
              };

              init.xprops = component.xprops;
              return init;
            }
            function destroyAll() {

              var results = [];
              var global = lib_global_getGlobal();
              global.activeComponents = global.activeComponents || [];

              while (global.activeComponents.length) {
                results.push(global.activeComponents[0].destroy(new Error("zoid destroyed all"), false));
              }

              return promise_ZalgoPromise.all(results).then(src_util_noop);
            }
            var destroyComponents = destroyAll;
            function component_destroy() {
              destroyAll();
              destroyGlobal();
              setup_destroy();
            }
            // CONCATENATED MODULE: ./src/component/index.js


            // CONCATENATED MODULE: ./src/index.js
            /* concated harmony reexport PopupOpenError */__webpack_require__.d(__webpack_exports__, "PopupOpenError", function() { return PopupOpenError; });
            /* concated harmony reexport create */__webpack_require__.d(__webpack_exports__, "create", function() { return create; });
            /* concated harmony reexport destroy */__webpack_require__.d(__webpack_exports__, "destroy", function() { return component_destroy; });
            /* concated harmony reexport destroyComponents */__webpack_require__.d(__webpack_exports__, "destroyComponents", function() { return destroyComponents; });
            /* concated harmony reexport destroyAll */__webpack_require__.d(__webpack_exports__, "destroyAll", function() { return destroyAll; });
            /* concated harmony reexport Component */__webpack_require__.d(__webpack_exports__, "Component", function() { return component_Component; });
            /* concated harmony reexport PROP_TYPE */__webpack_require__.d(__webpack_exports__, "PROP_TYPE", function() { return PROP_TYPE; });
            /* concated harmony reexport PROP_SERIALIZATION */__webpack_require__.d(__webpack_exports__, "PROP_SERIALIZATION", function() { return PROP_SERIALIZATION; });
            /* concated harmony reexport CONTEXT */__webpack_require__.d(__webpack_exports__, "CONTEXT", function() { return CONTEXT; });
            /* concated harmony reexport EVENT */__webpack_require__.d(__webpack_exports__, "EVENT", function() { return EVENT; });




            /***/ })
            /******/ ]);
            });
            //# sourceMappingURL=zoid.frame.js.map
            });

            unwrapExports(zoid_frame);

            var zoid = createCommonjsModule(function (module, exports) {
            (function webpackUniversalModuleDefinition(root, factory) {
            	module.exports = factory();
            })((typeof self !== 'undefined' ? self : commonjsGlobal), function() {
            return /******/ (function(modules) { // webpackBootstrap
            /******/ 	// The module cache
            /******/ 	var installedModules = {};
            /******/
            /******/ 	// The require function
            /******/ 	function __webpack_require__(moduleId) {
            /******/
            /******/ 		// Check if module is in cache
            /******/ 		if(installedModules[moduleId]) {
            /******/ 			return installedModules[moduleId].exports;
            /******/ 		}
            /******/ 		// Create a new module (and put it into the cache)
            /******/ 		var module = installedModules[moduleId] = {
            /******/ 			i: moduleId,
            /******/ 			l: false,
            /******/ 			exports: {}
            /******/ 		};
            /******/
            /******/ 		// Execute the module function
            /******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);
            /******/
            /******/ 		// Flag the module as loaded
            /******/ 		module.l = true;
            /******/
            /******/ 		// Return the exports of the module
            /******/ 		return module.exports;
            /******/ 	}
            /******/
            /******/
            /******/ 	// expose the modules object (__webpack_modules__)
            /******/ 	__webpack_require__.m = modules;
            /******/
            /******/ 	// expose the module cache
            /******/ 	__webpack_require__.c = installedModules;
            /******/
            /******/ 	// define getter function for harmony exports
            /******/ 	__webpack_require__.d = function(exports, name, getter) {
            /******/ 		if(!__webpack_require__.o(exports, name)) {
            /******/ 			Object.defineProperty(exports, name, { enumerable: true, get: getter });
            /******/ 		}
            /******/ 	};
            /******/
            /******/ 	// define __esModule on exports
            /******/ 	__webpack_require__.r = function(exports) {
            /******/ 		if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
            /******/ 			Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
            /******/ 		}
            /******/ 		Object.defineProperty(exports, '__esModule', { value: true });
            /******/ 	};
            /******/
            /******/ 	// create a fake namespace object
            /******/ 	// mode & 1: value is a module id, require it
            /******/ 	// mode & 2: merge all properties of value into the ns
            /******/ 	// mode & 4: return value when already ns object
            /******/ 	// mode & 8|1: behave like require
            /******/ 	__webpack_require__.t = function(value, mode) {
            /******/ 		if(mode & 1) value = __webpack_require__(value);
            /******/ 		if(mode & 8) return value;
            /******/ 		if((mode & 4) && typeof value === 'object' && value && value.__esModule) return value;
            /******/ 		var ns = Object.create(null);
            /******/ 		__webpack_require__.r(ns);
            /******/ 		Object.defineProperty(ns, 'default', { enumerable: true, value: value });
            /******/ 		if(mode & 2 && typeof value != 'string') for(var key in value) __webpack_require__.d(ns, key, function(key) { return value[key]; }.bind(null, key));
            /******/ 		return ns;
            /******/ 	};
            /******/
            /******/ 	// getDefaultExport function for compatibility with non-harmony modules
            /******/ 	__webpack_require__.n = function(module) {
            /******/ 		var getter = module && module.__esModule ?
            /******/ 			function getDefault() { return module['default']; } :
            /******/ 			function getModuleExports() { return module; };
            /******/ 		__webpack_require__.d(getter, 'a', getter);
            /******/ 		return getter;
            /******/ 	};
            /******/
            /******/ 	// Object.prototype.hasOwnProperty.call
            /******/ 	__webpack_require__.o = function(object, property) { return Object.prototype.hasOwnProperty.call(object, property); };
            /******/
            /******/ 	// __webpack_public_path__
            /******/ 	__webpack_require__.p = "";
            /******/
            /******/
            /******/ 	// Load entry module and return exports
            /******/ 	return __webpack_require__(__webpack_require__.s = 0);
            /******/ })
            /************************************************************************/
            /******/ ([
            /* 0 */
            /***/ (function(module, __webpack_exports__, __webpack_require__) {
            __webpack_require__.r(__webpack_exports__);
            // CONCATENATED MODULE: ./node_modules/@babel/runtime/helpers/esm/extends.js
            function _extends() {
              _extends = Object.assign || function (target) {
                for (var i = 1; i < arguments.length; i++) {
                  var source = arguments[i];

                  for (var key in source) {
                    if (Object.prototype.hasOwnProperty.call(source, key)) {
                      target[key] = source[key];
                    }
                  }
                }

                return target;
              };

              return _extends.apply(this, arguments);
            }
            // CONCATENATED MODULE: ./node_modules/zalgo-promise/src/utils.js
            function utils_isPromise(item) {
              try {
                if (!item) {
                  return false;
                }

                if (typeof Promise !== 'undefined' && item instanceof Promise) {
                  return true;
                }

                if (typeof window !== 'undefined' && typeof window.Window === 'function' && item instanceof window.Window) {
                  return false;
                }

                if (typeof window !== 'undefined' && typeof window.constructor === 'function' && item instanceof window.constructor) {
                  return false;
                }

                var _toString = {}.toString;

                if (_toString) {
                  var name = _toString.call(item);

                  if (name === '[object Window]' || name === '[object global]' || name === '[object DOMWindow]') {
                    return false;
                  }
                }

                if (typeof item.then === 'function') {
                  return true;
                }
              } catch (err) {
                return false;
              }

              return false;
            }
            // CONCATENATED MODULE: ./node_modules/zalgo-promise/src/exceptions.js
            var dispatchedErrors = [];
            var possiblyUnhandledPromiseHandlers = [];
            function dispatchPossiblyUnhandledError(err, promise) {
              if (dispatchedErrors.indexOf(err) !== -1) {
                return;
              }

              dispatchedErrors.push(err);
              setTimeout(function () {

                throw err;
              }, 1);

              for (var j = 0; j < possiblyUnhandledPromiseHandlers.length; j++) {
                // $FlowFixMe
                possiblyUnhandledPromiseHandlers[j](err, promise);
              }
            }
            function exceptions_onPossiblyUnhandledException(handler) {
              possiblyUnhandledPromiseHandlers.push(handler);
              return {
                cancel: function cancel() {
                  possiblyUnhandledPromiseHandlers.splice(possiblyUnhandledPromiseHandlers.indexOf(handler), 1);
                }
              };
            }
            // CONCATENATED MODULE: ./node_modules/zalgo-promise/src/flush.js
            var activeCount = 0;
            var flushPromise;

            function flushActive() {
              if (!activeCount && flushPromise) {
                var promise = flushPromise;
                flushPromise = null;
                promise.resolve();
              }
            }

            function startActive() {
              activeCount += 1;
            }
            function endActive() {
              activeCount -= 1;
              flushActive();
            }
            function awaitActive(Zalgo) {
              // eslint-disable-line no-undef
              var promise = flushPromise = flushPromise || new Zalgo();
              flushActive();
              return promise;
            }
            // CONCATENATED MODULE: ./node_modules/zalgo-promise/src/promise.js



            var promise_ZalgoPromise =
            /*#__PURE__*/
            function () {
              function ZalgoPromise(handler) {
                var _this = this;

                this.resolved = void 0;
                this.rejected = void 0;
                this.errorHandled = void 0;
                this.value = void 0;
                this.error = void 0;
                this.handlers = void 0;
                this.dispatching = void 0;
                this.stack = void 0;
                this.resolved = false;
                this.rejected = false;
                this.errorHandled = false;
                this.handlers = [];

                if (handler) {
                  var _result;

                  var _error;

                  var resolved = false;
                  var rejected = false;
                  var isAsync = false;
                  startActive();

                  try {
                    handler(function (res) {
                      if (isAsync) {
                        _this.resolve(res);
                      } else {
                        resolved = true;
                        _result = res;
                      }
                    }, function (err) {
                      if (isAsync) {
                        _this.reject(err);
                      } else {
                        rejected = true;
                        _error = err;
                      }
                    });
                  } catch (err) {
                    endActive();
                    this.reject(err);
                    return;
                  }

                  endActive();
                  isAsync = true;

                  if (resolved) {
                    // $FlowFixMe
                    this.resolve(_result);
                  } else if (rejected) {
                    this.reject(_error);
                  }
                }
              }

              var _proto = ZalgoPromise.prototype;

              _proto.resolve = function resolve(result) {
                if (this.resolved || this.rejected) {
                  return this;
                }

                if (utils_isPromise(result)) {
                  throw new Error('Can not resolve promise with another promise');
                }

                this.resolved = true;
                this.value = result;
                this.dispatch();
                return this;
              };

              _proto.reject = function reject(error) {
                var _this2 = this;

                if (this.resolved || this.rejected) {
                  return this;
                }

                if (utils_isPromise(error)) {
                  throw new Error('Can not reject promise with another promise');
                }

                if (!error) {
                  // $FlowFixMe
                  var _err = error && typeof error.toString === 'function' ? error.toString() : Object.prototype.toString.call(error);

                  error = new Error("Expected reject to be called with Error, got " + _err);
                }

                this.rejected = true;
                this.error = error;

                if (!this.errorHandled) {
                  setTimeout(function () {
                    if (!_this2.errorHandled) {
                      dispatchPossiblyUnhandledError(error, _this2);
                    }
                  }, 1);
                }

                this.dispatch();
                return this;
              };

              _proto.asyncReject = function asyncReject(error) {
                this.errorHandled = true;
                this.reject(error);
                return this;
              };

              _proto.dispatch = function dispatch() {
                var dispatching = this.dispatching,
                    resolved = this.resolved,
                    rejected = this.rejected,
                    handlers = this.handlers;

                if (dispatching) {
                  return;
                }

                if (!resolved && !rejected) {
                  return;
                }

                this.dispatching = true;
                startActive();

                var chain = function chain(firstPromise, secondPromise) {
                  return firstPromise.then(function (res) {
                    secondPromise.resolve(res);
                  }, function (err) {
                    secondPromise.reject(err);
                  });
                };

                for (var i = 0; i < handlers.length; i++) {
                  var _handlers$i = handlers[i],
                      onSuccess = _handlers$i.onSuccess,
                      onError = _handlers$i.onError,
                      promise = _handlers$i.promise;

                  var _result2 = void 0;

                  if (resolved) {
                    try {
                      _result2 = onSuccess ? onSuccess(this.value) : this.value;
                    } catch (err) {
                      promise.reject(err);
                      continue;
                    }
                  } else if (rejected) {
                    if (!onError) {
                      promise.reject(this.error);
                      continue;
                    }

                    try {
                      _result2 = onError(this.error);
                    } catch (err) {
                      promise.reject(err);
                      continue;
                    }
                  }

                  if (_result2 instanceof ZalgoPromise && (_result2.resolved || _result2.rejected)) {
                    if (_result2.resolved) {
                      promise.resolve(_result2.value);
                    } else {
                      promise.reject(_result2.error);
                    }

                    _result2.errorHandled = true;
                  } else if (utils_isPromise(_result2)) {
                    if (_result2 instanceof ZalgoPromise && (_result2.resolved || _result2.rejected)) {
                      if (_result2.resolved) {
                        promise.resolve(_result2.value);
                      } else {
                        promise.reject(_result2.error);
                      }
                    } else {
                      // $FlowFixMe
                      chain(_result2, promise);
                    }
                  } else {
                    promise.resolve(_result2);
                  }
                }

                handlers.length = 0;
                this.dispatching = false;
                endActive();
              };

              _proto.then = function then(onSuccess, onError) {
                if (onSuccess && typeof onSuccess !== 'function' && !onSuccess.call) {
                  throw new Error('Promise.then expected a function for success handler');
                }

                if (onError && typeof onError !== 'function' && !onError.call) {
                  throw new Error('Promise.then expected a function for error handler');
                }

                var promise = new ZalgoPromise();
                this.handlers.push({
                  promise: promise,
                  onSuccess: onSuccess,
                  onError: onError
                });
                this.errorHandled = true;
                this.dispatch();
                return promise;
              };

              _proto.catch = function _catch(onError) {
                return this.then(undefined, onError);
              };

              _proto.finally = function _finally(onFinally) {
                if (onFinally && typeof onFinally !== 'function' && !onFinally.call) {
                  throw new Error('Promise.finally expected a function');
                }

                return this.then(function (result) {
                  return ZalgoPromise.try(onFinally).then(function () {
                    return result;
                  });
                }, function (err) {
                  return ZalgoPromise.try(onFinally).then(function () {
                    throw err;
                  });
                });
              };

              _proto.timeout = function timeout(time, err) {
                var _this3 = this;

                if (this.resolved || this.rejected) {
                  return this;
                }

                var timeout = setTimeout(function () {
                  if (_this3.resolved || _this3.rejected) {
                    return;
                  }

                  _this3.reject(err || new Error("Promise timed out after " + time + "ms"));
                }, time);
                return this.then(function (result) {
                  clearTimeout(timeout);
                  return result;
                });
              } // $FlowFixMe
              ;

              _proto.toPromise = function toPromise() {
                // $FlowFixMe
                if (typeof Promise === 'undefined') {
                  throw new TypeError("Could not find Promise");
                } // $FlowFixMe


                return Promise.resolve(this); // eslint-disable-line compat/compat
              };

              ZalgoPromise.resolve = function resolve(value) {
                if (value instanceof ZalgoPromise) {
                  return value;
                }

                if (utils_isPromise(value)) {
                  // $FlowFixMe
                  return new ZalgoPromise(function (resolve, reject) {
                    return value.then(resolve, reject);
                  });
                }

                return new ZalgoPromise().resolve(value);
              };

              ZalgoPromise.reject = function reject(error) {
                return new ZalgoPromise().reject(error);
              };

              ZalgoPromise.asyncReject = function asyncReject(error) {
                return new ZalgoPromise().asyncReject(error);
              };

              ZalgoPromise.all = function all(promises) {
                // eslint-disable-line no-undef
                var promise = new ZalgoPromise();
                var count = promises.length;
                var results = [];

                if (!count) {
                  promise.resolve(results);
                  return promise;
                }

                var chain = function chain(i, firstPromise, secondPromise) {
                  return firstPromise.then(function (res) {
                    results[i] = res;
                    count -= 1;

                    if (count === 0) {
                      promise.resolve(results);
                    }
                  }, function (err) {
                    secondPromise.reject(err);
                  });
                };

                for (var i = 0; i < promises.length; i++) {
                  var prom = promises[i];

                  if (prom instanceof ZalgoPromise) {
                    if (prom.resolved) {
                      results[i] = prom.value;
                      count -= 1;
                      continue;
                    }
                  } else if (!utils_isPromise(prom)) {
                    results[i] = prom;
                    count -= 1;
                    continue;
                  }

                  chain(i, ZalgoPromise.resolve(prom), promise);
                }

                if (count === 0) {
                  promise.resolve(results);
                }

                return promise;
              };

              ZalgoPromise.hash = function hash(promises) {
                // eslint-disable-line no-undef
                var result = {};
                return ZalgoPromise.all(Object.keys(promises).map(function (key) {
                  return ZalgoPromise.resolve(promises[key]).then(function (value) {
                    result[key] = value;
                  });
                })).then(function () {
                  return result;
                });
              };

              ZalgoPromise.map = function map(items, method) {
                // $FlowFixMe
                return ZalgoPromise.all(items.map(method));
              };

              ZalgoPromise.onPossiblyUnhandledException = function onPossiblyUnhandledException(handler) {
                return exceptions_onPossiblyUnhandledException(handler);
              };

              ZalgoPromise.try = function _try(method, context, args) {
                if (method && typeof method !== 'function' && !method.call) {
                  throw new Error('Promise.try expected a function');
                }

                var result;
                startActive();

                try {
                  // $FlowFixMe
                  result = method.apply(context, args || []);
                } catch (err) {
                  endActive();
                  return ZalgoPromise.reject(err);
                }

                endActive();
                return ZalgoPromise.resolve(result);
              };

              ZalgoPromise.delay = function delay(_delay) {
                return new ZalgoPromise(function (resolve) {
                  setTimeout(resolve, _delay);
                });
              };

              ZalgoPromise.isPromise = function isPromise(value) {
                if (value && value instanceof ZalgoPromise) {
                  return true;
                }

                return utils_isPromise(value);
              };

              ZalgoPromise.flush = function flush() {
                return awaitActive(ZalgoPromise);
              };

              return ZalgoPromise;
            }();
            // CONCATENATED MODULE: ./node_modules/zalgo-promise/src/index.js

            // CONCATENATED MODULE: ./node_modules/cross-domain-utils/src/util.js
            function isRegex(item) {
              return Object.prototype.toString.call(item) === '[object RegExp]';
            } // eslint-disable-next-line no-unused-vars

            function noop() {// pass
            }
            // CONCATENATED MODULE: ./node_modules/cross-domain-utils/src/constants.js
            var PROTOCOL = {
              MOCK: 'mock:',
              FILE: 'file:',
              ABOUT: 'about:'
            };
            var WILDCARD = '*';
            var WINDOW_TYPE = {
              IFRAME: 'iframe',
              POPUP: 'popup'
            };
            // CONCATENATED MODULE: ./node_modules/cross-domain-utils/src/utils.js
            /* eslint max-lines: 0 */


            var IE_WIN_ACCESS_ERROR = 'Call was rejected by callee.\r\n';
            function isAboutProtocol(win) {
              if (win === void 0) {
                win = window;
              }

              return win.location.protocol === PROTOCOL.ABOUT;
            }
            function getParent(win) {
              if (win === void 0) {
                win = window;
              }

              if (!win) {
                return;
              }

              try {
                if (win.parent && win.parent !== win) {
                  return win.parent;
                }
              } catch (err) {// pass
              }
            }
            function getOpener(win) {
              if (win === void 0) {
                win = window;
              }

              if (!win) {
                return;
              } // Make sure we're not actually an iframe which has had window.open() called on us


              if (getParent(win)) {
                return;
              }

              try {
                return win.opener;
              } catch (err) {// pass
              }
            }
            function canReadFromWindow(win) {
              try {
                // $FlowFixMe
                noop(win && win.location && win.location.href);
                return true;
              } catch (err) {// pass
              }

              return false;
            }
            function getActualDomain(win) {
              if (win === void 0) {
                win = window;
              }

              var location = win.location;

              if (!location) {
                throw new Error("Can not read window location");
              }

              var protocol = location.protocol;

              if (!protocol) {
                throw new Error("Can not read window protocol");
              }

              if (protocol === PROTOCOL.FILE) {
                return PROTOCOL.FILE + "//";
              }

              if (protocol === PROTOCOL.ABOUT) {
                var parent = getParent(win);

                if (parent && canReadFromWindow(parent)) {
                  // $FlowFixMe
                  return getActualDomain(parent);
                }

                return PROTOCOL.ABOUT + "//";
              }

              var host = location.host;

              if (!host) {
                throw new Error("Can not read window host");
              }

              return protocol + "//" + host;
            }
            function utils_getDomain(win) {
              if (win === void 0) {
                win = window;
              }

              var domain = getActualDomain(win);

              if (domain && win.mockDomain && win.mockDomain.indexOf(PROTOCOL.MOCK) === 0) {
                return win.mockDomain;
              }

              return domain;
            }
            function isBlankDomain(win) {
              try {
                // $FlowFixMe
                if (!win.location.href) {
                  return true;
                }

                if (win.location.href === 'about:blank') {
                  return true;
                }
              } catch (err) {// pass
              }

              return false;
            }
            function isActuallySameDomain(win) {
              try {
                if (win === window) {
                  return true;
                }
              } catch (err) {// pass
              }

              try {
                var desc = Object.getOwnPropertyDescriptor(win, 'location');

                if (desc && desc.enumerable === false) {
                  return false;
                }
              } catch (err) {// pass
              }

              try {
                // $FlowFixMe
                if (isAboutProtocol(win) && canReadFromWindow(win)) {
                  return true;
                }
              } catch (err) {// pass
              }

              try {
                // $FlowFixMe
                if (getActualDomain(win) === getActualDomain(window)) {
                  return true;
                }
              } catch (err) {// pass
              }

              return false;
            }
            function isSameDomain(win) {
              if (!isActuallySameDomain(win)) {
                return false;
              }

              try {
                if (win === window) {
                  return true;
                } // $FlowFixMe


                if (isAboutProtocol(win) && canReadFromWindow(win)) {
                  return true;
                } // $FlowFixMe


                if (utils_getDomain(window) === utils_getDomain(win)) {
                  return true;
                }
              } catch (err) {// pass
              }

              return false;
            }
            function assertSameDomain(win) {
              if (!isSameDomain(win)) {
                throw new Error("Expected window to be same domain");
              } // $FlowFixMe


              return win;
            }
            function getParents(win) {
              var result = [];

              try {
                while (win.parent !== win) {
                  result.push(win.parent);
                  win = win.parent;
                }
              } catch (err) {// pass
              }

              return result;
            }
            function isAncestorParent(parent, child) {
              if (!parent || !child) {
                return false;
              }

              var childParent = getParent(child);

              if (childParent) {
                return childParent === parent;
              }

              if (getParents(child).indexOf(parent) !== -1) {
                return true;
              }

              return false;
            }
            function getFrames(win) {
              var result = [];
              var frames;

              try {
                frames = win.frames;
              } catch (err) {
                frames = win;
              }

              var len;

              try {
                len = frames.length;
              } catch (err) {// pass
              }

              if (len === 0) {
                return result;
              }

              if (len) {
                for (var i = 0; i < len; i++) {
                  var frame = void 0;

                  try {
                    frame = frames[i];
                  } catch (err) {
                    continue;
                  }

                  result.push(frame);
                }

                return result;
              }

              for (var _i = 0; _i < 100; _i++) {
                var _frame = void 0;

                try {
                  _frame = frames[_i];
                } catch (err) {
                  return result;
                }

                if (!_frame) {
                  return result;
                }

                result.push(_frame);
              }

              return result;
            }
            function getAllChildFrames(win) {
              var result = [];

              for (var _i3 = 0, _getFrames2 = getFrames(win); _i3 < _getFrames2.length; _i3++) {
                var frame = _getFrames2[_i3];
                result.push(frame);

                for (var _i5 = 0, _getAllChildFrames2 = getAllChildFrames(frame); _i5 < _getAllChildFrames2.length; _i5++) {
                  var childFrame = _getAllChildFrames2[_i5];
                  result.push(childFrame);
                }
              }

              return result;
            }
            function getTop(win) {
              if (win === void 0) {
                win = window;
              }

              try {
                if (win.top) {
                  return win.top;
                }
              } catch (err) {// pass
              }

              if (getParent(win) === win) {
                return win;
              }

              try {
                if (isAncestorParent(window, win) && window.top) {
                  return window.top;
                }
              } catch (err) {// pass
              }

              try {
                if (isAncestorParent(win, window) && window.top) {
                  return window.top;
                }
              } catch (err) {// pass
              }

              for (var _i7 = 0, _getAllChildFrames4 = getAllChildFrames(win); _i7 < _getAllChildFrames4.length; _i7++) {
                var frame = _getAllChildFrames4[_i7];

                try {
                  if (frame.top) {
                    return frame.top;
                  }
                } catch (err) {// pass
                }

                if (getParent(frame) === frame) {
                  return frame;
                }
              }
            }
            function getAllFramesInWindow(win) {
              var top = getTop(win);

              if (!top) {
                throw new Error("Can not determine top window");
              }

              return [].concat(getAllChildFrames(top), [top]);
            }
            function isFrameWindowClosed(frame) {
              if (!frame.contentWindow) {
                return true;
              }

              if (!frame.parentNode) {
                return true;
              }

              var doc = frame.ownerDocument;

              if (doc && doc.documentElement && !doc.documentElement.contains(frame)) {
                return true;
              }

              return false;
            }

            function safeIndexOf(collection, item) {
              for (var i = 0; i < collection.length; i++) {
                try {
                  if (collection[i] === item) {
                    return i;
                  }
                } catch (err) {// pass
                }
              }

              return -1;
            }

            var iframeWindows = [];
            var iframeFrames = [];
            function isWindowClosed(win, allowMock) {
              if (allowMock === void 0) {
                allowMock = true;
              }

              try {
                if (win === window) {
                  return false;
                }
              } catch (err) {
                return true;
              }

              try {
                if (!win) {
                  return true;
                }
              } catch (err) {
                return true;
              }

              try {
                if (win.closed) {
                  return true;
                }
              } catch (err) {
                // I love you so much IE
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return false;
                }

                return true;
              }

              if (allowMock && isSameDomain(win)) {
                try {
                  // $FlowFixMe
                  if (win.mockclosed) {
                    return true;
                  }
                } catch (err) {// pass
                }
              } // Mobile safari


              try {
                if (!win.parent || !win.top) {
                  return true;
                }
              } catch (err) {} // pass
              // Yes, this actually happens in IE. win === win errors out when the window
              // is from an iframe, and the iframe was removed from the page.


              try {
                noop(win === win); // eslint-disable-line no-self-compare
              } catch (err) {
                return true;
              } // IE orphaned frame


              var iframeIndex = safeIndexOf(iframeWindows, win);

              if (iframeIndex !== -1) {
                var frame = iframeFrames[iframeIndex];

                if (frame && isFrameWindowClosed(frame)) {
                  return true;
                }
              }

              return false;
            }

            function cleanIframes() {
              for (var i = 0; i < iframeWindows.length; i++) {
                var closed = false;

                try {
                  closed = iframeWindows[i].closed;
                } catch (err) {// pass
                }

                if (closed) {
                  iframeFrames.splice(i, 1);
                  iframeWindows.splice(i, 1);
                }
              }
            }

            function linkFrameWindow(frame) {
              cleanIframes();

              if (frame && frame.contentWindow) {
                try {
                  iframeWindows.push(frame.contentWindow);
                  iframeFrames.push(frame);
                } catch (err) {// pass
                }
              }
            }
            function utils_getUserAgent(win) {
              win = win || window;
              return win.navigator.mockUserAgent || win.navigator.userAgent;
            }
            function getFrameByName(win, name) {
              var winFrames = getFrames(win);

              for (var _i9 = 0; _i9 < winFrames.length; _i9++) {
                var childFrame = winFrames[_i9];

                try {
                  // $FlowFixMe
                  if (isSameDomain(childFrame) && childFrame.name === name && winFrames.indexOf(childFrame) !== -1) {
                    return childFrame;
                  }
                } catch (err) {// pass
                }
              }

              try {
                // $FlowFixMe
                if (winFrames.indexOf(win.frames[name]) !== -1) {
                  // $FlowFixMe
                  return win.frames[name];
                }
              } catch (err) {// pass
              }

              try {
                if (winFrames.indexOf(win[name]) !== -1) {
                  return win[name];
                }
              } catch (err) {// pass
              }
            }
            function isOpener(parent, child) {
              return parent === getOpener(child);
            }
            function getAncestor(win) {
              if (win === void 0) {
                win = window;
              }

              win = win || window;
              var opener = getOpener(win);

              if (opener) {
                return opener;
              }

              var parent = getParent(win);

              if (parent) {
                return parent;
              }
            }
            function isAncestor(parent, child) {
              var actualParent = getAncestor(child);

              if (actualParent) {
                if (actualParent === parent) {
                  return true;
                }

                return false;
              }

              if (child === parent) {
                return false;
              }

              if (getTop(child) === child) {
                return false;
              }

              for (var _i15 = 0, _getFrames8 = getFrames(parent); _i15 < _getFrames8.length; _i15++) {
                var frame = _getFrames8[_i15];

                if (frame === child) {
                  return true;
                }
              }

              return false;
            }

            function anyMatch(collection1, collection2) {
              for (var _i17 = 0; _i17 < collection1.length; _i17++) {
                var item1 = collection1[_i17];

                for (var _i19 = 0; _i19 < collection2.length; _i19++) {
                  var item2 = collection2[_i19];

                  if (item1 === item2) {
                    return true;
                  }
                }
              }

              return false;
            }

            function getDistanceFromTop(win) {
              if (win === void 0) {
                win = window;
              }

              var distance = 0;
              var parent = win;

              while (parent) {
                parent = getParent(parent);

                if (parent) {
                  distance += 1;
                }
              }

              return distance;
            }
            function getNthParent(win, n) {
              if (n === void 0) {
                n = 1;
              }

              var parent = win;

              for (var i = 0; i < n; i++) {
                if (!parent) {
                  return;
                }

                parent = getParent(parent);
              }

              return parent;
            }
            function getNthParentFromTop(win, n) {
              if (n === void 0) {
                n = 1;
              }

              return getNthParent(win, getDistanceFromTop(win) - n);
            }
            function isSameTopWindow(win1, win2) {
              var top1 = getTop(win1) || win1;
              var top2 = getTop(win2) || win2;

              try {
                if (top1 && top2) {
                  if (top1 === top2) {
                    return true;
                  }

                  return false;
                }
              } catch (err) {// pass
              }

              var allFrames1 = getAllFramesInWindow(win1);
              var allFrames2 = getAllFramesInWindow(win2);

              if (anyMatch(allFrames1, allFrames2)) {
                return true;
              }

              var opener1 = getOpener(top1);
              var opener2 = getOpener(top2);

              if (opener1 && anyMatch(getAllFramesInWindow(opener1), allFrames2)) {
                return false;
              }

              if (opener2 && anyMatch(getAllFramesInWindow(opener2), allFrames1)) {
                return false;
              }

              return false;
            }
            function matchDomain(pattern, origin) {
              if (typeof pattern === 'string') {
                if (typeof origin === 'string') {
                  return pattern === WILDCARD || origin === pattern;
                }

                if (isRegex(origin)) {
                  return false;
                }

                if (Array.isArray(origin)) {
                  return false;
                }
              }

              if (isRegex(pattern)) {
                if (isRegex(origin)) {
                  return pattern.toString() === origin.toString();
                }

                if (Array.isArray(origin)) {
                  return false;
                } // $FlowFixMe


                return Boolean(origin.match(pattern));
              }

              if (Array.isArray(pattern)) {
                if (Array.isArray(origin)) {
                  return JSON.stringify(pattern) === JSON.stringify(origin);
                }

                if (isRegex(origin)) {
                  return false;
                }

                return pattern.some(function (subpattern) {
                  return matchDomain(subpattern, origin);
                });
              }

              return false;
            }
            function stringifyDomainPattern(pattern) {
              if (Array.isArray(pattern)) {
                return "(" + pattern.join(' | ') + ")";
              } else if (isRegex(pattern)) {
                return "RegExp(" + pattern.toString();
              } else {
                return pattern.toString();
              }
            }
            function getDomainFromUrl(url) {
              var domain;

              if (url.match(/^(https?|mock|file):\/\//)) {
                domain = url;
              } else {
                return utils_getDomain();
              }

              domain = domain.split('/').slice(0, 3).join('/');
              return domain;
            }
            function onCloseWindow(win, callback, delay, maxtime) {
              if (delay === void 0) {
                delay = 1000;
              }

              if (maxtime === void 0) {
                maxtime = Infinity;
              }

              var timeout;

              var check = function check() {
                if (isWindowClosed(win)) {
                  if (timeout) {
                    clearTimeout(timeout);
                  }

                  return callback();
                }

                if (maxtime <= 0) {
                  clearTimeout(timeout);
                } else {
                  maxtime -= delay;
                  timeout = setTimeout(check, delay);
                }
              };

              check();
              return {
                cancel: function cancel() {
                  if (timeout) {
                    clearTimeout(timeout);
                  }
                }
              };
            } // eslint-disable-next-line complexity

            function isWindow(obj) {
              try {
                if (obj === window) {
                  return true;
                }
              } catch (err) {
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return true;
                }
              }

              try {
                if (Object.prototype.toString.call(obj) === '[object Window]') {
                  return true;
                }
              } catch (err) {
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return true;
                }
              }

              try {
                if (window.Window && obj instanceof window.Window) {
                  return true;
                }
              } catch (err) {
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return true;
                }
              }

              try {
                if (obj && obj.self === obj) {
                  return true;
                }
              } catch (err) {
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return true;
                }
              }

              try {
                if (obj && obj.parent === obj) {
                  return true;
                }
              } catch (err) {
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return true;
                }
              }

              try {
                if (obj && obj.top === obj) {
                  return true;
                }
              } catch (err) {
                if (err && err.message === IE_WIN_ACCESS_ERROR) {
                  return true;
                }
              }

              try {
                if (noop(obj === obj) === '__unlikely_value__') {
                  // eslint-disable-line no-self-compare
                  return false;
                }
              } catch (err) {
                return true;
              }

              try {
                if (obj && obj.__cross_domain_utils_window_check__ === '__unlikely_value__') {
                  return false;
                }
              } catch (err) {
                return true;
              }

              return false;
            }
            function isMockDomain(domain) {
              return domain.indexOf(PROTOCOL.MOCK) === 0;
            }
            function normalizeMockUrl(url) {
              if (!isMockDomain(getDomainFromUrl(url))) {
                return url;
              }

              {
                throw new Error("Mock urls not supported out of test mode");
              }
            }
            function closeWindow(win) {
              try {
                win.close();
              } catch (err) {// pass
              }
            }
            function getFrameForWindow(win) {
              if (isSameDomain(win)) {
                return assertSameDomain(win).frameElement;
              }

              for (var _i21 = 0, _document$querySelect2 = document.querySelectorAll('iframe'); _i21 < _document$querySelect2.length; _i21++) {
                var frame = _document$querySelect2[_i21];

                if (frame && frame.contentWindow && frame.contentWindow === win) {
                  return frame;
                }
              }
            }
            // CONCATENATED MODULE: ./node_modules/cross-domain-utils/src/index.js



            // CONCATENATED MODULE: ./node_modules/cross-domain-safe-weakmap/src/native.js
            function hasNativeWeakMap() {
              if (typeof WeakMap === 'undefined') {
                return false;
              }

              if (typeof Object.freeze === 'undefined') {
                return false;
              }

              try {
                var testWeakMap = new WeakMap();
                var testKey = {};
                var testValue = '__testvalue__';
                Object.freeze(testKey);
                testWeakMap.set(testKey, testValue);

                if (testWeakMap.get(testKey) === testValue) {
                  return true;
                }

                return false;
              } catch (err) {
                return false;
              }
            }
            // CONCATENATED MODULE: ./node_modules/cross-domain-safe-weakmap/src/util.js
            function util_safeIndexOf(collection, item) {
              for (var i = 0; i < collection.length; i++) {
                try {
                  if (collection[i] === item) {
                    return i;
                  }
                } catch (err) {// pass
                }
              }

              return -1;
            } // eslint-disable-next-line no-unused-vars

            function util_noop() {// pass
            }
            // CONCATENATED MODULE: ./node_modules/cross-domain-safe-weakmap/src/weakmap.js



            var weakmap_CrossDomainSafeWeakMap =
            /*#__PURE__*/
            function () {
              function CrossDomainSafeWeakMap() {
                this.name = void 0;
                this.weakmap = void 0;
                this.keys = void 0;
                this.values = void 0;
                // eslint-disable-next-line no-bitwise
                this.name = "__weakmap_" + (Math.random() * 1e9 >>> 0) + "__";

                if (hasNativeWeakMap()) {
                  try {
                    this.weakmap = new WeakMap();
                  } catch (err) {// pass
                  }
                }

                this.keys = [];
                this.values = [];
              }

              var _proto = CrossDomainSafeWeakMap.prototype;

              _proto._cleanupClosedWindows = function _cleanupClosedWindows() {
                var weakmap = this.weakmap;
                var keys = this.keys;

                for (var i = 0; i < keys.length; i++) {
                  var value = keys[i];

                  if (isWindow(value) && isWindowClosed(value)) {
                    if (weakmap) {
                      try {
                        weakmap.delete(value);
                      } catch (err) {// pass
                      }
                    }

                    keys.splice(i, 1);
                    this.values.splice(i, 1);
                    i -= 1;
                  }
                }
              };

              _proto.isSafeToReadWrite = function isSafeToReadWrite(key) {
                if (isWindow(key)) {
                  return false;
                }

                try {
                  util_noop(key && key.self);
                  util_noop(key && key[this.name]);
                } catch (err) {
                  return false;
                }

                return true;
              };

              _proto.set = function set(key, value) {
                if (!key) {
                  throw new Error("WeakMap expected key");
                }

                var weakmap = this.weakmap;

                if (weakmap) {
                  try {
                    weakmap.set(key, value);
                  } catch (err) {
                    delete this.weakmap;
                  }
                }

                if (this.isSafeToReadWrite(key)) {
                  try {
                    var name = this.name;
                    var entry = key[name];

                    if (entry && entry[0] === key) {
                      entry[1] = value;
                    } else {
                      Object.defineProperty(key, name, {
                        value: [key, value],
                        writable: true
                      });
                    }

                    return;
                  } catch (err) {// pass
                  }
                }

                this._cleanupClosedWindows();

                var keys = this.keys;
                var values = this.values;
                var index = util_safeIndexOf(keys, key);

                if (index === -1) {
                  keys.push(key);
                  values.push(value);
                } else {
                  values[index] = value;
                }
              };

              _proto.get = function get(key) {
                if (!key) {
                  throw new Error("WeakMap expected key");
                }

                var weakmap = this.weakmap;

                if (weakmap) {
                  try {
                    if (weakmap.has(key)) {
                      return weakmap.get(key);
                    }
                  } catch (err) {
                    delete this.weakmap;
                  }
                }

                if (this.isSafeToReadWrite(key)) {
                  try {
                    var entry = key[this.name];

                    if (entry && entry[0] === key) {
                      return entry[1];
                    }

                    return;
                  } catch (err) {// pass
                  }
                }

                this._cleanupClosedWindows();

                var keys = this.keys;
                var index = util_safeIndexOf(keys, key);

                if (index === -1) {
                  return;
                }

                return this.values[index];
              };

              _proto.delete = function _delete(key) {
                if (!key) {
                  throw new Error("WeakMap expected key");
                }

                var weakmap = this.weakmap;

                if (weakmap) {
                  try {
                    weakmap.delete(key);
                  } catch (err) {
                    delete this.weakmap;
                  }
                }

                if (this.isSafeToReadWrite(key)) {
                  try {
                    var entry = key[this.name];

                    if (entry && entry[0] === key) {
                      entry[0] = entry[1] = undefined;
                    }
                  } catch (err) {// pass
                  }
                }

                this._cleanupClosedWindows();

                var keys = this.keys;
                var index = util_safeIndexOf(keys, key);

                if (index !== -1) {
                  keys.splice(index, 1);
                  this.values.splice(index, 1);
                }
              };

              _proto.has = function has(key) {
                if (!key) {
                  throw new Error("WeakMap expected key");
                }

                var weakmap = this.weakmap;

                if (weakmap) {
                  try {
                    if (weakmap.has(key)) {
                      return true;
                    }
                  } catch (err) {
                    delete this.weakmap;
                  }
                }

                if (this.isSafeToReadWrite(key)) {
                  try {
                    var entry = key[this.name];

                    if (entry && entry[0] === key) {
                      return true;
                    }

                    return false;
                  } catch (err) {// pass
                  }
                }

                this._cleanupClosedWindows();

                var index = util_safeIndexOf(this.keys, key);
                return index !== -1;
              };

              _proto.getOrSet = function getOrSet(key, getter) {
                if (this.has(key)) {
                  // $FlowFixMe
                  return this.get(key);
                }

                var value = getter();
                this.set(key, value);
                return value;
              };

              return CrossDomainSafeWeakMap;
            }();
            // CONCATENATED MODULE: ./node_modules/cross-domain-safe-weakmap/src/index.js

            // CONCATENATED MODULE: ./node_modules/belter/src/util.js
            /* eslint max-lines: 0 */


            function getFunctionName(fn) {
              return fn.name || fn.__name__ || fn.displayName || 'anonymous';
            }
            function setFunctionName(fn, name) {
              try {
                delete fn.name;
                fn.name = name;
              } catch (err) {// pass
              }

              fn.__name__ = fn.displayName = name;
              return fn;
            }
            function base64encode(str) {
              if (typeof btoa === 'function') {
                return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, function (m, p1) {
                  return String.fromCharCode(parseInt(p1, 16));
                }));
              }

              if (typeof Buffer !== 'undefined') {
                return Buffer.from(str, 'utf8').toString('base64');
              }

              throw new Error("Can not find window.btoa or Buffer");
            }
            function base64decode(str) {
              if (typeof atob === 'function') {
                return decodeURIComponent(Array.prototype.map.call(atob(str), function (c) {
                  // eslint-disable-next-line prefer-template
                  return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
                }).join(''));
              }

              if (typeof Buffer !== 'undefined') {
                return Buffer.from(str, 'base64').toString('utf8');
              }

              throw new Error("Can not find window.atob or Buffer");
            }
            function uniqueID() {
              var chars = '0123456789abcdef';
              var randomID = 'xxxxxxxxxx'.replace(/./g, function () {
                return chars.charAt(Math.floor(Math.random() * chars.length));
              });
              var timeID = base64encode(new Date().toISOString().slice(11, 19).replace('T', '.')).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              return randomID + "_" + timeID;
            }
            var objectIDs;
            function getObjectID(obj) {
              objectIDs = objectIDs || new weakmap_CrossDomainSafeWeakMap();

              if (obj === null || obj === undefined || typeof obj !== 'object' && typeof obj !== 'function') {
                throw new Error("Invalid object");
              }

              var uid = objectIDs.get(obj);

              if (!uid) {
                uid = typeof obj + ":" + uniqueID();
                objectIDs.set(obj, uid);
              }

              return uid;
            }

            function serializeArgs(args) {
              try {
                return JSON.stringify(Array.prototype.slice.call(args), function (subkey, val) {
                  if (typeof val === 'function') {
                    return "memoize[" + getObjectID(val) + "]";
                  }

                  return val;
                });
              } catch (err) {
                throw new Error("Arguments not serializable -- can not be used to memoize");
              }
            }

            function memoizePromise(method) {
              var cache = {}; // eslint-disable-next-line flowtype/no-weak-types

              function memoizedPromiseFunction() {
                var _arguments = arguments,
                    _this2 = this;

                for (var _len2 = arguments.length, args = new Array(_len2), _key2 = 0; _key2 < _len2; _key2++) {
                  args[_key2] = arguments[_key2];
                }

                var key = serializeArgs(args);

                if (cache.hasOwnProperty(key)) {
                  return cache[key];
                }

                cache[key] = promise_ZalgoPromise.try(function () {
                  return method.apply(_this2, _arguments);
                }).finally(function () {
                  delete cache[key];
                });
                return cache[key];
              }

              memoizedPromiseFunction.reset = function () {
                cache = {};
              };

              return setFunctionName(memoizedPromiseFunction, getFunctionName(method) + "::promiseMemoized");
            } // eslint-disable-next-line flowtype/no-weak-types

            function inlineMemoize(method, logic, args) {
              if (args === void 0) {
                args = [];
              }

              // $FlowFixMe
              var cache = method.__inline_memoize_cache__ = method.__inline_memoize_cache__ || {};
              var key = serializeArgs(args);

              if (cache.hasOwnProperty(key)) {
                return cache[key];
              }

              var result = cache[key] = logic.apply(void 0, args);
              return result;
            } // eslint-disable-next-line no-unused-vars

            function src_util_noop() {// pass
            }
            function once(method) {
              var called = false;

              var onceFunction = function onceFunction() {
                if (!called) {
                  called = true;
                  return method.apply(this, arguments);
                }
              };

              return setFunctionName(onceFunction, getFunctionName(method) + "::once");
            }
            function stringifyError(err, level) {
              if (level === void 0) {
                level = 1;
              }

              if (level >= 3) {
                return 'stringifyError stack overflow';
              }

              try {
                if (!err) {
                  return "<unknown error: " + Object.prototype.toString.call(err) + ">";
                }

                if (typeof err === 'string') {
                  return err;
                }

                if (err instanceof Error) {
                  var stack = err && err.stack;
                  var message = err && err.message;

                  if (stack && message) {
                    if (stack.indexOf(message) !== -1) {
                      return stack;
                    } else {
                      return message + "\n" + stack;
                    }
                  } else if (stack) {
                    return stack;
                  } else if (message) {
                    return message;
                  }
                }

                if (err && err.toString && typeof err.toString === 'function') {
                  // $FlowFixMe
                  return err.toString();
                }

                return Object.prototype.toString.call(err);
              } catch (newErr) {
                // eslint-disable-line unicorn/catch-error-name
                return "Error while stringifying error: " + stringifyError(newErr, level + 1);
              }
            }
            function stringify(item) {
              if (typeof item === 'string') {
                return item;
              }

              if (item && item.toString && typeof item.toString === 'function') {
                // $FlowFixMe
                return item.toString();
              }

              return Object.prototype.toString.call(item);
            }
            function extend(obj, source) {
              if (!source) {
                return obj;
              }

              if (Object.assign) {
                return Object.assign(obj, source);
              }

              for (var key in source) {
                if (source.hasOwnProperty(key)) {
                  obj[key] = source[key];
                }
              }

              return obj;
            }
            function util_values(obj) {
              var result = [];

              for (var key in obj) {
                if (obj.hasOwnProperty(key)) {
                  result.push(obj[key]);
                }
              }

              return result;
            }
            function safeInterval(method, time) {
              var timeout;

              function loop() {
                timeout = setTimeout(function () {
                  method();
                  loop();
                }, time);
              }

              loop();
              return {
                cancel: function cancel() {
                  clearTimeout(timeout);
                }
              };
            }
            function serializePrimitive(value) {
              return value.toString();
            }
            function dotify(obj, prefix, newobj) {
              if (prefix === void 0) {
                prefix = '';
              }

              if (newobj === void 0) {
                newobj = {};
              }

              prefix = prefix ? prefix + "." : prefix;

              for (var key in obj) {
                if (!obj.hasOwnProperty(key) || obj[key] === undefined || obj[key] === null || typeof obj[key] === 'function') {
                  continue;
                } else if (obj[key] && Array.isArray(obj[key]) && obj[key].length && obj[key].every(function (val) {
                  return typeof val !== 'object';
                })) {
                  newobj["" + prefix + key + "[]"] = obj[key].join(',');
                } else if (obj[key] && typeof obj[key] === 'object') {
                  newobj = dotify(obj[key], "" + prefix + key, newobj);
                } else {
                  newobj["" + prefix + key] = serializePrimitive(obj[key]);
                }
              }

              return newobj;
            }
            function eventEmitter() {
              var triggered = {};
              var handlers = {};
              return {
                on: function on(eventName, handler) {
                  var handlerList = handlers[eventName] = handlers[eventName] || [];
                  handlerList.push(handler);
                  var cancelled = false;
                  return {
                    cancel: function cancel() {
                      if (!cancelled) {
                        cancelled = true;
                        handlerList.splice(handlerList.indexOf(handler), 1);
                      }
                    }
                  };
                },
                once: function once(eventName, handler) {
                  var listener = this.on(eventName, function () {
                    listener.cancel();
                    handler();
                  });
                  return listener;
                },
                trigger: function trigger(eventName) {
                  for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
                    args[_key3 - 1] = arguments[_key3];
                  }

                  var handlerList = handlers[eventName];
                  var promises = [];

                  if (handlerList) {
                    var _loop = function _loop(_i2) {
                      var handler = handlerList[_i2];
                      promises.push(promise_ZalgoPromise.try(function () {
                        return handler.apply(void 0, args);
                      }));
                    };

                    for (var _i2 = 0; _i2 < handlerList.length; _i2++) {
                      _loop(_i2);
                    }
                  }

                  return promise_ZalgoPromise.all(promises).then(src_util_noop);
                },
                triggerOnce: function triggerOnce(eventName) {
                  if (triggered[eventName]) {
                    return promise_ZalgoPromise.resolve();
                  }

                  triggered[eventName] = true;

                  for (var _len4 = arguments.length, args = new Array(_len4 > 1 ? _len4 - 1 : 0), _key4 = 1; _key4 < _len4; _key4++) {
                    args[_key4 - 1] = arguments[_key4];
                  }

                  return this.trigger.apply(this, [eventName].concat(args));
                },
                reset: function reset() {
                  handlers = {};
                }
              };
            }
            function arrayFrom(item) {
              // eslint-disable-line no-undef
              return Array.prototype.slice.call(item);
            }
            function isDefined(value) {
              return value !== null && value !== undefined;
            }
            function util_isRegex(item) {
              return Object.prototype.toString.call(item) === '[object RegExp]';
            }
            function util_getOrSet(obj, key, getter) {
              if (obj.hasOwnProperty(key)) {
                return obj[key];
              }

              var val = getter();
              obj[key] = val;
              return val;
            }
            function cleanup(obj) {
              var tasks = [];
              var cleaned = false;
              return {
                set: function set(name, item) {
                  if (!cleaned) {
                    obj[name] = item;
                    this.register(function () {
                      delete obj[name];
                    });
                  }

                  return item;
                },
                register: function register(method) {
                  if (cleaned) {
                    method();
                  } else {
                    tasks.push(once(method));
                  }
                },
                all: function all() {
                  var results = [];
                  cleaned = true;

                  while (tasks.length) {
                    var task = tasks.pop();
                    results.push(task());
                  }

                  return promise_ZalgoPromise.all(results).then(src_util_noop);
                }
              };
            }
            function assertExists(name, thing) {
              if (thing === null || typeof thing === 'undefined') {
                throw new Error("Expected " + name + " to be present");
              }

              return thing;
            }
            // CONCATENATED MODULE: ./node_modules/belter/src/dom.js


            /* eslint max-lines: off */






            function isDocumentReady() {
              return Boolean(document.body) && document.readyState === 'complete';
            }
            function urlEncode(str) {
              return str.replace(/\?/g, '%3F').replace(/&/g, '%26').replace(/#/g, '%23').replace(/\+/g, '%2B');
            }
            function waitForDocumentReady() {
              return inlineMemoize(waitForDocumentReady, function () {
                return new promise_ZalgoPromise(function (resolve) {
                  if (isDocumentReady()) {
                    return resolve();
                  }

                  var interval = setInterval(function () {
                    if (isDocumentReady()) {
                      clearInterval(interval);
                      return resolve();
                    }
                  }, 10);
                });
              });
            }
            function waitForDocumentBody() {
              return waitForDocumentReady().then(function () {
                if (document.body) {
                  return document.body;
                }

                throw new Error('Document ready but document.body not present');
              });
            }
            function parseQuery(queryString) {
              return inlineMemoize(parseQuery, function () {
                var params = {};

                if (!queryString) {
                  return params;
                }

                if (queryString.indexOf('=') === -1) {
                  return params;
                }

                for (var _i2 = 0, _queryString$split2 = queryString.split('&'); _i2 < _queryString$split2.length; _i2++) {
                  var pair = _queryString$split2[_i2];
                  pair = pair.split('=');

                  if (pair[0] && pair[1]) {
                    params[decodeURIComponent(pair[0])] = decodeURIComponent(pair[1]);
                  }
                }

                return params;
              }, [queryString]);
            }
            function formatQuery(obj) {
              if (obj === void 0) {
                obj = {};
              }

              return Object.keys(obj).filter(function (key) {
                return typeof obj[key] === 'string';
              }).map(function (key) {
                return urlEncode(key) + "=" + urlEncode(obj[key]);
              }).join('&');
            }
            function extendQuery(originalQuery, props) {
              if (props === void 0) {
                props = {};
              }

              if (!props || !Object.keys(props).length) {
                return originalQuery;
              }

              return formatQuery(_extends({}, parseQuery(originalQuery), {}, props));
            }
            function extendUrl(url, options) {
              if (options === void 0) {
                options = {};
              }

              var query = options.query || {};
              var hash = options.hash || {};
              var originalUrl;
              var originalQuery;
              var originalHash;

              var _url$split = url.split('#');

              originalUrl = _url$split[0];
              originalHash = _url$split[1];

              var _originalUrl$split = originalUrl.split('?');

              originalUrl = _originalUrl$split[0];
              originalQuery = _originalUrl$split[1];
              var queryString = extendQuery(originalQuery, query);
              var hashString = extendQuery(originalHash, hash);

              if (queryString) {
                originalUrl = originalUrl + "?" + queryString;
              }

              if (hashString) {
                originalUrl = originalUrl + "#" + hashString;
              }

              return originalUrl;
            }
            function appendChild(container, child) {
              container.appendChild(child);
            }
            function isElement(element) {
              if (element instanceof window.Element) {
                return true;
              }

              if (element !== null && typeof element === 'object' && element.nodeType === 1 && typeof element.style === 'object' && typeof element.ownerDocument === 'object') {
                return true;
              }

              return false;
            }
            function getElementSafe(id, doc) {
              if (doc === void 0) {
                doc = document;
              }

              if (isElement(id)) {
                // $FlowFixMe
                return id;
              }

              if (typeof id === 'string') {
                return doc.querySelector(id);
              }
            }
            function getElement(id, doc) {
              if (doc === void 0) {
                doc = document;
              }

              var element = getElementSafe(id, doc);

              if (element) {
                return element;
              }

              throw new Error("Can not find element: " + stringify(id));
            }
            function elementReady(id) {
              return new promise_ZalgoPromise(function (resolve, reject) {
                var name = stringify(id);
                var el = getElementSafe(id);

                if (el) {
                  return resolve(el);
                }

                if (isDocumentReady()) {
                  return reject(new Error("Document is ready and element " + name + " does not exist"));
                }

                var interval = setInterval(function () {
                  el = getElementSafe(id);

                  if (el) {
                    clearInterval(interval);
                    return resolve(el);
                  }

                  if (isDocumentReady()) {
                    clearInterval(interval);
                    return reject(new Error("Document is ready and element " + name + " does not exist"));
                  }
                }, 10);
              });
            }
            function PopupOpenError(message) {
              this.message = message;
            }
            PopupOpenError.prototype = Object.create(Error.prototype);
            function popup(url, options) {
              // $FlowFixMe
              options = options || {};
              var _options = options,
                  width = _options.width,
                  height = _options.height;
              var top = 0;
              var left = 0;

              if (width) {
                if (window.outerWidth) {
                  left = Math.round((window.outerWidth - width) / 2) + window.screenX;
                } else if (window.screen.width) {
                  left = Math.round((window.screen.width - width) / 2);
                }
              }

              if (height) {
                if (window.outerHeight) {
                  top = Math.round((window.outerHeight - height) / 2) + window.screenY;
                } else if (window.screen.height) {
                  top = Math.round((window.screen.height - height) / 2);
                }
              }

              if (width && height) {
                options = _extends({
                  top: top,
                  left: left,
                  width: width,
                  height: height,
                  status: 1,
                  toolbar: 0,
                  menubar: 0,
                  resizable: 1,
                  scrollbars: 1
                }, options);
              }

              var name = options.name || '';
              delete options.name; // eslint-disable-next-line array-callback-return

              var params = Object.keys(options).map(function (key) {
                // $FlowFixMe
                if (options[key] !== null && options[key] !== undefined) {
                  return key + "=" + stringify(options[key]);
                }
              }).filter(Boolean).join(',');
              var win;

              try {
                win = window.open(url, name, params, true);
              } catch (err) {
                throw new PopupOpenError("Can not open popup window - " + (err.stack || err.message));
              }

              if (isWindowClosed(win)) {
                var err = new PopupOpenError("Can not open popup window - blocked");
                throw err;
              }

              window.addEventListener('unload', function () {
                return win.close();
              });
              return win;
            }
            function writeToWindow(win, html) {
              try {
                win.document.open();
                win.document.write(html);
                win.document.close();
              } catch (err) {
                try {
                  win.location = "javascript: document.open(); document.write(" + JSON.stringify(html) + "); document.close();";
                } catch (err2) {// pass
                }
              }
            }
            function writeElementToWindow(win, el) {
              var tag = el.tagName.toLowerCase();

              if (tag !== 'html') {
                throw new Error("Expected element to be html, got " + tag);
              }

              var documentElement = win.document.documentElement;

              for (var _i6 = 0, _arrayFrom2 = arrayFrom(documentElement.children); _i6 < _arrayFrom2.length; _i6++) {
                var child = _arrayFrom2[_i6];
                documentElement.removeChild(child);
              }

              for (var _i8 = 0, _arrayFrom4 = arrayFrom(el.children); _i8 < _arrayFrom4.length; _i8++) {
                var _child = _arrayFrom4[_i8];
                documentElement.appendChild(_child);
              }
            }
            function setStyle(el, styleText, doc) {
              if (doc === void 0) {
                doc = window.document;
              }

              // $FlowFixMe
              if (el.styleSheet) {
                // $FlowFixMe
                el.styleSheet.cssText = styleText;
              } else {
                el.appendChild(doc.createTextNode(styleText));
              }
            }
            var awaitFrameLoadPromises;
            function awaitFrameLoad(frame) {
              awaitFrameLoadPromises = awaitFrameLoadPromises || new weakmap_CrossDomainSafeWeakMap();

              if (awaitFrameLoadPromises.has(frame)) {
                var _promise = awaitFrameLoadPromises.get(frame);

                if (_promise) {
                  return _promise;
                }
              }

              var promise = new promise_ZalgoPromise(function (resolve, reject) {
                frame.addEventListener('load', function () {
                  linkFrameWindow(frame);
                  resolve(frame);
                });
                frame.addEventListener('error', function (err) {
                  if (frame.contentWindow) {
                    resolve(frame);
                  } else {
                    reject(err);
                  }
                });
              });
              awaitFrameLoadPromises.set(frame, promise);
              return promise;
            }
            function awaitFrameWindow(frame) {
              return awaitFrameLoad(frame).then(function (loadedFrame) {
                if (!loadedFrame.contentWindow) {
                  throw new Error("Could not find window in iframe");
                }

                return loadedFrame.contentWindow;
              });
            }
            function createElement(tag, options, container) {
              if (tag === void 0) {
                tag = 'div';
              }

              if (options === void 0) {
                options = {};
              }

              tag = tag.toLowerCase();
              var element = document.createElement(tag);

              if (options.style) {
                extend(element.style, options.style);
              }

              if (options.class) {
                element.className = options.class.join(' ');
              }

              if (options.id) {
                element.setAttribute('id', options.id);
              }

              if (options.attributes) {
                for (var _i10 = 0, _Object$keys2 = Object.keys(options.attributes); _i10 < _Object$keys2.length; _i10++) {
                  var key = _Object$keys2[_i10];
                  element.setAttribute(key, options.attributes[key]);
                }
              }

              if (options.styleSheet) {
                setStyle(element, options.styleSheet);
              }

              if (container) {
                appendChild(container, element);
              }

              if (options.html) {
                if (tag === 'iframe') {
                  // $FlowFixMe
                  if (!container || !element.contentWindow) {
                    throw new Error("Iframe html can not be written unless container provided and iframe in DOM");
                  } // $FlowFixMe


                  writeToWindow(element.contentWindow, options.html);
                } else {
                  element.innerHTML = options.html;
                }
              }

              return element;
            }
            function dom_iframe(options, container) {
              if (options === void 0) {
                options = {};
              }

              var attributes = options.attributes || {};
              var style = options.style || {};
              var frame = createElement('iframe', {
                attributes: _extends({
                  allowTransparency: 'true'
                }, attributes),
                style: _extends({
                  backgroundColor: 'transparent',
                  border: 'none'
                }, style),
                html: options.html,
                class: options.class
              });
              var isIE = window.navigator.userAgent.match(/MSIE|Edge/i);

              if (!frame.hasAttribute('id')) {
                frame.setAttribute('id', uniqueID());
              } // $FlowFixMe


              awaitFrameLoad(frame);

              if (container) {
                var el = getElement(container);
                el.appendChild(frame);
              }

              if (options.url || isIE) {
                frame.setAttribute('src', options.url || 'about:blank');
              } // $FlowFixMe


              return frame;
            }
            function addEventListener(obj, event, handler) {
              obj.addEventListener(event, handler);
              return {
                cancel: function cancel() {
                  obj.removeEventListener(event, handler);
                }
              };
            }
            var STYLE = {
              DISPLAY: {
                NONE: 'none',
                BLOCK: 'block'
              },
              VISIBILITY: {
                VISIBLE: 'visible',
                HIDDEN: 'hidden'
              },
              IMPORTANT: 'important'
            };
            function showElement(element) {
              element.style.setProperty('display', '');
            }
            function hideElement(element) {
              element.style.setProperty('display', STYLE.DISPLAY.NONE, STYLE.IMPORTANT);
            }
            function destroyElement(element) {
              if (element && element.parentNode) {
                element.parentNode.removeChild(element);
              }
            }
            function isElementClosed(el) {
              if (!el || !el.parentNode) {
                return true;
              }

              return false;
            }
            function watchElementForClose(element, handler) {
              handler = once(handler);
              var interval;

              if (isElementClosed(element)) {
                handler();
              } else {
                interval = safeInterval(function () {
                  if (isElementClosed(element)) {
                    interval.cancel();
                    handler();
                  }
                }, 50);
              }

              return {
                cancel: function cancel() {
                  if (interval) {
                    interval.cancel();
                  }
                }
              };
            }
            function onResize(el, handler, _temp) {
              var _ref2 = _temp === void 0 ? {} : _temp,
                  _ref2$width = _ref2.width,
                  width = _ref2$width === void 0 ? true : _ref2$width,
                  _ref2$height = _ref2.height,
                  height = _ref2$height === void 0 ? true : _ref2$height,
                  _ref2$interval = _ref2.interval,
                  interval = _ref2$interval === void 0 ? 100 : _ref2$interval,
                  _ref2$win = _ref2.win,
                  win = _ref2$win === void 0 ? window : _ref2$win;

              var currentWidth = el.offsetWidth;
              var currentHeight = el.offsetHeight;
              handler({
                width: currentWidth,
                height: currentHeight
              });

              var check = function check() {
                var newWidth = el.offsetWidth;
                var newHeight = el.offsetHeight;

                if (width && newWidth !== currentWidth || height && newHeight !== currentHeight) {
                  handler({
                    width: newWidth,
                    height: newHeight
                  });
                }

                currentWidth = newWidth;
                currentHeight = newHeight;
              };

              var observer;
              var timeout;

              if (typeof win.ResizeObserver !== 'undefined') {
                observer = new win.ResizeObserver(check);
                observer.observe(el);
              } else if (typeof win.MutationObserver !== 'undefined') {
                observer = new win.MutationObserver(check);
                observer.observe(el, {
                  attributes: true,
                  childList: true,
                  subtree: true,
                  characterData: false
                });
                win.addEventListener('resize', check);
              } else {
                var loop = function loop() {
                  check();
                  timeout = setTimeout(loop, interval);
                };

                loop();
              }

              return {
                cancel: function cancel() {
                  observer.disconnect();
                  window.removeEventListener('resize', check);
                  clearTimeout(timeout);
                }
              };
            }
            // CONCATENATED MODULE: ./node_modules/belter/src/css.js
            function isPerc(str) {
              return typeof str === 'string' && /^[0-9]+%$/.test(str);
            }
            function isPx(str) {
              return typeof str === 'string' && /^[0-9]+px$/.test(str);
            }
            function toNum(val) {
              if (typeof val === 'number') {
                return val;
              }

              var match = val.match(/^([0-9]+)(px|%)$/);

              if (!match) {
                throw new Error("Could not match css value from " + val);
              }

              return parseInt(match[1], 10);
            }
            function toPx(val) {
              return toNum(val) + "px";
            }
            function toCSS(val) {
              if (typeof val === 'number') {
                return toPx(val);
              }

              return isPerc(val) ? val : toPx(val);
            }
            function percOf(num, perc) {
              return parseInt(num * toNum(perc) / 100, 10);
            }
            function normalizeDimension(dim, max) {
              if (typeof dim === 'number') {
                return dim;
              } else if (isPerc(dim)) {
                return percOf(max, dim);
              } else if (isPx(dim)) {
                return toNum(dim);
              } else {
                throw new Error("Can not normalize dimension: " + dim);
              }
            }
            // CONCATENATED MODULE: ./node_modules/belter/src/index.js











            // CONCATENATED MODULE: ./node_modules/post-robot/src/conf/config.js
            var BRIDGE_TIMEOUT = 5000;
            var CHILD_WINDOW_TIMEOUT = 5000;
            var ACK_TIMEOUT = 2000;
            var ACK_TIMEOUT_KNOWN = 10000;
            var RES_TIMEOUT =   -1;
            var RESPONSE_CYCLE_TIME = 500;
            // CONCATENATED MODULE: ./node_modules/post-robot/src/conf/constants.js
            var MESSAGE_TYPE = {
              REQUEST: 'postrobot_message_request',
              RESPONSE: 'postrobot_message_response',
              ACK: 'postrobot_message_ack'
            };
            var MESSAGE_ACK = {
              SUCCESS: 'success',
              ERROR: 'error'
            };
            var MESSAGE_NAME = {
              METHOD: 'postrobot_method',
              HELLO: 'postrobot_hello',
              OPEN_TUNNEL: 'postrobot_open_tunnel'
            };
            var SEND_STRATEGY = {
              POST_MESSAGE: 'postrobot_post_message',
              BRIDGE: 'postrobot_bridge',
              GLOBAL: 'postrobot_global'
            };
            var BRIDGE_NAME_PREFIX = '__postrobot_bridge__';
            var constants_WILDCARD = '*';
            var SERIALIZATION_TYPE = {
              CROSS_DOMAIN_ZALGO_PROMISE: 'cross_domain_zalgo_promise',
              CROSS_DOMAIN_FUNCTION: 'cross_domain_function',
              CROSS_DOMAIN_WINDOW: 'cross_domain_window'
            };
            // CONCATENATED MODULE: ./node_modules/post-robot/src/conf/index.js


            // CONCATENATED MODULE: ./node_modules/post-robot/src/global.js


            function global_getGlobal(win) {
              if (win === void 0) {
                win = window;
              }

              if (win !== window) {
                return win["__post_robot_10_0_29__"];
              }

              var global = win["__post_robot_10_0_29__"] = win["__post_robot_10_0_29__"] || {};
              return global;
            }
            function deleteGlobal() {
              delete window["__post_robot_10_0_29__"];
            }

            var getObj = function getObj() {
              return {};
            };

            function globalStore(key, defStore) {
              if (key === void 0) {
                key = 'store';
              }

              if (defStore === void 0) {
                defStore = getObj;
              }

              return util_getOrSet(global_getGlobal(), key, function () {
                var store = defStore();
                return {
                  has: function has(storeKey) {
                    return store.hasOwnProperty(storeKey);
                  },
                  get: function get(storeKey, defVal) {
                    // $FlowFixMe
                    return store.hasOwnProperty(storeKey) ? store[storeKey] : defVal;
                  },
                  set: function set(storeKey, val) {
                    store[storeKey] = val;
                    return val;
                  },
                  del: function del(storeKey) {
                    delete store[storeKey];
                  },
                  getOrSet: function getOrSet(storeKey, getter) {
                    // $FlowFixMe
                    return util_getOrSet(store, storeKey, getter);
                  },
                  reset: function reset() {
                    store = defStore();
                  },
                  keys: function keys() {
                    return Object.keys(store);
                  }
                };
              });
            }
            var WildCard = function WildCard() {};
            function getWildcard() {
              var global = global_getGlobal();
              global.WINDOW_WILDCARD = global.WINDOW_WILDCARD || new WildCard();
              return global.WINDOW_WILDCARD;
            }
            function windowStore(key, defStore) {
              if (key === void 0) {
                key = 'store';
              }

              if (defStore === void 0) {
                defStore = getObj;
              }

              return globalStore('windowStore').getOrSet(key, function () {
                var winStore = new weakmap_CrossDomainSafeWeakMap();

                var getStore = function getStore(win) {
                  return winStore.getOrSet(win, defStore);
                };

                return {
                  has: function has(win) {
                    var store = getStore(win);
                    return store.hasOwnProperty(key);
                  },
                  get: function get(win, defVal) {
                    var store = getStore(win); // $FlowFixMe

                    return store.hasOwnProperty(key) ? store[key] : defVal;
                  },
                  set: function set(win, val) {
                    var store = getStore(win);
                    store[key] = val;
                    return val;
                  },
                  del: function del(win) {
                    var store = getStore(win);
                    delete store[key];
                  },
                  getOrSet: function getOrSet(win, getter) {
                    var store = getStore(win);
                    return util_getOrSet(store, key, getter);
                  }
                };
              });
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/lib/hello.js






            function getInstanceID() {
              return globalStore('instance').getOrSet('instanceID', uniqueID);
            }

            function getHelloPromise(win) {
              var helloPromises = windowStore('helloPromises');
              return helloPromises.getOrSet(win, function () {
                return new promise_ZalgoPromise();
              });
            }

            function resolveHelloPromise(win, _ref) {
              var domain = _ref.domain;
              var helloPromises = windowStore('helloPromises');
              var existingPromise = helloPromises.get(win);

              if (existingPromise) {
                existingPromise.resolve({
                  domain: domain
                });
              }

              var newPromise = promise_ZalgoPromise.resolve({
                domain: domain
              });
              helloPromises.set(win, newPromise);
              return newPromise;
            }

            function listenForHello(_ref2) {
              var on = _ref2.on;
              return on(MESSAGE_NAME.HELLO, {
                domain: constants_WILDCARD
              }, function (_ref3) {
                var source = _ref3.source,
                    origin = _ref3.origin;
                resolveHelloPromise(source, {
                  domain: origin
                });
                return {
                  instanceID: getInstanceID()
                };
              });
            }

            function sayHello(win, _ref4) {
              var send = _ref4.send;
              return send(win, MESSAGE_NAME.HELLO, {
                instanceID: getInstanceID()
              }, {
                domain: constants_WILDCARD,
                timeout: -1
              }).then(function (_ref5) {
                var origin = _ref5.origin,
                    instanceID = _ref5.data.instanceID;
                resolveHelloPromise(win, {
                  domain: origin
                });
                return {
                  win: win,
                  domain: origin,
                  instanceID: instanceID
                };
              });
            }
            function getWindowInstanceID(win, _ref6) {
              var send = _ref6.send;
              return windowStore('windowInstanceIDPromises').getOrSet(win, function () {
                return sayHello(win, {
                  send: send
                }).then(function (_ref7) {
                  var instanceID = _ref7.instanceID;
                  return instanceID;
                });
              });
            }
            function initHello(_ref8) {
              var on = _ref8.on,
                  send = _ref8.send;
              return globalStore('builtinListeners').getOrSet('helloListener', function () {
                var listener = listenForHello({
                  on: on
                });
                var parent = getAncestor();

                if (parent) {
                  sayHello(parent, {
                    send: send
                  }).catch(src_util_noop);
                }

                return listener;
              });
            }
            function awaitWindowHello(win, timeout, name) {
              if (timeout === void 0) {
                timeout = 5000;
              }

              if (name === void 0) {
                name = 'Window';
              }

              var promise = getHelloPromise(win);

              if (timeout !== -1) {
                promise = promise.timeout(timeout, new Error(name + " did not load after " + timeout + "ms"));
              }

              return promise;
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/lib/compat.js

            function needsGlobalMessagingForBrowser() {
              if (utils_getUserAgent(window).match(/MSIE|rv:11|trident|edge\/12|edge\/13/i)) {
                return true;
              }

              return false;
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/lib/windows.js

            function markWindowKnown(win) {
              var knownWindows = windowStore('knownWindows');
              knownWindows.set(win, true);
            }
            function isWindowKnown(win) {
              var knownWindows = windowStore('knownWindows');
              return knownWindows.get(win, false);
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/lib/index.js



            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/constants.js
            var TYPE = {
              FUNCTION: 'function',
              ERROR: 'error',
              PROMISE: 'promise',
              REGEX: 'regex',
              DATE: 'date',
              ARRAY: 'array',
              OBJECT: 'object',
              STRING: 'string',
              NUMBER: 'number',
              BOOLEAN: 'boolean',
              NULL: 'null',
              UNDEFINED: 'undefined'
            };
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/common.js

            function isSerializedType(item) {
              return typeof item === 'object' && item !== null && typeof item.__type__ === 'string';
            }
            function determineType(val) {
              if (typeof val === 'undefined') {
                return TYPE.UNDEFINED;
              }

              if (val === null) {
                return TYPE.NULL;
              }

              if (Array.isArray(val)) {
                return TYPE.ARRAY;
              }

              if (typeof val === 'function') {
                return TYPE.FUNCTION;
              }

              if (typeof val === 'object') {
                if (val instanceof Error) {
                  return TYPE.ERROR;
                }

                if (typeof val.then === 'function') {
                  return TYPE.PROMISE;
                }

                if (Object.prototype.toString.call(val) === '[object RegExp]') {
                  return TYPE.REGEX;
                }

                if (Object.prototype.toString.call(val) === '[object Date]') {
                  return TYPE.DATE;
                }

                return TYPE.OBJECT;
              }

              if (typeof val === 'string') {
                return TYPE.STRING;
              }

              if (typeof val === 'number') {
                return TYPE.NUMBER;
              }

              if (typeof val === 'boolean') {
                return TYPE.BOOLEAN;
              }
            }
            function serializeType(type, val) {
              return {
                __type__: type,
                __val__: val
              };
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/array.js
            function serializeArray(val) {
              return val;
            }
            function deserializeArray(val) {
              return val;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/boolean.js
            function serializeBoolean(val) {
              return val;
            }
            function deserializeBoolean(val) {
              return val;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/date.js


            function serializeDate(val) {
              return serializeType(TYPE.DATE, val.toJSON());
            }
            function deserializeDate(val) {
              return new Date(val);
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/error.js


            // $FlowFixMe
            function serializeError(_ref) {
              var message = _ref.message,
                  stack = _ref.stack,
                  code = _ref.code;
              return serializeType(TYPE.ERROR, {
                message: message,
                stack: stack,
                code: code
              });
            }
            function deserializeError(_ref2) {
              var message = _ref2.message,
                  stack = _ref2.stack,
                  code = _ref2.code;
              var error = new Error(message); // $FlowFixMe

              error.code = code;
              error.stack = stack + "\n\n" + error.stack;
              return error;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/function.js
            function serializeFunction() {// pass
            }
            function deserializeFunction() {
              throw new Error("Function serialization is not implemented; nothing to deserialize");
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/number.js
            function serializeNumber(val) {
              return val;
            }
            function deserializeNumber(val) {
              return val;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/object.js
            function serializeObject(val) {
              return val;
            }
            function deserializeObject(val) {
              return val;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/promise.js
            function serializePromise() {// pass
            }
            function deserializePromise() {
              throw new Error("Promise serialization is not implemented; nothing to deserialize");
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/regex.js


            function serializeRegex(val) {
              return serializeType(TYPE.REGEX, val.source);
            }
            function deserializeRegex(val) {
              // eslint-disable-next-line security/detect-non-literal-regexp
              return new RegExp(val);
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/string.js
            function serializeString(val) {
              return val;
            }
            function deserializeString(val) {
              return val;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/null.js
            function serializeNull(val) {
              return val;
            }
            function deserializeNull(val) {
              return val;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serializers/index.js











            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/serialize.js
            var _SERIALIZER;




            var SERIALIZER = (_SERIALIZER = {}, _SERIALIZER[TYPE.FUNCTION] = serializeFunction, _SERIALIZER[TYPE.ERROR] = serializeError, _SERIALIZER[TYPE.PROMISE] = serializePromise, _SERIALIZER[TYPE.REGEX] = serializeRegex, _SERIALIZER[TYPE.DATE] = serializeDate, _SERIALIZER[TYPE.ARRAY] = serializeArray, _SERIALIZER[TYPE.OBJECT] = serializeObject, _SERIALIZER[TYPE.STRING] = serializeString, _SERIALIZER[TYPE.NUMBER] = serializeNumber, _SERIALIZER[TYPE.BOOLEAN] = serializeBoolean, _SERIALIZER[TYPE.NULL] = serializeNull, _SERIALIZER); // $FlowFixMe

            var defaultSerializers = {};
            function serialize(obj, serializers) {
              if (serializers === void 0) {
                serializers = defaultSerializers;
              }

              function replacer(key) {
                var val = this[key];

                if (isSerializedType(this)) {
                  return val;
                }

                var type = determineType(val);

                if (!type) {
                  return val;
                } // $FlowFixMe


                var serializer = serializers[type] || SERIALIZER[type];

                if (!serializer) {
                  return val;
                }

                return serializer(val, key);
              }

              var result = JSON.stringify(obj, replacer);

              if (typeof result === 'undefined') {
                return TYPE.UNDEFINED;
              }

              return result;
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/deserialize.js
            var _DESERIALIZER;




            // $FlowFixMe
            var DESERIALIZER = (_DESERIALIZER = {}, _DESERIALIZER[TYPE.FUNCTION] = deserializeFunction, _DESERIALIZER[TYPE.ERROR] = deserializeError, _DESERIALIZER[TYPE.PROMISE] = deserializePromise, _DESERIALIZER[TYPE.REGEX] = deserializeRegex, _DESERIALIZER[TYPE.DATE] = deserializeDate, _DESERIALIZER[TYPE.ARRAY] = deserializeArray, _DESERIALIZER[TYPE.OBJECT] = deserializeObject, _DESERIALIZER[TYPE.STRING] = deserializeString, _DESERIALIZER[TYPE.NUMBER] = deserializeNumber, _DESERIALIZER[TYPE.BOOLEAN] = deserializeBoolean, _DESERIALIZER[TYPE.NULL] = deserializeNull, _DESERIALIZER); // $FlowFixMe

            var defaultDeserializers = {};
            function deserialize_deserialize(str, deserializers) {
              if (deserializers === void 0) {
                deserializers = defaultDeserializers;
              }

              if (str === TYPE.UNDEFINED) {
                // $FlowFixMe
                return;
              }

              function replacer(key, val) {
                if (isSerializedType(this)) {
                  return val;
                }

                var type;
                var value;

                if (isSerializedType(val)) {
                  type = val.__type__;
                  value = val.__val__;
                } else {
                  type = determineType(val);
                  value = val;
                }

                if (!type) {
                  return value;
                } // $FlowFixMe


                var deserializer = deserializers[type] || DESERIALIZER[type];

                if (!deserializer) {
                  return value;
                }

                return deserializer(value, key);
              }

              return JSON.parse(str, replacer);
            }
            // CONCATENATED MODULE: ./node_modules/universal-serialize/src/index.js






            // CONCATENATED MODULE: ./node_modules/post-robot/src/bridge/bridge.js





            function cleanTunnelWindows() {
              var tunnelWindows = globalStore('tunnelWindows');

              for (var _i2 = 0, _tunnelWindows$keys2 = tunnelWindows.keys(); _i2 < _tunnelWindows$keys2.length; _i2++) {
                var key = _tunnelWindows$keys2[_i2];
                var tunnelWindow = tunnelWindows[key];

                try {
                  src_util_noop(tunnelWindow.source);
                } catch (err) {
                  tunnelWindows.del(key);
                  continue;
                }

                if (isWindowClosed(tunnelWindow.source)) {
                  tunnelWindows.del(key);
                }
              }
            }

            function addTunnelWindow(_ref) {
              var name = _ref.name,
                  source = _ref.source,
                  canary = _ref.canary,
                  sendMessage = _ref.sendMessage;
              cleanTunnelWindows();
              var id = uniqueID();
              var tunnelWindows = globalStore('tunnelWindows');
              tunnelWindows.set(id, {
                name: name,
                source: source,
                canary: canary,
                sendMessage: sendMessage
              });
              return id;
            }

            function setupOpenTunnelToParent(_ref2) {
              var send = _ref2.send;

              global_getGlobal(window).openTunnelToParent = function openTunnelToParent(_ref3) {
                var name = _ref3.name,
                    source = _ref3.source,
                    canary = _ref3.canary,
                    sendMessage = _ref3.sendMessage;
                var tunnelWindows = globalStore('tunnelWindows');
                var parentWindow = getParent(window);

                if (!parentWindow) {
                  throw new Error("No parent window found to open tunnel to");
                }

                var id = addTunnelWindow({
                  name: name,
                  source: source,
                  canary: canary,
                  sendMessage: sendMessage
                });
                return send(parentWindow, MESSAGE_NAME.OPEN_TUNNEL, {
                  name: name,
                  sendMessage: function sendMessage() {
                    var tunnelWindow = tunnelWindows.get(id);

                    try {
                      // IE gets antsy if you try to even reference a closed window
                      src_util_noop(tunnelWindow && tunnelWindow.source);
                    } catch (err) {
                      tunnelWindows.del(id);
                      return;
                    }

                    if (!tunnelWindow || !tunnelWindow.source || isWindowClosed(tunnelWindow.source)) {
                      return;
                    }

                    try {
                      tunnelWindow.canary();
                    } catch (err) {
                      return;
                    }

                    tunnelWindow.sendMessage.apply(this, arguments);
                  }
                }, {
                  domain: constants_WILDCARD
                });
              };
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/bridge/common.js





            function needsBridgeForBrowser() {
              if (utils_getUserAgent(window).match(/MSIE|trident|edge\/12|edge\/13/i)) {
                return true;
              }

              return false;
            }
            function needsBridgeForWin(win) {
              if (!isSameTopWindow(window, win)) {
                return true;
              }

              return false;
            }
            function needsBridgeForDomain(domain, win) {
              if (domain) {
                if (utils_getDomain() !== getDomainFromUrl(domain)) {
                  return true;
                }
              } else if (win) {
                if (!isSameDomain(win)) {
                  return true;
                }
              }

              return false;
            }
            function needsBridge(_ref) {
              var win = _ref.win,
                  domain = _ref.domain;

              if (!needsBridgeForBrowser()) {
                return false;
              }

              if (domain && !needsBridgeForDomain(domain, win)) {
                return false;
              }

              if (win && !needsBridgeForWin(win)) {
                return false;
              }

              return true;
            }
            function getBridgeName(domain) {
              domain = domain || getDomainFromUrl(domain);
              var sanitizedDomain = domain.replace(/[^a-zA-Z0-9]+/g, '_');
              var id = BRIDGE_NAME_PREFIX + "_" + sanitizedDomain;
              return id;
            }
            function isBridge() {
              return Boolean(window.name && window.name === getBridgeName(utils_getDomain()));
            }
            var documentBodyReady = new promise_ZalgoPromise(function (resolve) {
              if (window.document && window.document.body) {
                return resolve(window.document.body);
              }

              var interval = setInterval(function () {
                if (window.document && window.document.body) {
                  clearInterval(interval);
                  return resolve(window.document.body);
                }
              }, 10);
            });
            function registerRemoteWindow(win) {
              var remoteWindowPromises = windowStore('remoteWindowPromises');
              remoteWindowPromises.getOrSet(win, function () {
                return new promise_ZalgoPromise();
              });
            }
            function findRemoteWindow(win) {
              var remoteWindowPromises = windowStore('remoteWindowPromises');
              var remoteWinPromise = remoteWindowPromises.get(win);

              if (!remoteWinPromise) {
                throw new Error("Remote window promise not found");
              }

              return remoteWinPromise;
            }
            function registerRemoteSendMessage(win, domain, sendMessage) {
              var sendMessageWrapper = function sendMessageWrapper(remoteWin, remoteDomain, message) {
                if (remoteWin !== win) {
                  throw new Error("Remote window does not match window");
                }

                if (!matchDomain(remoteDomain, domain)) {
                  throw new Error("Remote domain " + remoteDomain + " does not match domain " + domain);
                }

                sendMessage.fireAndForget(message);
              };

              findRemoteWindow(win).resolve(sendMessageWrapper);
            }
            function rejectRemoteSendMessage(win, err) {
              findRemoteWindow(win).reject(err).catch(src_util_noop);
            }
            function sendBridgeMessage(win, domain, message) {
              var messagingChild = isOpener(window, win);
              var messagingParent = isOpener(win, window);

              if (!messagingChild && !messagingParent) {
                throw new Error("Can only send messages to and from parent and popup windows");
              }

              return findRemoteWindow(win).then(function (sendMessage) {
                return sendMessage(win, domain, message);
              });
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/bridge/child.js






            function awaitRemoteBridgeForWindow(win) {
              return windowStore('remoteBridgeAwaiters').getOrSet(win, function () {
                return promise_ZalgoPromise.try(function () {
                  var frame = getFrameByName(win, getBridgeName(utils_getDomain()));

                  if (!frame) {
                    return;
                  }

                  if (isSameDomain(frame) && global_getGlobal(assertSameDomain(frame))) {
                    return frame;
                  }

                  return new promise_ZalgoPromise(function (resolve) {
                    var interval;
                    var timeout; // eslint-disable-line prefer-const

                    interval = setInterval(function () {
                      // eslint-disable-line prefer-const
                      if (frame && isSameDomain(frame) && global_getGlobal(assertSameDomain(frame))) {
                        clearInterval(interval);
                        clearTimeout(timeout);
                        return resolve(frame);
                      }
                    }, 100);
                    timeout = setTimeout(function () {
                      clearInterval(interval);
                      return resolve();
                    }, 2000);
                  });
                });
              });
            }

            function openTunnelToOpener(_ref) {
              var on = _ref.on,
                  send = _ref.send,
                  receiveMessage = _ref.receiveMessage;
              return promise_ZalgoPromise.try(function () {
                var opener = getOpener(window);

                if (!opener || !needsBridge({
                  win: opener
                })) {
                  return;
                }

                registerRemoteWindow(opener);
                return awaitRemoteBridgeForWindow(opener).then(function (bridge) {
                  if (!bridge) {
                    return rejectRemoteSendMessage(opener, new Error("Can not register with opener: no bridge found in opener"));
                  }

                  if (!window.name) {
                    return rejectRemoteSendMessage(opener, new Error("Can not register with opener: window does not have a name"));
                  }

                  return global_getGlobal(assertSameDomain(bridge)).openTunnelToParent({
                    name: window.name,
                    source: window,
                    canary: function canary() {// pass
                    },
                    sendMessage: function sendMessage(message) {
                      try {
                        src_util_noop(window);
                      } catch (err) {
                        return;
                      }

                      if (!window || window.closed) {
                        return;
                      }

                      try {
                        receiveMessage({
                          data: message,
                          origin: this.origin,
                          source: this.source
                        }, {
                          on: on,
                          send: send
                        });
                      } catch (err) {
                        promise_ZalgoPromise.reject(err);
                      }
                    }
                  }).then(function (_ref2) {
                    var source = _ref2.source,
                        origin = _ref2.origin,
                        data = _ref2.data;

                    if (source !== opener) {
                      throw new Error("Source does not match opener");
                    }

                    registerRemoteSendMessage(source, origin, data.sendMessage);
                  }).catch(function (err) {
                    rejectRemoteSendMessage(opener, err);
                    throw err;
                  });
                });
              });
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/bridge/parent.js






            function listenForOpenTunnel(_ref) {
              var on = _ref.on,
                  send = _ref.send,
                  receiveMessage = _ref.receiveMessage;
              var popupWindowsByName = globalStore('popupWindowsByName');
              on(MESSAGE_NAME.OPEN_TUNNEL, function (_ref2) {
                var source = _ref2.source,
                    origin = _ref2.origin,
                    data = _ref2.data;
                var bridgePromise = globalStore('bridges').get(origin);

                if (!bridgePromise) {
                  throw new Error("Can not find bridge promise for domain " + origin);
                }

                return bridgePromise.then(function (bridge) {
                  if (source !== bridge) {
                    throw new Error("Message source does not matched registered bridge for domain " + origin);
                  }

                  if (!data.name) {
                    throw new Error("Register window expected to be passed window name");
                  }

                  if (!data.sendMessage) {
                    throw new Error("Register window expected to be passed sendMessage method");
                  }

                  if (!popupWindowsByName.has(data.name)) {
                    throw new Error("Window with name " + data.name + " does not exist, or was not opened by this window");
                  }

                  if (!popupWindowsByName.get(data.name).domain) {
                    throw new Error("We do not have a registered domain for window " + data.name);
                  }

                  if (popupWindowsByName.get(data.name).domain !== origin) {
                    throw new Error("Message origin " + origin + " does not matched registered window origin " + popupWindowsByName.get(data.name).domain);
                  }

                  registerRemoteSendMessage(popupWindowsByName.get(data.name).win, origin, data.sendMessage);
                  return {
                    sendMessage: function sendMessage(message) {
                      if (!window || window.closed) {
                        return;
                      }

                      var winDetails = popupWindowsByName.get(data.name);

                      if (!winDetails) {
                        return;
                      }

                      try {
                        receiveMessage({
                          data: message,
                          origin: winDetails.domain,
                          source: winDetails.win
                        }, {
                          on: on,
                          send: send
                        });
                      } catch (err) {
                        promise_ZalgoPromise.reject(err);
                      }
                    }
                  };
                });
              });
            }

            function openBridgeFrame(name, url) {
              var iframe = document.createElement("iframe");
              iframe.setAttribute("name", name);
              iframe.setAttribute("id", name);
              iframe.setAttribute("style", "display: none; margin: 0; padding: 0; border: 0px none; overflow: hidden;");
              iframe.setAttribute("frameborder", "0");
              iframe.setAttribute("border", "0");
              iframe.setAttribute("scrolling", "no");
              iframe.setAttribute("allowTransparency", "true");
              iframe.setAttribute("tabindex", "-1");
              iframe.setAttribute("hidden", "true");
              iframe.setAttribute("title", "");
              iframe.setAttribute("role", "presentation");
              iframe.src = url;
              return iframe;
            }

            function hasBridge(url, domain) {
              var bridges = globalStore('bridges');
              return bridges.has(domain || getDomainFromUrl(url));
            }
            function parent_openBridge(url, domain) {
              var bridges = globalStore('bridges');
              var bridgeFrames = globalStore('bridgeFrames');
              domain = domain || getDomainFromUrl(url);
              return bridges.getOrSet(domain, function () {
                return promise_ZalgoPromise.try(function () {
                  if (utils_getDomain() === domain) {
                    throw new Error("Can not open bridge on the same domain as current domain: " + domain);
                  }

                  var name = getBridgeName(domain);
                  var frame = getFrameByName(window, name);

                  if (frame) {
                    throw new Error("Frame with name " + name + " already exists on page");
                  }

                  var iframe = openBridgeFrame(name, url);
                  bridgeFrames.set(domain, iframe);
                  return documentBodyReady.then(function (body) {
                    body.appendChild(iframe);
                    var bridge = iframe.contentWindow;
                    return new promise_ZalgoPromise(function (resolve, reject) {
                      iframe.addEventListener('load', resolve);
                      iframe.addEventListener('error', reject);
                    }).then(function () {
                      return awaitWindowHello(bridge, BRIDGE_TIMEOUT, "Bridge " + url);
                    }).then(function () {
                      return bridge;
                    });
                  });
                });
              });
            }
            function linkWindow(_ref3) {
              var win = _ref3.win,
                  name = _ref3.name,
                  domain = _ref3.domain;
              var popupWindowsByName = globalStore('popupWindowsByName');
              var popupWindowsByWin = windowStore('popupWindowsByWin');

              for (var _i2 = 0, _popupWindowsByName$k2 = popupWindowsByName.keys(); _i2 < _popupWindowsByName$k2.length; _i2++) {
                var winName = _popupWindowsByName$k2[_i2];

                // $FlowFixMe
                var _details = popupWindowsByName.get(winName);

                if (!_details || isWindowClosed(_details.win)) {
                  popupWindowsByName.del(winName);
                }
              }

              if (isWindowClosed(win)) {
                return {
                  win: win,
                  name: name,
                  domain: domain
                };
              }

              var details = popupWindowsByWin.getOrSet(win, function () {
                if (!name) {
                  return {
                    win: win
                  };
                }

                return popupWindowsByName.getOrSet(name, function () {
                  return {
                    win: win,
                    name: name
                  };
                });
              });

              if (details.win && details.win !== win) {
                throw new Error("Different window already linked for window: " + (name || 'undefined'));
              }

              if (name) {
                details.name = name;
                popupWindowsByName.set(name, details);
              }

              if (domain) {
                details.domain = domain;
                registerRemoteWindow(win);
              }

              popupWindowsByWin.set(win, details);
              return details;
            }
            function linkUrl(win, url) {
              linkWindow({
                win: win,
                domain: getDomainFromUrl(url)
              });
            }
            function listenForWindowOpen() {
              var windowOpen = window.open;

              window.open = function windowOpenWrapper(url, name, options, last) {
                var win = windowOpen.call(this, normalizeMockUrl(url), name, options, last);

                if (!win) {
                  return win;
                }

                linkWindow({
                  win: win,
                  name: name,
                  domain: url ? getDomainFromUrl(url) : null
                });
                return win;
              };
            }
            function destroyBridges() {
              var bridges = globalStore('bridges');
              var bridgeFrames = globalStore('bridgeFrames');

              for (var _i4 = 0, _bridgeFrames$keys2 = bridgeFrames.keys(); _i4 < _bridgeFrames$keys2.length; _i4++) {
                var domain = _bridgeFrames$keys2[_i4];
                var frame = bridgeFrames.get(domain);

                if (frame && frame.parentNode) {
                  frame.parentNode.removeChild(frame);
                }
              }

              bridgeFrames.reset();
              bridges.reset();
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/bridge/setup.js



            function setupBridge(_ref) {
              var on = _ref.on,
                  send = _ref.send,
                  receiveMessage = _ref.receiveMessage;
              listenForWindowOpen();
              listenForOpenTunnel({
                on: on,
                send: send,
                receiveMessage: receiveMessage
              });
              setupOpenTunnelToParent({
                on: on,
                send: send
              });
              openTunnelToOpener({
                on: on,
                send: send,
                receiveMessage: receiveMessage
              });
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/bridge/index.js





            // CONCATENATED MODULE: ./node_modules/post-robot/src/serialize/window.js









            function cleanupProxyWindows() {
              var idToProxyWindow = globalStore('idToProxyWindow');

              for (var _i2 = 0, _idToProxyWindow$keys2 = idToProxyWindow.keys(); _i2 < _idToProxyWindow$keys2.length; _i2++) {
                var id = _idToProxyWindow$keys2[_i2];

                // $FlowFixMe
                if (idToProxyWindow.get(id).shouldClean()) {
                  idToProxyWindow.del(id);
                }
              }
            }

            function getSerializedWindow(winPromise, _ref) {
              var send = _ref.send,
                  _ref$id = _ref.id,
                  id = _ref$id === void 0 ? uniqueID() : _ref$id;
              var windowNamePromise = winPromise.then(function (win) {
                if (isSameDomain(win)) {
                  return assertSameDomain(win).name;
                }
              });
              return {
                id: id,
                getType: function getType() {
                  return winPromise.then(function (win) {
                    return getOpener(win) ? WINDOW_TYPE.POPUP : WINDOW_TYPE.IFRAME;
                  });
                },
                getInstanceID: memoizePromise(function () {
                  return winPromise.then(function (win) {
                    return getWindowInstanceID(win, {
                      send: send
                    });
                  });
                }),
                close: function close() {
                  return winPromise.then(closeWindow);
                },
                getName: function getName() {
                  return winPromise.then(function (win) {
                    if (isWindowClosed(win)) {
                      return;
                    }

                    if (isSameDomain(win)) {
                      return assertSameDomain(win).name;
                    }

                    return windowNamePromise;
                  });
                },
                focus: function focus() {
                  return winPromise.then(function (win) {
                    win.focus();
                  });
                },
                isClosed: function isClosed() {
                  return winPromise.then(function (win) {
                    return isWindowClosed(win);
                  });
                },
                setLocation: function setLocation(href) {
                  return winPromise.then(function (win) {
                    if (isSameDomain(win)) {
                      try {
                        if (win.location && typeof win.location.replace === 'function') {
                          // $FlowFixMe
                          win.location.replace(href);
                          return;
                        }
                      } catch (err) {// pass
                      }
                    }

                    win.location = href;
                  });
                },
                setName: function setName(name) {
                  return winPromise.then(function (win) {
                    {
                      linkWindow({
                        win: win,
                        name: name
                      });
                    }

                    var sameDomain = isSameDomain(win);
                    var frame = getFrameForWindow(win);

                    if (!sameDomain) {
                      throw new Error("Can not set name for cross-domain window: " + name);
                    }

                    assertSameDomain(win).name = name;

                    if (frame) {
                      frame.setAttribute('name', name);
                    }

                    windowNamePromise = promise_ZalgoPromise.resolve(name);
                  });
                }
              };
            }

            var window_ProxyWindow =
            /*#__PURE__*/
            function () {
              function ProxyWindow(_ref2) {
                var send = _ref2.send,
                    win = _ref2.win,
                    serializedWindow = _ref2.serializedWindow;
                this.id = void 0;
                this.isProxyWindow = true;
                this.serializedWindow = void 0;
                this.actualWindow = void 0;
                this.actualWindowPromise = void 0;
                this.send = void 0;
                this.name = void 0;
                this.actualWindowPromise = new promise_ZalgoPromise();
                this.serializedWindow = serializedWindow || getSerializedWindow(this.actualWindowPromise, {
                  send: send
                });
                globalStore('idToProxyWindow').set(this.getID(), this);

                if (win) {
                  this.setWindow(win, {
                    send: send
                  });
                }
              }

              var _proto = ProxyWindow.prototype;

              _proto.getID = function getID() {
                return this.serializedWindow.id;
              };

              _proto.getType = function getType() {
                return this.serializedWindow.getType();
              };

              _proto.isPopup = function isPopup() {
                return this.getType().then(function (type) {
                  return type === WINDOW_TYPE.POPUP;
                });
              };

              _proto.setLocation = function setLocation(href) {
                var _this = this;

                return this.serializedWindow.setLocation(href).then(function () {
                  return _this;
                });
              };

              _proto.getName = function getName() {
                return this.serializedWindow.getName();
              };

              _proto.setName = function setName(name) {
                var _this2 = this;

                return this.serializedWindow.setName(name).then(function () {
                  return _this2;
                });
              };

              _proto.close = function close() {
                var _this3 = this;

                return this.serializedWindow.close().then(function () {
                  return _this3;
                });
              };

              _proto.focus = function focus() {
                var _this4 = this;

                var isPopupPromise = this.isPopup();
                var getNamePromise = this.getName();
                var reopenPromise = promise_ZalgoPromise.hash({
                  isPopup: isPopupPromise,
                  name: getNamePromise
                }).then(function (_ref3) {
                  var isPopup = _ref3.isPopup,
                      name = _ref3.name;

                  if (isPopup && name) {
                    window.open('', name);
                  }
                });
                var focusPromise = this.serializedWindow.focus();
                return promise_ZalgoPromise.all([reopenPromise, focusPromise]).then(function () {
                  return _this4;
                });
              };

              _proto.isClosed = function isClosed() {
                return this.serializedWindow.isClosed();
              };

              _proto.getWindow = function getWindow() {
                return this.actualWindow;
              };

              _proto.setWindow = function setWindow(win, _ref4) {
                var send = _ref4.send;
                this.actualWindow = win;
                this.actualWindowPromise.resolve(this.actualWindow);
                this.serializedWindow = getSerializedWindow(this.actualWindowPromise, {
                  send: send,
                  id: this.getID()
                });
                windowStore('winToProxyWindow').set(win, this);
              };

              _proto.awaitWindow = function awaitWindow() {
                return this.actualWindowPromise;
              };

              _proto.matchWindow = function matchWindow(win, _ref5) {
                var _this5 = this;

                var send = _ref5.send;
                return promise_ZalgoPromise.try(function () {
                  if (_this5.actualWindow) {
                    return win === _this5.actualWindow;
                  }

                  return promise_ZalgoPromise.hash({
                    proxyInstanceID: _this5.getInstanceID(),
                    knownWindowInstanceID: getWindowInstanceID(win, {
                      send: send
                    })
                  }).then(function (_ref6) {
                    var proxyInstanceID = _ref6.proxyInstanceID,
                        knownWindowInstanceID = _ref6.knownWindowInstanceID;
                    var match = proxyInstanceID === knownWindowInstanceID;

                    if (match) {
                      _this5.setWindow(win, {
                        send: send
                      });
                    }

                    return match;
                  });
                });
              };

              _proto.unwrap = function unwrap() {
                return this.actualWindow || this;
              };

              _proto.getInstanceID = function getInstanceID() {
                return this.serializedWindow.getInstanceID();
              };

              _proto.shouldClean = function shouldClean() {
                return Boolean(this.actualWindow && isWindowClosed(this.actualWindow));
              };

              _proto.serialize = function serialize() {
                return this.serializedWindow;
              };

              ProxyWindow.unwrap = function unwrap(win) {
                return ProxyWindow.isProxyWindow(win) // $FlowFixMe
                ? win.unwrap() : win;
              };

              ProxyWindow.serialize = function serialize(win, _ref7) {
                var send = _ref7.send;
                cleanupProxyWindows();
                return ProxyWindow.toProxyWindow(win, {
                  send: send
                }).serialize();
              };

              ProxyWindow.deserialize = function deserialize(serializedWindow, _ref8) {
                var send = _ref8.send;
                cleanupProxyWindows();
                return globalStore('idToProxyWindow').get(serializedWindow.id) || new ProxyWindow({
                  serializedWindow: serializedWindow,
                  send: send
                });
              };

              ProxyWindow.isProxyWindow = function isProxyWindow(obj) {
                // $FlowFixMe
                return Boolean(obj && !isWindow(obj) && obj.isProxyWindow);
              };

              ProxyWindow.toProxyWindow = function toProxyWindow(win, _ref9) {
                var send = _ref9.send;
                cleanupProxyWindows();

                if (ProxyWindow.isProxyWindow(win)) {
                  // $FlowFixMe
                  return win;
                } // $FlowFixMe


                var actualWindow = win;
                return windowStore('winToProxyWindow').get(actualWindow) || new ProxyWindow({
                  win: actualWindow,
                  send: send
                });
              };

              return ProxyWindow;
            }();
            function serializeWindow(destination, domain, win, _ref10) {
              var send = _ref10.send;
              return serializeType(SERIALIZATION_TYPE.CROSS_DOMAIN_WINDOW, window_ProxyWindow.serialize(win, {
                send: send
              }));
            }
            function deserializeWindow(source, origin, win, _ref11) {
              var send = _ref11.send;
              return window_ProxyWindow.deserialize(win, {
                send: send
              });
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/serialize/function.js








            function addMethod(id, val, name, source, domain) {
              var methodStore = windowStore('methodStore');
              var proxyWindowMethods = globalStore('proxyWindowMethods');

              if (window_ProxyWindow.isProxyWindow(source)) {
                proxyWindowMethods.set(id, {
                  val: val,
                  name: name,
                  domain: domain,
                  source: source
                });
              } else {
                proxyWindowMethods.del(id); // $FlowFixMe

                var methods = methodStore.getOrSet(source, function () {
                  return {};
                });
                methods[id] = {
                  domain: domain,
                  name: name,
                  val: val,
                  source: source
                };
              }
            }

            function lookupMethod(source, id) {
              var methodStore = windowStore('methodStore');
              var proxyWindowMethods = globalStore('proxyWindowMethods');
              var methods = methodStore.getOrSet(source, function () {
                return {};
              });
              return methods[id] || proxyWindowMethods.get(id);
            }

            function listenForFunctionCalls(_ref) {
              var on = _ref.on,
                  send = _ref.send;
              return globalStore('builtinListeners').getOrSet('functionCalls', function () {
                return on(MESSAGE_NAME.METHOD, {
                  domain: constants_WILDCARD
                }, function (_ref2) {
                  var source = _ref2.source,
                      origin = _ref2.origin,
                      data = _ref2.data;
                  var id = data.id,
                      name = data.name;
                  var meth = lookupMethod(source, id);

                  if (!meth) {
                    throw new Error("Could not find method '" + name + "' with id: " + data.id + " in " + utils_getDomain(window));
                  }

                  var methodSource = meth.source,
                      domain = meth.domain,
                      val = meth.val;
                  return promise_ZalgoPromise.try(function () {
                    if (!matchDomain(domain, origin)) {
                      // $FlowFixMe
                      throw new Error("Method '" + data.name + "' domain " + JSON.stringify(util_isRegex(meth.domain) ? meth.domain.source : meth.domain) + " does not match origin " + origin + " in " + utils_getDomain(window));
                    }

                    if (window_ProxyWindow.isProxyWindow(methodSource)) {
                      // $FlowFixMe
                      return methodSource.matchWindow(source, {
                        send: send
                      }).then(function (match) {
                        if (!match) {
                          throw new Error("Method call '" + data.name + "' failed - proxy window does not match source in " + utils_getDomain(window));
                        }
                      });
                    }
                  }).then(function () {
                    return val.apply({
                      source: source,
                      origin: origin
                    }, data.args);
                  }, function (err) {
                    return promise_ZalgoPromise.try(function () {
                      if (val.onError) {
                        return val.onError(err);
                      }
                    }).then(function () {
                      // $FlowFixMe
                      if (err.stack) {
                        // $FlowFixMe
                        err.stack = "Remote call to " + name + "()\n\n" + err.stack;
                      }

                      throw err;
                    });
                  }).then(function (result) {
                    return {
                      result: result,
                      id: id,
                      name: name
                    };
                  });
                });
              });
            }

            function function_serializeFunction(destination, domain, val, key, _ref3) {
              var on = _ref3.on,
                  send = _ref3.send;
              listenForFunctionCalls({
                on: on,
                send: send
              });
              var id = val.__id__ || uniqueID();
              destination = window_ProxyWindow.unwrap(destination);
              var name = val.__name__ || val.name || key;

              if (typeof name === 'string' && typeof name.indexOf === 'function' && name.indexOf('anonymous::') === 0) {
                name = name.replace('anonymous::', key + "::");
              }

              if (window_ProxyWindow.isProxyWindow(destination)) {
                addMethod(id, val, name, destination, domain); // $FlowFixMe

                destination.awaitWindow().then(function (win) {
                  addMethod(id, val, name, win, domain);
                });
              } else {
                addMethod(id, val, name, destination, domain);
              }

              return serializeType(SERIALIZATION_TYPE.CROSS_DOMAIN_FUNCTION, {
                id: id,
                name: name
              });
            }
            function function_deserializeFunction(source, origin, _ref4, _ref5) {
              var id = _ref4.id,
                  name = _ref4.name;
              var send = _ref5.send;

              var getDeserializedFunction = function getDeserializedFunction(opts) {
                if (opts === void 0) {
                  opts = {};
                }

                function crossDomainFunctionWrapper() {
                  var _arguments = arguments;

                  return window_ProxyWindow.toProxyWindow(source, {
                    send: send
                  }).awaitWindow().then(function (win) {
                    var meth = lookupMethod(win, id);

                    if (meth && meth.val !== crossDomainFunctionWrapper) {
                      return meth.val.apply({
                        source: window,
                        origin: utils_getDomain()
                      }, _arguments);
                    } else {
                      // $FlowFixMe
                      var options = {
                        domain: origin,
                        fireAndForget: opts.fireAndForget
                      };

                      var _args = Array.prototype.slice.call(_arguments);

                      return send(win, MESSAGE_NAME.METHOD, {
                        id: id,
                        name: name,
                        args: _args
                      }, options).then(function (res) {
                        if (!opts.fireAndForget) {
                          return res.data.result;
                        }
                      });
                    }
                  }).catch(function (err) {

                    throw err;
                  });
                }

                crossDomainFunctionWrapper.__name__ = name;
                crossDomainFunctionWrapper.__origin__ = origin;
                crossDomainFunctionWrapper.__source__ = source;
                crossDomainFunctionWrapper.__id__ = id;
                crossDomainFunctionWrapper.origin = origin;
                return crossDomainFunctionWrapper;
              };

              var crossDomainFunctionWrapper = getDeserializedFunction();
              crossDomainFunctionWrapper.fireAndForget = getDeserializedFunction({
                fireAndForget: true
              });
              return crossDomainFunctionWrapper;
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/serialize/promise.js





            function promise_serializePromise(destination, domain, val, key, _ref) {
              var on = _ref.on,
                  send = _ref.send;
              return serializeType(SERIALIZATION_TYPE.CROSS_DOMAIN_ZALGO_PROMISE, {
                then: function_serializeFunction(destination, domain, function (resolve, reject) {
                  return val.then(resolve, reject);
                }, key, {
                  on: on,
                  send: send
                })
              });
            }
            function promise_deserializePromise(source, origin, _ref2) {
              var then = _ref2.then;
              return new promise_ZalgoPromise(then);
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/serialize/serialize.js






            function serializeMessage(destination, domain, obj, _ref) {
              var _serialize;

              var on = _ref.on,
                  send = _ref.send;
              return serialize(obj, (_serialize = {}, _serialize[TYPE.PROMISE] = function (val, key) {
                return promise_serializePromise(destination, domain, val, key, {
                  on: on,
                  send: send
                });
              }, _serialize[TYPE.FUNCTION] = function (val, key) {
                return function_serializeFunction(destination, domain, val, key, {
                  on: on,
                  send: send
                });
              }, _serialize[TYPE.OBJECT] = function (val) {
                return isWindow(val) || window_ProxyWindow.isProxyWindow(val) ? serializeWindow(destination, domain, val, {
                  on: on,
                  send: send
                }) : val;
              }, _serialize));
            }
            function deserializeMessage(source, origin, message, _ref2) {
              var _deserialize;

              var on = _ref2.on,
                  send = _ref2.send;
              return deserialize_deserialize(message, (_deserialize = {}, _deserialize[SERIALIZATION_TYPE.CROSS_DOMAIN_ZALGO_PROMISE] = function (serializedPromise) {
                return promise_deserializePromise(source, origin, serializedPromise);
              }, _deserialize[SERIALIZATION_TYPE.CROSS_DOMAIN_FUNCTION] = function (serializedFunction) {
                return function_deserializeFunction(source, origin, serializedFunction, {
                  on: on,
                  send: send
                });
              }, _deserialize[SERIALIZATION_TYPE.CROSS_DOMAIN_WINDOW] = function (serializedWindow) {
                return deserializeWindow(source, origin, serializedWindow, {
                  send: send
                });
              }, _deserialize));
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/serialize/index.js




            // CONCATENATED MODULE: ./node_modules/post-robot/src/drivers/send/strategies.js





            var SEND_MESSAGE_STRATEGIES = {};

            SEND_MESSAGE_STRATEGIES[SEND_STRATEGY.POST_MESSAGE] = function (win, serializedMessage, domain) {

              var domains;

              if (Array.isArray(domain)) {
                domains = domain;
              } else if (typeof domain === 'string') {
                domains = [domain];
              } else {
                domains = [constants_WILDCARD];
              }

              domains = domains.map(function (dom) {

                if (dom.indexOf(PROTOCOL.FILE) === 0) {
                  return constants_WILDCARD;
                }

                return dom;
              });
              domains.forEach(function (dom) {
                win.postMessage(serializedMessage, dom);
              });
            };

            {
              SEND_MESSAGE_STRATEGIES[SEND_STRATEGY.BRIDGE] = function (win, serializedMessage, domain) {
                if (!needsBridgeForBrowser() && !isBridge()) {
                  throw new Error("Bridge not needed for browser");
                }

                if (isSameDomain(win)) {
                  throw new Error("Post message through bridge disabled between same domain windows");
                }

                if (isSameTopWindow(window, win) !== false) {
                  throw new Error("Can only use bridge to communicate between two different windows, not between frames");
                }

                sendBridgeMessage(win, domain, serializedMessage);
              };
            }

            {
              SEND_MESSAGE_STRATEGIES[SEND_STRATEGY.GLOBAL] = function (win, serializedMessage) {
                if (!needsGlobalMessagingForBrowser()) {
                  throw new Error("Global messaging not needed for browser");
                }

                if (!isSameDomain(win)) {
                  throw new Error("Post message through global disabled between different domain windows");
                }

                if (isSameTopWindow(window, win) !== false) {
                  throw new Error("Can only use global to communicate between two different windows, not between frames");
                } // $FlowFixMe


                var foreignGlobal = global_getGlobal(win);

                if (!foreignGlobal) {
                  throw new Error("Can not find postRobot global on foreign window");
                }

                foreignGlobal.receiveMessage({
                  source: window,
                  origin: utils_getDomain(),
                  data: serializedMessage
                });
              };
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/drivers/send/index.js





            function send_sendMessage(win, domain, message, _ref) {
              var _serializeMessage;

              var on = _ref.on,
                  send = _ref.send;

              if (isWindowClosed(win)) {
                throw new Error('Window is closed');
              }

              var serializedMessage = serializeMessage(win, domain, (_serializeMessage = {}, _serializeMessage["__post_robot_10_0_29__"] = _extends({
                id: uniqueID(),
                origin: utils_getDomain(window)
              }, message), _serializeMessage), {
                on: on,
                send: send
              });
              var strategies = Object.keys(SEND_MESSAGE_STRATEGIES);
              var errors = [];

              for (var _i2 = 0; _i2 < strategies.length; _i2++) {
                var strategyName = strategies[_i2];

                try {
                  SEND_MESSAGE_STRATEGIES[strategyName](win, serializedMessage, domain);
                } catch (err) {
                  errors.push(err);
                }
              }

              if (errors.length === strategies.length) {
                throw new Error("All post-robot messaging strategies failed:\n\n" + errors.map(function (err, i) {
                  return i + ". " + stringifyError(err);
                }).join('\n\n'));
              }
            }
            var __DOMAIN_REGEX__ = '__domain_regex__';
            function addResponseListener(hash, listener) {
              var responseListeners = globalStore('responseListeners');
              responseListeners.set(hash, listener);
            }
            function getResponseListener(hash) {
              var responseListeners = globalStore('responseListeners');
              return responseListeners.get(hash);
            }
            function deleteResponseListener(hash) {
              var responseListeners = globalStore('responseListeners');
              responseListeners.del(hash);
            }
            function cancelResponseListeners() {
              var responseListeners = globalStore('responseListeners');

              for (var _i2 = 0, _responseListeners$ke2 = responseListeners.keys(); _i2 < _responseListeners$ke2.length; _i2++) {
                var hash = _responseListeners$ke2[_i2];
                var listener = responseListeners.get(hash);

                if (listener) {
                  listener.cancelled = true;
                }

                responseListeners.del(hash);
              }
            }
            function markResponseListenerErrored(hash) {
              var erroredResponseListeners = globalStore('erroredResponseListeners');
              erroredResponseListeners.set(hash, true);
            }
            function isResponseListenerErrored(hash) {
              var erroredResponseListeners = globalStore('erroredResponseListeners');
              return erroredResponseListeners.has(hash);
            }
            function getRequestListener(_ref) {
              var name = _ref.name,
                  win = _ref.win,
                  domain = _ref.domain;
              var requestListeners = windowStore('requestListeners');

              if (win === constants_WILDCARD) {
                win = null;
              }

              if (domain === constants_WILDCARD) {
                domain = null;
              }

              if (!name) {
                throw new Error("Name required to get request listener");
              }

              for (var _i4 = 0, _ref3 = [win, getWildcard()]; _i4 < _ref3.length; _i4++) {
                var winQualifier = _ref3[_i4];

                if (!winQualifier) {
                  continue;
                }

                var nameListeners = requestListeners.get(winQualifier);

                if (!nameListeners) {
                  continue;
                }

                var domainListeners = nameListeners[name];

                if (!domainListeners) {
                  continue;
                }

                if (domain && typeof domain === 'string') {
                  if (domainListeners[domain]) {
                    return domainListeners[domain];
                  }

                  if (domainListeners[__DOMAIN_REGEX__]) {
                    for (var _i6 = 0, _domainListeners$__DO2 = domainListeners[__DOMAIN_REGEX__]; _i6 < _domainListeners$__DO2.length; _i6++) {
                      var _domainListeners$__DO3 = _domainListeners$__DO2[_i6],
                          regex = _domainListeners$__DO3.regex,
                          listener = _domainListeners$__DO3.listener;

                      if (matchDomain(regex, domain)) {
                        return listener;
                      }
                    }
                  }
                }

                if (domainListeners[constants_WILDCARD]) {
                  return domainListeners[constants_WILDCARD];
                }
              }
            }
            function addRequestListener(_ref4, listener) {
              var name = _ref4.name,
                  win = _ref4.win,
                  domain = _ref4.domain;
              var requestListeners = windowStore('requestListeners');

              if (!name || typeof name !== 'string') {
                throw new Error("Name required to add request listener");
              }

              if (Array.isArray(win)) {
                var listenersCollection = [];

                for (var _i8 = 0, _win2 = win; _i8 < _win2.length; _i8++) {
                  var item = _win2[_i8];
                  listenersCollection.push(addRequestListener({
                    name: name,
                    domain: domain,
                    win: item
                  }, listener));
                }

                return {
                  cancel: function cancel() {
                    for (var _i10 = 0; _i10 < listenersCollection.length; _i10++) {
                      var cancelListener = listenersCollection[_i10];
                      cancelListener.cancel();
                    }
                  }
                };
              }

              if (Array.isArray(domain)) {
                var _listenersCollection = [];

                for (var _i12 = 0, _domain2 = domain; _i12 < _domain2.length; _i12++) {
                  var _item = _domain2[_i12];

                  _listenersCollection.push(addRequestListener({
                    name: name,
                    win: win,
                    domain: _item
                  }, listener));
                }

                return {
                  cancel: function cancel() {
                    for (var _i14 = 0; _i14 < _listenersCollection.length; _i14++) {
                      var cancelListener = _listenersCollection[_i14];
                      cancelListener.cancel();
                    }
                  }
                };
              }

              var existingListener = getRequestListener({
                name: name,
                win: win,
                domain: domain
              });

              if (!win || win === constants_WILDCARD) {
                win = getWildcard();
              }

              domain = domain || constants_WILDCARD;

              if (existingListener) {
                if (win && domain) {
                  throw new Error("Request listener already exists for " + name + " on domain " + domain.toString() + " for " + (win === getWildcard() ? 'wildcard' : 'specified') + " window");
                } else if (win) {
                  throw new Error("Request listener already exists for " + name + " for " + (win === getWildcard() ? 'wildcard' : 'specified') + " window");
                } else if (domain) {
                  throw new Error("Request listener already exists for " + name + " on domain " + domain.toString());
                } else {
                  throw new Error("Request listener already exists for " + name);
                }
              }

              var nameListeners = requestListeners.getOrSet(win, function () {
                return {};
              });
              var domainListeners = util_getOrSet(nameListeners, name, function () {
                return {};
              });
              var strDomain = domain.toString();
              var regexListeners;
              var regexListener;

              if (util_isRegex(domain)) {
                regexListeners = util_getOrSet(domainListeners, __DOMAIN_REGEX__, function () {
                  return [];
                });
                regexListener = {
                  regex: domain,
                  listener: listener
                };
                regexListeners.push(regexListener);
              } else {
                domainListeners[strDomain] = listener;
              }

              return {
                cancel: function cancel() {
                  delete domainListeners[strDomain];

                  if (regexListener) {
                    regexListeners.splice(regexListeners.indexOf(regexListener, 1));

                    if (!regexListeners.length) {
                      delete domainListeners[__DOMAIN_REGEX__];
                    }
                  }

                  if (!Object.keys(domainListeners).length) {
                    delete nameListeners[name];
                  }

                  if (win && !Object.keys(nameListeners).length) {
                    requestListeners.del(win);
                  }
                }
              };
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/drivers/receive/types.js


            var _RECEIVE_MESSAGE_TYPE;







            var RECEIVE_MESSAGE_TYPES = (_RECEIVE_MESSAGE_TYPE = {}, _RECEIVE_MESSAGE_TYPE[MESSAGE_TYPE.REQUEST] = function (source, origin, message, _ref) {
              var on = _ref.on,
                  send = _ref.send;
              var options = getRequestListener({
                name: message.name,
                win: source,
                domain: origin
              });
              var logName = message.name === MESSAGE_NAME.METHOD && message.data && typeof message.data.name === 'string' ? message.data.name + "()" : message.name;

              function sendResponse(type, ack, response) {
                if (response === void 0) {
                  response = {};
                }

                if (message.fireAndForget || isWindowClosed(source)) {
                  return;
                }

                try {
                  // $FlowFixMe
                  send_sendMessage(source, origin, _extends({
                    type: type,
                    ack: ack,
                    hash: message.hash,
                    name: message.name
                  }, response), {
                    on: on,
                    send: send
                  });
                } catch (err) {
                  throw new Error("Send response message failed for " + logName + " in " + utils_getDomain() + "\n\n" + stringifyError(err));
                }
              }

              return promise_ZalgoPromise.all([sendResponse(MESSAGE_TYPE.ACK), promise_ZalgoPromise.try(function () {
                if (!options) {
                  throw new Error("No handler found for post message: " + message.name + " from " + origin + " in " + window.location.protocol + "//" + window.location.host + window.location.pathname);
                }

                if (!matchDomain(options.domain, origin)) {
                  throw new Error("Request origin " + origin + " does not match domain " + options.domain.toString());
                }

                var data = message.data;
                return options.handler({
                  source: source,
                  origin: origin,
                  data: data
                });
              }).then(function (data) {
                return sendResponse(MESSAGE_TYPE.RESPONSE, MESSAGE_ACK.SUCCESS, {
                  data: data
                });
              }, function (error) {
                return sendResponse(MESSAGE_TYPE.RESPONSE, MESSAGE_ACK.ERROR, {
                  error: error
                });
              })]).then(src_util_noop).catch(function (err) {
                if (options && options.handleError) {
                  return options.handleError(err);
                } else {
                  throw err;
                }
              });
            }, _RECEIVE_MESSAGE_TYPE[MESSAGE_TYPE.ACK] = function (source, origin, message) {
              if (isResponseListenerErrored(message.hash)) {
                return;
              }

              var options = getResponseListener(message.hash);

              if (!options) {
                throw new Error("No handler found for post message ack for message: " + message.name + " from " + origin + " in " + window.location.protocol + "//" + window.location.host + window.location.pathname);
              }

              try {
                if (!matchDomain(options.domain, origin)) {
                  throw new Error("Ack origin " + origin + " does not match domain " + options.domain.toString());
                }

                if (source !== options.win) {
                  throw new Error("Ack source does not match registered window");
                }
              } catch (err) {
                options.promise.reject(err);
              }

              options.ack = true;
            }, _RECEIVE_MESSAGE_TYPE[MESSAGE_TYPE.RESPONSE] = function (source, origin, message) {
              if (isResponseListenerErrored(message.hash)) {
                return;
              }

              var options = getResponseListener(message.hash);

              if (!options) {
                throw new Error("No handler found for post message response for message: " + message.name + " from " + origin + " in " + window.location.protocol + "//" + window.location.host + window.location.pathname);
              }

              if (!matchDomain(options.domain, origin)) {
                throw new Error("Response origin " + origin + " does not match domain " + stringifyDomainPattern(options.domain));
              }

              if (source !== options.win) {
                throw new Error("Response source does not match registered window");
              }

              deleteResponseListener(message.hash);
              var logName = message.name === MESSAGE_NAME.METHOD && message.data && typeof message.data.name === 'string' ? message.data.name + "()" : message.name;

              if (message.ack === MESSAGE_ACK.ERROR) {

                options.promise.reject(message.error);
              } else if (message.ack === MESSAGE_ACK.SUCCESS) {

                options.promise.resolve({
                  source: source,
                  origin: origin,
                  data: message.data
                });
              }
            }, _RECEIVE_MESSAGE_TYPE);
            // CONCATENATED MODULE: ./node_modules/post-robot/src/drivers/receive/index.js







            function parseMessage(message, source, origin, _ref) {
              var on = _ref.on,
                  send = _ref.send;
              var parsedMessage;

              try {
                parsedMessage = deserializeMessage(source, origin, message, {
                  on: on,
                  send: send
                });
              } catch (err) {
                return;
              }

              if (!parsedMessage) {
                return;
              }

              if (typeof parsedMessage !== 'object' || parsedMessage === null) {
                return;
              }

              parsedMessage = parsedMessage["__post_robot_10_0_29__"];

              if (!parsedMessage || typeof parsedMessage !== 'object' || parsedMessage === null) {
                return;
              }

              if (!parsedMessage.type || typeof parsedMessage.type !== 'string') {
                return;
              }

              if (!RECEIVE_MESSAGE_TYPES[parsedMessage.type]) {
                return;
              }

              return parsedMessage;
            }

            function receive_receiveMessage(event, _ref2) {
              var on = _ref2.on,
                  send = _ref2.send;
              var receivedMessages = globalStore('receivedMessages');

              try {
                if (!window || window.closed || !event.source) {
                  return;
                }
              } catch (err) {
                return;
              }

              var source = event.source,
                  origin = event.origin,
                  data = event.data;

              var message = parseMessage(data, source, origin, {
                on: on,
                send: send
              });

              if (!message) {
                return;
              }

              markWindowKnown(source);

              if (receivedMessages.has(message.id)) {
                return;
              }

              receivedMessages.set(message.id, true);

              if (isWindowClosed(source) && !message.fireAndForget) {
                return;
              }

              if (message.origin.indexOf(PROTOCOL.FILE) === 0) {
                origin = PROTOCOL.FILE + "//";
              }

              RECEIVE_MESSAGE_TYPES[message.type](source, origin, message, {
                on: on,
                send: send
              });
            }
            function setupGlobalReceiveMessage(_ref3) {
              var on = _ref3.on,
                  send = _ref3.send;
              var global = global_getGlobal();

              global.receiveMessage = global.receiveMessage || function (message) {
                return receive_receiveMessage(message, {
                  on: on,
                  send: send
                });
              };
            }
            function messageListener(event, _ref4) {
              var on = _ref4.on,
                  send = _ref4.send;

              try {
                src_util_noop(event.source);
              } catch (err) {
                return;
              }

              var source = event.source || event.sourceElement;
              var origin = event.origin || event.originalEvent && event.originalEvent.origin;
              var data = event.data;

              if (origin === 'null') {
                origin = PROTOCOL.FILE + "//";
              }

              if (!source) {
                return;
              }

              if (!origin) {
                throw new Error("Post message did not have origin domain");
              }

              receive_receiveMessage({
                source: source,
                origin: origin,
                data: data
              }, {
                on: on,
                send: send
              });
            }
            function listenForMessages(_ref5) {
              var on = _ref5.on,
                  send = _ref5.send;
              return globalStore().getOrSet('postMessageListener', function () {
                return addEventListener(window, 'message', function (event) {
                  // $FlowFixMe
                  messageListener(event, {
                    on: on,
                    send: send
                  });
                });
              });
            }
            function stopListenForMessages() {
              var listener = globalStore().get('postMessageListener');

              if (listener) {
                listener.cancel();
              }
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/drivers/index.js



            // CONCATENATED MODULE: ./node_modules/post-robot/src/public/on.js



            function on_on(name, options, handler) {
              if (!name) {
                throw new Error('Expected name');
              }

              if (typeof options === 'function') {
                handler = options; // $FlowFixMe

                options = {};
              }

              if (!handler) {
                throw new Error('Expected handler');
              }

              options = options || {};
              options.name = name;
              options.handler = handler || options.handler;
              var win = options.window;
              var domain = options.domain;
              var listenerOptions = {
                handler: options.handler,
                handleError: options.errorHandler || function (err) {
                  throw err;
                },
                window: win,
                domain: domain || constants_WILDCARD,
                name: name
              };
              var requestListener = addRequestListener({
                name: name,
                win: win,
                domain: domain
              }, listenerOptions);
              return {
                cancel: function cancel() {
                  requestListener.cancel();
                }
              };
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/public/send.js









            function validateOptions(name, win, domain) {
              if (!name) {
                throw new Error('Expected name');
              }

              if (domain) {
                if (typeof domain !== 'string' && !Array.isArray(domain) && !util_isRegex(domain)) {
                  throw new TypeError("Expected domain to be a string, array, or regex");
                }
              }

              if (isWindowClosed(win)) {
                throw new Error('Target window is closed');
              }
            }

            function normalizeDomain(win, targetDomain, actualDomain, _ref) {
              var send = _ref.send;

              if (typeof targetDomain === 'string') {
                return promise_ZalgoPromise.resolve(targetDomain);
              }

              return promise_ZalgoPromise.try(function () {
                return actualDomain || sayHello(win, {
                  send: send
                }).then(function (_ref2) {
                  var domain = _ref2.domain;
                  return domain;
                });
              }).then(function (normalizedDomain) {
                if (!matchDomain(targetDomain, targetDomain)) {
                  throw new Error("Domain " + stringify(targetDomain) + " does not match " + stringify(targetDomain));
                }

                return normalizedDomain;
              });
            }

            var send_send = function send(win, name, data, options) {
              options = options || {};
              var domain = options.domain || constants_WILDCARD;
              var responseTimeout = options.timeout || RES_TIMEOUT;
              var childTimeout = options.timeout || CHILD_WINDOW_TIMEOUT;
              var fireAndForget = options.fireAndForget || false; // $FlowFixMe

              return promise_ZalgoPromise.try(function () {
                validateOptions(name, win, domain);

                if (isAncestor(window, win)) {
                  return awaitWindowHello(win, childTimeout);
                }
              }).then(function (_temp) {
                var _ref3 = _temp === void 0 ? {} : _temp,
                    actualDomain = _ref3.domain;

                return normalizeDomain(win, domain, actualDomain, {
                  send: send
                });
              }).then(function (targetDomain) {
                domain = targetDomain;
                var logName = name === MESSAGE_NAME.METHOD && data && typeof data.name === 'string' ? data.name + "()" : name;

                var promise = new promise_ZalgoPromise();
                var hash = name + "_" + uniqueID();

                if (!fireAndForget) {
                  var responseListener = {
                    name: name,
                    win: win,
                    domain: domain,
                    promise: promise
                  };
                  addResponseListener(hash, responseListener);
                  var reqPromises = windowStore('requestPromises').getOrSet(win, function () {
                    return [];
                  });
                  reqPromises.push(promise);
                  promise.catch(function () {
                    markResponseListenerErrored(hash);
                    deleteResponseListener(hash);
                  });
                  var totalAckTimeout = isWindowKnown(win) ? ACK_TIMEOUT_KNOWN : ACK_TIMEOUT;
                  var totalResTimeout = responseTimeout;
                  var ackTimeout = totalAckTimeout;
                  var resTimeout = totalResTimeout;
                  var interval = safeInterval(function () {
                    if (isWindowClosed(win)) {
                      return promise.reject(new Error("Window closed for " + name + " before " + (responseListener.ack ? 'response' : 'ack')));
                    }

                    if (responseListener.cancelled) {
                      return promise.reject(new Error("Response listener was cancelled for " + name));
                    }

                    ackTimeout = Math.max(ackTimeout - RESPONSE_CYCLE_TIME, 0);

                    if (resTimeout !== -1) {
                      resTimeout = Math.max(resTimeout - RESPONSE_CYCLE_TIME, 0);
                    }

                    if (!responseListener.ack && ackTimeout === 0) {
                      return promise.reject(new Error("No ack for postMessage " + logName + " in " + utils_getDomain() + " in " + totalAckTimeout + "ms"));
                    } else if (resTimeout === 0) {
                      return promise.reject(new Error("No response for postMessage " + logName + " in " + utils_getDomain() + " in " + totalResTimeout + "ms"));
                    }
                  }, RESPONSE_CYCLE_TIME);
                  promise.finally(function () {
                    interval.cancel();
                    reqPromises.splice(reqPromises.indexOf(promise, 1));
                  }).catch(src_util_noop);
                }

                try {
                  send_sendMessage(win, domain, {
                    type: MESSAGE_TYPE.REQUEST,
                    hash: hash,
                    name: name,
                    data: data,
                    fireAndForget: fireAndForget
                  }, {
                    on: on_on,
                    send: send
                  });
                } catch (err) {
                  throw new Error("Send request message failed for " + logName + " in " + utils_getDomain() + "\n\n" + stringifyError(err));
                }

                return fireAndForget ? promise.resolve() : promise;
              });
            };
            // CONCATENATED MODULE: ./node_modules/post-robot/src/public/index.js


            // CONCATENATED MODULE: ./node_modules/post-robot/src/setup.js






            function setup_serializeMessage(destination, domain, obj) {
              return serializeMessage(destination, domain, obj, {
                on: on_on,
                send: send_send
              });
            }
            function setup_deserializeMessage(source, origin, message) {
              return deserializeMessage(source, origin, message, {
                on: on_on,
                send: send_send
              });
            }
            function setup_toProxyWindow(win) {
              return window_ProxyWindow.toProxyWindow(win, {
                send: send_send
              });
            }
            function setup() {
              if (!global_getGlobal().initialized) {
                global_getGlobal().initialized = true;
                setupGlobalReceiveMessage({
                  on: on_on,
                  send: send_send
                });
                listenForMessages({
                  on: on_on,
                  send: send_send
                });

                {
                  setupBridge({
                    on: on_on,
                    send: send_send,
                    receiveMessage: receive_receiveMessage
                  });
                }

                initHello({
                  on: on_on,
                  send: send_send
                });
              }
            }
            function setup_destroy() {
              cancelResponseListeners();
              stopListenForMessages();
              deleteGlobal();
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/clean.js


            function cleanUpWindow(win) {
              var requestPromises = windowStore('requestPromises');

              for (var _i2 = 0, _requestPromises$get2 = requestPromises.get(win, []); _i2 < _requestPromises$get2.length; _i2++) {
                var promise = _requestPromises$get2[_i2];
                promise.reject(new Error("Window cleaned up before response")).catch(src_util_noop);
              }
            }
            // CONCATENATED MODULE: ./node_modules/post-robot/src/index.js









            var src_bridge;

            {
              src_bridge = {
                setupBridge: setupBridge,
                openBridge: parent_openBridge,
                linkWindow: linkWindow,
                linkUrl: linkUrl,
                isBridge: isBridge,
                needsBridge: needsBridge,
                needsBridgeForBrowser: needsBridgeForBrowser,
                hasBridge: hasBridge,
                needsBridgeForWin: needsBridgeForWin,
                needsBridgeForDomain: needsBridgeForDomain,
                destroyBridges: destroyBridges
              };
            }
            // CONCATENATED MODULE: ./src/lib/global.js

            function lib_global_getGlobal(win) {
              if (win === void 0) {
                win = window;
              }

              if (!isSameDomain(win)) {
                throw new Error("Can not get global for window on different domain");
              }

              if (!win["__zoid_9_0_36__"]) {
                win["__zoid_9_0_36__"] = {};
              }

              return win["__zoid_9_0_36__"];
            }
            function destroyGlobal() {
              delete window["__zoid_9_0_36__"];
            }
            // CONCATENATED MODULE: ./src/lib/serialize.js

            function getProxyObject(obj) {
              return {
                get: function get() {
                  var _this = this;

                  return promise_ZalgoPromise.try(function () {
                    if (_this.source && _this.source !== window) {
                      throw new Error("Can not call get on proxy object from a remote window");
                    }

                    return obj;
                  });
                }
              };
            }
            // CONCATENATED MODULE: ./src/lib/index.js


            // CONCATENATED MODULE: ./src/constants.js

            var ZOID = "zoid";
            var POST_MESSAGE = {
              DELEGATE: ZOID + "_delegate",
              ALLOW_DELEGATE: ZOID + "_allow_delegate"
            };
            var PROP_TYPE = {
              STRING: "string",
              OBJECT: "object",
              FUNCTION: "function",
              BOOLEAN: "boolean",
              NUMBER: "number",
              ARRAY: "array"
            };
            var INITIAL_PROPS = {
              RAW: 'raw',
              UID: 'uid'
            };
            var WINDOW_REFERENCES = {
              OPENER: 'opener',
              PARENT: 'parent',
              GLOBAL: 'global'
            };
            var PROP_SERIALIZATION = {
              JSON: 'json',
              DOTIFY: 'dotify',
              BASE64: 'base64'
            };
            var CONTEXT = WINDOW_TYPE;
            var src_constants_WILDCARD = '*';
            var DEFAULT_DIMENSIONS = {
              WIDTH: '300px',
              HEIGHT: '150px'
            };
            var EVENT = {
              RENDER: 'zoid-render',
              RENDERED: 'zoid-rendered',
              DISPLAY: 'zoid-display',
              ERROR: 'zoid-error',
              CLOSE: 'zoid-close',
              PROPS: 'zoid-props',
              RESIZE: 'zoid-resize',
              FOCUS: 'zoid-focus'
            };
            // CONCATENATED MODULE: ./src/child/props.js

            function normalizeChildProp(component, props, key, value, helpers) {
              // $FlowFixMe
              var prop = component.getPropDefinition(key);

              if (!prop) {
                return value;
              }

              if (typeof prop.childDecorate === 'function') {
                var close = helpers.close,
                    focus = helpers.focus,
                    onError = helpers.onError,
                    onProps = helpers.onProps,
                    resize = helpers.resize,
                    getParent = helpers.getParent,
                    getParentDomain = helpers.getParentDomain,
                    show = helpers.show,
                    hide = helpers.hide;
                return prop.childDecorate({
                  value: value,
                  close: close,
                  focus: focus,
                  onError: onError,
                  onProps: onProps,
                  resize: resize,
                  getParent: getParent,
                  getParentDomain: getParentDomain,
                  show: show,
                  hide: hide
                });
              }

              return value;
            } // eslint-disable-next-line max-params

            function normalizeChildProps(parentComponentWindow, component, props, origin, helpers, isUpdate) {
              if (isUpdate === void 0) {
                isUpdate = false;
              }

              var result = {};

              for (var _i2 = 0, _Object$keys2 = Object.keys(props); _i2 < _Object$keys2.length; _i2++) {
                var key = _Object$keys2[_i2];
                var prop = component.getPropDefinition(key);

                if (prop && prop.sameDomain && (origin !== utils_getDomain(window) || !isSameDomain(parentComponentWindow))) {
                  continue;
                } // $FlowFixMe


                var value = normalizeChildProp(component, props, key, props[key], helpers);
                result[key] = value;

                if (prop && prop.alias && !result[prop.alias]) {
                  result[prop.alias] = value;
                }
              }

              if (!isUpdate) {
                for (var _i4 = 0, _component$getPropNam2 = component.getPropNames(); _i4 < _component$getPropNam2.length; _i4++) {
                  var _key = _component$getPropNam2[_i4];

                  if (!props.hasOwnProperty(_key)) {
                    result[_key] = normalizeChildProp(component, props, _key, props[_key], helpers);
                  }
                }
              } // $FlowFixMe


              return result;
            }
            // CONCATENATED MODULE: ./src/child/window.js



            function parseChildWindowName(windowName) {
              return inlineMemoize(parseChildWindowName, function () {
                if (!windowName) {
                  throw new Error("No window name");
                }

                var _windowName$split = windowName.split('__'),
                    zoidcomp = _windowName$split[1],
                    name = _windowName$split[2],
                    encodedPayload = _windowName$split[3];

                if (zoidcomp !== ZOID) {
                  throw new Error("Window not rendered by zoid - got " + zoidcomp);
                }

                if (!name) {
                  throw new Error("Expected component name");
                }

                if (!encodedPayload) {
                  throw new Error("Expected encoded payload");
                }

                try {
                  return JSON.parse(base64decode(encodedPayload));
                } catch (err) {
                  throw new Error("Can not decode window name payload: " + encodedPayload + ": " + stringifyError(err));
                }
              }, [windowName]);
            }

            function getChildPayload() {
              try {
                return parseChildWindowName(window.name);
              } catch (err) {// pass
              }
            }
            // CONCATENATED MODULE: ./src/child/index.js
            /* eslint max-lines: 0 */










            /*  Child Component
                ---------------

                This is the portion of code which runs inside the frame or popup window containing the component's implementation.

                When the component author calls myComponent.attach(), it creates a new instance of ChildComponent, which is then
                responsible for managing the state and messaging back up to the parent, and providing props for the component to
                utilize.
            */
            var child_ChildComponent =
            /*#__PURE__*/
            function () {
              // eslint-disable-line flowtype/no-mutable-array
              function ChildComponent(component) {
                var _this = this;

                this.component = void 0;
                this.props = void 0;
                this.context = void 0;
                this.parent = void 0;
                this.parentDomain = void 0;
                this.parentComponentWindow = void 0;
                this.onPropHandlers = void 0;
                this.autoResize = void 0;
                promise_ZalgoPromise.try(function () {
                  _this.component = component;
                  _this.onPropHandlers = [];
                  var childPayload = getChildPayload();

                  if (!childPayload) {
                    throw new Error("No child payload found");
                  }

                  if (childPayload.version !== "9_0_36") {
                    throw new Error("Parent window has zoid version " + childPayload.version + ", child window has version " + "9_0_36");
                  }

                  var parent = childPayload.parent,
                      parentDomain = childPayload.parentDomain,
                      exports = childPayload.exports,
                      context = childPayload.context,
                      props = childPayload.props;
                  _this.context = context;
                  _this.parentComponentWindow = _this.getParentComponentWindow(parent);
                  _this.parentDomain = parentDomain;
                  _this.parent = setup_deserializeMessage(_this.parentComponentWindow, parentDomain, exports);

                  _this.checkParentDomain(parentDomain);

                  var initialProps = _this.getPropsByRef(_this.parentComponentWindow, parentDomain, props);

                  _this.setProps(initialProps, parentDomain);

                  markWindowKnown(_this.parentComponentWindow);

                  _this.watchForClose();

                  return _this.parent.init(_this.buildExports());
                }).then(function () {
                  return _this.watchForResize();
                }).catch(function (err) {
                  _this.onError(err);
                });
              }

              var _proto = ChildComponent.prototype;

              _proto.getHelpers = function getHelpers() {
                var _this2 = this;

                return {
                  focus: function focus() {
                    return _this2.focus();
                  },
                  close: function close() {
                    return _this2.close();
                  },
                  resize: function resize(_ref) {
                    var width = _ref.width,
                        height = _ref.height;
                    return _this2.resize({
                      width: width,
                      height: height
                    });
                  },
                  onError: function onError(err) {
                    return _this2.onError(err);
                  },
                  onProps: function onProps(handler) {
                    return _this2.onProps(handler);
                  },
                  getParent: function getParent() {
                    return _this2.parentComponentWindow;
                  },
                  getParentDomain: function getParentDomain() {
                    return _this2.parentDomain;
                  },
                  show: function show() {
                    return _this2.show();
                  },
                  hide: function hide() {
                    return _this2.hide();
                  }
                };
              };

              _proto.show = function show() {
                return this.parent.show();
              };

              _proto.hide = function hide() {
                return this.parent.hide();
              };

              _proto.checkParentDomain = function checkParentDomain(domain) {
                if (!matchDomain(this.component.allowedParentDomains, domain)) {
                  throw new Error("Can not be rendered by domain: " + domain);
                }
              };

              _proto.onProps = function onProps(handler) {
                this.onPropHandlers.push(handler);
              };

              _proto.getPropsByRef = function getPropsByRef(parentComponentWindow, domain, _ref2) {
                var type = _ref2.type,
                    value = _ref2.value,
                    uid = _ref2.uid;
                var props;

                if (type === INITIAL_PROPS.RAW) {
                  props = value;
                } else if (type === INITIAL_PROPS.UID) {
                  if (!isSameDomain(parentComponentWindow)) {
                    throw new Error("Parent component window is on a different domain - expected " + utils_getDomain() + " - can not retrieve props");
                  }

                  var global = lib_global_getGlobal(parentComponentWindow);
                  props = assertExists('props', global && global.props[uid]);
                }

                if (!props) {
                  throw new Error("Could not find props");
                }

                return setup_deserializeMessage(parentComponentWindow, domain, props);
              };

              _proto.getParentComponentWindow = function getParentComponentWindow(ref) {
                var type = ref.type;

                if (type === WINDOW_REFERENCES.OPENER) {
                  return assertExists('opener', getOpener(window));
                } else if (type === WINDOW_REFERENCES.PARENT && typeof ref.distance === 'number') {
                  return assertExists('parent', getNthParentFromTop(window, ref.distance));
                } else if (type === WINDOW_REFERENCES.GLOBAL && ref.uid && typeof ref.uid === 'string') {
                  var uid = ref.uid;
                  var ancestor = getAncestor(window);

                  if (!ancestor) {
                    throw new Error("Can not find ancestor window");
                  }

                  for (var _i2 = 0, _getAllFramesInWindow2 = getAllFramesInWindow(ancestor); _i2 < _getAllFramesInWindow2.length; _i2++) {
                    var frame = _getAllFramesInWindow2[_i2];

                    if (isSameDomain(frame)) {
                      var global = lib_global_getGlobal(frame);

                      if (global && global.windows && global.windows[uid]) {
                        return global.windows[uid];
                      }
                    }
                  }
                }

                throw new Error("Unable to find " + type + " parent component window");
              };

              _proto.getProps = function getProps() {
                // $FlowFixMe
                this.props = this.props || {};
                return this.props;
              };

              _proto.setProps = function setProps(props, origin, isUpdate) {
                if (isUpdate === void 0) {
                  isUpdate = false;
                }

                var helpers = this.getHelpers();
                var existingProps = this.getProps();
                var normalizedProps = normalizeChildProps(this.parentComponentWindow, this.component, props, origin, helpers, isUpdate);
                extend(existingProps, normalizedProps);

                for (var _i4 = 0, _this$onPropHandlers2 = this.onPropHandlers; _i4 < _this$onPropHandlers2.length; _i4++) {
                  var handler = _this$onPropHandlers2[_i4];
                  handler.call(this, existingProps);
                }
              };

              _proto.watchForClose = function watchForClose() {
                var _this3 = this;

                window.addEventListener('beforeunload', function () {
                  _this3.parent.checkClose.fireAndForget();
                });
                window.addEventListener('unload', function () {
                  _this3.parent.checkClose.fireAndForget();
                });
                onCloseWindow(this.parentComponentWindow, function () {
                  _this3.destroy();
                });
              };

              _proto.getAutoResize = function getAutoResize() {
                var _ref3 = this.autoResize || this.component.autoResize || {},
                    _ref3$width = _ref3.width,
                    width = _ref3$width === void 0 ? false : _ref3$width,
                    _ref3$height = _ref3.height,
                    height = _ref3$height === void 0 ? false : _ref3$height,
                    _ref3$element = _ref3.element,
                    element = _ref3$element === void 0 ? 'body' : _ref3$element;

                element = getElementSafe(element);
                return {
                  width: width,
                  height: height,
                  element: element
                };
              };

              _proto.watchForResize = function watchForResize() {
                var _this4 = this;

                return waitForDocumentBody().then(function () {
                  var _this4$getAutoResize = _this4.getAutoResize(),
                      width = _this4$getAutoResize.width,
                      height = _this4$getAutoResize.height,
                      element = _this4$getAutoResize.element;

                  if (!element || !width && !height || _this4.context === CONTEXT.POPUP) {
                    return;
                  }

                  onResize(element, function (_ref4) {
                    var newWidth = _ref4.width,
                        newHeight = _ref4.height;

                    _this4.resize({
                      width: width ? newWidth : undefined,
                      height: height ? newHeight : undefined
                    });
                  }, {
                    width: width,
                    height: height
                  });
                });
              };

              _proto.buildExports = function buildExports() {
                var self = this;
                return {
                  updateProps: function updateProps(props) {
                    var _this5 = this;

                    return promise_ZalgoPromise.try(function () {
                      return self.setProps(props, _this5.__origin__, true);
                    });
                  },
                  close: function close() {
                    return promise_ZalgoPromise.try(function () {
                      return self.destroy();
                    });
                  }
                };
              };

              _proto.resize = function resize(_ref5) {
                var width = _ref5.width,
                    height = _ref5.height;
                return this.parent.resize.fireAndForget({
                  width: width,
                  height: height
                });
              };

              _proto.close = function close() {
                return this.parent.close();
              };

              _proto.destroy = function destroy() {
                return promise_ZalgoPromise.try(function () {
                  window.close();
                });
              };

              _proto.focus = function focus() {
                return promise_ZalgoPromise.try(function () {
                  window.focus();
                });
              };

              _proto.onError = function onError(err) {
                var _this6 = this;

                return promise_ZalgoPromise.try(function () {
                  if (_this6.parent && _this6.parent.onError) {
                    return _this6.parent.onError(err);
                  } else {
                    throw err;
                  }
                });
              };

              return ChildComponent;
            }();
            // CONCATENATED MODULE: ./src/parent/drivers.js







            var RENDER_DRIVERS = {};
            RENDER_DRIVERS[CONTEXT.IFRAME] = {
              openFrame: function openFrame(_ref) {
                var windowName = _ref.windowName;
                return getProxyObject(dom_iframe({
                  attributes: _extends({
                    name: windowName,
                    title: this.component.name
                  }, this.component.attributes.iframe)
                }));
              },
              open: function open(_ref2) {
                var _this = this;

                var proxyFrame = _ref2.proxyFrame;

                if (!proxyFrame) {
                  throw new Error("Expected proxy frame to be passed");
                }

                return proxyFrame.get().then(function (frame) {
                  return awaitFrameWindow(frame).then(function (win) {
                    var frameWatcher = watchElementForClose(frame, function () {
                      return _this.close();
                    });

                    _this.clean.register(function () {
                      return frameWatcher.cancel();
                    });

                    _this.clean.register(function () {
                      return destroyElement(frame);
                    });

                    _this.clean.register(function () {
                      return cleanUpWindow(win);
                    });

                    return win;
                  });
                });
              },
              openPrerenderFrame: function openPrerenderFrame() {
                return getProxyObject(dom_iframe({
                  attributes: _extends({
                    name: "__zoid_prerender_frame__" + this.component.name + "_" + uniqueID() + "__",
                    title: "prerender__" + this.component.name
                  }, this.component.attributes.iframe)
                }));
              },
              openPrerender: function openPrerender(proxyWin, proxyPrerenderFrame) {
                var _this2 = this;

                if (!proxyPrerenderFrame) {
                  throw new Error("Expected proxy frame to be passed");
                }

                return proxyPrerenderFrame.get().then(function (prerenderFrame) {
                  _this2.clean.register(function () {
                    return destroyElement(prerenderFrame);
                  });

                  return awaitFrameWindow(prerenderFrame).then(function (prerenderFrameWindow) {
                    return assertSameDomain(prerenderFrameWindow);
                  }).then(function (win) {
                    return setup_toProxyWindow(win);
                  });
                });
              },
              delegate: ['getProxyWindow', 'getProxyContainer', 'renderContainer', 'openFrame', 'openPrerenderFrame', 'prerender', 'open', 'openPrerender', 'show', 'hide']
            };

            {
              RENDER_DRIVERS[CONTEXT.POPUP] = {
                open: function open(_ref3) {
                  var _this3 = this;

                  var windowName = _ref3.windowName;
                  return promise_ZalgoPromise.try(function () {
                    var _this3$component$dime = _this3.component.dimensions,
                        width = _this3$component$dime.width,
                        height = _this3$component$dime.height;
                    width = normalizeDimension(width, window.outerWidth);
                    height = normalizeDimension(height, window.outerWidth);
                    var win = popup('', _extends({
                      name: windowName,
                      width: width,
                      height: height
                    }, _this3.component.attributes.popup));

                    _this3.clean.register(function () {
                      closeWindow(win);
                      cleanUpWindow(win);
                    });

                    return win;
                  });
                },
                openPrerender: function openPrerender(proxyWin) {
                  return promise_ZalgoPromise.try(function () {
                    return proxyWin;
                  });
                },
                delegate: ['getProxyContainer', 'renderContainer', 'setProxyWin', 'show', 'hide']
              };
            }
            // CONCATENATED MODULE: ./src/parent/props.js




            /*  Normalize Props
                ---------------

                Turn props into normalized values, using defaults, function options, etc.
            */
            function extendProps(component, props, inputProps, helpers, isUpdate) {
              if (isUpdate === void 0) {
                isUpdate = false;
              }

              // eslint-disable-line complexity
              // $FlowFixMe
              inputProps = inputProps || {};
              extend(props, inputProps);
              var propNames = isUpdate ? [] : [].concat(component.getPropNames());

              for (var _i2 = 0, _Object$keys2 = Object.keys(inputProps); _i2 < _Object$keys2.length; _i2++) {
                var key = _Object$keys2[_i2];

                if (propNames.indexOf(key) === -1) {
                  propNames.push(key);
                }
              }

              var aliases = [];
              var state = helpers.state,
                  close = helpers.close,
                  focus = helpers.focus,
                  event = helpers.event,
                  onError = helpers.onError;

              for (var _i4 = 0; _i4 < propNames.length; _i4++) {
                var _key = propNames[_i4];
                var propDef = component.getPropDefinition(_key);
                var value = inputProps[_key];

                if (!propDef) {
                  continue;
                }

                var alias = propDef.alias;

                if (alias) {
                  if (!isDefined(value) && isDefined(inputProps[alias])) {
                    value = inputProps[alias];
                  }

                  aliases.push(alias);
                }

                if (propDef.value) {
                  value = propDef.value({
                    props: props,
                    state: state,
                    close: close,
                    focus: focus,
                    event: event,
                    onError: onError
                  });
                }

                if (!isDefined(value) && propDef.default) {
                  value = propDef.default({
                    props: props,
                    state: state,
                    close: close,
                    focus: focus,
                    event: event,
                    onError: onError
                  });
                }

                if (isDefined(value)) {
                  if (propDef.type === 'array' ? !Array.isArray(value) : typeof value !== propDef.type) {
                    throw new TypeError("Prop is not of type " + propDef.type + ": " + _key);
                  }
                } // $FlowFixMe


                props[_key] = value;
              }

              for (var _i6 = 0; _i6 < aliases.length; _i6++) {
                var _alias = aliases[_i6];
                delete props[_alias];
              } // $FlowFixMe


              for (var _i8 = 0, _Object$keys4 = Object.keys(props); _i8 < _Object$keys4.length; _i8++) {
                var _key2 = _Object$keys4[_i8];

                var _propDef = component.getPropDefinition(_key2);

                var _value = props[_key2];

                if (!_propDef) {
                  continue;
                }

                if (isDefined(_value) && _propDef.validate) {
                  // $FlowFixMe
                  _propDef.validate({
                    value: _value,
                    props: props
                  });
                }

                if (isDefined(_value) && _propDef.decorate) {
                  props[_key2] = _propDef.decorate({
                    value: _value,
                    props: props,
                    state: state,
                    close: close,
                    focus: focus,
                    event: event,
                    onError: onError
                  });
                }
              }

              for (var _i10 = 0, _component$getPropNam2 = component.getPropNames(); _i10 < _component$getPropNam2.length; _i10++) {
                var _key3 = _component$getPropNam2[_i10];

                var _propDef2 = component.getPropDefinition(_key3);

                if (_propDef2.required !== false && !isDefined(props[_key3])) {
                  throw new Error("Expected prop \"" + _key3 + "\" to be defined");
                }
              }
            } // $FlowFixMe

            function props_getQueryParam(prop, key, value) {
              return promise_ZalgoPromise.try(function () {
                if (typeof prop.queryParam === 'function') {
                  return prop.queryParam({
                    value: value
                  });
                } else if (typeof prop.queryParam === 'string') {
                  return prop.queryParam;
                } else {
                  return key;
                }
              });
            } // $FlowFixMe


            function getQueryValue(prop, key, value) {
              return promise_ZalgoPromise.try(function () {
                if (typeof prop.queryValue === 'function' && isDefined(value)) {
                  return prop.queryValue({
                    value: value
                  });
                } else {
                  return value;
                }
              });
            }

            function propsToQuery(propsDef, props) {
              var params = {}; // $FlowFixMe

              var keys = Object.keys(props);
              return promise_ZalgoPromise.all(keys.map(function (key) {
                var prop = propsDef[key];

                if (!prop) {
                  return; // eslint-disable-line array-callback-return
                }

                return promise_ZalgoPromise.resolve().then(function () {
                  var value = props[key];

                  if (!value) {
                    return;
                  }

                  if (!prop.queryParam) {
                    return;
                  }

                  return value;
                }).then(function (value) {
                  if (value === null || typeof value === 'undefined') {
                    return;
                  }

                  return promise_ZalgoPromise.all([props_getQueryParam(prop, key, value), getQueryValue(prop, key, value)]).then(function (_ref) {
                    var queryParam = _ref[0],
                        queryValue = _ref[1];
                    var result;

                    if (typeof queryValue === 'boolean') {
                      result = queryValue.toString();
                    } else if (typeof queryValue === 'string') {
                      result = queryValue.toString();
                    } else if (typeof queryValue === 'object' && queryValue !== null) {
                      if (prop.serialization === PROP_SERIALIZATION.JSON) {
                        result = JSON.stringify(queryValue);
                      } else if (prop.serialization === PROP_SERIALIZATION.BASE64) {
                        result = btoa(JSON.stringify(queryValue));
                      } else if (prop.serialization === PROP_SERIALIZATION.DOTIFY || !prop.serialization) {
                        result = dotify(queryValue, key);

                        for (var _i12 = 0, _Object$keys6 = Object.keys(result); _i12 < _Object$keys6.length; _i12++) {
                          var dotkey = _Object$keys6[_i12];
                          params[dotkey] = result[dotkey];
                        }

                        return;
                      }
                    } else if (typeof queryValue === 'number') {
                      result = queryValue.toString();
                    }

                    params[queryParam] = result;
                  });
                });
              })).then(function () {
                return params;
              });
            }
            // CONCATENATED MODULE: ./src/parent/index.js


            /* eslint max-lines: 0 */








            var parent_ParentComponent =
            /*#__PURE__*/
            function () {
              // eslint-disable-line flowtype/no-mutable-array
              function ParentComponent(component, props) {
                var _this = this;

                this.component = void 0;
                this.driver = void 0;
                this.clean = void 0;
                this.event = void 0;
                this.initPromise = void 0;
                this.handledErrors = void 0;
                this.props = void 0;
                this.state = void 0;
                this.child = void 0;
                this.proxyContainer = void 0;
                this.proxyWin = void 0;
                this.visible = true;
                this.initPromise = new promise_ZalgoPromise();
                this.handledErrors = []; // $FlowFixMe

                this.props = {};
                this.clean = cleanup(this);
                this.state = {};
                this.component = component;
                this.setupEvents(props.onError);
                this.setProps(props);
                this.component.registerActiveComponent(this);
                this.clean.register(function () {
                  return _this.component.destroyActiveComponent(_this);
                });
                this.watchForUnload();
              }

              var _proto = ParentComponent.prototype;

              _proto.setupEvents = function setupEvents(onError) {
                var _this2 = this;

                this.event = eventEmitter();
                this.event.on(EVENT.RENDER, function () {
                  return _this2.props.onRender();
                });
                this.event.on(EVENT.DISPLAY, function () {
                  return _this2.props.onDisplay();
                });
                this.event.on(EVENT.RENDERED, function () {
                  return _this2.props.onRendered();
                });
                this.event.on(EVENT.CLOSE, function () {
                  return _this2.props.onClose();
                });
                this.event.on(EVENT.RESIZE, function () {
                  return _this2.props.onResize();
                });
                this.event.on(EVENT.FOCUS, function () {
                  return _this2.props.onFocus();
                });
                this.event.on(EVENT.PROPS, function (props) {
                  return _this2.props.onProps(props);
                });
                this.event.on(EVENT.ERROR, function (err) {
                  if (_this2.props && _this2.props.onError) {
                    return _this2.props.onError(err);
                  } else if (onError) {
                    return onError(err);
                  } else {
                    return _this2.initPromise.reject(err).then(function () {
                      setTimeout(function () {
                        throw err;
                      }, 1);
                    });
                  }
                });
                this.clean.register(function () {
                  return _this2.event.reset();
                });
              };

              _proto.render = function render(target, container, context) {
                var _this3 = this;

                return promise_ZalgoPromise.try(function () {
                  _this3.component.log("render");

                  _this3.driver = RENDER_DRIVERS[context];
                  var uid = ZOID + "-" + _this3.component.tag + "-" + uniqueID();

                  var domain = _this3.getDomain();

                  var childDomain = _this3.getChildDomain();

                  _this3.component.checkAllowRender(target, domain, container);

                  if (target !== window) {
                    _this3.delegate(context, target);
                  }

                  var windowProp = _this3.props.window;
                  var init = _this3.initPromise;

                  var buildUrl = _this3.buildUrl();

                  var onRender = _this3.event.trigger(EVENT.RENDER);

                  var getProxyContainer = _this3.getProxyContainer(container);

                  var getProxyWindow = _this3.getProxyWindow();

                  var buildWindowName = getProxyWindow.then(function (proxyWin) {
                    return _this3.buildWindowName({
                      proxyWin: proxyWin,
                      childDomain: childDomain,
                      domain: domain,
                      target: target,
                      context: context,
                      uid: uid
                    });
                  });
                  var openFrame = buildWindowName.then(function (windowName) {
                    return _this3.openFrame({
                      windowName: windowName
                    });
                  });

                  var openPrerenderFrame = _this3.openPrerenderFrame();

                  var renderContainer = promise_ZalgoPromise.hash({
                    proxyContainer: getProxyContainer,
                    proxyFrame: openFrame,
                    proxyPrerenderFrame: openPrerenderFrame
                  }).then(function (_ref) {
                    var proxyContainer = _ref.proxyContainer,
                        proxyFrame = _ref.proxyFrame,
                        proxyPrerenderFrame = _ref.proxyPrerenderFrame;
                    return _this3.renderContainer(proxyContainer, {
                      context: context,
                      uid: uid,
                      proxyFrame: proxyFrame,
                      proxyPrerenderFrame: proxyPrerenderFrame,
                      visible: _this3.visible
                    });
                  }).then(function (proxyContainer) {
                    _this3.proxyContainer = proxyContainer;
                    return proxyContainer;
                  });
                  var open = promise_ZalgoPromise.hash({
                    windowName: buildWindowName,
                    proxyFrame: openFrame,
                    proxyWin: getProxyWindow
                  }).then(function (_ref2) {
                    var windowName = _ref2.windowName,
                        proxyWin = _ref2.proxyWin,
                        proxyFrame = _ref2.proxyFrame;
                    return windowProp ? proxyWin : _this3.open({
                      windowName: windowName,
                      proxyWin: proxyWin,
                      proxyFrame: proxyFrame
                    });
                  });
                  var openPrerender = promise_ZalgoPromise.hash({
                    proxyWin: open,
                    proxyPrerenderFrame: openPrerenderFrame
                  }).then(function (_ref3) {
                    var proxyWin = _ref3.proxyWin,
                        proxyPrerenderFrame = _ref3.proxyPrerenderFrame;
                    return _this3.openPrerender(proxyWin, proxyPrerenderFrame);
                  });
                  var setState = open.then(function (proxyWin) {
                    _this3.proxyWin = proxyWin;
                    return _this3.setProxyWin(proxyWin);
                  });
                  var prerender = promise_ZalgoPromise.hash({
                    proxyPrerenderWin: openPrerender,
                    state: setState
                  }).then(function (_ref4) {
                    var proxyPrerenderWin = _ref4.proxyPrerenderWin;
                    return _this3.prerender(proxyPrerenderWin, {
                      context: context,
                      uid: uid
                    });
                  });
                  var setWindowName = promise_ZalgoPromise.hash({
                    proxyWin: open,
                    windowName: buildWindowName
                  }).then(function (_ref5) {
                    var proxyWin = _ref5.proxyWin,
                        windowName = _ref5.windowName;

                    if (windowProp) {
                      return proxyWin.setName(windowName);
                    }
                  });
                  var loadUrl = promise_ZalgoPromise.hash({
                    proxyWin: open,
                    url: buildUrl,
                    windowName: setWindowName,
                    prerender: prerender
                  }).then(function (_ref6) {
                    var proxyWin = _ref6.proxyWin,
                        url = _ref6.url;
                    return proxyWin.setLocation(url);
                  });
                  var watchForClose = open.then(function (proxyWin) {
                    _this3.watchForClose(proxyWin);
                  });
                  var onDisplay = promise_ZalgoPromise.hash({
                    container: renderContainer,
                    prerender: prerender
                  }).then(function () {
                    return _this3.event.trigger(EVENT.DISPLAY);
                  });
                  var openBridge = open.then(function (proxyWin) {
                    return _this3.openBridge(proxyWin, childDomain, context);
                  });
                  var runTimeout = loadUrl.then(function () {
                    return _this3.runTimeout();
                  });
                  var onRendered = init.then(function () {
                    return _this3.event.trigger(EVENT.RENDERED);
                  });
                  return promise_ZalgoPromise.hash({
                    init: init,
                    buildUrl: buildUrl,
                    onRender: onRender,
                    getProxyContainer: getProxyContainer,
                    openFrame: openFrame,
                    openPrerenderFrame: openPrerenderFrame,
                    renderContainer: renderContainer,
                    open: open,
                    openPrerender: openPrerender,
                    setState: setState,
                    prerender: prerender,
                    loadUrl: loadUrl,
                    buildWindowName: buildWindowName,
                    setWindowName: setWindowName,
                    watchForClose: watchForClose,
                    onDisplay: onDisplay,
                    openBridge: openBridge,
                    runTimeout: runTimeout,
                    onRendered: onRendered
                  });
                }).catch(function (err) {
                  return promise_ZalgoPromise.all([_this3.onError(err), _this3.destroy(err)]).then(function () {
                    throw err;
                  }, function () {
                    throw err;
                  });
                }).then(src_util_noop);
              };

              _proto.getProxyWindow = function getProxyWindow() {
                var _this4 = this;

                return promise_ZalgoPromise.try(function () {
                  var windowProp = _this4.props.window;

                  if (windowProp) {
                    var proxyWin = setup_toProxyWindow(windowProp);

                    _this4.clean.register(function () {
                      return windowProp.close();
                    });

                    return proxyWin;
                  }

                  return new window_ProxyWindow({
                    send: send_send
                  });
                });
              };

              _proto.getProxyContainer = function getProxyContainer(container) {
                return promise_ZalgoPromise.try(function () {
                  return elementReady(container);
                }).then(function (containerElement) {
                  return getProxyObject(containerElement);
                });
              };

              _proto.buildWindowName = function buildWindowName(_ref7) {
                var proxyWin = _ref7.proxyWin,
                    childDomain = _ref7.childDomain,
                    domain = _ref7.domain,
                    target = _ref7.target,
                    uid = _ref7.uid,
                    context = _ref7.context;
                var childPayload = this.buildChildPayload({
                  proxyWin: proxyWin,
                  childDomain: childDomain,
                  domain: domain,
                  target: target,
                  context: context,
                  uid: uid
                });
                return "__" + ZOID + "__" + this.component.name + "__" + base64encode(JSON.stringify(childPayload)) + "__";
              };

              _proto.getPropsRef = function getPropsRef(proxyWin, childDomain, domain, uid) {
                var value = setup_serializeMessage(proxyWin, domain, this.getPropsForChild(domain));
                var propRef = childDomain === utils_getDomain() ? {
                  type: INITIAL_PROPS.UID,
                  uid: uid
                } : {
                  type: INITIAL_PROPS.RAW,
                  value: value
                };

                if (propRef.type === INITIAL_PROPS.UID) {
                  var global = lib_global_getGlobal(window);
                  global.props = global.props || {};
                  global.props[uid] = value;
                  this.clean.register(function () {
                    delete global.props[uid];
                  });
                }

                return propRef;
              };

              _proto.buildChildPayload = function buildChildPayload(_temp) {
                var _ref8 = _temp === void 0 ? {} : _temp,
                    proxyWin = _ref8.proxyWin,
                    childDomain = _ref8.childDomain,
                    domain = _ref8.domain,
                    _ref8$target = _ref8.target,
                    target = _ref8$target === void 0 ? window : _ref8$target,
                    context = _ref8.context,
                    uid = _ref8.uid;

                return {
                  uid: uid,
                  context: context,
                  version: "9_0_36",
                  childDomain: childDomain,
                  parentDomain: utils_getDomain(window),
                  tag: this.component.tag,
                  parent: this.getWindowRef(target, childDomain, uid, context),
                  props: this.getPropsRef(proxyWin, childDomain, domain, uid),
                  exports: setup_serializeMessage(proxyWin, domain, this.buildParentExports(proxyWin))
                };
              };

              _proto.setProxyWin = function setProxyWin(proxyWin) {
                var _this5 = this;

                return promise_ZalgoPromise.try(function () {
                  _this5.proxyWin = proxyWin;
                });
              };

              _proto.getHelpers = function getHelpers() {
                var _this6 = this;

                return {
                  state: this.state,
                  event: this.event,
                  close: function close() {
                    return _this6.close();
                  },
                  focus: function focus() {
                    return _this6.focus();
                  },
                  resize: function resize(_ref9) {
                    var width = _ref9.width,
                        height = _ref9.height;
                    return _this6.resize({
                      width: width,
                      height: height
                    });
                  },
                  onError: function onError(err) {
                    return _this6.onError(err);
                  },
                  updateProps: function updateProps(props) {
                    return _this6.updateProps(props);
                  },
                  show: function show() {
                    return _this6.show();
                  },
                  hide: function hide() {
                    return _this6.hide();
                  }
                };
              };

              _proto.show = function show() {
                var _this7 = this;

                return promise_ZalgoPromise.try(function () {
                  _this7.visible = true;

                  if (_this7.proxyContainer) {
                    return _this7.proxyContainer.get().then(showElement);
                  }
                });
              };

              _proto.hide = function hide() {
                var _this8 = this;

                return promise_ZalgoPromise.try(function () {
                  _this8.visible = false;

                  if (_this8.proxyContainer) {
                    return _this8.proxyContainer.get().then(hideElement);
                  }
                });
              };

              _proto.setProps = function setProps(props, isUpdate) {
                if (isUpdate === void 0) {
                  isUpdate = false;
                }

                if (this.component.validate) {
                  this.component.validate({
                    props: props
                  });
                }

                var helpers = this.getHelpers();
                extendProps(this.component, this.props, props, helpers, isUpdate);
              };

              _proto.buildUrl = function buildUrl() {
                var _this9 = this;

                return propsToQuery(_extends({}, this.component.props, {}, this.component.builtinProps), this.props).then(function (query) {
                  return extendUrl(normalizeMockUrl(_this9.component.getUrl(_this9.props)), {
                    query: query
                  });
                });
              };

              _proto.getDomain = function getDomain() {
                return this.component.getDomain(this.props);
              };

              _proto.getChildDomain = function getChildDomain() {
                return this.component.getChildDomain(this.props);
              };

              _proto.getPropsForChild = function getPropsForChild(domain) {
                var result = {};

                for (var _i2 = 0, _Object$keys2 = Object.keys(this.props); _i2 < _Object$keys2.length; _i2++) {
                  var key = _Object$keys2[_i2];
                  var prop = this.component.getPropDefinition(key);

                  if (prop && prop.sendToChild === false) {
                    continue;
                  }

                  if (prop && prop.sameDomain && !matchDomain(domain, utils_getDomain(window))) {
                    continue;
                  }

                  result[key] = this.props[key];
                } // $FlowFixMe


                return result;
              };

              _proto.updateProps = function updateProps(props) {
                var _this10 = this;

                this.setProps(props, true);
                return this.initPromise.then(function () {
                  if (_this10.child) {
                    return _this10.child.updateProps(_this10.getPropsForChild(_this10.getDomain())).catch(function (err) {
                      if (!_this10.child || !_this10.proxyWin) {
                        return;
                      }

                      return _this10.checkClose(_this10.proxyWin).then(function () {
                        if (_this10.child) {
                          throw err;
                        }
                      });
                    });
                  }
                });
              };

              _proto.openFrame = function openFrame(_ref10) {
                var _this11 = this;

                var windowName = _ref10.windowName;
                return promise_ZalgoPromise.try(function () {
                  if (_this11.driver.openFrame) {
                    return _this11.driver.openFrame.call(_this11, {
                      windowName: windowName
                    });
                  }
                });
              };

              _proto.openPrerenderFrame = function openPrerenderFrame() {
                var _this12 = this;

                return promise_ZalgoPromise.try(function () {
                  if (_this12.driver.openPrerenderFrame) {
                    return _this12.driver.openPrerenderFrame.call(_this12);
                  }
                });
              };

              _proto.open = function open(_ref11) {
                var _this13 = this;

                var proxyWin = _ref11.proxyWin,
                    proxyFrame = _ref11.proxyFrame,
                    windowName = _ref11.windowName;
                return promise_ZalgoPromise.try(function () {
                  _this13.component.log("open");

                  return _this13.driver.open.call(_this13, {
                    windowName: windowName,
                    proxyFrame: proxyFrame
                  }).then(function (win) {
                    proxyWin.setWindow(win, {
                      send: send_send
                    });
                    return proxyWin;
                  });
                });
              };

              _proto.openPrerender = function openPrerender(proxyWin, proxyPrerenderFrame) {
                var _this14 = this;

                return promise_ZalgoPromise.try(function () {
                  return _this14.driver.openPrerender.call(_this14, proxyWin, proxyPrerenderFrame);
                });
              };

              _proto.focus = function focus() {
                var _this15 = this;

                return promise_ZalgoPromise.try(function () {
                  var proxyWin = _this15.proxyWin;

                  if (proxyWin) {
                    _this15.event.trigger(EVENT.FOCUS);

                    return proxyWin.focus().then(src_util_noop);
                  }
                });
              };

              _proto.delegate = function delegate(context, target) {
                var _this16 = this;

                this.component.log("delegate");
                var props = {};

                for (var _i4 = 0, _this$component$getPr2 = this.component.getPropNames(); _i4 < _this$component$getPr2.length; _i4++) {
                  var propName = _this$component$getPr2[_i4];

                  if (this.component.getPropDefinition(propName).allowDelegate) {
                    props[propName] = this.props[propName];
                  }
                }

                var overridesPromise = send_send(target, POST_MESSAGE.DELEGATE + "_" + this.component.name, {
                  context: context,
                  props: props,
                  overrides: {
                    event: this.event,
                    close: function close() {
                      return _this16.close();
                    },
                    onError: function onError(err) {
                      return _this16.onError(err);
                    }
                  }
                }).then(function (_ref12) {
                  var data = _ref12.data;

                  _this16.clean.register(data.destroy);

                  return data.overrides;
                }).catch(function (err) {
                  throw new Error("Unable to delegate rendering. Possibly the component is not loaded in the target window.\n\n" + stringifyError(err));
                });

                var _loop = function _loop(_i6, _this$driver$delegate2) {
                  var key = _this$driver$delegate2[_i6];

                  // $FlowFixMe
                  _this16[key] = function overriddenFunction() {
                    var _arguments = arguments,
                        _this17 = this;

                    return overridesPromise.then(function (overrides) {
                      return overrides[key].apply(_this17, _arguments);
                    });
                  };
                };

                for (var _i6 = 0, _this$driver$delegate2 = this.driver.delegate; _i6 < _this$driver$delegate2.length; _i6++) {
                  _loop(_i6, _this$driver$delegate2);
                }
              };

              _proto.getWindowRef = function getWindowRef(target, domain, uid, context) {
                if (domain === utils_getDomain(window)) {
                  var global = lib_global_getGlobal(window);
                  global.windows = global.windows || {};
                  global.windows[uid] = window;
                  this.clean.register(function () {
                    delete global.windows[uid];
                  });
                  return {
                    type: WINDOW_REFERENCES.GLOBAL,
                    uid: uid
                  };
                }

                if (context === CONTEXT.POPUP) {
                  return {
                    type: WINDOW_REFERENCES.OPENER
                  };
                }

                return {
                  type: WINDOW_REFERENCES.PARENT,
                  distance: getDistanceFromTop(window)
                };
              };

              _proto.watchForClose = function watchForClose(proxyWin) {
                var _this18 = this;

                var cancelled = false;
                this.clean.register(function () {
                  cancelled = true;
                });
                return promise_ZalgoPromise.delay(2000).then(function () {
                  return proxyWin.isClosed();
                }).then(function (isClosed) {
                  if (isClosed) {
                    _this18.component.log("detect_close_child");

                    return _this18.close();
                  } else if (!cancelled) {
                    return _this18.watchForClose(proxyWin);
                  }
                });
              };

              _proto.watchForUnload = function watchForUnload() {
                var _this19 = this;

                var unloadWindowListener = addEventListener(window, 'unload', once(function () {
                  _this19.component.log("navigate_away");

                  _this19.destroy(new Error("Window navigated away"));
                }));
                this.clean.register(unloadWindowListener.cancel);
              };

              _proto.runTimeout = function runTimeout() {
                var _this20 = this;

                return promise_ZalgoPromise.try(function () {
                  var timeout = _this20.props.timeout;

                  if (timeout) {
                    return _this20.initPromise.timeout(timeout, new Error("Loading component timed out after " + timeout + " milliseconds"));
                  }
                });
              };

              _proto.initChild = function initChild(child) {
                var _this21 = this;

                return promise_ZalgoPromise.try(function () {
                  _this21.clean.set('child', child);

                  _this21.initPromise.resolve();
                });
              };

              _proto.buildParentExports = function buildParentExports(win) {
                var _this22 = this;

                var onError = function onError(err) {
                  return _this22.onError(err);
                };

                var init = function init(child) {
                  return _this22.initChild(child);
                };

                var close = function close() {
                  return _this22.close();
                };

                var checkClose = function checkClose() {
                  return _this22.checkClose(win);
                };

                var resize = function resize(_ref13) {
                  var width = _ref13.width,
                      height = _ref13.height;
                  return _this22.resize({
                    width: width,
                    height: height
                  });
                };

                var show = function show() {
                  return _this22.show();
                };

                var hide = function hide() {
                  return _this22.hide();
                };

                init.onError = onError;
                return {
                  init: init,
                  close: close,
                  checkClose: checkClose,
                  resize: resize,
                  onError: onError,
                  show: show,
                  hide: hide
                };
              };

              _proto.resize = function resize(_ref14) {
                var _this23 = this;

                var width = _ref14.width,
                    height = _ref14.height;
                return promise_ZalgoPromise.try(function () {
                  _this23.event.trigger(EVENT.RESIZE, {
                    width: width,
                    height: height
                  });
                });
              };

              _proto.checkClose = function checkClose(win) {
                var _this24 = this;

                return win.isClosed().then(function (closed) {
                  if (closed) {
                    return _this24.close();
                  }

                  return promise_ZalgoPromise.delay(200).then(function () {
                    return win.isClosed();
                  }).then(function (secondClosed) {
                    if (secondClosed) {
                      return _this24.close();
                    }
                  });
                });
              };

              _proto.close = function close() {
                var _this25 = this;

                return promise_ZalgoPromise.try(function () {
                  _this25.component.log("close");

                  return _this25.event.trigger(EVENT.CLOSE);
                }).then(function () {
                  if (_this25.child) {
                    _this25.child.close.fireAndForget().catch(src_util_noop);
                  }

                  return _this25.destroy(new Error("Window closed"));
                });
              };

              _proto.prerender = function prerender(proxyPrerenderWin, _ref15) {
                var _this26 = this;

                var context = _ref15.context,
                    uid = _ref15.uid;
                return promise_ZalgoPromise.try(function () {
                  var prerenderTemplate = _this26.component.prerenderTemplate;

                  if (!prerenderTemplate) {
                    return;
                  }

                  var prerenderWindow = proxyPrerenderWin.getWindow();

                  if (!prerenderWindow || !isSameDomain(prerenderWindow) || !isBlankDomain(prerenderWindow)) {
                    return;
                  }

                  prerenderWindow = assertSameDomain(prerenderWindow);
                  var doc = prerenderWindow.document;

                  var el = _this26.renderTemplate(prerenderTemplate, {
                    context: context,
                    uid: uid,
                    doc: doc
                  });

                  if (!el) {
                    return;
                  }

                  if (el.ownerDocument !== doc) {
                    throw new Error("Expected prerender template to have been created with document from child window");
                  }

                  writeElementToWindow(prerenderWindow, el);

                  var _ref16 = _this26.component.autoResize || {},
                      _ref16$width = _ref16.width,
                      width = _ref16$width === void 0 ? false : _ref16$width,
                      _ref16$height = _ref16.height,
                      height = _ref16$height === void 0 ? false : _ref16$height,
                      _ref16$element = _ref16.element,
                      element = _ref16$element === void 0 ? 'body' : _ref16$element;

                  element = getElementSafe(element, doc);

                  if (element && (width || height)) {
                    onResize(element, function (_ref17) {
                      var newWidth = _ref17.width,
                          newHeight = _ref17.height;

                      _this26.resize({
                        width: width ? newWidth : undefined,
                        height: height ? newHeight : undefined
                      });
                    }, {
                      width: width,
                      height: height,
                      win: prerenderWindow
                    });
                  }
                });
              };

              _proto.renderTemplate = function renderTemplate(renderer, _ref18) {
                var _this27 = this;

                var context = _ref18.context,
                    uid = _ref18.uid,
                    container = _ref18.container,
                    doc = _ref18.doc,
                    frame = _ref18.frame,
                    prerenderFrame = _ref18.prerenderFrame;
                // $FlowFixMe
                return renderer.call(this, {
                  container: container,
                  context: context,
                  uid: uid,
                  doc: doc,
                  frame: frame,
                  prerenderFrame: prerenderFrame,
                  focus: function focus() {
                    return _this27.focus();
                  },
                  close: function close() {
                    return _this27.close();
                  },
                  state: this.state,
                  props: this.props,
                  tag: this.component.tag,
                  dimensions: this.component.dimensions,
                  event: this.event
                });
              };

              _proto.renderContainer = function renderContainer(proxyContainer, _ref19) {
                var _this28 = this;

                var proxyFrame = _ref19.proxyFrame,
                    proxyPrerenderFrame = _ref19.proxyPrerenderFrame,
                    context = _ref19.context,
                    uid = _ref19.uid,
                    visible = _ref19.visible;
                return promise_ZalgoPromise.hash({
                  container: proxyContainer.get().then(elementReady),
                  // $FlowFixMe
                  frame: proxyFrame ? proxyFrame.get() : null,
                  // $FlowFixMe
                  prerenderFrame: proxyPrerenderFrame ? proxyPrerenderFrame.get() : null
                }).then(function (_ref20) {
                  var container = _ref20.container,
                      frame = _ref20.frame,
                      prerenderFrame = _ref20.prerenderFrame;

                  var innerContainer = _this28.renderTemplate(_this28.component.containerTemplate, {
                    context: context,
                    uid: uid,
                    container: container,
                    frame: frame,
                    prerenderFrame: prerenderFrame,
                    doc: document
                  });

                  if (innerContainer) {
                    if (!visible) {
                      hideElement(innerContainer);
                    }

                    appendChild(container, innerContainer);

                    _this28.clean.register(function () {
                      return destroyElement(innerContainer);
                    });

                    _this28.proxyContainer = getProxyObject(innerContainer);
                    return getProxyObject(innerContainer);
                  }
                });
              };

              _proto.destroy = function destroy(err) {
                var _this29 = this;

                return promise_ZalgoPromise.try(function () {
                  return _this29.clean.all();
                }).then(function () {
                  _this29.initPromise.asyncReject(err || new Error('Component destroyed'));

                  _this29.component.log("destroy");
                });
              };

              _proto.onError = function onError(err) {
                var _this30 = this;

                return promise_ZalgoPromise.try(function () {
                  if (_this30.handledErrors.indexOf(err) !== -1) {
                    return;
                  }

                  _this30.handledErrors.push(err);

                  _this30.initPromise.asyncReject(err);

                  return _this30.event.trigger(EVENT.ERROR, err);
                });
              };

              _proto.openBridge = function openBridge(proxyWin, domain, context) {
                var _this31 = this;

                {
                  return promise_ZalgoPromise.try(function () {
                    return proxyWin.awaitWindow();
                  }).then(function (win) {
                    if (!src_bridge || !src_bridge.needsBridge({
                      win: win,
                      domain: domain
                    }) || src_bridge.hasBridge(domain, domain)) {
                      return;
                    }

                    var bridgeUrl = _this31.component.getBridgeUrl();

                    if (!bridgeUrl) {
                      throw new Error("Bridge needed to render " + context);
                    }

                    var bridgeDomain = getDomainFromUrl(bridgeUrl);
                    src_bridge.linkUrl(win, domain);
                    return src_bridge.openBridge(normalizeMockUrl(bridgeUrl), bridgeDomain);
                  });
                }
              };

              return ParentComponent;
            }();
            // CONCATENATED MODULE: ./src/delegate/index.js






            var delegate_DelegateComponent =
            /*#__PURE__*/
            function () {
              function DelegateComponent(component, source, options) {
                var _this = this;

                this.component = void 0;
                this.source = void 0;
                this.context = void 0;
                this.driver = void 0;
                this.props = void 0;
                this.clean = void 0;
                this.focus = void 0;
                this.resize = void 0;
                this.renderTemplate = void 0;
                this.close = void 0;
                this.onError = void 0;
                this.event = void 0;
                this.component = component;
                this.context = options.context;
                this.driver = RENDER_DRIVERS[options.context];
                this.clean = cleanup(this);
                this.focus = parent_ParentComponent.prototype.focus;
                this.resize = parent_ParentComponent.prototype.resize;
                this.renderTemplate = parent_ParentComponent.prototype.renderTemplate; // $FlowFixMe

                this.props = {};

                for (var _i2 = 0, _Object$keys2 = Object.keys(options.props); _i2 < _Object$keys2.length; _i2++) {
                  var propName = _Object$keys2[_i2];
                  var propDef = this.component.getPropDefinition(propName);

                  if (propDef && propDef.allowDelegate && options.props[propName]) {
                    // $FlowFixMe
                    this.props[propName] = options.props[propName];
                  }
                }

                this.close = options.overrides.close;
                this.onError = options.overrides.onError;
                this.event = options.overrides.event;
                this.component.registerActiveComponent(this);
                this.clean.register(function () {
                  return _this.component.destroyActiveComponent(_this);
                });
                this.watchForSourceClose(source);
              }

              var _proto = DelegateComponent.prototype;

              _proto.getDelegate = function getDelegate() {
                var _this2 = this;

                return {
                  overrides: this.getOverrides(),
                  destroy: function destroy() {
                    return _this2.destroy();
                  }
                };
              };

              _proto.watchForSourceClose = function watchForSourceClose(source) {
                var _this3 = this;

                var closeSourceWindowListener = onCloseWindow(source, function () {
                  return _this3.destroy();
                }, 3000);
                this.clean.register(closeSourceWindowListener.cancel);
              };

              _proto.getOverrides = function getOverrides() {
                var overrides = {};
                var self = this;

                var _loop = function _loop(_i4, _this$driver$delegate2) {
                  var key = _this$driver$delegate2[_i4];

                  overrides[key] = function delegateOverride() {
                    // $FlowFixMe
                    return parent_ParentComponent.prototype[key].apply(self, arguments);
                  };

                  overrides[key].__name__ = key;
                };

                for (var _i4 = 0, _this$driver$delegate2 = this.driver.delegate; _i4 < _this$driver$delegate2.length; _i4++) {
                  _loop(_i4, _this$driver$delegate2);
                }

                return overrides;
              };

              _proto.destroy = function destroy() {
                return this.clean.all();
              };

              return DelegateComponent;
            }();
            // CONCATENATED MODULE: ./src/drivers/index.js




            // CONCATENATED MODULE: ./src/component/validate.js



            function validatePropDefinitions(options) {
              if (options.props && !(typeof options.props === 'object')) {
                throw new Error("Expected options.props to be an object");
              }

              var PROP_TYPE_LIST = util_values(PROP_TYPE);

              if (options.props) {
                for (var _i2 = 0, _Object$keys2 = Object.keys(options.props); _i2 < _Object$keys2.length; _i2++) {
                  var key = _Object$keys2[_i2];
                  var prop = options.props[key];

                  if (!prop || !(typeof prop === 'object')) {
                    throw new Error("Expected options.props." + key + " to be an object");
                  }

                  if (!prop.type) {
                    throw new Error("Expected prop.type");
                  }

                  if (PROP_TYPE_LIST.indexOf(prop.type) === -1) {
                    throw new Error("Expected prop.type to be one of " + PROP_TYPE_LIST.join(', '));
                  }

                  if (prop.required && prop.default) {
                    throw new Error("Required prop can not have a default value");
                  }

                  if (prop.type === PROP_TYPE.FUNCTION && prop.queryParam && !prop.queryValue) {
                    throw new Error("Do not pass queryParam for function prop");
                  }
                }
              }
            } // eslint-disable-next-line complexity


            function validate_validate(options) {
              // eslint-ignore-line
              if (!options) {
                throw new Error("Expected options to be passed");
              } // eslint-disable-next-line security/detect-unsafe-regex, unicorn/no-unsafe-regex


              if (!options.tag || !options.tag.match(/^([a-z0-9][a-z0-9-]*)+[a-z0-9]+$/)) {
                throw new Error("Invalid options.tag: " + options.tag);
              }

              validatePropDefinitions(options);

              if (options.dimensions) {
                if (options.dimensions && !isPx(options.dimensions.width) && !isPerc(options.dimensions.width)) {
                  throw new Error("Expected options.dimensions.width to be a px or % string value");
                }

                if (options.dimensions && !isPx(options.dimensions.height) && !isPerc(options.dimensions.height)) {
                  throw new Error("Expected options.dimensions.height to be a px or % string value");
                }
              }

              if (options.defaultContext) {
                if (options.defaultContext !== CONTEXT.IFRAME && options.defaultContext !== CONTEXT.POPUP) {
                  throw new Error("Unsupported context type: " + (options.defaultContext || 'unknown'));
                }
              }

              if (!options.url) {
                throw new Error("Must pass url");
              }

              if (typeof options.url !== 'string' && typeof options.url !== 'function') {
                throw new TypeError("Expected url to be string or function");
              }

              if (options.prerenderTemplate && typeof options.prerenderTemplate !== 'function') {
                throw new Error("Expected options.prerenderTemplate to be a function");
              }

              if ((options.containerTemplate || !true) && typeof options.containerTemplate !== 'function') {
                throw new Error("Expected options.containerTemplate to be a function");
              }
            }
            // CONCATENATED MODULE: ./src/component/templates/container.js
            /* eslint react/react-in-jsx-scope: off */


            var CLASS = {
              VISIBLE: 'visible',
              INVISIBLE: 'invisible'
            };
            function defaultContainerTemplate(_ref) {
              var uid = _ref.uid,
                  frame = _ref.frame,
                  prerenderFrame = _ref.prerenderFrame,
                  doc = _ref.doc,
                  props = _ref.props,
                  event = _ref.event,
                  _ref$dimensions = _ref.dimensions,
                  width = _ref$dimensions.width,
                  height = _ref$dimensions.height;

              {
                if (!frame || !prerenderFrame) {
                  return;
                }

                var div = doc.createElement('div');
                div.setAttribute('id', uid);
                var style = doc.createElement('style');

                if (props.cspNonce) {
                  style.setAttribute('nonce', props.cspNonce);
                }

                style.appendChild(doc.createTextNode("\n            #" + uid + " {\n                display: inline-block;\n                position: relative;\n                width: " + width + ";\n                height: " + height + ";\n            }\n\n            #" + uid + " > iframe {\n                display: inline-block;\n                position: absolute;\n                width: 100%;\n                height: 100%;\n                top: 0;\n                left: 0;\n                transition: opacity .2s ease-in-out;\n            }\n\n            #" + uid + " > iframe." + CLASS.INVISIBLE + " {\n                opacity: 0;\n            }\n\n            #" + uid + " > iframe." + CLASS.VISIBLE + " {\n                opacity: 1;\n        }\n        "));
                div.appendChild(frame);
                div.appendChild(prerenderFrame);
                div.appendChild(style);
                prerenderFrame.classList.add(CLASS.VISIBLE);
                frame.classList.add(CLASS.INVISIBLE);
                event.on(EVENT.RENDERED, function () {
                  prerenderFrame.classList.remove(CLASS.VISIBLE);
                  prerenderFrame.classList.add(CLASS.INVISIBLE);
                  frame.classList.remove(CLASS.INVISIBLE);
                  frame.classList.add(CLASS.VISIBLE);
                  setTimeout(function () {
                    destroyElement(prerenderFrame);
                  }, 1);
                });
                event.on(EVENT.RESIZE, function (_ref2) {
                  var newWidth = _ref2.width,
                      newHeight = _ref2.height;

                  if (typeof newWidth === 'number') {
                    div.style.width = toCSS(newWidth);
                  }

                  if (typeof newHeight === 'number') {
                    div.style.height = toCSS(newHeight);
                  }
                });
                return div;
              }
            }
            // CONCATENATED MODULE: ./src/component/templates/component.js
            /* eslint react/react-in-jsx-scope: off */
            function defaultPrerenderTemplate(_ref) {
              var doc = _ref.doc,
                  props = _ref.props;

              {
                var html = doc.createElement('html');
                var body = doc.createElement('body');
                var style = doc.createElement('style');
                var spinner = doc.createElement('div');
                spinner.classList.add('spinner');

                if (props.cspNonce) {
                  style.setAttribute('nonce', props.cspNonce);
                }

                html.appendChild(body);
                body.appendChild(spinner);
                body.appendChild(style);
                style.appendChild(doc.createTextNode("\n            html, body {\n                width: 100%;\n                height: 100%;\n            }\n\n            .spinner {\n                position: fixed;\n                max-height: 60vmin;\n                max-width: 60vmin;\n                height: 40px;\n                width: 40px;\n                top: 50%;\n                left: 50%;\n                box-sizing: border-box;\n                border: 3px solid rgba(0, 0, 0, .2);\n                border-top-color: rgba(33, 128, 192, 0.8);\n                border-radius: 100%;\n                animation: rotation .7s infinite linear;\n            }\n\n            @keyframes rotation {\n                from {\n                    transform: translateX(-50%) translateY(-50%) rotate(0deg);\n                }\n                to {\n                    transform: translateX(-50%) translateY(-50%) rotate(359deg);\n                }\n            }\n        "));
                return html;
              }
            }
            // CONCATENATED MODULE: ./src/component/templates/index.js


            // CONCATENATED MODULE: ./src/component/props.js






            var props_defaultNoop = function defaultNoop() {
              return src_util_noop;
            };

            var props_decorateOnce = function decorateOnce(_ref) {
              var value = _ref.value;
              return once(value);
            };

            function getBuiltInProps() {
              return {
                window: {
                  type: 'object',
                  sendToChild: false,
                  required: false,
                  allowDelegate: true,
                  validate: function validate(_ref2) {
                    var value = _ref2.value;

                    if (!isWindow(value) && !window_ProxyWindow.isProxyWindow(value)) {
                      throw new Error("Expected Window or ProxyWindow");
                    }

                    if (isWindow(value)) {
                      // $FlowFixMe
                      if (isWindowClosed(value)) {
                        throw new Error("Window is closed");
                      } // $FlowFixMe


                      if (!isSameDomain(value)) {
                        throw new Error("Window is not same domain");
                      }
                    }
                  },
                  decorate: function decorate(_ref3) {
                    var value = _ref3.value;
                    return setup_toProxyWindow(value);
                  }
                },
                timeout: {
                  type: 'number',
                  required: false,
                  sendToChild: false
                },
                close: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref4) {
                    var close = _ref4.close;
                    return close;
                  }
                },
                focus: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref5) {
                    var focus = _ref5.focus;
                    return focus;
                  }
                },
                resize: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref6) {
                    var resize = _ref6.resize;
                    return resize;
                  }
                },
                cspNonce: {
                  type: 'string',
                  required: false
                },
                getParent: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref7) {
                    var getParent = _ref7.getParent;
                    return getParent;
                  }
                },
                getParentDomain: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref8) {
                    var getParentDomain = _ref8.getParentDomain;
                    return getParentDomain;
                  }
                },
                show: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref9) {
                    var show = _ref9.show;
                    return show;
                  }
                },
                hide: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref10) {
                    var hide = _ref10.hide;
                    return hide;
                  }
                },
                onDisplay: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  allowDelegate: true,
                  default: props_defaultNoop,
                  decorate: props_decorateOnce
                },
                onRendered: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  default: props_defaultNoop,
                  decorate: props_decorateOnce
                },
                onRender: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  default: props_defaultNoop,
                  decorate: props_decorateOnce
                },
                onClose: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  allowDelegate: true,
                  default: props_defaultNoop,
                  decorate: props_decorateOnce
                },
                onResize: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  allowDelegate: true,
                  default: props_defaultNoop
                },
                onFocus: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  allowDelegate: true,
                  default: props_defaultNoop
                },
                onError: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  childDecorate: function childDecorate(_ref11) {
                    var onError = _ref11.onError;
                    return onError;
                  }
                },
                onProps: {
                  type: 'function',
                  required: false,
                  sendToChild: false,
                  default: props_defaultNoop,
                  childDecorate: function childDecorate(_ref12) {
                    var onProps = _ref12.onProps;
                    return onProps;
                  }
                }
              };
            }
            // CONCATENATED MODULE: ./src/component/component.js


            /* eslint max-lines: 0 */













            var component_Component =
            /*#__PURE__*/
            function () {
              function Component(options) {
                this.tag = void 0;
                this.name = void 0;
                this.url = void 0;
                this.domain = void 0;
                this.bridgeUrl = void 0;
                this.props = void 0;
                this.builtinProps = void 0;
                this.dimensions = void 0;
                this.autoResize = void 0;
                this.allowedParentDomains = void 0;
                this.defaultContext = void 0;
                this.attributes = void 0;
                this.containerTemplate = void 0;
                this.prerenderTemplate = void 0;
                this.validate = void 0;
                this.driverCache = void 0;
                this.xprops = void 0;
                this.logger = void 0;
                this.propNames = void 0;
                validate_validate(options); // The tag name of the component. Used by some drivers (e.g. angular) to turn the component into an html element,
                // e.g. <my-component>

                this.tag = options.tag;
                this.name = this.tag.replace(/-/g, '_');
                this.allowedParentDomains = options.allowedParentDomains || src_constants_WILDCARD;
                var global = lib_global_getGlobal();
                global.components = global.components || {};

                if (global.components[this.tag]) {
                  throw new Error("Can not register multiple components with the same tag: " + this.tag);
                } // A json based spec describing what kind of props the component accepts. This is used to validate any props before
                // they are passed down to the child.


                this.builtinProps = getBuiltInProps();
                this.props = options.props || {}; // The dimensions of the component, e.g. { width: '300px', height: '150px' }

                var _ref = options.dimensions || {},
                    _ref$width = _ref.width,
                    width = _ref$width === void 0 ? DEFAULT_DIMENSIONS.WIDTH : _ref$width,
                    _ref$height = _ref.height,
                    height = _ref$height === void 0 ? DEFAULT_DIMENSIONS.HEIGHT : _ref$height;

                this.dimensions = {
                  width: width,
                  height: height
                };
                this.url = options.url;
                this.domain = options.domain;
                this.bridgeUrl = options.bridgeUrl;
                this.attributes = options.attributes || {};
                this.attributes.iframe = this.attributes.iframe || {};
                this.attributes.popup = this.attributes.popup || {};
                this.defaultContext = options.defaultContext || CONTEXT.IFRAME;
                this.autoResize = options.autoResize;

                if (options.containerTemplate) {
                  this.containerTemplate = options.containerTemplate;
                } else {
                  this.containerTemplate = defaultContainerTemplate;
                }

                if (options.prerenderTemplate) {
                  this.prerenderTemplate = options.prerenderTemplate;
                } else {
                  this.prerenderTemplate = defaultPrerenderTemplate;
                }

                this.validate = options.validate;
                this.logger = options.logger || {
                  debug: src_util_noop,
                  info: src_util_noop,
                  warn: src_util_noop,
                  error: src_util_noop
                };
                this.registerChild();
                this.listenDelegate();
                global.components[this.tag] = this;
              }

              var _proto = Component.prototype;

              _proto.getPropNames = function getPropNames() {
                if (this.propNames) {
                  return this.propNames;
                }

                var propNames = Object.keys(this.props);

                for (var _i2 = 0, _Object$keys2 = Object.keys(this.builtinProps); _i2 < _Object$keys2.length; _i2++) {
                  var key = _Object$keys2[_i2];

                  if (propNames.indexOf(key) === -1) {
                    propNames.push(key);
                  }
                }

                this.propNames = propNames;
                return propNames;
              };

              _proto.getPropDefinition = function getPropDefinition(name) {
                return this.props[name] || this.builtinProps[name];
              };

              _proto.driver = function driver(name, dep) {
                {
                  throw new Error("Driver support not enabled");
                }
              };

              _proto.registerChild = function registerChild() {
                if (this.isChild()) {
                  if (window.xprops) {
                    throw new Error("Can not register " + this.name + " as child - can not attach multiple components to the same window");
                  }

                  var child = new child_ChildComponent(this);
                  window.xprops = this.xprops = child.getProps();
                }
              };

              _proto.listenDelegate = function listenDelegate() {
                var _this = this;

                on_on(POST_MESSAGE.ALLOW_DELEGATE + "_" + this.name, function () {
                  return true;
                });
                on_on(POST_MESSAGE.DELEGATE + "_" + this.name, function (_ref2) {
                  var source = _ref2.source,
                      _ref2$data = _ref2.data,
                      context = _ref2$data.context,
                      props = _ref2$data.props,
                      overrides = _ref2$data.overrides;
                  var delegate = new delegate_DelegateComponent(_this, source, {
                    context: context,
                    props: props,
                    overrides: overrides
                  });
                  return delegate.getDelegate();
                });
              };

              _proto.canRenderTo = function canRenderTo(win) {
                return send_send(win, POST_MESSAGE.ALLOW_DELEGATE + "_" + this.name).then(function (_ref3) {
                  var data = _ref3.data;
                  return data;
                }).catch(function () {
                  return false;
                });
              };

              _proto.getUrl = function getUrl(props) {
                if (typeof this.url === 'function') {
                  return this.url({
                    props: props
                  });
                }

                return this.url;
              };

              _proto.getChildDomain = function getChildDomain(props) {
                if (this.domain && typeof this.domain === 'string') {
                  return this.domain;
                }

                return getDomainFromUrl(this.getUrl(props));
              };

              _proto.getDomain = function getDomain(props) {
                if (this.domain && util_isRegex(this.domain)) {
                  return this.domain;
                }

                return this.getChildDomain(props);
              };

              _proto.getBridgeUrl = function getBridgeUrl() {
                if (this.bridgeUrl) {
                  return this.bridgeUrl;
                }
              };

              _proto.isChild = function isChild() {
                var payload = getChildPayload();
                return Boolean(payload && payload.tag === this.tag && payload.childDomain === utils_getDomain());
              };

              _proto.getDefaultContainer = function getDefaultContainer(context, container) {
                if (container) {
                  if (typeof container !== 'string' && !isElement(container)) {
                    throw new TypeError("Expected string or element selector to be passed");
                  }

                  return container;
                }

                if (context === CONTEXT.POPUP) {
                  return 'body';
                }

                throw new Error("Expected element to be passed to render iframe");
              };

              _proto.getDefaultContext = function getDefaultContext(context, props) {
                var _this2 = this;

                return promise_ZalgoPromise.try(function () {
                  if (props.window) {
                    return setup_toProxyWindow(props.window).getType();
                  }

                  if (context) {
                    if (context !== CONTEXT.IFRAME && context !== CONTEXT.POPUP) {
                      throw new Error("Unrecognized context: " + context);
                    }

                    return context;
                  }

                  return _this2.defaultContext;
                });
              };

              _proto.init = function init(props) {
                var _this3 = this;

                // $FlowFixMe
                props = props || {};
                var parent = new parent_ParentComponent(this, props);

                var _render = function render(target, container, context) {
                  return promise_ZalgoPromise.try(function () {
                    if (!isWindow(target)) {
                      throw new Error("Must pass window to renderTo");
                    }

                    return _this3.getDefaultContext(context, props);
                  }).then(function (finalContext) {
                    container = _this3.getDefaultContainer(finalContext, container);
                    return parent.render(target, container, finalContext);
                  });
                };

                return _extends({}, parent.getHelpers(), {
                  render: function render(container, context) {
                    return _render(window, container, context);
                  },
                  renderTo: function renderTo(target, container, context) {
                    return _render(target, container, context);
                  }
                });
              };

              _proto.checkAllowRender = function checkAllowRender(target, domain, container) {
                if (target === window) {
                  return;
                }

                if (!isSameTopWindow(window, target)) {
                  throw new Error("Can only renderTo an adjacent frame");
                }

                var origin = utils_getDomain();

                if (!matchDomain(domain, origin) && !isSameDomain(target)) {
                  throw new Error("Can not render remotely to " + domain.toString() + " - can only render to " + origin);
                }

                if (container && typeof container !== 'string') {
                  throw new Error("Container passed to renderTo must be a string selector, got " + typeof container + " }");
                }
              };

              _proto.log = function log(event, payload) {
                this.logger.info(this.name + "_" + event, payload);
              };

              _proto.registerActiveComponent = function registerActiveComponent(instance) {
                var global = lib_global_getGlobal();
                global.activeComponents = global.activeComponents || [];
                global.activeComponents.push(instance);
              };

              _proto.destroyActiveComponent = function destroyActiveComponent(instance) {
                var global = lib_global_getGlobal();
                global.activeComponents = global.activeComponents || [];
                global.activeComponents.splice(global.activeComponents.indexOf(instance), 1);
              };

              return Component;
            }();
            function create(options) {
              setup();
              var component = new component_Component(options);

              var init = function init(props) {
                return component.init(props);
              };

              init.driver = function (name, dep) {
                return component.driver(name, dep);
              };

              init.isChild = function () {
                return component.isChild();
              };

              init.canRenderTo = function (win) {
                return component.canRenderTo(win);
              };

              init.xprops = component.xprops;
              return init;
            }
            function destroyAll() {
              if (src_bridge) {
                src_bridge.destroyBridges();
              }

              var results = [];
              var global = lib_global_getGlobal();
              global.activeComponents = global.activeComponents || [];

              while (global.activeComponents.length) {
                results.push(global.activeComponents[0].destroy(new Error("zoid destroyed all"), false));
              }

              return promise_ZalgoPromise.all(results).then(src_util_noop);
            }
            var destroyComponents = destroyAll;
            function component_destroy() {
              destroyAll();
              destroyGlobal();
              setup_destroy();
            }
            // CONCATENATED MODULE: ./src/component/index.js


            // CONCATENATED MODULE: ./src/index.js
            /* concated harmony reexport PopupOpenError */__webpack_require__.d(__webpack_exports__, "PopupOpenError", function() { return PopupOpenError; });
            /* concated harmony reexport create */__webpack_require__.d(__webpack_exports__, "create", function() { return create; });
            /* concated harmony reexport destroy */__webpack_require__.d(__webpack_exports__, "destroy", function() { return component_destroy; });
            /* concated harmony reexport destroyComponents */__webpack_require__.d(__webpack_exports__, "destroyComponents", function() { return destroyComponents; });
            /* concated harmony reexport destroyAll */__webpack_require__.d(__webpack_exports__, "destroyAll", function() { return destroyAll; });
            /* concated harmony reexport Component */__webpack_require__.d(__webpack_exports__, "Component", function() { return component_Component; });
            /* concated harmony reexport PROP_TYPE */__webpack_require__.d(__webpack_exports__, "PROP_TYPE", function() { return PROP_TYPE; });
            /* concated harmony reexport PROP_SERIALIZATION */__webpack_require__.d(__webpack_exports__, "PROP_SERIALIZATION", function() { return PROP_SERIALIZATION; });
            /* concated harmony reexport CONTEXT */__webpack_require__.d(__webpack_exports__, "CONTEXT", function() { return CONTEXT; });
            /* concated harmony reexport EVENT */__webpack_require__.d(__webpack_exports__, "EVENT", function() { return EVENT; });




            /***/ })
            /******/ ]);
            });
            //# sourceMappingURL=zoid.js.map
            });

            unwrapExports(zoid);

            var zoid$1 = createCommonjsModule(function (module) {
            /* @flow */
            /* eslint import/no-commonjs: 0 */

            // eslint-disable-next-line no-process-env
            {
                module.exports = zoid;
                module.exports.default = module.exports;
            }
            });

            window.SaibaMais = zoid$1.create({
              tag: "svg-saibamais-paypal",

              url: `./saibamais.html`,

              autoResize: {
                height: true, 
                width: false
              },

              dimensions: {
                height: "100%",
                width: "100%"
              }
            });

}());
