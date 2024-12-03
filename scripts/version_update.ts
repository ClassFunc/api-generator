import {readFileSync} from "node:fs";
import {makeFile} from "../src/util/pathUtils";
import * as path from "node:path";
import {logDone} from "../src/util/logger";

(async () => {
    const {version} = JSON.parse(readFileSync(path.resolve('package.json')).toString());
    makeFile(path.resolve("src/version.ts"), `export const VERSION = "${version}";`, true);
    logDone("updated version to", version)
})()