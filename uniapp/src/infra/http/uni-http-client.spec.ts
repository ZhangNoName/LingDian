import { describe, expect, it } from "vitest";
import type { HttpResponse, HttpTransport } from "./uni-http-client";
import { ApiError, requestApiEnvelope } from "./uni-http-client";

describe("API envelope protocol", () => {
  it("is independent from uni.request through a replaceable transport", async () => {
    const transport: HttpTransport = {
      async send<T>() {
        return { statusCode: 200, data: { code: 0, data: { id: "order-1" } }, header: {} } as HttpResponse<T>;
      },
    };

    await expect(requestApiEnvelope<{ id: string }>({ path: "/orders" }, transport))
      .resolves.toEqual({ id: "order-1" });
  });

  it("preserves stable HTTP and business error metadata", async () => {
    const transport: HttpTransport = {
      async send<T>() {
        return { statusCode: 409, data: { code: 2008, msg: "conflict", data: null }, header: {} } as HttpResponse<T>;
      },
    };

    const error = await requestApiEnvelope({ path: "/orders" }, transport).catch((value) => value);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ statusCode: 409, code: 2008, message: "conflict" });
  });
});
