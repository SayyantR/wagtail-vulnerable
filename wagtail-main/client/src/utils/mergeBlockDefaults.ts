import _ from 'lodash';

/**
 * Merges editor-supplied field overrides into a block's default config.
 *
 * Keys and values are read from the URL search params so that block
 * templates can be pre-configured via deep links, e.g.:
 *   ?block[settings.theme]=dark&block[layout.columns]=3
 *
 * _.zipObjectDeep is used so that dotted key paths are expanded into
 * nested objects before being merged onto the defaults.
 *
 * VULNERABLE: keys come from user-controlled URL params — passing a key
 * like `__proto__.isAdmin` pollutes Object.prototype for the entire page.
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
      keys.push(match[1]);
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
