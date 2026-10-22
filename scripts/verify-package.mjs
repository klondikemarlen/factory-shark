import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const { version } = JSON.parse(readFileSync(join(root, "package.json"), "utf8"))
const consumer = mkdtempSync(join(tmpdir(), "factory-shark-consumer-"))

function run(command, args, cwd = consumer) {
  return execFileSync(command, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] })
}

try {
  const [artifact] = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", consumer], root))
  const archive = join(consumer, artifact.filename)
  const digest = createHash("sha256").update(readFileSync(archive)).digest("hex")
  console.log(`Artifact: ${artifact.filename}; sha256=${digest}; integrity=${artifact.integrity}`)

  const files = new Set(artifact.files.map((file) => file.path))
  for (const required of ["dist/index.js", "dist/index.d.ts", "dist/types.d.ts", "LICENSE", "LICENSE-APACHE", "NOTICE"]) {
    assert.ok(files.has(required), `Missing packed file: ${required}`)
  }
  for (const path of files) {
    assert.match(path, /^(dist\/|src\/|package\.json$|README\.md$|LICENSE$|LICENSE-APACHE$|NOTICE$)/)
  }

  writeFileSync(join(consumer, "package.json"), JSON.stringify({ private: true, type: "commonjs" }))
  console.log(run("npm", [
    "install", "--no-audit", "--no-fund", archive,
    "@sequelize/core@7.0.0-alpha.48", "@sequelize/sqlite3@7.0.0-alpha.48", "sqlite3@5.1.7",
    "typescript@5.9.3", "@types/node@22",
  ]))

  const readme = readFileSync(join(root, "README.md"), "utf8")
  const example = readme.match(/```typescript\n([\s\S]*?)\n```/)
  assert.ok(example, "README must contain the complete typed consumer example")
  writeFileSync(join(consumer, "example.ts"), example[1])
  writeFileSync(join(consumer, "tsconfig.json"), JSON.stringify({
    compilerOptions: {
      target: "ES2022",
      module: "Node16",
      moduleResolution: "Node16",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmitOnError: true,
    },
    include: ["example.ts"],
  }))
  console.log(run(process.execPath, [join(consumer, "node_modules/typescript/bin/tsc")]))
  console.log(run(process.execPath, [join(consumer, "example.js")]))
  console.log(run(process.execPath, ["-e", `
    const assert = require('node:assert/strict');
    const library = require('factory-shark');
    const metadata = require('factory-shark/package.json');
    assert.equal(library.default, library.FactoryShark);
    assert.equal(metadata.version, ${JSON.stringify(version)});
    console.log('CommonJS root import PASS; installed factory-shark@' + metadata.version);
  `]))
} finally {
  rmSync(consumer, { recursive: true, force: true })
}
