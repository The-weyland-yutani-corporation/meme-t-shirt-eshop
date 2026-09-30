import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createBootstrapPayloadEnvelope,
  reconstructBootstrapChunkItems,
} from './squad-bootstrap-validator.mjs';
import { validateRoutingTargets } from './squad-cast-validator.mjs';
import {
  canonicalizeImplementationProvenanceItems,
  evaluateImplementationProvenanceItems,
} from './squad-implementation-provenance.mjs';

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

test('requires routing targets to use active registry agent IDs', () => {
  const routing = `# Squad Routing

## Routing Table

| Work Type | Route To | Examples |
| --- | --- | --- |
| Storefront application features | storefront | Product catalog |
`;
  assert.deepEqual(validateRoutingTargets(routing, ['storefront']), []);

  const displayNameRouting = routing.replace('| storefront |', '| Storefront Engineer |');
  assert.deepEqual(
    validateRoutingTargets(displayNameRouting, ['storefront']),
    [
      'routing: target "Storefront Engineer" is not an active registry agent ID',
      'routing: active member "storefront" has no route',
    ],
  );
});

test('canonicalizes deterministic implementation provenance fields before validation', () => {
  const items = canonicalizeImplementationProvenanceItems({
    items: [
      {
        type: 'create_pull_request',
        temporary_id: 'aw_pr15',
        branch: 'squad/implement-15-nextjs-scaffold',
        title: 'Implement #15',
        body: 'Closes #15',
      },
      {
        type: 'record_implementation_provenance',
        pull_request: 'aw_pr15',
        goals_json: '["Closes #15"]',
        replaces_json: '[]',
      },
    ],
    repository: 'owner/repo',
    issueNumber: 15,
    runId: 123,
    requireLegacyMarker: true,
  });
  assert.equal(
    items[0].body,
    'Closes #15\n\n<!-- squad:implement issue=15 run=123 -->',
  );
  assert.equal(
    items[1].goals_json,
    '[{"repository":"owner/repo","issue":15,"relationship":"closes"}]',
  );
  assert.deepEqual(
    evaluateImplementationProvenanceItems({
      items,
      repository: 'owner/repo',
      issueNumber: 15,
      namespace: 'implement',
      runId: 123,
      requireLegacyMarker: true,
    }),
    { ok: true, enforced: true, violations: [] },
  );
});
