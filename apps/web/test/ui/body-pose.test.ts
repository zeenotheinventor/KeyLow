import { describe, expect, it, vi } from "vitest";

import { createBodyPose } from "@/components/ui/Body3D/bodyPose";

describe("createBodyPose", () => {
  it("should start facing the side it is given, at the whole body", () => {
    expect(createBodyPose("front").yaw).toBe(0);
    expect(createBodyPose("back").yaw).toBe(Math.PI);
    expect(createBodyPose("front").view).toEqual({ zoom: 1, x: 0, y: 0 });
  });

  it("should follow setYaw at once and tell its listeners", () => {
    const pose = createBodyPose("front");
    const listener = vi.fn();
    pose.subscribe(listener);

    pose.setYaw(1);

    expect(pose.yaw).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("should stop telling a listener that unsubscribed", () => {
    const pose = createBodyPose("front");
    const listener = vi.fn();
    pose.subscribe(listener)();

    pose.setYaw(1);

    expect(listener).not.toHaveBeenCalled();
  });

  describe("turnTo", () => {
    it("should ease to the side by the shorter arc over the given time", () => {
      const pose = createBodyPose("front");

      pose.turnTo("back", 200);
      expect(pose.step(100)).toBe(true);
      expect(pose.yaw).toBeCloseTo(Math.PI / 2);
      expect(pose.step(100)).toBe(false);
      expect(pose.yaw).toBeCloseTo(Math.PI);
    });

    it("should turn the short way round from a yaw past a half turn", () => {
      const pose = createBodyPose("front");
      pose.setYaw(Math.PI * 1.75);

      pose.turnTo("front", 0);

      expect(pose.yaw).toBeCloseTo(2 * Math.PI);
    });

    it("should turn at once with no time", () => {
      const pose = createBodyPose("front");
      const listener = vi.fn();
      pose.subscribe(listener);

      pose.turnTo("back", 0);

      expect(pose.yaw).toBe(Math.PI);
      expect(pose.step(16)).toBe(false);
      expect(listener).toHaveBeenCalled();
    });

    it("should do nothing when already facing the side", () => {
      const pose = createBodyPose("back");
      const listener = vi.fn();
      pose.subscribe(listener);

      pose.turnTo("back", 220);

      expect(pose.step(16)).toBe(false);
      expect(listener).not.toHaveBeenCalled();
    });

    it("should be taken over by a drag, which carries on from where the body is", () => {
      const pose = createBodyPose("front");
      pose.turnTo("back", 200);
      pose.step(100);

      pose.setYaw(pose.yaw + 0.1);

      expect(pose.step(100)).toBe(false);
      expect(pose.yaw).toBeCloseTo(Math.PI / 2 + 0.1);
    });
  });

  describe("the view", () => {
    const zoomedView = { zoom: 2, x: 10, y: -20 };

    it("should follow setView at once", () => {
      const pose = createBodyPose("front");

      pose.setView(zoomedView);

      expect(pose.view).toEqual(zoomedView);
    });

    it("should tell its listeners when the view is set, so the canvas redraws", () => {
      const pose = createBodyPose("front");
      const listener = vi.fn();
      pose.subscribe(listener);

      pose.setView(zoomedView);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should tell its listeners when an ease starts", () => {
      const pose = createBodyPose("front");
      const listener = vi.fn();
      pose.subscribe(listener);

      pose.easeViewTo(zoomedView, 200);

      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("should ease to a view over the given time", () => {
      const pose = createBodyPose("front");
      pose.setView(zoomedView);

      pose.easeViewTo({ zoom: 1, x: 0, y: 0 }, 200);
      expect(pose.step(100)).toBe(true);
      expect(pose.view.zoom).toBeCloseTo(1.5);
      expect(pose.view.x).toBeCloseTo(5);
      expect(pose.view.y).toBeCloseTo(-10);
      expect(pose.step(100)).toBe(false);
      expect(pose.view).toEqual({ zoom: 1, x: 0, y: 0 });
    });

    it("should go to the view at once with no time", () => {
      const pose = createBodyPose("front");
      pose.setView(zoomedView);

      pose.easeViewTo({ zoom: 1, x: 0, y: 0 }, 0);

      expect(pose.view).toEqual({ zoom: 1, x: 0, y: 0 });
      expect(pose.step(16)).toBe(false);
    });

    it("should name the view an ease is heading to", () => {
      const pose = createBodyPose("front");
      pose.setView(zoomedView);
      expect(pose.viewTarget).toEqual(zoomedView);

      pose.easeViewTo({ zoom: 1, x: 0, y: 0 }, 200);
      pose.step(100);

      expect(pose.viewTarget).toEqual({ zoom: 1, x: 0, y: 0 });
    });

    it("should be taken over by a gesture", () => {
      const pose = createBodyPose("front");
      pose.setView(zoomedView);
      pose.easeViewTo({ zoom: 1, x: 0, y: 0 }, 200);
      pose.step(100);

      pose.setView({ zoom: 1.8, x: 0, y: 0 });

      expect(pose.step(100)).toBe(false);
      expect(pose.view.zoom).toBe(1.8);
    });
  });

  it("should ease the turn and the view together", () => {
    const pose = createBodyPose("front");
    pose.setView({ zoom: 2, x: 0, y: 0 });

    pose.turnTo("back", 100);
    pose.easeViewTo({ zoom: 1, x: 0, y: 0 }, 200);

    expect(pose.step(100)).toBe(true);
    expect(pose.yaw).toBeCloseTo(Math.PI);
    expect(pose.step(100)).toBe(false);
  });
});
