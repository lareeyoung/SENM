const { execFileSync } = require("node:child_process");
const path = require("node:path");

const appPath = process.argv[2]
  ? path.resolve(process.argv[2])
  : path.resolve("release/mac-arm64/SENM.app");

function run(command, args) {
  execFileSync(command, args, { stdio: "inherit" });
}

if (process.platform !== "darwin") {
  console.log("Skipping ad-hoc signing because this is not macOS.");
  process.exit(0);
}

run("xattr", ["-cr", appPath]);
run("codesign", ["--force", "--deep", "--sign", "-", appPath]);
run("codesign", ["--verify", "--deep", "--strict", "--verbose=4", appPath]);
