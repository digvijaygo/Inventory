(function () {
    'use strict';

    const API_URL = '/api/purchase-sales';
    const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
    const rows = document.querySelector('#transactionRows');
    const count = document.querySelector('#recordCount');
    const transactions = [];

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>\"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]));
    }

    function today() {
        const date = new Date();
        return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    }

    function formatDate(value) {
        return new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
    }

    function taxCell(amount, percent) {
        return `${currency.format(Number(amount || 0))}<small class="tax-rate">${Number(percent || 0)}%</small>`;
    }

    function filteredTransactions() {
        const fromDate = document.querySelector('#fromDate').value;
        const toDate = document.querySelector('#toDate').value;
        const type = document.querySelector('#transactionTypeFilter').value;
        const product = document.querySelector('#productFilter').value;
        const query = document.querySelector('#transactionSearch').value.trim().toLowerCase();
        return transactions.filter((transaction) => {
            const searchable = `${transaction.invoice_number} ${transaction.bill_to} ${transaction.item_name} ${transaction.ewaybill}`.toLowerCase();
            return (!fromDate || transaction.invoice_date >= fromDate) && (!toDate || transaction.invoice_date <= toDate) &&
                (type === 'All Transactions' || transaction.transaction_type === type) &&
                (product === 'All Products' || transaction.item_name === product) && (!query || searchable.includes(query));
        });
    }

    function render() {
        const visibleTransactions = filteredTransactions();
        rows.innerHTML = visibleTransactions.length ? visibleTransactions.map((transaction) => `<tr>
            <td><span class="type-badge ${transaction.transaction_type.toLowerCase()}">${transaction.transaction_type}</span></td>
            <td>${formatDate(transaction.invoice_date)}</td>
            <td><strong>${escapeHtml(transaction.invoice_number)}</strong></td>
            <td>${escapeHtml(transaction.bill_to)}</td>
            <td>${escapeHtml(transaction.item_name)}</td>
            <td>${Number(transaction.quantity)}</td>
            <td>${escapeHtml(transaction.hsn_code)}</td>
            <td>${currency.format(transaction.rate)}</td>
            <td><strong>${currency.format(transaction.value_amount)}</strong></td>
            <td>${taxCell(transaction.cgst_amount, transaction.cgst_percent)}</td>
            <td>${taxCell(transaction.sgst_amount, transaction.sgst_percent)}</td>
            <td>${taxCell(transaction.igst_amount, transaction.igst_percent)}</td>
            <td><strong>${currency.format(transaction.amount)}</strong></td>
            <td>${escapeHtml(transaction.delivery || '-')}</td>
            <td>${escapeHtml(transaction.dc_number || '-')}</td>
            <td>${escapeHtml(transaction.ewaybill)}</td>
            <td><div class="action-buttons"><button type="button" class="edit-transaction" data-id="${transaction.id}" title="Edit"><i class="fa-solid fa-pen"></i></button><button type="button" class="delete-transaction delete-action" data-id="${transaction.id}" title="Delete"><i class="fa-solid fa-trash"></i></button></div></td>
        </tr>`).join('') : '<tr><td class="empty-state" colspan="17">No transactions found.</td></tr>';
        count.textContent = `Showing ${visibleTransactions.length} transaction${visibleTransactions.length === 1 ? '' : 's'}`;
        updateSummary();
    }

    function updateSummary() {
        const totals = transactions.reduce((summary, transaction) => {
            summary[transaction.transaction_type] += Number(transaction.amount || 0);
            summary.tax += Number(transaction.cgst_amount || 0) + Number(transaction.sgst_amount || 0) + Number(transaction.igst_amount || 0);
            return summary;
        }, { Purchase: 0, Sale: 0, tax: 0 });
        document.querySelector('#totalPurchases').textContent = currency.format(totals.Purchase);
        document.querySelector('#totalSales').textContent = currency.format(totals.Sale);
        document.querySelector('#totalTax').textContent = currency.format(totals.tax);
        document.querySelector('#totalAmount').textContent = currency.format(totals.Purchase + totals.Sale);
    }

    function createModal() {
        document.body.insertAdjacentHTML('beforeend', `<div class="modal-overlay" id="transactionModal" aria-hidden="true"><div class="modal transaction-modal" role="dialog" aria-modal="true">
            <form id="transactionForm"><div class="modal-header"><div><h2 id="transactionModalTitle">New Purchase</h2><p>Value and GST amounts are calculated automatically.</p></div><button class="close-modal" type="button" aria-label="Close"><i class="fa-solid fa-xmark"></i></button></div>
            <div class="modal-body"><div class="form-grid">
                <div class="form-group"><label>Invoice Date</label><input name="invoice_date" type="date" required></div>
                <div class="form-group"><label>Invoice Number</label><input name="invoice_number" type="text" required></div>
                <div class="form-group full-width"><label>Bill To</label><input name="bill_to" type="text" required></div>
                <div class="form-group"><label>Item</label><input name="item_name" type="text" list="transactionItems" required></div>
                <div class="form-group"><label>Quantity</label><input name="quantity" type="number" min="0.01" step="0.01" required></div>
                <div class="form-group"><label>HSN Code</label><input name="hsn_code" type="text" required></div>
                <div class="form-group"><label>Rate</label><input name="rate" type="number" min="0" step="0.01" required></div>
                <div class="form-group"><label>Value</label><output id="calculatedValue">₹0.00</output></div>
                <div class="form-group"><label>CGST %</label><input name="cgst_percent" type="number" min="0" step="0.01" value="0"></div>
                <div class="form-group"><label>SGST %</label><input name="sgst_percent" type="number" min="0" step="0.01" value="0"></div>
                <div class="form-group"><label>IGST %</label><input name="igst_percent" type="number" min="0" step="0.01" value="0"></div>
                <div class="form-group"><label>Amount</label><output id="calculatedAmount">₹0.00</output></div>
                <div class="form-group sales-only"><label>Delivery</label><input name="delivery" type="text"></div>
                <div class="form-group sales-only"><label>DC Number</label><input name="dc_number" type="text"></div>
                <div class="form-group full-width"><label>E-Way Bill</label><input name="ewaybill" type="text" required></div>
            </div></div><div class="modal-footer"><button class="btn btn-secondary close-modal" type="button">Cancel</button><button class="btn btn-primary" type="submit"><i class="fa-solid fa-check"></i><span id="saveTransactionLabel">Save Purchase</span></button></div></form>
        </div></div><datalist id="transactionItems"></datalist>`);
    }

    function updateCalculations() {
        const form = document.querySelector('#transactionForm');
        const value = Number(form.elements.quantity.value || 0) * Number(form.elements.rate.value || 0);
        const gst = ['cgst_percent', 'sgst_percent', 'igst_percent'].reduce((total, name) => total + value * Number(form.elements[name].value || 0) / 100, 0);
        document.querySelector('#calculatedValue').textContent = currency.format(value);
        document.querySelector('#calculatedAmount').textContent = currency.format(value + gst);
    }

    function openModal(type, transaction) {
        const modal = document.querySelector('#transactionModal');
        const form = document.querySelector('#transactionForm');
        form.reset();
        form.dataset.id = transaction ? transaction.id : '';
        form.dataset.type = transaction ? transaction.transaction_type : type;
        const isSale = form.dataset.type === 'Sale';
        document.querySelector('#transactionModalTitle').textContent = `${transaction ? 'Edit' : 'New'} ${form.dataset.type}`;
        document.querySelector('#saveTransactionLabel').textContent = `${transaction ? 'Update' : 'Save'} ${form.dataset.type}`;
        document.querySelectorAll('.sales-only').forEach((field) => { field.hidden = !isSale; });
        if (transaction) Object.entries(transaction).forEach(([name, value]) => { if (form.elements[name]) form.elements[name].value = value == null ? '' : value; });
        else form.elements.invoice_date.value = today();
        updateCalculations();
        modal.classList.add('show');
        modal.setAttribute('aria-hidden', 'false');
        form.elements.invoice_date.focus();
    }

    function closeModal() {
        const modal = document.querySelector('#transactionModal');
        modal.classList.remove('show');
        modal.setAttribute('aria-hidden', 'true');
    }

    async function loadTransactions() {
        const response = await fetch(API_URL, { credentials: 'same-origin' });
        if (!response.ok) throw new Error('Unable to load transactions.');
        transactions.splice(0, transactions.length, ...await response.json());
        document.querySelector('#transactionItems').innerHTML = [...new Set(transactions.map((transaction) => transaction.item_name))].map((item) => `<option value="${escapeHtml(item)}"></option>`).join('');
        render();
    }

    async function saveTransaction(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const payload = Object.fromEntries(new FormData(form));
        payload.transaction_type = form.dataset.type;
        const response = await fetch(form.dataset.id ? `${API_URL}/${form.dataset.id}` : API_URL, { method: form.dataset.id ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'same-origin', body: JSON.stringify(payload) });
        const result = await response.json().catch(() => ({}));
        if (!response.ok) return window.alert(result.error || 'Unable to save transaction.');
        closeModal();
        await loadTransactions();
    }

    async function deleteTransaction(id) {
        if (!window.confirm('Delete this transaction?')) return;
        const response = await fetch(`${API_URL}/${id}`, { method: 'DELETE', credentials: 'same-origin' });
        if (!response.ok) return window.alert('Unable to delete transaction.');
        await loadTransactions();
    }

    createModal();
    document.querySelector('#newPurchaseBtn').addEventListener('click', () => openModal('Purchase'));
    document.querySelector('#newSaleBtn').addEventListener('click', () => openModal('Sale'));
    document.querySelector('#applyFiltersBtn').addEventListener('click', render);
    ['#fromDate', '#toDate', '#transactionTypeFilter', '#productFilter', '#transactionSearch'].forEach((selector) => document.querySelector(selector).addEventListener('input', render));
    document.querySelector('#transactionRows').addEventListener('click', (event) => {
        const editButton = event.target.closest('.edit-transaction');
        const deleteButton = event.target.closest('.delete-transaction');
        if (editButton) openModal('', transactions.find((transaction) => transaction.id === Number(editButton.dataset.id)));
        if (deleteButton) deleteTransaction(deleteButton.dataset.id);
    });
    document.querySelector('#transactionModal').addEventListener('click', (event) => { if (event.target === event.currentTarget || event.target.closest('.close-modal')) closeModal(); });
    document.querySelector('#transactionForm').addEventListener('input', updateCalculations);
    document.querySelector('#transactionForm').addEventListener('submit', saveTransaction);
    loadTransactions().catch((error) => { rows.innerHTML = '<tr><td class="empty-state" colspan="17">Unable to load transactions.</td></tr>'; window.console.error(error); });
}());