import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hex, dec, ascii, shortUuid, parseUuids } from '../js/granboard-utils.js';

const dv = (...bytes) => new DataView(new Uint8Array(bytes).buffer);

test('messaggi grezzi: esadecimale, decimale e testo', () => {
  assert.equal(hex(dv(1, 171, 255)), '01 ab ff');
  assert.equal(dec(dv(1, 171, 255)), '1 171 255');
  assert.equal(ascii(dv(72, 105, 0, 10, 126)), 'Hi..~');
  assert.equal(hex(dv()), '');
  // una vista su una parte di un buffer piu' grande
  const buf = new Uint8Array([9, 8, 7, 6]).buffer;
  assert.equal(hex(new DataView(buf, 1, 2)), '08 07');
});

test('UUID: accorcia solo quelli standard Bluetooth', () => {
  assert.equal(shortUuid('0000180f-0000-1000-8000-00805f9b34fb'), '180f');
  assert.equal(shortUuid('6e400001-b5a3-f393-e0a9-e50e24dcca9e'), '6e400001-b5a3-f393-e0a9-e50e24dcca9e');
});

test('elenco di UUID scritto a mano', () => {
  const r = parseUuids('ffe0\n0xFFF0, 6E400001-B5A3-F393-E0A9-E50E24DCCA9E ;ffe0 xyz 12345');
  assert.deepEqual(r.ok, [0xffe0, 0xfff0, '6e400001-b5a3-f393-e0a9-e50e24dcca9e']);
  assert.deepEqual(r.ko, ['xyz', '12345']);
  assert.deepEqual(parseUuids('   '), { ok: [], ko: [] });
  assert.deepEqual(parseUuids('12345678').ok, [0x12345678]);
});
