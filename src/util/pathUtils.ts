import * as path from "node:path";
import {logError, logWarning} from "./logger";
import {execSync} from "node:child_process";
// insertLinesAtLastImport(filePath, linesToInsert);
// insertLinesAtLastImport
// Example usage:
// const filePath = 'your-file.ts';
// const linesToInsert = [
//     "import { Something } from './somewhere';",
//     "import { AnotherThing } from './another-place';",
//     "import { Something } from './somewhere';", // This will be skipped
// ];
import * as fs from 'fs';
import {readFileSync} from "node:fs";
import {isIncludes} from "@/util/strings";

function getCwd(...p: string[]): string {
    const cwd = process.cwd();
    return path.resolve(cwd, ...p)
}

function checkDirectoryExists(p: string): boolean {
    try {
        return fs.lstatSync(p).isDirectory()
    } catch (e) {
        return false
    }
}

export function makeDir(p: string, recursive = true): boolean {
    if (!checkDirectoryExists(p)) {
        fs.mkdirSync(p, {recursive: recursive});
    }
    return checkDirectoryExists(p)
}

export function makeFile(fp: string,
                         content: any,
                         force = false,
                         doPrettier = true,
): boolean {
    const ok = makeDir(path.dirname(fp))
    if (!ok) {
        logError(`can not create ${path.dirname(fp)} directory`)
        return false;
    }
    const fileExists = fs.existsSync(fp)
    if (fileExists && !force) {
        logWarning(`file ${fp} already exists; use --force to overwrite`)
        return false;
    }
    fs.writeFileSync(fp, content, {encoding: 'utf-8'})
    if (doPrettier) {
        execSync(`npx prettier --write ${fp}`)
    }
    return true;
}

export function srcPath(...p: string[]): string {
    return getCwd('src', ...p);
}

export function libPath(...p: string[]): string {
    return getCwd('lib', ...p);
}

export function libFlowsPath(): string {
    const d = libPath("flows");
    if (!checkDirectoryExists(d)) {
        try {
            logWarning("./lib not found; try building with `npm run build`")
            execSync(`npm run build`);
        } catch (e) {
            logError(e)
            throw e;
        }
    }
    return d;
}

export function srcFlowsPath(): string {
    return srcPath("flows");
}

// success: returns string path file written
export function appendContent(filePath: string, content: string, force = false) {
    const fpath = srcPath(filePath)
    let nsContent
    try {
        nsContent = readFileSync(fpath, {encoding: "utf-8"}).toString()
    } catch (e: any) {
        nsContent = ''
    }
    if (!isIncludes(nsContent, content)) {
        const nameSpaceExportDone = makeFile(
            fpath,
            makeContent(`${nsContent}\n${content}`),
            force,
            false,
        )
        if (nameSpaceExportDone) {
            return fpath
        }
    }
    return '';
}

function makeContent(content: string): string {
    try {
        const lines = content.split(`\n`)
        const importLines = lines
            .filter(l => l.trim().startsWith('import'))
            .map(l => l.replace(/["']/g, '"'));
        const normalLines = lines.filter(l => !l.trim().startsWith('import'));
        const uniqueLines = [...new Set(importLines), ...normalLines];
        // Remove consecutive empty lines
        const filteredLines = uniqueLines.reduce((acc: string[], line: string) => {
            if (line.trim() === '' && acc.length > 0 && acc[acc.length - 1].trim() === '') {
                return acc; // Skip adding consecutive empty lines
            }
            acc.push(line);
            return acc;
        }, []);
        return filteredLines.join(`\n`)
    } catch (error) {
        logError("makeContent error:", error);
        return ''
    }
}

export function convertToValidFilename(s: string) {
    return (s.replace(/[\/|\\:*?\s"<>]/g, "_"));
}
