import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBootstrapPayloadEnvelope,
  reconstructBootstrapChunkItems,
} from './squad-bootstrap-validator.mjs';

function chunkItems(payloadText) {
  const envelope = createBootstrapPayloadEnvelope(payloadText);
  return Array.from({ length: Number(envelope.payload_chunk_count) }, (_, index) => {
    const ordinal = String(index).padStart(2, '0');
    return {
      payload_byte_length: envelope.payload_byte_length,
      payload_sha256: envelope.payload_sha256,
      payload_chunk_count: envelope.payload_chunk_count,
      payload_chunk_index: ordinal,
      payload_chunk: envelope[`payload_chunk_${ordinal}`],
    };
  });
}

test('reconstructs a payload larger than the failed aggregate transport', () => {
  const payload = JSON.stringify({ value: 'x'.repeat(32_127) });
  assert.equal(reconstructBootstrapChunkItems(chunkItems(payload)), payload);
});

test('rejects a truncated deterministic chunk', () => {
  const items = chunkItems(JSON.stringify({ value: 'x'.repeat(32_127) }));
  items[3].payload_chunk = items[3].payload_chunk.slice(0, -4);
  assert.throws(
    () => reconstructBootstrapChunkItems(items),
    /decoded length does not match the deterministic chunk boundary/,
  );
});

test('rejects missing, duplicate, reordered, and metadata-inconsistent chunk items', () => {
  const missing = chunkItems('x'.repeat(12_100));
  missing.pop();
  assert.throws(
    () => reconstructBootstrapChunkItems(missing),
    /item count does not match payload_chunk_count/,
  );

  const duplicate = chunkItems('x'.repeat(12_100));
  duplicate[1].payload_chunk_index = duplicate[0].payload_chunk_index;
  assert.throws(
    () => reconstructBootstrapChunkItems(duplicate),
    /must have ordinal 01/,
  );

  const reordered = chunkItems('x'.repeat(12_100));
  [reordered[0], reordered[1]] = [reordered[1], reordered[0]];
  assert.throws(
    () => reconstructBootstrapChunkItems(reordered),
    /must have ordinal 00/,
  );

  const inconsistent = chunkItems('x'.repeat(12_100));
  inconsistent[1].payload_sha256 = '0'.repeat(64);
  assert.throws(
    () => reconstructBootstrapChunkItems(inconsistent),
    /metadata is inconsistent/,
  );

  for (const field of ['payload_byte_length', 'payload_chunk_count']) {
    const items = chunkItems('x'.repeat(12_100));
    items[1][field] = String(Number(items[1][field]) + 1);
    assert.throws(
      () => reconstructBootstrapChunkItems(items),
      /metadata is inconsistent/,
    );
  }
});
