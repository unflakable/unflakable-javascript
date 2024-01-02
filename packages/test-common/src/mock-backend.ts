// Copyright (c) 2023-2024 Developer Innovations, LLC

import {
  CompletedRequest,
  getLocal as getLocalHttpServer,
  MockedEndpoint,
  Mockttp,
} from "mockttp";
import type {
  CallbackResponseMessageResult,
  CallbackResponseResult,
} from "mockttp/dist/rules/requests/request-handler-definitions";
import { gunzipSync } from "zlib";
import _debug from "debug";
import {
  CreateTestSuiteRunFromUploadRequest,
  CreateTestSuiteRunInlineRequest,
  TestSuiteManifest,
  TestSuiteRunPendingSummary,
} from "@unflakable/js-api";

const debug = _debug("unflakable:test-common:mock-backend");

export type UnmatchedEndpoints = {
  unmatchedApiRequestEndpoint: MockedEndpoint;
  unmatchedObjectStoreRequestEndpoint: MockedEndpoint;
};

export class MockBackend {
  private readonly apiServer: Mockttp;
  private readonly objectStoreServer: Mockttp;

  constructor() {
    this.apiServer = getLocalHttpServer({
      // debug: true,
      suggestChanges: false,
    });
    this.objectStoreServer = getLocalHttpServer({
      // debug: true,
      suggestChanges: false,
    });
  }

  public get apiServerPort(): number {
    return this.apiServer.port;
  }

  public addExpectations = async (
    onError: (e: unknown) => void,
    manifest: TestSuiteManifest | null,
    verifyUploadResults: (request: CompletedRequest) => void,
    runSummary: TestSuiteRunPendingSummary | null,
    userAgentRegex: RegExp,
    {
      expectPluginToBeEnabled,
      expectResultsToBeUploaded,
      expectedApiKey,
      expectedSuiteId,
    }: {
      expectPluginToBeEnabled: boolean;
      expectResultsToBeUploaded: boolean;
      expectedApiKey: string;
      expectedSuiteId: string;
    }
  ): Promise<UnmatchedEndpoints> => {
    const onUnmatchedRequest = (
      request: CompletedRequest
    ): CallbackResponseResult => {
      onError(
        new Error(`Unexpected request ${request.method} ${request.path}`)
      );
      return { statusCode: 500 };
    };

    const unmatchedApiRequestEndpoint = await this.apiServer
      .forUnmatchedRequest()
      .thenCallback(onUnmatchedRequest);
    const unmatchedObjectStoreRequestEndpoint = await this.objectStoreServer
      .forUnmatchedRequest()
      .thenCallback(onUnmatchedRequest);

    if (!expectPluginToBeEnabled) {
      return {
        unmatchedApiRequestEndpoint,
        unmatchedObjectStoreRequestEndpoint,
      };
    }

    await this.apiServer
      .forGet(`/api/v1/test-suites/${expectedSuiteId}/manifest`)
      .times(manifest === null ? 3 : 1)
      .withHeaders({
        Authorization: `Bearer ${expectedApiKey}`,
      })
      .thenCallback((request): CallbackResponseResult => {
        try {
          expect(request.headers["user-agent"]).toMatch(userAgentRegex);

          if (manifest === null) {
            return "reset";
          }

          return {
            statusCode: 200,
            json: manifest,
          };
        } catch (e: unknown) {
          onError(e);
          return { statusCode: 500 };
        }
      });

    if (expectResultsToBeUploaded) {
      const uploadPath =
        `/unflakable-backend-mock-test-uploads/teams/MOCK_TEAM_ID/suites/${expectedSuiteId}/runs/` +
        `upload/MOCK_UPLOAD_ID`;
      const uploadQuery = "?X-Amz-Signature=MOCK_SIGNATURE";

      await this.apiServer
        .forPost(`/api/v1/test-suites/${expectedSuiteId}/runs/upload`)
        .once()
        .withHeaders({
          Authorization: `Bearer ${expectedApiKey}`,
          "Content-Type": "application/json",
        })
        .thenCallback(async (request) => {
          try {
            expect(await request.body.getText()).toBe("");
            return {
              statusCode: 201,
              headers: {
                Location: `http://localhost:${this.objectStoreServer.port}${uploadPath}${uploadQuery}`,
              },
              json: {
                upload_id: "MOCK_UPLOAD_ID",
              },
            };
          } catch (e) {
            onError(e);
            return {
              statusCode: 500,
            };
          }
        });

      let runRequest: CreateTestSuiteRunInlineRequest | null = null;
      await this.objectStoreServer
        .forPut(uploadPath)
        .once()
        .withExactQuery(uploadQuery)
        .withHeaders({
          "Content-Encoding": "gzip",
          "Content-Type": "application/json",
        })
        .thenCallback((request): CallbackResponseMessageResult => {
          try {
            runRequest = JSON.parse(
              gunzipSync(request.body.buffer).toString()
            ) as CreateTestSuiteRunInlineRequest;

            verifyUploadResults(request);

            return {
              statusCode: 200,
            };
          } catch (e) {
            onError(e);
            return { statusCode: 500 };
          }
        });

      await this.apiServer
        .forPost(`/api/v1/test-suites/${expectedSuiteId}/runs`)
        .times(runSummary === null ? 3 : 1)
        .withHeaders({
          Authorization: `Bearer ${expectedApiKey}`,
          "Content-Type": "application/json",
        })
        .thenCallback(async (request): Promise<CallbackResponseResult> => {
          try {
            const body = await request.body.getText();
            expect(body).not.toBeNull();

            const parsedBody = ((): CreateTestSuiteRunFromUploadRequest => {
              try {
                return JSON.parse(
                  body as string
                ) as CreateTestSuiteRunFromUploadRequest;
              } catch (e) {
                throw new Error(
                  `Invalid request body: ${JSON.stringify(body)}`,
                  {
                    cause: e,
                  }
                );
              }
            })();

            expect(parsedBody.upload_id).toBe("MOCK_UPLOAD_ID");
            expect(runRequest).not.toBeNull();

            if (runSummary === null) {
              return "reset";
            }

            return {
              json: runSummary,
              statusCode: 201,
            };
          } catch (e) {
            onError(e);
            return {
              statusCode: 500,
            };
          }
        });
    }

    return {
      unmatchedApiRequestEndpoint,
      unmatchedObjectStoreRequestEndpoint,
    };
  };

  public checkExpectations = async ({
    unmatchedApiRequestEndpoint,
    unmatchedObjectStoreRequestEndpoint,
  }: UnmatchedEndpoints): Promise<void> => {
    expect(await this.apiServer.getPendingEndpoints()).toStrictEqual([
      unmatchedApiRequestEndpoint,
    ]);
    expect(await this.objectStoreServer.getPendingEndpoints()).toStrictEqual([
      unmatchedObjectStoreRequestEndpoint,
    ]);
  };

  public start = async (): Promise<void> => {
    await this.apiServer.start();
    debug(
      `Listening for mock API requests on http://localhost:${this.apiServer.port}`
    );

    await this.objectStoreServer.start();
    debug(
      `Listening for mock S3 requests on http://localhost:${this.objectStoreServer.port}`
    );
  };

  public stop = async (): Promise<void> => {
    debug(`Stopping mock API server`);
    await this.apiServer.stop();

    debug(`Stopping mock S3 server`);
    return this.objectStoreServer.stop();
  };
}
