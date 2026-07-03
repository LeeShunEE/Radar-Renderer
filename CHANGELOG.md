# Changelog

All notable changes to this project are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

本项目的所有重要变更记录于此，格式遵循 Keep a Changelog，版本遵循语义化版本。

## [Unreleased]

### Added
- feat(comparison): 对比模式新增「叠加高亮」(overlay) 布局——同图叠加双方八边形、依次高亮并弹出强弱箭头（恢复后常驻），与既有「切换过渡」(transition) 并存，编辑器布局下拉切换；旧配置经 schema 默认值自动回填
- feat(local-render): 浏览器端 WebCodecs MP4 导出（带 AAC 音轨），帧精确 seekTo + 截图管线；无 WebCodecs 时回退 WebM（无音频）
- Open-source governance scaffolding: `LICENSE` (GPL-3.0), `NOTICE`,
  `CONTRIBUTING.md`, `SECURITY.md`, bilingual `README`.
- `.github/` automation: CI workflow (backend + frontend), DCO check,
  issue/PR templates, Dependabot, `CODEOWNERS`.

[Unreleased]: https://github.com/LeeShunEE/Radar-Renderer/commits/main
