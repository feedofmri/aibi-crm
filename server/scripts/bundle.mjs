// Build the cPanel deploy folder for the CRM: the API bundled into one file plus
// the built React client, so an FTP deploy uploads a few dozen files instead of
// thousands in node_modules. Run after `npm run build -w client`.
//
//   node server/scripts/bundle.mjs [outDir]        (default: deploy/crm)
//
// Output:
//   server.mjs        the whole API (Express, pg, bcrypt, ...) in one ES module
//   app.cjs           cPanel "Setup Node.js App" startup file (Passenger require()s it)
//   migrations/       SQL migrations, applied automatically on start
//   public/           the built CRM web app, served by the API
//   tmp/restart.txt   touching it makes Passenger restart the app
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const serverRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = join(serverRoot, "..");
const out = resolve(repoRoot, process.argv[2] || "deploy/crm");
const clientDist = join(repoRoot, "client/dist");

if (!existsSync(join(clientDist, "index.html"))) {
  console.error("client/dist is missing. Run `npm run build -w client` first.");
  process.exit(1);
}

rmSync(out, { recursive: true, force: true });

await build({
  entryPoints: [join(serverRoot, "src/index.js")],
  outfile: join(out, "server.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  external: ["pg-native"], // pg only loads it when asked to
  minify: true,
  legalComments: "none",
  logLevel: "warning",
  // CommonJS dependencies call require() and read __dirname; an ES module has
  // neither, so the bundle defines them.
  banner: {
    js: [
      'import { createRequire as __biaiRequire } from "node:module";',
      'import { fileURLToPath as __biaiPath } from "node:url";',
      'import { dirname as __biaiDir } from "node:path";',
      "const require = __biaiRequire(import.meta.url);",
      "const __filename = __biaiPath(import.meta.url);",
      "const __dirname = __biaiDir(__filename);",
    ].join(" "),
  },
});

cpSync(join(serverRoot, "src/db/migrations"), join(out, "migrations"), { recursive: true });
cpSync(clientDist, join(out, "public"), { recursive: true, filter: (f) => !f.endsWith(".map") });

writeFileSync(
  join(out, "app.cjs"),
  `// cPanel "Setup Node.js App" startup file. Passenger loads it with require().
import("./server.mjs").catch((error) => {
  console.error(error);
  process.exit(1);
});
`,
);
writeFileSync(join(out, "package.json"), JSON.stringify({ name: "biai-crm-deploy", private: true }, null, 2) + "\n");
mkdirSync(join(out, "tmp"), { recursive: true });
writeFileSync(join(out, "tmp/restart.txt"), new Date().toISOString() + "\n");

console.log(`CRM bundle written to ${out}`);
