const API_URL = 'http://localhost:5000/api/rooms'

// ==========================================
// GET SEMUA KAMAR
// ==========================================

export async function getRooms() {
    const response = await fetch(API_URL)

    const data = await response.json()

    if (!response.ok) {
        throw new Error(
            data.message || 'Gagal mengambil data kamar'
        )
    }

    return data.data || []
}

// ==========================================
// TAMBAH KAMAR
// ==========================================

export async function createRoom(room) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            room_number: room.roomNumber,
            price: Number(room.rentPrice),
        }),
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(
            data.message || 'Gagal menambahkan kamar'
        )
    }

    return data
}

// ==========================================
// UPDATE KAMAR
// ==========================================

export async function updateRoom(id, room) {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            room_number: room.roomNumber,
            price: Number(room.rentPrice),
        }),
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(
            data.message || 'Gagal mengubah kamar'
        )
    }

    return data
}

// ==========================================
// HAPUS KAMAR
// ==========================================

export async function deleteRoom(id) {
    const response = await fetch(`${API_URL}/${id}`, {
        method: 'DELETE',
    })

    const data = await response.json()

    if (!response.ok) {
        throw new Error(
            data.message || 'Gagal menghapus kamar'
        )
    }

    return data
}