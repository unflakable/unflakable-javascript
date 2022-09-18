// Copyright (c) 2022 Developer Innovations, LLC

import fetch, { Response } from "node-fetch";
import _debug = require("debug");
import { gzip } from "zlib";
import { promisify } from "util";

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
export type CreateTestSuiteRunInlineRequest = {
  branch?: string;
  commit?: string;
  start_time: string;
  end_time: string;
  test_runs: TestRunRecord[];
};
export declare type CreateTestSuiteRunFromUploadRequest = {
  upload_id: string;
};
export type TestSuiteRunPendingSummary = {
  run_id: string;
  suite_id: string;
  branch?: string;
  commit?: string;
};
export type CreateTestSuiteRunUploadUrlResponse = {
  upload_id: string;
};

const userAgent = (clientDescription?: string) =>
  `unflakable-js-api/${JS_API_VERSION}${
    clientDescription !== undefined ? ` ${clientDescription}` : ""
  }`;

const requestHeaders = ({
  apiKey,
  clientDescription,
}: {
  apiKey: string;
  clientDescription?: string;
}) => ({
  Authorization: "Bearer " + apiKey,
  "User-Agent": userAgent(clientDescription),
});

const expectResponse =
  (expectedStatus: number, expectedStatusText: string) =>
  async (res: Response): Promise<Response> => {
    if (res.status !== expectedStatus) {
      const body = await res.text();
      throw new Error(
        `received HTTP response \`${res.status} ${
          res.statusText
        }\` (expected \`${expectedStatusText}\`)${
          body.length > 0 ? `: ${body}` : ""
        }`
      );
    }
    return res;
  };

export const createTestSuiteRun = async ({
  request,
  testSuiteId,
  apiKey,
  clientDescription,
  baseUrl,
}: {
  request: CreateTestSuiteRunInlineRequest;
  testSuiteId: string;
  apiKey: string;
  clientDescription?: string;
  baseUrl?: string;
}): Promise<TestSuiteRunPendingSummary> => {
  const requestJson = JSON.stringify(request);
  debug(`Creating test suite run: ${requestJson}`);
  const gzippedRequest = await promisify(gzip)(requestJson);

  const { uploadId, uploadUrl } = await fetch(
    `${
      baseUrl !== undefined ? baseUrl : BASE_URL
    }/api/v1/test-suites/${testSuiteId}/runs/upload`,
    {
      method: "post",
      headers: {
        "Content-Type": "application/json",
        ...requestHeaders({ apiKey, clientDescription }),
      },
    }
  )
    .then(expectResponse(201, "201 Created"))
    .then(async (res) => {
      const location = res.headers.get("Location");
      if (location === null) {
        throw new Error("no Location response header found");
      }
      const body = (await res.json()) as CreateTestSuiteRunUploadUrlResponse;
      return {
        uploadId: body.upload_id,
        uploadUrl: location,
      };
    });

  await fetch(uploadUrl, {
    method: "put",
    body: gzippedRequest,
    headers: {
      "Content-Encoding": "gzip",
      "Content-Type": "application/json",
      "User-Agent": userAgent(clientDescription),
    },
  }).then(expectResponse(200, "200 OK"));

  const requestBody: CreateTestSuiteRunFromUploadRequest = {
    upload_id: uploadId,
  };

  return await fetch(
    `${
      baseUrl !== undefined ? baseUrl : BASE_URL
    }/api/v1/test-suites/${testSuiteId}/runs`,
    {
      method: "post",
      body: JSON.stringify(requestBody),
      headers: {
        "Content-Type": "application/json",
        ...requestHeaders({ apiKey, clientDescription }),
      },
    }
  )
    .then(expectResponse(201, "201 Created"))
    .then((res) => res.json() as Promise<TestSuiteRunPendingSummary>)
    .then((parsedResponse: TestSuiteRunPendingSummary) => {
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
      headers: requestHeaders({ apiKey, clientDescription }),
    }
  )
    .then(expectResponse(200, "200 OK"))
    .then((res) => res.json() as Promise<TestSuiteManifest>)
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
