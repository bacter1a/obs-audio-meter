import { rollup } from "rollup";
import resolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";

const root = fileURLToPath(new URL("../", import.meta.url));
const require = createRequire(import.meta.url);
const bundle = await rollup({
  input: path.join(root, "src/plugin.js"),
  plugins: [resolve({ preferBuiltins: true }), commonjs()],
  external: ["bufferutil", "utf-8-validate"],
});
try {
  await bundle.write({ file: path.join(root, "com.twrt.obs.audio-meter.sdPlugin/bin/plugin.mjs"), format: "es" });
  const notices = ["@elgato/streamdeck", "@elgato/utils", "ws", "zod"].map((name) => {
    // exportsでpackage.jsonが公開されないパッケージもあるため、実体から親をたどる。
    let directory = path.dirname(require.resolve(name));
    while (true) {
      try {
        const pkg = JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8"));
        if (pkg.name === name) {
          let license;
          for (const filename of ["LICENSE", "LICENSE.md", "LICENSE.txt"]) {
            try { license = readFileSync(path.join(directory, filename), "utf8"); break; } catch {}
          }
          if (!license) throw new Error(`${name}: ライセンスファイルがありません。`);
          return `${name} ${pkg.version}\n${license}`;
        }
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const parent = path.dirname(directory);
      if (parent === directory) throw new Error(`${name}: パッケージが見つかりません。`);
      directory = parent;
    }
  }).join("\n\n----------------------------------------\n\n");
  writeFileSync(path.join(root, "com.twrt.obs.audio-meter.sdPlugin/bin/THIRD-PARTY-NOTICES.txt"), notices);
} finally {
  await bundle.close();
}
console.log("OBS Audio Meterのビルドが完了しました。");
