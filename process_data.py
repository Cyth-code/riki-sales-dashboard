import pandas as pd, json, numpy as np
from datetime import datetime

U='/mnt/user-data/uploads/'
OUT='/home/claude/app/data/'
import os; os.makedirs(OUT,exist_ok=True)

def clean(v):
    if isinstance(v,(pd.Timestamp,datetime)):
        return None if pd.isna(v) else v.strftime('%Y-%m-%d')
    if isinstance(v,(np.integer,int)): return int(v)
    if isinstance(v,(np.floating,float)):
        return None if (pd.isna(v) or np.isnan(v)) else round(float(v),2)
    if pd.isna(v): return None
    return str(v)

# ---------- OPPORTUNITIES ----------
# NOTE: filename changes each pull (date-stamped) - update this to match
# whatever Zoho export you actually have, e.g. 'Opportunities_2026_07_22.xlsx'
o=pd.read_excel(U+'Opportunities.xlsx')
riki=o[o['Opportunity Owner'].astype(str).str.contains('Riki',case=False,na=False)].copy()
for c in ['Created Time','Closing Date','Lead-Created-Time','Modified Time']:
    riki[c]=pd.to_datetime(riki[c],errors='coerce')

WON=['Closed Won']
LOST=['Closed-Lost','Closed-Cancel/Expire','Closed-Disqual','Closed-NoOpp']
def cat(s):
    if s in WON: return 'Won'
    if s in LOST: return 'Lost'
    return 'Open'
riki['Outcome']=riki['Stage'].apply(cat)
riki['Origin']=riki['Lead-Created-Time'].apply(lambda x:'From Lead' if pd.notna(x) else 'Direct Opp')
riki['OppCycleWks']=(riki['Sales Cycle Duration']/7).round(1)
riki['LeadConvDays']=riki['Lead Conversion Time']
riki['OverallWks']=(riki['Overall Sales Duration']/7).round(1)

def cyclebucket(wks):
    if pd.isna(wks): return None
    w=wks
    if w<=1: return '0-1 wks'
    if w<=4: return '1-4 wks'
    if w<=8: return '4-8 wks'
    if w<=12: return '8-12 wks'
    if w<=26: return '12-26 wks'
    if w<=52: return '26-52 wks'
    return '52+ wks'
riki['CycleBucket']=riki['OppCycleWks'].apply(cyclebucket)

opps=[]
for _,r in riki.iterrows():
    opps.append({
        'id':clean(r['Record Id']),
        'name':clean(r['Opportunity Name']),
        'company':clean(r['Company Name']),
        'stage':clean(r['Stage']),
        'outcome':r['Outcome'],
        'pipeline':clean(r['Pipeline']),
        'leadSource':clean(r['Lead Source']),
        'type':clean(r['Type']),
        'origin':r['Origin'],
        'created':clean(r['Created Time']),
        'closing':clean(r['Closing Date']),
        'amount':clean(r['Amount']),
        'prob':clean(r['Probability (%)']),
        'lossReason':clean(r['Reason For Loss']),
        'oppCycleWks':clean(r['OppCycleWks']),
        'overallWks':clean(r['OverallWks']),
        'leadConvDays':clean(r['LeadConvDays']),
        'cycleBucket':r['CycleBucket'],
    })
json.dump(opps,open(OUT+'opportunities.json','w'),indent=1)
print('opps:',len(opps))

# ---------- STAGE HISTORY ----------
# NOTE: filename changes each pull - update to match your Zoho export
s=pd.read_excel(U+'Stage_History.xlsx')
sr=s[s['Opportunity Owner'].astype(str).str.contains('Riki',case=False,na=False)].copy()
sr['Modified Time (Stage History)']=pd.to_datetime(sr['Modified Time (Stage History)'],errors='coerce')
sr=sr.sort_values(['Opportunity Name','Modified Time (Stage History)'])
hist=[]
for _,r in sr.iterrows():
    hist.append({
        'opp':clean(r['Opportunity Name']),
        'company':clean(r['Opportunity Name']),
        'stage':clean(r['Stage (Stage History)']),
        'pipeline':clean(r['Pipeline']),
        'leadSource':clean(r['Lead Source']),
        'amount':clean(r['Amount (Stage History)']),
        'durationDays':clean(r['Stage Duration (Calendar Days)']),
        'modified':clean(r['Modified Time (Stage History)']),
    })
json.dump(hist,open(OUT+'stage_history.json','w'),indent=1)
print('stage history:',len(hist))

# ---------- LEADS (front funnel) ----------
# UPDATED FORMAT (as of 2026-07-22 pull): Zoho now exports leads as two
# reports that are each cleanly pre-filtered by an 'Is Converted' column
# (True/False) - no more manual key-based dedupe needed like the old
# two-file version. Just point these at whatever your two Academic Lead
# Report exports are named:
la=pd.read_excel(U+'Academic_Lead_Report_Unconverted.xlsx')   # Is Converted = False
lb=pd.read_excel(U+'Academic_Lead_Report_Converted.xlsx')     # Is Converted = True
for d in (la,lb):
    d['Created Time']=pd.to_datetime(d['Created Time'],errors='coerce')
lb['Converted Date Time']=pd.to_datetime(lb['Converted Date Time'],errors='coerce')

leads=[]
for d, is_conv_flag in ((la,False),(lb,True)):
    for _,r in d.iterrows():
        conv=r.get('Converted Date Time')
        cdays=None
        if is_conv_flag and pd.notna(conv) and pd.notna(r['Created Time']):
            cdays=round((conv-r['Created Time']).total_seconds()/86400,1)
        leads.append({
            'created':clean(r['Created Time']),
            'source':clean(r['Lead Source']),
            'status':clean(r['Lead Status']),
            'company':clean(r['Company']),
            'pipeline':clean(r['Pipeline']),
            'converted':bool(r['Is Converted']),
            'convDays':cdays,
        })
json.dump(leads,open(OUT+'leads.json','w'),indent=1)
conv=sum(1 for l in leads if l['converted'])
print('leads:',len(leads),'converted:',conv,'rate %.1f%%'%(100*conv/len(leads)))

# ---------- META ----------
from datetime import date
meta={
 'owner':'Riki McClure',
 'pulled':str(date.today()),
 'oppCount':len(opps),
 'transitionCount':len(hist),
 'leadCount':len(leads),
 'convCount':conv,
}
json.dump(meta,open(OUT+'meta.json','w'),indent=1)
print('meta done')
