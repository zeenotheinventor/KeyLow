export const googleIdToken = "google-id-token-from-native-sheet";

export const mockGoogleSignin = {
  configure: jest.fn(),
  hasPlayServices: jest.fn(),
  signIn: jest.fn(),
};

export const iosClientId = "ios-client.apps.googleusercontent.com";
export const webClientId = "web-client.apps.googleusercontent.com";

export function setGoogleClientIds(): void {
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = iosClientId;
  process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = webClientId;
}

export function clearGoogleClientIds(): void {
  delete process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
  delete process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
}

export function resetGoogleSignInMock(): void {
  for (const method of Object.values(mockGoogleSignin)) {
    method.mockReset();
  }
  mockGoogleSignin.hasPlayServices.mockResolvedValue(true);
  mockGoogleSignin.signIn.mockResolvedValue({
    type: "success",
    data: { idToken: googleIdToken },
  });
  setGoogleClientIds();
}
