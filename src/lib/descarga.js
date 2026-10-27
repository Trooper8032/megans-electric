// Descarga un archivo generado en el navegador.
export function descargar(bytes, nombre, tipo) {
  const url = URL.createObjectURL(new Blob([bytes], { type: tipo })); const a = document.createElement('a')
  a.href = url; a.download = nombre; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000)
}
