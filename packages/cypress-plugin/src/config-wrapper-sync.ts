// Copyright (c) 2023 Developer Innovations, LLC

import { wrapCypressConfig } from "./index";
import _debug from "debug";
import { loadUserConfigSync } from "./load-user-config";

const debug = _debug("unflakable:config-wrapper-sync");

const userConfig = loadUserConfigSync();
debug("Loaded user config %o", userConfig);

export default wrapCypressConfig(userConfig);
