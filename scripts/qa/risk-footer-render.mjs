// Renders ContentDisclaimerFooter / MembersFooter with react-dom/server and checks the risk-line rules:
// each risk sentence exactly once per page, /risk link always present.
// Usage: node scripts/qa/risk-footer-render.mjs [--html-out <dir>]   (writes static HTML for screenshots)
import fs from "fs";
import os from "os";
import path from "path";
import { createRequire } from "module";
import ts from "typescript";

const root = process.cwd();
const require = createRequire(path.join(root, "package.json"));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gfx-risk-"));
const files = {
  "config/training": "src/config/training.ts",
  "components/training/members-footer": "src/components/training/members-footer.tsx",
  "components/training/content-disclaimer-footer": "src/components/training/content-disclaimer-footer.tsx",
};
for (const [mod, src] of Object.entries(files)) {
  let code = ts.transpileModule(fs.readFileSync(path.join(root, src), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  code = code.replace(/require\("@\/([^"]+)"\)/g, (_, m) => `require(${JSON.stringify(path.join(tmp, m + ".js"))})`);
  code = code.replace(/require\("([^."/@][^"]*|@[^/"]+\/[^"]+)"\)/g, (_, m) => `require(${JSON.stringify(require.resolve(m))})`);
  fs.mkdirSync(path.dirname(path.join(tmp, mod + ".js")), { recursive: true });
  fs.writeFileSync(path.join(tmp, mod + ".js"), code);
}
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const { RISK_LINE } = require(path.join(tmp, "config/training.js"));
const { MembersFooter } = require(path.join(tmp, "components/training/members-footer.js"));
const { ContentDisclaimerFooter } = require(path.join(tmp, "components/training/content-disclaimer-footer.js"));

const DISC = "Education lang, not financial advice. Compute your own lot size. Max 1% risk per trade.";
const count = (h, s) => h.split(s).length - 1;
const sentences = ["Max 1% risk per trade.", "Education lang, not financial advice."];
let pass = 0, fail = 0;
const chk = (n, ok) => { ok ? pass++ : fail++; console.log(ok ? "PASS" : "FAIL", n); };
const html = {};
const r = (el) => renderToStaticMarkup(el);

html.capstone_with_disclaimer = r(React.createElement(ContentDisclaimerFooter, { disclaimer: DISC }));
for (const s of sentences) chk(`with disclaimer: "${s}" once`, count(html.capstone_with_disclaimer, s) === 1);
chk("with disclaimer: disclaimer shown once", count(html.capstone_with_disclaimer, DISC) === 1);
chk("with disclaimer: footer risk sentence hidden", !html.capstone_with_disclaimer.includes(RISK_LINE));
chk("with disclaimer: /risk link present", html.capstone_with_disclaimer.includes('href="/risk"'));

for (const [k, d] of [["placement_no_disclaimer", null], ["blank_disclaimer", "   "], ["undefined_disclaimer", undefined]]) {
  html[k] = r(React.createElement(ContentDisclaimerFooter, { disclaimer: d }));
  chk(`${k}: footer line present once`, count(html[k], RISK_LINE) === 1);
  chk(`${k}: no disclaimer block`, !html[k].includes("content-disclaimer"));
  chk(`${k}: /risk link present`, html[k].includes('href="/risk"'));
}
html.other_page_footer = r(React.createElement(MembersFooter));
chk("default MembersFooter (other pages): line + /risk", count(html.other_page_footer, RISK_LINE) === 1 && html.other_page_footer.includes('href="/risk"'));

const oi = process.argv.indexOf("--html-out");
if (oi > 0) {
  const out = process.argv[oi + 1];
  fs.mkdirSync(out, { recursive: true });
  for (const [k, v] of Object.entries(html)) fs.writeFileSync(path.join(out, `${k}.fragment.html`), v);
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
