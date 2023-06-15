// Copyright (c) 2022-2023 Developer Innovations, LLC

import { spawnSync } from "child_process";
import * as fs from "fs";
import * as yaml from "js-yaml";
import * as semver from "semver";
import _debug from "debug";

const debug = _debug("set-jest-version");

const printUsageAndExit = (): never => {
  console.error(
    `Usage: ${process.argv[1]} <target-major-minor-version (e.g., 27.5)>`
  );
  process.exit(1);
};

type PackageSpec = {
  version: string;
};
type Lockfile = { [key in string]: PackageSpec };

const setYarnResolution = (descriptor: string, resolution: string): void => {
  debug(`Setting yarn resolution \`${descriptor}\` to ${resolution}`);

  const outcome = spawnSync(
    "yarn",
    ["set", "resolution", descriptor, resolution],
    { stdio: "inherit" }
  );

  if (outcome.status !== 0) {
    console.error("ERROR: Exiting due to yarn error");
    process.exit(1);
  }
};

// Some packages were never released with matching major/minor version numbers matching the
// desired Jest version. We map missing minor versions to earlier releases below, or null if there
// were no earlier releases.
const PACKAGE_VERSION_MAP = {
  "@jest/console": {
    "26.3 - 26.4": "~26.3",
    "27.0 - 27.1": "~27.0",
    "27.2 - 27.3": "~27.2",
    "29.0 - 29.1": "~29.0",
    "29.2 - 29.3": "~29.2",
  },
  "@jest/environment": {
    "26.3 - 26.4": "~26.3",
  },
  "@jest/expect": {
    "<28": null,
  },
  "@jest/expect-utils": {
    "<28": null,
  },
  "@jest/fake-timers": {
    "26.3 - 26.4": "~26.3",
  },
  "@jest/globals": {
    "<25.5": null,
  },
  "@jest/schemas": {
    "25 - 27": null,
    "29.0 - 29.3": "~29.0",
    "29.4 - 29.5": "~29.4",
  },
  "@jest/source-map": {
    "25.2 - 25.4": "~25.2",
    "26.1 - 26.2": "~26.1",
    "26.3 - 26.4": "~26.3",
    "27.0 - 27.3": "~27.0",
    "29.0 - 29.1": "~29.0",
    "29.2 - 29.3": "~29.2",
    "29.4 - 29.5": "~29.4",
  },
  "@jest/test-result": {
    "26.3 - 26.4": "~26.3",
  },
  "@jest/transform": {
    "26.3 - 26.4": "~26.3",
  },
  "@jest/types": {
    "26.3 - 26.4": "~26.3",
    "27.2 - 27.3": "~27.2",
  },
  "babel-jest": {
    "26.3 - 26.4": "~26.3",
  },
  "babel-plugin-jest-hoist": {
    "25.2 - 25.3": "~25.2",
    "26.2 - 26.4": "~26.2",
    "27.0 - 27.1": "~27.0",
    "27.2 - 27.3": "~27.2",
    "29.0 - 29.1": "~29.0",
    "29.2 - 29.3": "~29.2",
  },
  "babel-preset-jest": {
    "26.3 - 26.4": "~26.3",
    "27.0 - 27.1": "~27.0",
    "27.2 - 27.3": "~27.2",
    "29.0 - 29.1": "~29.0",
    "29.2 - 29.3": "~29.2",
  },
  "jest-changed-files": {
    "26.3 - 26.4": "~26.3",
    "29.0 - 29.1": "~29.0",
    "29.2 - 29.3": "~29.2",
  },
  "jest-docblock": {
    "^25.3": "~25.3",
    "^26": "~26.0",
    "27.0 - 27.3": "~27.0",
    "29.0 - 29.1": "~29.0",
    "29.2 - 29.3": "~29.2",
    "29.4 - 29.5": "~29.4",
  },
  "jest-environment-jsdom": {
    "26.3 - 26.4": "~26.3",
  },
  "jest-environment-node": {
    "26.3 - 26.4": "~26.3",
  },
  "jest-get-type": {
    "^25.2.0": "~25.2",
    "26.0 - 26.2": "~26.0",
    "^26.3": "~26.3",
    "27.0 - 27.2": "~27.0",
    "^28": "~28.0",
    "29.0 - 29.1": "~29.0",
    "29.2 - 29.3": "~29.2",
    "29.4 - 29.5": "~29.4",
  },
  "jest-haste-map": {
    "26.3 - 26.4": "~26.3",
  },
  "jest-message-util": {
    "26.3 - 26.4": "~26.3",
  },
  "jest-mock": {
    "26.3 - 26.4": "~26.3",
  },
  "jest-regex-util": {
    "^25.2": "~25.2",
    "^26": "~26.0",
    "27.0 - 27.3": "~27.0",
    "^28": "~28.0",
    "29.0 - 29.1": "~29.0",
    "29.2 - 29.3": "~29.2",
    "29.4 - 29.5": "~29.4",
  },
  "jest-serializer": {
    "25.2 - 25.4": "~25.2",
    "26.3 - 26.4": "~26.3",
    "27.0 - 27.3": "~27.0",
    ">=28": null,
  },
  "jest-util": {
    "26.3 - 26.4": "~26.3",
  },
  "jest-watcher": {
    "26.3 - 26.4": "~26.3",
  },
  "jest-worker": {
    "25.2 - 25.3": "~25.2",
    "26.3 - 26.4": "~26.3",
  },
};
const packageTargetSemVerMap: {
  [p: string]: {
    targetRange: semver.Range;
    // null means no compatible version exists and that we shouldn't set a resolution. The
    // unsupported entry should hopefully disappear from yarn.lock once we've set the resolutions
    // higher up in the dependency chain.
    resolution: semver.Range | null;
  }[];
} = Object.fromEntries(
  Object.entries(PACKAGE_VERSION_MAP).map(
    ([packageName, packageVersionMap]) => [
      packageName,
      Object.entries(packageVersionMap).map(([targetRange, resolution]) => ({
        targetRange: new semver.Range(targetRange),
        resolution: resolution !== null ? new semver.Range(resolution) : null,
      })),
    ]
  )
);

