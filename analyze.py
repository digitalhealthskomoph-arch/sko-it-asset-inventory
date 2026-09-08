import pandas as pd

df = pd.read_excel("ช่าง(IT)มัน.xlsx")
df['Date_Time'] = pd.to_datetime(df['Date_Time'], errors='coerce')
df = df.dropna(subset=['Date_Time'])

# Filter out 2025 data as it seems incomplete
df = df[df['Date_Time'] >= '2026-01-01']

threshold_date = pd.to_datetime('2026-05-20')

def is_printer_issue(row):
    issue = str(row['Issue_Type']).lower()
    desc = str(row['Description']).lower()
    return 'printer' in issue or 'ปริ้น' in issue or 'หมึก' in issue or \
           'printer' in desc or 'ปริ้น' in desc or 'หมึก' in desc or 'เครื่องพิมพ์' in desc

df['Is_Printer'] = df.apply(is_printer_issue, axis=1)

df_before = df[df['Date_Time'] < threshold_date]
df_after = df[df['Date_Time'] >= threshold_date]

printer_before = df_before['Is_Printer'].sum()
printer_after = df_after['Is_Printer'].sum()

# Count actual months/days within the filtered range
months_before = len(df_before['Date_Time'].dt.to_period('M').unique())
months_after = len(df_after['Date_Time'].dt.to_period('M').unique())

print(f"--- 2026 Printer Analysis ---")
print(f"Total jobs before {threshold_date.date()}: {len(df_before)} (Months: {months_before})")
print(f"Total jobs after {threshold_date.date()}: {len(df_after)} (Months: {months_after})")
print(f"Printer jobs before: {printer_before} (Avg: {printer_before/months_before:.1f} per month)")
print(f"Printer jobs after: {printer_after} (Avg: {printer_after/months_after:.1f} per month)")
