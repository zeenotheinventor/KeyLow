import { setForgotPasswordEmail, takeForgotPasswordEmail } from "../lib/forgotPasswordEmail";

describe("the email handed to the forgot password screen", () => {
  afterEach(() => {
    takeForgotPasswordEmail();
  });

  it("should give back what Sign in handed over", () => {
    setForgotPasswordEmail("person@example.test");

    expect(takeForgotPasswordEmail()).toBe("person@example.test");
  });

  it("should give it only once, so a later visit starts with an empty field", () => {
    setForgotPasswordEmail("person@example.test");
    takeForgotPasswordEmail();

    expect(takeForgotPasswordEmail()).toBe("");
  });

  it("should be empty when nothing was handed over", () => {
    expect(takeForgotPasswordEmail()).toBe("");
  });
});
