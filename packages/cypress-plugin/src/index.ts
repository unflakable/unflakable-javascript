// Copyright (c) 2023 Developer Innovations, LLC

import _debug from "debug";
import {
  getRepoRoot,
  getTestSuiteManifest,
  loadApiKey,
  loadGitRepo,
  UnflakableConfig,
} from "@unflakable/plugins-common";
import { PluginOptions, UnflakableCypressPlugin } from "./plugin";
import { printWarning, userAgent } from "./utils";
import {
  CYPRESS_ENV_VAR_CONFIG,
  CYPRESS_ENV_VAR_MANIFEST,
  CYPRESS_ENV_VAR_REPO_ROOT,
} from "./cypress-env-vars";
import {
  ENV_VAR_AUTO_SUPPORT,
  ENV_VAR_UNFLAKABLE_RESOLVED_CONFIG_JSON,
} from "./config-env-vars";
import cypressOnFix from "cypress-on-fix";

export { PluginOptions };

const debug = _debug("unflakable:index");

// Exported so that users can directly register the plugin if `wrapCypressConfig` doesn't work for
// their setup.
export const registerUnflakable = async (
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions,
  options: PluginOptions = {}
): Promise<Cypress.PluginConfigOptions> => {
  debug(`Called registerUnflakable()`);

  if (
    (globalThis as { __unflakableIsRegistered?: true }).__unflakableIsRegistered
  ) {
    printWarning("Unflakable plugin is already registered");
    return config;
  }

  (globalThis as { __unflakableIsRegistered?: true }).__unflakableIsRegistered =
    true;

  if (ENV_VAR_UNFLAKABLE_RESOLVED_CONFIG_JSON.value === undefined) {
    throw new Error(
      `Environment variable ${ENV_VAR_UNFLAKABLE_RESOLVED_CONFIG_JSON.name} not found`
    );
  }
  const unflakableConfig = JSON.parse(
    ENV_VAR_UNFLAKABLE_RESOLVED_CONFIG_JSON.value
  ) as UnflakableConfig;

  if (!unflakableConfig.enabled) {
    debug("Unflakable plugin is disabled");
    // If the user has made any of their own config modifications in setupNodeEvents(), be sure to
    // preserve those.
    return config;
  }

  const apiKey = loadApiKey();

  const manifest = await getTestSuiteManifest({
    apiKey,
    baseUrl: unflakableConfig.apiBaseUrl,
    clientDescription: userAgent(config.version),
    log: console.error.bind(console),
    testSuiteId: unflakableConfig.testSuiteId,
  });

  const git = unflakableConfig.gitAutoDetect ? await loadGitRepo() : null;
  const repoRoot = git !== null ? await getRepoRoot(git) : config.projectRoot;

  const plugin = new UnflakableCypressPlugin({
    apiKey,
    manifest,
    repoRoot,
    unflakableConfig,
  });

  // NB: We mutate the `config` object instead of creating a new object because only changes to the
  // original config object Cypress passed to setupNodeEvents() will be seen by the
  // `dev-server:start` event handler, which captures the config from its caller before Cypress
  // invokes the user's setupNodeEvents() function. See:
  // https://github.com/cypress-io/cypress/blob/abd986aa411af3ec358056a8458b74cb52952b01/packages/server/lib/plugins/child/run_require_async_child.js#L162-L178
  // This is only an issue for component testing. For e2e testing, Cypress immediately calls the
  // user's setupNodeEvents().
  config.env[CYPRESS_ENV_VAR_CONFIG] = JSON.stringify(unflakableConfig);
  config.env[CYPRESS_ENV_VAR_MANIFEST] = JSON.stringify(manifest ?? null);
  config.env[CYPRESS_ENV_VAR_REPO_ROOT] = repoRoot;

  return plugin.register(on, config, options);
};

const wrapSetupNodeEvents =
  <ComponentDevServerOpts>(
    userSetupNodeEvents:
      | Cypress.ResolvedConfigOptions<ComponentDevServerOpts>["setupNodeEvents"]
      | undefined
  ) =>
  async (
    baseOn: Cypress.PluginEvents,
    config: Cypress.PluginConfigOptions
  ): Promise<Cypress.PluginConfigOptions> => {
    // Due to https://github.com/cypress-io/cypress/issues/22428, only the last event handler
    // registered for each event type will be called. This means we'll clobber any event handlers
    // the user registers. To avoid this, we use cypress-on-fix.
    const on = cypressOnFix(baseOn);

    const userModifiedConfig =
      userSetupNodeEvents !== undefined
        ? await userSetupNodeEvents(on, config)
        : undefined;

    return registerUnflakable(
      on,
      // If the user has made any of their own config modifications in setupNodeEvents(), be
      // sure to preserve those.
      userModifiedConfig ?? config,
      ENV_VAR_AUTO_SUPPORT.value === "false" ? { autoSupportFile: false } : {}
    );
  };

// Wraps the user's cypress.config.{js,ts,mjs,cjs} and automatically registers the Unflakable
// plugin.
export const wrapCypressConfig = <ComponentDevServerOpts = unknown>(
  userConfig: Cypress.ConfigOptions<ComponentDevServerOpts>
): Cypress.ConfigOptions<ComponentDevServerOpts> => {
  return {
    ...userConfig,
    component:
      userConfig.component !== undefined
        ? {
            ...userConfig.component,
            setupNodeEvents: wrapSetupNodeEvents<ComponentDevServerOpts>(
              userConfig.component?.setupNodeEvents
            ),
          }
        : undefined,
    e2e:
      userConfig.e2e !== undefined
        ? {
            ...userConfig.e2e,
            setupNodeEvents: wrapSetupNodeEvents<ComponentDevServerOpts>(
              userConfig.e2e?.setupNodeEvents
            ),
          }
        : undefined,
  };
};
