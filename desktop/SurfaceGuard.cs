using System;
using System.Collections;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Threading;
using System.Web.Script.Serialization;

// Deliberately independent of shape sequence: repeated unverified animation
// requests cannot indefinitely postpone containment of a silently bad region.
public sealed class WhaleSurfaceVerificationBudget {
    long startedAt, matchedAt; bool started, matched;
    public void Begin(long now) { startedAt=now; matchedAt=0; started=true; matched=false; }
    public void Observe(long now, bool verified) { if(!started)Begin(now);if(verified){matched=true;matchedAt=now;} }
    public bool Expired(long now) { return started && now-(matched?matchedAt:startedAt)>=1000; }
}

// One resident monitor per supervised Electron process. It never reads pixels,
// titles or user content. GetWindowRgn + EqualRgn compare the complete union,
// including holes between islands, rather than its misleading bounding box.
public sealed class WhaleSurfaceGuard : IDisposable {
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int left, top, right, bottom; }
    [DllImport("user32.dll")] static extern bool IsWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
    [DllImport("user32.dll")] static extern uint GetDpiForWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out Rect r);
    [DllImport("user32.dll")] static extern int GetWindowRgn(IntPtr h, IntPtr region);
    [DllImport("user32.dll")] static extern bool ShowWindowAsync(IntPtr h, int command);
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
    [DllImport("gdi32.dll")] static extern IntPtr CreateRectRgn(int l, int t, int r, int b);
    [DllImport("gdi32.dll")] static extern int CombineRgn(IntPtr result, IntPtr first, IntPtr second, int mode);
    [DllImport("gdi32.dll")] static extern bool EqualRgn(IntPtr first, IntPtr second);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr value);
    readonly Process child; readonly object gate = new object(); readonly Thread worker;
    readonly WhaleSurfaceVerificationBudget verificationBudget=new WhaleSurfaceVerificationBudget();
    volatile bool stopping; Dictionary<string, object> expected, report;
    long overlay; long receivedAt; long mismatchAt; long revocations; long heartbeat; bool quarantined;
    public long OverlayHandle { get { lock(gate) return overlay; } }
    public object Report { get { lock(gate) return report == null ? null : new Dictionary<string, object>(report); } }
    public long Heartbeat { get { return Interlocked.Read(ref heartbeat); } }
    static long Integer(object v) { double n = Convert.ToDouble(v); if (Double.IsNaN(n) || Double.IsInfinity(n) || Math.Truncate(n) != n || Math.Abs(n)>9007199254740991d) throw new ArgumentException(); return (long)n; }
    static long Number(Dictionary<string,object> d,string name) { return Integer(d[name]); }
    static long Milliseconds() { return Stopwatch.GetTimestamp()*1000/Stopwatch.Frequency; }
    bool Owned(IntPtr h) { uint pid; return h != IntPtr.Zero && IsWindow(h) && GetWindowThreadProcessId(h,out pid)!=0 && pid==child.Id; }
    public WhaleSurfaceGuard(Process process) {
        child=process; child.OutputDataReceived+=Output; child.BeginOutputReadLine();
        worker=new Thread(Loop) { IsBackground=true, Name="Whale native surface guard" }; worker.Start();
    }
    void Output(object sender, DataReceivedEventArgs e) {
        if (stopping || String.IsNullOrEmpty(e.Data) || e.Data.Length>20000) return;
        try {
            var d=new JavaScriptSerializer().Deserialize<Dictionary<string,object>>(e.Data);
            object value;
            if(d.TryGetValue("overlayHandle",out value)) { long h=Int64.Parse(Convert.ToString(value)); if(Owned(new IntPtr(h)))lock(gate)overlay=h; }
            if(!d.TryGetValue("surface",out value))return;
            var s=value as Dictionary<string,object>; if(s==null)return;
            long hwnd=Int64.Parse(Convert.ToString(s["handle"])); if(!Owned(new IntPtr(hwnd)))return;
            var instance=Convert.ToString(s["instance"]); if(instance.Length<8||instance.Length>80)return;
            long epoch=Number(s,"epoch"),seq=Number(s,"sequence"),width=Number(s,"width"),height=Number(s,"height");
            if(epoch<1||seq<1||width<1||height<1||width>32768||height>32768)return;
            var rects=s["rects"] as ArrayList; if(rects==null||rects.Count<1||rects.Count>64)return;
            foreach(var item in rects) { var r=item as Dictionary<string,object>;if(r==null)return;long x=Number(r,"x"),y=Number(r,"y"),w=Number(r,"width"),h=Number(r,"height");if(x<0||y<0||w<1||h<1||x+w>width||y+h>height)return; }
            lock(gate) {
                if(expected!=null && Convert.ToString(expected["instance"])==instance && (epoch<Number(expected,"epoch")||seq<=Number(expected,"sequence")))return;
                // A new animation frame, viewport epoch, or retry is not proof.
                if(expected==null || overlay!=hwnd || Convert.ToString(expected["instance"])!=instance)verificationBudget.Begin(Milliseconds());
                overlay=hwnd;expected=s;receivedAt=Milliseconds();mismatchAt=0;report=null;
            }
        } catch { }
    }
    Dictionary<string,object> Sample(Dictionary<string,object> s) {
        var answer=new Dictionary<string,object>(); foreach(var key in new[]{"instance","epoch","sequence","handle","width","height"})answer[key]=s[key];
        answer["ok"]=false; answer["reason"]="native-window-unavailable";
        var hwnd=new IntPtr(Int64.Parse(Convert.ToString(s["handle"])));if(!Owned(hwnd))return answer;
        answer["nativeVisible"]=IsWindowVisible(hwnd);
        Rect client;if(!GetClientRect(hwnd,out client))return answer;
        float scale=GetDpiForWindow(hwnd)/96f;if(scale<1||scale>8){answer["reason"]="native-dpi-unavailable";return answer;}
        answer["dpi"]=scale*96;answer["pixelWidth"]=client.right;answer["pixelHeight"]=client.bottom;
        if(Math.Abs(client.right-Number(s,"width")*scale)>1||Math.Abs(client.bottom-Number(s,"height")*scale)>1){answer["reason"]="native-viewport-mismatch";return answer;}
        var actual=CreateRectRgn(0,0,0,0);var wanted=CreateRectRgn(0,0,0,0);
        if(actual==IntPtr.Zero||wanted==IntPtr.Zero){if(actual!=IntPtr.Zero)DeleteObject(actual);if(wanted!=IntPtr.Zero)DeleteObject(wanted);return answer;}
        try {
            int kind=GetWindowRgn(hwnd,actual);answer["regionType"]=kind;
            if(kind<=1){answer["reason"]="native-region-missing";return answer;}
            foreach(Dictionary<string,object> r in (ArrayList)s["rects"]) {
                // Chromium DesktopWindowTreeHostWin uses float multiplication
                // and SkRect::roundOut, not independently rounded x/width.
                int x=(int)Math.Floor(Number(r,"x")*scale),y=(int)Math.Floor(Number(r,"y")*scale);
                int right=(int)Math.Ceiling((Number(r,"x")+Number(r,"width"))*scale),bottom=(int)Math.Ceiling((Number(r,"y")+Number(r,"height"))*scale);
                var part=CreateRectRgn(x,y,right,bottom);if(part==IntPtr.Zero)return answer;
                try { if(CombineRgn(wanted,wanted,part,2)==0)return answer; }finally{DeleteObject(part);}
            }
            bool equal=EqualRgn(actual,wanted);answer["ok"]=equal;answer["reason"]=equal?"verified":"native-region-mismatch";return answer;
        }finally{DeleteObject(actual);DeleteObject(wanted);}
    }
    void Quarantine(Dictionary<string,object> result) {
        if(!quarantined){quarantined=true;revocations++;}result["revocations"]=revocations;
        // Hiding removes the input surface too. Avoid cross-process style
        // changes: WM_STYLECHANGING can synchronously wait for a hung UI thread.
        var h=new IntPtr(overlay);if(Owned(h))ShowWindowAsync(h,0);
        report=result;
    }
    void Loop() {
        IntPtr previous=IntPtr.Zero;try{previous=SetThreadDpiAwarenessContext(new IntPtr(-4));}catch{}
        try { while(!stopping) {
            Dictionary<string,object> s;long seen;lock(gate){s=expected;seen=receivedAt;}
            if(s!=null)try {
                var result=Sample(s);Interlocked.Exchange(ref heartbeat,DateTimeOffset.UtcNow.ToUnixTimeMilliseconds());lock(gate){
                    long now=Milliseconds();bool ok=(bool)result["ok"], expired=false;
                    if(expected!=null && Convert.ToString(s["instance"])==Convert.ToString(expected["instance"]) && Convert.ToString(s["handle"])==Convert.ToString(expected["handle"])) {
                        verificationBudget.Observe(now,ok);
                        if(verificationBudget.Expired(now)) {
                            var overdue=new Dictionary<string,object>();foreach(var key in new[]{"instance","epoch","sequence","handle","width","height"})overdue[key]=expected[key];
                            overdue["ok"]=false;overdue["reason"]="native-verification-deadline";overdue["nativeVisible"]=IsWindowVisible(new IntPtr(overlay));
                            Quarantine(overdue);
                            expired=true;
                        }
                    }
                    if(!expired && Object.ReferenceEquals(s,expected)) {
                    if(ok){mismatchAt=0;quarantined=false;result["revocations"]=revocations;report=result;}
                    else {
                        if(mismatchAt==0)mismatchAt=now;
                        // stdout can lag a just-applied animation frame. Require
                        // a stable request before declaring a geometric mismatch.
                        bool missing=Convert.ToString(result["reason"])=="native-region-missing";
                        if(missing || (now-seen>=100 && now-mismatchAt>=100)) {
                            Quarantine(result);
                        }
                    }
                }}
            }catch{}
            Thread.Sleep(25);
        }}finally{if(previous!=IntPtr.Zero)SetThreadDpiAwarenessContext(previous);}
    }
    public void Dispose(){stopping=true;child.OutputDataReceived-=Output;try{child.CancelOutputRead();}catch{}worker.Join(1000);}
}
