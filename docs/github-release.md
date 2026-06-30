# GitHub Release Checklist

这份清单用于把本地项目发布成 GitHub 开源仓库。

## 1. 创建仓库

在 GitHub 新建仓库，例如：

```text
cli-in-wechat
```

建议：

- Public
- 不勾选自动生成 README、LICENSE、`.gitignore`
- 默认分支 `main`

## 2. 更新仓库地址

仓库地址当前使用 `lenlanF/cli-in-wechat`。如果要改成其他 GitHub 用户名或组织名，再更新：

- `README.md`
- `package.json`

## 3. 本地提交并推送

如果已安装 Git：

```bash
git init
git branch -M main
git add .
git commit -m "Initial open source release"
git remote add origin https://github.com/lenlanF/cli-in-wechat.git
git push -u origin main
```

如果安装了 GitHub CLI：

```bash
gh repo create lenlanF/cli-in-wechat --public --source . --remote origin --push
```

## 4. 发布前验证

```bash
npm ci
npm run typecheck
npm test
npm run build
```

推送后 GitHub Actions 会自动跑 CI。

## 5. 仓库设置建议

- 在 About 里添加 topics：`wechat`, `clawbot`, `ai-agent`, `nas`, `lan`, `codex`, `claude`
- 开启 Issues
- 开启 Dependabot alerts
- 保护 `main` 分支，要求 CI 通过后再合并 PR

## 6. 不要提交

- `~/.wx-ai-bridge/credentials.json`
- `.env`
- NAS 私有路径、内网 token、真实微信用户 ID
- 运行时下载的 `.wx-media/`
