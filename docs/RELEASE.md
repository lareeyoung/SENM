# 发布新版本

## 自动发布

1. 更新 `package.json` 版本号与 `CHANGELOG.md`。
2. 确认 `main` 分支的测试通过。
3. 创建并推送与版本一致的标签，例如：

```bash
git tag v0.1.1
git push origin v0.1.1
```

GitHub Actions 会分别构建：

- macOS Apple Silicon：DMG 与 ZIP。
- Windows x64：NSIS 安装程序与免安装 ZIP。

全部构建完成后，工作流会创建 GitHub Release 并附上安装包。

## 发布检查

- 从 Release 页面重新下载文件，不使用本地缓存。
- macOS 验证安装、首次启动、菜单栏图标和快速窗口。
- Windows 验证安装/卸载、系统托盘图标、全局快捷键和快速窗口。
- 验证模型配置可保存、连接失败可重试、密钥不会出现在日志或导出内容中。
- 发布说明中明确当前安装包是否具有 Apple notarization 或 Windows Authenticode 签名。
