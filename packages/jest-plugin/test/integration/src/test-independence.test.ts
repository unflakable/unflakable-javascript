// Copyright (c) 2023-2024 Developer Innovations, LLC

import jestPackage from "jest/package.json";
import {
  defaultExpectedResults,
  integrationTest,
  integrationTestSuite,
} from "./test-wrappers";
import semverLt from "semver/functions/lt";

integrationTestSuite((mockBackend) => {
  // Test independence requires Jest 28+, so we skip these tests for earlier versions.
  const itOrSkip = semverLt(jestPackage.version, "28.0.0") ? it.skip : it;

  itOrSkip("test-independent flake should pass", (done) => {
    integrationTest(
      {
        params: {
          configJs: `
module.exports = {
  __unstableIsFailureTestIndependent: ({ failure }) =>
    failure.includes("Error: first try should fail"),
};
`,
          expectFlakeToBeTestIndependent: true,
        },
        expectedExitCode: 1,
        expectedResults: {
          failedSuites: 3,
          failedTests: 2,
          flakyTests: 0,
          passedSuites: 2,
          passedSuitesWithIndependentFailures: 1,
          passedTests: 4,
          passedTestsWithIndependentFailures: 2,
          quarantinedSuites: 1,
          quarantinedTests: 2,
          skippedSuites: 0,
          skippedTests: 0,
          passedSnapshots: 1,
          failedSnapshots: 0,
          totalSnapshots: 1,
        },
      },
      mockBackend,
      done
    );
  });

  itOrSkip(
    "test-independent flake without failures should exit successfully",
    (done) => {
      integrationTest(
        {
          params: {
            configJs: `
module.exports = {
  __unstableIsFailureTestIndependent: /Error: first try should fail/,
};
`,
            expectFlakeToBeTestIndependent: true,
            expectQuarantinedTestsToBeSkipped: true,
            skipFailures: true,
            skipQuarantined: true,
          },
          expectedExitCode: 0,
          expectedResults: {
            failedSuites: 0,
            failedTests: 0,
            flakyTests: 0,
            passedSuites: 3,
            passedSuitesWithIndependentFailures: 1,
            passedTests: 4,
            passedTestsWithIndependentFailures: 2,
            quarantinedSuites: 0,
            quarantinedTests: 0,
            skippedSuites: 2,
            skippedTests: 4,
            passedSnapshots: 0,
            failedSnapshots: 0,
            totalSnapshots: 0,
          },
        },
        mockBackend,
        done
      );
    }
  );

  itOrSkip(
    "test-independent fail followed by regular fail should fail",
    (done) => {
      integrationTest(
        {
          params: {
            configJs: `
const fs = require("fs/promises");
const path = require("path");
module.exports = {
  __unstableIsFailureTestIndependent: async ({ testFilePath, failure }) => {
    if (failure.includes("Error: test failed")
      || failure.includes("Error: mixed test failed")
    ) {
      const tempFilePath =
        \`\${process.env.FLAKY_TEST_TEMP}-test-independent-\${path.basename(testFilePath)}\`;

      const attempt = await fs
        .readFile(tempFilePath, { encoding: "utf8" })
        .then(Number.parseInt)
        .catch(() => 0);
      await fs.writeFile(tempFilePath, (attempt + 1).toString());

      return attempt === 0;
    } else {
      return false;
    }
  }
};
`,
            expectFailuresFirstAttemptToBeTestIndependent: true,
          },
          expectedExitCode: 1,
          expectedResults: defaultExpectedResults,
        },
        mockBackend,
        done
      );
    }
  );

  itOrSkip(
    "quarantined test-independent fail followed by regular fail should be quarantined",
    (done) => {
      integrationTest(
        {
          params: {
            configJs: `
const fs = require("fs/promises");
const path = require("path");
module.exports = {
  __unstableIsFailureTestIndependent: async ({ testFilePath, failure }) => {
    if (failure.includes("Error: quarantined test failed")
      || failure.includes("Error: mixed quarantined test failed")
    ) {
      const tempFilePath =
        \`\${process.env.FLAKY_TEST_TEMP}-test-independent-\${path.basename(testFilePath)}\`;

      const attempt = await fs
        .readFile(tempFilePath, { encoding: "utf8" })
        .then(Number.parseInt)
        .catch(() => 0);
      await fs.writeFile(tempFilePath, (attempt + 1).toString());

      return attempt === 0;
    } else {
      return false;
    }
  }
};
`,
            expectQuarantinedTestsFirstAttemptToBeTestIndependent: true,
          },
          expectedExitCode: 1,
          expectedResults: defaultExpectedResults,
        },
        mockBackend,
        done
      );
    }
  );

  itOrSkip(
    "test-independent fail then fail then pass should be flaky",
    (done) => {
      integrationTest(
        {
          params: {
            configJs: `
const fs = require("fs/promises");
const path = require("path");
module.exports = {
  __unstableIsFailureTestIndependent: async ({ testFilePath, testName, failure }) => {
    if (failure.includes("Error: first try should fail")) {
      const tempFilePath =
        \`\${process.env.FLAKY_TEST_TEMP}-test-independent-\${testName[0][testName[0].length - 1]}\`;

      const attempt = await fs
        .readFile(tempFilePath, { encoding: "utf8" })
        .then(Number.parseInt)
        .catch(() => 0);
      await fs.writeFile(tempFilePath, (attempt + 1).toString());

      return attempt === 0;
    } else {
      return false;
    }
  }
};
`,
            expectFlakeFirstAttemptToBeTestIndependent: true,
            flakeFailCount: 2,
          },
          expectedExitCode: 1,
          expectedResults: defaultExpectedResults,
        },
        mockBackend,
        done
      );
    }
  );

  itOrSkip(
    "test-independent quarantined fail then fail then pass should be quarantined",
    (done) => {
      integrationTest(
        {
          params: {
            configJs: `
const fs = require("fs/promises");
const path = require("path");
module.exports = {
  __unstableIsFailureTestIndependent: async ({ testFilePath, testName, failure }) => {
    if (failure.includes("Error: first try should fail")) {
      const tempFilePath =
        \`\${process.env.FLAKY_TEST_TEMP}-test-independent-\${testName[0][testName[0].length - 1]}\`;

      const attempt = await fs
        .readFile(tempFilePath, { encoding: "utf8" })
        .then(Number.parseInt)
        .catch(() => 0);
      await fs.writeFile(tempFilePath, (attempt + 1).toString());

      return attempt === 0;
    } else {
      return false;
    }
  }
};
`,
            expectFlakeFirstAttemptToBeTestIndependent: true,
            flakeFailCount: 2,
            quarantineFlake: true,
          },
          expectedExitCode: 1,
          expectedResults: {
            failedSuites: 3,
            failedTests: 2,
            flakyTests: 0,
            passedSuites: 1,
            passedSuitesWithIndependentFailures: 0,
            passedTests: 2,
            passedTestsWithIndependentFailures: 0,
            quarantinedSuites: 2,
            quarantinedTests: 4,
            skippedSuites: 0,
            skippedTests: 0,
            passedSnapshots: 1,
            failedSnapshots: 0,
            totalSnapshots: 1,
          },
        },
        mockBackend,
        done
      );
    }
  );

  itOrSkip("test-independent quarantined flake should pass", (done) => {
    integrationTest(
      {
        params: {
          configJs: `
module.exports = {
  __unstableIsFailureTestIndependent: ({ failure }) =>
    failure.includes("Error: first try should fail"),
};
`,
          expectFlakeToBeTestIndependent: true,
          quarantineFlake: true,
        },
        expectedExitCode: 1,
        expectedResults: {
          failedSuites: 3,
          failedTests: 2,
          flakyTests: 0,
          passedSuites: 2,
          passedSuitesWithIndependentFailures: 1,
          passedTests: 4,
          passedTestsWithIndependentFailures: 2,
          quarantinedSuites: 1,
          quarantinedTests: 2,
          skippedSuites: 0,
          skippedTests: 0,
          passedSnapshots: 1,
          failedSnapshots: 0,
          totalSnapshots: 1,
        },
      },
      mockBackend,
      done
    );
  });

  itOrSkip(
    "repeated test-independent failures without pass should fail",
    (done) => {
      integrationTest(
        {
          params: {
            configJs: `
module.exports = {
  __unstableIsFailureTestIndependent: "Error: (?:mixed )?test failed",
};
`,
            expectFailuresToBeTestIndependent: true,
          },
          expectedExitCode: 1,
          expectedResults: defaultExpectedResults,
        },
        mockBackend,
        done
      );
    }
  );

  itOrSkip(
    "repeated quarantined test-independent failures without pass should be quarantined",
    (done) => {
      integrationTest(
        {
          params: {
            configJs: `
module.exports = {
  __unstableIsFailureTestIndependent: /Error: (?:mixed )?quarantined test failed/,
};
`,
            expectQuarantinedTestsToBeTestIndependent: true,
          },
          expectedExitCode: 1,
          expectedResults: defaultExpectedResults,
        },
        mockBackend,
        done
      );
    }
  );

  itOrSkip("multi-line regex should match", (done) => {
    integrationTest(
      {
        params: {
          configJs: `
module.exports = {
  __unstableIsFailureTestIndependent: "Error: (?:mixed )?test failed\\nnew line",
};
`,
          expectFailuresToBeTestIndependent: true,
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    );
  });

  itOrSkip("regex should match stderr", (done) => {
    integrationTest(
      {
        params: {
          configJs: `
module.exports = {
  __unstableIsFailureTestIndependent: "(?:^|\\n)(?:mixed )?fail stderr\\n",
};
`,
          expectFailuresToBeTestIndependent: true,
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    );
  });

  itOrSkip("regex should match stdout", (done) => {
    integrationTest(
      {
        params: {
          configJs: `
module.exports = {
  __unstableIsFailureTestIndependent: "(?:^|\\n)(?:mixed )?fail stdout\\n",
};
`,
          expectFailuresToBeTestIndependent: true,
        },
        expectedExitCode: 1,
        expectedResults: defaultExpectedResults,
      },
      mockBackend,
      done
    );
  });
});
