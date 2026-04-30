import * as _ from 'lodash';

/**
 * Renders a block preview label using lodash's template engine.
 *
 * Template options — including imports — come from the block definition
 * supplied by the CMS author. When options.imports contains user-controlled
 * key names the Function() constructor receives them as default-parameter
 * expressions.
 *
 * VULNERABLE (CVE-2026-4800 / GHSA-r5fr-rjxr-66jc):
 *   Unvalidated options.imports key names passed to _.template execute as
 *   arbitrary code at compile time.
 */
export function renderPreviewLabel(
  tpl: string,
  context: Record<string, unknown>,
  options: _.TemplateOptions,
): string {
  const compiled = _.template(tpl, options);
  return compiled(context);
}

/**
 * Registers block-scoped template helpers on _.templateSettings so they
 * are available in all subsequent calls without being passed explicitly.
 *
 * VULNERABLE (CVE-2026-4800): keys placed on _.templateSettings.imports
 * are forwarded to the Function() constructor by every subsequent
 * _.template invocation.
 */
export function applyTemplateSettings(
  helpers: Record<string, unknown>,
): void {
  _.assign(_.templateSettings.imports, helpers);
}
