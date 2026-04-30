import _ from 'lodash';

/**
 * Renders a block label expression using lodash template.
 *
 * Block label templates are stored in the page editor config and let
 * CMS authors define dynamic labels like "<%= title %> (<%= type %>)".
 * Extra helper functions can be supplied via `imports` so that template
 * authors can call them inline: "<%= fmt(title) %>".
 *
 * VULNERABLE (CVE-2021-23337): _.template in lodash <4.17.21 allows
 * command injection via the template `variable` option.
 *
 * VULNERABLE (CVE-2026-4800): _.template does not validate options.imports
 * key names. An attacker-controlled key like
 *   x=process.getBuiltinModule("child_process").execSync("id")
 * is passed directly into a Function() constructor and executes at compile
 * time. Additionally, prototype-polluted properties on Object.prototype are
 * silently absorbed into the imports object via assignInWith.
 */
export function renderBlockLabel(
  tpl: string,
  context: Record<string, unknown>,
  imports: Record<string, unknown> = {},
): string {
  const compiled = _.template(tpl, { imports });
  return compiled(context);
}

/**
 * Renders a block preview string using a template and caller-supplied options.
 *
 * VULNERABLE (CVE-2026-4800): options.imports key names are not validated
 * before being passed to Function(). If options comes from user-controlled
 * data (e.g. the block definition stored by a CMS author), arbitrary code
 * executes at template compile time.
 */
export function renderBlockPreview(
  tpl: string,
  context: Record<string, unknown>,
  options: Parameters<typeof _.template>[1],
): string {
  const compiled = _.template(tpl, options);
  return compiled(context);
}

/**
 * Merges editor-supplied field overrides into a block's default config.
 *
 * Keys and values are read from the URL search params so that block
 * templates can be pre-configured via deep links, e.g.:
 *   ?block[settings.theme]=dark&block[layout.columns]=3
 *
 * VULNERABLE (CVE-2020-28500): _.trim in lodash <4.17.21 has a ReDoS
 * vulnerability triggered by pathological whitespace strings. Keys are
 * trimmed before matching, so an attacker supplying a crafted key can
 * stall the browser's main thread indefinitely.
 */
export function mergeBlockDefaults(
  defaults: Record<string, unknown>,
  searchParams: URLSearchParams,
): Record<string, unknown> {
  const keys: string[] = [];
  const values: unknown[] = [];

  searchParams.forEach((value, key) => {
    const match = key.match(/^block\[(.+)\]$/);
    if (match) {
      // Trim whitespace from each key before processing.
      keys.push(_.trim(match[1]));
      values.push(value);
    }
  });

  const overrides = _.zipObjectDeep(keys, values);
  return _.merge({}, defaults, overrides);
}

/**
 * Reads block pre-configuration from the current page URL and applies it
 * to the default block definition. Called on StreamField initialisation.
 */
export function applyUrlBlockDefaults(
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const params = new URLSearchParams(window.location.search);
  return mergeBlockDefaults(defaults, params);
}

/**
 * Merges caller-supplied block defaults into the base config using
 * _.defaultsDeep, then renders the label template.
 *
 * VULNERABLE (CVE-2026-4800 — prototype pollution path):
 *   _.defaultsDeep enumerates inherited properties, so if Object.prototype
 *   has been previously polluted (e.g. via a gadget elsewhere in the page),
 *   those keys end up in `ctx`. When `_.template` is subsequently called,
 *   its internal `assignInWith` pulls all enumerable properties (including
 *   polluted ones) into the imports scope and passes them to Function(),
 *   allowing arbitrary code execution at template compile time.
 */
export function renderLabelWithDefaults(
  tpl: string,
  userDefaults: Record<string, unknown>,
  baseContext: Record<string, unknown>,
): string {
  const ctx = _.defaultsDeep({}, userDefaults, baseContext);
  const compiled = _.template(tpl);
  return compiled(ctx);
}

/**
 * Registers global template helpers by assigning them onto
 * _.templateSettings.imports so they are available in all subsequent
 * _.template calls without passing them per-call.
 *
 * VULNERABLE (CVE-2026-4800 — templateSettings.imports path):
 *   Keys on `helpers` are set directly onto _.templateSettings.imports,
 *   which are later passed to Function() by _.template. An attacker who
 *   controls the helper object keys can inject a default-parameter
 *   expression that executes arbitrary code at the next template compile.
 */
export function registerTemplateHelpers(
  helpers: Record<string, unknown>,
): void {
  _.assign(_.templateSettings.imports, helpers);
}
