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
      // "start-end" spans vs CIDR/netmask notation. IPv6 addresses never
      // contain '-', so its presence always means a span.
      if (network.includes('-')) {
        return AddressSpan.from(network).contains(this);
      }
      return NetworkRange.from(network).contains(this);
    }
    if (network instanceof NetworkRange || network instanceof AddressSpan) {
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

  // IPv4-mapped (::ffff:a.b.c.d) and NAT64-translated (64:ff9b::a.b.c.d)
  // IPv6 addresses reach the same endpoint as the embedded IPv4 address,
  // so classification must see through the embedding.
  #embeddedIPv4() {
    if (this.#type !== 'ipv6') return null;
    return (this.isIPv4Mapped() || this.isIPv4Translated()) ? this.toIPv4() : null;
  }

  // Type checking methods
  isPrivate() {
    const mapped = this.#embeddedIPv4();
    if (mapped) return mapped.isPrivate();
    return this.belongsTo(PrivateNetworks.getAll(this.#type));
  }

  isPublic() {
    return !this.isPrivate() && !this.isSpecial();
  }

  isLoopback() {
    const mapped = this.#embeddedIPv4();
    if (mapped) return mapped.isLoopback();
    return this.belongsTo(SpecialNetworks.loopback(this.#type));
  }

  isLinkLocal() {
    const mapped = this.#embeddedIPv4();
    if (mapped) return mapped.isLinkLocal();
    return this.belongsTo(SpecialNetworks.linkLocal(this.#type));
  }

  isMulticast() {
    const mapped = this.#embeddedIPv4();
    if (mapped) return mapped.isMulticast();
    return this.belongsTo(SpecialNetworks.multicast(this.#type));
  }

  isBroadcast() {
    const mapped = this.#embeddedIPv4();
    if (mapped) return mapped.isBroadcast();
    if (this.#type !== 'ipv4') return false;
    return this.belongsTo('255.255.255.255/32');
  }

  isUnspecified() {
    return !this.#binary.includes('1');
  }

  isReserved() {
    const mapped = this.#embeddedIPv4();
    if (mapped) return mapped.isReserved();
    return this.belongsTo(SpecialNetworks.reserved(this.#type));
  }

  // Transition-mechanism addresses (NAT64, 6to4, Teredo). These route on the
  // public internet, so they are deliberately NOT part of isSpecial().
  isTransition() {
    return this.belongsTo(SpecialNetworks.transition(this.#type));
  }

  isSpecial() {
    return this.isLoopback() || this.isLinkLocal() || this.isMulticast() ||
           this.isBroadcast() || this.isReserved() || this.isUnspecified();
  }

  isIPv4Mapped() {
    if (this.#type !== 'ipv6') return false;
    return this.#binary.startsWith('0'.repeat(80) + '1'.repeat(16));
  }

  isIPv4Translated() {
    if (this.#type !== 'ipv6') return false;
    return this.belongsTo('64:ff9b::/96');
  }

  // Conversion methods
  toIPv4() {
    if (this.#type === 'ipv4') return this;
    if (!this.isIPv4Mapped() && !this.isIPv4Translated()) {
      throw new Error('Cannot convert IPv6 without an embedded IPv4 address to IPv4');
    }
    const ipv4Binary = this.#binary.slice(96);
    return new NetworkAddress(ipv4Binary, 'ipv4');
  }

  toIPv6() {
    if (this.#type === 'ipv6') return this;
    const mappedBinary = '0'.repeat(80) + '1'.repeat(16) + this.#binary;
    return new NetworkAddress(mappedBinary, 'ipv6');
  }

  toBigInt() {
    return BigInt('0b' + this.#binary);
  }

  toReverseDNS() {
    if (this.#type === 'ipv4') {
      return this.toBytes().reverse().join('.') + '.in-addr.arpa';
    }
    const nibbles = [];
    for (let i = 0; i < 128; i += 4) {
      nibbles.push(parseInt(this.#binary.slice(i, i + 4), 2).toString(16));
    }
    return nibbles.reverse().join('.') + '.ip6.arpa';
  }

  // Address arithmetic
  offset(n) {
    const bits = this.#type === 'ipv4' ? 32 : 128;
    const value = this.toBigInt() + BigInt(n);
    if (value < 0n || value >= (1n << BigInt(bits))) {
      throw new Error('Address arithmetic out of range');
    }
    return new NetworkAddress(value.toString(2).padStart(bits, '0'), this.#type);
  }

  next() {
    return this.offset(1);
  }

  previous() {
    return this.offset(-1);
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

    let result;
    if (compress) {
      // RFC 5952: replace the first longest run of two or more zero groups,
      // including runs that touch either end of the address.
      let bestStart = -1, bestLen = 0, curStart = -1, curLen = 0;
      for (let i = 0; i < segments.length; i++) {
        if (segments[i] === '0') {
          if (curStart === -1) curStart = i;
          curLen++;
          if (curLen > bestLen) { bestLen = curLen; bestStart = curStart; }
        } else {
          curStart = -1;
          curLen = 0;
        }
      }
      if (bestLen >= 2) {
        result = segments.slice(0, bestStart).join(':') + '::' +
                 segments.slice(bestStart + bestLen).join(':');
      } else {
        result = segments.join(':');
      }
    } else {
      result = segments.join(':');
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
    const maxPrefix = address.type === 'ipv4' ? 32 : 128;

    let prefix;
    if (/^\d+$/.test(prefixStr)) {
      prefix = parseInt(prefixStr, 10);
    } else {
      // Dotted netmask notation, e.g. "192.168.0.0/255.255.255.0".
      if (address.type !== 'ipv4') {
        throw new Error('Netmask notation is only supported for IPv4');
      }
      prefix = IP.maskToPrefix(prefixStr);
    }

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

  getLastAddress() {
    const bits = this.type === 'ipv4' ? 32 : 128;
    const lastBinary = this.network.binary.slice(0, this.prefixLength) +
                       '1'.repeat(bits - this.prefixLength);
    return new NetworkAddress(lastBinary, this.type);
  }

  getBroadcastAddress() {
    if (this.type !== 'ipv4') {
      throw new Error('Broadcast address only applies to IPv4');
    }
    return this.getLastAddress();
  }

  getNetmask() {
    const bits = this.type === 'ipv4' ? 32 : 128;
    const maskBinary = '1'.repeat(this.prefixLength) + '0'.repeat(bits - this.prefixLength);
    return new NetworkAddress(maskBinary, this.type);
  }

  // IPv4 subnets reserve the network and broadcast addresses, except /31
  // (RFC 3021 point-to-point) and /32. IPv6 has no broadcast address.
  getFirstUsableHost() {
    if (this.type === 'ipv4' && this.prefixLength < 31) {
      return this.network.next();
    }
    return this.network;
  }

  getLastUsableHost() {
    const last = this.getLastAddress();
    if (this.type === 'ipv4' && this.prefixLength < 31) {
      return last.previous();
    }
    return last;
  }

  getAddressCount() {
    const hostBits = (this.type === 'ipv4' ? 32 : 128) - this.prefixLength;
    return 1n << BigInt(hostBits);
  }

  *addresses() {
    const start = this.network.toBigInt();
    const count = this.getAddressCount();
    const version = this.type === 'ipv4' ? 4 : 6;
    for (let i = 0n; i < count; i++) {
      yield IP.fromBigInt(start + i, version);
    }
  }

  *hosts() {
    const start = this.getFirstUsableHost().toBigInt();
    const end = this.getLastUsableHost().toBigInt();
    const version = this.type === 'ipv4' ? 4 : 6;
    for (let value = start; value <= end; value++) {
      yield IP.fromBigInt(value, version);
    }
  }

  *subnets(newPrefix) {
    const maxPrefix = this.type === 'ipv4' ? 32 : 128;
    if (!Number.isInteger(newPrefix) || newPrefix <= this.prefixLength || newPrefix > maxPrefix) {
      throw new Error(`New prefix must be between ${this.prefixLength + 1} and ${maxPrefix}`);
    }
    const count = 1n << BigInt(newPrefix - this.prefixLength);
    const step = 1n << BigInt(maxPrefix - newPrefix);
    const start = this.network.toBigInt();
    const version = this.type === 'ipv4' ? 4 : 6;
    for (let i = 0n; i < count; i++) {
      yield new NetworkRange(IP.fromBigInt(start + i * step, version), newPrefix);
    }
  }

  split(newPrefix) {
    const count = 1n << BigInt(newPrefix - this.prefixLength);
    if (count > 65536n) {
      throw new Error('Refusing to materialize more than 65536 subnets; use subnets() to iterate');
    }
    return [...this.subnets(newPrefix)];
  }

  supernet(newPrefix = this.prefixLength - 1) {
    if (!Number.isInteger(newPrefix) || newPrefix < 0 || newPrefix >= this.prefixLength) {
      throw new Error(`Supernet prefix must be between 0 and ${this.prefixLength - 1}`);
    }
    const bits = this.type === 'ipv4' ? 32 : 128;
    const networkBinary = this.network.binary.slice(0, newPrefix) + '0'.repeat(bits - newPrefix);
    return new NetworkRange(new NetworkAddress(networkBinary, this.type), newPrefix);
  }

  overlaps(other) {
    if (typeof other === 'string') {
      other = NetworkRange.from(other);
    }
    if (other.type !== this.type) return false;
    return this.contains(other.network) || other.contains(this.network);
  }

  containsRange(other) {
    if (typeof other === 'string') {
      other = NetworkRange.from(other);
    }
    if (other.type !== this.type) return false;
    return this.prefixLength <= other.prefixLength && this.contains(other.network);
  }

  toString() {
    return `${this.network.toString()}/${this.prefixLength}`;
  }

  toJSON() {
    return {
      network: this.network.toString(),
      prefixLength: this.prefixLength,
      type: this.type,
      // String because BigInt cannot be serialized by JSON.stringify and
      // IPv6 counts exceed Number.MAX_SAFE_INTEGER.
      addressCount: this.getAddressCount().toString()
    };
  }
}

// A contiguous inclusive range between two arbitrary addresses, e.g.
// "192.168.1.10-192.168.1.20" — not restricted to CIDR boundaries.
class AddressSpan {
  constructor(start, end) {
    start = IP.address(start);
    end = IP.address(end);
    if (start.type !== end.type) {
      throw new Error('Span endpoints must be the same IP version');
    }
    if (start.compare(end) > 0) {
      [start, end] = [end, start];
    }
    this.start = start;
    this.end = end;
    this.type = start.type;
  }

  static from(spec) {
    if (spec instanceof AddressSpan) return spec;
    const parts = String(spec).split('-');
    if (parts.length !== 2) {
      throw new Error('Invalid address span; expected "start-end"');
    }
    return new AddressSpan(parts[0].trim(), parts[1].trim());
  }

  contains(address) {
    if (!(address instanceof NetworkAddress)) {
      address = IP.address(address);
    }
    if (address.type !== this.type) return false;
    return this.start.compare(address) <= 0 && this.end.compare(address) >= 0;
  }

  includes(address) {
    return this.contains(address);
  }

  getAddressCount() {
    return this.end.toBigInt() - this.start.toBigInt() + 1n;
  }

  *addresses() {
    const end = this.end.toBigInt();
    const version = this.type === 'ipv4' ? 4 : 6;
    for (let value = this.start.toBigInt(); value <= end; value++) {
      yield IP.fromBigInt(value, version);
    }
  }

  toString() {
    return `${this.start.toString()}-${this.end.toString()}`;
  }

  toJSON() {
    return {
      start: this.start.toString(),
      end: this.end.toString(),
      type: this.type,
      addressCount: this.getAddressCount().toString()
    };
  }
}

class NetworkParser {
  static parseAddress(input) {
    if (typeof input !== 'string') {
      throw new Error('Address must be a string');
    }
    let address = input.trim();
    // URL.hostname wraps IPv6 literals in brackets ("[::1]").
    if (address.startsWith('[') && address.endsWith(']')) {
      address = address.slice(1, -1);
    }
    if (address.includes(':')) {
      return this.#parseIPv6(address);
    }
    return this.#parseIPv4(address);
  }

  static splitCIDR(cidr) {
    // Prefix part is either a decimal prefix length or an IPv4 dotted netmask.
    const match = cidr.match(/^(.+)\/([\d.]+)$/);
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
          // Accept hex digits and the 0x marker so "0x7f.0.0.1" reaches
          // #parseOctet, which strictly validates each radix form and
          // rejects junk like "1a" or "0xzz".
          if (/[0-9a-fx]/i.test(char)) {
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

    // Every digit must be valid for the detected radix; parseInt alone stops
    // at the first bad character and silently mis-parses octets like "09".
    if (/^0x[0-9a-f]+$/i.test(octetString)) {
      value = parseInt(octetString, 16);
    } else if (octetString.startsWith('0') && octetString.length > 1) {
      if (!/^0[0-7]+$/.test(octetString)) return null;
      value = parseInt(octetString, 8);
    } else if (/^\d+$/.test(octetString)) {
      value = parseInt(octetString, 10);
    } else {
      return null;
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
      // Keep a trailing "::" intact ("::1.2.3.4", "64:ff9b::1.2.3.4"); only
      // strip the separator colon after a regular hex group ("::ffff:1.2.3.4").
      const rawIPv6Part = ipv4InV6Match[1];
      const ipv6Part = rawIPv6Part.endsWith('::') ? rawIPv6Part : rawIPv6Part.slice(0, -1);
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
      // "::" must stand in for at least one zero group.
      if (missingSegments < 1) {
        throw new Error(`Expected at most ${expectedSegments} IPv6 segments around ::`);
      }
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
      // Reject empty and non-hex groups; parseInt would turn them into NaN
      // (or a truncated value) and corrupt the binary representation.
      if (!/^[0-9a-f]{1,4}$/i.test(segment)) {
        throw new Error('Invalid IPv6 segment');
      }
      return parseInt(segment, 16).toString(2).padStart(16, '0');
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
        '100.64.0.0/10',
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
        '0.0.0.0/8',        // "this network" (RFC 6890)
        '192.0.0.0/24', '192.0.2.0/24', '192.88.99.0/24',
        '198.18.0.0/15',    // benchmarking (RFC 2544)
        '198.51.100.0/24', '203.0.113.0/24', '240.0.0.0/4'
      ];
    } else {
      return [
        '100::/64',         // discard-only (RFC 6666)
        '2001:db8::/32'
      ];
    }
  }

  // Transition mechanisms; globally routable, so kept out of reserved().
  static transition(type) {
    if (type === 'ipv4') {
      return [];
    }
    return [
      '64:ff9b::/96',       // NAT64 well-known prefix (RFC 6052)
      '2001::/32',          // Teredo (RFC 4380)
      '2002::/16'           // 6to4 (RFC 3056)
    ];
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

  static span(spec) {
    return AddressSpan.from(spec);
  }

  static fromBigInt(value, version = 4) {
    if (version !== 4 && version !== 6) {
      throw new Error('Version must be 4 or 6');
    }
    const bits = version === 4 ? 32 : 128;
    value = BigInt(value);
    if (value < 0n || value >= (1n << BigInt(bits))) {
      throw new Error(`Value out of range for IPv${version}`);
    }
    return new NetworkAddress(value.toString(2).padStart(bits, '0'),
                              version === 4 ? 'ipv4' : 'ipv6');
  }

  static maskToPrefix(mask) {
    const address = this.address(mask);
    if (address.type !== 'ipv4') {
      throw new Error('Netmasks are only supported for IPv4');
    }
    if (!/^1*0*$/.test(address.binary)) {
      throw new Error(`Invalid netmask: ${mask}`);
    }
    return (address.binary.match(/1/g) || []).length;
  }

  static prefixToMask(prefix, version = 4) {
    const bits = version === 6 ? 128 : 32;
    if (!Number.isInteger(prefix) || prefix < 0 || prefix > bits) {
      throw new Error(`Invalid prefix length: ${prefix}`);
    }
    const binary = '1'.repeat(prefix) + '0'.repeat(bits - prefix);
    return new NetworkAddress(binary, version === 6 ? 'ipv6' : 'ipv4');
  }

  static fromBytes(bytes) {
    if (!Array.isArray(bytes) || (bytes.length !== 4 && bytes.length !== 16)) {
      throw new Error('Expected 4 (IPv4) or 16 (IPv6) bytes');
    }
    let binary = '';
    for (const byte of bytes) {
      if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
        throw new Error('Byte values must be integers between 0 and 255');
      }
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

  static isUnspecified(input) {
    return this.address(input).isUnspecified();
  }

  static isReserved(input) {
    return this.address(input).isReserved();
  }

  static isSpecial(input) {
    return this.address(input).isSpecial();
  }
}

// Export for different environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { IP, NetworkAddress, NetworkRange, AddressSpan, PrivateNetworks, SpecialNetworks };
} else if (typeof window !== 'undefined') {
  Object.assign(window, { IP, NetworkAddress, NetworkRange, AddressSpan, PrivateNetworks, SpecialNetworks });
}

/**
 * This file is part of Linkumori.
 * It contains the IP range checking logic for the extension.
 * 
 * @license LGPL-3.0-or-later
 */