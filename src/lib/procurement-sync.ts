export interface ProcurementMeta {
  proc_status?: string | null;       // สภาพ/การใช้งาน ตามบัญชีพัสดุ เช่น 'ใช้งานได้ปกติ', 'จำหน่ายแล้ว', 'รอจำหน่าย', 'ซ่อมบำรุง'
  proc_location?: string | null;     // ใช้ที่ ตามบัญชีพัสดุ
  proc_desc?: string | null;         // รายละเอียดตามบัญชีพัสดุ
  proc_seq?: number | null;          // ลำดับในไฟล์พัสดุ
  proc_date_raw?: string | null;     // วัน เดือน ปี ดิบจากไฟล์พัสดุ
  proc_note?: string | null;         // หมายเหตุจากไฟล์พัสดุ
  is_bundled_item?: boolean;         // true ถ้าเป็นจอภาพ/UPS ที่ใช้รหัสเดียวกับเครื่องหลัก (ราคา = 0 เพื่อไม่ให้ยอดรวมเบิ้ล)
  full_set_price?: number | null;    // ราคาเต็มของชุดครุภัณฑ์ (เก็บไว้อ้างอิงกรณีเป็นชิ้นส่วนพ่วง)
  original_ocr_code?: string | null; // รหัสเดิมที่เพี้ยนจาก OCR ก่อนถูกซ่อมอัตโนมัติ
  status_reconciled?: boolean;       // แอดมินกดตัดสินใจเรื่องสถานะแล้วหรือยัง
  dept_reconciled?: boolean;         // แอดมินกดตัดสินใจเรื่องกลุ่มงาน/สถานที่แล้วหรือยัง
  decision_by?: 'it' | 'procurement' | 'manual' | null;
  reconciled_at?: string | null;
  imported_from_proc?: boolean;      // true ถ้านำเข้าใหม่จากไฟล์พัสดุโดยยังไม่เคยสำรวจหน้างาน
}

export function parseProcurementMeta(rawProposedAction: string | null | undefined): ProcurementMeta {
  if (!rawProposedAction) return {};
  try {
    const parsed = JSON.parse(rawProposedAction);
    if (parsed && typeof parsed === 'object') {
      return parsed as ProcurementMeta;
    }
  } catch {
    // Fallback if plain text was ever stored
  }
  return {};
}

export function serializeProcurementMeta(meta: ProcurementMeta): string {
  return JSON.stringify(meta);
}

// แปลงวันที่ภาษาไทย เช่น "30 ก.ย. 2548" -> "2005-09-30"
const THAI_MONTHS: Record<string, string> = {
  'ม.ค.': '01',
  'ก.พ.': '02',
  'มี.ค.': '03',
  'เม.ย.': '04',
  'พ.ค.': '05',
  'มิ.ย.': '06',
  'ก.ค.': '07',
  'ส.ค.': '08',
  'ก.ย.': '09',
  'ต.ค.': '10',
  'พ.ย.': '11',
  'ธ.ค.': '12',
};

export function parseThaiDateToISO(str: string | null | undefined): string | null {
  if (!str) return null;
  const cleaned = str.toString().trim();
  const parts = cleaned.split(/\s+/);
  if (parts.length !== 3) return null;
  const day = parts[0].padStart(2, '0');
  const month = THAI_MONTHS[parts[1]];
  const yearBE = parseInt(parts[2], 10);
  if (!month || isNaN(yearBE)) return null;
  const yearCE = yearBE > 2400 ? yearBE - 543 : yearBE;
  return `${yearCE}-${month}-${day}`;
}

// มาตรฐานรหัสครุภัณฑ์สำหรับเปรียบเทียบ (ตัดช่องว่าง และตัดเลข 0 นำหน้าหลังเครื่องหมาย /)
export function normalizeAssetCode(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return '';
  return s
    .toString()
    .trim()
    .replace(/\s+/g, '')
    .replace(/\/0+(\d+)$/, '/$1');
}

