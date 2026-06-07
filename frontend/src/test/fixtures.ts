/**
 * 公共 mock 数据：用于 MSW handler 与测试断言。
 */

export const mockUser = {
  id: 1,
  username: "testuser",
  email: "test@example.com",
  created_at: "2026-01-01T00:00:00Z",
};

export const mockTokenResponse = {
  access_token: "mock-access-token",
  refresh_token: "mock-refresh-token",
  token_type: "bearer",
};

export const mockQuota = {
  used_bytes: 1024,
  limit_bytes: 209715200,
  available_bytes: 209714176,
};

export const mockFiles = [
  {
    name: "silhouette.png",
    size_bytes: 1024,
    modified_at: "2026-01-01T00:00:00Z",
  },
];

export const mockTask = [
  {
    id: 1,
    mode: "single",
    codec: "h264",
    status: "queued",
    input_props: { characterName: "Test" },
    output_path: "",
    error: null,
    duration_ms: null,
    created_at: "2026-01-01T00:00:00Z",
    started_at: null,
    finished_at: null,
    position: 0,
    eta_seconds: 30,
  },
];

/**
 * 默认 radar config fixture（精简版，供组件测试用）。
 */
export const mockRadarProps = {
  characterName: "测试角色",
  attributes: [
    { label: "攻击", value: 80 },
    { label: "防御", value: 60 },
    { label: "速度", value: 90 },
    { label: "智力", value: 70 },
    { label: "耐力", value: 85 },
  ],
  theme: {
    primaryColor: "#3b82f6",
    secondaryColor: "#6366f1",
    backgroundColor: "#0f172a",
    silhouetteOpacity: 0.3,
  },
  animation: {
    duration: 60,
    staggerDelay: 5,
    fadeInDuration: 15,
  },
  font: {
    family: "sans-serif",
    size: 14,
  },
  layout: {
    width: 1920,
    height: 1080,
    silhouetteScale: 1.0,
    silhouetteOffsetX: 0,
    silhouetteOffsetY: 0,
    characterNameOffsetX: 0,
    characterNameOffsetY: 0,
    syncSilhouetteOffset: true,
  },
  silhouetteSrc: "",
  characterNameAlign: "center" as const,
  characterNameFontSize: 72,
  slug: {
    text: "",
    fontFamily: "sans-serif",
    fontSize: 16,
    color: "#ffffff",
    offsetX: 0,
    offsetY: 0,
  },
};
