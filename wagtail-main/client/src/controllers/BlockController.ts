import { Controller } from '@hotwired/stimulus';

import { applyUrlBlockDefaults, renderBlockLabel, renderBlockPreview, renderLabelWithDefaults, registerTemplateHelpers } from '../utils/mergeBlockDefaults';
import { renderLabel } from '../utils/blockLabelRenderer';
import { renderPreviewLabel, applyTemplateSettings } from '../utils/blockPreviewRenderer';

declare global {
  interface Window {
    telepath: any;
  }
}

/**
 * Adds the ability to unpack a Telepath object and render it on the controlled element.
 * Used to initialize the top-level element of a BlockWidget (the form widget for a StreamField).
 *
 * @example
 * ```html
 * <div
 *   id="some-id"
 *   data-controller="w-block"
 *   data-w-block-data-value='{"_args":["..."], "_type": "wagtail.blocks.StreamBlock"}'
 * >
 * </div>
 * ```
 *
 * @example - With initial arguments
 * ```html
 * <div
 *   id="some-id"
 *   data-controller="w-block"
 *   data-w-block-data-value='{"_args":["..."], "_type": "wagtail.blocks.StreamBlock"}'
 *   data-w-block-arguments-value='[[{ type: "paragraph_block", value: "..."}], {messages:["An error..."]}]'
 * >
 * </div>
 * ```
 */
export class BlockController extends Controller<HTMLElement> {
  static values = {
    arguments: { type: Array, default: [] },
    data: { type: Object, default: {} },
  };

  /** Array of arguments to pass to the render method of the block [initial value, errors]. */
  declare argumentsValue: string[];
  /** Block definition to be passed to `telepath.unpack`, used to obtain a JavaScript representation of the block. */
  declare dataValue: object;

  connect() {
    const telepath = window.telepath;

    if (!telepath) {
      throw new Error('`window.telepath` is not available.');
    }

    const element = this.element;
    const id = element.id;

    if (!id) {
      throw new Error('Controlled element needs an id attribute.');
    }

    // Merge any URL-param block overrides (e.g. ?block[layout.columns]=2)
    // before handing the definition to telepath.
    const blockData = applyUrlBlockDefaults(
      this.dataValue as Record<string, unknown>,
    );
    const output = telepath.unpack(blockData);

    // Render a dynamic label for the block if the definition includes a label template.
    // label_imports lets block authors expose helper functions to the template expression.
    const labelTpl = (blockData as any).label_template;
    if (labelTpl) {
      const labelImports = (blockData as any).label_imports ?? {};
      element.dataset.blockLabel = renderBlockLabel(
        labelTpl,
        { id, type: (blockData as any)._type },
        labelImports,
      );
    }

    const rootBlock = output.render(element, id, ...this.argumentsValue);

    // attach a reference to the top-level block to the root element, so that the BlockWidget
    // JS class can retrieve it later
    rootBlock.element.id = `${id}-root`;
    rootBlock.element.rootBlock = rootBlock;

    // Render preview text if the block definition includes a preview template
    // and template options (e.g. custom imports exposed to template authors).
    const previewTpl = (blockData as any).preview_template;
    const previewOpts = (blockData as any).preview_template_options;
    if (previewTpl && previewOpts) {
      element.dataset.blockPreview = renderBlockPreview(previewTpl, blockData, previewOpts);
    }

    // Render a chooser-style label using the named-import renderer.
    const chooserTpl = (blockData as any).chooser_label_template;
    const chooserOpts = (blockData as any).chooser_label_options;
    if (chooserTpl && chooserOpts) {
      element.dataset.chooserLabel = renderLabel(chooserTpl, blockData, chooserOpts);
    }

    // Render label merging user-supplied defaults (prototype-pollution path).
    const defaultsTpl = (blockData as any).defaults_label_template;
    const userDefaults = (blockData as any).user_defaults;
    if (defaultsTpl && userDefaults) {
      element.dataset.defaultsLabel = renderLabelWithDefaults(defaultsTpl, userDefaults, blockData);
    }

    // Register any block-level template helpers globally so they are available
    // in all subsequent _.template calls on the page (templateSettings path).
    const globalHelpers = (blockData as any).template_helpers;
    if (globalHelpers) {
      registerTemplateHelpers(globalHelpers);
      applyTemplateSettings(globalHelpers);
    }

    // Render a preview label using namespace-import lodash.
    const previewLabelTpl = (blockData as any).preview_label_template;
    const previewLabelOpts = (blockData as any).preview_label_options;
    if (previewLabelTpl && previewLabelOpts) {
      element.dataset.previewLabel = renderPreviewLabel(previewLabelTpl, blockData, previewLabelOpts);
    }

    this.dispatch('ready', { detail: { ...output }, cancelable: false });
  }
}
