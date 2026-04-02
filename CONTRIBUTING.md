# 贡献指南

感谢你对本项目的关注！欢迎贡献！

## 📖 如何贡献

### 1. 报告问题

发现文档错误或需要改进？[提交 Issue](https://github.com/luoboask/claude-code-learning/issues/new/choose)

### 2. 改进文档

1. Fork 本仓库
2. 创建分支 `git checkout -b feature/improve-docs`
3. 提交更改 `git commit -am 'docs: 改进 XXX 说明'`
4. 推送分支 `git push origin feature/improve-docs`
5. 创建 Pull Request

### 3. 添加代码示例

1. 在 `code-examples/` 目录添加新示例
2. 在 README 中更新示例列表
3. 确保代码可运行并添加注释
4. 提交 PR

## 📝 提交规范

### Commit Message 格式

```
<type>: <description>

[optional body]

[optional footer]
```

### Type 类型

- `docs`: 文档更新
- `feat`: 新内容（示例、指南等）
- `fix`: 修复错误
- `refactor`: 重构（不改变功能）
- `chore`: 其他（配置、CI 等）

### 示例

```bash
docs: 添加工具实现模板
feat: 添加安全检查示例
fix: 修复架构图文档错误
refactor: 重构学习指南结构
```

## 🔍 代码审查标准

### 文档

- [ ] 拼写和语法正确
- [ ] 信息准确
- [ ] 格式一致
- [ ] 有清晰的标题和目录
- [ ] 包含必要的代码示例

### 代码示例

- [ ] 代码可运行
- [ ] 有清晰的注释
- [ ] 遵循项目代码风格
- [ ] 包含使用示例
- [ ] 添加错误处理

## 📚 文档结构

```
claude-code-learning/
├── README.md                    # 项目说明
├── CONTRIBUTING.md              # 贡献指南（本文件）
├── LICENSE                      # 许可证
├── docs/                        # 学习文档
│   ├── ARCHITECTURE.md          # 架构全景
│   ├── COMPLETE_ANALYSIS.md     # 完整分析
│   ├── ULTRA_DETAILED_ANALYSIS.md # 超详细实现
│   └── LEARNING_GUIDE.md        # 学习指南
├── code-examples/               # 代码示例
└── source/                      # 源码参考
```

## 🤔 常见问题

### Q: 我可以翻译文档吗？

A: 欢迎！请创建 `README.zh-CN.md` 或其他语言版本。

### Q: 如何添加新的代码示例？

A: 在 `code-examples/` 目录添加文件，并在 README 中更新示例列表。

### Q: 我的 PR 多久会被审查？

A: 通常在 1-3 天内。如果超过一周，可以 @ 提醒维护者。

## 📧 联系方式

- 项目地址：https://github.com/luoboask/claude-code-learning
- Issue 追踪：https://github.com/luoboask/claude-code-learning/issues

---

感谢你的贡献！🎉
