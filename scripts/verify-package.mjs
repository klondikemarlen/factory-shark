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
  const requiredFiles = ["dist/index.js", "dist/index.d.ts", "dist/types.d.ts", "LICENSE", "NOTICE"]
  for (const requiredFile of requiredFiles) {
    assert.ok(packedFiles.has(requiredFile), `Missing packed file: ${requiredFile}`)
  }

  for (const packedFile of packedFiles) {
    assert.doesNotMatch(packedFile, /^dist\/sequelize-v[67]\./)
  }

  const allowedPath = /^(dist\/|src\/|package\.json$|README\.md$|LICENSE$|NOTICE$)/

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

function installSequelizeV6Consumer(archivePath, v6ConsumerDirectory) {
  const consumerManifest = {
    name: "factory-shark-sequelize-v6-consumer",
    version: "0.0.0",
    private: true,
    type: "commonjs",
    dependencies: {
      "factory-shark": `file:${archivePath}`,
      sequelize: "6.37.8",
      sqlite3: "5.1.7",
    },
    devDependencies: {
      typescript: "5.4.5",
      "@types/node": "22",
    },
  }
  writeFileSync(join(v6ConsumerDirectory, "package.json"), JSON.stringify(consumerManifest))

  const installOutput = runCommand(
    "npm",
    ["install", "--no-audit", "--no-fund"],
    v6ConsumerDirectory
  )
  console.log(installOutput)
}

function writeSequelizeV6Consumer(v6ConsumerDirectory) {
  const fixtureDirectory = join(projectRoot, "scripts/fixtures/sequelize-v6")
  cpSync(fixtureDirectory, v6ConsumerDirectory, {
    recursive: true,
  })

  const compilerConfiguration = {
    compilerOptions: {
      target: "ES2020",
      module: "Node16",
      moduleResolution: "Node16",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: false,
      noEmitOnError: true,
      outDir: "compiled",
      types: ["node"],
    },
    include: ["**/*.ts"],
  }
  writeFileSync(join(v6ConsumerDirectory, "tsconfig.json"), JSON.stringify(compilerConfiguration))
}

function runSequelizeV6Consumer(archivePath, v6ConsumerDirectory) {
  installSequelizeV6Consumer(archivePath, v6ConsumerDirectory)
  writeSequelizeV6Consumer(v6ConsumerDirectory)

  const dependencyCheck = `
    const assert = require("node:assert/strict")
    const { createRequire } = require("node:module")
    const consumerRequire = createRequire(${JSON.stringify(join(v6ConsumerDirectory, "package.json"))})
    const packageManifest = consumerRequire("factory-shark/package.json")

    assert.equal(packageManifest.exports["."].require, "./dist/index.js")
    assert.equal(typeof consumerRequire("factory-shark").FactoryShark.define, "function")

    for (const dependency of ["@sequelize/core", "@sequelize/sqlite3"]) {
      assert.throws(() => consumerRequire.resolve(dependency), { code: "MODULE_NOT_FOUND" })
    }

    console.log("Sequelize 6 consumer dependency boundary PASS: root API, no Sequelize 7 packages")
  `
  const dependencyOutput = runCommand(
    process.execPath,
    ["-e", dependencyCheck],
    v6ConsumerDirectory
  )
  console.log(dependencyOutput)

  const compilerPath = join(v6ConsumerDirectory, "node_modules/typescript/bin/tsc")
  const compilerOutput = runCommand(process.execPath, [compilerPath], v6ConsumerDirectory)
  console.log(compilerOutput)

  const consumerOutput = runCommand(
    process.execPath,
    [join(v6ConsumerDirectory, "compiled/consumer.js")],
    v6ConsumerDirectory
  )
  console.log(consumerOutput)
}

function verifySequelizeV6Consumer(archivePath) {
  const v6ConsumerDirectory = mkdtempSync(join(tmpdir(), "factory-shark-sequelize-v6-consumer-"))

  try {
    runSequelizeV6Consumer(archivePath, v6ConsumerDirectory)
  } finally {
    rmSync(v6ConsumerDirectory, {
      recursive: true,
      force: true,
    })
  }
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
function verifySequelizeV7ConsumerBoundary() {
  const dependencyCheck = `
    const assert = require("node:assert/strict")
    const { createRequire } = require("node:module")
    const consumerRequire = createRequire(${JSON.stringify(join(consumerDirectory, "package.json"))})
    const packageManifest = consumerRequire("factory-shark/package.json")

    assert.ok(packageManifest.exports["."])
    assert.equal(typeof consumerRequire("factory-shark").FactoryShark.define, "function")
    assert.throws(() => consumerRequire.resolve("sequelize"), { code: "MODULE_NOT_FOUND" })

    console.log("Sequelize 7 consumer dependency boundary PASS: root API, no Sequelize 6 package")
  `
  const dependencyOutput = runCommand(process.execPath, ["-e", dependencyCheck])
  console.log(dependencyOutput)
}

function verifySequelizeV7TypesAndRuntime() {
  const v7ConsumerDirectory = join(consumerDirectory, "sequelize-v7")
  const v7ConsumerPath = join(v7ConsumerDirectory, "consumer.ts")
  const v7FixturePath = join(projectRoot, "scripts/fixtures/sequelize-v7-consumer.ts")
  mkdirSync(v7ConsumerDirectory, {
    recursive: true,
  })
  writeFileSync(v7ConsumerPath, readFileSync(v7FixturePath, "utf8"))

  const compilerConfiguration = {
    compilerOptions: {
      target: "ES2020",
      module: "Node16",
      moduleResolution: "Node16",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: false,
      noEmitOnError: true,
      outDir: "compiled",
      types: ["node"],
    },
    include: ["consumer.ts"],
  }
  writeFileSync(join(v7ConsumerDirectory, "tsconfig.json"), JSON.stringify(compilerConfiguration))

  const compilerPath = join(consumerDirectory, "node_modules/typescript/bin/tsc")
  const compilerOutput = runCommand(process.execPath, [compilerPath], v7ConsumerDirectory)
  console.log(compilerOutput)

  const consumerOutput = runCommand(
    process.execPath,
    [join(v7ConsumerDirectory, "compiled/consumer.js")],
    v7ConsumerDirectory
  )
  console.log(consumerOutput)
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
  verifySequelizeV7ConsumerBoundary()

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

function verifyInstalledPackageMetadata() {
  const versionCheck = `
    const assert = require("node:assert/strict")
    const metadata = require("factory-shark/package.json")

    assert.equal(metadata.version, ${JSON.stringify(version)})
    assert.equal(metadata.license, "Apache-2.0")
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
  verifySequelizeV7TypesAndRuntime()
  verifySequelizeV7ConsumerBoundary()
  writeConsumerExamples()
  verifyTypedConsumer()
  verifyCommonJsConsumer()
  verifyInstalledPackageMetadata()
  verifySequelizeV6Consumer(archivePath)
} finally {
  rmSync(consumerDirectory, {
    recursive: true,
    force: true,
  })
}
