import {isString} from "lodash";
import * as path from "node:path";

const endsColor = `\u001B[39m`;
const errColor = `\u001B[31m`;
const successColor = `\u001B[32m`;
const warningColor = `\u001B[33m`;
const infoColor = "\u001B[36m";

const log = (...v: any) => {
    const ls = []
    for (let l of v) {
        // log for path
        if (isString(l) && l.includes('/')) {
            l = path.relative(path.resolve(), l)
        }
        ls.push(l)
    }
    console.log(...ls)
};

const logDone = (...v: any[]) => {
    log("<<✅", successColor, ...v, endsColor);
};

const logError = (...v: any[]) => {
    log("<<🔴Error:🔻🔻", errColor);
    for (const e of v) {
        if (e instanceof Error) {
            log(errColor, e.message)
        } else {
            log(errColor, e)
        }
    }
    log(endsColor)
};

const logWarning = (...v: any[]) => {
    log("- 🟨", warningColor, ...v, endsColor);
};

const logRunning = (...v: any[]) => {
    log("🏃‍♂️", warningColor, ...v, endsColor);
};

const logInfo = (...v: any[]) => {
    log("🔵>>", infoColor, ...v, endsColor);
};

export {log, logDone, logError, logWarning, logInfo, logRunning};
