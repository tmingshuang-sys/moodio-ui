#!/usr/bin/env bash
# 重新生成渲染用的字体子集。平时不用跑——产出的 woff2 已经提交在 public/fonts/ 里，
# 只有要换字体或者改字符集（scripts/font-charset.txt）时才需要。
#
# 为什么要自带字体：渲染核心同一份代码，浏览器和服务器各跑一遍，字体却来自各自的系统——
# Mac 落到苹方，Ubuntu 落到 Noto Sans CJK。字形不一样，**更要命的是字宽不一样**，
# 于是折行位置会变，预览里排好的版到了成片上可能多出一行或者挤出画面。
# 自带字体之后两边加载的是同一个文件，这个问题就不存在了。
#
# 字符集取 GB2312 全集（6763 汉字）+ 拉丁 + 希腊 + 数学符号 + 中英标点 + 全角，
# 共约 7600 字，覆盖现代中文约 99.99%。只取一级字表（3755）能省 1.2 MB，
# 但偶尔掉字就会退回系统字体，又回到不一致——这 1.2 MB 买的就是这件事不发生。
#
# 需要：pip install fonttools brotli
set -euo pipefail
cd "$(dirname "$0")/.."

SRC=${FONT_SRC:-/tmp/fontsrc}
BASE='https://cdn.jsdelivr.net/gh/notofonts/noto-cjk@main/Sans/SubsetOTF/SC'

command -v pyftsubset >/dev/null || { echo "先装工具：pip install fonttools brotli"; exit 1; }
mkdir -p "$SRC" public/fonts

for pair in Regular:400 Bold:700; do
  W=${pair%%:*}; N=${pair##*:}
  if [ ! -f "$SRC/NotoSansSC-$W.otf" ]; then
    echo "下载 NotoSansSC-$W.otf（约 8 MB，国内要挂代理）"
    curl -fsSL "$BASE/NotoSansSC-$W.otf" -o "$SRC/NotoSansSC-$W.otf"
  fi
  pyftsubset "$SRC/NotoSansSC-$W.otf" \
    --text-file=scripts/font-charset.txt \
    --flavor=woff2 --layout-features='*' \
    --output-file="public/fonts/wow-sans-$N.woff2"
  echo "public/fonts/wow-sans-$N.woff2  $(du -h "public/fonts/wow-sans-$N.woff2" | cut -f1)"
done

# OFL 要求随字体一起分发许可证
python3 - <<'PY'
from fontTools.ttLib import TTFont
import os
src = os.environ.get('FONT_SRC', '/tmp/fontsrc')
f = TTFont(f'{src}/NotoSansSC-Regular.otf', lazy=True)
open('public/fonts/LICENSE.txt', 'w').write(
    f['name'].getDebugName(13)
    + '\n\n来源：Noto Sans SC（notofonts/noto-cjk），已按 GB2312 字符集做子集化。\n'
      '重新生成见 scripts/build-font.sh\n')
PY
echo "许可证已写入 public/fonts/LICENSE.txt"
