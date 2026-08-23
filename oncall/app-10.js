/* v0.5.5 — Payroll Notes gutter */
(function(){
  function payrollRowsWithNotes(days){
    let html='';
    days.forEach((d,idx)=>{
      if(idx===0||idx===7) html+=`<tr class="week-row"><td class="tc-note-cell"></td><td colspan="11">WEEK ${idx<7?'1':'2'}</td></tr>`;
      const blocks=d.blocks||[], rows=Math.max(1,Math.ceil(blocks.length/2));
      for(let r=0;r<rows;r++){
        const a=blocks[r*2]||{}, b=blocks[r*2+1]||{};
        const v=(x,f)=>x[f]?`<span class="${x[f+'Corrected']?'redtext':''}">${esc(clock(x[f]))}</span>`:'';
        const dt=new Date(d.date+'T12:00:00');
        const day=['SUN','MON','TUES','WED','THURS','FRI','SAT'][dt.getDay()];
        const note=r===0&&d.note?esc(d.note):'';
        const dateOnly=d.date.slice(5,7)+'/'+d.date.slice(8,10)+'/'+d.date.slice(0,4);
        html+=`<tr><td class="tc-note-cell">${note}</td><td class="tc-day-cell"><span class="tc-day-name">${r===0?day:''}</span></td><td class="tc-date-cell">${esc(dateOnly)}</td><td class="tc-job-cell"></td><td>${v(a,'in')}</td><td>${v(a,'out')}</td><td>${v(b,'in')}</td><td>${v(b,'out')}</td><td></td><td></td><td></td><td></td></tr>`;
      }
      if(idx===6||idx===13){
        const labels=['REGULAR<br>HOURS TOTAL','OVERTIME<br>HOURS TOTAL','TOTAL PAID<br>TIME OFF','TOTAL OTHER<br>PAID TIME','WEEK '+(idx===6?'1':'2')+'<br>TOTAL'];
        labels.forEach(l=>{html+=`<tr class="tc-week-total"><td class="tc-note-cell"></td><td class="tc-total-label">${l}</td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>`});
      }
    });
    return html;
  }

  window.payrollRows=payrollRowsWithNotes;
  const btn=document.querySelector('#previewPayrollBtn');
  if(!btn)return;
  btn.onclick=()=>{
    const days=getPayroll(); if(!days)return toast('TIME CARD is empty.');
    const p=$('#payrollPreview'); p.classList.remove('hidden'); p.classList.add('print-target');
    p.innerHTML=`<div class="row between"><h3>TIME CARD — Preview</h3><button class="secondary" onclick="printForm('payroll')">Print</button></div><div class="timecard-paper"><div class="tc-brandline"><div class="timecard-brand">SLAVIK MANAGEMENT</div><div class="timecard-title">TIME CARD</div></div><div class="tc-header-box"><div class="tc-header-left"><div class="tc-form-row"><b>EMPLOYEE NAME:</b><span class="tc-line">${esc(workerName())}</span></div><div class="tc-form-row"><b>COMMUNITY NAME:</b><span class="tc-line">${esc(settings.community)}</span></div><div class="tc-form-row"><b>STANDARD JOB TITLE:</b><span class="tc-line">${esc(settings.jobTitle)}</span></div><div class="tc-period-row"><b>PAY PERIOD:</b><span class="tc-line">${mdy(currentPeriodStart)}</span><b>THROUGH</b><span class="tc-line">${mdy(periodEnd())}</span></div></div><div class="tc-header-right"><div class="tc-right-labels"><div class="tc-right-label">EMPLOYEE NO.</div><div class="tc-right-label">COMMUNITY NO.</div><div class="tc-right-label small">STANDARD JOB CODE:</div></div><div class="tc-codegrid"><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span><span></span></div></div></div><table class="tc-main-table tc-main-table-notes"><thead><tr><th class="tc-notes-head">Notes</th><th class="tc-day-head"></th><th class="tc-date-head">Date</th><th class="tc-job-head">Job Code</th><th class="tc-time-head">Time In</th><th class="tc-time-head">Time Out</th><th class="tc-time-head">Time In</th><th class="tc-time-head">Time Out</th><th class="tc-hours-head">Total<br>Hours Worked</th><th class="tc-pto-head">Paid<br>Time Off</th><th class="tc-code-head">Time Off<br>Code</th><th class="tc-total-head">TOTAL<br>PAID HOURS</th></tr></thead><tbody>${payrollRowsWithNotes(days)}</tbody></table><div class="tc-bottom"><div class="tc-approvals"><div class="tc-bottom-title">APPROVALS</div><div class="tc-approval-row"><span class="tc-approval-label">EMPLOYEE</span><span class="tc-signline">${esc(workerName())}</span><span class="tc-date-label">DATE</span><span class="tc-signline">${mdy(settings.reportDate)}</span></div><div class="tc-approval-row"><span class="tc-approval-label">SUPERVISOR</span><span class="tc-signline"></span><span class="tc-date-label">DATE</span><span class="tc-signline"></span></div><div class="tc-approval-row"><span class="tc-approval-label">MANAGEMENT</span><span class="tc-signline"></span><span class="tc-date-label">DATE</span><span class="tc-signline"></span></div><div class="tc-approval-row"><span class="tc-approval-label">PAYROLL</span><span class="tc-signline"></span><span class="tc-date-label">DATE</span><span class="tc-signline"></span></div><div class="tc-form-code">FS630 – Rev. 6/97</div></div><div class="tc-analysis"><div class="tc-analysis-head"><div class="tc-bottom-title">PAID HOURS ANALYSIS</div><b>TOTALS</b></div><div class="tc-analysis-row"><div class="tc-analysis-label main">Total Regular Hours (A + F):</div><div class="tc-analysis-box"></div></div><div class="tc-analysis-row"><div class="tc-analysis-label main">Total Overtime Hours (B + G):</div><div class="tc-analysis-box"></div></div><div class="tc-analysis-row"><div class="tc-analysis-label main">Paid Time Off Codes (C + H by category)</div><div></div></div><div class="tc-analysis-row"><div class="tc-analysis-label">Sick: &nbsp;&nbsp;&nbsp;(SICK)</div><div class="tc-analysis-box"></div></div><div class="tc-analysis-row"><div class="tc-analysis-label">Vacation: (VAC)</div><div class="tc-analysis-box"></div></div><div class="tc-analysis-row"><div class="tc-analysis-label">Holiday: &nbsp;(HOL)</div><div class="tc-analysis-box"></div></div><div class="tc-analysis-row"><div class="tc-analysis-label">Personal:</div><div class="tc-analysis-box"></div></div><div class="tc-analysis-row"><div class="tc-analysis-label">Other: ____________</div><div class="tc-analysis-box"></div></div><div class="tc-analysis-row tc-analysis-total"><div class="tc-analysis-label main">TOTAL PAID HOURS</div><div class="tc-analysis-box"></div></div></div></div></div>`;
    p.scrollIntoView({behavior:'smooth'});
  };
})();
