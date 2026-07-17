const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

function createCredentialStore(directory) {
  const masterKeyPath = path.join(directory, "credential.key");
  const encryptedDataPath = path.join(directory, "credentials.v2.json");
  let cachedApiKey;

  function has() {
    return fs.existsSync(encryptedDataPath);
  }

  function read() {
    if (cachedApiKey !== undefined) return cachedApiKey;
    if (!has()) {
      cachedApiKey = "";
      return cachedApiKey;
    }
    try {
      const payload = JSON.parse(fs.readFileSync(encryptedDataPath, "utf8"));
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        readMasterKey(),
        Buffer.from(String(payload.iv || ""), "base64")
      );
      decipher.setAuthTag(Buffer.from(String(payload.tag || ""), "base64"));
      cachedApiKey = Buffer.concat([
        decipher.update(Buffer.from(String(payload.data || ""), "base64")),
        decipher.final()
      ]).toString("utf8").trim();
      return cachedApiKey;
    } catch {
      cachedApiKey = "";
      return cachedApiKey;
    }
  }

  function write(value) {
    const apiKey = String(value || "").trim();
    if (!apiKey) {
      clear();
      return;
    }
    ensureDirectory();
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", readMasterKey(), iv);
    const encrypted = Buffer.concat([cipher.update(apiKey, "utf8"), cipher.final()]);
    const payload = JSON.stringify({
      version: 1,
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64"),
      tag: cipher.getAuthTag().toString("base64"),
      data: encrypted.toString("base64")
    });
    atomicPrivateWrite(encryptedDataPath, payload);
    cachedApiKey = apiKey;
  }

  function clear() {
    cachedApiKey = "";
    try { fs.rmSync(encryptedDataPath, { force: true }); } catch {}
    try { fs.rmSync(masterKeyPath, { force: true }); } catch {}
  }

  function archiveLegacy(legacyPath) {
    if (!fs.existsSync(legacyPath)) return false;
    ensureDirectory();
    const archivePath = `${legacyPath}.disabled-${Date.now()}`;
    try {
      fs.renameSync(legacyPath, archivePath);
      fs.chmodSync(archivePath, 0o600);
      return true;
    } catch {
      return false;
    }
  }

  function readMasterKey() {
    if (fs.existsSync(masterKeyPath)) {
      const key = fs.readFileSync(masterKeyPath);
      if (key.length === 32) return key;
    }
    ensureDirectory();
    const key = crypto.randomBytes(32);
    atomicPrivateWrite(masterKeyPath, key);
    return key;
  }

  function ensureDirectory() {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  }

  function atomicPrivateWrite(targetPath, data) {
    ensureDirectory();
    const temporaryPath = `${targetPath}.tmp-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporaryPath, data, { mode: 0o600 });
    fs.renameSync(temporaryPath, targetPath);
    fs.chmodSync(targetPath, 0o600);
  }

  return {
    has,
    read,
    write,
    clear,
    archiveLegacy,
    paths: { masterKeyPath, encryptedDataPath }
  };
}

module.exports = { createCredentialStore };
