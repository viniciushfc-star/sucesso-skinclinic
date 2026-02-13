const modal =
 document.getElementById("modal")

const modalTitle =
 document.getElementById("modalTitle")

const modalFields =
 document.getElementById("modalFields")

const modalForm =
 document.getElementById("modalForm")

const modalCancel =
 document.getElementById("modalCancel")

let currentOnClose = null

export function openModal(
 title,
 fields,
 onSubmit,
 onClose
){

 try{

  currentOnClose = onClose || null
  modalTitle.innerText = title
  modalFields.innerHTML = fields

  modal.classList.remove("hidden")

  modalForm.onsubmit = e=>{
   e.preventDefault()
   onSubmit()
  }

  modalCancel.onclick = closeModal

 }catch(err){

  console.error(
   "[MODAL] erro",
   err
  )
 }
}


export function closeModal(){
 if (currentOnClose) {
  currentOnClose()
  currentOnClose = null
 }
 modal.classList.add("hidden")
}

/* Modal de confirmação (ex.: "Deseja sair?") */
let confirmResolve = null

export function openConfirmModal(title, message, onConfirm) {
  const el = document.getElementById("confirmModal")
  const titleEl = document.getElementById("confirmTitle")
  const msgEl = document.getElementById("confirmMessage")
  const btnOk = document.getElementById("confirmOk")
  const btnCancel = document.getElementById("confirmCancel")
  if (!el || !titleEl || !msgEl || !btnOk || !btnCancel) return
  titleEl.textContent = title
  msgEl.textContent = message
  el.classList.remove("hidden")
  const close = () => {
    el.classList.add("hidden")
    btnOk.onclick = null
    btnCancel.onclick = null
    if (el._backdrop) el._backdrop.onclick = null
  }
  btnOk.onclick = () => {
    close()
    if (typeof onConfirm === "function") onConfirm()
  }
  btnCancel.onclick = close
  el.addEventListener("click", function handler(e) {
    if (e.target === el) { close(); el.removeEventListener("click", handler); }
  })
  btnCancel.focus()
}

export function closeConfirmModal() {
  const el = document.getElementById("confirmModal")
  if (el) el.classList.add("hidden")
}