const getPackageTargetSemVerRange = (
  packageName: string,
  targetSemVerRange: semver.Range
): semver.Range | null => {
  const resolution = (packageTargetSemVerMap[packageName] ?? []).find(
    ({ targetRange }) => semver.intersects(targetSemVerRange, targetRange)
  )?.resolution;
  return resolution !== undefined ? resolution : targetSemVerRange;
};

const main = (): never => {
  const targetVersion = process.argv[2];
  if (targetVersion === undefined) {
    printUsageAndExit();
  }

  const targetSemVerRange = ((): semver.Range => {
    try {
      return new semver.Range(`~${targetVersion}`);
    } catch (e) {
      console.error(`ERROR: Invalid SemVer range: %o`, e);
      return printUsageAndExit();
    }
  })();

  const targetSemVerMinVersion = semver.minVersion(targetSemVerRange);
  if (targetSemVerMinVersion === null) {
    throw new Error(
      `Failed to get SemVer min version from range ${targetSemVerRange.raw}`
    );
  }

  const maxIterations = 10;

  // The jest TS types aren't released very frequently and mostly correspond to major versions, so
  // we just install the latest available with the corresponding major version.
  if (
    targetSemVerMinVersion.major >= 25 &&
    targetSemVerMinVersion.major <= 29
  ) {
    setYarnResolution(
      "@types/jest@npm:25.1.0 - 29",
      targetSemVerMinVersion.major.toString()
    );
  } else {
    console.error(`ERROR: Unsupported jest version ${targetVersion}`);
    process.exit(1);
  }

  for (let i = 0; i < maxIterations; i++) {
    const lockfile = yaml.load(
      fs.readFileSync("yarn.lock", "utf8")
    ) as Lockfile;

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
          const descriptorSemVerRange = new semver.Range(descriptorVersion);

          // If the package descriptor version range doesn't include the target version range, we
          // can't set the resolution to the target range. This arises for transitive dependencies
          // for which we haven't yet updated the resolution higher up in the tree, and for package
          // requirements unrelated to the Jest plugin integration tests.
          if (!semver.intersects(descriptorSemVerRange, targetSemVerRange)) {
            debug(
              `Range \`${descriptorSemVerRange.raw}\` does not intersect with range \`${targetSemVerRange.raw}\` for package ${packageName}`
            );
            return;
          }

          const packageTargetSemVerRange = getPackageTargetSemVerRange(
            packageName,
            targetSemVerRange
          );
          if (packageTargetSemVerRange === null) {
            debug(
              `Package ${packageName} has no versions satisfying ${targetSemVerRange.raw}`
            );
            return;
          }
          if (semver.satisfies(spec.version, packageTargetSemVerRange)) {
            debug(
              `Version ${spec.version} of package ${packageName} matches expected range ${packageTargetSemVerRange.raw}`
            );
            return;
          }

          debug(
            `Version ${spec.version} of package ${packageName} does NOT match expected range ${packageTargetSemVerRange.raw}`
          );

          done = false;

          setYarnResolution(descriptor, packageTargetSemVerRange.raw);
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

  console.error(
    `ERROR: Yarn lockfile did not converge after ${maxIterations} iterations`
  );
  process.exit(1);
};

main();
