import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, updateDoc, increment, query, orderBy, limit, serverTimestamp, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBIQ0tuOUM015lyS3-IuzioR6YBIZwBoB0",
    authDomain: "reseller-oktshop17.firebaseapp.com",
    projectId: "reseller-oktshop17",
    storageBucket: "reseller-oktshop17.firebasestorage.app",
    messagingSenderId: "9176826607",
    appId: "1:9176826607:web:be8bcddd729bb43f31511a"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let userData = {};

// --- AUTH CHECK ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            userData = userDoc.data();
            updateUIProfile();
            if (userData.role === 'admin') {
                document.getElementById('profile-admin').classList.remove('hidden');
                loadAdminData();
            } else {
                document.getElementById('profile-reseller').classList.remove('hidden');
            }
            showUI('main');
            loadKatalog();
            loadUserOrders();
        } else {
            await setDoc(doc(db, "users", user.uid), { name: user.email.split('@')[0], role: 'reseller', points: 0 });
            location.reload();
        }
    } else {
        showUI('login');
    }
});

function updateUIProfile() {
    document.getElementById('userNameDisp').innerText = userData.name;
    document.getElementById('userPoints').innerText = (userData.points || 0).toLocaleString();
    document.getElementById('prof-nama').value = userData.name || "";
    document.getElementById('prof-hp').value = userData.phone || "";
    document.getElementById('prof-alamat').value = userData.address || "";
    document.getElementById('user-info-top').classList.remove('hidden');
}

// --- CORE ACTIONS ---
document.getElementById('btnLogin').onclick = async () => {
    const e = document.getElementById('email').value;
    const p = document.getElementById('pass').value;
    try { await signInWithEmailAndPassword(auth, e, p); } catch(err) { alert("Login Gagal: Email/Password salah"); }
};

window.logout = () => signOut(auth).then(() => location.reload());

window.showPage = (pageId) => {
    document.querySelectorAll('.main-page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    const navId = pageId.replace('page-', 'nav-');
    if(document.getElementById(navId)) document.getElementById(navId).classList.add('active');
};

function showUI(id) {
    document.getElementById('ui-login').classList.add('hidden');
    document.getElementById('ui-main').classList.add('hidden');
    document.getElementById('ui-' + id).classList.remove('hidden');
}

// --- CATALOG ---
function loadKatalog() {
    onSnapshot(collection(db, "products"), (snap) => {
        const list = document.getElementById('catalog-list');
        list.innerHTML = "";
        snap.forEach(d => {
            const p = d.data();
            list.innerHTML += `
            <div class="prod-card fade-in">
                <b>${p.name}</b>
                <span class="prod-price">Rp ${p.price.toLocaleString()}</span>
                <button onclick="checkout('${p.name}', ${p.price})" class="btn-primary btn-sm">BELI</button>
            </div>`;
        });
    });
}

window.checkout = async (name, price) => {
    const orderID = "OKT" + Math.floor(10000 + Math.random() * 90000);
    await setDoc(doc(db, "orders", orderID), {
        orderID, userID: auth.currentUser.uid, itemName: name, total: price, status: 'Menunggu Bayar', createdAt: serverTimestamp()
    });
    alert("Berhasil! Silakan cek menu Pesanan untuk membayar.");
    showPage('page-cart');
};

// --- POINTS SYSTEM ---
window.requestExchange = async (amount) => {
    if (userData.points < amount) return alert("Poin tidak cukup!");
    
    if (confirm(`Tukar ${amount.toLocaleString()} poin sekarang?`)) {
        try {
            // Potong poin langsung di user
            await updateDoc(doc(db, "users", auth.currentUser.uid), {
                points: increment(-amount)
            });

            // Buat request ke admin
            await addDoc(collection(db, "redeems"), {
                userID: auth.currentUser.uid,
                userName: userData.name,
                amount: amount,
                status: 'Pending',
                createdAt: serverTimestamp()
            });

            alert("Permintaan tukar poin berhasil dikirim!");
            location.reload();
        } catch (e) { alert("Terjadi kesalahan."); }
    }
};

// --- ADMIN LOGIC ---
function loadAdminData() {
    // Load Orders
    onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
        const list = document.getElementById('admin-order-list');
        list.innerHTML = "";
        snap.forEach(d => {
            const o = d.data();
            list.innerHTML += `
            <div class="order-card">
                <b>#${o.orderID}</b> - ${o.userName || 'Customer'}<br>
                Item: ${o.itemName} <br>
                <div class="status-badge">${o.status}</div>
                <div style="display:flex; gap:5px; margin-top:10px">
                    <button onclick="updateStatus('${d.id}', 'Diproses')" class="btn-primary btn-sm">Proses</button>
                    <button onclick="updateStatus('${d.id}', 'Selesai', '${o.userID}', ${o.total})" class="btn-primary btn-sm" style="background:var(--success)">Selesai</button>
                </div>
            </div>`;
        });
    });

    // Load Redeem Requests
    onSnapshot(query(collection(db, "redeems"), orderBy("createdAt", "desc")), (snap) => {
        const list = document.getElementById('admin-redeem-list');
        list.innerHTML = "";
        snap.forEach(d => {
            const r = d.data();
            if(r.status !== 'Pending') return;
            list.innerHTML += `
            <div class="card" style="border-left:5px solid var(--gold)">
                <b>${r.userName}</b> meminta tukar:<br>
                <h2 class="text-gold">${r.amount.toLocaleString()} Poin</h2>
                <div style="display:flex; gap:10px">
                    <button onclick="handleRedeem('${d.id}', 'Selesai')" class="btn-primary btn-sm" style="background:var(--success)">KONFIRMASI TUKAR</button>
                    <button onclick="handleRedeem('${d.id}', 'Dibatalkan', '${r.userID}', ${r.amount})" class="btn-danger btn-sm">BATAL (REFUND POIN)</button>
                </div>
            </div>`;
        });
    });
}

