'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], clone=o=>JSON.parse(JSON.stringify(o));
const NS='ocma_v040_'; const K={settings:NS+'settings',period:NS+'period',payroll:NS+'payroll',snap:NS+'snapshots',events:NS+'events',problems:NS+'problems',folios:NS+'folios',knowledge:NS+'knowledge',vendors:NS+'vendors'};
const load=(k,d)=>{try{const v=localStorage.getItem(k);return v===null?d:JSON.parse(v)}catch{return d}}, save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const pad=n=>String(n).padStart(2,'0'), uid=(p='id')=>p+'-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,8);
const esc=s=>String(s??'').replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const todayISO=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
function printForm(kind){document.body.classList.remove('print-payroll','print-summary','print-request');document.body.classList.add('print-'+kind);window.print();setTimeout(()=>document.body.classList.remove('print-payroll','print-summary','print-request'),500)}
window.addEventListener('afterprint',()=>document.body.classList.remove('print-payroll','print-summary','print-request'));

function parseISO(s){const [y,m,d]=s.split('-').map(Number);return new Date(y,m-1,d)}
function iso(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`}
function addDays(s,n){const d=parseISO(s);d.setDate(d.getDate()+n);return iso(d)}
function periodForDate(s){const anchor=parseISO('2026-08-09'),d=parseISO(s),diff=Math.floor((d-anchor)/86400000),steps=Math.floor(diff/14);return iso(new Date(anchor.getFullYear(),anchor.getMonth(),anchor.getDate()+steps*14))}
function periodEnd(){return addDays(currentPeriodStart,13)}
function inCurrentPeriod(date){return date>=currentPeriodStart&&date<=periodEnd()}
function fmtDate(s){const d=parseISO(s);return d.toLocaleDateString(settings.language==='es'?'es-MX':'en-US',{weekday:'short',month:'2-digit',day:'2-digit',year:'numeric'})}
function mdy(s){if(!s)return'';const [y,m,d]=s.split('-');return `${m}-${d}-${y}`}
function mins(t){if(!t)return null;const [h,m]=t.split(':').map(Number);return h*60+m}
function timeInput(m){if(m===null||m===undefined)return'';m=((m%1440)+1440)%1440;return `${pad(Math.floor(m/60))}:${pad(m%60)}`}
function clock(t){if(!t)return'';let [h,m]=t.split(':').map(Number),ap=h>=12?'PM':'AM';h=h%12||12;return `${h}:${pad(m)} ${ap}`}
function blockRange(b){let s=mins(b.in),e=mins(b.out);if(s===null||e===null)return null;if(e<=s)e+=1440;return [s,e]}
function overlapRange(a1,a2,b1,b2){return Math.max(a1,b1)<Math.min(a2,b2)}
function nearOrOverlap(e,b){if(e.date!==b.date)return false;const er=blockRange(e),br=blockRange(b);if(er&&br)return overlapRange(er[0],er[1],br[0],br[1])||Math.abs(er[0]-br[0])<=45||Math.abs(er[1]-br[1])<=45;if(e.in&&br){let m=toMin(e.in);if(m!==null){if(m<br[0]-720)m+=1440;return (m>=br[0]-45&&m<=br[1]+45)||Math.abs(m-br[0])<=90}}return false}
function workerName(){return settings.workerName||'Technician'}
function workerId(){return settings.workerId||''}
function apartmentAddress(a){
  if(!a)return'';
  const street=(settings.streetName||'').trim(), city=(settings.cityStateZip||'').trim();
  const left=[a.building,street].filter(Boolean).join(' ') + ` Apt ${a.unit}`;
  return [left,city].filter(Boolean).join(', ');
}
function apartmentDisplay(a){return apartmentAddress(a)||a.code||`${a.building}-${a.unit}`}
function poolAreaAddress(){return `POOL AREA ${(settings.community||'COMMUNITY').toUpperCase()}`}

function ensureWorkerId(){if(!settings.workerId){settings.workerId='W-'+Math.random().toString(36).slice(2,8).toUpperCase();save(K.settings,settings)}}
let settings=load(K.settings,{workerName:'',workerId:'',community:'Apartment Community',jobTitle:'Maintenance Technician',reportDate:todayISO(),language:'en',streetName:'',cityStateZip:'',propertyAddress1:'',propertyAddress2:'',propertyPhone:''});ensureWorkerId();
let currentPeriodStart=load(K.period,periodForDate(todayISO()));
let payrollStore=load(K.payroll,{}), snapshots=load(K.snap,{}), events=load(K.events,[]), problems=load(K.problems,window.SEED_PROBLEMS), folioStarts=load(K.folios,{}), localKnowledge=load(K.knowledge,[]), vendors=load(K.vendors,window.SEED_VENDORS);
let hoursMode='review', builderContext=null, editingEventId=null, confirmResolve=null;
const TYPE_OPTIONS=[['emergency','Emergency'],['pool_open','Pool Opening'],['pool_close','Pool Closing'],['snow','Snow Removal'],['mandatory_ot','Mandatory Overtime'],['other','Other Reportable Work']];
const POOL_TEMPLATES={
 pool_open:{title:'Pool Opening',location:'POOL',finding:'',action:'Pool area was inspected for daily opening. Restrooms were unlocked and inspected. General area conditions and cleanliness were verified.',remarks:'Pool opened for operation.'},
 pool_close:{title:'Pool Closing',location:'POOL',finding:'',action:'Pool area was inspected for daily closing. Restrooms were secured. General area conditions and cleanliness were verified.',remarks:'Pool secured for the night.'}
};
