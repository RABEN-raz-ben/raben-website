(() => {
  "use strict";
  const byId=id=>document.getElementById(id);
  const display=byId("display-dialog");
  const tabs=[...display.querySelectorAll('[role="tab"]')];
  const ceramics={
    cup:{title:"ספל בוקר",caption:"זיגוג זית · סדרת בוקר",image:"cup",alt:"ספל קרמיקה ירוק בעבודת אובניים על אבן בהירה",copy:"ספל נמוך עם ידית רחבה, שנוצר לסיבוב הראשון של הקפה.",spec:"חימר אבן בזיגוג זית. גובה 8 ס״מ, נפח 220 מ״ל."},
    vase:{title:"אגרטל ענף",caption:"אבן בהירה · סדרת ענף",image:"vase",alt:"אגרטל קרמיקה בהיר עם צוואר צר על משטח אגוז",copy:"אגרטל צר לפרח אחד או לענף מהגינה, בגימור מט שחושף את גרגרי החימר.",spec:"חימר אבן בגימור מט. גובה 21 ס״מ, קוטר בסיס 10 ס״מ."}
  };
  let currentDemo="web";
  let currentProduct="cup";
  function showProduct(key){
    currentProduct=key;
    const product=ceramics[key], photo=byId("ceramic-photo");
    photo.src="assets/ceramics/"+product.image+".webp";
    photo.alt=product.alt;
    for(const field of ["title","caption","copy","spec"])byId("ceramic-"+field).textContent=product[field];
    display.querySelectorAll("[data-ceramic]").forEach(button=>button.setAttribute("aria-pressed",String(button.dataset.ceramic===key)));
  }
  display.querySelectorAll("[data-ceramic]").forEach(button=>button.onclick=()=>showProduct(button.dataset.ceramic));
  function select(key,focus=false){
    currentDemo=key;
    for(const tab of tabs){
      const active=tab.id==="tab-"+key;
      tab.tabIndex=active?0:-1;
      tab.setAttribute("aria-selected",String(active));
      byId(tab.getAttribute("aria-controls")).hidden=!active;
      if(active && focus)tab.focus({preventScroll:true});
    }
    if(key==="web" && !byId("ceramic-photo").getAttribute("src"))showProduct(currentProduct);
    display.scrollTop=0;
  }
  function open(key=currentDemo){
    if(!display.open)display.showModal();
    select(key,true);
  }
  window.RabenShowroom={open};
  document.querySelectorAll("[data-open-demo]").forEach(button=>button.onclick=()=>open(button.dataset.openDemo));
  byId("display-close").onclick=()=>display.close();
  display.addEventListener("click",event=>{
    if(event.target!==display)return;
    const r=display.getBoundingClientRect();
    if(event.clientX<r.left || event.clientX>r.right || event.clientY<r.top || event.clientY>r.bottom)display.close();
  });
  tabs.forEach((tab,index)=>{
    tab.onclick=()=>select(tab.id.substring(4),true);
    tab.onkeydown=event=>{
      const targets={ArrowLeft:(index+1)%tabs.length,ArrowRight:(index+tabs.length-1)%tabs.length,Home:0,End:tabs.length-1};
      if(!(event.key in targets))return;
      event.preventDefault();select(tabs[targets[event.key]].id.substring(4),true);
    };
  });

  const orders=[
    {id:1042,lines:[["ספל בוקר",2],["אגרטל ענף",1]]},
    {id:1043,lines:[["ספל בוקר",4],["קערית הגשה",2],["אגרטל ענף",1]]}
  ];
  let orderIndex=0, collected=false;
  const packing=byId("packing-lines"), advance=byId("advance-order");
  function updatePacking(){
    const boxes=[...packing.querySelectorAll("input")];
    const count=boxes.filter(input=>input.checked).length;
    byId("packed-count").textContent=count+" / "+boxes.length;
    byId("packing-progress").max=boxes.length;
    byId("packing-progress").value=count;
    advance.disabled=!collected && count!==boxes.length;
  }
  function loadOrder(){
    const order=orders[orderIndex];collected=false;
    byId("order-id").textContent="#"+order.id;byId("order-state").textContent="בהכנה";
    byId("pack-status").textContent="";advance.textContent="להעביר לאיסוף";
    packing.replaceChildren(...order.lines.map(([item,quantity])=>{
      const label=document.createElement("label"), box=document.createElement("input");
      const name=document.createElement("b"), amount=document.createElement("small");
      label.className="packing-item";box.type="checkbox";name.textContent=item;
      amount.textContent=quantity+" יח׳";label.append(box,name,amount);return label;
    }));
    updatePacking();
  }
  packing.addEventListener("change",updatePacking);
  advance.onclick=()=>{
    if(collected){orderIndex=(orderIndex+1)%orders.length;loadOrder();packing.querySelector("input").focus();return;}
    if(advance.disabled)return;
    collected=true;packing.querySelectorAll("input").forEach(input=>input.disabled=true);
    byId("order-state").textContent="מוכנה לאיסוף";
    byId("pack-status").textContent="ההזמנה נארזה ומוכנה לאיסוף בהדגמה.";
    advance.textContent="להזמנה הבאה";
  };
  loadOrder();

  const units=byId("batch-units");
  const money=new Intl.NumberFormat("he-IL",{style:"currency",currency:"ILS",maximumFractionDigits:2,minimumFractionDigits:0});
  const bars=[...display.querySelectorAll(".cost-bar i")];
  function calculate(){
    const count=units.valueAsNumber;
    const valid=Number.isInteger(count) && count>=1 && count<=200;
    units.setAttribute("aria-invalid",String(!valid));
    byId("cost-error").textContent=valid?"":"בחרו מספר שלם בין 1 ל־200 כלים.";
    byId("quantity-down").disabled=valid && count===1;
    byId("quantity-up").disabled=valid && count===200;
    const packageCost=Number(display.querySelector('[name="pack-type"]:checked').value);
    const costs=[18*count,packageCost*count,96],total=costs.reduce((sum,n)=>sum+n,0);
    ["clay-cost","pack-cost","setup-cost"].forEach((id,i)=>{
      byId(id).textContent=valid?money.format(costs[i]):"—";
      bars[i].style.width=valid?100*costs[i]/total+"%":"0";
    });
    byId("batch-total").textContent=valid?money.format(total):"—";
    byId("unit-total").textContent=valid?money.format(total/count)+" לכלי":"";
  }
  units.addEventListener("input",calculate);
  display.querySelector(".pack-options").addEventListener("change",calculate);
  for(const [id,delta] of [["quantity-down",-1],["quantity-up",1]]){
    byId(id).onclick=()=>{
      const current=Number.isFinite(units.valueAsNumber)?Math.round(units.valueAsNumber):0;
      units.value=Math.max(1,Math.min(200,current+delta));calculate();
    };
  }
  calculate();
})();
