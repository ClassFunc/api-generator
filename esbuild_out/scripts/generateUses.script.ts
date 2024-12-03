#!/usr/bin/env tsx

// BEFORE RUN: install tsx with `npm i -g tsx` // read: https://tsx.is/

import path from "node:path";
import fs from 'node:fs'
import * as process from "node:process";

process.stdout.write('argv');
process.stdout.write(process.argv.toString())

const outDirFull = process.argv.slice(2)?.[0]
process.stdout.write(outDirFull)

const docsDir = path.resolve(outDirFull)
const apisDir = path.resolve(docsDir, 'apis')
const templatesDir = path.join(__dirname, 'templates')
console.log({docsDir, apisDir})
if (!fs.existsSync(apisDir)) {
    console.error(apisDir + ' not found; please generate it at first ')
    process.exit();
}
const usesDir = path.resolve(docsDir, 'uses')
fs.mkdirSync(usesDir, {recursive: true})
//     copy useConfiguration.ts to usesDir
let useConfContent = fs.readFileSync(path.resolve(templatesDir, "_useConfiguration.ts")).toString("utf-8")
useConfContent = useConfContent.replace(/app\/docs\/api/g, outDirFull)
fs.writeFileSync(
    path.resolve(usesDir, `_useConfiguration.ts`),
    useConfContent,
)
fs.copyFileSync(
    path.resolve(templatesDir, `_useFnCommon.ts`),
    path.resolve(usesDir, `_useFnCommon.ts`),
)
const useApiTemplateContent = fs
    .readFileSync(path.resolve(templatesDir, "useXYZApi.template.ts"))
    .toString("utf-8")
fs.readdirSync(apisDir).forEach(async apiFileName => {
    if (!apiFileName.endsWith("Api.ts"))
        return;
    const apiName = apiFileName.split(".")[0]
    console.log({apiName})
    const useTs = useApiTemplateContent
        .replace(/GreetingApi/g, apiName)
        .replace(/app\/docs\/api/g, `${outDirFull}`)
    //     write
    fs.writeFileSync(path.resolve(usesDir, `use${apiName}.ts`), useTs)
    console.log(` |-- done generating for "${apiFileName}", usage:\n import use${apiName} from '@/${outDirFull}/uses/use${apiName}'`)

    //
    // generate use{functionName};
    const imported = await import(path.resolve(apisDir, apiName))
    const cls = imported[apiName]
    // console.log(cls)
    const clsMethods = methodNames(cls)
    // console.log("-- ", clsMethods)
    for (const m of clsMethods) {
        if (!m.endsWith("Post")) {
            continue;
        }
        const mCapPost = capitalizeFirstLetter(m);
        const mCap = mCapPost.substring(0, mCapPost.length - 4);
        console.log({mCap, mCapPost})
        const useFnCapName = `use${mCapPost}`;
        const useFnTemplateContent = fs.readFileSync(
            path.resolve(templatesDir, "useFn.template.tsx")
        ).toString("utf-8")
        const useFnContent = useFnTemplateContent
            .replace(/greetingApi/g, lowerFirstLetter(apiName))
            .replace(/useGreetingApi/g, `use${apiName}`)
            .replace(/app\/docs\/api/g, `${outDirFull}`)
            .replace(/Greeting/g, mCap)
            .replace(/greeting/g, lowerFirstLetter(mCap))

        // console.log(useFnContent)
        fs.writeFileSync(path.resolve(usesDir, useFnCapName + '.tsx'), useFnContent)
    }
})

const methodNames = (cls: any) => Object.getOwnPropertyNames(cls.prototype).filter(
    (prop) => typeof cls.prototype[prop] === "function" && prop !== "constructor"
);

function capitalizeFirstLetter(str: string): string {
    return `${str.charAt(0).toUpperCase()}${str.slice(1)}`;
}

function lowerFirstLetter(str: string): string {
    return `${str.charAt(0).toLowerCase()}${str.slice(1)}`;
}
