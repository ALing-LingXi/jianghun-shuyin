import { afterEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "../src/features/player/player-store";

afterEach(() => {
  usePlayerStore.setState({
    bookId: null,
    partId: null,
    parts: [],
    isPlaying: false,
    currentTimeSeconds: 0,
    durationSeconds: null,
    seekTargetSeconds: null,
    stopAfterCurrent: false,
    sleepTimerEndsAt: null,
    continuousPlayback: true,
  });
});

describe("player store", () => {
  it("stores the current playback state", () => {
    usePlayerStore.getState().setBookId("11111111-1111-4111-8111-111111111111");
    usePlayerStore.getState().setPartId("22222222-2222-4222-8222-222222222222");
    usePlayerStore.getState().setPlaying(true);

    expect(usePlayerStore.getState()).toMatchObject({
      bookId: "11111111-1111-4111-8111-111111111111",
      partId: "22222222-2222-4222-8222-222222222222",
      isPlaying: true,
    });
  });

  it("stores playback progress and seek requests", () => {
    usePlayerStore.getState().setPlaybackTime({
      currentTimeSeconds: 61,
      durationSeconds: 120,
    });
    usePlayerStore.getState().requestSeek(30);

    expect(usePlayerStore.getState()).toMatchObject({
      currentTimeSeconds: 61,
      durationSeconds: 120,
      seekTargetSeconds: 30,
    });

    usePlayerStore.getState().clearSeekTarget();
    expect(usePlayerStore.getState().seekTargetSeconds).toBeNull();
  });

  it("resets playback progress when changing playable parts", () => {
    usePlayerStore.getState().setParts([
      {
        id: "11111111-1111-4111-8111-111111111111",
        index: 0,
        title: "Chapter 1",
        status: "completed",
        audioUrl: "/audio/1.mp3",
        durationSeconds: 120,
        errorMessage: null,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        index: 1,
        title: "Chapter 2",
        status: "completed",
        audioUrl: "/audio/2.mp3",
        durationSeconds: 180,
        errorMessage: null,
      },
    ]);
    usePlayerStore.getState().setPlaybackTime({
      currentTimeSeconds: 60,
      durationSeconds: 120,
    });

    usePlayerStore.getState().goToNext();

    expect(usePlayerStore.getState()).toMatchObject({
      partId: "22222222-2222-4222-8222-222222222222",
      currentTimeSeconds: 0,
      durationSeconds: null,
      seekTargetSeconds: null,
    });
  });

  it("stops after the current part when continuous playback is disabled", () => {
    usePlayerStore.getState().setParts([
      {
        id: "11111111-1111-4111-8111-111111111111",
        index: 0,
        title: "Chapter 1",
        status: "completed",
        audioUrl: "/audio/1.mp3",
        durationSeconds: 120,
        errorMessage: null,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        index: 1,
        title: "Chapter 2",
        status: "completed",
        audioUrl: "/audio/2.mp3",
        durationSeconds: 180,
        errorMessage: null,
      },
    ]);
    usePlayerStore.getState().setPlaying(true);
    usePlayerStore.getState().setContinuousPlayback(false);

    usePlayerStore.getState().handlePartEnded();

    expect(usePlayerStore.getState()).toMatchObject({
      partId: "11111111-1111-4111-8111-111111111111",
      isPlaying: false,
      continuousPlayback: false,
    });

    usePlayerStore.getState().goToNext();

    expect(usePlayerStore.getState()).toMatchObject({
      partId: "22222222-2222-4222-8222-222222222222",
    });
  });
});
