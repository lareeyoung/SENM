const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { createCredentialStore } = require("../electron/credential-store.cjs");

test("credential store encrypts, caches, reloads and clears without a system keychain", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "see2p-credentials-"));
  try {
    const store = createCredentialStore(directory);
    store.write("test-example-secret");

    assert.equal(store.has(), true);
    assert.equal(store.read(), "test-example-secret");
    assert.equal(fs.readFileSync(store.paths.encryptedDataPath, "utf8").includes("test-example-secret"), false);
    assert.equal(fs.statSync(store.paths.masterKeyPath).mode & 0o777, 0o600);
    assert.equal(fs.statSync(store.paths.encryptedDataPath).mode & 0o777, 0o600);

    const reloaded = createCredentialStore(directory);
    assert.equal(reloaded.read(), "test-example-secret");
    reloaded.clear();
    assert.equal(reloaded.has(), false);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

test("legacy keychain payload is archived without decrypting it", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "see2p-legacy-"));
  try {
    const legacyPath = path.join(directory, "credentials.bin");
    fs.writeFileSync(legacyPath, "legacy-encrypted-payload", { mode: 0o600 });
    const store = createCredentialStore(directory);

    assert.equal(store.archiveLegacy(legacyPath), true);
    assert.equal(fs.existsSync(legacyPath), false);
    assert.equal(fs.readdirSync(directory).some((name) => name.startsWith("credentials.bin.disabled-")), true);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
