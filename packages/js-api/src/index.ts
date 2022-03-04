// Copyright (c) 2022 Developer Innovations, LLC

import fetch from "node-fetch";
import _debug = require("debug");

const debug = _debug("unflakable:api");

const BASE_URL = "https://app.unflakable.com";

export const TEST_NAME_ENTRY_MAX_LENGTH = 4096;

export const JS_API_VERSION: string =
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  (require("../package.json") as { version: string }).version;

export type TestRef = {
  test_id: string;
  filename: string;
  name: string[];
};
export type TestSuiteManifest = {
  quarantined_tests: TestRef[];
};

export type TestAttemptResult = "pass" | "fail" | "quarantined";
export type TestRunAttemptRecord = {
  start_time?: string;
  end_time?: string;
  duration_ms?: number;
  result: TestAttemptResult;
};
export type TestRunRecord = {
  filename: string;
  name: string[];
  attempts: TestRunAttemptRecord[];
};
export type CreateTestSuiteRunRequest = {
  branch?: string;
  commit?: string;
  start_time: string;
  end_time: string;
  test_runs: TestRunRecord[];
};
export type TestSuiteRunSummary = {
  run_id: string;
  suite_id: string;
  branch?: string;
  commit?: string;
  start_time: string;
  end_time: string;
  num_tests: number;
  num_pass: number;
  num_fail: number;
  num_flake: number;
  num_quarantined: number;
};

const userAgent = (clientDescription?: string) =>
  `unflakable-js-api/${JS_API_VERSION}${
    clientDescription !== undefined ? ` ${clientDescription}` : ""
  }`;

export const createTestSuiteRun = async ({
  request,
  testSuiteId,
  apiKey,
  clientDescription,
  baseUrl,
}: {
  request: CreateTestSuiteRunRequest;
  testSuiteId: string;
  apiKey: string;
  clientDescription?: string;
  baseUrl?: string;
}): Promise<TestSuiteRunSummary> => {
  const requestJson = JSON.stringify(request);
  debug(`Creating test suite run: ${requestJson}`);
  return await fetch(
    `${
      baseUrl !== undefined ? baseUrl : BASE_URL
    }/api/v1/test-suites/${testSuiteId}/runs`,
    {
      method: "post",
      body: requestJson,
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "User-Agent": userAgent(clientDescription),
      },
    }
  )
    .then(async (res) => {
      if (res.status !== 201) {
        const body = await res.text();
        throw new Error(
          `received HTTP response \`${res.status} ${
            res.statusText
          }\` (expected \`201 Created\`)${body.length > 0 ? `: ${body}` : ""}`
        );
      }
      return res.json() as Promise<TestSuiteRunSummary>;
    })
    .then((parsedResponse: TestSuiteRunSummary) => {
      debug(`Received response: ${JSON.stringify(parsedResponse)}`);
      return parsedResponse;
    });
};

export const getTestSuiteManifest = async ({
  testSuiteId,
  apiKey,
  clientDescription,
  baseUrl,
}: {
  testSuiteId: string;
  apiKey: string;
  clientDescription?: string;
  baseUrl?: string;
}): Promise<TestSuiteManifest> => {
  debug(`Fetching manifest for test suite ${testSuiteId}`);
  return await fetch(
    `${
      baseUrl !== undefined ? baseUrl : BASE_URL
    }/api/v1/test-suites/${testSuiteId}/manifest`,
    {
      method: "get",
      headers: {
        Authorization: "Bearer " + apiKey,
        "User-Agent": userAgent(clientDescription),
      },
    }
  )
    .then(async (res) => {
      if (res.status !== 200) {
        const body = await res.text();
        throw new Error(
          `received HTTP response \`${res.status} ${
            res.statusText
          }\` (expected \`200 OK\`)${body.length > 0 ? `: ${body}` : ""}`
        );
      }
      return res.json() as Promise<TestSuiteManifest>;
    })
    .then((parsedResponse: TestSuiteManifest) => {
      debug(`Received response: ${JSON.stringify(parsedResponse)}`);
      return parsedResponse;
    });
};

export const testSuiteRunUrl = (
  testSuiteId: string,
  runId: string,
  baseUrl?: string
): string =>
  `${
    baseUrl !== undefined ? baseUrl : BASE_URL
  }/test-suites/${testSuiteId}/runs/${runId}`;
