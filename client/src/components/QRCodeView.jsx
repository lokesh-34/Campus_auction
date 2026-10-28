import React, { useMemo } from 'react';

/**
 * Minimalist, zero-dependency QR Code generator (Model 2, Byte Mode)
 * Based on Kazuhiko Arase's public domain implementation.
 */
function createQRCode(text, errorCorrectionLevel = 'M') {
  const PAD0 = 0xec;
  const PAD1 = 0x11;

  // Type table for version estimation (Versions 1-10)
  const MAX_CAPACITIES = [
    0, 14, 26, 42, 62, 84, 106, 122, 152, 180, 213,
  ];

  let typeNumber = 1;
  const rawBytes = [];
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 128) {
      rawBytes.push(code);
    } else if (code < 2048) {
      rawBytes.push(192 | (code >> 6), 128 | (code & 63));
    } else {
      rawBytes.push(224 | (code >> 12), 128 | ((code >> 6) & 63), 128 | (code & 63));
    }
  }

  while (typeNumber < MAX_CAPACITIES.length && rawBytes.length > MAX_CAPACITIES[typeNumber]) {
    typeNumber++;
  }
  if (typeNumber >= MAX_CAPACITIES.length) {
    typeNumber = MAX_CAPACITIES.length - 1;
  }

  // Galois Field & Polynomial math
  const EXP_TABLE = new Uint8Array(256);
  const LOG_TABLE = new Uint8Array(256);
  for (let i = 0, x = 1; i < 256; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x = (x << 1) ^ (x >= 128 ? 0x11d : 0);
  }

  function glog(n) {
    if (n < 1) throw new Error('glog(' + n + ')');
    return LOG_TABLE[n];
  }

  function gexp(n) {
    while (n < 0) n += 255;
    while (n >= 256) n -= 255;
    return EXP_TABLE[n];
  }

  // Polynomial multiplication
  function polyMultiply(p1, p2) {
    const result = new Uint8Array(p1.length + p2.length - 1);
    for (let i = 0; i < p1.length; i++) {
      for (let j = 0; j < p2.length; j++) {
        result[i + j] ^= gexp(glog(p1[i]) + glog(p2[j]));
      }
    }
    return result;
  }

  // Reed-Solomon generator polynomial
  function getGeneratorPoly(degree) {
    let poly = new Uint8Array([1]);
    for (let i = 0; i < degree; i++) {
      poly = polyMultiply(poly, new Uint8Array([1, gexp(i)]));
    }
    return poly;
  }

  // Error correction parameters per version (Level M)
  const EC_PARAMS = [
    null,
    { total: 26, data: 16, ec: 10 },
    { total: 44, data: 28, ec: 16 },
    { total: 70, data: 44, ec: 26 },
    { total: 100, data: 64, ec: 18, blocks: 2 },
    { total: 134, data: 86, ec: 24, blocks: 2 },
    { total: 172, data: 108, ec: 16, blocks: 4 },
    { total: 196, data: 124, ec: 18, blocks: 4 },
    { total: 242, data: 154, ec: 22, blocks: 4 },
    { total: 292, data: 182, ec: 22, blocks: 5 },
    { total: 346, data: 216, ec: 26, blocks: 5 },
  ];

  const ec = EC_PARAMS[typeNumber] || EC_PARAMS[1];
  const numDataBytes = ec.data;

  // Bit buffer
  const buffer = [];
  function putBits(num, length) {
    for (let i = length - 1; i >= 0; i--) {
      buffer.push((num >>> i) & 1);
    }
  }

  // Mode: Byte (0100)
  putBits(4, 4);
  // Character count indicator (8 bits for version 1-9)
  putBits(rawBytes.length, typeNumber < 10 ? 8 : 16);
  for (let i = 0; i < rawBytes.length; i++) {
    putBits(rawBytes[i], 8);
  }

  // Terminator
  while (buffer.length % 8 !== 0) {
    buffer.push(0);
  }

  // Pad to required capacity
  const dataBytes = [];
  for (let i = 0; i < buffer.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) {
      byte = (byte << 1) | buffer[i + j];
    }
    dataBytes.push(byte);
  }

  while (dataBytes.length < numDataBytes) {
    dataBytes.push(PAD0);
    if (dataBytes.length < numDataBytes) {
      dataBytes.push(PAD1);
    }
  }

  // Generate RS ECC
  const genPoly = getGeneratorPoly(ec.ec);
  const ecBytes = new Uint8Array(ec.ec);
  for (let i = 0; i < dataBytes.length; i++) {
    const factor = dataBytes[i] ^ ecBytes[0];
    for (let j = 0; j < ec.ec - 1; j++) {
      ecBytes[j] = ecBytes[j + 1] ^ (factor ? gexp(glog(genPoly[j + 1]) + glog(factor)) : 0);
    }
    ecBytes[ec.ec - 1] = factor ? gexp(glog(genPoly[ec.ec]) + glog(factor)) : 0;
  }

  const finalBytes = [...dataBytes, ...ecBytes];

  // Module matrix setup
  const moduleCount = typeNumber * 4 + 17;
  const matrix = Array.from({ length: moduleCount }, () => Array(moduleCount).fill(null));

  // Position detection patterns (Finder patterns)
  function placeFinder(row, col) {
    for (let r = -1; r <= 7; r++) {
      for (let c = -1; c <= 7; c++) {
        const nr = row + r;
        const nc = col + c;
        if (nr >= 0 && nr < moduleCount && nc >= 0 && nc < moduleCount) {
          if (
            (r >= 0 && r <= 6 && (c === 0 || c === 6)) ||
            (c >= 0 && c <= 6 && (r === 0 || r === 6)) ||
            (r >= 2 && r <= 4 && c >= 2 && c <= 4)
          ) {
            matrix[nr][nc] = true;
          } else {
            matrix[nr][nc] = false;
          }
        }
      }
    }
  }

  placeFinder(0, 0);
  placeFinder(0, moduleCount - 7);
  placeFinder(moduleCount - 7, 0);

  // Timing patterns
  for (let i = 8; i < moduleCount - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // Dark module
  matrix[moduleCount - 8][8] = true;

  // Format info reserve
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = 0; i < 8; i++) {
    if (matrix[8][moduleCount - 1 - i] === null) matrix[8][moduleCount - 1 - i] = false;
    if (matrix[moduleCount - 1 - i][8] === null) matrix[moduleCount - 1 - i][8] = false;
  }

  // Populate data bits
  let byteIndex = 0;
  let bitIndex = 7;
  let dir = -1;
  let col = moduleCount - 1;

  while (col > 0) {
    if (col === 6) col--; // Skip vertical timing pattern
    for (let count = 0; count < moduleCount; count++) {
      const row = dir < 0 ? moduleCount - 1 - count : count;
      for (let c = 0; c < 2; c++) {
        const currCol = col - c;
        if (matrix[row][currCol] === null) {
          let dark = false;
          if (byteIndex < finalBytes.length) {
            dark = ((finalBytes[byteIndex] >>> bitIndex) & 1) === 1;
            bitIndex--;
            if (bitIndex < 0) {
              byteIndex++;
              bitIndex = 7;
            }
          }
          // Mask pattern 0: (row + col) % 2 === 0
          const mask = (row + currCol) % 2 === 0;
          matrix[row][currCol] = mask ? !dark : dark;
        }
      }
    }
    dir = -dir;
    col -= 2;
  }

  // Apply fixed format info (Level M, Mask 0: 0x5412)
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];
  for (let i = 0; i < 6; i++) matrix[8][i] = formatBits[i] === 1;
  matrix[8][7] = formatBits[6] === 1;
  matrix[8][8] = formatBits[7] === 1;
  matrix[7][8] = formatBits[8] === 1;
  for (let i = 9; i < 15; i++) matrix[14 - i][8] = formatBits[i] === 1;

  for (let i = 0; i < 8; i++) matrix[moduleCount - 1 - i][8] = formatBits[i] === 1;
  for (let i = 8; i < 15; i++) matrix[8][moduleCount - 15 + i] = formatBits[i] === 1;

  return matrix;
}

