import { afterEach, describe, expect, it } from "vitest";
import { usePlayerStore } from "../src/features/player/player-store";

afterEach(() => {
  usePlayerStore.setState({
    bookId: null,
    partId: null,
    parts: [],
    isPlaying: false,
    stopAfterCurrent: false,
    sleepTimerEndsAt: null,
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
});
