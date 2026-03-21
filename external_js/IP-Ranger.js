/*
 * ============================================================
 * Linkumori — Modern IP Address Library
 * ============================================================
 * Copyright (c) 2025 Subham Mahesh
 *
 * This program is free software: you can redistribute it and/or
 * modify it under the terms of the GNU Lesser General Public
 * License as published by the Free Software Foundation, either
 * version 3 of the License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Lesser General Public License for more details.
 *
 * You should have received a copy of the GNU Lesser General Public
 * License along with this program. If not, see
 * <http://www.gnu.org/licenses/>.
 *
 * DESCRIPTION
 * -----------
 * A modern, fluent API for IP address validation and network
 * operations. Built with binary string manipulation and state
 * machine parsing.
 *
 * ============================================================
 * MODIFICATION HISTORY
 * ============================================================
 * 2025-06-14   Subham Mahesh   File created
 *
 * Note: Due to inline constraints, subsequent modifications may
 * not appear here. To view the full history, run:
 *
 *   node linkumori-cli-tool.js
 *
 * Select "Generate Commit History" to produce a Markdown file
 * listing all modifications by file, author, and date.
 *
 * IMPORTANT NOTES
 * ---------------
 * - git clone is required before running "Generate Commit History";
 *   otherwise commit history generation will not work.
 * - Older modifications may not appear in the generated
 *   COMMIT_HISTORY.md.
 * - If a file's inline notice is limited, check for a separate
 *   file-specific notice and COMMIT_HISTORY.md; if neither exists,
 *   treat the inline notice as the final modification record.
 * - If a separate file-specific notice is provided, check the
 *   file's inline notice and COMMIT_HISTORY.md; if neither exists,
 *   treat the separate notice as the final modification record.
 * - Review individual modified source files for earlier notices.
 * - Some files may not contain notices within the file itself or
 *   may not be listed in COMMIT_HISTORY.md; a separate notice
 *   file may be provided instead.
 * - Not all source files have been modified, but review notices
 *   in all source files and any separate notice files (.md or .txt).
 * ============================================================
 */

class NetworkAddress {
  constructor(binaryString, type, metadata = {}) {
    this.#binary = binaryString;
    this.#type = type;
    this.#zoneId = metadata.zoneId || null;
    this.#originalFormat = metadata.originalFormat || null;
  }

  // Private fields
  #binary;
  #type;
  #zoneId;
  #originalFormat;

