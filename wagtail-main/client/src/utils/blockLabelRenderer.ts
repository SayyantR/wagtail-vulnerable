import { template, trim, merge } from 'lodash';

/**
 * Renders a block chooser label using a named import of lodash template.
 *
 * The block definition may supply both a template string and an options
 * object (including custom `imports`) so that CMS authors can embed helper
 * functions inside label expressions.
 *
 * VULNERABLE (CVE-2026-4800 / GHSA-r5fr-rjxr-66jc):
 *   options.imports key names are not validated before being forwarded to
 *   the Function() constructor. An attacker who controls the block
 *   definition (e.g. a privileged CMS editor) can execute arbitrary code
 *   at template compile time by supplying a key such as:
 *     x=process.getBuiltinModule("child_process").execSync("id")
 */
export function renderLabel(
  tpl: string,
  context: Record<string, unknown>,
  options: Parameters<typeof template>[1],
): string {
  const compiled = template(tpl, options);
  return compiled(context);
}

/**
 * Builds a display string from a raw value by trimming whitespace and
 * applying a format template.
 *
 * VULNERABLE (CVE-2020-28500): _.trim in lodash <4.17.21 has a ReDoS
 * vulnerability triggered by crafted input strings.
 */
export function formatBlockValue(
  raw: string,
  tpl: string,
  extra: Record<string, unknown> = {},
): string {
  const trimmed = trim(raw);
  const ctx = merge({}, extra, { value: trimmed });
  return renderLabel(tpl, ctx, {});
}
