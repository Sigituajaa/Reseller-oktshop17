import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, collection, onSnapshot, updateDoc, increment, query, orderBy, serverTimestamp, addDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
const ADMIN_WA = "6281234567890"; // GANTI DENGAN NOMOR WA ADMIN (Awali 62)

// --- AUTH ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
            userData = userDoc.data();
            initApp();
        } else {
            await setDoc(doc(db, "users", user.uid), { name: "User", role: 'reseller', points: 0 });
            location.reload();
        }
    } else {
        showUI('login');
    }
});

function initApp() {
    showUI('main');
    document.getElementById('user-info-top').classList.remove('hidden');
    document.getElementById('userPoints').innerText = (userData.points || 0).toLocaleString();
    
    if (userData.role === 'admin') {
        document.getElementById('admin-section').classList.remove('hidden');
        loadAdmin();
    }
    
    loadProducts();
    loadUserOrders();
    loadPointRewards();
}

// --- CATALOG ---
function loadProducts() {
    onSnapshot(collection(db, "products"), (snap) => {
        const list = document.getElementById('catalog-list');
        list.innerHTML = "";
        snap.forEach(d => {
            const p = d.data();
            list.innerHTML += `
            <div class="card" style="text-align:center">
                <b>${p.name}</b><br>
                <small style="color:var(--primary)">Rp ${p.price.toLocaleString()}</small>
                <button onclick="checkout('${p.name}', ${p.price})" class="btn-main" style="padding:5px; margin-top:10px">BELI</button>
            </div>`;
        });
    });
}

window.checkout = async (name, price) => {
    const orderID = "OKT" + Date.now().toString().slice(-6);
    await setDoc(doc(db, "orders", orderID), {
        orderID, userID: auth.currentUser.uid, userName: userData.name, 
        itemName: name, total: price, status: 'Menunggu Bayar', createdAt: serverTimestamp()
    });
    openPay(orderID, name, price);
};

// --- WHATSAPP LOGIC ---
window.openPay = (oid, name, price) => {
    document.getElementById('pay-info').innerText = `Pesanan: ${name} (Rp ${price.toLocaleString()})\nOrder ID: ${oid}`;
    document.getElementById('modal-pay').classList.remove('hidden');
    
    document.getElementById('btnConfirmWA').onclick = () => {
        const text = `Halo Admin, saya mau konfirmasi pembayaran.\n\n` +
                     `Nama: ${userData.name}\n` +
                     `Order ID: ${oid}\n` +
                     `Produk: ${name}\n\n` +
                     `*(Mohon lampirkan foto bukti transfer setelah pesan ini)*`;
        window.open(`https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(text)}`, '_blank');
    };
};

window.closeModal = () => document.getElementById('modal-pay').classList.add('hidden');

// --- TABS & NAVIGATION ---
window.showPage = (pageId, el) => {
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    document.getElementById(pageId).classList.remove('hidden');
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    el.classList.add('active');
};

window.switchTab = (type) => {
    if(type === 'unpaid') {
        document.getElementById('list-unpaid').classList.remove('hidden');
        document.getElementById('list-history').classList.add('hidden');
    } else {
        document.getElementById('list-unpaid').classList.add('hidden');
        document.getElementById('list-history').classList.remove('hidden');
    }
    event.target.parentNode.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
};

// --- CORE FUNCTIONS ---
function loadUserOrders() {
    onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
        const unpaid = document.getElementById('list-unpaid');
        const history = document.getElementById('list-history');
        unpaid.innerHTML = history.innerHTML = "";
        snap.forEach(d => {
            const o = d.data();
            if(o.userID !== auth.currentUser.uid) return;
            const html = `
                <div class="card">
                    <div style="display:flex; justify-content:space-between">
                        <b>#${o.orderID}</b>
                        <span style="color:var(--primary)">${o.status}</span>
                    </div>
                    <p>${o.itemName} - Rp ${o.total.toLocaleString()}</p>
                    ${o.status === 'Menunggu Bayar' ? `<button onclick="openPay('${o.orderID}','${o.itemName}',${o.total})" class="btn-wa" style="padding:5px">Konfirmasi Ulang</button>` : ''}
                </div>`;
            if(o.status === 'Menunggu Bayar') unpaid.innerHTML += html;
            else history.innerHTML += html;
        });
    });
}

function loadPointRewards() {
    const list = document.getElementById('points-list');
    const prizes = [25000, 50000, 100000, 200000];
    list.innerHTML = "";
    prizes.forEach(amt => {
        list.innerHTML += `
        <div class="card" style="text-align:center">
            <h3>${amt.toLocaleString()}</h3>
            <p>Poin</p>
            <button onclick="redeem(${amt})" class="btn-main" style="background:orange">TUKAR</button>
        </div>`;
    });
}

window.redeem = async (amt) => {
    if(userData.points < amt) return alert("Poin tidak cukup");
    if(confirm("Tukar poin?")){
        await updateDoc(doc(db, "users", auth.currentUser.uid), { points: increment(-amt) });
        await addDoc(collection(db, "redeems"), { userID: auth.currentUser.uid, userName: userData.name, amount: amt, status: 'Pending', createdAt: serverTimestamp() });
        alert("Permintaan terkirim!");
    }
};

// --- LOGIN & UTILS ---
document.getElementById('btnLogin').onclick = async () => {
    const e = document.getElementById('email').value;
    const p = document.getElementById('pass').value;
    try { await signInWithEmailAndPassword(auth, e, p); } catch(err) { alert("Login Gagal"); }
};

window.logout = () => signOut(auth).then(() => location.reload());

function showUI(id) {
    document.getElementById('ui-login').classList.add('hidden');
    document.getElementById('ui-main').classList.add('hidden');
    document.getElementById('ui-' + id).classList.remove('hidden');
}

// --- ADMIN ---
function loadAdmin() {
    onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), (snap) => {
        const list = document.getElementById('adm-orders');
        list.innerHTML = "";
        snap.forEach(d => {
            const o = d.data();
            list.innerHTML += `<div class="card">
                <b>${o.userName}</b> - #${o.orderID}<br>${o.itemName}
                <button onclick="updateStatus('${d.id}', 'Selesai', '${o.userID}', ${o.total})" class="btn-main" style="background:green; margin-top:5px">Selesaikan</button>
            </div>`;
        });
    });
}

window.updateStatus = async (id, stat, uid, total) => {
    await updateDoc(doc(db, "orders", id), { status: stat });
    if(stat === 'Selesai') await updateDoc(doc(db, "users", uid), { points: increment(total * 0.01) });
    alert("Berhasil!");
};

document.getElementById('btnSaveProduct').onclick = async () => {
    const n = document.getElementById('pName').value;
    const p = parseInt(document.getElementById('pPrice').value);
    await setDoc(doc(db, "products", n), { name: n, price: p });
    alert("Produk ditambahkan");
};
