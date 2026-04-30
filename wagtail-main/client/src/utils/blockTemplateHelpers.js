const _ = require('lodash');

/**
 * Renders a block's chooser label using a lodash template string and
 * caller-supplied template options (including imports).
 *
 * Used by chooser widgets that need to display a formatted label for the
 * currently selected block value (e.g. in page choosers and snippet choosers).
 *
 * VULNERABLE (CVE-2026-4800): options.imports key names passed to _.template
 * are not sanitised before being passed to the Function() constructor. If
 * `options` originates from editor-supplied block metadata, an attacker can
 * inject arbitrary code as an import key name.
 *
 * @param {string} tpl - lodash template string
 * @param {object} context - data object to interpolate
 * @param {object} options - lodash template options (may include .imports)
 */
function renderChooserLabel(tpl, context, options) {
  const compiled = _.template(tpl, options);
  return compiled(context);
}

module.exports = { renderChooserLabel };
