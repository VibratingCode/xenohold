// Xenohold launcher: a small window with the logo, what's new, a windowed/fullscreen choice and a Play button.
// Play opens index.html (next to the exe) in Firefox (its own profile, a plain window; --kiosk for fullscreen), or in a
// borderless Chrome or Edge app window when Firefox is not installed, then the launcher closes.
// Map editor starts XenoholdEditor.exe (tools/editor).
//   Xenohold.exe --play            skip the launcher and start the game
//   Xenohold.exe --test            start the game windowed and muted (for checking a build)
//   Xenohold.exe --snapshot a.png  draw the launcher to an image and exit (for checking the look)
// Build: tools\launcher\build.ps1 (uses the C# 5 compiler that ships with Windows, so no newer C# syntax here)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

static class Launcher
{
    [STAThread]
    static void Main(string[] args)
    {
        string dir = AppDomain.CurrentDomain.BaseDirectory;
        if (!File.Exists(Path.Combine(dir, "index.html")))
        {
            MessageBox.Show("Could not find index.html next to Xenohold.exe.\nKeep the exe in the game folder.", "Xenohold", MessageBoxButtons.OK, MessageBoxIcon.Error);
            return;
        }
        if (args.Length > 0 && args[0] == "--play") { Game.Start(dir, Game.LoadFullscreen(dir)); return; }
        if (args.Length > 0 && args[0] == "--test") { Game.Start(dir, false, "?mute"); return; } // windowed and muted, for checking a build
        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        LauncherForm form = new LauncherForm(dir);
        if (args.Length > 1 && args[0] == "--snapshot") { form.Snapshot(args[1]); return; }
        Application.Run(form);
    }
}

static class Game
{

    // ---------------- Firefox (preferred when installed) ----------------
    public static string Firefox()
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
    public static string FirefoxProfile(string name)
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
    public static Process StartFirefox(string exe, string profile, string args, string url)
    {
        ProcessStartInfo psi = new ProcessStartInfo(exe, "-profile \"" + profile + "\" " + args + " \"" + url + "\"");
        psi.UseShellExecute = false;
        return Process.Start(psi);
    }
    public static string Browser()
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
    public static bool LoadFullscreen(string dir)
    {
        try { string f = Path.Combine(dir, "launcher.ini"); return File.Exists(f) && File.ReadAllText(f).Contains("fullscreen=1"); }
        catch { return false; }
    }
    public static void SaveFullscreen(string dir, bool on)
    {
        try { File.WriteAllText(Path.Combine(dir, "launcher.ini"), "fullscreen=" + (on ? "1" : "0") + "\r\n"); } catch { }
    }
    public static void Start(string dir, bool fullscreen) { Start(dir, fullscreen, ""); }
    public static void Start(string dir, bool fullscreen, string query)
    {
        string url = new Uri(Path.Combine(dir, "index.html")).AbsoluteUri + query;
        string fx = Firefox();
        if (fx != null) { StartFirefox(fx, FirefoxProfile("Firefox"), fullscreen ? "--kiosk" : "", url); return; }
        string exe = Browser();
        if (exe == null) { Process.Start(url); return; } // no Chrome or Edge: the default browser
        ProcessStartInfo psi = new ProcessStartInfo(exe, "--app=\"" + url + "\" " + (fullscreen ? "--start-fullscreen" : "--start-maximized") + " --autoplay-policy=no-user-gesture-required");
        psi.UseShellExecute = false;
        Process.Start(psi);
    }
}

class LauncherForm : Form
{
    const int W = 980, H = 580;
    readonly string dir;
    string version = "";
    readonly List<string[]> news = new List<string[]>(); // { headline, detail }
    readonly string browser;
    bool fullscreen;

    // layout
    Rectangle rPlay = new Rectangle(64, 356, 300, 62);
    Rectangle rMode = new Rectangle(64, 432, 190, 36);
    Rectangle rFolder = new Rectangle(262, 432, 102, 36);
    Rectangle rEditor = new Rectangle(64, 478, 300, 36);
    Rectangle rClose = new Rectangle(W - 46, 10, 34, 30);
    Rectangle rMin = new Rectangle(W - 84, 10, 34, 30);
    Rectangle rPanel = new Rectangle(560, 64, 380, 430);
    string hover = null, down = null;

