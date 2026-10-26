import assert from "node:assert/strict"
import { execFileSync } from "node:child_process"
import { createHash } from "node:crypto"
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs"
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
    name: "factory-shark-readme-consumer",
    version: "0.0.0",
    private: true,
    type: "commonjs",
    dependencies: {
      "factory-shark": `file:${archivePath}`,
      "@sequelize/core": "7.0.0-alpha.48",
      "@sequelize/sqlite3": "7.0.0-alpha.48",
      sqlite3: "5.1.7",
    },
    devDependencies: {
      typescript: "5.4.5",
      "@types/node": "22",
      "@faker-js/faker": "8.4.1",
      vitest: "4.1.5",
      // Match WRAP's resolved Vite peer before npm builds its dependency graph.
      vite: "7.3.1",
    },
  }
  writeFileSync(join(consumerDirectory, "package.json"), JSON.stringify(consumerManifest))

  const installOutput = runCommand("npm", ["install", "--no-audit", "--no-fund"])
  console.log(installOutput)
}

function writeConsumerExamples() {
  const fixtureDirectory = join(projectRoot, "scripts/fixtures/readme")
  cpSync(fixtureDirectory, consumerDirectory, {
    recursive: true,
  })

  const readme = readFileSync(join(projectRoot, "README.md"), "utf8")
  const examplePattern = /^### `([^`]+\.ts)`[\s\S]*?^```typescript\n([\s\S]*?)^```/gm
  let exampleCount = 0

  for (const exampleMatch of readme.matchAll(examplePattern)) {
    const [, examplePath, exampleSource] = exampleMatch
    assert.match(examplePath, /^(?:factories\/)?[a-z-]+(?:\.test)?\.ts$/)

    const consumerPath = join(consumerDirectory, examplePath)
    mkdirSync(dirname(consumerPath), {
      recursive: true,
    })
    writeFileSync(consumerPath, exampleSource)
    exampleCount += 1
  }

  const documentedBlockCount = [...readme.matchAll(/^```typescript$/gm)].length
  assert.ok(exampleCount > 0, "README must contain executable TypeScript examples")
  assert.equal(exampleCount, documentedBlockCount, "Every TypeScript example needs a file heading")

  const compilerConfiguration = {
    compilerOptions: {
      target: "ES2020",
      module: "Node16",
      moduleResolution: "Node16",
      baseUrl: resolve(consumerDirectory),
      paths: {
        "@/*": ["*"],
      },
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      noEmitOnError: true,
      outDir: "compiled",
      types: ["node", "vitest/globals"],
    },
    include: ["**/*.ts"],
  }
  writeFileSync(join(consumerDirectory, "tsconfig.json"), JSON.stringify(compilerConfiguration))

  const vitestConfiguration = {
    resolve: {
      alias: {
        "@": resolve(consumerDirectory),
      },
    },
    test: {
      globals: true,
      setupFiles: ["./setup.ts"],
      include: ["*-factory.test.ts"],
      fileParallelism: false,
    },
  }
  writeFileSync(
    join(consumerDirectory, "vitest.config.mjs"),
    `export default ${JSON.stringify(vitestConfiguration)}`
  )
}

function verifyTypedConsumer() {
  const compilerPath = join(consumerDirectory, "node_modules/typescript/bin/tsc")
  const compilerOutput = runCommand(process.execPath, [compilerPath])
  console.log(compilerOutput)

  const vitestPath = join(consumerDirectory, "node_modules/vitest/vitest.mjs")
  const exampleOutput = runCommand(process.execPath, [
    vitestPath,
    "run",
    "--config",
    "vitest.config.mjs",
  ])
  console.log(exampleOutput)
  console.log("Packed consumer PASS: README factory modules and focused Vitest scenarios")
}

function verifyCommonJsConsumer() {
  const pruneOutput = runCommand("npm", ["prune", "--omit=dev", "--no-audit", "--no-fund"])
  console.log(pruneOutput)

  const commonJsExample = `
    const assert = require("node:assert/strict")
    const { FactoryShark } = require("factory-shark")
    const { User } = require("./compiled/models")
    const { initializeModels } = require("./compiled/initialize-models")

    async function verifyBuild() {
      const sequelize = initializeModels()

      try {
        const userFactory = FactoryShark.define(User, () => ({
          firstName: "CommonJS",
          lastName: "Consumer",
          email: "commonjs@example.com",
          authSubject: "commonjs@example.com",
        }))

        const user = userFactory.build()

        assert.equal(user.firstName, "CommonJS")
        console.log("CommonJS runtime-only consumer PASS: factory build")
      } finally {
        await sequelize.close()
      }
    }

    verifyBuild().catch((error) => {
      console.error(error)
      process.exitCode = 1
    })
  `
  const consumerOutput = runCommand(process.execPath, ["-e", commonJsExample])
  console.log(consumerOutput)
}

function verifyInstalledVersion() {
  const versionCheck = `
    const assert = require("node:assert/strict")
    const metadata = require("factory-shark/package.json")

    assert.equal(metadata.version, ${JSON.stringify(version)})
    console.log("Installed factory-shark@" + metadata.version)
  `
  const versionOutput = runCommand(process.execPath, ["-e", versionCheck])
  console.log(versionOutput)
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
  writeConsumerExamples()
  verifyTypedConsumer()
  verifyCommonJsConsumer()
  verifyInstalledVersion()
} finally {
  rmSync(consumerDirectory, {
    recursive: true,
    force: true,
  })
}
