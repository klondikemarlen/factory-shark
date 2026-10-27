import { resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"
import { defineConfig } from "vite"

const projectRoot = resolve(fileURLToPath(new URL(".", import.meta.url)))
const externalPackages = ["lodash", "semver", "sequelize", "@sequelize/core"]

function isExternalPackage(id) {
  return externalPackages.some((packageName) => {
    return id === packageName || id.startsWith(`${packageName}/`)
  })
}

export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\//,
        replacement: `${projectRoot}${sep}`,
      },
    ],
  },
  build: {
    emptyOutDir: true,
    minify: false,
    lib: {
      entry: "src/index.ts",
      formats: ["es", "cjs"],
      fileName: (format) => {
        if (format === "es") return "index.mjs"
        return "index.cjs"
      },
    },
    outDir: "dist",
    rolldownOptions: {
      external: isExternalPackage,
      output: {
        exports: "named",
      },
    },
  },
})
