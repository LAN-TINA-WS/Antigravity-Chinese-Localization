"use strict";
// Copyright 2021-2026 The Connect Authors
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeNonProtocolHeaders = mergeNonProtocolHeaders;
const headers_js_1 = require("../protocol-connect/headers.js");
const headers_js_2 = require("../protocol-grpc/headers.js");
/**
 * The set of HTTP header names that carry protocol-level information for the
 * Connect, gRPC, and gRPC-Web protocols. These are reserved by the protocol
 * implementation and are not considered user metadata.
 *
 * Mirrors protocolHeaders in connect-go. Any changes to this constant must be
 * made there first.
 *
 * @private Internal code, does not follow semantic versioning.
 */
const protocolHeaders = new Set([
    // HTTP headers.
    headers_js_1.headerContentType,
    headers_js_1.headerUnaryContentLength,
    headers_js_1.headerUnaryEncoding,
    headers_js_1.headerHost,
    headers_js_1.headerUserAgent,
    headers_js_1.headerTrailer,
    headers_js_1.headerDate,
    // Connect headers.
    headers_js_1.headerUnaryAcceptEncoding,
    headers_js_1.headerUnaryTrailerPrefix,
    headers_js_1.headerStreamEncoding,
    headers_js_1.headerStreamAcceptEncoding,
    headers_js_1.headerTimeout,
    headers_js_1.headerProtocolVersion,
    // gRPC headers.
    headers_js_2.headerEncoding,
    headers_js_2.headerAcceptEncoding,
    headers_js_2.headerTimeout,
    headers_js_2.headerGrpcStatus,
    headers_js_2.headerGrpcMessage,
    headers_js_2.headerGrpcDetails,
].map((name) => name.toLowerCase()));
/**
 * Append all headers from `from` into `into`, skipping any protocol headers.
 *
 * Mirrors mergeNonProtocolHeaders in connect-go. Any changes to this method must be
 * made there first.
 *
 * @private Internal code, does not follow semantic versioning.
 */
function mergeNonProtocolHeaders(into, from) {
    from.forEach((value, key) => {
        if (!protocolHeaders.has(key.toLowerCase())) {
            into.append(key, value);
        }
    });
}
