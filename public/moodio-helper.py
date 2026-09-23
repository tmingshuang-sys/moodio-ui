#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Moodio 本地助手：让网页里的成片一键进达芬奇。

网页没法启动达芬奇（它没注册 URL scheme），也拿不到本机绝对路径，所以由这个小程序代劳：
它在 127.0.0.1 上听一个端口，收下网页传来的片段，写到 ~/Movies/Moodio/<创作名>/，
生成 FCPXML，再通过达芬奇自带的脚本接口把时间线导进去并切到剪辑页。

只用 Python 标准库，macOS 自带的 python3 就能跑：

    python3 moodio-helper.py

想换端口或存放位置：
    python3 moodio-helper.py --port 17817 --dir ~/Movies/Moodio
"""
import argparse, json, os, re, shutil, sys, threading, time, webbrowser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

VERSION = "1.0.0"
DEFAULT_PORT = 17817
DEFAULT_DIR = os.path.expanduser("~/Movies/Moodio")
MAX_FILE = 2 * 1024 * 1024 * 1024          # 单个片段上限 2GB
ALLOW_SUFFIX = (".moodio.art", ".workers.dev")   # 允许调用的站点后缀
ALLOW_EXACT = ("http://localhost:5174", "http://127.0.0.1:5174", "http://localhost:8765", "http://127.0.0.1:8765")
SAFE_NAME = re.compile(r"[^0-9A-Za-z一-鿿._· -]")

RESOLVE_MODULES = "/Library/Application Support/Blackmagic Design/DaVinci Resolve/Developer/Scripting/Modules"
RESOLVE_LIBS = [
    "/Applications/DaVinci Resolve/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so",
    "/Applications/DaVinci Resolve.app/Contents/Libraries/Fusion/fusionscript.so",
]

def log(*a):
    print(time.strftime("[%H:%M:%S]"), *a, flush=True)

def safe_name(name, fallback="clip"):
    """文件名去掉路径分隔符与危险字符，避免写到目录外面。"""
    name = os.path.basename(str(name or "")).strip()
    name = SAFE_NAME.sub("_", name).lstrip(".")
    return name[:120] or fallback

def origin_ok(origin):
    if not origin or origin == "null":
        return True                                   # 本地打开的页面没有 Origin
    if origin in ALLOW_EXACT:
        return True
    try:
        host = urlparse(origin).hostname or ""
    except Exception:
        return False
    return host in ("localhost", "127.0.0.1") or any(host.endswith(s) for s in ALLOW_SUFFIX)

# ---------- 达芬奇 ----------
def resolve_app():
    """连上正在运行的达芬奇；没装或没开就返回 None。"""
    if RESOLVE_MODULES not in sys.path:
        sys.path.append(RESOLVE_MODULES)
    if not os.environ.get("RESOLVE_SCRIPT_LIB"):
        for lib in RESOLVE_LIBS:
            if os.path.exists(lib):
                os.environ["RESOLVE_SCRIPT_LIB"] = lib
                break
    try:
        import DaVinciResolveScript as dvr
    except Exception:
        return None
    try:
        return dvr.scriptapp("Resolve")
    except Exception:
        return None

def resolve_installed():
    return os.path.isdir(RESOLVE_MODULES) and any(os.path.exists(p) for p in RESOLVE_LIBS)

def launch_resolve(wait=90):
    """达芬奇没开就打开它，等到脚本接口能连上为止。"""
    app = resolve_app()
    if app:
        return app
    for path in ("/Applications/DaVinci Resolve/DaVinci Resolve.app", "/Applications/DaVinci Resolve.app"):
        if os.path.exists(path):
            os.system('open "%s"' % path)
            break
    else:
        return None
    for _ in range(wait):
        time.sleep(1)
        app = resolve_app()
        if app:
            time.sleep(2)     # 刚起来时接口还不稳，缓一下
            return app
    return None

def open_project(project_name):
    """启动达芬奇并拿到项目；返回 (app, project, 错误信息)。"""
    app = launch_resolve()
    if not app:
        return None, None, "达芬奇没能启动，或者它的脚本接口不可用"
    pm = app.GetProjectManager()
    proj = pm.CreateProject(project_name) or pm.LoadProject(project_name) or pm.GetCurrentProject()
    if not proj:
        return None, None, "达芬奇里建不了项目"
    return app, proj, ""

def unique_timeline_name(proj, name):
    """时间线重名时达芬奇会拒绝导入，所以同一条成片导第二次要自动加序号。"""
    existing = set()
    for i in range(1, (proj.GetTimelineCount() or 0) + 1):
        tl = proj.GetTimelineByIndex(i)
        if tl:
            existing.add(tl.GetName())
    if name not in existing:
        return name
    for n in range(2, 200):
        candidate = "%s %d" % (name, n)
        if candidate not in existing:
            return candidate
    return "%s %d" % (name, int(time.time()))

def place_audio(proj, tl, dir_path, audios, fps):
    """把配乐 / 配音各放一条独立音轨上：用秒数算帧范围（媒体池的 Frames 属性读出来是空的），recordFrame 就是时间线起点。"""
    mp = proj.GetMediaPool()
    paths = [os.path.join(dir_path, a["file"]) for a in audios]
    items = mp.ImportMedia(paths) or []
    by_name = {}
    for it in items:
        try:
            by_name[it.GetName()] = it
        except Exception:
            pass
    placed = 0
    for a in audios:
        item = by_name.get(a["file"])
        if not item:
            continue
        frames = max(1, int(round(float(a["seconds"]) * fps)))
        tl.AddTrack("audio", "stereo")
        idx = tl.GetTrackCount("audio")
        got = mp.AppendToTimeline([{
            "mediaPoolItem": item, "startFrame": 0, "endFrame": frames - 1, "mediaType": 2,
            "trackIndex": idx, "recordFrame": max(0, int(round(float(a.get("start") or 0) * fps))),
        }])
        if got:
            placed += 1
            try:
                tl.SetTrackName("audio", idx, a.get("name") or a["file"])
            except Exception:
                pass
    return placed

def import_to_resolve(app, proj, make_xml, title, tries=3):
    """导入时间线、切到剪辑页。项目刚打开的头一两秒达芬奇会拒绝导入，所以失败了换个名字缓一下再试。"""
    last = "达芬奇拒绝了这份工程文件"
    for attempt in range(tries):
        name = unique_timeline_name(proj, title)
        xml_path = make_xml(name)
        before = proj.GetTimelineCount()
        proj.GetMediaPool().ImportTimelineFromFile(xml_path)
        after = proj.GetTimelineCount()
        if after > before:
            tl = proj.GetTimelineByIndex(after)
            proj.SetCurrentTimeline(tl)
            app.OpenPage("edit")
            items = tl.GetItemListInTrack("video", 1) or []
            return True, "已在达芬奇里打开「%s」，视频轨 %d 段" % (tl.GetName(), len(items))
        log("第 %d 次导入没成功，等一下再试" % (attempt + 1))
        time.sleep(1.5)
    return False, last

# ---------- FCPXML ----------
def build_srt(subs):
    """达芬奇的脚本接口没有导入字幕的方法（只有从音频生成），所以备一份 SRT 让用户拖进字幕轨。"""
    def tc(sec):
        ms = max(0, int(round(sec * 1000)))
        return "%02d:%02d:%02d,%03d" % (ms // 3600000, ms // 60000 % 60, ms // 1000 % 60, ms % 1000)
    rows = [x for x in (subs or []) if x.get("text") and float(x.get("end", 0)) > float(x.get("start", 0))]
    rows.sort(key=lambda x: float(x["start"]))
    return "\n".join("%d\n%s --> %s\n%s\n" % (i + 1, tc(float(x["start"])), tc(float(x["end"])), str(x["text"]).strip())
                     for i, x in enumerate(rows))

def build_fcpxml(title, clips, dir_path, fps=30):
    """与网页端 src/lib/nle.ts 同一套写法：媒体引用必须是绝对 file:// URL。只放视频——
    配乐 / 配音如果作为 connected clip 写进来，达芬奇会把第二段之后视频自己的音频挤到配乐轨上（实测），
    所以音频改用脚本接口 AddTrack + AppendToTimeline 精确放置。"""
    from urllib.parse import quote
    base = fps * 100
    frames = lambda sec: max(0, round(sec * fps))
    at = lambda sec: "%d/%ds" % (frames(sec) * 100, base)
    dur = lambda sec: "%d/%ds" % (max(1, frames(sec)) * 100, base)
    esc = lambda s: str(s).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;")
    file_url = lambda p: "file://" + "/".join(quote(seg, safe="") for seg in p.split("/"))
    w = clips[0].get("width") or 1920
    h = clips[0].get("height") or 1080
    assets, spine, off = [], [], 0.0
    for i, c in enumerate(clips):
        sec = float(c.get("seconds") or 0)
        assets.append(
            '    <asset id="a%d" name="%s" uid="MOODIO%03d" start="0s" duration="%s" hasVideo="1" hasAudio="1"'
            ' videoSources="1" audioSources="1" audioChannels="2" audioRate="48000" format="r0">\n'
            '      <media-rep kind="original-media" src="%s"/>\n    </asset>'
            % (i + 1, esc(c["name"]), i + 1, dur(sec), esc(file_url(os.path.join(dir_path, c["file"]))))
        )
        spine.append(
            '        <asset-clip ref="a%d" offset="%s" name="%s" start="0s" duration="%s" format="r0" tcFormat="NDF"/>'
            % (i + 1, at(off), esc(c["name"]), dur(sec))
        )
        off += sec
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE fcpxml>\n<fcpxml version="1.9">\n  <resources>\n'
        '    <format id="r0" name="FFVideoFormatRateUndefined" frameDuration="100/%ds" width="%d" height="%d"'
        ' colorSpace="1-1-1 (Rec. 709)"/>\n%s\n  </resources>\n  <library>\n    <event name="Moodio">\n'
        '      <project name="%s">\n        <sequence format="r0" duration="%s" tcStart="0s" tcFormat="NDF"'
        ' audioLayout="stereo" audioRate="48k">\n          <spine>\n%s\n          </spine>\n        </sequence>\n'
        "      </project>\n    </event>\n  </library>\n</fcpxml>"
        % (base, w, h, "\n".join(assets), esc(title), at(off), "\n".join(spine))
    )

# ---------- HTTP ----------
class Handler(BaseHTTPRequestHandler):
    server_version = "MoodioHelper/" + VERSION

    def log_message(self, fmt, *args):
        pass                                          # 自己打日志，不要默认的那一行

    def _cors(self):
        origin = self.headers.get("Origin", "")
        self.send_header("Access-Control-Allow-Origin", origin or "*")
        self.send_header("Vary", "Origin")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Access-Control-Max-Age", "86400")
        if self.headers.get("Access-Control-Request-Private-Network"):
            self.send_header("Access-Control-Allow-Private-Network", "true")   # https 页面访问本机要这个

    def _json(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self._cors()
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        self.send_response(204)
        self._cors()
        self.send_header("Content-Length", "0")
        self.end_headers()

    def do_GET(self):
        if not origin_ok(self.headers.get("Origin")):
            return self._json(403, {"error": "来源不被允许"})
        path = urlparse(self.path).path
        if path in ("/ping", "/"):
            return self._json(200, {
                "ok": True, "app": "moodio-helper", "version": VERSION,
                "resolveInstalled": resolve_installed(), "resolveRunning": resolve_app() is not None,
                "dir": self.server.work_dir,
            })
        return self._json(404, {"error": "没有这个接口"})

    def do_POST(self):
        if not origin_ok(self.headers.get("Origin")):
            return self._json(403, {"error": "来源不被允许"})
        url = urlparse(self.path)
        q = parse_qs(url.query)
        if url.path == "/file":
            return self._upload(q)
        if url.path == "/import":
            return self._import()
        return self._json(404, {"error": "没有这个接口"})

    def _job_dir(self, job):
        d = os.path.join(self.server.work_dir, safe_name(job, "未命名"))
        os.makedirs(d, exist_ok=True)
        return d

    def _upload(self, q):
        name = safe_name((q.get("name") or [""])[0])
        job = (q.get("job") or [""])[0]
        if not name or not job:
            return self._json(400, {"error": "缺少文件名或任务名"})
        size = int(self.headers.get("Content-Length") or 0)
        if size <= 0 or size > MAX_FILE:
            return self._json(413, {"error": "文件大小不合法"})
        target = os.path.join(self._job_dir(job), name)
        left, wrote = size, 0
        with open(target, "wb") as f:
            while left > 0:
                chunk = self.rfile.read(min(1024 * 512, left))
                if not chunk:
                    break
                f.write(chunk)
                left -= len(chunk)
                wrote += len(chunk)
        log("收到片段", name, "%.1f MB" % (wrote / 1048576.0))
        return self._json(200, {"ok": True, "name": name, "size": wrote})

    def _import(self):
        size = int(self.headers.get("Content-Length") or 0)
        try:
            data = json.loads(self.rfile.read(size).decode("utf-8"))
        except Exception:
            return self._json(400, {"error": "请求不是合法的 JSON"})
        title = str(data.get("title") or "Moodio 成片")
        clips = data.get("clips") or []
        audios = data.get("audios") or []
        subtitles = data.get("subtitles") or []
        job = data.get("job") or title
        if not clips:
            return self._json(400, {"error": "没有片段"})
        d = self._job_dir(job)
        missing = [c["file"] for c in clips if not os.path.exists(os.path.join(d, safe_name(c["file"])))]
        if missing:
            return self._json(400, {"error": "这些片段还没传上来：" + "、".join(missing)})
        for c in clips:
            c["file"] = safe_name(c["file"])
        audios = [a for a in audios if os.path.exists(os.path.join(d, safe_name(a.get("file", ""))))]
        for a in audios:
            a["file"] = safe_name(a["file"])
        srt_path = ""
        if subtitles:
            srt_path = os.path.join(d, safe_name(title) + ".srt")
            with open(srt_path, "w", encoding="utf-8") as f:
                f.write(build_srt(subtitles))
            log("生成字幕", srt_path)
        app, proj, err = open_project(safe_name(title))
        if err:
            log("失败", err)
            return self._json(500, {"ok": False, "message": err, "dir": d})
        # 同一条成片导第二次就叫「… 2」，否则达芬奇会因时间线重名拒绝
        def make_xml(name):
            path = os.path.join(d, safe_name(name) + ".fcpxml")
            with open(path, "w", encoding="utf-8") as f:
                f.write(build_fcpxml(name, clips, d))
            log("生成工程", path)
            return path
        ok, msg = import_to_resolve(app, proj, make_xml, title)
        if ok and audios:
            tl = proj.GetCurrentTimeline()
            fps = float(tl.GetSetting("timelineFrameRate") or 30)
            n = place_audio(proj, tl, d, audios, fps)
            if n:
                msg += "；配乐 / 配音 %d 条已各占一条音轨" % n
        if ok and srt_path:
            try:
                proj.GetMediaPool().ImportMedia([srt_path])     # 达芬奇的脚本接口不能把字幕放上字幕轨，只能先进媒体池
                msg += "；字幕在媒体池里，拖到字幕轨即可"
            except Exception:
                msg += "；字幕文件是 " + os.path.basename(srt_path)
        log(("成功 " if ok else "失败 ") + msg)
        return self._json(200 if ok else 500, {"ok": ok, "message": msg, "dir": d, "srt": srt_path})

def main():
    ap = argparse.ArgumentParser(description="Moodio 本地助手：把成片一键送进达芬奇")
    ap.add_argument("--port", type=int, default=DEFAULT_PORT)
    ap.add_argument("--dir", default=DEFAULT_DIR, help="片段存放位置，默认 ~/Movies/Moodio")
    args = ap.parse_args()
    work = os.path.abspath(os.path.expanduser(args.dir))
    os.makedirs(work, exist_ok=True)
    srv = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    srv.work_dir = work
    log("Moodio 助手 %s 已启动" % VERSION)
    log("监听 http://127.0.0.1:%d（只接受本机请求）" % args.port)
    log("片段存放在", work)
    log("达芬奇：" + ("已安装" if resolve_installed() else "没找到，装了达芬奇才能一键导入"))
    log("现在回到 Moodio 页面，点视频上的导出按钮即可。按 Control-C 退出。")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        log("已退出")
if __name__ == "__main__":
    main()
