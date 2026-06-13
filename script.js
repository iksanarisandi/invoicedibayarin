document.addEventListener('DOMContentLoaded', () => {
    // --- Elements ---
    const invoiceNo = document.getElementById('invoiceNo');
    const invoiceDate = document.getElementById('invoiceDate');
    const dueDate = document.getElementById('dueDate');
    const clientName = document.getElementById('clientName');
    const clientEmail = document.getElementById('clientEmail');
    const currency = document.getElementById('currency');
    const notes = document.getElementById('notes');
    const itemsContainer = document.getElementById('itemsContainer');
    const addItemBtn = document.getElementById('addItemBtn');
    const generatePdfBtn = document.getElementById('generatePdfBtn');

    // Preview Elements
    const previewInvoiceNo = document.getElementById('previewInvoiceNo');
    const previewInvoiceDate = document.getElementById('previewInvoiceDate');
    const previewDueDate = document.getElementById('previewDueDate');
    const previewClientName = document.getElementById('previewClientName');
    const previewClientEmail = document.getElementById('previewClientEmail');
    const previewItemsBody = document.getElementById('previewItemsBody');
    const previewNotes = document.getElementById('previewNotes');
    const previewGrandTotal = document.getElementById('previewGrandTotal');

    // Default Date to Today, Due Date = 1 hari setelahnya
    invoiceDate.valueAsDate = new Date();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    dueDate.valueAsDate = tomorrow;

    // Auto sync: jika invoiceDate berubah, due date ikut update +1 hari
    invoiceDate.addEventListener('change', () => {
        const d = new Date(invoiceDate.value);
        d.setDate(d.getDate() + 1);
        dueDate.valueAsDate = d;
        updatePreview();
    });

    // Auto Invoice Number based on year
    const currentYear = new Date().getFullYear();
    invoiceNo.value = `INV-${currentYear}-`;

    // State
    let items = [
        { id: 1, desc: 'Jasa Pembayaran', qty: 1, price: 150000 }
    ];

    // Currency Formatting function
    const formatCurrency = (amount, curCode) => {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: curCode,
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        }).format(amount);
    };

    // Date formatter
    const formatDate = (dateString) => {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
    };

    // Update the DOM Items Editor
    function renderItemEditor() {
        itemsContainer.innerHTML = '';
        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'item-row';
            row.innerHTML = `
                <input type="text" placeholder="Deskripsi item..." value="${item.desc}" class="item-desc" data-index="${index}">
                <input type="number" placeholder="Qty" value="${item.qty}" min="1" class="item-qty" data-index="${index}">
                <input type="number" placeholder="Harga satuan" value="${item.price}" min="0" class="item-price" data-index="${index}">
                <button class="btn-icon danger remove-item" data-index="${index}" title="Hapus Item">
                    <i class="ph ph-trash"></i><span class="remove-label"> Hapus</span>
                </button>
            `;
            itemsContainer.appendChild(row);
        });

        // Add Event Listeners for new inputs
        document.querySelectorAll('.item-desc').forEach(el => el.addEventListener('input', e => {
            items[e.target.dataset.index].desc = e.target.value;
            updatePreview();
        }));
        document.querySelectorAll('.item-qty').forEach(el => el.addEventListener('input', e => {
            items[e.target.dataset.index].qty = Number(e.target.value) || 0;
            updatePreview();
        }));
        document.querySelectorAll('.item-price').forEach(el => el.addEventListener('input', e => {
            items[e.target.dataset.index].price = Number(e.target.value) || 0;
            updatePreview();
        }));
        document.querySelectorAll('.remove-item').forEach(el => el.addEventListener('click', e => {
            const index = e.currentTarget.dataset.index;
            items.splice(index, 1);
            renderItemEditor();
            updatePreview();
        }));
    }

    // Update the visual Preview
    function updatePreview() {
        const selectedCurrency = currency.value;

        // Meta Info
        previewInvoiceNo.textContent = invoiceNo.value || 'INV-000';
        previewInvoiceDate.textContent = formatDate(invoiceDate.value);
        previewDueDate.textContent = formatDate(dueDate.value);
        previewClientName.textContent = clientName.value || 'Nama Klien';
        previewClientEmail.textContent = clientEmail.value || '';
        if (!clientEmail.value) {
            previewClientEmail.style.display = 'none';
        } else {
            previewClientEmail.style.display = 'block';
        }

        previewNotes.textContent = notes.value || 'Terima kasih atas pembayaran Anda.';

        // Items Table
        previewItemsBody.innerHTML = '';
        let totalSum = 0;

        items.forEach(item => {
            const itemTotal = item.qty * item.price;
            totalSum += itemTotal;

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${item.desc || '-'}</td>
                <td class="text-center">${item.qty}</td>
                <td class="text-right">${formatCurrency(item.price, selectedCurrency)}</td>
                <td class="text-right">${formatCurrency(itemTotal, selectedCurrency)}</td>
            `;
            previewItemsBody.appendChild(tr);
        });

        // Totals
        previewGrandTotal.textContent = formatCurrency(totalSum, selectedCurrency);
    }

    // Input Listeners for Auto-Update Preview
    [invoiceNo, dueDate, clientName, clientEmail, currency, notes].forEach(input => {
        input.addEventListener('input', updatePreview);
    });

    // Add Item
    addItemBtn.addEventListener('click', () => {
        items.push({ id: Date.now(), desc: '', qty: 1, price: 0 });
        renderItemEditor();
        updatePreview();
    });

    // Generate PDF logic
    generatePdfBtn.addEventListener('click', () => {
        const source = document.getElementById('invoiceContent');
        const filename = (invoiceNo.value || 'invoice') + '.pdf';

        // Layer putih full-screen menutupi halaman selama render (z-index positif maksimal).
        // Clone invoice diletakkan di pojok kiri-atas, lalu di-render ke canvas.
        const host = document.createElement('div');
        host.style.position = 'fixed';
        host.style.top = '0';
        host.style.left = '0';
        host.style.width = '100vw';
        host.style.height = '100vh';
        host.style.background = '#ffffff';
        host.style.overflow = 'auto';
        host.style.zIndex = '2147483647';

        const clone = source.cloneNode(true);
        clone.style.transform = 'none';      // hilangkan scale responsif
        clone.style.minHeight = 'auto';      // tinggi mengikuti konten
        clone.style.margin = '0';
        clone.style.boxShadow = 'none';
        host.appendChild(clone);
        document.body.appendChild(host);

        const originalText = generatePdfBtn.innerHTML;
        generatePdfBtn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Generating...';
        generatePdfBtn.disabled = true;

        const cleanup = () => {
            if (host.parentNode) host.parentNode.removeChild(host);
        };

        // Render PDF manual & deterministik (bukan html2pdf auto-paginate):
        //  1) html2canvas -> 1 canvas utuh dari clone
        //  2) jsPDF menempel gambar di x:0 selebar 210mm (lebar A4) -> TIDAK MUNGKIN geser
        //  3) paginasi eksplisit: tiap halaman baru, gambar digeser ke atas sebesar tinggi A4
        (async () => {
            try {
                const canvas = await html2canvas(clone, {
                    scale: 2,
                    useCORS: true,
                    allowTaint: true,
                    backgroundColor: '#ffffff',
                    scrollX: 0,
                    scrollY: 0
                });

                const JsPDF = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
                const pdf = new JsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });

                const pageWidth = pdf.internal.pageSize.getWidth();   // 210 mm
                const pageHeight = pdf.internal.pageSize.getHeight(); // 297 mm
                const imgWidth = pageWidth;                            // penuh selebar halaman
                const imgHeight = (canvas.height * imgWidth) / canvas.width;
                const imgData = canvas.toDataURL('image/jpeg', 0.98);

                let heightLeft = imgHeight;
                let position = 0;

                pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                heightLeft -= pageHeight;

                while (heightLeft > 0) {
                    position -= pageHeight;
                    pdf.addPage();
                    pdf.addImage(imgData, 'JPEG', 0, position, imgWidth, imgHeight);
                    heightLeft -= pageHeight;
                }

                pdf.save(filename);
                cleanup();
                generatePdfBtn.innerHTML = originalText;
                generatePdfBtn.disabled = false;
                showToast();
            } catch (err) {
                cleanup();
                console.error("PDF Generate Error:", err);
                alert("Gagal membuat PDF: " + (err && err.message ? err.message : err));
                generatePdfBtn.innerHTML = originalText;
                generatePdfBtn.disabled = false;
            }
        })();
    });

    function showToast() {
        const toast = document.getElementById('toast');
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // Initial Render
    renderItemEditor();
    updatePreview();
});