    // drifting spores
    class Spore { public float x, y, vx, vy, r, a, ph; }
    readonly List<Spore> spores = new List<Spore>();
    readonly Random rnd = new Random(7);
    readonly Timer timer = new Timer();
    float t;
    bool leaving;

    static readonly Color Green = Color.FromArgb(125, 255, 154);
    static readonly Color Dim = Color.FromArgb(138, 150, 160);

    public LauncherForm(string dir)
    {
        this.dir = dir;
        Text = "Xenohold";
        FormBorderStyle = FormBorderStyle.None;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(W, H);
        BackColor = Color.FromArgb(8, 10, 13);
        DoubleBuffered = true;
        KeyPreview = true;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        fullscreen = Game.LoadFullscreen(dir);
        browser = Game.Firefox() ?? Game.Browser();
        ReadInfo();
        for (int i = 0; i < 70; i++) spores.Add(NewSpore(true));
        timer.Interval = 33;
        timer.Tick += delegate { Step(); };
        timer.Start();
    }

    protected override CreateParams CreateParams
    {
        get { CreateParams cp = base.CreateParams; cp.ClassStyle |= 0x20000; return cp; } // drop shadow
    }

    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int value, int size);
    [DllImport("user32.dll")] static extern bool ReleaseCapture();
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr hWnd, int msg, IntPtr wp, IntPtr lp);

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        try { int round = 2; DwmSetWindowAttribute(Handle, 33, ref round, 4); } catch { } // rounded corners on Windows 11
    }

    // ---------------- what's new and the version, read from the game files ----------------
    void ReadInfo()
    {
        try
        {
            Match m = Regex.Match(File.ReadAllText(Path.Combine(dir, "index.html")), "id=\"verline\">v([0-9.]+)<");
            if (m.Success) version = m.Groups[1].Value;
        }
        catch { }
        try
        {
            // top-level bullets of the newest "What's new" section, then the headlines of the one before if there is room
            string[] lines = File.ReadAllLines(Path.Combine(dir, "README.md"));
            int sections = 0, bullets = 0;
            for (int i = 0; i < lines.Length && bullets < 6; i++)
            {
                string raw = lines[i], line = raw.Trim();
                if (line.StartsWith("### What's new"))
                {
                    sections++; if (sections > 2) break;
                    if (sections == 2) news.Add(new string[] { "", "EARLIER  ·  V" + line.Replace("### What's new in", "").Trim() });
                    continue;
                }
                if (sections == 0) continue;
                if (line.StartsWith("#")) break;
                if (!raw.StartsWith("- ")) continue; // skip indented sub-points
                string b = line.Substring(2), head, rest;
                Match bold = Regex.Match(b, @"^\*\*(.+?)\*\*\s*(.*)$");
                if (bold.Success) { head = bold.Groups[1].Value; rest = bold.Groups[2].Value; }
                else { int dot = b.IndexOf(". "); head = dot > 0 ? b.Substring(0, dot) : b; rest = dot > 0 ? b.Substring(dot + 2) : ""; }
                head = Clean(head).TrimEnd('.', ':');
                if (head.Length > 64) head = head.Substring(0, 61).TrimEnd() + "…";
                rest = Clean(rest);
                if (rest.StartsWith("(")) { int close = rest.IndexOf(")"); if (close > 0) rest = rest.Substring(close + 1).TrimStart('.', ' '); }
                if (rest.Length == 0 && i + 1 < lines.Length && lines[i + 1].TrimStart().StartsWith("- ") && lines[i + 1].StartsWith(" ")) rest = Clean(lines[i + 1].Trim().Substring(2));
                int end = rest.IndexOf(". ");
                if (end > 0) rest = rest.Substring(0, end + 1);
                if (rest.Length > 110) { int cut = rest.LastIndexOf(' ', 104); rest = rest.Substring(0, cut > 60 ? cut : 104).TrimEnd(',', ';', ' ') + "…"; }
                if (rest.Length > 0) rest = char.ToUpper(rest[0]) + rest.Substring(1);
                if (sections == 2) rest = ""; // earlier versions: headline only
                news.Add(new string[] { head, rest });
                bullets++;
            }
        }
        catch { }
    }
    static string Clean(string s) { return s.Replace("**", "").Replace("`", "").Trim(); }

    // ---------------- animation ----------------
    Spore NewSpore(bool anywhere)
    {
        Spore s = new Spore();
        s.x = (float)rnd.NextDouble() * W;
        s.y = anywhere ? (float)rnd.NextDouble() * H : H + 10;
        s.vx = (float)(rnd.NextDouble() - 0.5) * 6f;
        s.vy = -(6f + (float)rnd.NextDouble() * 16f);
        s.r = 0.8f + (float)rnd.NextDouble() * 2.4f;
        s.a = 0.25f + (float)rnd.NextDouble() * 0.5f;
        s.ph = (float)rnd.NextDouble() * 6.28f;
        return s;
    }
    void Step()
    {
        float dt = 0.033f; t += dt;
        for (int i = 0; i < spores.Count; i++)
        {
            Spore s = spores[i];
            s.x += (s.vx + (float)Math.Sin(t * 0.8f + s.ph) * 4f) * dt; s.y += s.vy * dt;
            if (s.y < -10) spores[i] = NewSpore(false);
        }
        if (leaving) { Opacity -= 0.08; if (Opacity <= 0.05) { timer.Stop(); Close(); return; } }
        Invalidate();
    }

    // ---------------- painting ----------------
    static Font F(float size, FontStyle style, params string[] names)
    {
        foreach (string n in names)
            foreach (FontFamily f in FontFamily.Families)
                if (f.Name == n) return new Font(f, size, style, GraphicsUnit.Pixel);
        return new Font("Segoe UI", size, style, GraphicsUnit.Pixel);
    }
    readonly Font fTitle = F(78, FontStyle.Regular, "Bahnschrift SemiBold", "Bahnschrift", "Segoe UI Black");
    readonly Font fKicker = F(13, FontStyle.Regular, "Bahnschrift SemiBold", "Bahnschrift", "Segoe UI Semibold");
    readonly Font fSub = F(16, FontStyle.Regular, "Bahnschrift Light", "Bahnschrift", "Segoe UI");
    readonly Font fPlay = F(26, FontStyle.Regular, "Bahnschrift SemiBold", "Bahnschrift", "Segoe UI Semibold");
    readonly Font fBtn = F(13, FontStyle.Regular, "Bahnschrift SemiBold", "Bahnschrift", "Segoe UI Semibold");
    readonly Font fHead = F(15, FontStyle.Regular, "Bahnschrift SemiBold", "Bahnschrift", "Segoe UI Semibold");
    readonly Font fBody = F(13, FontStyle.Regular, "Segoe UI");
    readonly Font fSmall = F(12, FontStyle.Regular, "Segoe UI");

    static GraphicsPath Round(RectangleF r, float rad)
    {
        GraphicsPath p = new GraphicsPath(); float d = rad * 2;
        p.AddArc(r.X, r.Y, d, d, 180, 90); p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure(); return p;
    }
    // text with letter spacing, drawn character by character
    static float Spaced(Graphics g, string s, Font f, Brush b, float x, float y, float spacing)
    {
        StringFormat sf = StringFormat.GenericTypographic;
        foreach (char c in s)
        {
            string ch = c.ToString();
            g.DrawString(ch, f, b, x, y, sf);
            x += (c == ' ' ? f.Size * 0.32f : g.MeasureString(ch, f, 1000, sf).Width) + spacing;
        }
        return x;
    }
    static float SpacedWidth(Graphics g, string s, Font f, float spacing)
    {
        StringFormat sf = StringFormat.GenericTypographic; float w = 0;
        foreach (char c in s) w += (c == ' ' ? f.Size * 0.32f : g.MeasureString(c.ToString(), f, 1000, sf).Width) + spacing;
        return w - spacing;
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        Graphics g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;

        // background: dark gradient, a green bloom behind the logo, a faint hex grid, drifting spores
        using (LinearGradientBrush bg = new LinearGradientBrush(new Rectangle(0, 0, W, H), Color.FromArgb(6, 8, 11), Color.FromArgb(13, 18, 23), 90f)) g.FillRectangle(bg, 0, 0, W, H);
        using (GraphicsPath gp = new GraphicsPath())
        {
            gp.AddEllipse(-160, -40, 820, 640);
            using (PathGradientBrush pg = new PathGradientBrush(gp))
            {
                pg.CenterColor = Color.FromArgb(46 + (int)(Math.Sin(t * 0.9) * 8), 64, 255, 144);
                pg.SurroundColors = new Color[] { Color.FromArgb(0, 64, 255, 144) };
                g.FillPath(pg, gp);
            }
        }
        using (Pen hex = new Pen(Color.FromArgb(14, 125, 255, 154), 1f))
        {
            float hs = 26f, hh = hs * 1.732f;
            for (int row = -1; row < H / hh + 2; row++)
                for (int col = -1; col < W / (hs * 1.5f) + 2; col++)
                {
                    float cx = col * hs * 1.5f, cy = row * hh + ((col & 1) == 1 ? hh / 2 : 0);
                    if (cx < 520) continue; // only behind the right side
                    PointF[] pts = new PointF[6];
                    for (int k = 0; k < 6; k++) { double a = Math.PI / 3 * k; pts[k] = new PointF(cx + hs * (float)Math.Cos(a), cy + hs * (float)Math.Sin(a)); }
                    g.DrawPolygon(hex, pts);
                }
        }
        foreach (Spore s in spores)
        {
            int a = (int)(255 * s.a * (0.6 + 0.4 * Math.Sin(t * 2 + s.ph)));
            using (SolidBrush sb = new SolidBrush(Color.FromArgb(Math.Max(0, Math.Min(255, a)), 125, 255, 154))) g.FillEllipse(sb, s.x - s.r, s.y - s.r, s.r * 2, s.r * 2);
            using (SolidBrush halo = new SolidBrush(Color.FromArgb(Math.Max(0, Math.Min(255, a / 6)), 125, 255, 154))) g.FillEllipse(halo, s.x - s.r * 3, s.y - s.r * 3, s.r * 6, s.r * 6);
        }

        // emblem: the hex badge with the alien eye (as on the icon)
        DrawEmblem(g, 64, 70, 58);

        // title block
        using (SolidBrush kick = new SolidBrush(Green)) Spaced(g, "SURVIVE THE SWARM", fKicker, kick, 138, 86, 4.5f);
        using (SolidBrush dim = new SolidBrush(Dim)) g.DrawString("A round-based alien survival shooter", fSub, dim, 138, 108);
        // the title, with a soft green glow under it
        for (int k = 6; k >= 1; k--)
            using (SolidBrush glow = new SolidBrush(Color.FromArgb(10, 90, 255, 150)))
                for (int dx = -1; dx <= 1; dx++) Spaced(g, "XENOHOLD", fTitle, glow, 58 + dx * k, 168 + k * 0.4f, 7f);
        using (LinearGradientBrush tb = new LinearGradientBrush(new Rectangle(0, 170, 10, 80), Color.White, Color.FromArgb(190, 255, 214), 90f)) Spaced(g, "XENOHOLD", fTitle, tb, 58, 168, 7f);
        using (SolidBrush dim = new SolidBrush(Dim)) g.DrawString("Hold the line against a swarm that never stops coming. Seventeen arenas, bosses, secrets and a lot of guns.", fBody, dim, new RectangleF(64, 262, 440, 60));

        // Play
        bool hp = hover == "play" && !leaving, dp = down == "play";
        RectangleF rp = new RectangleF(rPlay.X, rPlay.Y + (dp ? 1 : 0), rPlay.Width, rPlay.Height);
        if (hp) for (int k = 1; k <= 4; k++) using (GraphicsPath gl = Round(new RectangleF(rp.X - k * 2, rp.Y - k * 2, rp.Width + k * 4, rp.Height + k * 4), 8 + k * 2)) using (Pen pg = new Pen(Color.FromArgb(28 - k * 5, 125, 255, 154), 2)) g.DrawPath(pg, gl);
        using (GraphicsPath pp = Round(rp, 8))
        {
            using (LinearGradientBrush fill = new LinearGradientBrush(rPlay, hp ? Color.FromArgb(64, 190, 110) : Color.FromArgb(34, 120, 70), hp ? Color.FromArgb(26, 110, 62) : Color.FromArgb(16, 70, 40), 90f)) g.FillPath(fill, pp);
            using (Pen border = new Pen(hp ? Color.FromArgb(200, 255, 220) : Green, 1.6f)) g.DrawPath(border, pp);
        }
        using (SolidBrush white = new SolidBrush(Color.White))
        {
            float w = SpacedWidth(g, "PLAY", fPlay, 8f) + 26;
            float x0 = rp.X + (rp.Width - w) / 2, y0 = rp.Y + (rp.Height - fPlay.Height) / 2 + 2;
            // a play triangle, then the word
            g.FillPolygon(white, new PointF[] { new PointF(x0, y0 + 5), new PointF(x0 + 15, y0 + 14), new PointF(x0, y0 + 23) });
            Spaced(g, "PLAY", fPlay, white, x0 + 26, y0, 8f);
        }

        // windowed / fullscreen switch and the folder button
        DrawButton(g, rMode, "", hover == "mode");
        using (SolidBrush lb = new SolidBrush(Color.FromArgb(215, 225, 232))) g.DrawString("Fullscreen", fBtn, lb, rMode.X + 14, rMode.Y + 10);
        RectangleF sw = new RectangleF(rMode.Right - 56, rMode.Y + 9, 42, 18);
        using (GraphicsPath sp = Round(sw, 9))
        {
            using (SolidBrush sfill = new SolidBrush(fullscreen ? Color.FromArgb(40, 150, 86) : Color.FromArgb(40, 46, 54))) g.FillPath(sfill, sp);
            using (Pen spen = new Pen(fullscreen ? Green : Color.FromArgb(80, 90, 100), 1.2f)) g.DrawPath(spen, sp);
        }
        using (SolidBrush knob = new SolidBrush(fullscreen ? Color.White : Color.FromArgb(150, 160, 170))) g.FillEllipse(knob, fullscreen ? sw.Right - 16 : sw.X + 2, sw.Y + 2, 14, 14);
        DrawButton(g, rFolder, "Game folder", hover == "folder");
        DrawButton(g, rEditor, "Map editor", hover == "editor");

        // what's new
        using (GraphicsPath panel = Round(rPanel, 10))
        {
            using (SolidBrush pb = new SolidBrush(Color.FromArgb(190, 10, 14, 18))) g.FillPath(pb, panel);
            using (Pen pen = new Pen(Color.FromArgb(60, 125, 255, 154), 1f)) g.DrawPath(pen, panel);
        }
        using (SolidBrush kick = new SolidBrush(Green)) Spaced(g, "WHAT'S NEW" + (version.Length > 0 ? "  ·  V" + version : ""), fKicker, kick, rPanel.X + 22, rPanel.Y + 22, 3.5f);
        using (Pen line = new Pen(Color.FromArgb(40, 125, 255, 154))) g.DrawLine(line, rPanel.X + 22, rPanel.Y + 48, rPanel.Right - 22, rPanel.Y + 48);
        float y = rPanel.Y + 64;
        using (SolidBrush head = new SolidBrush(Color.FromArgb(238, 244, 248)))
        using (SolidBrush body = new SolidBrush(Dim))
        using (SolidBrush dot = new SolidBrush(Green))
        {
            if (news.Count == 0) g.DrawString("See README.md for the full list of changes.", fBody, body, new RectangleF(rPanel.X + 22, y, rPanel.Width - 44, 60));
            float tw = rPanel.Width - 60;
            foreach (string[] n in news)
            {
                if (n[0].Length == 0) // a divider before the previous version's headlines
                {
                    if (y > rPanel.Bottom - 70) break;
                    y += 4;
                    using (SolidBrush kb = new SolidBrush(Color.FromArgb(150, 125, 255, 154))) Spaced(g, n[1], fKicker, kb, rPanel.X + 22, y, 3f);
                    y += 26; continue;
                }
                SizeF hs = g.MeasureString(n[0], fHead, (int)tw);
                SizeF bs = n[1].Length > 0 ? g.MeasureString(n[1], fBody, (int)tw) : SizeF.Empty;
                if (y + hs.Height + bs.Height > rPanel.Bottom - 16) break;
                g.FillRectangle(dot, rPanel.X + 22, y + 6, 6, 6);
                g.DrawString(n[0], fHead, head, new RectangleF(rPanel.X + 38, y, tw, hs.Height + 2));
                y += hs.Height + 1;
                if (n[1].Length > 0) { g.DrawString(n[1], fBody, body, new RectangleF(rPanel.X + 38, y, tw, bs.Height + 2)); y += bs.Height; }
                y += 12;
            }
        }

        // footer
        using (SolidBrush dim = new SolidBrush(Color.FromArgb(110, 120, 130)))
        {
            string bl = browser == null ? "" : browser.ToLower();
            string where = browser == null ? "No Firefox, Chrome or Edge found: the game opens in your default browser" : bl.Contains("firefox") ? "Runs in Firefox in a window of its own" : "Runs in " + (bl.Contains("msedge") ? "Microsoft Edge" : "Google Chrome") + " as an app window";
            g.DrawString((version.Length > 0 ? "v" + version + "   ·   " : "") + where, fSmall, dim, 64, H - 40);
            string keys = "Enter to play  ·  Esc to quit";
            g.DrawString(keys, fSmall, dim, W - 40 - g.MeasureString(keys, fSmall).Width, H - 40);
        }

        // window controls
        if (hover == "close") using (SolidBrush hb = new SolidBrush(Color.FromArgb(200, 180, 40, 40))) g.FillRectangle(hb, rClose);
        if (hover == "min") using (SolidBrush hb = new SolidBrush(Color.FromArgb(40, 255, 255, 255))) g.FillRectangle(hb, rMin);
        using (Pen cp = new Pen(Color.FromArgb(200, 210, 220), 1.4f))
        {
            int cx = rClose.X + rClose.Width / 2, cy = rClose.Y + rClose.Height / 2;
            g.DrawLine(cp, cx - 5, cy - 5, cx + 5, cy + 5); g.DrawLine(cp, cx + 5, cy - 5, cx - 5, cy + 5);
            int mx = rMin.X + rMin.Width / 2, my = rMin.Y + rMin.Height / 2;
            g.DrawLine(cp, mx - 6, my, mx + 6, my);
        }
        // a thin frame
        using (Pen frame = new Pen(Color.FromArgb(46, 125, 255, 154), 1f)) g.DrawRectangle(frame, 0, 0, W - 1, H - 1);
    }

    void DrawButton(Graphics g, Rectangle r, string text, bool hot)
    {
        using (GraphicsPath p = Round(r, 6))
        {
            using (SolidBrush b = new SolidBrush(hot ? Color.FromArgb(34, 42, 50) : Color.FromArgb(20, 25, 31))) g.FillPath(b, p);
            using (Pen pen = new Pen(hot ? Color.FromArgb(150, 125, 255, 154) : Color.FromArgb(56, 66, 76), 1f)) g.DrawPath(pen, p);
        }
        if (text.Length > 0)
            using (SolidBrush tb = new SolidBrush(Color.FromArgb(215, 225, 232)))
            {
                SizeF s = g.MeasureString(text, fBtn);
                g.DrawString(text, fBtn, tb, r.X + (r.Width - s.Width) / 2, r.Y + (r.Height - s.Height) / 2);
            }
    }

    void DrawEmblem(Graphics g, float x, float y, float size)
    {
        float cx = x + size / 2, cy = y + size / 2, R = size / 2;
        PointF[] hex = new PointF[6];
        for (int i = 0; i < 6; i++) { double a = Math.PI / 3 * i + Math.PI / 6; hex[i] = new PointF(cx + R * (float)Math.Cos(a), cy + R * (float)Math.Sin(a)); }
        using (SolidBrush b = new SolidBrush(Color.FromArgb(14, 18, 22))) g.FillPolygon(b, hex);
        using (Pen p = new Pen(Green, 2.4f)) g.DrawPolygon(p, hex);
        float pulse = 1f + (float)Math.Sin(t * 1.6) * 0.05f;
        for (float r = R * 0.62f; r > 0; r -= 2f)
        {
            int al = (int)(200 * (1 - r / (R * 0.62f))) + 20;
            using (SolidBrush eb = new SolidBrush(Color.FromArgb(Math.Min(255, al), 125, 255, 154))) g.FillEllipse(eb, cx - r * 1.3f * pulse, cy - r * 0.7f * pulse, r * 2.6f * pulse, r * 1.4f * pulse);
        }
        using (SolidBrush pupil = new SolidBrush(Color.FromArgb(10, 10, 10))) g.FillEllipse(pupil, cx - R * 0.1f, cy - R * 0.36f, R * 0.2f, R * 0.72f);
    }

    // ---------------- input ----------------
    string HitTest(Point p)
    {
        if (rPlay.Contains(p)) return "play";
        if (rMode.Contains(p)) return "mode";
        if (rFolder.Contains(p)) return "folder";
        if (rEditor.Contains(p)) return "editor";
        if (rClose.Contains(p)) return "close";
        if (rMin.Contains(p)) return "min";
        return null;
    }
    protected override void OnMouseMove(MouseEventArgs e)
    {
        string h = HitTest(e.Location);
        if (h != hover) { hover = h; Cursor = h != null ? Cursors.Hand : Cursors.Default; Invalidate(); }
    }
    protected override void OnMouseLeave(EventArgs e) { hover = null; Invalidate(); }
    protected override void OnMouseDown(MouseEventArgs e)
    {
        if (e.Button != MouseButtons.Left) return;
        down = HitTest(e.Location);
        if (down == null) { ReleaseCapture(); SendMessage(Handle, 0xA1, (IntPtr)2, IntPtr.Zero); return; } // drag the window
        Invalidate();
    }
    protected override void OnMouseUp(MouseEventArgs e)
    {
        string h = HitTest(e.Location), d = down; down = null; Invalidate();
        if (h == null || h != d) return;
        if (h == "play") Play();
        else if (h == "mode") { fullscreen = !fullscreen; Game.SaveFullscreen(dir, fullscreen); }
        else if (h == "editor") { OpenEditor(); }
        else if (h == "folder") { try { Process.Start("explorer.exe", "\"" + dir.TrimEnd('\\') + "\""); } catch { } }
        else if (h == "close") Close();
        else if (h == "min") WindowState = FormWindowState.Minimized;
    }
    protected override void OnKeyDown(KeyEventArgs e)
    {
        if (e.KeyCode == Keys.Enter || e.KeyCode == Keys.Space) Play();
        else if (e.KeyCode == Keys.Escape) Close();
    }
    void OpenEditor()
    {
        string exe = Path.Combine(dir, "XenoholdEditor.exe");
        if (!File.Exists(exe)) { MessageBox.Show("XenoholdEditor.exe is missing from the game folder.", "Xenohold", MessageBoxButtons.OK, MessageBoxIcon.Information); return; }
        try { Process.Start(exe); Close(); } catch { }
    }
    void Play()
    {
        if (leaving) return;
        leaving = true;
        try { Game.Start(dir, fullscreen); }
        catch (Exception ex) { leaving = false; MessageBox.Show("Could not start the game:\n" + ex.Message, "Xenohold", MessageBoxButtons.OK, MessageBoxIcon.Error); }
    }

    // draw the launcher into a PNG without showing it (to check the look)
    public void Snapshot(string path)
    {
        t = 1.2f;
        for (int i = 0; i < 20; i++) Step();
        using (Bitmap bmp = new Bitmap(W, H))
        {
            using (Graphics g = Graphics.FromImage(bmp)) OnPaint(new PaintEventArgs(g, new Rectangle(0, 0, W, H)));
            bmp.Save(path, System.Drawing.Imaging.ImageFormat.Png);
        }
        hover = "play";
        using (Bitmap bmp = new Bitmap(W, H))
        {
            using (Graphics g = Graphics.FromImage(bmp)) OnPaint(new PaintEventArgs(g, new Rectangle(0, 0, W, H)));
            bmp.Save(Path.ChangeExtension(path, null) + "-hover.png", System.Drawing.Imaging.ImageFormat.Png);
        }
    }
}
