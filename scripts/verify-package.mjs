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
    "dist/index.mjs",
    "dist/index.cjs",
    "dist/types/index.d.mts",
    "dist/types/index.d.cts",
    "LICENSE",
    "NOTICE",
  ]
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
  assert.ok(!packedFiles.has("dist/index.js"), "Legacy CommonJS entrypoint must be absent")
  assert.ok(!packedFiles.has("dist/index.d.ts"), "Legacy root declaration must be absent")
}

function verifyInstalledArtifactImports(artifact) {
  const packageDirectory = join(consumerDirectory, "node_modules/factory-shark")

  for (const { path: packedPath } of artifact.files) {
    if (!/^dist\/.*\.(?:mjs|cjs|js|d\.(?:mts|cts|ts))$/.test(packedPath)) {
      continue
    }

    const sourcePath = join(packageDirectory, packedPath)
    const source = readFileSync(sourcePath, "utf8")
    assert.doesNotMatch(
      source,
      /["']@\//,
      `Installed artifact contains a root alias: ${packedPath}`
    )
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
      "tsc-alias": "1.9.9",
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
  const fixturePath = join(projectRoot, "scripts/fixtures/sequelize-v6/consumer.ts")
  const consumerSource = readFileSync(fixturePath, "utf8")
  writeFileSync(join(v6ConsumerDirectory, "consumer.cts"), consumerSource)
  writeFileSync(join(v6ConsumerDirectory, "consumer.mts"), consumerSource)

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
    include: ["consumer.cts", "consumer.mts"],
  }
  writeFileSync(join(v6ConsumerDirectory, "tsconfig.json"), JSON.stringify(compilerConfiguration))
}

function verifySequelizeV6ConsumerBoundary(v6ConsumerDirectory) {
  const dependencyCheck = `
    const assert = require("node:assert/strict")
    const { createRequire } = require("node:module")
    const consumerRequire = createRequire(${JSON.stringify(join(v6ConsumerDirectory, "package.json"))})
    const packageManifest = consumerRequire("factory-shark/package.json")

    const packageExports = packageManifest.exports["."]
    assert.equal(packageManifest.main, "./dist/index.cjs")
    assert.equal(packageManifest.module, "./dist/index.mjs")
    assert.equal(packageManifest.types, "./dist/types/index.d.cts")
    const loadedPackage = consumerRequire("factory-shark")

    assert.equal(packageExports.import.types, "./dist/types/index.d.mts")
    assert.equal(packageExports.import.default, "./dist/index.mjs")
    assert.equal(packageExports.require.types, "./dist/types/index.d.cts")
    assert.equal(packageExports.require.default, "./dist/index.cjs")
    assert.equal(packageExports.default, "./dist/index.mjs")
    assert.equal(typeof loadedPackage.FactoryShark.define, "function")
    assert.equal(typeof loadedPackage.default.define, "function")

    for (const dependency of ["@sequelize/core", "@sequelize/sqlite3"]) {
      assert.throws(() => consumerRequire.resolve(dependency), { code: "MODULE_NOT_FOUND" })
    }

    console.log("Sequelize 6 consumer dependency boundary PASS: root exports, no Sequelize 7 packages")
  `
  const dependencyOutput = runCommand(
    process.execPath,
    ["-e", dependencyCheck],
    v6ConsumerDirectory
  )
  console.log(dependencyOutput)
}

function runSequelizeV6Programs(v6ConsumerDirectory, installStage) {
  for (const runtimeFile of ["consumer.mjs", "consumer.cjs"]) {
    const consumerOutput = runCommand(
      process.execPath,
      [join(v6ConsumerDirectory, "compiled", runtimeFile)],
      v6ConsumerDirectory
    )
    console.log(`Sequelize 6 ${runtimeFile} (${installStage}):\n${consumerOutput}`)
  }
}

function runSequelizeV6Consumer(archivePath, v6ConsumerDirectory) {
  installSequelizeV6Consumer(archivePath, v6ConsumerDirectory)
  writeSequelizeV6Consumer(v6ConsumerDirectory)
  verifySequelizeV6ConsumerBoundary(v6ConsumerDirectory)

  const compilerPath = join(v6ConsumerDirectory, "node_modules/typescript/bin/tsc")
  const compilerOutput = runCommand(process.execPath, [compilerPath], v6ConsumerDirectory)
  console.log(compilerOutput)
  runSequelizeV6Programs(v6ConsumerDirectory, "with development dependencies")

  const pruneOutput = runCommand(
    "npm",
    ["prune", "--omit=dev", "--no-audit", "--no-fund"],
    v6ConsumerDirectory
  )
  console.log(pruneOutput)

  verifySequelizeV6ConsumerBoundary(v6ConsumerDirectory)
  runSequelizeV6Programs(v6ConsumerDirectory, "after pruning development dependencies")
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
    const packageExports = packageManifest.exports["."]
    const loadedPackage = consumerRequire("factory-shark")
    assert.equal(packageManifest.main, "./dist/index.cjs")
    assert.equal(packageManifest.module, "./dist/index.mjs")
    assert.equal(packageManifest.types, "./dist/types/index.d.cts")

    assert.equal(packageExports.import.types, "./dist/types/index.d.mts")
    assert.equal(packageExports.import.default, "./dist/index.mjs")
    assert.equal(packageExports.require.types, "./dist/types/index.d.cts")
    assert.equal(packageExports.require.default, "./dist/index.cjs")
    assert.equal(packageExports.default, "./dist/index.mjs")
    assert.equal(typeof loadedPackage.FactoryShark.define, "function")
    assert.equal(typeof loadedPackage.default.define, "function")
    assert.throws(() => consumerRequire.resolve("sequelize"), { code: "MODULE_NOT_FOUND" })

    console.log("Sequelize 7 consumer dependency boundary PASS: root exports, no Sequelize 6 package")
  `
  const dependencyOutput = runCommand(process.execPath, ["-e", dependencyCheck])
  console.log(dependencyOutput)
}

function runSequelizeV7Programs(installStage) {
  const v7ConsumerDirectory = join(consumerDirectory, "sequelize-v7")

  for (const runtimeFile of ["consumer.mjs", "consumer.cjs"]) {
    const consumerOutput = runCommand(
      process.execPath,
      [join(v7ConsumerDirectory, "compiled", runtimeFile)],
      v7ConsumerDirectory
    )
    console.log(`Sequelize 7 ${runtimeFile} (${installStage}):\n${consumerOutput}`)
  }
}

function verifySequelizeV7TypesAndRuntime() {
  const v7ConsumerDirectory = join(consumerDirectory, "sequelize-v7")
  const fixturePath = join(projectRoot, "scripts/fixtures/sequelize-v7-consumer.ts")
  const fixtureSource = readFileSync(fixturePath, "utf8")
  mkdirSync(v7ConsumerDirectory, {
    recursive: true,
  })
  writeFileSync(join(v7ConsumerDirectory, "consumer.mts"), fixtureSource)
  writeFileSync(join(v7ConsumerDirectory, "consumer.cts"), fixtureSource)

  const compilerConfiguration = {
    compilerOptions: {
      target: "ES2020",
      // Sequelize 7 declares Error.cause; supported Node 22/24 provide this native API.
      lib: ["ES2022"],
      module: "Node16",
      moduleResolution: "Node16",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: false,
      noEmitOnError: true,
      outDir: "compiled",
      types: ["node"],
    },
    include: ["consumer.cts", "consumer.mts"],
  }
  writeFileSync(join(v7ConsumerDirectory, "tsconfig.json"), JSON.stringify(compilerConfiguration))

  const compilerPath = join(consumerDirectory, "node_modules/typescript/bin/tsc")
  const compilerOutput = runCommand(process.execPath, [compilerPath], v7ConsumerDirectory)
  console.log(compilerOutput)
  runSequelizeV7Programs("with development dependencies")
}

function verifyTypedConsumer() {
  const compilerPath = join(consumerDirectory, "node_modules/typescript/bin/tsc")
  const compilerOutput = runCommand(process.execPath, [compilerPath])
  console.log(compilerOutput)

  // Rewrite source aliases so the compiled runtime harness can use Node directly.
  const aliasRewriteOutput = runCommand("npm", ["exec", "--", "tsc-alias", "-p", "tsconfig.json"])
  console.log(aliasRewriteOutput)

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
  runSequelizeV7Programs("after pruning development dependencies")

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
  verifyInstalledArtifactImports(artifact)
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
