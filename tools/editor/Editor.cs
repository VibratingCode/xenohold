// Xenohold map editor. Serves the game folder on 127.0.0.1 and opens the game page in editor mode (index.html?editor)
// in Firefox (a profile of its own), or a Chrome or Edge app window. The page saves through this server:
//   mapedits/<map>.json        one file per edited map (readable JSON)
//   mapedits/backup/           the previous version of a file, every time it is replaced or reverted
//   mapedits/_prefabs.json     saved groups of props, shared by every map
//   GET /api/gamemaps          the maps made in the game's own map maker (read from the game's Firefox profile)
//   js/mapedits.js             all the map files in one script, which the game loads (see js/edits.js)
// The server stops shortly after the editor window closes (the page pings it every few seconds).
//   XenoholdEditor.exe                     open the editor
//   XenoholdEditor.exe --serve [port]      only run the server, with the token "dev" (for testing)
// Build: tools\editor\build.ps1 (the C# 5 compiler that ships with Windows, so no newer C# syntax here)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

// built for .NET 4.8: modern path handling, so \\?\ paths get past the old 260-character limit (see LP)
[assembly: System.Runtime.Versioning.TargetFramework(".NETFramework,Version=v4.8", FrameworkDisplayName = ".NET Framework 4.8")]

static class EditorApp
{
    static string dir, token;
    static int port;
    static DateTime lastPing = DateTime.Now;
    static bool pinged;
    static readonly object fileLock = new object();

