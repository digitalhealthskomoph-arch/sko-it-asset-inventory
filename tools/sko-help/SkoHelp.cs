// SKO Help — "ขอความช่วยเหลือ IT" desktop app for staff PCs (Windows 10/11).
// The user picks department, name, issue type and describes the problem; the app creates a
// Windows Remote Assistance invitation and sends it with this PC's identity to the helpdesk
// system, which opens a repair ticket and notifies technicians.
//
// Written for the C# 5 compiler that ships with Windows (.NET Framework 4.x) — see build.cmd.
// No string interpolation, ?. or other C# 6+ syntax.

using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.IO;
using System.Management;
using System.Net;
using System.Net.NetworkInformation;
using System.Net.Sockets;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace SkoHelp
{
    static class Program
    {
        [STAThread]
        static void Main(string[] args)
        {
            // TLS 1.2 (value 3072) — required by Vercel; the enum name is missing on older .NET 4.0.
            ServicePointManager.SecurityProtocol = (SecurityProtocolType)3072;
            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new MainForm(Config.ServerUrl(args)));
        }
    }

    static class Config
    {
        const string DefaultServer = "https://sko-it-asset-inventory.vercel.app";

        // Server from "--server=https://..." or a SkoHelp.ini next to the exe ("server=https://...").
        public static string ServerUrl(string[] args)
        {
            foreach (string a in args)
            {
                if (a.StartsWith("--server=", StringComparison.OrdinalIgnoreCase))
                    return a.Substring(9).TrimEnd('/');
            }
            try
            {
                string ini = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "SkoHelp.ini");
                if (File.Exists(ini))
                {
                    foreach (string line in File.ReadAllLines(ini))
                    {
                        string l = line.Trim();
                        if (l.StartsWith("server=", StringComparison.OrdinalIgnoreCase))
                            return l.Substring(7).Trim().TrimEnd('/');
                    }
                }
            }
            catch { }
            return DefaultServer;
        }

        static string LastFile()
        {
            string dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData), "SkoHelp");
            Directory.CreateDirectory(dir);
            return Path.Combine(dir, "last.txt");
        }

        // Remembers the last department/person so the user does not pick them every time.
        public static string[] LoadLast()
        {
            try
            {
                string f = LastFile();
                if (File.Exists(f)) return File.ReadAllLines(f);
            }
            catch { }
            return new string[0];
        }

        public static void SaveLast(string departmentId, string personnelId)
        {
            try { File.WriteAllLines(LastFile(), new string[] { departmentId, personnelId }); }
            catch { }
        }
    }

    class Item
    {
        public string Id;
        public string Text;
        public Item(string id, string text) { Id = id; Text = text; }
        public override string ToString() { return Text; }
    }

    class Api
    {
        readonly string server;
        readonly JavaScriptSerializer json = new JavaScriptSerializer();

        public Api(string server) { this.server = server; }

        public Dictionary<string, object> Get(string path)
        {
            return Send("GET", path, null);
        }

        public Dictionary<string, object> Post(string path, object body)
        {
            return Send("POST", path, json.Serialize(body));
        }

        Dictionary<string, object> Send(string method, string path, string body)
        {
            HttpWebRequest req = (HttpWebRequest)WebRequest.Create(server + path);
            req.Method = method;
            req.Timeout = 30000;
            req.UserAgent = "SkoHelp/1.0";
            if (body != null)
            {
                byte[] bytes = Encoding.UTF8.GetBytes(body);
                req.ContentType = "application/json; charset=utf-8";
                req.ContentLength = bytes.Length;
                using (Stream s = req.GetRequestStream()) s.Write(bytes, 0, bytes.Length);
            }
            try
            {
                using (HttpWebResponse res = (HttpWebResponse)req.GetResponse())
                    return Read(res);
            }
            catch (WebException ex)
            {
                HttpWebResponse res = ex.Response as HttpWebResponse;
                if (res == null) throw new Exception("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ กรุณาตรวจสอบอินเทอร์เน็ต");
                Dictionary<string, object> err = null;
                try { err = Read(res); } catch { }
                if (err != null && err.ContainsKey("error")) throw new Exception(Convert.ToString(err["error"]));
                throw new Exception("เซิร์ฟเวอร์ตอบกลับผิดพลาด (" + (int)res.StatusCode + ")");
            }
        }

        Dictionary<string, object> Read(HttpWebResponse res)
        {
            using (StreamReader r = new StreamReader(res.GetResponseStream(), Encoding.UTF8))
                return json.Deserialize<Dictionary<string, object>>(r.ReadToEnd());
        }
    }

    class DeviceInfo
    {
        public string Hostname = Environment.MachineName;
        public string WindowsUser = Environment.UserDomainName + "\\" + Environment.UserName;
        public string SerialNumber = Wmi("SELECT SerialNumber FROM Win32_BIOS", "SerialNumber");
        public string OsName = Wmi("SELECT Caption FROM Win32_OperatingSystem", "Caption");
        public List<Dictionary<string, string>> Adapters = ReadAdapters();

        static string Wmi(string query, string field)
        {
            try
            {
                using (ManagementObjectSearcher s = new ManagementObjectSearcher(query))
                {
                    foreach (ManagementObject o in s.Get())
                    {
                        object v = o[field];
                        if (v != null) return v.ToString().Trim();
                    }
                }
            }
            catch { }
            return "";
        }

        static List<Dictionary<string, string>> ReadAdapters()
        {
            List<Dictionary<string, string>> list = new List<Dictionary<string, string>>();
            try
            {
                foreach (NetworkInterface ni in NetworkInterface.GetAllNetworkInterfaces())
                {
                    if (ni.OperationalStatus != OperationalStatus.Up) continue;
                    if (ni.NetworkInterfaceType == NetworkInterfaceType.Loopback ||
                        ni.NetworkInterfaceType == NetworkInterfaceType.Tunnel) continue;
                    string mac = ni.GetPhysicalAddress().ToString();
                    if (mac.Length != 12) continue;
                    string ipv4 = "";
                    foreach (UnicastIPAddressInformation ua in ni.GetIPProperties().UnicastAddresses)
                    {
                        if (ua.Address.AddressFamily == AddressFamily.InterNetwork)
                        {
                            ipv4 = ua.Address.ToString();
                            break;
                        }
                    }
                    Dictionary<string, string> a = new Dictionary<string, string>();
                    a["mac"] = mac;
                    a["ipv4"] = ipv4;
                    list.Add(a);
                }
            }
            catch { }
            return list;
        }

        public string MainIp()
        {
            foreach (Dictionary<string, string> a in Adapters)
                if (a["ipv4"] != "") return a["ipv4"];
            return "-";
        }
    }

    static class RemoteAssistance
    {
        const string Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

        public static string NewPassword()
        {
            byte[] bytes = new byte[10];
            using (RNGCryptoServiceProvider rng = new RNGCryptoServiceProvider()) rng.GetBytes(bytes);
            StringBuilder sb = new StringBuilder();
            foreach (byte b in bytes) sb.Append(Alphabet[b % Alphabet.Length]);
            return sb.ToString();
        }

        static string MsraPath()
        {
            string p = Path.Combine(Environment.SystemDirectory, "msra.exe");
            if (File.Exists(p)) return p;
            // 32-bit process on 64-bit Windows
            p = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Windows), "Sysnative\\msra.exe");
            return File.Exists(p) ? p : null;
        }

        /// Starts Remote Assistance with a saved invitation. msra stays open, waiting for the
        /// technician. Returns the invitation file as base64, or null when it could not be created.
        public static string CreateInvitation(string password)
        {
            string msra = MsraPath();
            if (msra == null) return null;

            string file = Path.Combine(Path.GetTempPath(), "SkoHelp-" + Guid.NewGuid().ToString("N") + ".msrcincident");
            Process p = Process.Start(new ProcessStartInfo(msra, "/saveasfile \"" + file + "\" " + password) { UseShellExecute = false });

            for (int i = 0; i < 90; i++) // up to 45 seconds
            {
                Thread.Sleep(500);
                try
                {
                    if (File.Exists(file) && new FileInfo(file).Length > 0)
                    {
                        Thread.Sleep(500); // let msra finish writing
                        byte[] bytes;
                        using (FileStream fs = new FileStream(file, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                        {
                            bytes = new byte[fs.Length];
                            int read = 0;
                            while (read < bytes.Length) read += fs.Read(bytes, read, bytes.Length - read);
                        }
                        try { File.Delete(file); } catch { }
                        return Convert.ToBase64String(bytes);
                    }
                }
                catch (IOException) { }
                if (p.HasExited) break;
            }
            return null;
        }
    }

    class MainForm : Form
    {
        readonly Api api;
        readonly DeviceInfo device = new DeviceInfo();
        readonly string[] last = Config.LoadLast();

        readonly ComboBox cboDept = new ComboBox();
        readonly ComboBox cboPerson = new ComboBox();
        readonly ComboBox cboIssue = new ComboBox();
        readonly TextBox txtDesc = new TextBox();
        readonly Button btnSend = new Button();
        readonly Label lblStatus = new Label();

        public MainForm(string server)
        {
            api = new Api(server);

            Text = "ขอความช่วยเหลือ IT — สสจ.สระแก้ว";
            Font = new Font("Leelawadee UI", 10f);
            FormBorderStyle = FormBorderStyle.FixedDialog;
            MaximizeBox = false;
            StartPosition = FormStartPosition.CenterScreen;
            ClientSize = new Size(480, 560);
            BackColor = Color.White;

            Label title = new Label();
            title.Text = "ขอความช่วยเหลือจากเจ้าหน้าที่ IT";
            title.Font = new Font("Leelawadee UI", 14f, FontStyle.Bold);
            title.ForeColor = Color.FromArgb(30, 64, 175);
            title.SetBounds(20, 16, 440, 32);
            Controls.Add(title);

            Label dev = new Label();
            dev.Text = "เครื่อง: " + device.Hostname + "   IP: " + device.MainIp();
            dev.ForeColor = Color.DimGray;
            dev.SetBounds(20, 50, 440, 22);
            Controls.Add(dev);

            AddLabel("กลุ่มงาน *", 84);
            cboDept.DropDownStyle = ComboBoxStyle.DropDownList;
            cboDept.SetBounds(20, 108, 440, 28);
            cboDept.SelectedIndexChanged += delegate { LoadPersonnel(); };
            Controls.Add(cboDept);

            AddLabel("ชื่อ - นามสกุล *", 146);
            cboPerson.DropDownStyle = ComboBoxStyle.DropDownList;
            cboPerson.SetBounds(20, 170, 440, 28);
            Controls.Add(cboPerson);

            AddLabel("ประเภทปัญหา", 208);
            cboIssue.DropDownStyle = ComboBoxStyle.DropDownList;
            cboIssue.SetBounds(20, 232, 440, 28);
            Controls.Add(cboIssue);

            AddLabel("อาการ / ปัญหาที่พบ *", 270);
            txtDesc.Multiline = true;
            txtDesc.ScrollBars = ScrollBars.Vertical;
            txtDesc.MaxLength = 2000;
            txtDesc.SetBounds(20, 294, 440, 120);
            Controls.Add(txtDesc);

            Label note = new Label();
            note.Text = "เมื่อกดส่ง จะมีหน้าต่าง Windows Remote Assistance เปิดขึ้น กรุณาเปิดทิ้งไว้ " +
                        "และกด \"ใช่ (Yes)\" เมื่อเจ้าหน้าที่ IT ขอเชื่อมต่อ";
            note.ForeColor = Color.FromArgb(146, 64, 14);
            note.SetBounds(20, 420, 440, 44);
            Controls.Add(note);

            btnSend.Text = "ส่งคำขอความช่วยเหลือ";
            btnSend.SetBounds(20, 470, 440, 40);
            btnSend.BackColor = Color.FromArgb(37, 99, 235);
            btnSend.ForeColor = Color.White;
            btnSend.FlatStyle = FlatStyle.Flat;
            btnSend.Click += delegate { Submit(); };
            Controls.Add(btnSend);

            lblStatus.ForeColor = Color.DimGray;
            lblStatus.SetBounds(20, 516, 440, 40);
            Controls.Add(lblStatus);

            Shown += delegate { LoadDepartments(); };
        }

        void AddLabel(string text, int top)
        {
            Label l = new Label();
            l.Text = text;
            l.SetBounds(20, top, 440, 22);
            Controls.Add(l);
        }

        void SetBusy(bool busy, string status)
        {
            btnSend.Enabled = !busy;
            cboDept.Enabled = cboPerson.Enabled = cboIssue.Enabled = txtDesc.Enabled = !busy;
            lblStatus.Text = status;
            Cursor = busy ? Cursors.WaitCursor : Cursors.Default;
        }

        void RunAsync(Action work)
        {
            Thread t = new Thread(delegate ()
            {
                try { work(); }
                catch (Exception ex)
                {
                    string msg = ex.Message;
                    BeginInvoke((MethodInvoker)delegate
                    {
                        SetBusy(false, "");
                        MessageBox.Show(this, msg, "ไม่สำเร็จ", MessageBoxButtons.OK, MessageBoxIcon.Warning);
                    });
                }
            });
            t.IsBackground = true;
            t.Start();
        }

        static void SelectById(ComboBox box, string id)
        {
            for (int i = 0; i < box.Items.Count; i++)
                if (((Item)box.Items[i]).Id == id) { box.SelectedIndex = i; return; }
        }

        void LoadDepartments()
        {
            SetBusy(true, "กำลังโหลดรายชื่อกลุ่มงาน...");
            RunAsync(delegate
            {
                Dictionary<string, object> data = api.Get("/api/remote-help/options");
                BeginInvoke((MethodInvoker)delegate
                {
                    cboDept.Items.Clear();
                    foreach (object o in (System.Collections.ArrayList)data["departments"])
                    {
                        Dictionary<string, object> d = (Dictionary<string, object>)o;
                        cboDept.Items.Add(new Item(Convert.ToString(d["id"]), Convert.ToString(d["name"])));
                    }
                    cboIssue.Items.Clear();
                    foreach (object o in (System.Collections.ArrayList)data["issueTypes"])
                        cboIssue.Items.Add(new Item(Convert.ToString(o), Convert.ToString(o)));
                    SelectById(cboIssue, "Software");
                    if (cboIssue.SelectedIndex < 0 && cboIssue.Items.Count > 0) cboIssue.SelectedIndex = 0;
                    SetBusy(false, "");
                    if (last.Length > 0) SelectById(cboDept, last[0]);
                });
            });
        }

        void LoadPersonnel()
        {
            Item dept = cboDept.SelectedItem as Item;
            cboPerson.Items.Clear();
            if (dept == null) return;
            SetBusy(true, "กำลังโหลดรายชื่อบุคลากร...");
            RunAsync(delegate
            {
                Dictionary<string, object> data = api.Get("/api/remote-help/options?department_id=" + Uri.EscapeDataString(dept.Id));
                BeginInvoke((MethodInvoker)delegate
                {
                    foreach (object o in (System.Collections.ArrayList)data["personnel"])
                    {
                        Dictionary<string, object> p = (Dictionary<string, object>)o;
                        cboPerson.Items.Add(new Item(Convert.ToString(p["id"]),
                            Convert.ToString(p["first_name"]) + " " + Convert.ToString(p["last_name"])));
                    }
                    SetBusy(false, "");
                    if (last.Length > 1) SelectById(cboPerson, last[1]);
                });
            });
        }

        void Submit()
        {
            Item dept = cboDept.SelectedItem as Item;
            Item person = cboPerson.SelectedItem as Item;
            Item issue = cboIssue.SelectedItem as Item;
            string desc = txtDesc.Text.Trim();
            if (dept == null || person == null) { MessageBox.Show(this, "กรุณาเลือกกลุ่มงานและชื่อ-นามสกุล", "ข้อมูลไม่ครบ"); return; }
            if (desc.Length == 0) { MessageBox.Show(this, "กรุณาแจ้งอาการหรือปัญหาที่พบ", "ข้อมูลไม่ครบ"); txtDesc.Focus(); return; }

            Config.SaveLast(dept.Id, person.Id);
            SetBusy(true, "กำลังเปิด Remote Assistance...");

            RunAsync(delegate
            {
                string password = RemoteAssistance.NewPassword();
                string invitation = RemoteAssistance.CreateInvitation(password);

                BeginInvoke((MethodInvoker)delegate { lblStatus.Text = "กำลังส่งคำขอ..."; });

                Dictionary<string, object> devicePayload = new Dictionary<string, object>();
                devicePayload["hostname"] = device.Hostname;
                devicePayload["windows_user"] = device.WindowsUser;
                devicePayload["serial_number"] = device.SerialNumber;
                devicePayload["os_name"] = device.OsName;
                devicePayload["adapters"] = device.Adapters;

                Dictionary<string, object> body = new Dictionary<string, object>();
                body["department_id"] = dept.Id;
                body["personnel_id"] = person.Id;
                body["issue_type"] = issue != null ? issue.Id : "Other";
                body["description"] = desc;
                body["device"] = devicePayload;
                if (invitation != null)
                {
                    Dictionary<string, object> inv = new Dictionary<string, object>();
                    inv["file_base64"] = invitation;
                    inv["password"] = password;
                    body["invitation"] = inv;
                }

                Dictionary<string, object> result = api.Post("/api/remote-help", body);
                string ticket = Convert.ToString(result["ticketNumber"]);

                BeginInvoke((MethodInvoker)delegate
                {
                    SetBusy(false, "");
                    btnSend.Enabled = false;
                    string msg = "ส่งคำขอเรียบร้อยแล้ว\nเลขที่ใบงาน: " + ticket + "\n\n";
                    msg += invitation != null
                        ? "กรุณาเปิดหน้าต่าง Windows Remote Assistance ทิ้งไว้\nเมื่อเจ้าหน้าที่ IT ขอเชื่อมต่อ ให้กด \"ใช่ (Yes)\""
                        : "ไม่สามารถเปิด Remote Assistance บนเครื่องนี้ได้\nเจ้าหน้าที่ IT จะติดต่อกลับตามใบงาน";
                    lblStatus.Text = "เลขที่ใบงาน " + ticket;
                    MessageBox.Show(this, msg, "ขอความช่วยเหลือ IT", MessageBoxButtons.OK, MessageBoxIcon.Information);
                });
            });
        }
    }
}