// ซ่อมรหัสครุภัณฑ์ที่เพี้ยนจาก AI OCR หรือการพิมพ์ผิด ให้ตรงกับรหัสจริงในไฟล์พัสดุ
export function findMatchingProcurementCode(
  rawDbCode: string | null | undefined,
  assetName: string | null | undefined,
  excelNormMap: Map<string, string>
): { matchedExcelCode: string | null; isRepaired: boolean } {
  if (!rawDbCode) return { matchedExcelCode: null, isRepaired: false };
  const trimmed = rawDbCode.trim();
  if (
    !trimmed ||
    trimmed === 'ไม่มีรหัส' ||
    trimmed === 'ไม่มีรหัสครุภัณฑ์' ||
    trimmed === '-' ||
    trimmed === '0'
  ) {
    return { matchedExcelCode: null, isRepaired: false };
  }

  const norm = normalizeAssetCode(trimmed);
  if (excelNormMap.has(norm)) {
    const target = excelNormMap.get(norm)!;
    return { matchedExcelCode: target, isRepaired: trimmed !== target };
  }

  // ลองซ่อม Pattern ที่พบบ่อยจาก AI OCR / การพิมพ์
  const candidates = [
    norm
      .replace(/^1440-/, '7440-')
      .replace(/^7410-/, '7440-')
      .replace(/^7400-/, '7300-')
      .replace(/^74401-/, '7440-')
      .replace(/^74-40-/, '7440-')
      .replace(/-061-/, '-001-')
      .replace(/-006\//, '-0006/')
      .replace(/-0\/06\//, '-0006/')
      .replace(/-9000\//, '-0006/')
      .replace(/-0606\//, '-0006/')
      .replace(/-со06\//, '-0006/')
      .replace(/0006\|(\d+)$/, '0006/$1')
      .replace(/0006-(\d+)$/, '0006/$1')
      .replace(/00061(\d{3})$/, '0006/$1')
      .replace(/0006(\d{3})$/, '0006/$1'),
    norm.replace(/^7440-001-0001\/(1\d\d)$/, '7440-001-0006/$1'),
  ];

  // กรณีชื่อเครื่อง (asset_name) เป็นรหัสครุภัณฑ์ที่ถูกต้อง แต่ช่องรหัสพิมพ์ผิด (เช่น 7440-001-0006/122 แต่ชื่อคือ 7440-001-0006/172)
  if (assetName) {
    const nameNorm = normalizeAssetCode(assetName);
    if (excelNormMap.has(nameNorm)) {
      candidates.push(nameNorm);
    }
  }

  for (const cand of candidates) {
    const nc = normalizeAssetCode(cand);
    if (excelNormMap.has(nc)) {
      return { matchedExcelCode: excelNormMap.get(nc)!, isRepaired: true };
    }
  }

  return { matchedExcelCode: null, isRepaired: false };
}

// แปลงสถานะจากไฟล์พัสดุ เป็นสถานะมาตรฐานในระบบ IT (เมื่อแอดมินกด "ยึดตามพัสดุ")
export function mapProcurementStatusToItStatus(procStatus: string | null | undefined): string {
  const s = (procStatus || '').trim();
  if (s === 'ใช้งานได้ปกติ') return 'ใช้งาน';
  if (s === 'จำหน่ายแล้ว') return 'จำหน่ายแล้ว';
  if (s === 'รอจำหน่าย') return 'พร้อมจำหน่าย';
  if (s === 'ซ่อมบำรุง') return 'ชำรุด';
  return 'ใช้งาน';
}

// ตรวจสอบว่าสถานะ IT กับ สถานะพัสดุ ถือว่าตรงกันหรือไม่
export function isStatusEquivalent(
  itStatus: string | null | undefined,
  procStatus: string | null | undefined
): boolean {
  if (!procStatus) return true; // ไม่มีข้อมูลพัสดุให้เทียบ
  const it = (itStatus || 'ใช้งาน').trim();
  const proc = procStatus.trim();
  if (it === 'รอสำรวจ') return false; // รอสำรวจ ต้องให้แอดมินหรือทีมสำรวจยืนยันเสมอ
  if (proc === 'ใช้งานได้ปกติ' && it === 'ใช้งาน') return true;
  if (proc === 'จำหน่ายแล้ว' && it === 'จำหน่ายแล้ว') return true;
  if (proc === 'รอจำหน่าย' && (it === 'พร้อมจำหน่าย' || it === 'เสื่อมสภาพ')) return true;
  if (proc === 'ซ่อมบำรุง' && (it === 'ชำรุด' || it === 'เสื่อมสภาพ')) return true;
  return false;
}

// จับคู่ชื่อ "ใช้ที่" ในไฟล์พัสดุ เข้ากับชื่อกลุ่มงานในฐานข้อมูล (22 กลุ่มงาน)
export function mapProcurementLocationToDeptName(procLocation: string | null | undefined): string | null {
  if (!procLocation) return null;
  const loc = procLocation.trim();

  if (loc.includes('สุขภาพดิจิทัล') || loc === 'IEIP' || loc.includes('Cookpit')) {
    return 'สุขภาพดิจิทัล';
  }
  if (loc.includes('พัสดุ')) return 'พัสดุ';
  if (loc.includes('คุ้มครองผู้บริโภค') || loc.includes('One Stop Service')) return 'คุ้มครองผู้บริโภค';
  if (loc.includes('บริหารทรัพยากรบุคคล')) return 'บริหารทรัพยากรบุคคล';
  if (loc.includes('พัฒนาทรัพยากรบุคคล')) return 'พัฒนาทรัพยากรบุคคล';
  if (loc.includes('ประกันสุขภาพ')) return 'ประกันสุขภาพ';
  if (loc.includes('ปฐมภูมิและเครือข่ายสุขภาพ')) return 'ปฐมภูมิและเครือข่ายสุขภาพ';
  if (loc.includes('ทันตสาธารณสุข')) return 'ทันตสาธารณสุข';
  if (loc.includes('การเงิน')) return 'การเงินบัญชี';
  if (loc.includes('ยุทธศาสตร์') || loc.includes('สุขศึกษาและประชาสัมพันธ์')) return 'พัฒนายุทธศาสตร์สาธารณสุข';
  if (loc.includes('ส่งเสริมสุขภาพ')) return 'ส่งเสริมสุขภาพ';
  if (loc.includes('ควบคุมโรคไม่ติดต่อ')) return 'ควบคุมโรคไม่ติดต่อ';
  if (loc.includes('ควบคุมโรคติดต่อ')) return 'ควบคุมโรคติดต่อ';
  if (loc.includes('กฎหมาย')) return 'กลุ่มกฎหมาย';
  if (loc.includes('ธุรการ')) return 'ธุรการ';
  if (loc.includes('พัฒนาคุณภาพ')) return 'พัฒนาคุณภาพและรูปแบบบริการ';
  if (loc.includes('แพทย์แผนไทย')) return 'การแพทย์แผนไทยและการแพทย์ทางเลือก';
  if (loc.includes('เลขานุการและอำนวยการ') || loc.includes('หัวหน้าบริหาร')) return 'เลขานุการและอำนวยการ';
  if (loc.includes('อนามัยสิ่งแวดล้อม')) return 'อนามัยสิ่งแวดล้อมและอาชีวอนามัย';
  if (loc.includes('โยธา')) return 'ช่างโยธา';
  if (loc.includes('ยานพาหนะ')) return 'ยานพาหนะ';
  if (
    loc.includes('นายแพทย์สาธารณสุข') ||
    loc.includes('ห้องรอง') ||
    loc.includes('กัลยารัตน์') ||
    loc.includes('พาณี') ||
    loc.includes('อรพิน') ||
    loc.includes('ดารารัตน์') ||
    loc.includes('ไชยยา')
  ) {
    return 'ผู้บริหาร';
  }
  if (loc.includes('ส่วนกลาง') || loc.includes('ห้องประชุมสิรินธร') || loc.includes('ชั้น')) {
    return 'ธุรการ';
  }
  return null;
}

// ตรวจสอบว่ากลุ่มงาน IT กับ ใช้ที่ตามพัสดุ ตรงกันหรือไม่
export function isDepartmentEquivalent(
  itDeptName: string | null | undefined,
  procLocation: string | null | undefined
): boolean {
  if (!procLocation) return true;
  const mappedProcDept = mapProcurementLocationToDeptName(procLocation);
  if (!mappedProcDept || !itDeptName) return true;
  return itDeptName.trim() === mappedProcDept.trim();
}

// แยกประเภทครุภัณฑ์ (Category Name) จากรายละเอียดในไฟล์พัสดุ
export function inferCategoryNameFromDescription(desc: string | null | undefined): string {
  const d = (desc || '').toLowerCase();
  if (/all\s*in\s*one/i.test(d) && !/พิมพ์|printer|mfp/i.test(d)) return 'All In One (PC)';
  if (/พิมพ์|ปริ้น|printer|laser|ink\s*tank|inkjet|mutifunction|mfp/i.test(d)) return 'Printer';
  if (/สแกนเนอร์|scanner/i.test(d)) return 'Scanner';
  if (/โน้ตบุ๊ก|โน๊ตบุ๊ค|notebook|พกพา/i.test(d) && !/ipad|tablet|แท็บเล็ต/i.test(d)) return 'Notebook/Laptop';
  if (/ipad|tablet|แท็บเล็ต|จอสัมผัส/i.test(d)) return 'Tablet/iPad';
  if (/สำรองไฟ|ups/i.test(d)) return 'UPS';
  if (/แม่ข่าย|server|sever|ตู้เหล็กติดตั้ง|rack|เก็บ\s*log/i.test(d)) return 'Server';
  if (/access\s*point|ไร้สาย|wifi|wireless/i.test(d)) return 'Access Point';
  if (/switch|hub|router|firewall|blue\s*coat|กระจายสัญญาณ|ค้นหาเส้นทาง|lan/i.test(d)) return 'Network Switch';
  if ((/จอภาพ|จอรับสัญญาณ|monitor|lcd\s*tv/i.test(d)) && !/คอมพิวเตอร์|ประมวลผล/i.test(d)) return 'Monitor';
  return 'Computer (PC)';
}

// ดึง ยี่ห้อ/รุ่น และ Serial Number ออกจากข้อความรายละเอียดพัสดุ
export function extractBrandAndSerial(desc: string | null | undefined): {
  cleanName: string;
  brandModel: string | null;
  serialNumber: string | null;
} {
  if (!desc) return { cleanName: 'ครุภัณฑ์คอมพิวเตอร์', brandModel: null, serialNumber: null };
  const singleLine = desc.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').trim();

  // Extract S/N if present
  let serialNumber: string | null = null;
  const snMatch = singleLine.match(/S\/N\s*[:.]?\s*([A-Za-z0-9-]+)/i);
  if (snMatch) {
    serialNumber = snMatch[1].trim();
  }

  // Extract brand/model after "ยี่ห้อ"
  let brandModel: string | null = null;
  const brandMatch = singleLine.match(/ยี่ห้อ\s+(.+)$/i);
  if (brandMatch) {
    brandModel = brandMatch[1].replace(/S\/N\s*[:.]?\s*[A-Za-z0-9-]+/i, '').trim();
  } else {
    // Try English brand names
    const engMatch = singleLine.match(/\b(HP|Acer|Aser|ASUS|Apple|Lenovo|Dell|Brother|Epson|Samsung|Fuji|Cisco|Fortinet|TPL|TP-Link|APC|Syndome|Silicon|Solidtech| Olympia)[\sA-Za-z0-9.-]*/i);
    if (engMatch) {
      brandModel = engMatch[0].trim();
    }
  }

  return {
    cleanName: singleLine,
    brandModel: brandModel || null,
    serialNumber,
  };
}

export interface SyncSummary {
  totalExcelRows: number;
  matchedDbAssets: number;
  repairedOcrCodes: number;
  repairedCodeList: Array<{ id: string; from: string; to: string; name: string }>;
  bundledCompanionItems: number;
  newlyImportedRows: number;
  statusConflictsCount: number;
  deptConflictsCount: number;
}

export async function runProcurementSync(
  excelRows: Record<string, any>[],
  supabaseClient: any
): Promise<SyncSummary> {
  // 1. Fetch existing DB data
  const [assetsRes, deptsRes, catsRes, personnelRes] = await Promise.all([
    supabaseClient
      .from('assets')
      .select('*, departments(name), asset_categories(name)'),
    supabaseClient.from('departments').select('id, name'),
    supabaseClient.from('asset_categories').select('id, name'),
    supabaseClient.from('personnel').select('id, first_name, last_name, department_id'),
  ]);

  if (assetsRes.error) throw assetsRes.error;
  if (deptsRes.error) throw deptsRes.error;
  if (catsRes.error) throw catsRes.error;

  const dbAssets: any[] = assetsRes.data || [];
  const depts: any[] = deptsRes.data || [];
  const cats: any[] = catsRes.data || [];
  const personnelList: any[] = personnelRes.data || [];

  const deptByName = new Map<string, string>();
  depts.forEach((d) => deptByName.set(d.name.trim(), d.id));

  const catByName = new Map<string, string>();
  cats.forEach((c) => catByName.set(c.name.trim(), c.id));

  // 2. Parse Excel rows and build lookup maps
  interface ParsedExcelRow {
    seq: number;
    dateRaw: string;
    acqDateISO: string | null;
    desc: string;
    rawCode: string;
    normCode: string;
    isZeroCode: boolean;
    effectiveCode: string;
    price: number;
    method: string | null;
    procLoc: string;
    procStatus: string;
    procNote: string | null;
  }

  const parsedExcel: ParsedExcelRow[] = [];
  const excelNormMap = new Map<string, string>(); // normCode -> rawCode
  const excelByNormCode = new Map<string, ParsedExcelRow[]>();
  const excelBySeq = new Map<number, ParsedExcelRow>();

  excelRows.forEach((r, idx) => {
    const seq = Number(r['ลำดับ']) || idx + 1;
    const dateRaw = (r['วัน เดือน ปี'] || '').toString().trim();
    const acqDateISO = parseThaiDateToISO(dateRaw);
    const desc = (r['รายละเอียด'] || '').toString().trim();
    const rawCodeOrig = (r['หมายเลขครุภัณฑ์'] ?? '').toString().trim();
    const isZeroCode = !rawCodeOrig || rawCodeOrig === '0' || rawCodeOrig === '-';
    const effectiveCode = isZeroCode ? `ไม่มีรหัส (พัสดุ #${seq})` : rawCodeOrig;
    const norm = isZeroCode ? `ZERO_SEQ_${seq}` : normalizeAssetCode(rawCodeOrig);
    const price = Number(r['ราคาต่อหน่วย (บาท)']) || 0;
    const methodRaw = (r['วิธีการได้มา'] || '').toString().trim();
    const method = methodRaw && methodRaw !== '-' ? methodRaw : null;
    const procLoc = (r['ใช้ที่'] || '').toString().trim();
    const procStatus = (r['สภาพ/การใช้งาน'] || 'ใช้งานได้ปกติ').toString().trim();
    const procNote = r['หมายเหตุ'] ? r['หมายเหตุ'].toString().trim() : null;

    const item: ParsedExcelRow = {
      seq,
      dateRaw,
      acqDateISO,
      desc,
      rawCode: rawCodeOrig,
      normCode: norm,
      isZeroCode,
      effectiveCode,
      price,
      method,
      procLoc,
      procStatus,
      procNote,
    };

    parsedExcel.push(item);
    excelBySeq.set(seq, item);
    if (!isZeroCode) {
      if (!excelNormMap.has(norm)) {
        excelNormMap.set(norm, rawCodeOrig);
      }
      if (!excelByNormCode.has(norm)) {
        excelByNormCode.set(norm, []);
      }
      excelByNormCode.get(norm)!.push(item);
    }
  });

  // 3. Match existing DB rows to Excel rows
  // Group matched DB rows by the matched Excel item's normCode (or seq if already linked)
  const matchedDbByExcelSeq = new Map<number, any[]>();
  const repairedCodeList: Array<{ id: string; from: string; to: string; name: string }> = [];

  for (const asset of dbAssets) {
    const existingMeta = parseProcurementMeta(asset.proposed_action);

    // Check if already linked by proc_seq on a previous run
    if (existingMeta.proc_seq && excelBySeq.has(existingMeta.proc_seq)) {
      const exItem = excelBySeq.get(existingMeta.proc_seq)!;
      if (!matchedDbByExcelSeq.has(exItem.seq)) matchedDbByExcelSeq.set(exItem.seq, []);
      matchedDbByExcelSeq.get(exItem.seq)!.push({ asset, isRepaired: false, targetCode: exItem.effectiveCode });
      continue;
    }

    const { matchedExcelCode, isRepaired } = findMatchingProcurementCode(
      asset.asset_number,
      asset.asset_name,
      excelNormMap
    );

    if (matchedExcelCode) {
      const norm = normalizeAssetCode(matchedExcelCode);
      const exCandidates = excelByNormCode.get(norm) || [];
      if (exCandidates.length > 0) {
        const chosenEx = exCandidates[0];
        if (!matchedDbByExcelSeq.has(chosenEx.seq)) matchedDbByExcelSeq.set(chosenEx.seq, []);
        matchedDbByExcelSeq.get(chosenEx.seq)!.push({
          asset,
          isRepaired,
          targetCode: chosenEx.effectiveCode,
        });

        if (isRepaired) {
          repairedCodeList.push({
            id: asset.id,
            from: asset.asset_number || '',
            to: chosenEx.effectiveCode,
            name: asset.asset_name || '',
          });
        }
      }
    }
  }

  // 4. Prepare updates for matched DB assets & inserts for unmatched Excel rows
  const PRIMARY_CATS = new Set([
    'Computer (PC)',
    'All In One (PC)',
    'Notebook/Laptop',
    'Server',
    'Printer',
    'Scanner',
    'Network Switch',
    'Access Point',
    'Tablet/iPad',
  ]);

  let matchedDbAssets = 0;
  let bundledCompanionItems = 0;
  let statusConflictsCount = 0;
  let deptConflictsCount = 0;

  const updatesToRun: Array<{ id: string; payload: Record<string, any> }> = [];
  const insertsToRun: Array<Record<string, any>> = [];

  for (const exItem of parsedExcel) {
    const matchedGroup = matchedDbByExcelSeq.get(exItem.seq);

    if (matchedGroup && matchedGroup.length > 0) {
      // Sort group so primary device (e.g. Computer (PC)) comes first, Monitor/UPS comes after
      matchedGroup.sort((a, b) => {
        const catA = a.asset.asset_categories?.name || '';
        const catB = b.asset.asset_categories?.name || '';
        const scoreA =
          catA === 'Computer (PC)' || catA === 'All In One (PC)' || catA === 'Notebook/Laptop'
            ? 0
            : PRIMARY_CATS.has(catA)
            ? 1
            : catA === 'Monitor'
            ? 2
            : 3;
        const scoreB =
          catB === 'Computer (PC)' || catB === 'All In One (PC)' || catB === 'Notebook/Laptop'
            ? 0
            : PRIMARY_CATS.has(catB)
            ? 1
            : catB === 'Monitor'
            ? 2
            : 3;
        return scoreA - scoreB;
      });

      const { brandModel: exBrand, serialNumber: exSn } = extractBrandAndSerial(exItem.desc);

      matchedGroup.forEach((entry, idx) => {
        const dbRow = entry.asset;
        const isBundled = idx > 0; // First item gets full price, companion items (Monitor/UPS) get 0
        if (isBundled) bundledCompanionItems++;
        matchedDbAssets++;

        const prevMeta = parseProcurementMeta(dbRow.proposed_action);
        const origCode =
          entry.isRepaired && dbRow.asset_number !== entry.targetCode
            ? dbRow.asset_number
            : prevMeta.original_ocr_code || null;

        const itStatus = dbRow.status || 'ใช้งาน';
        const itDeptName = dbRow.departments?.name || null;

        const statusEq = isStatusEquivalent(itStatus, exItem.procStatus);
        const deptEq = isDepartmentEquivalent(itDeptName, exItem.procLoc);

        if (!statusEq && !prevMeta.status_reconciled) statusConflictsCount++;
        if (!deptEq && !prevMeta.dept_reconciled) deptConflictsCount++;

        const newMeta: ProcurementMeta = {
          ...prevMeta,
          proc_status: exItem.procStatus,
          proc_location: exItem.procLoc,
          proc_desc: exItem.desc,
          proc_seq: exItem.seq,
          proc_date_raw: exItem.dateRaw,
          proc_note: exItem.procNote,
          is_bundled_item: isBundled,
          full_set_price: exItem.price,
          original_ocr_code: origCode,
          status_reconciled: prevMeta.status_reconciled ?? statusEq,
          dept_reconciled: prevMeta.dept_reconciled ?? deptEq,
        };

        let updatedNotes = dbRow.notes || '';
        if (origCode && !updatedNotes.includes(`ซ่อมรหัสจาก`)) {
          updatedNotes = updatedNotes
            ? `${updatedNotes} | [ซ่อมรหัสจาก: ${origCode}]`
            : `[ซ่อมรหัสจาก: ${origCode}]`;
        }
        if (isBundled && !updatedNotes.includes(`ราคารวมในชุดหลัก`)) {
          updatedNotes = updatedNotes
            ? `${updatedNotes} | [ราคารวมในชุดหลัก ${entry.targetCode}]`
            : `[ราคารวมในชุดหลัก ${entry.targetCode}]`;
        }

        const catName = dbRow.asset_categories?.name || '';
        const shouldFillBrand =
          !dbRow.brand_model && exBrand && catName !== 'Monitor' && catName !== 'UPS';

        updatesToRun.push({
          id: dbRow.id,
          payload: {
            asset_number: entry.targetCode,
            acquisition_date: exItem.acqDateISO,
            acquisition_method: exItem.method,
            purchase_price: isBundled ? 0 : exItem.price,
            location_details: exItem.procLoc,
            brand_model: shouldFillBrand ? exBrand : dbRow.brand_model,
            serial_number: !dbRow.serial_number && !isBundled && exSn ? exSn : dbRow.serial_number,
            proposed_action: serializeProcurementMeta(newMeta),
            notes: updatedNotes || null,
          },
        });
      });
    } else {
      // Unmatched Excel row -> Insert as a new asset with IT status = 'รอสำรวจ'
      const { cleanName, brandModel, serialNumber } = extractBrandAndSerial(exItem.desc);
      const inferredCatName = inferCategoryNameFromDescription(exItem.desc);
      const categoryId = catByName.get(inferredCatName) || catByName.get('Computer (PC)') || null;

      const mappedDeptName = mapProcurementLocationToDeptName(exItem.procLoc);
      const departmentId = mappedDeptName ? deptByName.get(mappedDeptName) || null : null;

      // Try to match executive personnel if named in procLoc
      let personnelId: string | null = null;
      if (exItem.procLoc.includes('นายแพทย์สาธารณสุข')) {
        const p = personnelList.find((x) => x.first_name.includes('พัลลภ'));
        if (p) personnelId = p.id;
      } else {
        for (const p of personnelList) {
          const firstBare = p.first_name.replace(/^(นาย|นางสาว|นาง|ว่าที่ร\.ต\.)/, '').trim();
          if (firstBare && exItem.procLoc.includes(firstBare)) {
            personnelId = p.id;
            break;
          }
        }
      }

      const newMeta: ProcurementMeta = {
        proc_status: exItem.procStatus,
        proc_location: exItem.procLoc,
        proc_desc: exItem.desc,
        proc_seq: exItem.seq,
        proc_date_raw: exItem.dateRaw,
        proc_note: exItem.procNote,
        is_bundled_item: false,
        full_set_price: exItem.price,
        original_ocr_code: null,
        status_reconciled: false,
        dept_reconciled: true,
        imported_from_proc: true,
      };

      statusConflictsCount++;

      insertsToRun.push({
        asset_number: exItem.effectiveCode,
        asset_name: cleanName,
        brand_model: brandModel,
        serial_number: serialNumber,
        category_id: categoryId,
        department_id: departmentId,
        personnel_id: personnelId,
        location_details: exItem.procLoc,
        acquisition_date: exItem.acqDateISO,
        acquisition_method: exItem.method,
        purchase_price: exItem.price,
        status: 'รอสำรวจ',
        proposed_action: serializeProcurementMeta(newMeta),
        notes: exItem.procNote
          ? `[นำเข้าจากบัญชีพัสดุ ลำดับที่ ${exItem.seq}] ${exItem.procNote}`
          : `[นำเข้าจากบัญชีพัสดุ ลำดับที่ ${exItem.seq}]`,
      });
    }
  }

  // 5. Execute DB updates in parallel batches of 25
  const BATCH_SIZE = 25;
  for (let i = 0; i < updatesToRun.length; i += BATCH_SIZE) {
    const batch = updatesToRun.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map((u) =>
        supabaseClient.from('assets').update(u.payload).eq('id', u.id)
      )
    );
  }

  // 6. Execute DB inserts in batches of 50
  for (let i = 0; i < insertsToRun.length; i += 50) {
    const batch = insertsToRun.slice(i, i + 50);
    const { error: insErr } = await supabaseClient.from('assets').insert(batch);
    if (insErr) throw insErr;
  }

  return {
    totalExcelRows: parsedExcel.length,
    matchedDbAssets,
    repairedOcrCodes: repairedCodeList.length,
    repairedCodeList,
    bundledCompanionItems,
    newlyImportedRows: insertsToRun.length,
    statusConflictsCount,
    deptConflictsCount,
  };
}

