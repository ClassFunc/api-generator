"use strict";var se=Object.create;var b=Object.defineProperty;var re=Object.getOwnPropertyDescriptor;var oe=Object.getOwnPropertyNames;var ae=Object.getPrototypeOf,he=Object.prototype.hasOwnProperty;var C=(a,e)=>()=>(e||a((e={exports:{}}).exports,e),e.exports),le=(a,e)=>{for(var t in e)b(a,t,{get:e[t],enumerable:!0})},j=(a,e,t,i)=>{if(e&&typeof e=="object"||typeof e=="function")for(let n of oe(e))!he.call(a,n)&&n!==t&&b(a,n,{get:()=>e[n],enumerable:!(i=re(e,n))||i.enumerable});return a};var ue=(a,e,t)=>(t=a!=null?se(ae(a)):{},j(e||!a||!a.__esModule?b(t,"default",{value:a,enumerable:!0}):t,a)),ce=a=>j(b({},"__esModule",{value:!0}),a);var A=C(v=>{var w=class extends Error{constructor(e,t,i){super(i),Error.captureStackTrace(this,this.constructor),this.name=this.constructor.name,this.code=t,this.exitCode=e,this.nestedError=void 0}},$=class extends w{constructor(e){super(1,"commander.invalidArgument",e),Error.captureStackTrace(this,this.constructor),this.name=this.constructor.name}};v.CommanderError=w;v.InvalidArgumentError=$});var E=C(V=>{var{InvalidArgumentError:me}=A(),H=class{constructor(e,t){switch(this.description=t||"",this.variadic=!1,this.parseArg=void 0,this.defaultValue=void 0,this.defaultValueDescription=void 0,this.argChoices=void 0,e[0]){case"<":this.required=!0,this._name=e.slice(1,-1);break;case"[":this.required=!1,this._name=e.slice(1,-1);break;default:this.required=!0,this._name=e;break}this._name.length>3&&this._name.slice(-3)==="..."&&(this.variadic=!0,this._name=this._name.slice(0,-3))}name(){return this._name}_concatValue(e,t){return t===this.defaultValue||!Array.isArray(t)?[e]:t.concat(e)}default(e,t){return this.defaultValue=e,this.defaultValueDescription=t,this}argParser(e){return this.parseArg=e,this}choices(e){return this.argChoices=e.slice(),this.parseArg=(t,i)=>{if(!this.argChoices.includes(t))throw new me(`Allowed choices are ${this.argChoices.join(", ")}.`);return this.variadic?this._concatValue(t,i):t},this}argRequired(){return this.required=!0,this}argOptional(){return this.required=!1,this}};function de(a){let e=a.name()+(a.variadic===!0?"...":"");return a.required?"<"+e+">":"["+e+"]"}V.Argument=H;V.humanReadableArgName=de});var S=C(L=>{var{humanReadableArgName:pe}=E(),y=class{constructor(){this.helpWidth=void 0,this.sortSubcommands=!1,this.sortOptions=!1,this.showGlobalOptions=!1}visibleCommands(e){let t=e.commands.filter(n=>!n._hidden),i=e._getHelpCommand();return i&&!i._hidden&&t.push(i),this.sortSubcommands&&t.sort((n,s)=>n.name().localeCompare(s.name())),t}compareOptions(e,t){let i=n=>n.short?n.short.replace(/^-/,""):n.long.replace(/^--/,"");return i(e).localeCompare(i(t))}visibleOptions(e){let t=e.options.filter(n=>!n.hidden),i=e._getHelpOption();if(i&&!i.hidden){let n=i.short&&e._findOption(i.short),s=i.long&&e._findOption(i.long);!n&&!s?t.push(i):i.long&&!s?t.push(e.createOption(i.long,i.description)):i.short&&!n&&t.push(e.createOption(i.short,i.description))}return this.sortOptions&&t.sort(this.compareOptions),t}visibleGlobalOptions(e){if(!this.showGlobalOptions)return[];let t=[];for(let i=e.parent;i;i=i.parent){let n=i.options.filter(s=>!s.hidden);t.push(...n)}return this.sortOptions&&t.sort(this.compareOptions),t}visibleArguments(e){return e._argsDescription&&e.registeredArguments.forEach(t=>{t.description=t.description||e._argsDescription[t.name()]||""}),e.registeredArguments.find(t=>t.description)?e.registeredArguments:[]}subcommandTerm(e){let t=e.registeredArguments.map(i=>pe(i)).join(" ");return e._name+(e._aliases[0]?"|"+e._aliases[0]:"")+(e.options.length?" [options]":"")+(t?" "+t:"")}optionTerm(e){return e.flags}argumentTerm(e){return e.name()}longestSubcommandTermLength(e,t){return t.visibleCommands(e).reduce((i,n)=>Math.max(i,t.subcommandTerm(n).length),0)}longestOptionTermLength(e,t){return t.visibleOptions(e).reduce((i,n)=>Math.max(i,t.optionTerm(n).length),0)}longestGlobalOptionTermLength(e,t){return t.visibleGlobalOptions(e).reduce((i,n)=>Math.max(i,t.optionTerm(n).length),0)}longestArgumentTermLength(e,t){return t.visibleArguments(e).reduce((i,n)=>Math.max(i,t.argumentTerm(n).length),0)}commandUsage(e){let t=e._name;e._aliases[0]&&(t=t+"|"+e._aliases[0]);let i="";for(let n=e.parent;n;n=n.parent)i=n.name()+" "+i;return i+t+" "+e.usage()}commandDescription(e){return e.description()}subcommandDescription(e){return e.summary()||e.description()}optionDescription(e){let t=[];return e.argChoices&&t.push(`choices: ${e.argChoices.map(i=>JSON.stringify(i)).join(", ")}`),e.defaultValue!==void 0&&(e.required||e.optional||e.isBoolean()&&typeof e.defaultValue=="boolean")&&t.push(`default: ${e.defaultValueDescription||JSON.stringify(e.defaultValue)}`),e.presetArg!==void 0&&e.optional&&t.push(`preset: ${JSON.stringify(e.presetArg)}`),e.envVar!==void 0&&t.push(`env: ${e.envVar}`),t.length>0?`${e.description} (${t.join(", ")})`:e.description}argumentDescription(e){let t=[];if(e.argChoices&&t.push(`choices: ${e.argChoices.map(i=>JSON.stringify(i)).join(", ")}`),e.defaultValue!==void 0&&t.push(`default: ${e.defaultValueDescription||JSON.stringify(e.defaultValue)}`),t.length>0){let i=`(${t.join(", ")})`;return e.description?`${e.description} ${i}`:i}return e.description}formatHelp(e,t){let i=t.padWidth(e,t),n=t.helpWidth||80,s=2,r=2;function h(d,_){if(_){let x=`${d.padEnd(i+r)}${_}`;return t.wrap(x,n-s,i+r)}return d}function o(d){return d.join(`
`).replace(/^/gm," ".repeat(s))}let l=[`Usage: ${t.commandUsage(e)}`,""],u=t.commandDescription(e);u.length>0&&(l=l.concat([t.wrap(u,n,0),""]));let c=t.visibleArguments(e).map(d=>h(t.argumentTerm(d),t.argumentDescription(d)));c.length>0&&(l=l.concat(["Arguments:",o(c),""]));let p=t.visibleOptions(e).map(d=>h(t.optionTerm(d),t.optionDescription(d)));if(p.length>0&&(l=l.concat(["Options:",o(p),""])),this.showGlobalOptions){let d=t.visibleGlobalOptions(e).map(_=>h(t.optionTerm(_),t.optionDescription(_)));d.length>0&&(l=l.concat(["Global Options:",o(d),""]))}let O=t.visibleCommands(e).map(d=>h(t.subcommandTerm(d),t.subcommandDescription(d)));return O.length>0&&(l=l.concat(["Commands:",o(O),""])),l.join(`
`)}padWidth(e,t){return Math.max(t.longestOptionTermLength(e,t),t.longestGlobalOptionTermLength(e,t),t.longestSubcommandTermLength(e,t),t.longestArgumentTermLength(e,t))}wrap(e,t,i,n=40){let s=" \\f\\t\\v\xA0\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF",r=new RegExp(`[\\n][${s}]+`);if(e.match(r))return e;let h=t-i;if(h<n)return e;let o=e.slice(0,i),l=e.slice(i).replace(`\r
`,`
`),u=" ".repeat(i),p="\\s\u200B",O=new RegExp(`
|.{1,${h-1}}([${p}]|$)|[^${p}]+?([${p}]|$)`,"g"),d=l.match(O)||[];return o+d.map((_,x)=>_===`
`?"":(x>0?u:"")+_.trimEnd()).join(`
`)}};L.Help=y});var F=C(N=>{var{InvalidArgumentError:fe}=A(),k=class{constructor(e,t){this.flags=e,this.description=t||"",this.required=e.includes("<"),this.optional=e.includes("["),this.variadic=/\w\.\.\.[>\]]$/.test(e),this.mandatory=!1;let i=_e(e);this.short=i.shortFlag,this.long=i.longFlag,this.negate=!1,this.long&&(this.negate=this.long.startsWith("--no-")),this.defaultValue=void 0,this.defaultValueDescription=void 0,this.presetArg=void 0,this.envVar=void 0,this.parseArg=void 0,this.hidden=!1,this.argChoices=void 0,this.conflictsWith=[],this.implied=void 0}default(e,t){return this.defaultValue=e,this.defaultValueDescription=t,this}preset(e){return this.presetArg=e,this}conflicts(e){return this.conflictsWith=this.conflictsWith.concat(e),this}implies(e){let t=e;return typeof e=="string"&&(t={[e]:!0}),this.implied=Object.assign(this.implied||{},t),this}env(e){return this.envVar=e,this}argParser(e){return this.parseArg=e,this}makeOptionMandatory(e=!0){return this.mandatory=!!e,this}hideHelp(e=!0){return this.hidden=!!e,this}_concatValue(e,t){return t===this.defaultValue||!Array.isArray(t)?[e]:t.concat(e)}choices(e){return this.argChoices=e.slice(),this.parseArg=(t,i)=>{if(!this.argChoices.includes(t))throw new fe(`Allowed choices are ${this.argChoices.join(", ")}.`);return this.variadic?this._concatValue(t,i):t},this}name(){return this.long?this.long.replace(/^--/,""):this.short.replace(/^-/,"")}attributeName(){return ge(this.name().replace(/^no-/,""))}is(e){return this.short===e||this.long===e}isBoolean(){return!this.required&&!this.optional&&!this.negate}},P=class{constructor(e){this.positiveOptions=new Map,this.negativeOptions=new Map,this.dualOptions=new Set,e.forEach(t=>{t.negate?this.negativeOptions.set(t.attributeName(),t):this.positiveOptions.set(t.attributeName(),t)}),this.negativeOptions.forEach((t,i)=>{this.positiveOptions.has(i)&&this.dualOptions.add(i)})}valueFromOption(e,t){let i=t.attributeName();if(!this.dualOptions.has(i))return!0;let n=this.negativeOptions.get(i).presetArg,s=n!==void 0?n:!1;return t.negate===(s===e)}};function ge(a){return a.split("-").reduce((e,t)=>e+t[0].toUpperCase()+t.slice(1))}function _e(a){let e,t,i=a.split(/[ |,]+/);return i.length>1&&!/^[[<]/.test(i[1])&&(e=i.shift()),t=i.shift(),!e&&/^-[^-]$/.test(t)&&(e=t,t=void 0),{shortFlag:e,longFlag:t}}N.Option=k;N.DualOptions=P});var U=C(R=>{function Oe(a,e){if(Math.abs(a.length-e.length)>3)return Math.max(a.length,e.length);let t=[];for(let i=0;i<=a.length;i++)t[i]=[i];for(let i=0;i<=e.length;i++)t[0][i]=i;for(let i=1;i<=e.length;i++)for(let n=1;n<=a.length;n++){let s=1;a[n-1]===e[i-1]?s=0:s=1,t[n][i]=Math.min(t[n-1][i]+1,t[n][i-1]+1,t[n-1][i-1]+s),n>1&&i>1&&a[n-1]===e[i-2]&&a[n-2]===e[i-1]&&(t[n][i]=Math.min(t[n][i],t[n-2][i-2]+1))}return t[a.length][e.length]}function Ce(a,e){if(!e||e.length===0)return"";e=Array.from(new Set(e));let t=a.startsWith("--");t&&(a=a.slice(2),e=e.map(r=>r.slice(2)));let i=[],n=3,s=.4;return e.forEach(r=>{if(r.length<=1)return;let h=Oe(a,r),o=Math.max(a.length,r.length);(o-h)/o>s&&(h<n?(n=h,i=[r]):h===n&&i.push(r))}),i.sort((r,h)=>r.localeCompare(h)),t&&(i=i.map(r=>`--${r}`)),i.length>1?`
(Did you mean one of ${i.join(", ")}?)`:i.length===1?`
(Did you mean ${i[0]}?)`:""}R.suggestSimilar=Ce});var z=C(K=>{var Ae=require("node:events").EventEmitter,q=require("node:child_process"),g=require("node:path"),T=require("node:fs"),m=require("node:process"),{Argument:be,humanReadableArgName:we}=E(),{CommanderError:D}=A(),{Help:Ee}=S(),{Option:G,DualOptions:xe}=F(),{suggestSimilar:B}=U(),I=class a extends Ae{constructor(e){super(),this.commands=[],this.options=[],this.parent=null,this._allowUnknownOption=!1,this._allowExcessArguments=!0,this.registeredArguments=[],this._args=this.registeredArguments,this.args=[],this.rawArgs=[],this.processedArgs=[],this._scriptPath=null,this._name=e||"",this._optionValues={},this._optionValueSources={},this._storeOptionsAsProperties=!1,this._actionHandler=null,this._executableHandler=!1,this._executableFile=null,this._executableDir=null,this._defaultCommandName=null,this._exitCallback=null,this._aliases=[],this._combineFlagAndOptionalValue=!0,this._description="",this._summary="",this._argsDescription=void 0,this._enablePositionalOptions=!1,this._passThroughOptions=!1,this._lifeCycleHooks={},this._showHelpAfterError=!1,this._showSuggestionAfterError=!0,this._outputConfiguration={writeOut:t=>m.stdout.write(t),writeErr:t=>m.stderr.write(t),getOutHelpWidth:()=>m.stdout.isTTY?m.stdout.columns:void 0,getErrHelpWidth:()=>m.stderr.isTTY?m.stderr.columns:void 0,outputError:(t,i)=>i(t)},this._hidden=!1,this._helpOption=void 0,this._addImplicitHelpCommand=void 0,this._helpCommand=void 0,this._helpConfiguration={}}copyInheritedSettings(e){return this._outputConfiguration=e._outputConfiguration,this._helpOption=e._helpOption,this._helpCommand=e._helpCommand,this._helpConfiguration=e._helpConfiguration,this._exitCallback=e._exitCallback,this._storeOptionsAsProperties=e._storeOptionsAsProperties,this._combineFlagAndOptionalValue=e._combineFlagAndOptionalValue,this._allowExcessArguments=e._allowExcessArguments,this._enablePositionalOptions=e._enablePositionalOptions,this._showHelpAfterError=e._showHelpAfterError,this._showSuggestionAfterError=e._showSuggestionAfterError,this}_getCommandAndAncestors(){let e=[];for(let t=this;t;t=t.parent)e.push(t);return e}command(e,t,i){let n=t,s=i;typeof n=="object"&&n!==null&&(s=n,n=null),s=s||{};let[,r,h]=e.match(/([^ ]+) *(.*)/),o=this.createCommand(r);return n&&(o.description(n),o._executableHandler=!0),s.isDefault&&(this._defaultCommandName=o._name),o._hidden=!!(s.noHelp||s.hidden),o._executableFile=s.executableFile||null,h&&o.arguments(h),this._registerCommand(o),o.parent=this,o.copyInheritedSettings(this),n?this:o}createCommand(e){return new a(e)}createHelp(){return Object.assign(new Ee,this.configureHelp())}configureHelp(e){return e===void 0?this._helpConfiguration:(this._helpConfiguration=e,this)}configureOutput(e){return e===void 0?this._outputConfiguration:(Object.assign(this._outputConfiguration,e),this)}showHelpAfterError(e=!0){return typeof e!="string"&&(e=!!e),this._showHelpAfterError=e,this}showSuggestionAfterError(e=!0){return this._showSuggestionAfterError=!!e,this}addCommand(e,t){if(!e._name)throw new Error(`Command passed to .addCommand() must have a name
- specify the name in Command constructor or using .name()`);return t=t||{},t.isDefault&&(this._defaultCommandName=e._name),(t.noHelp||t.hidden)&&(e._hidden=!0),this._registerCommand(e),e.parent=this,e._checkForBrokenPassThrough(),this}createArgument(e,t){return new be(e,t)}argument(e,t,i,n){let s=this.createArgument(e,t);return typeof i=="function"?s.default(n).argParser(i):s.default(i),this.addArgument(s),this}arguments(e){return e.trim().split(/ +/).forEach(t=>{this.argument(t)}),this}addArgument(e){let t=this.registeredArguments.slice(-1)[0];if(t&&t.variadic)throw new Error(`only the last argument can be variadic '${t.name()}'`);if(e.required&&e.defaultValue!==void 0&&e.parseArg===void 0)throw new Error(`a default value for a required argument is never used: '${e.name()}'`);return this.registeredArguments.push(e),this}helpCommand(e,t){if(typeof e=="boolean")return this._addImplicitHelpCommand=e,this;e=e??"help [command]";let[,i,n]=e.match(/([^ ]+) *(.*)/),s=t??"display help for command",r=this.createCommand(i);return r.helpOption(!1),n&&r.arguments(n),s&&r.description(s),this._addImplicitHelpCommand=!0,this._helpCommand=r,this}addHelpCommand(e,t){return typeof e!="object"?(this.helpCommand(e,t),this):(this._addImplicitHelpCommand=!0,this._helpCommand=e,this)}_getHelpCommand(){return this._addImplicitHelpCommand??(this.commands.length&&!this._actionHandler&&!this._findCommand("help"))?(this._helpCommand===void 0&&this.helpCommand(void 0,void 0),this._helpCommand):null}hook(e,t){let i=["preSubcommand","preAction","postAction"];if(!i.includes(e))throw new Error(`Unexpected value for event passed to hook : '${e}'.
Expecting one of '${i.join("', '")}'`);return this._lifeCycleHooks[e]?this._lifeCycleHooks[e].push(t):this._lifeCycleHooks[e]=[t],this}exitOverride(e){return e?this._exitCallback=e:this._exitCallback=t=>{if(t.code!=="commander.executeSubCommandAsync")throw t},this}_exit(e,t,i){this._exitCallback&&this._exitCallback(new D(e,t,i)),m.exit(e)}action(e){let t=i=>{let n=this.registeredArguments.length,s=i.slice(0,n);return this._storeOptionsAsProperties?s[n]=this:s[n]=this.opts(),s.push(this),e.apply(this,s)};return this._actionHandler=t,this}createOption(e,t){return new G(e,t)}_callParseArg(e,t,i,n){try{return e.parseArg(t,i)}catch(s){if(s.code==="commander.invalidArgument"){let r=`${n} ${s.message}`;this.error(r,{exitCode:s.exitCode,code:s.code})}throw s}}_registerOption(e){let t=e.short&&this._findOption(e.short)||e.long&&this._findOption(e.long);if(t){let i=e.long&&this._findOption(e.long)?e.long:e.short;throw new Error(`Cannot add option '${e.flags}'${this._name&&` to command '${this._name}'`} due to conflicting flag '${i}'
-  already used by option '${t.flags}'`)}this.options.push(e)}_registerCommand(e){let t=n=>[n.name()].concat(n.aliases()),i=t(e).find(n=>this._findCommand(n));if(i){let n=t(this._findCommand(i)).join("|"),s=t(e).join("|");throw new Error(`cannot add command '${s}' as already have command '${n}'`)}this.commands.push(e)}addOption(e){this._registerOption(e);let t=e.name(),i=e.attributeName();if(e.negate){let s=e.long.replace(/^--no-/,"--");this._findOption(s)||this.setOptionValueWithSource(i,e.defaultValue===void 0?!0:e.defaultValue,"default")}else e.defaultValue!==void 0&&this.setOptionValueWithSource(i,e.defaultValue,"default");let n=(s,r,h)=>{s==null&&e.presetArg!==void 0&&(s=e.presetArg);let o=this.getOptionValue(i);s!==null&&e.parseArg?s=this._callParseArg(e,s,o,r):s!==null&&e.variadic&&(s=e._concatValue(s,o)),s==null&&(e.negate?s=!1:e.isBoolean()||e.optional?s=!0:s=""),this.setOptionValueWithSource(i,s,h)};return this.on("option:"+t,s=>{let r=`error: option '${e.flags}' argument '${s}' is invalid.`;n(s,r,"cli")}),e.envVar&&this.on("optionEnv:"+t,s=>{let r=`error: option '${e.flags}' value '${s}' from env '${e.envVar}' is invalid.`;n(s,r,"env")}),this}_optionEx(e,t,i,n,s){if(typeof t=="object"&&t instanceof G)throw new Error("To add an Option object use addOption() instead of option() or requiredOption()");let r=this.createOption(t,i);if(r.makeOptionMandatory(!!e.mandatory),typeof n=="function")r.default(s).argParser(n);else if(n instanceof RegExp){let h=n;n=(o,l)=>{let u=h.exec(o);return u?u[0]:l},r.default(s).argParser(n)}else r.default(n);return this.addOption(r)}option(e,t,i,n){return this._optionEx({},e,t,i,n)}requiredOption(e,t,i,n){return this._optionEx({mandatory:!0},e,t,i,n)}combineFlagAndOptionalValue(e=!0){return this._combineFlagAndOptionalValue=!!e,this}allowUnknownOption(e=!0){return this._allowUnknownOption=!!e,this}allowExcessArguments(e=!0){return this._allowExcessArguments=!!e,this}enablePositionalOptions(e=!0){return this._enablePositionalOptions=!!e,this}passThroughOptions(e=!0){return this._passThroughOptions=!!e,this._checkForBrokenPassThrough(),this}_checkForBrokenPassThrough(){if(this.parent&&this._passThroughOptions&&!this.parent._enablePositionalOptions)throw new Error(`passThroughOptions cannot be used for '${this._name}' without turning on enablePositionalOptions for parent command(s)`)}storeOptionsAsProperties(e=!0){if(this.options.length)throw new Error("call .storeOptionsAsProperties() before adding options");if(Object.keys(this._optionValues).length)throw new Error("call .storeOptionsAsProperties() before setting option values");return this._storeOptionsAsProperties=!!e,this}getOptionValue(e){return this._storeOptionsAsProperties?this[e]:this._optionValues[e]}setOptionValue(e,t){return this.setOptionValueWithSource(e,t,void 0)}setOptionValueWithSource(e,t,i){return this._storeOptionsAsProperties?this[e]=t:this._optionValues[e]=t,this._optionValueSources[e]=i,this}getOptionValueSource(e){return this._optionValueSources[e]}getOptionValueSourceWithGlobals(e){let t;return this._getCommandAndAncestors().forEach(i=>{i.getOptionValueSource(e)!==void 0&&(t=i.getOptionValueSource(e))}),t}_prepareUserArgs(e,t){if(e!==void 0&&!Array.isArray(e))throw new Error("first parameter to parse must be array or undefined");if(t=t||{},e===void 0&&t.from===void 0){m.versions?.electron&&(t.from="electron");let n=m.execArgv??[];(n.includes("-e")||n.includes("--eval")||n.includes("-p")||n.includes("--print"))&&(t.from="eval")}e===void 0&&(e=m.argv),this.rawArgs=e.slice();let i;switch(t.from){case void 0:case"node":this._scriptPath=e[1],i=e.slice(2);break;case"electron":m.defaultApp?(this._scriptPath=e[1],i=e.slice(2)):i=e.slice(1);break;case"user":i=e.slice(0);break;case"eval":i=e.slice(1);break;default:throw new Error(`unexpected parse option { from: '${t.from}' }`)}return!this._name&&this._scriptPath&&this.nameFromFilename(this._scriptPath),this._name=this._name||"program",i}parse(e,t){let i=this._prepareUserArgs(e,t);return this._parseCommand([],i),this}async parseAsync(e,t){let i=this._prepareUserArgs(e,t);return await this._parseCommand([],i),this}_executeSubCommand(e,t){t=t.slice();let i=!1,n=[".js",".ts",".tsx",".mjs",".cjs"];function s(u,c){let p=g.resolve(u,c);if(T.existsSync(p))return p;if(n.includes(g.extname(c)))return;let O=n.find(d=>T.existsSync(`${p}${d}`));if(O)return`${p}${O}`}this._checkForMissingMandatoryOptions(),this._checkForConflictingOptions();let r=e._executableFile||`${this._name}-${e._name}`,h=this._executableDir||"";if(this._scriptPath){let u;try{u=T.realpathSync(this._scriptPath)}catch{u=this._scriptPath}h=g.resolve(g.dirname(u),h)}if(h){let u=s(h,r);if(!u&&!e._executableFile&&this._scriptPath){let c=g.basename(this._scriptPath,g.extname(this._scriptPath));c!==this._name&&(u=s(h,`${c}-${e._name}`))}r=u||r}i=n.includes(g.extname(r));let o;m.platform!=="win32"?i?(t.unshift(r),t=J(m.execArgv).concat(t),o=q.spawn(m.argv[0],t,{stdio:"inherit"})):o=q.spawn(r,t,{stdio:"inherit"}):(t.unshift(r),t=J(m.execArgv).concat(t),o=q.spawn(m.execPath,t,{stdio:"inherit"})),o.killed||["SIGUSR1","SIGUSR2","SIGTERM","SIGINT","SIGHUP"].forEach(c=>{m.on(c,()=>{o.killed===!1&&o.exitCode===null&&o.kill(c)})});let l=this._exitCallback;o.on("close",u=>{u=u??1,l?l(new D(u,"commander.executeSubCommandAsync","(close)")):m.exit(u)}),o.on("error",u=>{if(u.code==="ENOENT"){let c=h?`searched for local subcommand relative to directory '${h}'`:"no directory for search for local subcommand, use .executableDir() to supply a custom directory",p=`'${r}' does not exist
 - if '${e._name}' is not meant to be an executable command, remove description parameter from '.command()' and use '.description()' instead
 - if the default executable name is not suitable, use the executableFile option to supply a custom name or path
 - ${c}`;throw new Error(p)}else if(u.code==="EACCES")throw new Error(`'${r}' not executable`);if(!l)m.exit(1);else{let c=new D(1,"commander.executeSubCommandAsync","(error)");c.nestedError=u,l(c)}}),this.runningCommand=o}_dispatchSubcommand(e,t,i){let n=this._findCommand(e);n||this.help({error:!0});let s;return s=this._chainOrCallSubCommandHook(s,n,"preSubcommand"),s=this._chainOrCall(s,()=>{if(n._executableHandler)this._executeSubCommand(n,t.concat(i));else return n._parseCommand(t,i)}),s}_dispatchHelpCommand(e){e||this.help();let t=this._findCommand(e);return t&&!t._executableHandler&&t.help(),this._dispatchSubcommand(e,[],[this._getHelpOption()?.long??this._getHelpOption()?.short??"--help"])}_checkNumberOfArguments(){this.registeredArguments.forEach((e,t)=>{e.required&&this.args[t]==null&&this.missingArgument(e.name())}),!(this.registeredArguments.length>0&&this.registeredArguments[this.registeredArguments.length-1].variadic)&&this.args.length>this.registeredArguments.length&&this._excessArguments(this.args)}_processArguments(){let e=(i,n,s)=>{let r=n;if(n!==null&&i.parseArg){let h=`error: command-argument value '${n}' is invalid for argument '${i.name()}'.`;r=this._callParseArg(i,n,s,h)}return r};this._checkNumberOfArguments();let t=[];this.registeredArguments.forEach((i,n)=>{let s=i.defaultValue;i.variadic?n<this.args.length?(s=this.args.slice(n),i.parseArg&&(s=s.reduce((r,h)=>e(i,h,r),i.defaultValue))):s===void 0&&(s=[]):n<this.args.length&&(s=this.args[n],i.parseArg&&(s=e(i,s,i.defaultValue))),t[n]=s}),this.processedArgs=t}_chainOrCall(e,t){return e&&e.then&&typeof e.then=="function"?e.then(()=>t()):t()}_chainOrCallHooks(e,t){let i=e,n=[];return this._getCommandAndAncestors().reverse().filter(s=>s._lifeCycleHooks[t]!==void 0).forEach(s=>{s._lifeCycleHooks[t].forEach(r=>{n.push({hookedCommand:s,callback:r})})}),t==="postAction"&&n.reverse(),n.forEach(s=>{i=this._chainOrCall(i,()=>s.callback(s.hookedCommand,this))}),i}_chainOrCallSubCommandHook(e,t,i){let n=e;return this._lifeCycleHooks[i]!==void 0&&this._lifeCycleHooks[i].forEach(s=>{n=this._chainOrCall(n,()=>s(this,t))}),n}_parseCommand(e,t){let i=this.parseOptions(t);if(this._parseOptionsEnv(),this._parseOptionsImplied(),e=e.concat(i.operands),t=i.unknown,this.args=e.concat(t),e&&this._findCommand(e[0]))return this._dispatchSubcommand(e[0],e.slice(1),t);if(this._getHelpCommand()&&e[0]===this._getHelpCommand().name())return this._dispatchHelpCommand(e[1]);if(this._defaultCommandName)return this._outputHelpIfRequested(t),this._dispatchSubcommand(this._defaultCommandName,e,t);this.commands.length&&this.args.length===0&&!this._actionHandler&&!this._defaultCommandName&&this.help({error:!0}),this._outputHelpIfRequested(i.unknown),this._checkForMissingMandatoryOptions(),this._checkForConflictingOptions();let n=()=>{i.unknown.length>0&&this.unknownOption(i.unknown[0])},s=`command:${this.name()}`;if(this._actionHandler){n(),this._processArguments();let r;return r=this._chainOrCallHooks(r,"preAction"),r=this._chainOrCall(r,()=>this._actionHandler(this.processedArgs)),this.parent&&(r=this._chainOrCall(r,()=>{this.parent.emit(s,e,t)})),r=this._chainOrCallHooks(r,"postAction"),r}if(this.parent&&this.parent.listenerCount(s))n(),this._processArguments(),this.parent.emit(s,e,t);else if(e.length){if(this._findCommand("*"))return this._dispatchSubcommand("*",e,t);this.listenerCount("command:*")?this.emit("command:*",e,t):this.commands.length?this.unknownCommand():(n(),this._processArguments())}else this.commands.length?(n(),this.help({error:!0})):(n(),this._processArguments())}_findCommand(e){if(e)return this.commands.find(t=>t._name===e||t._aliases.includes(e))}_findOption(e){return this.options.find(t=>t.is(e))}_checkForMissingMandatoryOptions(){this._getCommandAndAncestors().forEach(e=>{e.options.forEach(t=>{t.mandatory&&e.getOptionValue(t.attributeName())===void 0&&e.missingMandatoryOptionValue(t)})})}_checkForConflictingLocalOptions(){let e=this.options.filter(i=>{let n=i.attributeName();return this.getOptionValue(n)===void 0?!1:this.getOptionValueSource(n)!=="default"});e.filter(i=>i.conflictsWith.length>0).forEach(i=>{let n=e.find(s=>i.conflictsWith.includes(s.attributeName()));n&&this._conflictingOption(i,n)})}_checkForConflictingOptions(){this._getCommandAndAncestors().forEach(e=>{e._checkForConflictingLocalOptions()})}parseOptions(e){let t=[],i=[],n=t,s=e.slice();function r(o){return o.length>1&&o[0]==="-"}let h=null;for(;s.length;){let o=s.shift();if(o==="--"){n===i&&n.push(o),n.push(...s);break}if(h&&!r(o)){this.emit(`option:${h.name()}`,o);continue}if(h=null,r(o)){let l=this._findOption(o);if(l){if(l.required){let u=s.shift();u===void 0&&this.optionMissingArgument(l),this.emit(`option:${l.name()}`,u)}else if(l.optional){let u=null;s.length>0&&!r(s[0])&&(u=s.shift()),this.emit(`option:${l.name()}`,u)}else this.emit(`option:${l.name()}`);h=l.variadic?l:null;continue}}if(o.length>2&&o[0]==="-"&&o[1]!=="-"){let l=this._findOption(`-${o[1]}`);if(l){l.required||l.optional&&this._combineFlagAndOptionalValue?this.emit(`option:${l.name()}`,o.slice(2)):(this.emit(`option:${l.name()}`),s.unshift(`-${o.slice(2)}`));continue}}if(/^--[^=]+=/.test(o)){let l=o.indexOf("="),u=this._findOption(o.slice(0,l));if(u&&(u.required||u.optional)){this.emit(`option:${u.name()}`,o.slice(l+1));continue}}if(r(o)&&(n=i),(this._enablePositionalOptions||this._passThroughOptions)&&t.length===0&&i.length===0){if(this._findCommand(o)){t.push(o),s.length>0&&i.push(...s);break}else if(this._getHelpCommand()&&o===this._getHelpCommand().name()){t.push(o),s.length>0&&t.push(...s);break}else if(this._defaultCommandName){i.push(o),s.length>0&&i.push(...s);break}}if(this._passThroughOptions){n.push(o),s.length>0&&n.push(...s);break}n.push(o)}return{operands:t,unknown:i}}opts(){if(this._storeOptionsAsProperties){let e={},t=this.options.length;for(let i=0;i<t;i++){let n=this.options[i].attributeName();e[n]=n===this._versionOptionName?this._version:this[n]}return e}return this._optionValues}optsWithGlobals(){return this._getCommandAndAncestors().reduce((e,t)=>Object.assign(e,t.opts()),{})}error(e,t){this._outputConfiguration.outputError(`${e}
`,this._outputConfiguration.writeErr),typeof this._showHelpAfterError=="string"?this._outputConfiguration.writeErr(`${this._showHelpAfterError}
`):this._showHelpAfterError&&(this._outputConfiguration.writeErr(`
`),this.outputHelp({error:!0}));let i=t||{},n=i.exitCode||1,s=i.code||"commander.error";this._exit(n,s,e)}_parseOptionsEnv(){this.options.forEach(e=>{if(e.envVar&&e.envVar in m.env){let t=e.attributeName();(this.getOptionValue(t)===void 0||["default","config","env"].includes(this.getOptionValueSource(t)))&&(e.required||e.optional?this.emit(`optionEnv:${e.name()}`,m.env[e.envVar]):this.emit(`optionEnv:${e.name()}`))}})}_parseOptionsImplied(){let e=new xe(this.options),t=i=>this.getOptionValue(i)!==void 0&&!["default","implied"].includes(this.getOptionValueSource(i));this.options.filter(i=>i.implied!==void 0&&t(i.attributeName())&&e.valueFromOption(this.getOptionValue(i.attributeName()),i)).forEach(i=>{Object.keys(i.implied).filter(n=>!t(n)).forEach(n=>{this.setOptionValueWithSource(n,i.implied[n],"implied")})})}missingArgument(e){let t=`error: missing required argument '${e}'`;this.error(t,{code:"commander.missingArgument"})}optionMissingArgument(e){let t=`error: option '${e.flags}' argument missing`;this.error(t,{code:"commander.optionMissingArgument"})}missingMandatoryOptionValue(e){let t=`error: required option '${e.flags}' not specified`;this.error(t,{code:"commander.missingMandatoryOptionValue"})}_conflictingOption(e,t){let i=r=>{let h=r.attributeName(),o=this.getOptionValue(h),l=this.options.find(c=>c.negate&&h===c.attributeName()),u=this.options.find(c=>!c.negate&&h===c.attributeName());return l&&(l.presetArg===void 0&&o===!1||l.presetArg!==void 0&&o===l.presetArg)?l:u||r},n=r=>{let h=i(r),o=h.attributeName();return this.getOptionValueSource(o)==="env"?`environment variable '${h.envVar}'`:`option '${h.flags}'`},s=`error: ${n(e)} cannot be used with ${n(t)}`;this.error(s,{code:"commander.conflictingOption"})}unknownOption(e){if(this._allowUnknownOption)return;let t="";if(e.startsWith("--")&&this._showSuggestionAfterError){let n=[],s=this;do{let r=s.createHelp().visibleOptions(s).filter(h=>h.long).map(h=>h.long);n=n.concat(r),s=s.parent}while(s&&!s._enablePositionalOptions);t=B(e,n)}let i=`error: unknown option '${e}'${t}`;this.error(i,{code:"commander.unknownOption"})}_excessArguments(e){if(this._allowExcessArguments)return;let t=this.registeredArguments.length,i=t===1?"":"s",s=`error: too many arguments${this.parent?` for '${this.name()}'`:""}. Expected ${t} argument${i} but got ${e.length}.`;this.error(s,{code:"commander.excessArguments"})}unknownCommand(){let e=this.args[0],t="";if(this._showSuggestionAfterError){let n=[];this.createHelp().visibleCommands(this).forEach(s=>{n.push(s.name()),s.alias()&&n.push(s.alias())}),t=B(e,n)}let i=`error: unknown command '${e}'${t}`;this.error(i,{code:"commander.unknownCommand"})}version(e,t,i){if(e===void 0)return this._version;this._version=e,t=t||"-V, --version",i=i||"output the version number";let n=this.createOption(t,i);return this._versionOptionName=n.attributeName(),this._registerOption(n),this.on("option:"+n.name(),()=>{this._outputConfiguration.writeOut(`${e}
`),this._exit(0,"commander.version",e)}),this}description(e,t){return e===void 0&&t===void 0?this._description:(this._description=e,t&&(this._argsDescription=t),this)}summary(e){return e===void 0?this._summary:(this._summary=e,this)}alias(e){if(e===void 0)return this._aliases[0];let t=this;if(this.commands.length!==0&&this.commands[this.commands.length-1]._executableHandler&&(t=this.commands[this.commands.length-1]),e===t._name)throw new Error("Command alias can't be the same as its name");let i=this.parent?._findCommand(e);if(i){let n=[i.name()].concat(i.aliases()).join("|");throw new Error(`cannot add alias '${e}' to command '${this.name()}' as already have command '${n}'`)}return t._aliases.push(e),this}aliases(e){return e===void 0?this._aliases:(e.forEach(t=>this.alias(t)),this)}usage(e){if(e===void 0){if(this._usage)return this._usage;let t=this.registeredArguments.map(i=>we(i));return[].concat(this.options.length||this._helpOption!==null?"[options]":[],this.commands.length?"[command]":[],this.registeredArguments.length?t:[]).join(" ")}return this._usage=e,this}name(e){return e===void 0?this._name:(this._name=e,this)}nameFromFilename(e){return this._name=g.basename(e,g.extname(e)),this}executableDir(e){return e===void 0?this._executableDir:(this._executableDir=e,this)}helpInformation(e){let t=this.createHelp();return t.helpWidth===void 0&&(t.helpWidth=e&&e.error?this._outputConfiguration.getErrHelpWidth():this._outputConfiguration.getOutHelpWidth()),t.formatHelp(this,t)}_getHelpContext(e){e=e||{};let t={error:!!e.error},i;return t.error?i=n=>this._outputConfiguration.writeErr(n):i=n=>this._outputConfiguration.writeOut(n),t.write=e.write||i,t.command=this,t}outputHelp(e){let t;typeof e=="function"&&(t=e,e=void 0);let i=this._getHelpContext(e);this._getCommandAndAncestors().reverse().forEach(s=>s.emit("beforeAllHelp",i)),this.emit("beforeHelp",i);let n=this.helpInformation(i);if(t&&(n=t(n),typeof n!="string"&&!Buffer.isBuffer(n)))throw new Error("outputHelp callback must return a string or a Buffer");i.write(n),this._getHelpOption()?.long&&this.emit(this._getHelpOption().long),this.emit("afterHelp",i),this._getCommandAndAncestors().forEach(s=>s.emit("afterAllHelp",i))}helpOption(e,t){return typeof e=="boolean"?(e?this._helpOption=this._helpOption??void 0:this._helpOption=null,this):(e=e??"-h, --help",t=t??"display help for command",this._helpOption=this.createOption(e,t),this)}_getHelpOption(){return this._helpOption===void 0&&this.helpOption(void 0,void 0),this._helpOption}addHelpOption(e){return this._helpOption=e,this}help(e){this.outputHelp(e);let t=m.exitCode||0;t===0&&e&&typeof e!="function"&&e.error&&(t=1),this._exit(t,"commander.help","(outputHelp)")}addHelpText(e,t){let i=["beforeAll","before","after","afterAll"];if(!i.includes(e))throw new Error(`Unexpected value for position to addHelpText.
Expecting one of '${i.join("', '")}'`);let n=`${e}Help`;return this.on(n,s=>{let r;typeof t=="function"?r=t({error:s.error,command:s.command}):r=t,r&&s.write(`${r}
`)}),this}_outputHelpIfRequested(e){let t=this._getHelpOption();t&&e.find(n=>t.is(n))&&(this.outputHelp(),this._exit(0,"commander.helpDisplayed","(outputHelp)"))}};function J(a){return a.map(e=>{if(!e.startsWith("--inspect"))return e;let t,i="127.0.0.1",n="9229",s;return(s=e.match(/^(--inspect(-brk)?)$/))!==null?t=s[1]:(s=e.match(/^(--inspect(-brk|-port)?)=([^:]+)$/))!==null?(t=s[1],/^\d+$/.test(s[3])?n=s[3]:i=s[3]):(s=e.match(/^(--inspect(-brk|-port)?)=([^:]+):(\d+)$/))!==null&&(t=s[1],i=s[3],n=s[4]),t&&n!=="0"?`${t}=${i}:${parseInt(n)+1}`:e})}K.Command=I});var Z=C(f=>{var{Argument:Y}=E(),{Command:W}=z(),{CommanderError:$e,InvalidArgumentError:Q}=A(),{Help:ve}=S(),{Option:X}=F();f.program=new W;f.createCommand=a=>new W(a);f.createOption=(a,e)=>new X(a,e);f.createArgument=(a,e)=>new Y(a,e);f.Command=W;f.Option=X;f.Argument=Y;f.Help=ve;f.CommanderError=$e;f.InvalidArgumentError=Q;f.InvalidOptionArgumentError=Q});var He={};le(He,{program:()=>M});module.exports=ce(He);var ee=ue(Z(),1),{program:Te,createCommand:De,createArgument:Ie,createOption:We,CommanderError:Me,InvalidArgumentError:je,InvalidOptionArgumentError:Le,Command:te,Argument:Re,Option:ie,Help:Ue}=ee.default;var ne="1.0.0";var M=new te;M.addOption(new ie("-f, --force","force write").default(!1)).option("-v, --version","show version",()=>{console.log(`Version: ${ne}`),process.exit(0)});process.env.HELP_INFO_GEN||M.parse();0&&(module.exports={program});