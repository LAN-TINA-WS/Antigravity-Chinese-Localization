"use strict";
/**
 * @fileoverview Self-contained QR Code matrix encoder (`[Byte, Numeric]`
 * multi-segment mode for `FIDO:/<digits>` URIs) and Chromium-styled SVG
 * renderer (`ModuleStyle::kCircles`, `LocatorStyle::kRounded`, and
 * `CenterImage::kPasskey`).
 *
 * Portions of the QR matrix / Reed-Solomon encoder are adapted from
 * `qrcode-generator` by Kazuhiko Arase (`http://www.d-project.com/`):
 *
 * Copyright (c) 2009 Kazuhiko Arase
 *
 * URL: http://www.d-project.com/
 *
 * Licensed under the MIT license:
 *   http://www.opensource.org/licenses/mit-license.php
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 *
 * The word "QR Code" is registered trademark of DENSO WAVE INCORPORATED
 *   http://www.denso-wave.com/qrcode/faqpatent-e.html
 *
 * ----------------------------------------------------------------------------
 *
 * Portions of the passkey center icon vector path (`CHROME_PASSKEY_ICON_PATH`,
 * from `components/vector_icons/passkey.icon`) and QR module/locator styling
 * geometry (`components/qr_code_generator/bitmap_generator.cc`) are derived
 * from the Chromium project:
 *
 * Copyright 2023 The Chromium Authors
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *    * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *    * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *    * Neither the name of Google LLC nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.CHROME_PASSKEY_ICON_PATH = exports.QrPolynomial = exports.QrErrorCorrectionLevel = void 0;
exports.generateQrMatrix = generateQrMatrix;
exports.renderQrSvg = renderQrSvg;
/** Error correction level for QR Code generation. */
var QrErrorCorrectionLevel;
(function (QrErrorCorrectionLevel) {
    QrErrorCorrectionLevel[QrErrorCorrectionLevel["L"] = 1] = "L";
    QrErrorCorrectionLevel[QrErrorCorrectionLevel["M"] = 0] = "M";
    QrErrorCorrectionLevel[QrErrorCorrectionLevel["Q"] = 3] = "Q";
    QrErrorCorrectionLevel[QrErrorCorrectionLevel["H"] = 2] = "H";
})(QrErrorCorrectionLevel || (exports.QrErrorCorrectionLevel = QrErrorCorrectionLevel = {}));
const EXP_TABLE = new Array(256);
const LOG_TABLE = new Array(256);
for (let i = 0; i < 8; i++) {
    EXP_TABLE[i] = 1 << i;
}
for (let i = 8; i < 256; i++) {
    EXP_TABLE[i] =
        EXP_TABLE[i - 4] ^ EXP_TABLE[i - 5] ^ EXP_TABLE[i - 6] ^ EXP_TABLE[i - 8];
}
for (let i = 0; i < 255; i++) {
    LOG_TABLE[EXP_TABLE[i]] = i;
}
function gexp(n) {
    let exp = n;
    while (exp < 0) {
        exp += 255;
    }
    while (exp >= 256) {
        exp -= 255;
    }
    return EXP_TABLE[exp];
}
function glog(n) {
    if (n < 1) {
        throw new Error(`glog(${n})`);
    }
    return LOG_TABLE[n];
}
/** Polynomial over GF(256) used to compute QR Reed-Solomon error codewords. */
class QrPolynomial {
    constructor(num, shift) {
        let offset = 0;
        while (offset < num.length && num[offset] === 0) {
            offset++;
        }
        this.num = new Array(num.length - offset + shift).fill(0);
        for (let i = 0; i < num.length - offset; i++) {
            this.num[i] = num[i + offset];
        }
    }
    get(index) {
        return this.num[index];
    }
    getLength() {
        return this.num.length;
    }
    multiply(e) {
        const num = new Array(this.getLength() + e.getLength() - 1).fill(0);
        for (let i = 0; i < this.getLength(); i++) {
            const a = this.get(i);
            if (a === 0) {
                continue;
            }
            for (let j = 0; j < e.getLength(); j++) {
                const b = e.get(j);
                if (b === 0) {
                    continue;
                }
                num[i + j] ^= gexp(glog(a) + glog(b));
            }
        }
        return new QrPolynomial(num, 0);
    }
    mod(e) {
        if (e.getLength() === 0) {
            throw new Error('Cannot divide QR polynomial by zero');
        }
        if (this.getLength() - e.getLength() < 0) {
            return this;
        }
        const ratio = glog(this.get(0)) - glog(e.get(0));
        const num = this.num.slice();
        for (let i = 0; i < e.getLength(); i++) {
            const coeff = e.get(i);
            if (coeff !== 0) {
                num[i] ^= gexp(glog(coeff) + ratio);
            }
        }
        return new QrPolynomial(num, 0).mod(e);
    }
}
exports.QrPolynomial = QrPolynomial;
function getErrorCorrectPolynomial(errorCorrectLength) {
    let a = new QrPolynomial([1], 0);
    for (let i = 0; i < errorCorrectLength; i++) {
        a = a.multiply(new QrPolynomial([1, gexp(i)], 0));
    }
    return a;
}
class QrBitBuffer {
    constructor() {
        this.buffer = [];
        this.length = 0;
    }
    getBuffer() {
        return this.buffer;
    }
    getLengthInBits() {
        return this.length;
    }
    put(num, length) {
        for (let i = 0; i < length; i++) {
            this.putBit(((num >>> (length - i - 1)) & 1) === 1);
        }
    }
    putBit(bit) {
        const bufIndex = Math.floor(this.length / 8);
        if (this.buffer.length <= bufIndex) {
            this.buffer.push(0);
        }
        if (bit) {
            this.buffer[bufIndex] |= 0x80 >>> this.length % 8;
        }
        this.length++;
    }
}
// prettier-ignore
const RS_BLOCK_TABLE = [
    [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
    [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
    [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
    [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
    [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
    [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
    [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
    [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
    [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
    [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16],
    [4, 101, 81], [1, 80, 50, 4, 81, 51], [4, 50, 22, 4, 51, 23], [3, 36, 12, 8, 37, 13],
    [2, 116, 92, 2, 117, 93], [6, 58, 36, 2, 59, 37], [4, 46, 20, 6, 47, 21], [7, 42, 14, 4, 43, 15],
    [4, 133, 107], [8, 59, 37, 1, 60, 38], [8, 44, 20, 4, 45, 21], [12, 33, 11, 4, 34, 12],
    [3, 145, 115, 1, 146, 116], [4, 64, 40, 5, 65, 41], [11, 36, 16, 5, 37, 17], [11, 36, 12, 5, 37, 13],
    [5, 109, 87, 1, 110, 88], [5, 65, 41, 5, 66, 42], [5, 54, 24, 7, 55, 25], [11, 36, 12, 7, 37, 13],
    [5, 122, 98, 1, 123, 99], [7, 73, 45, 3, 74, 46], [15, 43, 19, 2, 44, 20], [3, 45, 15, 13, 46, 16],
    [1, 135, 107, 5, 136, 108], [10, 74, 46, 1, 75, 47], [1, 50, 22, 15, 51, 23], [2, 42, 14, 17, 43, 15],
    [5, 150, 120, 1, 151, 121], [9, 69, 43, 4, 70, 44], [17, 50, 22, 1, 51, 23], [2, 42, 14, 19, 43, 15],
    [3, 141, 113, 4, 142, 114], [3, 70, 44, 11, 71, 45], [17, 47, 21, 4, 48, 22], [9, 39, 13, 16, 40, 14],
    [3, 135, 107, 5, 136, 108], [3, 67, 41, 13, 68, 42], [15, 54, 24, 5, 55, 25], [15, 43, 15, 10, 44, 16],
    [4, 144, 116, 4, 145, 117], [17, 68, 42], [17, 50, 22, 6, 51, 23], [19, 46, 16, 6, 47, 17],
    [2, 139, 111, 7, 140, 112], [17, 74, 46], [7, 54, 24, 16, 55, 25], [34, 37, 13],
    [4, 151, 121, 5, 152, 122], [4, 75, 47, 14, 76, 48], [11, 54, 24, 14, 55, 25], [16, 45, 15, 14, 46, 16],
    [6, 147, 117, 4, 148, 118], [6, 73, 45, 14, 74, 46], [11, 54, 24, 16, 55, 25], [30, 46, 16, 2, 47, 17],
    [8, 132, 106, 4, 133, 107], [8, 75, 47, 13, 76, 48], [7, 54, 24, 22, 55, 25], [22, 45, 15, 13, 46, 16],
    [10, 142, 114, 2, 143, 115], [19, 74, 46, 4, 75, 47], [28, 50, 22, 6, 51, 23], [33, 46, 16, 4, 47, 17],
    [8, 152, 122, 4, 153, 123], [22, 73, 45, 3, 74, 46], [8, 53, 23, 26, 54, 24], [12, 45, 15, 28, 46, 16],
    [3, 147, 117, 10, 148, 118], [3, 73, 45, 23, 74, 46], [4, 54, 24, 31, 55, 25], [11, 45, 15, 31, 46, 16],
    [7, 146, 116, 7, 147, 117], [21, 73, 45, 7, 74, 46], [1, 53, 23, 37, 54, 24], [19, 45, 15, 26, 46, 16],
    [5, 145, 115, 10, 146, 116], [19, 75, 47, 10, 76, 48], [15, 54, 24, 25, 55, 25], [23, 45, 15, 25, 46, 16],
    [13, 145, 115, 3, 146, 116], [2, 74, 46, 29, 75, 47], [42, 54, 24, 1, 55, 25], [23, 45, 15, 28, 46, 16],
    [17, 145, 115], [10, 74, 46, 23, 75, 47], [10, 54, 24, 35, 55, 25], [19, 45, 15, 35, 46, 16],
    [17, 145, 115, 1, 146, 116], [14, 74, 46, 21, 75, 47], [29, 54, 24, 19, 55, 25], [11, 45, 15, 46, 46, 16],
    [13, 145, 115, 6, 146, 116], [14, 74, 46, 23, 75, 47], [44, 54, 24, 7, 55, 25], [59, 46, 16, 1, 47, 17],
    [12, 151, 121, 7, 152, 122], [12, 75, 47, 26, 76, 48], [39, 54, 24, 14, 55, 25], [22, 45, 15, 41, 46, 16],
    [6, 151, 121, 14, 152, 122], [6, 75, 47, 34, 76, 48], [46, 54, 24, 10, 55, 25], [2, 45, 15, 64, 46, 16],
    [17, 152, 122, 4, 153, 123], [29, 74, 46, 14, 75, 47], [49, 54, 24, 10, 55, 25], [24, 45, 15, 46, 46, 16],
    [4, 152, 122, 18, 153, 123], [13, 74, 46, 32, 75, 47], [48, 54, 24, 14, 55, 25], [42, 45, 15, 32, 46, 16],
    [20, 147, 117, 4, 148, 118], [40, 75, 47, 7, 76, 48], [43, 54, 24, 22, 55, 25], [10, 45, 15, 67, 46, 16],
    [19, 148, 118, 6, 149, 119], [18, 75, 47, 31, 76, 48], [34, 54, 24, 34, 55, 25], [20, 45, 15, 61, 46, 16],
];
function getRsBlocks(typeNumber, ecLevel) {
    const ecIndex = ecLevel === QrErrorCorrectionLevel.L
        ? 0
        : ecLevel === QrErrorCorrectionLevel.M
            ? 1
            : ecLevel === QrErrorCorrectionLevel.Q
                ? 2
                : 3;
    const row = RS_BLOCK_TABLE[(typeNumber - 1) * 4 + ecIndex];
    const blocks = [];
    for (let i = 0; i < row.length; i += 3) {
        const count = row[i];
        const totalCount = row[i + 1];
        const dataCount = row[i + 2];
        for (let j = 0; j < count; j++) {
            blocks.push({ totalCount, dataCount });
        }
    }
    return blocks;
}
const G15 = (1 << 10) | (1 << 8) | (1 << 5) | (1 << 4) | (1 << 2) | (1 << 1) | (1 << 0);
const G18 = (1 << 12) |
    (1 << 11) |
    (1 << 10) |
    (1 << 9) |
    (1 << 8) |
    (1 << 5) |
    (1 << 2) |
    (1 << 0);
const G15_MASK = (1 << 14) | (1 << 12) | (1 << 10) | (1 << 4) | (1 << 1);
function getBchDigit(data) {
    let digit = 0;
    let d = data;
    while (d !== 0) {
        digit++;
        d >>>= 1;
    }
    return digit;
}
function getBchTypeInfo(data) {
    let d = data << 10;
    while (getBchDigit(d) - getBchDigit(G15) >= 0) {
        d ^= G15 << (getBchDigit(d) - getBchDigit(G15));
    }
    return ((data << 10) | d) ^ G15_MASK;
}
function getBchTypeNumber(data) {
    let d = data << 12;
    while (getBchDigit(d) - getBchDigit(G18) >= 0) {
        d ^= G18 << (getBchDigit(d) - getBchDigit(G18));
    }
    return (data << 12) | d;
}
// prettier-ignore
const PATTERN_POSITION_TABLE = [
    [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42],
    [6, 26, 46], [6, 28, 50], [6, 30, 54], [6, 32, 58], [6, 34, 62],
    [6, 26, 46, 66], [6, 26, 48, 70], [6, 26, 50, 74], [6, 30, 54, 78],
    [6, 30, 56, 82], [6, 30, 58, 86], [6, 34, 62, 90], [6, 28, 50, 72, 94],
    [6, 26, 50, 74, 98], [6, 30, 54, 78, 102], [6, 28, 54, 80, 106],
    [6, 32, 58, 84, 110], [6, 30, 58, 86, 114], [6, 34, 62, 90, 118],
    [6, 26, 50, 74, 98, 122], [6, 30, 54, 78, 102, 126],
    [6, 26, 52, 78, 104, 130], [6, 30, 56, 82, 108, 134],
    [6, 34, 60, 86, 112, 138], [6, 30, 58, 86, 114, 142],
    [6, 34, 62, 90, 118, 146], [6, 30, 54, 78, 102, 126, 150],
    [6, 24, 50, 76, 102, 128, 154], [6, 28, 54, 80, 106, 132, 158],
    [6, 32, 58, 84, 110, 136, 162], [6, 26, 54, 82, 110, 138, 166],
    [6, 30, 58, 86, 114, 142, 170],
];
function getMaskFunction(maskPattern) {
    switch (maskPattern) {
        case 0:
            return (i, j) => (i + j) % 2 === 0;
        case 1:
            return (i) => i % 2 === 0;
        case 2:
            return (_, j) => j % 3 === 0;
        case 3:
            return (i, j) => (i + j) % 3 === 0;
        case 4:
            return (i, j) => (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
        case 5:
            return (i, j) => ((i * j) % 2) + ((i * j) % 3) === 0;
        case 6:
            return (i, j) => (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
        case 7:
            return (i, j) => (((i * j) % 3) + ((i + j) % 2)) % 2 === 0;
        default:
            throw new Error(`Invalid QR maskPattern: ${maskPattern}`);
    }
}
function getByteCountBits(typeNumber) {
    return typeNumber < 10 ? 8 : 16;
}
function getNumericCountBits(typeNumber) {
    if (typeNumber < 10) {
        return 10;
    }
    if (typeNumber < 27) {
        return 12;
    }
    return 14;
}
const UTF8_ENCODER = new TextEncoder();
function segmentText(text) {
    if (/^\d+$/.test(text)) {
        return [{ mode: 'numeric', digits: text }];
    }
    // Match Chromium's `qr_code_generator.cc` segmentation for `FIDO:/<digits>`
    // URIs: encode the non-digit prefix in Byte mode and the trailing digit run
    // (>= 12 digits) in Numeric mode so `FIDO:/...` fits in Version 5-M (37x37).
    const prefixDigitsMatch = /^([^\d]+)(\d{12,})$/.exec(text);
    if (prefixDigitsMatch) {
        return [
            { mode: 'byte', data: UTF8_ENCODER.encode(prefixDigitsMatch[1]) },
            { mode: 'numeric', digits: prefixDigitsMatch[2] },
        ];
    }
    return [{ mode: 'byte', data: UTF8_ENCODER.encode(text) }];
}
function getSegmentsBitLength(segments, typeNumber) {
    let bits = 0;
    for (const seg of segments) {
        if (seg.mode === 'byte') {
            bits += 4 + getByteCountBits(typeNumber) + seg.data.length * 8;
        }
        else {
            const fullTriplets = Math.floor(seg.digits.length / 3);
            const rem = seg.digits.length % 3;
            const remBits = rem === 2 ? 7 : rem === 1 ? 4 : 0;
            bits += 4 + getNumericCountBits(typeNumber) + fullTriplets * 10 + remBits;
        }
    }
    return bits;
}
function writeSegmentsToBuffer(buffer, segments, typeNumber) {
    for (const seg of segments) {
        if (seg.mode === 'byte') {
            buffer.put(4, 4); // 8-bit byte mode indicator (0100)
            buffer.put(seg.data.length, getByteCountBits(typeNumber));
            for (const b of seg.data) {
                buffer.put(b, 8);
            }
        }
        else {
            buffer.put(1, 4); // numeric mode indicator (0001)
            buffer.put(seg.digits.length, getNumericCountBits(typeNumber));
            let i = 0;
            while (i + 3 <= seg.digits.length) {
                buffer.put(Number(seg.digits.slice(i, i + 3)), 10);
                i += 3;
            }
            const rem = seg.digits.length - i;
            if (rem === 2) {
                buffer.put(Number(seg.digits.slice(i, i + 2)), 7);
            }
            else if (rem === 1) {
                buffer.put(Number(seg.digits.slice(i, i + 1)), 4);
            }
        }
    }
}
const PAD0 = 0xec;
const PAD1 = 0x11;
function createBytes(buffer, rsBlocks) {
    let offset = 0;
    let maxDcCount = 0;
    let maxEcCount = 0;
    const dcData = [];
    const ecData = [];
    for (const block of rsBlocks) {
        const dcCount = block.dataCount;
        const ecCount = block.totalCount - dcCount;
        maxDcCount = Math.max(maxDcCount, dcCount);
        maxEcCount = Math.max(maxEcCount, ecCount);
        const dc = new Array(dcCount);
        for (let i = 0; i < dc.length; i++) {
            dc[i] = 0xff & buffer.getBuffer()[i + offset];
        }
        offset += dcCount;
        const rsPoly = getErrorCorrectPolynomial(ecCount);
        const rawPoly = new QrPolynomial(dc, rsPoly.getLength() - 1);
        const modPoly = rawPoly.mod(rsPoly);
        const ec = new Array(rsPoly.getLength() - 1);
        for (let i = 0; i < ec.length; i++) {
            const modIndex = i + modPoly.getLength() - ec.length;
            ec[i] = modIndex >= 0 ? modPoly.get(modIndex) : 0;
        }
        dcData.push(dc);
        ecData.push(ec);
    }
    let totalCodeCount = 0;
    for (const block of rsBlocks) {
        totalCodeCount += block.totalCount;
    }
    const data = new Array(totalCodeCount);
    let index = 0;
    for (let i = 0; i < maxDcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) {
            if (i < dcData[r].length) {
                data[index++] = dcData[r][i];
            }
        }
    }
    for (let i = 0; i < maxEcCount; i++) {
        for (let r = 0; r < rsBlocks.length; r++) {
            if (i < ecData[r].length) {
                data[index++] = ecData[r][i];
            }
        }
    }
    return data;
}
function createData(typeNumber, ecLevel, segments) {
    const rsBlocks = getRsBlocks(typeNumber, ecLevel);
    const buffer = new QrBitBuffer();
    writeSegmentsToBuffer(buffer, segments, typeNumber);
    let totalDataCount = 0;
    for (const block of rsBlocks) {
        totalDataCount += block.dataCount;
    }
    const totalDataBits = totalDataCount * 8;
    if (buffer.getLengthInBits() > totalDataBits) {
        throw new Error(`QR code length overflow (${buffer.getLengthInBits()} > ${totalDataBits})`);
    }
    if (buffer.getLengthInBits() + 4 <= totalDataBits) {
        buffer.put(0, 4);
    }
    while (buffer.getLengthInBits() % 8 !== 0) {
        buffer.putBit(false);
    }
    for (;;) {
        if (buffer.getLengthInBits() >= totalDataBits) {
            break;
        }
        buffer.put(PAD0, 8);
        if (buffer.getLengthInBits() >= totalDataBits) {
            break;
        }
        buffer.put(PAD1, 8);
    }
    return createBytes(buffer, rsBlocks);
}
class QrMatrix {
    constructor(typeNumber, ecLevel, dataCodewords) {
        this.typeNumber = typeNumber;
        this.ecLevel = ecLevel;
        this.dataCodewords = dataCodewords;
        this.modules = [];
        this.moduleCount = typeNumber * 4 + 17;
    }
    make(forcedMask) {
        if (forcedMask !== undefined) {
            this.makeImpl(false, forcedMask);
            return this.modules.map((row) => row.map((m) => m === true));
        }
        let bestPattern = 0;
        let minLostPoint = 0;
        for (let pattern = 0; pattern < 8; pattern++) {
            this.makeImpl(true, pattern);
            const lostPoint = this.getLostPoint();
            if (pattern === 0 || lostPoint < minLostPoint) {
                minLostPoint = lostPoint;
                bestPattern = pattern;
            }
        }
        this.makeImpl(false, bestPattern);
        return this.modules.map((row) => row.map((m) => m === true));
    }
    makeImpl(test, maskPattern) {
        this.modules = Array.from({ length: this.moduleCount }, () => new Array(this.moduleCount).fill(null));
        this.setupPositionProbePattern(0, 0);
        this.setupPositionProbePattern(this.moduleCount - 7, 0);
        this.setupPositionProbePattern(0, this.moduleCount - 7);
        this.setupPositionAdjustPattern();
        this.setupTimingPattern();
        this.setupTypeInfo(test, maskPattern);
        if (this.typeNumber >= 7) {
            this.setupTypeNumber(test);
        }
        this.mapData(this.dataCodewords, maskPattern);
    }
    setupPositionProbePattern(row, col) {
        for (let r = -1; r <= 7; r++) {
            if (row + r <= -1 || this.moduleCount <= row + r) {
                continue;
            }
            for (let c = -1; c <= 7; c++) {
                if (col + c <= -1 || this.moduleCount <= col + c) {
                    continue;
                }
                const on = (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
                    (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
                    (r >= 2 && r <= 4 && c >= 2 && c <= 4);
                this.modules[row + r][col + c] = on;
            }
        }
    }
    setupTimingPattern() {
        for (let r = 8; r < this.moduleCount - 8; r++) {
            if (this.modules[r][6] !== null) {
                continue;
            }
            this.modules[r][6] = r % 2 === 0;
        }
        for (let c = 8; c < this.moduleCount - 8; c++) {
            if (this.modules[6][c] !== null) {
                continue;
            }
            this.modules[6][c] = c % 2 === 0;
        }
    }
    setupPositionAdjustPattern() {
        const pos = PATTERN_POSITION_TABLE[this.typeNumber - 1];
        for (const row of pos) {
            for (const col of pos) {
                if (this.modules[row][col] !== null) {
                    continue;
                }
                for (let r = -2; r <= 2; r++) {
                    for (let c = -2; c <= 2; c++) {
                        this.modules[row + r][col + c] =
                            r === -2 ||
                                r === 2 ||
                                c === -2 ||
                                c === 2 ||
                                (r === 0 && c === 0);
                    }
                }
            }
        }
    }
    setupTypeNumber(test) {
        const bits = getBchTypeNumber(this.typeNumber);
        for (let i = 0; i < 18; i++) {
            const mod = !test && ((bits >> i) & 1) === 1;
            this.modules[Math.floor(i / 3)][(i % 3) + this.moduleCount - 8 - 3] = mod;
        }
        for (let i = 0; i < 18; i++) {
            const mod = !test && ((bits >> i) & 1) === 1;
            this.modules[(i % 3) + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
        }
    }
    setupTypeInfo(test, maskPattern) {
        const data = (this.ecLevel << 3) | maskPattern;
        const bits = getBchTypeInfo(data);
        for (let i = 0; i < 15; i++) {
            const mod = !test && ((bits >> i) & 1) === 1;
            if (i < 6) {
                this.modules[i][8] = mod;
            }
            else if (i < 8) {
                this.modules[i + 1][8] = mod;
            }
            else {
                this.modules[this.moduleCount - 15 + i][8] = mod;
            }
        }
        for (let i = 0; i < 15; i++) {
            const mod = !test && ((bits >> i) & 1) === 1;
            if (i < 8) {
                this.modules[8][this.moduleCount - i - 1] = mod;
            }
            else if (i < 9) {
                this.modules[8][15 - i - 1 + 1] = mod;
            }
            else {
                this.modules[8][15 - i - 1] = mod;
            }
        }
        this.modules[this.moduleCount - 8][8] = !test;
    }
    mapData(data, maskPattern) {
        let inc = -1;
        let row = this.moduleCount - 1;
        let bitIndex = 7;
        let byteIndex = 0;
        const maskFunc = getMaskFunction(maskPattern);
        for (let col = this.moduleCount - 1; col > 0; col -= 2) {
            if (col === 6) {
                col--;
            }
            for (;;) {
                for (let c = 0; c < 2; c++) {
                    if (this.modules[row][col - c] === null) {
                        let dark = false;
                        if (byteIndex < data.length) {
                            dark = ((data[byteIndex] >>> bitIndex) & 1) === 1;
                        }
                        if (maskFunc(row, col - c)) {
                            dark = !dark;
                        }
                        this.modules[row][col - c] = dark;
                        bitIndex--;
                        if (bitIndex === -1) {
                            byteIndex++;
                            bitIndex = 7;
                        }
                    }
                }
                row += inc;
                if (row < 0 || this.moduleCount <= row) {
                    row -= inc;
                    inc = -inc;
                    break;
                }
            }
        }
    }
    getLostPoint() {
        const n = this.moduleCount;
        const dark = (r, c) => this.modules[r][c] === true;
        let lostPoint = 0;
        for (let row = 0; row < n; row++) {
            let prev = dark(row, 0);
            let length = 0;
            for (let col = 0; col < n; col++) {
                const d = dark(row, col);
                if (d === prev) {
                    length++;
                }
                else {
                    if (length >= 5) {
                        lostPoint += length - 2;
                    }
                    length = 1;
                    prev = d;
                }
            }
            if (length >= 5) {
                lostPoint += length - 2;
            }
        }
        for (let col = 0; col < n; col++) {
            let prev = dark(0, col);
            let length = 0;
            for (let row = 0; row < n; row++) {
                const d = dark(row, col);
                if (d === prev) {
                    length++;
                }
                else {
                    if (length >= 5) {
                        lostPoint += length - 2;
                    }
                    length = 1;
                    prev = d;
                }
            }
            if (length >= 5) {
                lostPoint += length - 2;
            }
        }
        for (let row = 0; row < n - 1; row++) {
            for (let col = 0; col < n - 1; col++) {
                let count = 0;
                if (dark(row, col)) {
                    count++;
                }
                if (dark(row + 1, col)) {
                    count++;
                }
                if (dark(row, col + 1)) {
                    count++;
                }
                if (dark(row + 1, col + 1)) {
                    count++;
                }
                if (count === 0 || count === 4) {
                    lostPoint += 3;
                }
            }
        }
        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n - 10; col++) {
                if (!dark(row, col + 1) &&
                    dark(row, col + 4) &&
                    !dark(row, col + 5) &&
                    dark(row, col + 6) &&
                    !dark(row, col + 9) &&
                    ((dark(row, col) &&
                        dark(row, col + 2) &&
                        dark(row, col + 3) &&
                        !dark(row, col + 7) &&
                        !dark(row, col + 8) &&
                        !dark(row, col + 10)) ||
                        (!dark(row, col) &&
                            !dark(row, col + 2) &&
                            !dark(row, col + 3) &&
                            dark(row, col + 7) &&
                            dark(row, col + 8) &&
                            dark(row, col + 10)))) {
                    lostPoint += 40;
                }
            }
        }
        for (let col = 0; col < n; col++) {
            for (let row = 0; row < n - 10; row++) {
                if (!dark(row + 1, col) &&
                    dark(row + 4, col) &&
                    !dark(row + 5, col) &&
                    dark(row + 6, col) &&
                    !dark(row + 9, col) &&
                    ((dark(row, col) &&
                        dark(row + 2, col) &&
                        dark(row + 3, col) &&
                        !dark(row + 7, col) &&
                        !dark(row + 8, col) &&
                        !dark(row + 10, col)) ||
                        (!dark(row, col) &&
                            !dark(row + 2, col) &&
                            !dark(row + 3, col) &&
                            dark(row + 7, col) &&
                            dark(row + 8, col) &&
                            dark(row + 10, col)))) {
                    lostPoint += 40;
                }
            }
        }
        let darkCount = 0;
        for (let row = 0; row < n; row++) {
            for (let col = 0; col < n; col++) {
                if (dark(row, col)) {
                    darkCount++;
                }
            }
        }
        const percent = darkCount / (n * n);
        const rating = Math.floor(Math.abs(percent * 100 - 50) / 5);
        lostPoint += rating * 10;
        return lostPoint;
    }
}
function fitsVersion(typeNumber, ecLevel, segments) {
    const rsBlocks = getRsBlocks(typeNumber, ecLevel);
    let totalDataCount = 0;
    for (const block of rsBlocks) {
        totalDataCount += block.dataCount;
    }
    const neededBits = getSegmentsBitLength(segments, typeNumber);
    return neededBits <= totalDataCount * 8;
}
/**
 * Encodes `text` as a QR code (using `[Byte, Numeric]` multi-segment encoding
 * for `FIDO:/<digits>` URIs) and returns a square matrix of booleans where
 * `true` denotes a dark module.
 */
function generateQrMatrix(text, options) {
    const ecLevel = options?.ecLevel ?? QrErrorCorrectionLevel.M;
    const maskPattern = options?.maskPattern;
    if (maskPattern !== undefined &&
        (!Number.isInteger(maskPattern) || maskPattern < 0 || maskPattern > 7)) {
        throw new Error(`Invalid QR maskPattern: ${maskPattern} (must be an integer in 0..7)`);
    }
    const minVersion = options?.minVersion ?? 1;
    if (!Number.isInteger(minVersion) || minVersion < 1 || minVersion > 40) {
        throw new Error(`Invalid QR minVersion: ${minVersion} (must be an integer in 1..40)`);
    }
    const segments = segmentText(text);
    let typeNumber = minVersion;
    while (typeNumber <= 40 && !fitsVersion(typeNumber, ecLevel, segments)) {
        typeNumber++;
    }
    if (typeNumber > 40) {
        throw new Error('Data too long for QR code');
    }
    const dataCodewords = createData(typeNumber, ecLevel, segments);
    return new QrMatrix(typeNumber, ecLevel, dataCodewords).make(maskPattern);
}
/**
 * Chromium `vector_icons::kPasskeyOldIcon` (`24x24` viewBox) path rendered at
 * the center of WebAuthn QR codes (`CenterImage::kPasskey`).
 */
exports.CHROME_PASSKEY_ICON_PATH = 'M11 12 q-1.65 0 -2.81 -1.17 Q7.03 9.65 7.03 8 q0 -1.65 1.16 -2.82 Q9.35 4 11 4 q1.65 0 2.83 1.18 Q15 6.35 15 8 q0 1.65 -1.17 2.83 Q12.65 12 11 12 Z m7.25 9 L17 19.5 v-3.67 q-0.87 -0.32 -1.44 -1.09 Q15 13.98 15 13 q0 -1.25 0.88 -2.12 T18 10 q1.25 0 2.13 0.88 T21 13 q0 0.98 -0.56 1.74 q-0.56 0.76 -1.44 1.09 V16 l1 1 l-1 1 l1 1 Z M3 20 v-2.77 q0 -0.85 0.43 -1.57 q0.43 -0.72 1.18 -1.1 q1.27 -0.65 2.89 -1.1 Q9.1 13 11 13 q0.53 0 1.02 0.04 q0.5 0.04 1 0.11 q0.05 1.13 0.54 2.15 q0.49 1.02 1.44 1.68 V20 Z m15 -5.5 q0.63 0 1.06 -0.44 q0.44 -0.44 0.44 -1.06 q0 -0.62 -0.44 -1.06 Q18.63 11.5 18 11.5 q-0.63 0 -1.06 0.44 Q16.5 12.38 16.5 13 q0 0.62 0.44 1.06 q0.44 0.44 1.06 0.44 Z';
/**
 * Renders `text` into a Chromium-styled QR `<svg>` (`ModuleStyle::kCircles`,
 * `LocatorStyle::kRounded`, and optional `CenterImage::kPasskey` 11x11 center
 * cutout matching `components/qr_code_generator/bitmap_generator.cc`).
 */
function renderQrSvg(text, options) {
    const size = options?.size ?? 240;
    if (!Number.isFinite(size) || size <= 0) {
        throw new Error(`Invalid QR size: ${size} (must be a positive number)`);
    }
    const quietZone = options?.quietZone ?? 0;
    if (!Number.isInteger(quietZone) || quietZone < 0) {
        throw new Error(`Invalid QR quietZone: ${quietZone} (must be a non-negative integer)`);
    }
    if (options?.minVersion !== undefined &&
        (!Number.isInteger(options.minVersion) ||
            options.minVersion < 1 ||
            options.minVersion > 40)) {
        throw new Error(`Invalid QR minVersion: ${options.minVersion} (must be an integer in 1..40)`);
    }
    const centerPasskeyIcon = options?.centerPasskeyIcon ?? true;
    const ecLevel = options?.ecLevel ?? QrErrorCorrectionLevel.M;
    if (centerPasskeyIcon && ecLevel === QrErrorCorrectionLevel.L) {
        throw new Error('Center passkey icon requires error correction level M, Q, or H');
    }
    const minVersion = centerPasskeyIcon
        ? Math.max(5, options?.minVersion ?? 5)
        : (options?.minVersion ?? 1);
    const matrix = generateQrMatrix(text, { ecLevel, minVersion });
    const qrSize = matrix.length;
    const dim = qrSize + quietZone * 2;
    const cutoutStart = Math.floor((qrSize - 10) / 2);
    const cutoutEnd = cutoutStart + 11;
    const isLocatorZone = (r, c) => (r <= 7 && (c <= 7 || c >= qrSize - 8)) || (r >= qrSize - 8 && c <= 7);
    const isCenterCutout = (r, c) => centerPasskeyIcon &&
        r >= cutoutStart &&
        r < cutoutEnd &&
        c >= cutoutStart &&
        c < cutoutEnd;
    const circles = [];
    for (let r = 0; r < qrSize; r++) {
        for (let c = 0; c < qrSize; c++) {
            if (!matrix[r][c] || isLocatorZone(r, c) || isCenterCutout(r, c)) {
                continue;
            }
            const cx = (c + quietZone + 0.5).toFixed(1);
            const cy = (r + quietZone + 0.5).toFixed(1);
            circles.push(`<circle cx="${cx}" cy="${cy}" r="0.4"/>`);
        }
    }
    const locatorOrigins = [
        [quietZone, quietZone],
        [quietZone + qrSize - 7, quietZone],
        [quietZone, quietZone + qrSize - 7],
    ];
    const locators = locatorOrigins
        .map(([lx, ly]) => `<rect x="${lx}" y="${ly}" width="7" height="7" rx="1" ry="1" fill="#000000"/>` +
        `<rect x="${lx + 1}" y="${ly + 1}" width="5" height="5" rx="1" ry="1" fill="#ffffff"/>` +
        `<rect x="${lx + 2}" y="${ly + 2}" width="3" height="3" rx="1" ry="1" fill="#000000"/>`)
        .join('');
    let centerIconMarkup = '';
    if (centerPasskeyIcon) {
        const iconOffset = quietZone + (qrSize - 10) / 2;
        const iconScale = (10 / 24).toFixed(6);
        centerIconMarkup =
            `<rect x="${quietZone + cutoutStart}" y="${quietZone + cutoutStart}" width="11" height="11" fill="#ffffff"/>` +
                `<g transform="translate(${iconOffset}, ${iconOffset}) scale(${iconScale})">` +
                `<path fill="#000000" d="${exports.CHROME_PASSKEY_ICON_PATH}"/>` +
                `</g>`;
    }
    return [
        `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${dim} ${dim}" role="img" aria-label="Passkey QR code">`,
        `<rect width="${dim}" height="${dim}" fill="#ffffff"/>`,
        `<g fill="#000000">${circles.join('')}</g>`,
        locators,
        centerIconMarkup,
        '</svg>',
    ].join('');
}
