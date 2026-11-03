import { SIGNED_OUT_SOURCE } from "@keylow/core/widgets";

import {
  messageModel,
  populatedSnapshot,
  quickLogSnapshot,
  readySource,
  sessionSnapshot,
} from "../test/viewModels";
import {
  asLaunched,
  backgroundColours,
  colourOfText,
  svgsOf,
  taps,
  textsOf,
  treeOf,
} from "../test/widgetTree";
import { widgetThemeFor } from "../theme";
import { MessageWidget } from "./MessageWidget";

describe.each(["dark", "light"] as const)(
  "a widget with nothing normal to show, in %s",
  (scheme) => {
    const theme = widgetThemeFor(scheme);

    it("should say sign in and offer Open Ki-Lo when signed out", () => {
      const viewModel = messageModel("today_ring", SIGNED_OUT_SOURCE);
      const tree = treeOf(<MessageWidget viewModel={viewModel} theme={theme} />);

      expect(textsOf(tree)).toEqual([
        viewModel.eyebrow,
        viewModel.headline,
        viewModel.body,
        viewModel.actions[0]?.label,
      ]);
      expect(viewModel.state).toBe("signed_out");
      expect(taps(tree)).toEqual([
        { label: viewModel.actions[0]?.accessibleName, uri: "keylow://" },
      ]);
    });

    it("should draw the primary button on the accent and the secondary one on the button fill", () => {
      const signedOut = messageModel("today_ring", SIGNED_OUT_SOURCE);
      const noData = messageModel("today_ring", { status: "no_data" });
      const signedOutTree = treeOf(<MessageWidget viewModel={signedOut} theme={theme} />);
      const noDataTree = treeOf(<MessageWidget viewModel={noData} theme={theme} />);

      expect(backgroundColours(signedOutTree)).toContain(theme.palette.accent);
      expect(colourOfText(signedOutTree, "Open Ki-Lo")).toBe(theme.palette.onAccent);
      expect(backgroundColours(noDataTree)).toContain(theme.buttonBackground);
      expect(colourOfText(noDataTree, "Open Ki-Lo")).toBe(theme.palette.text);
    });

    it("should word the no data state and open the app", () => {
      const viewModel = messageModel("this_week", { status: "no_data" });
      const tree = treeOf(<MessageWidget viewModel={viewModel} theme={theme} />);

      expect(viewModel.state).toBe("no_data");
      expect(textsOf(tree)).toContain(viewModel.headline);
      expect(taps(tree)).toHaveLength(1);
    });

    it("should show what was eaten in the corner and open Targets when there is no target", () => {
      const snapshot = { ...populatedSnapshot(), targets: null };
      const viewModel = messageModel("today_ring", readySource(snapshot));
      const tree = treeOf(<MessageWidget viewModel={viewModel} theme={theme} />);

      expect(viewModel.state).toBe("no_target");
      expect(textsOf(tree)).toContain(viewModel.trailing);
      expect(taps(tree).map((tap) => tap.uri)).toEqual(["keylow://targets"]);
    });

    it("should write a failure headline in the danger colour", () => {
      const viewModel = messageModel("log_again", readySource(), { failure: "couldnt_log" });
      const tree = treeOf(<MessageWidget viewModel={viewModel} theme={theme} />);

      expect(colourOfText(tree, viewModel.headline)).toBe(theme.palette.danger);
    });

    it("should draw a failure as a banner with the alert icon, the line under it and one button", () => {
      const viewModel = messageModel("log_again", readySource(), { failure: "couldnt_log" });
      const tree = treeOf(<MessageWidget viewModel={viewModel} theme={theme} />);

      expect(textsOf(tree)).toEqual([
        viewModel.eyebrow,
        viewModel.headline,
        viewModel.body,
        "Open Ki-Lo",
      ]);
      expect(backgroundColours(tree)).toContain(asLaunched(theme.dangerMuted));
      expect(svgsOf(tree)[0]).toContain(`stroke="${theme.palette.danger}"`);
    });

    it("should word Couldn't undo as core does, in the same banner", () => {
      const viewModel = messageModel("training", readySource(sessionSnapshot()), {
        failure: "couldnt_undo",
      });
      const tree = treeOf(<MessageWidget viewModel={viewModel} theme={theme} />);

      expect(viewModel.state).toBe("couldnt_undo");
      expect(textsOf(tree)).toContain(viewModel.headline);
      expect(backgroundColours(tree)).toContain(asLaunched(theme.dangerMuted));
    });

    it("should say the session moved on and offer Open session", () => {
      const viewModel = messageModel("training", readySource(sessionSnapshot()), {
        failure: "session_moved_on",
      });
      const tree = treeOf(<MessageWidget viewModel={viewModel} theme={theme} />);

      expect(textsOf(tree)).toContain("Your session moved on");
      expect(taps(tree).map((tap) => tap.uri)).toEqual(["keylow://session"]);
    });

    it("should say there are no recent foods and offer Log food", () => {
      const viewModel = messageModel("log_again", readySource(populatedSnapshot()));
      const tree = treeOf(<MessageWidget viewModel={viewModel} theme={theme} />);

      expect(viewModel.state).toBe("no_recent_foods");
      expect(textsOf(tree)).toContain("Log food");
      expect(taps(tree).map((tap) => tap.uri)).toEqual(["keylow://foods"]);
    });

    it("should draw a rest day with its two buttons, the start link carrying the nonce", () => {
      const snapshot = { ...quickLogSnapshot(), training: { plan: null, session: null } };
      const viewModel = messageModel("training", readySource(snapshot));
      const tree = treeOf(<MessageWidget viewModel={viewModel} theme={theme} />);

      expect(viewModel.state).toBe("rest_day");
      expect(textsOf(tree)).toEqual([
        viewModel.eyebrow,
        viewModel.headline,
        viewModel.body,
        "Empty session",
        "Open Train",
      ]);
      expect(taps(tree).map((tap) => tap.uri)).toEqual([
        expect.stringMatching(/^keylow:\/\/session\?start=empty&nonce=.{16,}$/),
        "keylow://train",
      ]);
    });
  },
);
