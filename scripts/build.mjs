import { execFileSync } from "node:child_process"
import { copyFileSync, rmSync } from "node:fs"
import { fileURLToPath } from "node:url"

const projectRoot = fileURLToPath(new URL("../", import.meta.url))
const distDirectory = new URL("../dist/", import.meta.url)
const declarationDirectory = new URL("../dist/types/", import.meta.url)

function runNodeScript(scriptPath, args) {
  const absoluteScriptPath = fileURLToPath(new URL(scriptPath, import.meta.url))

  execFileSync(process.execPath, [absoluteScriptPath, ...args], {
    cwd: projectRoot,
    stdio: "inherit",
  })
}

rmSync(distDirectory, {
  recursive: true,
  force: true,
})

runNodeScript("../node_modules/vite/bin/vite.js", ["build"])
runNodeScript("../node_modules/typescript/bin/tsc", ["-p", "tsconfig.build.json"])
runNodeScript("../node_modules/tsc-alias/dist/bin/index.js", ["-p", "tsconfig.build.json"])

const declarationEntry = new URL("index.d.ts", declarationDirectory)
copyFileSync(declarationEntry, new URL("index.d.mts", declarationDirectory))
copyFileSync(declarationEntry, new URL("index.d.cts", declarationDirectory))
