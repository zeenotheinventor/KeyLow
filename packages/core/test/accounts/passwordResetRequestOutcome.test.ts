import { describe, expect, it } from "vitest";

import { passwordResetRequestOutcome } from "../../src/accounts";
import { AUTH_FIELD_PROBLEMS, describeAuthError } from "../../src/copy";

describe("passwordResetRequestOutcome", () => {
  it.each([undefined, "user_not_found", "over_email_send_rate_limit"])(
    "should say sent for %s",
    (code) => {
      expect(passwordResetRequestOutcome(code)).toEqual({ kind: "sent" });
    },
  );

  it.each(["email_address_invalid", "validation_failed"])(
    "should say the address is invalid for %s",
    (code) => {
      expect(passwordResetRequestOutcome(code)).toEqual({
        kind: "invalidEmail",
        message: AUTH_FIELD_PROBLEMS.emailInvalid,
      });
    },
  );

  it.each(["network", "over_request_rate_limit"])(
    "should fail with the auth sentence for %s",
    (code) => {
      expect(passwordResetRequestOutcome(code)).toEqual({
        kind: "failed",
        message: describeAuthError(code),
      });
    },
  );

  it("should not depend on the over_email_send_rate_limit sentence", () => {
    expect(passwordResetRequestOutcome("over_email_send_rate_limit")).not.toHaveProperty("message");
  });

  describe("no account enumeration", () => {
    // Each of these only happens when mail is actually sent, so only for a known address.
    const codesOnlyAKnownAddressCanProduce = [
      "over_email_send_rate_limit",
      "email_address_not_authorized",
      "unexpected_failure",
      "some_new_code",
    ];

    it.each(codesOnlyAKnownAddressCanProduce)(
      "should give the same kind as a success and as user_not_found for %s, with no message",
      (code) => {
        const outcome = passwordResetRequestOutcome(code);

        expect(outcome.kind).toBe("sent");
        expect(outcome.kind).toBe(passwordResetRequestOutcome(undefined).kind);
        expect(outcome.kind).toBe(passwordResetRequestOutcome("user_not_found").kind);
        expect(outcome).not.toHaveProperty("message");
      },
    );

    it("should carry the code of an unexpected failure and nothing else", () => {
      expect(passwordResetRequestOutcome("some_new_code")).toEqual({
        kind: "sent",
        unexpectedCode: "some_new_code",
      });
      expect(passwordResetRequestOutcome("email_address_not_authorized")).toEqual({
        kind: "sent",
        unexpectedCode: "email_address_not_authorized",
      });
    });

    it("should carry no unexpected code for the codes it expects", () => {
      for (const code of [undefined, "user_not_found", "over_email_send_rate_limit"]) {
        expect(passwordResetRequestOutcome(code)).not.toHaveProperty("unexpectedCode");
      }
    });
  });
  describe("structure", () => {
    // The ErrorCode values copied from @supabase/auth-js 2.117.2 `src/lib/error-codes.ts` (core does not
    // depend on auth-js), then the codes the api-client passes itself and an invented one. Only the four
    // codes that are the same for every address may give a kind other than "sent".
    const supabaseAuthErrorCodes = [
      "unexpected_failure",
      "validation_failed",
      "bad_json",
      "email_exists",
      "phone_exists",
      "bad_jwt",
      "not_admin",
      "no_authorization",
      "user_not_found",
      "session_not_found",
      "session_expired",
      "refresh_token_not_found",
      "refresh_token_already_used",
      "flow_state_not_found",
      "flow_state_expired",
      "signup_disabled",
      "user_banned",
      "provider_email_needs_verification",
      "invite_not_found",
      "bad_oauth_state",
      "bad_oauth_callback",
      "oauth_provider_not_supported",
      "unexpected_audience",
      "single_identity_not_deletable",
      "email_conflict_identity_not_deletable",
      "identity_already_exists",
      "email_provider_disabled",
      "phone_provider_disabled",
      "too_many_enrolled_mfa_factors",
      "mfa_factor_name_conflict",
      "mfa_factor_not_found",
      "mfa_ip_address_mismatch",
      "mfa_challenge_expired",
      "webauthn_challenge_expired",
      "mfa_verification_failed",
      "mfa_verification_rejected",
      "insufficient_aal",
      "captcha_failed",
      "saml_provider_disabled",
      "manual_linking_disabled",
      "sms_send_failed",
      "email_not_confirmed",
      "phone_not_confirmed",
      "reauth_nonce_missing",
      "saml_relay_state_not_found",
      "saml_relay_state_expired",
      "saml_idp_not_found",
      "saml_assertion_no_user_id",
      "saml_assertion_no_email",
      "user_already_exists",
      "sso_provider_not_found",
      "saml_metadata_fetch_failed",
      "saml_idp_already_exists",
      "sso_domain_already_exists",
      "saml_entity_id_mismatch",
      "conflict",
      "provider_disabled",
      "user_sso_managed",
      "reauthentication_needed",
      "same_password",
      "reauthentication_not_valid",
      "otp_expired",
      "otp_disabled",
      "identity_not_found",
      "weak_password",
      "over_request_rate_limit",
      "over_email_send_rate_limit",
      "over_sms_send_rate_limit",
      "bad_code_verifier",
      "anonymous_provider_disabled",
      "hook_timeout",
      "hook_timeout_after_retry",
      "hook_payload_over_size_limit",
      "hook_payload_invalid_content_type",
      "request_timeout",
      "mfa_phone_enroll_not_enabled",
      "mfa_phone_verify_not_enabled",
      "mfa_totp_enroll_not_enabled",
      "mfa_totp_verify_not_enabled",
      "mfa_webauthn_enroll_not_enabled",
      "mfa_webauthn_verify_not_enabled",
      "mfa_recovery_codes_enroll_not_enabled",
      "mfa_recovery_codes_verify_not_enabled",
      "mfa_recovery_codes_locked",
      "mfa_recovery_codes_sole_factor",
      "mfa_verified_factor_exists",
      "invalid_credentials",
      "email_address_not_authorized",
      "email_address_invalid",
      // Passed by the api-client, not server codes.
      "network",
      "session_missing",
      // Invented, standing for any code a newer server adds.
      "some_new_code",
    ];
    const sameForEveryAddress = [
      "network",
      "over_request_rate_limit",
      "email_address_invalid",
      "validation_failed",
    ];

    it("should give a kind other than sent for exactly the codes that are the same for every address", () => {
      const notSent = [undefined, ...supabaseAuthErrorCodes].filter(
        (code) => passwordResetRequestOutcome(code).kind !== "sent",
      );

      expect([...notSent].sort()).toEqual([...sameForEveryAddress].sort());
    });
  });
});