window.handleRedeem = async (docId, status, uid, amount) => {
    await updateDoc(doc(db, "redeems", docId), { status: status });
    if (status === 'Dibatalkan') {
        await updateDoc(doc(db, "users", uid), { points: increment(amount) });
        alert("Penukaran dibatalkan, poin telah dikembalikan ke reseller.");
    } else {
        alert("Penukaran dikonfirmasi!");
    }
};

window.updateStatus = async (id, stat, uid, total) => {
    await updateDoc(doc(db, "orders", id), { status: stat });
    if(stat === 'Selesai' && uid) {
        // Bonus poin 1% dari total belanja
        const bonus = Math.floor(total * 0.01);
        await updateDoc(doc(db, "users", uid), { points: increment(bonus) });
    }
    alert("Status diperbarui!");
};

// --- RESELLER ORDERS ---
function loadUserOrders() {
    onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
        const unpaid = document.getElementById('res-unpaid-list') || document.getElementById('tab-pesanan');
        const history = document.getElementById('res-status-list') || document.getElementById('tab-status');
        unpaid.innerHTML = history.innerHTML = "";
        
        snap.forEach(d => {
            const o = d.data();
            if(o.userID !== auth.currentUser.uid) return;
            const html = `
            <div class="order-card fade-in">
                <div style="display:flex; justify-content:space-between">
                    <b>#${o.orderID}</b>
                    <span class="status-badge">${o.status}</span>
                </div>
                <div style="margin:10px 0">${o.itemName}</div>
                ${o.status === 'Menunggu Bayar' ? `<button onclick="openPay('${d.id}', '${o.orderID}')" class="btn-primary btn-sm">BAYAR SEKARANG</button>` : ''}
            </div>`;
            if(o.status === 'Menunggu Bayar') unpaid.innerHTML += html;
            else history.innerHTML += html;
        });
    });
}

// --- UTILS ---
window.switchCartTab = (id) => {
    document.getElementById('tab-pesanan').classList.add('hidden');
    document.getElementById('tab-status').classList.add('hidden');
    document.getElementById(id).classList.remove('hidden');
    event.target.parentNode.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
};

window.switchAdminTab = (id) => {
    document.querySelectorAll('.adm-content').forEach(c => c.classList.add('hidden'));
    document.getElementById(id).classList.remove('hidden');
    event.target.parentNode.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
};

let activePayID = "";
window.openPay = (id, oid) => { 
    activePayID = id; 
    document.getElementById('pay-order-id').innerText = "Order ID: " + oid;
    document.getElementById('modal-pay').classList.remove('hidden');
};
window.closePay = () => document.getElementById('modal-pay').classList.add('hidden');

document.getElementById('btnSubmitPay').onclick = async () => {
    await updateDoc(doc(db, "orders", activePayID), { 
        status: 'Sudah Bayar',
        userName: userData.name,
        userPhone: userData.phone,
        userAddress: userData.address
    });
    alert("Konfirmasi terkirim! Admin akan memproses pesanan Anda.");
    closePay();
};

document.getElementById('btnUpdateProfile').onclick = async () => {
    const n = document.getElementById('prof-nama').value;
    const h = document.getElementById('prof-hp').value;
    const a = document.getElementById('prof-alamat').value;
    await updateDoc(doc(db, "users", auth.currentUser.uid), { name: n, phone: h, address: a });
    alert("Profil berhasil diperbarui!");
};

document.getElementById('btnSaveProduct').onclick = async () => {
    const n = document.getElementById('pName').value;
    const p = parseInt(document.getElementById('pPrice').value);
    const s = parseInt(document.getElementById('pStock').value);
    if(!n || !p) return alert("Isi data produk!");
    await setDoc(doc(db, "products", n), { name: n, price: p, stock: s });
    alert("Produk berhasil ditambahkan!");
    document.getElementById('pName').value = "";
    document.getElementById('pPrice').value = "";
};