    [STAThread]
    static void Main(string[] args)
    {
        dir = AppDomain.CurrentDomain.BaseDirectory;
        if (!File.Exists(Path.Combine(dir, "index.html")))
        {
            MessageBox.Show("Could not find index.html next to XenoholdEditor.exe.\nKeep the exe in the game folder.", "Xenohold Editor", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        bool serveOnly = args.Length > 0 && args[0] == "--serve";
        token = serveOnly ? "dev" : Guid.NewGuid().ToString("N");
        int first = 8777;
        if (serveOnly && args.Length > 1) int.TryParse(args[1], out first);
        TcpListener listener = null;
        for (int p = first; p < first + 30 && listener == null; p++)
        {
            try { listener = new TcpListener(IPAddress.Loopback, p); listener.Start(); port = p; }
            catch { listener = null; }
        }
        if (listener == null)
        {
            MessageBox.Show("Could not open a local port for the editor.", "Xenohold Editor", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        Directory.CreateDirectory(Path.Combine(dir, "mapedits"));
        Thread t = new Thread(delegate () { Accept(listener); });
        t.IsBackground = true;
        t.Start();
        string url = "http://127.0.0.1:" + port + "/index.html?editor&token=" + token;
        if (serveOnly) { while (true) Thread.Sleep(60000); }
        DateTime started = DateTime.Now;
        Process browser = Launch(url);
        // Stay up while the editor window is open. The browser runs on its own profile, so its process lives exactly as
        // long as the window, and closing the window ends the editor. If an editor window was already open the new
        // process hands over and quits at once; then the page's pings decide (a minimised window pings as rarely as
        // once a minute, so allow a few minutes).
        bool handedOver = false;
        while (true)
        {
            Thread.Sleep(1000);
            if (browser != null && !handedOver)
            {
                bool exited = true;
                try { exited = browser.HasExited; } catch { }
                if (!exited) continue;
                if ((DateTime.Now - started).TotalSeconds > 8) break;
                handedOver = true;
            }
            double idle = (DateTime.Now - lastPing).TotalSeconds;
            if ((pinged && idle > 200) || (!pinged && idle > 240)) break;
        }
        listener.Stop();
    }

    // ---------------- Firefox (preferred when installed) ----------------
    static string Firefox()
    {
        string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] list = { Path.Combine(pf, @"Mozilla Firefox\firefox.exe"), Path.Combine(pf86, @"Mozilla Firefox\firefox.exe"), Path.Combine(local, @"Mozilla Firefox\firefox.exe") };
        foreach (string exe in list) if (File.Exists(exe)) return exe;
        try
        {
            object v = Microsoft.Win32.Registry.GetValue(@"HKEY_LOCAL_MACHINE\SOFTWARE\Microsoft\Windows\CurrentVersion\App Paths\firefox.exe", "", null);
            if (v is string && File.Exists((string)v)) return (string)v;
        }
        catch { }
        return null;
    }
    // A Firefox profile of its own (%LOCALAPPDATA%\Xenohold\<name>): a plain window with no tabs or address bar,
    // sound allowed without a click, no first-run pages. Its settings are rewritten every launch.
    static string FirefoxProfile(string name)
    {
        string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Xenohold\" + name);
        try
        {
            Directory.CreateDirectory(Path.Combine(dir, "chrome"));
            string[] prefs = {
                "toolkit.legacyUserProfileCustomizations.stylesheets\", true", "browser.tabs.inTitlebar\", 0",
                "browser.shell.checkDefaultBrowser\", false", "browser.startup.homepage_override.mstone\", \"ignore\"",
                "startup.homepage_welcome_url\", \"\"", "startup.homepage_welcome_url.additional\", \"\"", "startup.homepage_override_url\", \"\"",
                "browser.aboutwelcome.enabled\", false", "browser.startup.page\", 0", "browser.startup.homepage\", \"about:blank\"",
                "datareporting.policy.dataSubmissionPolicyBypassNotification\", true", "datareporting.policy.firstRunURL\", \"\"",
                "toolkit.telemetry.reportingpolicy.firstRun\", false", "browser.tabs.warnOnClose\", false", "browser.warnOnQuit\", false",
                "browser.sessionstore.resume_from_crash\", false", "media.autoplay.default\", 0", "media.autoplay.blocking_policy\", 0",
                "full-screen-api.warning.timeout\", 0", "full-screen-api.transition-duration.enter\", \"0 0\"", "full-screen-api.transition-duration.leave\", \"0 0\"",
                "browser.translations.automaticallyPopup\", false", "extensions.pocket.enabled\", false", "browser.vpn_promo.enabled\", false",
                "browser.download.useDownloadDir\", true", "browser.link.open_newwindow\", 2",
                // every local file shares one storage, so saves survive the game folder moving (as in Chrome and Edge)
                "security.fileuri.strict_origin_policy\", false",
            };
            StringBuilder sb = new StringBuilder("// Written by Xenohold: settings for its own Firefox window.\r\n");
            foreach (string p in prefs) sb.Append("user_pref(\"").Append(p).Append(");\r\n");
            File.WriteAllText(Path.Combine(dir, "user.js"), sb.ToString());
            File.WriteAllText(Path.Combine(dir, @"chrome\userChrome.css"),
                "/* Written by Xenohold: no tabs, address bar or sidebar in its window */\r\n" +
                "#TabsToolbar, #nav-bar, #PersonalToolbar, #sidebar-box, #sidebar-main, #sidebar-launcher-splitter, #notifications-toolbar { visibility: collapse !important; }\r\n");
            string xul = Path.Combine(dir, "xulstore.json");
            if (!File.Exists(xul)) File.WriteAllText(xul, "{\"chrome://browser/content/browser.xhtml\":{\"main-window\":{\"sizemode\":\"maximized\",\"screenX\":\"0\",\"screenY\":\"0\",\"width\":\"1600\",\"height\":\"900\"}}}");
        }
        catch { }
        return dir;
    }
    // args: extra Firefox arguments before the URL (e.g. --kiosk)
    static Process StartFirefox(string exe, string profile, string args, string url)
    {
        ProcessStartInfo psi = new ProcessStartInfo(exe, "-profile \"" + profile + "\" " + args + " \"" + url + "\"");
        psi.UseShellExecute = false;
        return Process.Start(psi);
    }

    static string Browser()
    {
        string pf = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFiles);
        string pf86 = Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86);
        string local = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string[] list = {
            Path.Combine(pf, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(local, @"Google\Chrome\Application\chrome.exe"),
            Path.Combine(pf86, @"Microsoft\Edge\Application\msedge.exe"),
            Path.Combine(pf, @"Microsoft\Edge\Application\msedge.exe"),
        };
        foreach (string exe in list) if (File.Exists(exe)) return exe;
        return null;
    }

    static Process Launch(string url)
    {
        string fx = Firefox();
        // -wait-for-browser: the process lives as long as the editor window (Firefox otherwise hands over and quits)
        if (fx != null) return StartFirefox(fx, FirefoxProfile("FirefoxEditor"), "-wait-for-browser", url);
        string exe = Browser();
        if (exe == null) { Process.Start(url); return null; }
        // its own browser profile: the editor window is separate from the player's browser and game saves
        string prof = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Xenohold\EditorProfile");
        try { Directory.CreateDirectory(prof); } catch { }
        ProcessStartInfo psi = new ProcessStartInfo(exe, "--app=\"" + url + "\" --user-data-dir=\"" + prof + "\" --start-maximized --no-first-run --no-default-browser-check");
        psi.UseShellExecute = false;
        return Process.Start(psi);
    }

    // ---------------- a small HTTP/1.1 server (one request per connection) ----------------
    static void Accept(TcpListener l)
    {
        while (true)
        {
            TcpClient c;
            try { c = l.AcceptTcpClient(); } catch { return; }
            ThreadPool.QueueUserWorkItem(delegate (object o) { Handle((TcpClient)o); }, c);
        }
    }

    static void Handle(TcpClient c)
    {
        try
        {
            using (c)
            using (NetworkStream s = c.GetStream())
            {
                s.ReadTimeout = 15000;
                MemoryStream head = new MemoryStream();
                while (true)
                {
                    int b = s.ReadByte();
                    if (b < 0) return;
                    head.WriteByte((byte)b);
                    long n = head.Length;
                    if (n > 65536) return;
                    if (n >= 4)
                    {
                        byte[] h = head.GetBuffer();
                        if (h[n - 4] == 13 && h[n - 3] == 10 && h[n - 2] == 13 && h[n - 1] == 10) break;
                    }
                }
                string[] lines = Encoding.ASCII.GetString(head.ToArray()).Split(new string[] { "\r\n" }, StringSplitOptions.None);
                string[] req = lines[0].Split(' ');
                if (req.Length < 2) return;
                Dictionary<string, string> hdr = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                for (int i = 1; i < lines.Length; i++)
                {
                    int k = lines[i].IndexOf(':');
                    if (k > 0) hdr[lines[i].Substring(0, k).Trim()] = lines[i].Substring(k + 1).Trim();
                }
                byte[] body = new byte[0];
                string cl;
                if (hdr.TryGetValue("Content-Length", out cl))
                {
                    int len = int.Parse(cl);
                    if (len < 0 || len > 64 * 1024 * 1024) { Send(s, 413, "text/plain", "Too large"); return; }
                    body = new byte[len];
                    int got = 0;
                    while (got < len) { int r = s.Read(body, got, len - got); if (r <= 0) break; got += r; }
                }
                Route(s, req[0], req[1], hdr, body);
            }
        }
        catch { }
    }

    static void Route(Stream s, string method, string target, Dictionary<string, string> hdr, byte[] body)
    {
        string path = target, query = "";
        int q = target.IndexOf('?');
        if (q >= 0) { path = target.Substring(0, q); query = target.Substring(q + 1); }
        path = Uri.UnescapeDataString(path);
        if (path.StartsWith("/api/"))
        {
            string tk;
            if (!hdr.TryGetValue("X-Token", out tk) || tk != token) { Send(s, 403, "text/plain", "Bad token"); return; }
            string map = Param(query, "map");
            if (path == "/api/ping") { lastPing = DateTime.Now; pinged = true; Send(s, 200, "application/json", "{\"ok\":true}"); return; }
            if (path == "/api/gamemaps") { Send(s, 200, "application/json", GameMaps()); return; }
            if (method != "POST") { Send(s, 405, "text/plain", "POST only"); return; }
            try
            {
                if (path == "/api/save" && ValidId(map))
                {
                    string text = Encoding.UTF8.GetString(body);
                    CleanJson(text); // it must parse; the file keeps the page's readable layout
                    lock (fileLock) { Backup(map); WriteAtomic(LP(Path.Combine(dir, "mapedits", map + ".json")), text); Rebuild(); }
                    Send(s, 200, "application/json", "{\"ok\":true}");
                    return;
                }
                if (path == "/api/revert" && ValidId(map))
                {
                    lock (fileLock)
                    {
                        Backup(map);
                        string f = LP(Path.Combine(dir, "mapedits", map + ".json"));
                        if (File.Exists(f)) File.Delete(f);
                        Rebuild();
                    }
                    Send(s, 200, "application/json", "{\"ok\":true}");
                    return;
                }
                if (path == "/api/prefabs")
                {
                    string text = Encoding.UTF8.GetString(body);
                    CleanJson(text);
                    lock (fileLock) { Backup("_prefabs"); WriteAtomic(LP(Path.Combine(dir, "mapedits", "_prefabs.json")), text); }
                    Send(s, 200, "application/json", "{\"ok\":true}");
                    return;
                }
            }
            catch (Exception e) { Send(s, 400, "text/plain", "Could not save: " + e.Message); return; }
            Send(s, 404, "text/plain", "Unknown request");
            return;
        }
        if (method != "GET" && method != "HEAD") { Send(s, 405, "text/plain", "GET only"); return; }
        // files from the game folder, and nothing outside it
        string root = Path.GetFullPath(dir);
        string rel = path.TrimStart('/').Replace('/', Path.DirectorySeparatorChar);
        if (rel.Length == 0) rel = "index.html";
        string full;
        try { full = Path.GetFullPath(Path.Combine(root, rel)); } catch { Send(s, 400, "text/plain", "Bad path"); return; }
        if (!full.StartsWith(root, StringComparison.OrdinalIgnoreCase) || !File.Exists(LP(full))) { Send(s, 404, "text/plain", "Not found"); return; }
        byte[] data;
        try { lock (fileLock) data = File.ReadAllBytes(LP(full)); } catch { Send(s, 500, "text/plain", "Could not read"); return; }
        Send(s, 200, Mime(full), data, method == "HEAD");
    }

    static string Param(string query, string name)
    {
        foreach (string kv in query.Split('&'))
        {
            int e = kv.IndexOf('=');
            if (e > 0 && kv.Substring(0, e) == name) return Uri.UnescapeDataString(kv.Substring(e + 1));
        }
        return null;
    }

    static bool ValidId(string id) { return id != null && Regex.IsMatch(id, "^[a-z0-9_]{1,40}$") && !id.StartsWith("_"); }

    // parse and write back: only plain JSON data ever reaches the game's script file
    static string CleanJson(string text)
    {
        JavaScriptSerializer js = new JavaScriptSerializer();
        js.MaxJsonLength = int.MaxValue;
        js.RecursionLimit = 256;
        object o = js.DeserializeObject(text);
        if (!(o is Dictionary<string, object>) && !(o is object[])) throw new Exception("not a JSON object");
        return js.Serialize(o);
    }

    static void Backup(string id)
    {
        string f = LP(Path.Combine(dir, "mapedits", id + ".json"));
        if (!File.Exists(f)) return;
        string bdir = LP(Path.Combine(dir, @"mapedits\backup"));
        Directory.CreateDirectory(bdir);
        File.Copy(f, LP(Path.Combine(bdir, id + "-" + DateTime.Now.ToString("yyyyMMdd-HHmmss") + ".json")), true);
        // keep the newest 20 of each
        List<string> old = new List<string>(Directory.GetFiles(bdir, id + "-*.json"));
        old.Sort(StringComparer.Ordinal);
        for (int i = 0; i < old.Count - 20; i++) { try { File.Delete(LP(old[i])); } catch { } }
    }

    // js/mapedits.js: every map file in one script for the game
    static void Rebuild()
    {
        StringBuilder sb = new StringBuilder();
        sb.Append("// Written by the map editor (XenoholdEditor.exe) from mapedits/*.json. Hand edits to the maps, applied by js/edits.js.\n");
        sb.Append("XH.MAPEDITS = {\n");
        string[] files = Directory.GetFiles(LP(Path.Combine(dir, "mapedits")), "*.json");
        Array.Sort(files, StringComparer.Ordinal);
        foreach (string f in files)
        {
            string id = Path.GetFileNameWithoutExtension(f);
            if (!ValidId(id)) continue;
            string json;
            try { json = CleanJson(File.ReadAllText(LP(f), Encoding.UTF8)); } catch { continue; }
            sb.Append("  \"").Append(id).Append("\": ").Append(json).Append(",\n");
        }
        sb.Append("};\n");
        WriteAtomic(LP(Path.Combine(dir, @"js\mapedits.js")), sb.ToString());
    }

    // a path Windows takes at any length (the \\?\ form skips the old 260-character limit)
    static string LP(string p)
    {
        if (p.Length < 240 || p.StartsWith(@"\\?\")) return p;
        return p.StartsWith(@"\\") ? @"\\?\UNC\" + p.Substring(2) : @"\\?\" + p;
    }

    static void WriteAtomic(string file, string text)
    {
        string tmp = LP(file + ".tmp"); file = LP(file);
        File.WriteAllText(tmp, text, new UTF8Encoding(false));
        if (File.Exists(file)) File.Delete(file);
        File.Move(tmp, file);
    }

    // ---------------- maps from the game's own map maker ----------------
    // The game's map maker (main menu > Map Editor) keeps its maps in the browser: localStorage "xenohold.customMaps" of
    // the game's Firefox profile. Firefox keeps that in a SQLite file per origin (values UTF-8, mostly Snappy-compressed);
    // Windows ships SQLite as winsqlite3.dll. The file is copied first, so a running game is never disturbed.
    const string LsKey = "xenohold.customMaps";
    static string GameMaps()
    {
        List<string> found = new List<string>();
        string profile = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), @"Xenohold\Firefox\storage\default");
        try
        {
            if (Directory.Exists(profile))
                foreach (string origin in Directory.GetDirectories(profile, "file*"))
                {
                    string db = Path.Combine(origin, @"ls\data.sqlite");
                    if (!File.Exists(db)) continue;
                    string json = ReadLocalStorage(db, LsKey);
                    if (json == null) continue;
                    try { CleanJson(json); } catch { continue; }
                    found.Add(json);
                }
        }
        catch { }
        // the first list found (there is only one file origin), as { maps: [...] }
        return "{\"maps\":" + (found.Count > 0 ? found[0] : "[]") + ",\"profile\":" + (Directory.Exists(profile) ? "true" : "false") + "}";
    }

    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)] static extern int sqlite3_open_v2(byte[] filename, out IntPtr db, int flags, IntPtr vfs);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)] static extern int sqlite3_prepare_v2(IntPtr db, byte[] sql, int nByte, out IntPtr stmt, IntPtr tail);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)] static extern int sqlite3_step(IntPtr stmt);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)] static extern IntPtr sqlite3_column_blob(IntPtr stmt, int col);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)] static extern int sqlite3_column_bytes(IntPtr stmt, int col);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)] static extern int sqlite3_column_int(IntPtr stmt, int col);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)] static extern int sqlite3_finalize(IntPtr stmt);
    [DllImport("winsqlite3.dll", CallingConvention = CallingConvention.StdCall)] static extern int sqlite3_close(IntPtr db);
    static byte[] Z(string s) { return Encoding.UTF8.GetBytes(s + "\0"); }

    static string ReadLocalStorage(string dbFile, string key)
    {
        string tmp = Path.Combine(Path.GetTempPath(), "xenohold-ls-" + Guid.NewGuid().ToString("N") + ".sqlite");
        IntPtr db = IntPtr.Zero, st = IntPtr.Zero;
        try
        {
            using (FileStream src = new FileStream(dbFile, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            using (FileStream dst = File.Create(tmp)) src.CopyTo(dst);
            if (sqlite3_open_v2(Z(tmp), out db, 1 /* read only */, IntPtr.Zero) != 0) return null;
            if (sqlite3_prepare_v2(db, Z("SELECT value, conversion_type, compression_type FROM data WHERE key = '" + key.Replace("'", "''") + "'"), -1, out st, IntPtr.Zero) != 0) return null;
            if (sqlite3_step(st) != 100 /* a row */) return null;
            int n = sqlite3_column_bytes(st, 0);
            byte[] v = new byte[n];
            if (n > 0) Marshal.Copy(sqlite3_column_blob(st, 0), v, 0, n);
            int conversion = sqlite3_column_int(st, 1), compression = sqlite3_column_int(st, 2);
            if (compression == 1) v = Unsnappy(v);
            return conversion == 1 ? Encoding.UTF8.GetString(v) : Encoding.Unicode.GetString(v);
        }
        catch { return null; }
        finally
        {
            if (st != IntPtr.Zero) sqlite3_finalize(st);
            if (db != IntPtr.Zero) sqlite3_close(db);
            try { File.Delete(tmp); } catch { }
        }
    }

    // Snappy (raw block format): a varint length, then literals and back-references
    static byte[] Unsnappy(byte[] src)
    {
        int p = 0, shift = 0; long len = 0;
        while (true) { byte b = src[p++]; len |= (long)(b & 0x7f) << shift; if (b < 0x80) break; shift += 7; }
        byte[] dst = new byte[len];
        int d = 0;
        while (p < src.Length)
        {
            int tag = src[p++], kind = tag & 3;
            if (kind == 0)
            {
                int n = tag >> 2;
                if (n >= 60) { int nb = n - 59; n = 0; for (int i = 0; i < nb; i++) n |= src[p++] << (8 * i); }
                n += 1;
                Buffer.BlockCopy(src, p, dst, d, n); p += n; d += n;
                continue;
            }
            int count, off;
            if (kind == 1) { count = ((tag >> 2) & 7) + 4; off = ((tag >> 5) << 8) | src[p++]; }
            else if (kind == 2) { count = (tag >> 2) + 1; off = src[p] | (src[p + 1] << 8); p += 2; }
            else { count = (tag >> 2) + 1; off = src[p] | (src[p + 1] << 8) | (src[p + 2] << 16) | (src[p + 3] << 24); p += 4; }
            if (off <= 0 || off > d) throw new Exception("bad snappy data");
            for (int i = 0; i < count; i++, d++) dst[d] = dst[d - off];
        }
        return dst;
    }

    static string Mime(string f)
    {
        switch (Path.GetExtension(f).ToLowerInvariant())
        {
            case ".html": return "text/html; charset=utf-8";
            case ".js": return "application/javascript; charset=utf-8";
            case ".css": return "text/css; charset=utf-8";
            case ".json": return "application/json; charset=utf-8";
            case ".md": case ".txt": return "text/plain; charset=utf-8";
            case ".png": return "image/png";
            case ".jpg": case ".jpeg": return "image/jpeg";
            case ".svg": return "image/svg+xml";
            case ".ico": return "image/x-icon";
            case ".woff2": return "font/woff2";
            case ".ogg": return "audio/ogg";
            case ".mp3": return "audio/mpeg";
            case ".wav": return "audio/wav";
            default: return "application/octet-stream";
        }
    }

    static void Send(Stream s, int code, string type, string text) { Send(s, code, type, Encoding.UTF8.GetBytes(text), false); }

    static void Send(Stream s, int code, string type, byte[] data, bool headOnly)
    {
        string reason = code == 200 ? "OK" : code == 400 ? "Bad Request" : code == 403 ? "Forbidden" : code == 404 ? "Not Found" : code == 405 ? "Method Not Allowed" : code == 413 ? "Payload Too Large" : "Error";
        string head = "HTTP/1.1 " + code + " " + reason + "\r\nContent-Type: " + type + "\r\nContent-Length: " + data.Length + "\r\nCache-Control: no-store\r\nConnection: close\r\n\r\n";
        byte[] hb = Encoding.ASCII.GetBytes(head);
        s.Write(hb, 0, hb.Length);
        if (!headOnly) s.Write(data, 0, data.Length);
        s.Flush();
    }
}
