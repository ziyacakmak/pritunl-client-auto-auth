#!/usr/bin/env python3
"""Decode a Google Authenticator otpauth-migration:// export payload locally."""
import base64
import sys
import urllib.parse


def read_varint(buf, i):
    shift = 0
    value = 0
    while True:
        if i >= len(buf):
            raise ValueError("truncated varint")
        byte = buf[i]
        i += 1
        value |= (byte & 0x7f) << shift
        if not byte & 0x80:
            return value, i
        shift += 7
        if shift > 70:
            raise ValueError("varint too long")


def parse_fields(buf):
    fields = []
    i = 0
    while i < len(buf):
        key, i = read_varint(buf, i)
        number = key >> 3
        wire = key & 7
        if wire == 0:
            value, i = read_varint(buf, i)
        elif wire == 2:
            length, i = read_varint(buf, i)
            value = buf[i:i + length]
            i += length
        elif wire == 5:
            value = buf[i:i + 4]
            i += 4
        elif wire == 1:
            value = buf[i:i + 8]
            i += 8
        else:
            raise ValueError("unsupported wire type %d" % wire)
        fields.append((number, wire, value))
    return fields


def get_varint(fields, number, default=0):
    for num, wire, value in fields:
        if num == number and wire == 0:
            return value
    return default


def get_bytes(fields, number, default=b""):
    for num, wire, value in fields:
        if num == number and wire == 2:
            return value
    return default


def main():
    if len(sys.argv) != 2:
        print("usage: %s 'otpauth-migration://offline?data=...'" % sys.argv[0],
              file=sys.stderr)
        return 2

    raw = sys.argv[1].strip()
    if raw.startswith("otpauth-migration://"):
        query = urllib.parse.urlparse(raw).query
        raw = urllib.parse.parse_qs(query).get("data", [""])[0]
    raw = urllib.parse.unquote(raw)
    payload = base64.b64decode(raw + "=" * (-len(raw) % 4))

    algorithms = {0: "unspecified", 1: "SHA1", 2: "SHA256", 3: "SHA512", 4: "MD5"}
    digits = {0: "unspecified", 1: "6", 2: "8"}
    types = {0: "unspecified", 1: "HOTP", 2: "TOTP"}

    for number, wire, value in parse_fields(payload):
        if number != 1 or wire != 2:
            continue
        fields = parse_fields(value)
        secret = get_bytes(fields, 1)
        name = get_bytes(fields, 2).decode("utf-8", "replace")
        issuer = get_bytes(fields, 3).decode("utf-8", "replace")
        algorithm = algorithms.get(get_varint(fields, 4), "?")
        digit_count = digits.get(get_varint(fields, 5), "?")
        otp_type = types.get(get_varint(fields, 6), "?")
        counter = get_varint(fields, 7, 0)
        base32 = base64.b32encode(secret).decode("ascii").rstrip("=")
        print("issuer:   %s" % issuer)
        print("name:     %s" % name)
        print("type:     %s" % otp_type)
        print("algorithm:%s" % algorithm)
        print("digits:   %s" % digit_count)
        if otp_type == "HOTP":
            print("counter:  %d" % counter)
        print("secret:   %s" % base32)
        print()


if __name__ == "__main__":
    sys.exit(main())
