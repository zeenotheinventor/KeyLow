import { View } from "react-native";

import { AuthLink } from "../../AuthForm/AuthLink";
import { Input } from "../Input";
import { Text } from "../Text";
import { ConfirmDialog } from "./ConfirmDialog";

import type { Meta, StoryObj } from "@storybook/react-native";

const meta = {
  title: "UI/ConfirmDialog",
  component: ConfirmDialog,
  decorators: [
    // The dialog covers the screen behind it, as the boards draw it over their screen.
    (Story) => (
      <View className="flex-1 p-4">
        <Text variant="h1">Today</Text>
        <Story />
      </View>
    ),
  ],
  args: {
    open: true,
    title: "Discard this session?",
    body: "The 8 sets you logged in Legs today are removed from your history and your body map. This cannot be undone.",
    confirmLabel: "Discard session",
    cancelLabel: "Keep logging",
    tone: "destructive",
    onConfirm: () => undefined,
    onCancel: () => undefined,
  },
} satisfies Meta<typeof ConfirmDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

// The session discard board: the answer removes something, so it is written in the danger colour and the way back is the main button.
export const Destructive: Story = {};

// The routines set active board: the answer only changes what is current, so it is the main button.
export const Primary: Story = {
  args: {
    tone: "primary",
    title: "Make Upper Lower active?",
    body: "It plans from today, Thursday 15 October. Push Pull Legs stays saved, and the sessions you logged keep their days.",
    confirmLabel: "Make active",
    cancelLabel: "Cancel",
  },
};

// The answer is being carried out: the confirm button shows a spinner and ignores presses.
export const Busy: Story = { args: { busy: true } };

// The answer cannot be left once it has started, as on the delete account board: the dim, the escape gesture and
// the Android back button do nothing, the cancel button is disabled, and the busy confirm button is named by what it is doing.
export const BusyLocked: Story = {
  args: { busy: true, lockWhileBusy: true, confirmBusyLabel: "Discarding your session" },
};

// A title and a sentence that wrap onto several lines, as they do at the largest text sizes the device allows.
// The card takes its height from its contents and stays centred.
export const LongTitle: Story = {
  args: {
    title: "Delete this session from your history and your body map?",
    body: "The 8 sets you logged in Legs on Thursday 15 October are removed from your history and your body map, and your last performance for each exercise goes back to the session before it. This cannot be undone.",
    confirmLabel: "Delete session",
    cancelLabel: "Keep session",
  },
};

// The delete account board for an email account: a field between the sentence and the buttons, and a link under
// it. The field is not focused when the dialog opens, and the card moves up when the keyboard does.
export const WithAField: Story = {
  args: {
    title: "Delete your account?",
    body: "Everything in your account is deleted now. This cannot be undone. Enter your password to confirm.",
    confirmLabel: "Delete account",
    cancelLabel: "Keep my account",
    children: (
      <View className="gap-1">
        <Input
          autoCapitalize="none"
          autoCorrect={false}
          label="Password"
          secureTextEntry
          value=""
          onChangeText={() => undefined}
        />
        <View className="items-end">
          <AuthLink label="Forgot password?" onPress={() => undefined} />
        </View>
      </View>
    ),
  },
};

// The same board after a wrong password: the field takes the danger border and says so, and the typed value stays.
export const WithAFieldError: Story = {
  args: {
    ...WithAField.args,
    children: (
      <View className="gap-1">
        <Input
          autoCapitalize="none"
          autoCorrect={false}
          error="That password is not right. Nothing was deleted."
          label="Password"
          secureTextEntry
          value="not-the-password"
          onChangeText={() => undefined}
        />
        <View className="items-end">
          <AuthLink label="Forgot password?" onPress={() => undefined} />
        </View>
      </View>
    ),
  },
};

export const Closed: Story = { args: { open: false } };