/**
 * Responsive vector QR Code component rendering pure SVG
 */
export function QRCodeView({ value, size = 180, className = '' }) {
  const matrix = useMemo(() => {
    try {
      return createQRCode(value || 'CAMPUSBID');
    } catch {
      return null;
    }
  }, [value]);

  if (!matrix) {
    return (
      <div
        style={{ width: size, height: size }}
        className="bg-slate-100 rounded-2xl flex items-center justify-center text-xs text-slate-400 font-bold"
      >
        QR Preview
      </div>
    );
  }

  const count = matrix.length;
  const cellSize = 10;
  const viewBoxSize = count * cellSize;

  return (
    <div className={`inline-block p-3 bg-white rounded-2xl shadow-sm border border-slate-200/90 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${viewBoxSize} ${viewBoxSize}`}
        className="block"
        shapeRendering="crispEdges"
      >
        <rect width={viewBoxSize} height={viewBoxSize} fill="#ffffff" />
        {matrix.map((row, r) =>
          row.map((isDark, c) => {
            if (!isDark) return null;
            return (
              <rect
                key={`${r}-${c}`}
                x={c * cellSize}
                y={r * cellSize}
                width={cellSize}
                height={cellSize}
                fill="#0f172a"
              />
            );
          })
        )}
      </svg>
    </div>
  );
}
