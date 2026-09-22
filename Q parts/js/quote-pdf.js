import { cartTotal } from './cart-model.js';
import { pageURL } from './utils.js';

// Valores de la plantilla original mostrada en la captura del proyecto.
export const quoteTemplate = Object.freeze({
  sociedad: 'GRUPO Q EL SALVADOR', canal: 'Q4', centro: 'S052',
  almacen: '2200', moneda: 'USD', condicion: 'Contado', impuesto: 0.13
});

export function quoteTotals(items) {
  const subtotal = Math.round(cartTotal(items) * 100);
  const discount = 0;
  const tax = Math.round((subtotal - discount) * quoteTemplate.impuesto);
  return { subtotal, discount, tax, total: subtotal - discount + tax };
}

export async function createQuotePDF(data, items, reference, date = new Date()) {
  const doc = new window.jspdf.jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const logo = new Image(); logo.src = pageURL('img/Q parts.png');
  await logo.decode();
  const right = doc.internal.pageSize.getWidth() - 10;
  const bottom = doc.internal.pageSize.getHeight() - 12;
  const amount = cents => (cents / 100).toFixed(2);
  const brands = [...new Set(items.map(item => String(item.auto || '').trim().toUpperCase()).filter(Boolean))].join(' / ');

  doc.setProperties({ title: `Cotización de Grupo Q - ${reference}`, subject: 'Cotización de repuestos', author: 'Q-Parts' });
  doc.setTextColor(0); doc.setDrawColor(0); doc.setLineWidth(0.2);
  doc.addImage(logo, 'PNG', 10, 16, 32, 32 * logo.naturalHeight / logo.naturalWidth);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text('Cotización de Grupo Q', doc.internal.pageSize.getWidth() / 2, 13, { align: 'center' });
  doc.setFontSize(12); doc.text(`Cotización Número ${reference}`, right, 25, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5);
  doc.text(`Fecha de creación: ${date.toLocaleDateString('es-SV', { day: '2-digit', month: '2-digit', year: 'numeric' })}`, right, 33, { align: 'right' });

  // El código del cliente y la orden quedan vacíos si no existen en su ficha.
  const rows = [
    [['Sociedad:', quoteTemplate.sociedad, 10, 47, 80], ['Marca:', brands, 138, 175, 64], ['Canal:', quoteTemplate.canal, 244, 274, 16]],
    [['Código del cliente:', data.codigoCliente || '', 10, 47, 80], ['Orden de compra:', data.ordenCompra || '', 138, 175, 64], ['Centro:', quoteTemplate.centro, 244, 274, 16]],
    [['Nombre del cliente:', data.nombre, 10, 47, 176], ['Almacén:', quoteTemplate.almacen, 244, 274, 16]],
    [['ID Tributaria:', data.dui, 10, 47, 80], ['Condición de pago:', quoteTemplate.condicion, 138, 175, 64], ['Moneda:', quoteTemplate.moneda, 244, 274, 16]]
  ];
  let y = 44;
  for (const row of rows) {
    doc.setFontSize(9.5); doc.setFont('helvetica', 'normal');
    const fields = row.map(([label, value, labelX, x, width]) => ({ label, labelX, x, width, lines: doc.splitTextToSize(String(value ?? ''), width - 4) }));
    const height = Math.max(8.5, ...fields.map(field => field.lines.length * 4 + 3));
    for (const field of fields) {
      doc.setFont('helvetica', 'bold'); doc.text(field.label, field.labelX, y + 5.5);
      doc.rect(field.x, y, field.width, height);
      doc.setFont('helvetica', 'normal'); doc.text(field.lines, field.x + 2, y + 5.5);
    }
    y += height + 2;
  }

  const availableWidth = right - 10;
  const widths = [94, 21, 21, 35, 35, 35, 35];
  const scale = availableWidth / widths.reduce((sum, width) => sum + width, 0);
  doc.autoTable({
    startY: y + 5, margin: { top: 22, left: 10, right: 10, bottom: 18 },
    theme: 'grid', showHead: 'everyPage', rowPageBreak: 'avoid',
    head: [['PRODUCTO', 'CANT', 'DISP.', 'PRECIO UNITARIO', 'ST-DESC', 'DESCUENTO', 'ST-CDESC']],
    body: items.map(item => {
      const price = Math.round(Number(item.precio) * 100), subtotal = price * item.cantidad;
      return [item.nombre, String(item.cantidad), item.existencias ?? '', amount(price), amount(subtotal), '0.00', amount(subtotal)];
    }),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 2, minCellHeight: 8, lineWidth: 0.2, lineColor: [0, 0, 0], textColor: [0, 0, 0], valign: 'middle', overflow: 'linebreak' },
    headStyles: { fillColor: [26, 188, 156], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', fontSize: 8.5 },
    columnStyles: Object.fromEntries(widths.map((width, index) => [index, { cellWidth: width * scale, halign: index === 0 ? 'left' : index < 3 ? 'center' : 'right' }]))
  });
  y = doc.lastAutoTable.finalY + 9;
  if (y + 27 > bottom) { doc.addPage(); y = 28; }
  const totals = quoteTotals(items);
  for (const [label, value] of [['ST-DESC', totals.subtotal], ['DESCUENTO', totals.discount], ['IMPUESTO VENTA:', totals.tax], ['TOTAL', totals.total]]) {
    doc.setTextColor(0); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text(label, right - 37, y, { align: 'right' });
    doc.setFont('helvetica', label === 'TOTAL' ? 'bold' : 'normal');
    doc.text(amount(value), right, y, { align: 'right' }); y += 8.5;
  }
  const pages = doc.getNumberOfPages();
  for (let page = 2; page <= pages; page++) {
    doc.setPage(page); doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Cotización de Grupo Q', 10, 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(reference, right, 13, { align: 'right' });
  }
  if (pages > 1) for (let page = 1; page <= pages; page++) {
    doc.setPage(page); doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text(`${page} / ${pages}`, right, bottom + 5, { align: 'right' });
  }
  return doc;
}
