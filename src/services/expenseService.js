const API_URL =
    `${import.meta.env.VITE_API_URL || 'http://localhost:5000/api'}/expenses`


// =====================================================
// GET ALL EXPENSES
// =====================================================

export async function getExpenses() {

    const response = await fetch(API_URL)

    const data = await response.json()

    if (!response.ok) {

        throw new Error(
            data?.message ||
            'Gagal mengambil data pengeluaran.'
        )

    }

    return data
}


// =====================================================
// GET EXPENSE BY ID
// =====================================================

export async function getExpenseById(id) {

    const response = await fetch(
        `${API_URL}/${id}`
    )

    const data = await response.json()

    if (!response.ok) {

        throw new Error(
            data?.message ||
            'Gagal mengambil data pengeluaran.'
        )

    }

    return data
}


// =====================================================
// CREATE EXPENSE
// =====================================================

export async function createExpense(expenseData) {

    const response = await fetch(
        API_URL,
        {
            method: 'POST',

            headers: {
                'Content-Type': 'application/json',
            },

            body: JSON.stringify(expenseData),
        }
    )

    const data = await response.json()

    if (!response.ok) {

        throw new Error(
            data?.message ||
            'Gagal menambahkan pengeluaran.'
        )

    }

    return data
}


// =====================================================
// UPDATE EXPENSE
// =====================================================

export async function updateExpense(
    id,
    expenseData
) {

    const response = await fetch(
        `${API_URL}/${id}`,
        {
            method: 'PUT',

            headers: {
                'Content-Type': 'application/json',
            },

            body: JSON.stringify(expenseData),
        }
    )

    const data = await response.json()

    if (!response.ok) {

        throw new Error(
            data?.message ||
            'Gagal memperbarui pengeluaran.'
        )

    }

    return data
}


// =====================================================
// DELETE EXPENSE
// =====================================================

export async function deleteExpense(id) {

    const response = await fetch(
        `${API_URL}/${id}`,
        {
            method: 'DELETE',
        }
    )

    const data = await response.json()

    if (!response.ok) {

        throw new Error(
            data?.message ||
            'Gagal menghapus pengeluaran.'
        )

    }

    return data
}


// =====================================================
// GET EXPENSE SUMMARY
// =====================================================

export async function getExpenseSummary(
    month,
    year
) {

    const response = await fetch(
        `${API_URL}/summary?month=${month}&year=${year}`
    )

    const data = await response.json()

    if (!response.ok) {

        throw new Error(
            data?.message ||
            'Gagal mengambil summary pengeluaran.'
        )

    }

    return data
}