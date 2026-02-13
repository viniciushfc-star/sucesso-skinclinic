export function gerarPdf(dados){

 const { jsPDF } = window.jspdf
 const doc = new jsPDF()

 doc.setFontSize(16)
 doc.text("Relatório Financeiro", 10, 10)

 let y = 25

 dados.forEach(d=>{
  doc.text(
   `${d.data} - ${d.descricao} - ${d.tipo} - R$ ${d.valor}`,
   10,
   y
  )
  y += 8
 })

 doc.save("financeiro.pdf")
}
