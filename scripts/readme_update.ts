#!/usr/bin/env tsx

import {makeFile} from "../src/util/pathUtils";
import {readFileSync} from "node:fs";
import {logDone} from "../src/util/logger";


(async function readme_gen() {
    const {program} = await import('../src/index')
    const mainFunctions = program.commands.map(
        c => `- [x] [${c.name()} - ${c.description()}](#${c.name()})`
    ).join("\n")

    const helpInformation = program.commands.map(c => `
### <a id="${c.name()}">${c.name()}</a>
\`\`\`
${c.helpInformation().replace(`Usage: `, `Usage: apiyaml`)}
\`\`\``).join(`\n`);


    const rt = readFileSync('scripts/readme_template.md')
    const newReadme = rt
        .toString()
        .replace("{{mainFunctions}}", mainFunctions)
        .replace("{{helpInformation}}", helpInformation)

    makeFile('README.md', newReadme, true)
    logDone(`updated README.md`)

})()
