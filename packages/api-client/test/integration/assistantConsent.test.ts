import { ASSISTANT_CONSENT_VERSION } from "@keylow/core";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { anonClient } from "./support/stack";
import { createTestUser, deleteCreatedTestUsers } from "./support/users";
import { getAssistantConsent, setAssistantConsent } from "../../src/repos/assistant";

import type { TestUser } from "./support/users";

describe("the assistant consent against the local stack with real user JWTs", () => {
  let userA: TestUser;
  let userB: TestUser;

  beforeAll(async () => {
    [userA, userB] = await Promise.all([createTestUser("key684"), createTestUser("key684")]);
  });

  afterAll(async () => {
    await deleteCreatedTestUsers();
  });

  it("should read the assistant as off for a user who never turned it on", async () => {
    expect(await getAssistantConsent(userA.client)).toEqual({
      isOn: false,
      consentedAt: null,
      version: null,
    });
  });

  it("should write the time now and the current assistant consent version when the user turns it on", async () => {
    const before = Date.now();

    await setAssistantConsent(userA.client, userA.id, true);

    const consent = await getAssistantConsent(userA.client);
    expect(consent.isOn).toBe(true);
    expect(consent.version).toBe(ASSISTANT_CONSENT_VERSION);
    expect(Date.parse(consent.consentedAt ?? "")).toBeGreaterThanOrEqual(before - 5_000);
  });

  it("should leave another user's consent off", async () => {
    expect(await getAssistantConsent(userB.client)).toEqual({
      isOn: false,
      consentedAt: null,
      version: null,
    });
  });

  it("should refuse to set another user's consent, and leave it as it was", async () => {
    await expect(setAssistantConsent(userB.client, userA.id, false)).rejects.toThrow(
      /no profile was changed/,
    );
    await expect(setAssistantConsent(userB.client, userA.id, true)).rejects.toThrow(
      /no profile was changed/,
    );

    expect((await getAssistantConsent(userA.client)).isOn).toBe(true);
    expect((await getAssistantConsent(userB.client)).isOn).toBe(false);
  });

  it("should clear both columns when the user turns it off", async () => {
    await setAssistantConsent(userA.client, userA.id, false);

    expect(await getAssistantConsent(userA.client)).toEqual({
      isOn: false,
      consentedAt: null,
      version: null,
    });
  });

  it("should read a version older than the current one as off, and keep the version it read", async () => {
    const { error } = await userA.client
      .from("profiles")
      .update({
        assistant_consent_at: "2026-11-03T09:00:00+00:00",
        assistant_consent_version: "2026-10-26",
      })
      .eq("id", userA.id);
    expect(error).toBeNull();

    const consent = await getAssistantConsent(userA.client);

    expect(consent.isOn).toBe(false);
    expect(consent.version).toBe("2026-10-26");
    expect(Date.parse(consent.consentedAt ?? "")).toBe(Date.parse("2026-11-03T09:00:00+00:00"));
  });

  it("should write the current version over an older one when the user turns it on again", async () => {
    await setAssistantConsent(userA.client, userA.id, true);

    const consent = await getAssistantConsent(userA.client);
    expect(consent.isOn).toBe(true);
    expect(consent.version).toBe(ASSISTANT_CONSENT_VERSION);
  });

  it("should refuse a caller with no session", async () => {
    await expect(setAssistantConsent(anonClient(), userA.id, true)).rejects.toThrow();
  });
});
