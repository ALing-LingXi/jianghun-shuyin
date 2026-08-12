import { describe, expect, it } from "vitest";
import { EdgeTtsVoiceCatalog } from "../src/server/infrastructure/edgeTtsVoiceCatalog";

describe("EdgeTtsVoiceCatalog", () => {
  it("puts the default voice first and prioritizes Chinese voices", async () => {
    const catalog = new EdgeTtsVoiceCatalog({
      fetchVoices: async () => [
        {
          ShortName: "en-US-AvaNeural",
          Locale: "en-US",
          Gender: "Female",
          FriendlyName: "Ava",
        },
        {
          ShortName: "zh-TW-HsiaoChenNeural",
          Locale: "zh-TW",
          Gender: "Female",
          FriendlyName: "HsiaoChen",
        },
        {
          ShortName: "zh-CN-XiaoxiaoNeural",
          Locale: "zh-CN",
          Gender: "Female",
          FriendlyName: "Xiaoxiao",
        },
        {
          ShortName: "zh-CN-YunxiNeural",
          Locale: "zh-CN",
          Gender: "Male",
          FriendlyName: "Yunxi",
        },
      ],
    });

    await expect(catalog.listVoices()).resolves.toEqual([
      {
        id: "zh-CN-YunxiNeural",
        label: "云溪",
        locale: "zh-CN",
        gender: "Male",
      },
      {
        id: "zh-CN-XiaoxiaoNeural",
        label: "晓晓",
        locale: "zh-CN",
        gender: "Female",
      },
      {
        id: "zh-TW-HsiaoChenNeural",
        label: "晓臻",
        locale: "zh-TW",
        gender: "Female",
      },
      {
        id: "en-US-AvaNeural",
        label: "Ava",
        locale: "en-US",
        gender: "Female",
      },
    ]);
  });

  it("keeps the default voice available when Edge voice discovery fails", async () => {
    const catalog = new EdgeTtsVoiceCatalog({
      fetchVoices: async () => {
        throw new Error("network unavailable");
      },
    });

    await expect(catalog.listVoices()).resolves.toEqual([
      {
        id: "zh-CN-YunxiNeural",
        label: "云溪",
        locale: "zh-CN",
        gender: "Male",
      },
    ]);
  });
});
