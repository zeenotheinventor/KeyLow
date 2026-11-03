import { SIGNED_OUT_SOURCE } from "@keylow/core/widgets";

import { messageModel, populatedSnapshot, readySource } from "../test/viewModels";
import { backgroundColours, colourOfText, taps, textsOf, treeOf } from "../test/widgetTree";
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
  },
);
