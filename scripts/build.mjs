import { execFileSync } from "node:child_process"
import { rmSync } from "node:fs"
import { fileURLToPath } from "node:url"

const projectRoot = fileURLToPath(new URL("../", import.meta.url))
const compilerPath = fileURLToPath(new URL("../node_modules/typescript/bin/tsc", import.meta.url))

rmSync(new URL("../dist/", import.meta.url), {
  recursive: true,
  force: true,
})

execFileSync(process.execPath, [compilerPath, "-p", "tsconfig.build.json"], {
  cwd: projectRoot,
  stdio: "inherit",
})
