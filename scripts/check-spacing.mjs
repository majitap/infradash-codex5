import fs from "node:fs";
import path from "node:path";

const walk = (dir) =>
  fs
    .readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? walk(path.join(dir, entry.name))
        : [path.join(dir, entry.name)],
    );
const errors = [];
let checked = 0;
for (const file of [...walk("app"), ...walk("components")].filter((file) =>
  file.endsWith(".tsx"),
)) {
  const source = fs.readFileSync(file, "utf8");
  const spacing =
    /(?<=[\s"'`:])(-?(?:p[xytrblse]?|m[xytrblse]?|gap(?:-[xy])?|space-[xy])-)(\d+(?:\.\d+)?)(?![\w./\[])/g;
  for (const match of source.matchAll(spacing)) {
    checked++;
    if ((Number(match[2]) * 4) % 8 !== 0)
      errors.push(`${file}: ${match[0]} is outside the 8px scale`);
  }
}
const css = ["app/console.css", "app/atelier.css", "app/operations.css"]
  .map((file) => fs.readFileSync(file, "utf8"))
  .join("\n");
for (const match of css.matchAll(
  /(?:^|[;{}])\s*((?:padding|margin)(?:-(?:top|bottom|left|right|inline|block))?|(?:row-|column-)?gap)\s*:\s*([^;{}]+)/g,
)) {
  for (const value of match[2].matchAll(/(-?\d+(?:\.\d+)?)px/g)) {
    checked++;
    if (Number(value[1]) % 8 !== 0)
      errors.push(`app styles: ${match[1]}: ${match[2]}`);
  }
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(`8px spacing scale verified: ${checked} utility and CSS values.`);
