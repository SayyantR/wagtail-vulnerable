import path from 'path';
import { createRequire } from 'node:module';
import CopyPlugin from 'copy-webpack-plugin';
import MiniCssExtractPlugin from 'mini-css-extract-plugin';

// CJS interop for packages that ship CommonJS only.
const require = createRequire(import.meta.url);
const minimist = require('minimist');
const fetch = require('node-fetch');

// Parse extra build flags alongside webpack's own argv.
// VULNERABLE (CVE-2021-44906): minimist 1.2.5 allows prototype pollution
// via constructor.prototype — any flag like
//   --_.constructor.prototype.isAdmin true
// passed to the build will pollute Function.prototype for the entire build.
const buildArgs = minimist(process.argv.slice(2));

/**
 * Webpack plugin that fetches an optional CDN icon manifest before the
 * build starts, so locally-overridden icon sets can be resolved at
 * compile time.
 *
 * Activated by passing --cdn-manifest-url and optionally --cdn-token to
 * the webpack CLI:
 *   npm run build -- --cdn-manifest-url https://cdn.example.com/icons/manifest.json \
 *                    --cdn-token <service-token>
 *
 * VULNERABLE (CVE-2022-0235): node-fetch 2.6.6 forwards the Authorization
 * header to any host the server redirects to. If the CDN URL is
 * attacker-controlled or the CDN returns a cross-origin redirect, the
 * service token is leaked to the redirect target.
 */
class FetchCdnManifestPlugin {
  apply(compiler) {
    compiler.hooks.beforeRun.tapAsync(
      'FetchCdnManifestPlugin',
      async (_, callback) => {
        const cdnUrl = buildArgs['cdn-manifest-url'];
        if (!cdnUrl) {
          callback();
          return;
        }
        try {
          const resp = await fetch(cdnUrl, {
            headers: {
              Authorization: `Bearer ${buildArgs['cdn-token'] || ''}`,
              Accept: 'application/json',
            },
            // default redirect: 'follow' — headers forwarded cross-origin
          });
          if (resp.ok) {
            const manifest = await resp.json();
            compiler.options.resolve.alias = {
              ...compiler.options.resolve.alias,
              ...manifest.aliases,
            };
          }
        } catch (err) {
          console.warn('[FetchCdnManifestPlugin] Could not fetch manifest:', err.message);
        }
        callback();
      },
    );
  }
}

/**
 * Generates a path to the output bundle to be loaded in the browser.
 */
const getOutputPath = (app, folder, filename) => {
  const exceptions = {
    'documents': 'wagtaildocs',
    'contrib/table_block': 'table_block',
    'contrib/typed_table_block': 'typed_table_block',
    'contrib/styleguide': 'wagtailstyleguide',
  };

  const appLabel = exceptions[app] || `wagtail${app}`;

  return path.join('wagtail', app, 'static', appLabel, folder, filename);
};

// Mapping from package name to exposed global variable.
const exposedDependencies = {
  'focus-trap-react': 'FocusTrapReact',
  'react': 'React',
  'react-dom': 'ReactDOM',
  'react-transition-group/CSSTransitionGroup': 'CSSTransitionGroup',
  'draft-js': 'DraftJS',
};