  // Getters
  get type() { return this.#type; }
  get version() { return this.#type === 'ipv4' ? 4 : 6; }
  get zoneId() { return this.#zoneId; }
  get binary() { return this.#binary; }

  // Core representation methods
  toString() {
    if (this.#type === 'ipv4') {
      return this.#toIPv4String();
    }
    return this.#toIPv6String(true);
  }

  toFullString() {
    if (this.#type === 'ipv4') {
      return this.#toIPv4String();
    }
    return this.#toIPv6String(false);
  }

  toBytes() {
    const bytes = [];
    const chunkSize = 8;
    for (let i = 0; i < this.#binary.length; i += chunkSize) {
      bytes.push(parseInt(this.#binary.slice(i, i + chunkSize), 2));
    }
    return bytes;
  }

  toJSON() {
    return {
      address: this.toString(),
      type: this.#type,
      version: this.version,
      zoneId: this.#zoneId,
      binary: this.#binary
    };
  }

  // Network testing methods
  belongsTo(network) {
    if (typeof network === 'string') {
      return NetworkRange.from(network).contains(this);
    }
    if (network instanceof NetworkRange) {
      return network.contains(this);
    }
    if (Array.isArray(network)) {
      return network.some(net => this.belongsTo(net));
    }
    throw new Error('Invalid network specification');
  }

  isIn(networks) {
    return this.belongsTo(networks);
  }

  // Type checking methods
  isPrivate() {
    return this.belongsTo(PrivateNetworks.getAll(this.#type));
  }

  isPublic() {
    return !this.isPrivate() && !this.isSpecial();
  }

  isLoopback() {
    return this.belongsTo(SpecialNetworks.loopback(this.#type));
  }

  isLinkLocal() {
    return this.belongsTo(SpecialNetworks.linkLocal(this.#type));
  }

  isMulticast() {
    return this.belongsTo(SpecialNetworks.multicast(this.#type));
  }

  isBroadcast() {
    if (this.#type !== 'ipv4') return false;
    return this.belongsTo('255.255.255.255/32');
  }

  isSpecial() {
    return this.isLoopback() || this.isLinkLocal() || this.isMulticast() || this.isBroadcast();
  }

  isIPv4Mapped() {
    if (this.#type !== 'ipv6') return false;
    return this.#binary.startsWith('0'.repeat(80) + '1'.repeat(16));
  }

  // Conversion methods
  toIPv4() {
    if (this.#type === 'ipv4') return this;
    if (!this.isIPv4Mapped()) {
      throw new Error('Cannot convert non-IPv4-mapped IPv6 to IPv4');
    }
    const ipv4Binary = this.#binary.slice(96);
    return new NetworkAddress(ipv4Binary, 'ipv4');
  }

  toIPv6() {
    if (this.#type === 'ipv6') return this;
    const mappedBinary = '0'.repeat(80) + '1'.repeat(16) + this.#binary;
    return new NetworkAddress(mappedBinary, 'ipv6');
  }

  // Comparison methods
  equals(other) {
    if (!(other instanceof NetworkAddress)) {
      other = IP.address(other);
    }
    return this.#type === other.#type && this.#binary === other.#binary;
  }

  compare(other) {
    if (!(other instanceof NetworkAddress)) {
      other = IP.address(other);
    }
    if (this.#type !== other.#type) {
      return this.#type === 'ipv4' ? -1 : 1;
    }
    return this.#binary.localeCompare(other.#binary);
  }

  // Private implementation methods
  #toIPv4String() {
    const octets = [];
    for (let i = 0; i < 32; i += 8) {
      octets.push(parseInt(this.#binary.slice(i, i + 8), 2));
    }
    return octets.join('.');
  }

  #toIPv6String(compress = false) {
    const segments = [];
    for (let i = 0; i < 128; i += 16) {
      const segment = parseInt(this.#binary.slice(i, i + 16), 2).toString(16);
      segments.push(segment);
    }
    
    let result = segments.join(':');
    
    if (compress) {
      const zeroPattern = /(^|:)(0:){2,}/g;
      let bestMatch = { index: -1, length: 0 };
      let match;
      
      while ((match = zeroPattern.exec(result)) !== null) {
        if (match[0].length > bestMatch.length) {
          bestMatch = { index: match.index, length: match[0].length };
        }
      }
      
      if (bestMatch.length > 0) {
        const before = result.slice(0, bestMatch.index);
        const after = result.slice(bestMatch.index + bestMatch.length);
        result = before + (before.endsWith(':') ? ':' : '::') + after;
      }
    }
    
    return result + (this.#zoneId ? '%' + this.#zoneId : '');
  }
}

class NetworkRange {
  constructor(network, prefixLength) {
    this.network = network;
    this.prefixLength = prefixLength;
    this.type = network.type;
  }

  static from(cidr) {
    const [addressStr, prefixStr] = NetworkParser.splitCIDR(cidr);
    const address = IP.address(addressStr);
    const prefix = parseInt(prefixStr, 10);
    
    const maxPrefix = address.type === 'ipv4' ? 32 : 128;
    if (prefix < 0 || prefix > maxPrefix) {
      throw new Error(`Invalid prefix length: ${prefix}`);
    }

    const networkBinary = address.binary.slice(0, prefix) + '0'.repeat(maxPrefix - prefix);
    const network = new NetworkAddress(networkBinary, address.type);
    
    return new NetworkRange(network, prefix);
  }

  contains(address) {
    if (!(address instanceof NetworkAddress)) {
      address = IP.address(address);
    }
    
    if (address.type !== this.type) return false;
    
    const addressPrefix = address.binary.slice(0, this.prefixLength);
    const networkPrefix = this.network.binary.slice(0, this.prefixLength);
    
    return addressPrefix === networkPrefix;
  }

  includes(address) {
    return this.contains(address);
  }

  getNetworkAddress() {
    return this.network;
  }

  getBroadcastAddress() {
    if (this.type !== 'ipv4') {
      throw new Error('Broadcast address only applies to IPv4');
    }
    
    const broadcastBinary = this.network.binary.slice(0, this.prefixLength) + 
                           '1'.repeat(32 - this.prefixLength);
    return new NetworkAddress(broadcastBinary, 'ipv4');
  }

  getAddressCount() {
    const hostBits = (this.type === 'ipv4' ? 32 : 128) - this.prefixLength;
    return Math.pow(2, hostBits);
  }

  toString() {
    return `${this.network.toString()}/${this.prefixLength}`;
  }

  toJSON() {
    return {
      network: this.network.toString(),
      prefixLength: this.prefixLength,
      type: this.type,
      addressCount: this.getAddressCount()
    };
  }
}

class NetworkParser {
  static parseAddress(input) {
    if (input.includes(':')) {
      return this.#parseIPv6(input);
    }
    return this.#parseIPv4(input);
  }

  static splitCIDR(cidr) {
    const match = cidr.match(/^(.+)\/(\d+)$/);
    if (!match) {
      throw new Error('Invalid CIDR format');
    }
    return [match[1], match[2]];
  }

  static #parseIPv4(input) {
    const states = { START: 0, OCTET: 1, DOT: 2, COMPLETE: 3, ERROR: 4 };
    let state = states.START;
    let currentOctet = '';
    let octets = [];
    let position = 0;

    while (position < input.length && state !== states.ERROR && state !== states.COMPLETE) {
      const char = input[position];

      switch (state) {
        case states.START:
          if (/\d/.test(char)) {
            currentOctet = char;
            state = states.OCTET;
          } else {
            state = states.ERROR;
          }
          break;

        case states.OCTET:
          if (/\d/.test(char)) {
            currentOctet += char;
          } else if (char === '.') {
            const octetValue = this.#parseOctet(currentOctet);
            if (octetValue === null || octets.length >= 3) {
              state = states.ERROR;
            } else {
              octets.push(octetValue);
              currentOctet = '';
              state = states.DOT;
            }
          } else {
            state = states.ERROR;
          }
          break;

        case states.DOT:
          if (/\d/.test(char)) {
            currentOctet = char;
            state = states.OCTET;
          } else {
            state = states.ERROR;
          }
          break;
      }
      position++;
    }

    if (state === states.OCTET && currentOctet) {
      const octetValue = this.#parseOctet(currentOctet);
      if (octetValue !== null && octets.length === 3) {
        octets.push(octetValue);
        state = states.COMPLETE;
      }
    }

    if (state !== states.COMPLETE || octets.length !== 4) {
      throw new Error('Invalid IPv4 format');
    }

    const binary = octets.map(octet => octet.toString(2).padStart(8, '0')).join('');
    return new NetworkAddress(binary, 'ipv4');
  }

  static #parseOctet(octetString) {
    let value;
    
    if (octetString.startsWith('0x')) {
      value = parseInt(octetString, 16);
    } else if (octetString.startsWith('0') && octetString.length > 1) {
      value = parseInt(octetString, 8);
    } else {
      value = parseInt(octetString, 10);
    }

    return (value >= 0 && value <= 255) ? value : null;
  }

  static #parseIPv6(input) {
    let zoneId = null;
    const zoneMatch = input.match(/%(.+)$/);
    if (zoneMatch) {
      zoneId = zoneMatch[1];
      input = input.replace(/%(.+)$/, '');
    }

    const ipv4InV6Match = input.match(/^(.+:)(\d+\.\d+\.\d+\.\d+)$/);
    if (ipv4InV6Match) {
      const ipv6Part = ipv4InV6Match[1].slice(0, -1);
      const ipv4Part = ipv4InV6Match[2];
      
      const ipv6Binary = this.#expandIPv6(ipv6Part, 6);
      const ipv4Address = this.#parseIPv4(ipv4Part);
      
      const fullBinary = ipv6Binary + ipv4Address.binary;
      return new NetworkAddress(fullBinary, 'ipv6', { zoneId });
    }

    const binary = this.#expandIPv6(input, 8);
    return new NetworkAddress(binary, 'ipv6', { zoneId });
  }

  static #expandIPv6(input, expectedSegments) {
    if (input.includes('::')) {
      const parts = input.split('::');
      if (parts.length > 2) throw new Error('Multiple :: not allowed');
      
      const leftSegments = parts[0] ? parts[0].split(':') : [];
      const rightSegments = parts[1] ? parts[1].split(':') : [];
      
      const missingSegments = expectedSegments - leftSegments.length - rightSegments.length;
      const zeroSegments = Array(missingSegments).fill('0');
      
      const allSegments = [...leftSegments, ...zeroSegments, ...rightSegments];
      return this.#segmentsToIPv6Binary(allSegments);
    } else {
      const segments = input.split(':');
      if (segments.length !== expectedSegments) {
        throw new Error(`Expected ${expectedSegments} IPv6 segments`);
      }
      return this.#segmentsToIPv6Binary(segments);
    }
  }

  static #segmentsToIPv6Binary(segments) {
    return segments.map(segment => {
      const value = parseInt(segment || '0', 16);
      if (value > 0xffff) throw new Error('Invalid IPv6 segment');
      return value.toString(2).padStart(16, '0');
    }).join('');
  }
}

class PrivateNetworks {
  static getAll(type) {
    if (type === 'ipv4') {
      return [
        '10.0.0.0/8',
        '172.16.0.0/12', 
        '192.168.0.0/16',
        '127.0.0.0/8'
      ];
    } else {
      return [
        'fc00::/7',
        '::1/128'
      ];
    }
  }

  static rfc1918() {
    return ['10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16'];
  }

  static carrierGrade() {
    return ['100.64.0.0/10'];
  }
}

class SpecialNetworks {
  static loopback(type) {
    return type === 'ipv4' ? ['127.0.0.0/8'] : ['::1/128'];
  }

  static linkLocal(type) {
    return type === 'ipv4' ? ['169.254.0.0/16'] : ['fe80::/10'];
  }

  static multicast(type) {
    return type === 'ipv4' ? ['224.0.0.0/4'] : ['ff00::/8'];
  }

  static reserved(type) {
    if (type === 'ipv4') {
      return [
        '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24',
        '198.51.100.0/24', '203.0.113.0/24', '240.0.0.0/4'
      ];
    } else {
      return ['2001:db8::/32'];
    }
  }
}

// Main API class
class IP {
  static address(input) {
    if (input instanceof NetworkAddress) return input;
    return NetworkParser.parseAddress(input);
  }

  static network(cidr) {
    return NetworkRange.from(cidr);
  }

  static fromBytes(bytes) {
    let binary = '';
    for (const byte of bytes) {
      binary += byte.toString(2).padStart(8, '0');
    }
    
    const type = bytes.length === 4 ? 'ipv4' : 'ipv6';
    return new NetworkAddress(binary, type);
  }

  static isValid(input) {
    try {
      this.address(input);
      return true;
    } catch (e) {
      return false;
    }
  }

  static isIPv4(input) {
    try {
      const addr = this.address(input);
      return addr.type === 'ipv4';
    } catch (e) {
      return false;
    }
  }

  static isIPv6(input) {
    try {
      const addr = this.address(input);
      return addr.type === 'ipv6';
    } catch (e) {
      return false;
    }
  }

  // Utility methods for common checks
  static isPrivate(input) {
    return this.address(input).isPrivate();
  }

  static isPublic(input) {
    return this.address(input).isPublic();
  }

  static isLoopback(input) {
    return this.address(input).isLoopback();
  }

  static isLinkLocal(input) {
    return this.address(input).isLinkLocal();
  }

  static isMulticast(input) {
    return this.address(input).isMulticast();
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IP, NetworkAddress, NetworkRange, PrivateNetworks, SpecialNetworks };
} else if (typeof window !== 'undefined') {
  Object.assign(window, { IP, NetworkAddress, NetworkRange, PrivateNetworks, SpecialNetworks });
}

/**
 * This file is part of Linkumori.
 * It contains the IP range checking logic for the extension.
 * 
 * @license LGPL-3.0-or-later
 */