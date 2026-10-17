var k=Object.defineProperty;var D=(d,t,a)=>t in d?k(d,t,{enumerable:!0,configurable:!0,writable:!0,value:a}):d[t]=a;var B=(d,t,a)=>D(d,typeof t!="symbol"?t+"":t,a);import{a as o,s as i,f as y,e as c}from"./client-BNLW9Ltg.js";class O{constructor(){B(this,"activeTab","dashboard");this.init()}async init(){var a,n;const t=document.getElementById("adminLoginForm");t==null||t.addEventListener("submit",e=>{e.preventDefault(),this.handleLogin()});try{const e=await o("/api/auth/me");e&&e.authenticated&&((a=e.user)==null?void 0:a.role)==="admin"&&this.showDashboard(e.user)}catch{}(n=document.getElementById("adminLogoutBtn"))==null||n.addEventListener("click",()=>{this.handleLogout()}),document.querySelectorAll("[data-admin-tab]").forEach(e=>{e.addEventListener("click",()=>{const s=e.dataset.adminTab||"dashboard";this.switchTab(s)})})}async handleLogin(){const t=document.getElementById("adminUsername"),a=document.getElementById("adminPassword"),n=document.getElementById("adminSubmitBtn"),e=t==null?void 0:t.value.trim().toLowerCase(),s=a==null?void 0:a.value;if(!e||!s){i("Ingresa usuario y contraseña","error");return}n.disabled=!0,n.innerHTML='<i class="fas fa-spinner fa-spin"></i> Verificando credenciales...';try{const r=await o("/api/auth/login",{method:"POST",body:JSON.stringify({username:e,password:s})});r.success&&(i(`¡Bienvenida ${r.user.name}!`,"success"),this.showDashboard(r.user))}catch(r){i(r.message||"Usuario o contraseña incorrectos","error")}finally{n.disabled=!1,n.innerHTML='<i class="fas fa-key"></i> Entrar al Panel'}}async handleLogout(){try{await o("/api/auth/logout",{method:"POST"})}catch{}location.reload()}showDashboard(t){const a=document.getElementById("adminLoginScreen"),n=document.getElementById("adminDashboardWrap"),e=document.getElementById("adminUserName");a&&(a.style.display="none"),n&&(n.style.display="flex"),e&&(e.textContent=t.name||"Mamá"),this.loadDashboardData()}switchTab(t){this.activeTab=t,document.querySelectorAll("[data-admin-tab]").forEach(a=>{a.classList.toggle("active",a.dataset.adminTab===t)}),document.querySelectorAll(".admin-tab-content").forEach(a=>{a.style.display=a.id===`tab-${t}`?"block":"none"}),t==="dashboard"&&this.loadDashboardData(),t==="products"&&this.loadProducts(),t==="orders"&&this.loadOrders(),t==="coupons"&&this.loadCoupons(),t==="reviews"&&this.loadReviews()}async loadDashboardData(){try{const[t,a,n]=await Promise.all([o("/api/products"),o("/api/orders/admin/list"),o("/api/reviews/admin/list")]),e=t.products||[],s=a.orders||[],r=n.reviews||[],p=s.reduce((f,P)=>f+(P.total||0),0),l=s.filter(f=>f.status==="pendiente").length,w=document.getElementById("metricProducts"),x=document.getElementById("metricOrders"),I=document.getElementById("metricSales"),$=document.getElementById("metricPending");w&&(w.textContent=String(e.length)),x&&(x.textContent=String(s.length)),I&&(I.textContent=y(p)),$&&($.textContent=String(l))}catch(t){console.error(t)}}async loadProducts(){const t=document.getElementById("adminProductsTableBody");if(t){t.innerHTML='<tr><td colspan="6" style="text-align:center;padding:20px"><i class="fas fa-spinner fa-spin"></i> Cargando productos...</td></tr>';try{const n=(await o("/api/products")).products||[];t.innerHTML=n.map(e=>`
        <tr>
          <td><img src="${e.image||"https://images.unsplash.com/photo-1608248597359-543598711467?auto=format&fit=crop&w=100&q=80"}" class="table-thumb" alt="${c(e.name)}"></td>
          <td><b>${c(e.name)}</b></td>
          <td><span style="background:rgba(217,70,239,0.15);color:var(--pril);padding:4px 10px;border-radius:20px;font-size:0.75rem;font-weight:700">${c(e.category)}</span></td>
          <td style="color:var(--sec);font-weight:700">${y(e.price)}</td>
          <td>${e.stock} unid.</td>
          <td style="text-align:right">
            <button class="btn btn-danger btn-sm" data-del-prod="${e.id}"><i class="fas fa-trash"></i></button>
          </td>
        </tr>
      `).join(""),t.querySelectorAll("[data-del-prod]").forEach(e=>{e.addEventListener("click",async()=>{if(confirm("¿Estás segura de eliminar este producto?")){const s=Number(e.dataset.delProd);await o(`/api/products/admin/${s}`,{method:"DELETE"}),i("Producto eliminado","info"),this.loadProducts()}})})}catch{t.innerHTML='<tr><td colspan="6" style="color:var(--err);text-align:center">Error al cargar productos</td></tr>'}}}async loadOrders(){const t=document.getElementById("adminOrdersList");if(t){t.innerHTML='<div style="text-align:center;padding:30px"><i class="fas fa-spinner fa-spin"></i> Cargando pedidos...</div>';try{const n=(await o("/api/orders/admin/list")).orders||[];if(n.length===0){t.innerHTML='<div style="text-align:center;padding:40px;color:var(--mut)"><i class="fas fa-receipt" style="font-size:2.5rem;margin-bottom:12px;display:block"></i>No tienes pedidos registrados todavía.</div>';return}t.innerHTML=n.map(e=>{const s=String(e.customer_phone||"").replace(/\D/g,""),r=encodeURIComponent(`Hola ${e.customer_name}, te escribo de JY Velas y Jabones sobre tu pedido #${e.id}.`),p=`https://wa.me/57${s.replace(/^57/,"")}?text=${r}`;return`
          <div class="order-card">
            <div class="order-header">
              <div>
                <b style="font-size:1.1rem;color:var(--sec)">#${c(e.id)}</b>
                <span style="color:var(--mut);font-size:0.8rem;margin-left:8px">${new Date(e.created_at).toLocaleString("es-CO")}</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <select class="admin-field" style="padding:6px 12px;border-radius:10px;margin:0" data-order-status="${e.id}">
                  ${["pendiente","en preparación","enviado","entregado"].map(l=>`
                    <option value="${l}" ${e.status===l?"selected":""}>${l.toUpperCase()}</option>
                  `).join("")}
                </select>
                <a href="${p}" target="_blank" class="btn btn-sm" style="background:#25d366;color:#fff" title="Escribir por WhatsApp">
                  <i class="fab fa-whatsapp"></i> Chatear
                </a>
              </div>
            </div>
            <div style="margin:10px 0;font-size:0.92rem;line-height:1.6">
              ${(e.items||[]).map(l=>`• ${l.quantity}x ${c(l.product_name)} (${y(l.total_price)})`).join("<br>")}
            </div>
            <div style="display:flex;justify-content:space-between;flex-wrap:wrap;border-top:1px solid var(--line);padding-top:10px;margin-top:8px;font-size:0.86rem;color:var(--mut)">
              <div>
                <b>Cliente:</b> ${c(e.customer_name)} · <b>Tel:</b> ${c(e.customer_phone)}<br>
                <b>Ciudad:</b> ${c(e.customer_city)} · <b>Dirección:</b> ${c(e.customer_address)}
                ${e.customer_notes?`<br><i>Notas: ${c(e.customer_notes)}</i>`:""}
              </div>
              <div style="text-align:right">
                <span style="font-size:1.2rem;font-weight:800;color:var(--sec)">${y(e.total)}</span>
              </div>
            </div>
          </div>
        `}).join(""),t.querySelectorAll("[data-order-status]").forEach(e=>{e.addEventListener("change",async()=>{const s=e.dataset.orderStatus,r=e.value;await o(`/api/orders/admin/${s}/status`,{method:"PATCH",body:JSON.stringify({status:r})}),i(`Estado del pedido #${s} actualizado`,"success")})})}catch{t.innerHTML='<div style="color:var(--err);text-align:center">Error al cargar pedidos</div>'}}}async loadCoupons(){const t=document.getElementById("adminCouponsList");if(t)try{const n=(await o("/api/coupons/admin/list")).coupons||[];t.innerHTML=n.map(e=>`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:14px;border-bottom:1px solid var(--line)">
          <div>
            <b style="font-size:1.1rem;color:var(--sec)">${c(e.code)}</b>
            <span style="color:var(--mut);margin-left:10px">${e.discount_pct}% de descuento</span>
            <span style="margin-left:8px;font-size:0.75rem;padding:3px 8px;border-radius:12px;background:${e.active?"rgba(16,185,129,0.2);color:#6ee7b7":"rgba(239,68,68,0.2);color:#fca5a5"}">
              ${e.active?"ACTIVO":"INACTIVO"}
            </span>
          </div>
          <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" data-toggle-coup="${e.id}">${e.active?"Desactivar":"Activar"}</button>
            <button class="btn btn-danger btn-sm" data-del-coup="${e.id}"><i class="fas fa-trash"></i></button>
          </div>
        </div>
      `).join(""),t.querySelectorAll("[data-toggle-coup]").forEach(e=>{e.addEventListener("click",async()=>{const s=e.dataset.toggleCoup;await o(`/api/coupons/admin/${s}/toggle`,{method:"PATCH"}),this.loadCoupons()})}),t.querySelectorAll("[data-del-coup]").forEach(e=>{e.addEventListener("click",async()=>{const s=e.dataset.delCoup;await o(`/api/coupons/admin/${s}`,{method:"DELETE"}),this.loadCoupons()})})}catch{t.innerHTML="Error al cargar cupones"}}async loadReviews(){const t=document.getElementById("adminReviewsList");if(t)try{const n=(await o("/api/reviews/admin/list")).reviews||[];t.innerHTML=n.map(e=>`
        <div class="order-card" style="${e.flagged_for_admin?"border-color:rgba(239,68,68,0.45);background:rgba(239,68,68,0.04)":""}">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div>
              <b>${c(e.name)}</b> · <span style="color:var(--sec)">${"★".repeat(e.stars)}</span>
              ${e.flagged_for_admin?'<span style="background:rgba(239,68,68,0.2);color:#fca5a5;padding:3px 8px;border-radius:12px;font-size:0.75rem;margin-left:8px;font-weight:700">REVISAR (IA Negativa)</span>':""}
            </div>
            <button class="btn btn-danger btn-sm" data-del-rev="${e.id}"><i class="fas fa-trash"></i></button>
          </div>
          <p style="color:var(--mut);font-size:0.92rem;font-style:italic">"${c(e.text)}"</p>
          <span style="font-size:0.78rem;color:var(--mut)">Fecha: ${e.date}</span>
        </div>
      `).join(""),t.querySelectorAll("[data-del-rev]").forEach(e=>{e.addEventListener("click",async()=>{const s=e.dataset.delRev;await o(`/api/reviews/admin/${s}`,{method:"DELETE"}),this.loadReviews()})})}catch{t.innerHTML="Error al cargar reseñas"}}}const C=new O,v=document.getElementById("btnToggleNewProd"),u=document.getElementById("newProdCard"),h=document.getElementById("btnCancelProd");v==null||v.addEventListener("click",()=>{u&&(u.style.display=u.style.display==="none"?"block":"none")});h==null||h.addEventListener("click",()=>{u&&(u.style.display="none")});const b=document.getElementById("dropzonePhoto"),m=document.getElementById("prodFileInput"),E=document.getElementById("uploadPreview"),g=document.getElementById("npImageUrl");b==null||b.addEventListener("click",()=>m==null?void 0:m.click());m==null||m.addEventListener("change",async()=>{var a;const d=(a=m.files)==null?void 0:a[0];if(!d)return;const t=new FileReader;t.onload=async n=>{var s;const e=(s=n.target)==null?void 0:s.result;E&&(E.src=String(e),E.style.display="block");try{i("Subiendo foto al almacenamiento Cloudflare...","info");const r=await o("/api/media/admin/upload",{method:"POST",body:JSON.stringify({data:e})});r.success&&g&&(g.value=r.url,i("Foto lista y optimizada","success"))}catch{g&&(g.value=String(e)),i("Foto cargada localmente","info")}},t.readAsDataURL(d)});var L;(L=document.getElementById("btnAiSuggest"))==null||L.addEventListener("click",async()=>{const d=document.getElementById("npCategory").value,t=document.getElementById("npName").value;try{i("Generando sugerencia con IA...","info");const a=await o("/api/ai/admin/suggest",{method:"POST",body:JSON.stringify({category:d,aroma:t||"lavanda"})});a.success&&a.suggestion&&(document.getElementById("npName").value||(document.getElementById("npName").value=a.suggestion.name),document.getElementById("npDesc").value=a.suggestion.description,document.getElementById("npPrice").value||(document.getElementById("npPrice").value=a.suggestion.price),i("Sugerencia de IA aplicada con éxito","success"))}catch{i("Error al conectar con la IA","error")}});var S;(S=document.getElementById("createProdForm"))==null||S.addEventListener("submit",async d=>{d.preventDefault();const t=document.getElementById("npName").value,a=document.getElementById("npCategory").value,n=Number(document.getElementById("npPrice").value),e=document.getElementById("npOldPrice").value?Number(document.getElementById("npOldPrice").value):null,s=Number(document.getElementById("npStock").value)||10,r=document.getElementById("npDesc").value,p=g.value||"https://images.unsplash.com/photo-1608248597359-543598711467?auto=format&fit=crop&w=400&q=80";try{await o("/api/products/admin/create",{method:"POST",body:JSON.stringify({name:t,category:a,price:n,old_price:e,stock:s,description:r,image:p,features:[]})}),i("¡Producto guardado exitosamente!","success"),u&&(u.style.display="none"),C.switchTab("products")}catch(l){i(l.message||"Error al guardar producto","error")}});var T;(T=document.getElementById("createCouponForm"))==null||T.addEventListener("submit",async d=>{d.preventDefault();const t=document.getElementById("newCouponCode").value,a=Number(document.getElementById("newCouponPct").value);try{await o("/api/coupons/admin/create",{method:"POST",body:JSON.stringify({code:t,discount_pct:a})}),i("Cupón creado con éxito","success"),document.getElementById("newCouponCode").value="",document.getElementById("newCouponPct").value="",C.switchTab("coupons")}catch(n){i(n.message||"Error al crear cupón","error")}});