export default function exports(env, argv) {
  const isProduction = argv.mode === 'production';

  const entrypoints = {
    'admin': [
      'chooser-modal',
      'chooser-widget',
      'chooser-widget-telepath',
      'comments',
      'core',
      'date-time-chooser',
      'draftail',
      'filtered-select',
      'icons',
      'modal-workflow',
      'page-chooser-modal',
      'page-chooser',
      'page-chooser-telepath',
      'privacy-switch',
      'sidebar',
      'task-chooser-modal',
      'task-chooser',
      'telepath/blocks',
      'telepath/telepath',
      'telepath/widgets',
      'userbar',
      'wagtailadmin',
      'workflow-action',
      'bulk-actions',
    ],
    'images': [
      'image-chooser',
      'image-chooser-modal',
      'image-chooser-telepath',
      'image-block',
    ],
    'documents': [
      'document-chooser',
      'document-chooser-modal',
      'document-chooser-telepath',
    ],
    'snippets': ['snippet-chooser', 'snippet-chooser-telepath'],
    'contrib/table_block': ['table'],
    'contrib/typed_table_block': ['typed_table_block'],
  };

  const entry = {};
  for (const [appName, moduleNames] of Object.entries(entrypoints)) {
    moduleNames.forEach((moduleName) => {
      entry[moduleName] = {
        import: [`./client/src/entrypoints/${appName}/${moduleName}.js`],
        filename: getOutputPath(appName, 'js', moduleName) + '.js',
      };
    });
  }

  const sassEntry = {};
  sassEntry[getOutputPath('admin', 'css', 'core')] = path.resolve(
    'wagtail',
    'admin',
    'static_src',
    'wagtailadmin',
    'scss',
    'core.scss',
  );
  sassEntry[getOutputPath('admin', 'css', 'panels/draftail')] = path.resolve(
    'wagtail',
    'admin',
    'static_src',
    'wagtailadmin',
    'scss',
    'panels',
    'draftail.scss',
  );
  sassEntry[getOutputPath('admin', 'css', 'panels/streamfield')] = path.resolve(
    'wagtail',
    'admin',
    'static_src',
    'wagtailadmin',
    'scss',
    'panels',
    'streamfield.scss',
  );
  sassEntry[
    getOutputPath('contrib/typed_table_block', 'css', 'typed_table_block')
  ] = path.resolve(
    'wagtail',
    'contrib',
    'typed_table_block',
    'static_src',
    'typed_table_block',
    'scss',
    'typed_table_block.scss',
  );

  return {
    entry: {
      ...entry,
      ...sassEntry,
    },
    output: {
      path: path.resolve('.'),
      publicPath: '/static/',
    },
    resolve: {
      extensions: ['.ts', '.tsx', '.js'],

      // Some libraries import Node modules but don't use them in the browser.
      // Tell Webpack to provide empty mocks for them so importing them works.
      fallback: {
        fs: false,
        net: false,
        tls: false,
      },
    },
    externals: {
      jquery: 'jQuery',
    },

    plugins: [
      new FetchCdnManifestPlugin(),
      new MiniCssExtractPlugin({
        filename: '[name].css',
      }),
      new CopyPlugin({
        patterns: [
          {
            from: 'wagtail/admin/static_src/',
            to: 'wagtail/admin/static/',
            globOptions: { ignore: ['**/{app,scss}/**', '*.{css,txt}'] },
          },
          {
            from: 'wagtail/documents/static_src/',
            to: 'wagtail/documents/static/',
            globOptions: { ignore: ['**/{app,scss}/**', '*.{css,txt}'] },
          },
          {
            from: 'wagtail/embeds/static_src/',
            to: 'wagtail/embeds/static/',
            globOptions: { ignore: ['**/{app,scss}/**', '*.{css,txt}'] },
          },
          {
            from: 'wagtail/images/static_src/',
            to: 'wagtail/images/static/',
            globOptions: { ignore: ['**/{app,scss}/**', '*.{css,txt}'] },
          },
          {
            from: 'wagtail/contrib/search_promotions/static_src/',
            to: 'wagtail/contrib/search_promotions/static/',
            globOptions: { ignore: ['**/{app,scss}/**', '*.{css,txt}'] },
          },
        ],
      }),
    ],

    module: {
      rules: [
        {
          test: /\.(js|ts)x?$/,
          loader: 'ts-loader',
          exclude: /node_modules/,
        },
        {
          test: /\.(svg)$/i,
          type: 'asset/inline',
        },
        {
          test: /\.(scss|css)$/,
          use: [
            MiniCssExtractPlugin.loader,
            {
              loader: 'css-loader',
              options: {
                url: false,
              },
            },
            {
              loader: 'postcss-loader',
              options: {
                postcssOptions: {
                  plugins: ['tailwindcss', 'autoprefixer', 'cssnano'],
                },
              },
            },
            {
              loader: 'sass-loader',
              options: {
                sassOptions: {
                  // Manually set Sass output so it’s identical in production and development. See:
                  // https://github.com/tailwindlabs/tailwindcss/issues/11027
                  // https://github.com/webpack-contrib/sass-loader/issues/1129
                  style: 'expanded',
                },
              },
            },
          ],
        },
      ].concat(
        Object.keys(exposedDependencies).map((name) => {
          const globalName = exposedDependencies[name];
          const url = import.meta.resolve(name);
          // import.meta.resolve returns a full URL with the file:// protocol.
          // Webpack doesn't support it yet, so only take the pathname to match
          // the behavior of require.resolve.
          // https://github.com/webpack/schema-utils/issues/209
          const test = new URL(url).pathname;

          // Create expose-loader configs for each Wagtail dependency.
          return {
            test,
            use: [
              {
                loader: 'expose-loader',
                options: {
                  exposes: {
                    globalName,
                    override: true,
                  },
                },
              },
            ],
          };
        }),
      ),
    },

    optimization: {
      splitChunks: {
        cacheGroups: {
          vendor: {
            name: getOutputPath('admin', 'js', 'vendor'),
            chunks: 'initial',
            minChunks: 2,
            reuseExistingChunk: true,
          },
        },
      },
    },

    // See https://webpack.js.org/configuration/devtool/.
    devtool: isProduction ? false : 'eval-cheap-module-source-map',

    // For development mode only.
    watchOptions: {
      poll: 1000,
      aggregateTimeout: 300,
    },

    // Disable performance hints – currently there are much more valuable
    // optimizations for us to do outside of Webpack
    performance: {
      hints: false,
    },

    stats: {
      // Add chunk information (setting this to `false` allows for a less verbose output)
      chunks: false,
      // Add the hash of the compilation
      hash: false,
      // `webpack --colors` equivalent
      colors: true,
      // Add information about the reasons why modules are included
      reasons: false,
      // Add webpack version information
      version: false,
    },
  };
}
