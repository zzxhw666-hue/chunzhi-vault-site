
## Supabase 设置

1. 打开 Supabase 项目。
2. 进入 SQL Editor。
3. 复制 `supabase-schema.sql` 全部内容并运行。
4. 确认 `supabase-config.js` 里是你的 Supabase URL 和 anon public key。

## GitHub Pages 发布

把这些文件上传到一个 GitHub 仓库根目录：

```text
index.html
styles.css
app.js
supabase-config.js
supabase-schema.sql
README.md
```

然后进入：

```text
Settings -> Pages
```

设置：

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

发布后访问：

```text
https://你的用户名.github.io/仓库名/
```
