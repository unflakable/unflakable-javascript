// Copyright (c) 2022-2023 Developer Innovations, LLC

import { spawnSync } from "child_process";
import * as fs from "fs";
import * as yaml from "js-yaml";

const targetVersion = process.argv[2];
if (targetVersion === undefined) {
  console.log(
    `Usage: ${process.argv[1]} <target-major-minor-version (e.g., 27.5)>`
  );
  process.exit(1);
}

const maxIterations = 10;

type PackageSpec = {
  version: string;
};
type Lockfile = { [key in string]: PackageSpec };

const setYarnResolution = (descriptor: string, resolution: string) => {
  console.log(`Setting yarn resolution \`${descriptor}\` to ${resolution}`);

  const outcome = spawnSync(
    "yarn",
    ["set", "resolution", descriptor, resolution],
    { stdio: "inherit" }
  );

  if (outcome.status !== 0) {
    console.log("Exiting due to yarn error");
    process.exit(1);
  }
};

// The jest TS types aren't released very frequently and mostly correspond to major versions, so we
// just install the latest available
if (targetVersion.startsWith("29.")) {
  setYarnResolution("@types/jest@npm:25.1.0 - 29", "29");
} else if (targetVersion.startsWith("28.")) {
  setYarnResolution("@types/jest@npm:25.1.0 - 29", "28");
} else if (targetVersion.startsWith("27.")) {
  setYarnResolution("@types/jest@npm:25.1.0 - 29", "27");
} else if (targetVersion.startsWith("26.")) {
  setYarnResolution("@types/jest@npm:25.1.0 - 29", "26");
} else if (targetVersion.startsWith("25.")) {
  setYarnResolution("@types/jest@npm:25.1.0 - 29", "25");
} else {
  console.log(`ERROR: Unsupported jest version ${targetVersion}`);
  process.exit(1);
}

for (let i = 0; i < maxIterations; i++) {
  const lockfile = yaml.load(fs.readFileSync("yarn.lock", "utf8")) as Lockfile;

  let done = true;
  Object.entries(lockfile).forEach(([pkg, spec]) => {
    if (
      pkg.startsWith("babel-jest") ||
      pkg.startsWith("babel-plugin-jest-hoist") ||
      pkg.startsWith("babel-preset-jest") ||
      pkg.startsWith("expect@") ||
      pkg.startsWith("@jest/") ||
      pkg.startsWith("jest@") ||
      (pkg.startsWith("jest-") &&
        !pkg.startsWith("jest-integration") &&
        !pkg.startsWith("jest-pnp-resolver@")) ||
      pkg.startsWith("pretty-format")
    ) {
      const descriptors = pkg.split(", ");
      descriptors.forEach((descriptor) => {
        const [packageName, descriptorVersion] = descriptor.split("@npm:");
        const match = descriptorVersion.match(
          /^\^?([0-9]+\.[0-9]+\.[0-9]+(?:-[-a-zA-Z0-9.]+)?)$/
        );
        let resolution = match !== null ? match[1] : targetVersion;

        // Some packages were never released with matching major/minor version numbers matching the
        // desired Jest version. There are a small number of these, so we just hardcode them.
        if (match === null) {
          if (packageName === "@jest/types" && targetVersion === "27.3") {
            resolution = "27.2";
          } else if (
            [
              "@jest/console",
              "@jest/test-result",
              "@jest/types",
              "jest-util",
            ].includes(packageName) &&
            targetVersion === "26.4"
          ) {
            resolution = "26.3";
          }
        }

        if (
          spec.version === resolution ||
          spec.version.startsWith(`${resolution}.`)
        ) {
          return;
        }
        done = false;

        setYarnResolution(descriptor, resolution);
      });
    }
  });

  if (done) {
    console.log(
      `Done installing Jest ${targetVersion} after ${i + 1} iteration(s).`
    );
    process.exit(0);
  }
}

console.log(
  `ERROR: Yarn lockfile did not converge after ${maxIterations} iterations`
);
process.exit(1);
