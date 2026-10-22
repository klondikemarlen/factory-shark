import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const packageManifest = readFileSync(join(projectRoot, "package.json"), "utf8")
const { version } = JSON.parse(packageManifest)
const consumerDirectory = mkdtempSync(join(tmpdir(), "factory-shark-consumer-"))

function runCommand(command, argumentsList, workingDirectory = consumerDirectory) {
  return execFileSync(command, argumentsList, {
    cwd: workingDirectory,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  })
}

function verifyPackageContents(artifact) {
  const packedFiles = new Set(artifact.files.map((file) => file.path))
  const requiredFiles = [
    "dist/index.js",
    "dist/index.d.ts",
    "dist/types.d.ts",
    "LICENSE",
    "LICENSE-APACHE",
    "NOTICE",
  ]

  for (const requiredFile of requiredFiles) {
    assert.ok(packedFiles.has(requiredFile), `Missing packed file: ${requiredFile}`)
  }

  const allowedPath = /^(dist\/|src\/|package\.json$|README\.md$|LICENSE$|LICENSE-APACHE$|NOTICE$)/

  for (const packedFile of packedFiles) {
    assert.match(packedFile, allowedPath)
  }
}

function installConsumerDependencies(archivePath) {
  const consumerManifest = {
    private: true,
    type: "commonjs",
  }
  writeFileSync(join(consumerDirectory, "package.json"), JSON.stringify(consumerManifest))

  const installOutput = runCommand("npm", [
    "install",
    "--no-audit",
    "--no-fund",
    archivePath,
    "@sequelize/core@7.0.0-alpha.48",
    "@sequelize/sqlite3@7.0.0-alpha.48",
    "sqlite3@5.1.7",
    "typescript@5.9.3",
    "@types/node@22",
  ])
  console.log(installOutput)
}

function writeConsumerExample() {
  const readme = readFileSync(join(projectRoot, "README.md"), "utf8")
  const exampleMatch = readme.match(/```typescript\n([\s\S]*?)\n```/)
  assert.ok(exampleMatch, "README must contain the complete typed consumer example")

  writeFileSync(join(consumerDirectory, "example.ts"), exampleMatch[1])

  const compilerConfiguration = {
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
  }
  writeFileSync(join(consumerDirectory, "tsconfig.json"), JSON.stringify(compilerConfiguration))
}

function verifyTypedConsumer() {
  const compilerPath = join(consumerDirectory, "node_modules/typescript/bin/tsc")
  const compilerOutput = runCommand(process.execPath, [compilerPath])
  console.log(compilerOutput)

  const examplePath = join(consumerDirectory, "example.js")
  const exampleOutput = runCommand(process.execPath, [examplePath])
  console.log(exampleOutput)
}

function verifyCommonJsConsumer() {
  const commonJsExample = `
    const assert = require("node:assert/strict")
    const library = require("factory-shark")
    const metadata = require("factory-shark/package.json")

    assert.equal(library.default, library.FactoryShark)
    assert.equal(metadata.version, ${JSON.stringify(version)})

    console.log("CommonJS root import PASS; installed factory-shark@" + metadata.version)
  `
  const consumerOutput = runCommand(process.execPath, ["-e", commonJsExample])
  console.log(consumerOutput)
}

try {
  const packOutput = runCommand(
    "npm",
    ["pack", "--json", "--pack-destination", consumerDirectory],
    projectRoot
  )
  const [artifact] = JSON.parse(packOutput)
  const archivePath = join(consumerDirectory, artifact.filename)
  const archiveContents = readFileSync(archivePath)
  const archiveDigest = createHash("sha256").update(archiveContents).digest("hex")
  console.log(
    `Artifact: ${artifact.filename}; sha256=${archiveDigest}; integrity=${artifact.integrity}`
  )

  verifyPackageContents(artifact)
  installConsumerDependencies(archivePath)
  writeConsumerExample()
  verifyTypedConsumer()
  verifyCommonJsConsumer()
} finally {
  rmSync(consumerDirectory, {
    recursive: true,
    force: true,
  })
}
