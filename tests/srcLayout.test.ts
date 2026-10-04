import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';

const SRC = join(import.meta.dirname, '..', 'src');
const LAYERS = ['adapters', 'application', 'domain', 'ports'];

// lint の層の検査は層のディレクトリと index.ts にしか掛からないので、src の直下に置けるものを閉じる
describe('src の直下', () => {
  it('ファイルは index.ts だけ', () => {
    const files = readdirSync(SRC, { withFileTypes: true })
      .filter((entry) => !entry.isDirectory())
      .map((entry) => entry.name);
    assert.deepEqual(files, ['index.ts']);
  });
  it('ディレクトリは層だけ', () => {
    const directories = readdirSync(SRC, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .toSorted();
    assert.deepEqual(
      directories.filter((name) => !LAYERS.includes(name)),
      [],
    );
  });
});
