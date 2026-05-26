function showTab(tab) {
    ["listings", "add", "messages", "requests", "sales"].forEach(t => {
        document.getElementById("tab_" + t).style.display = t === tab ? "block" : "none";
        document.getElementById("tabBtn_" + t).classList.toggle("active", t === tab);
    });
}

document.addEventListener("DOMContentLoaded", () => {

    const form = document.getElementById("bookListingForm");
    if (form) {
        form.addEventListener("submit", async function (e) {
            e.preventDefault();
            const formData = new FormData(this);
            const data = Object.fromEntries(formData);

            try {
                await db.collection("books").add({
                    seller: data.seller,
                    sellerEmail: firebase.auth().currentUser.email,
                    sellerUID: firebase.auth().currentUser.uid,
                    location: data.location,
                    bookName: data.bookName,
                    author: data.author,
                    category: data.category,
                    language: data.language,
                    price: data.price,
                    pageNo: data.pageNo || "",
                    condition: data.condition,
                    otherInfo: data.otherInfo || "",
                    image: "BBlogo.jpeg",
                    status: "available",
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                alert("Book listed successfully!");
                this.reset();
                showTab("listings");
            } catch (error) {
                alert("Error: " + error.message);
            }
        });
    }

    document.getElementById("logoutBtn").addEventListener("click", () => {
        if (confirm("Logout?")) {
            firebase.auth().signOut().then(() => window.location.href = "login.html");
        }
    });
});

firebase.auth().onAuthStateChanged(user => {
    if (!user) { window.location.href = "login.html"; return; }

    db.collection("users").doc(user.uid).get().then(doc => {
        if (doc.exists) {
            document.getElementById("sellerName").textContent = doc.data().name;
            const sellerInput = document.getElementById("seller");
            if (sellerInput) sellerInput.value = doc.data().name;
        }
    });

    loadMyListings(user.uid);
    loadSellerChats(user.email);
    loadRequests(user.email, user.uid);
    loadSalesHistory(user.email);
});

function loadMyListings(uid) {
    db.collection("books")
        .where("sellerUID", "==", uid)
        .onSnapshot(snapshot => {
            const grid = document.getElementById("myListingsGrid");
            grid.innerHTML = "";

            if (snapshot.empty) {
                grid.innerHTML = "<p style='color:#aaa; text-align:center; padding:30px;'>No listings yet. Click Add Book!</p>";
                return;
            }

            snapshot.forEach(doc => {
                const book = doc.data();
                const isSold = book.status === "sold";
                const card = document.createElement("div");
                card.className = "book-card";
                card.style.opacity = isSold ? "0.6" : "1";
                card.innerHTML = `
                    <img src="${book.image}"
                        style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:12px;">
                    <h3>${book.bookName}</h3>
                    <p><strong>Author:</strong> ${book.author}</p>
                    <p><strong>Condition:</strong> ${book.condition}</p>
                    <div class="book-price">₹${book.price}</div>
                    <span style="display:inline-block; margin:8px 0; padding:3px 10px;
                        border-radius:20px; font-size:12px; font-weight:bold;
                        background:${isSold ? '#f5f5f5' : '#e8f5e9'};
                        color:${isSold ? '#999' : '#2e7d32'};">
                        ${isSold ? "Sold" : "Available"}
                    </span>
                    ${!isSold ? `
                    <button class="btn-clear" style="width:100%; margin-top:8px;"
                        onclick="deleteListing('${doc.id}')">
                        Delete 🗑️
                    </button>` : ""}
                `;
                grid.appendChild(card);
            });
        });
}

function deleteListing(bookId) {
    if (confirm("Delete this listing?")) {
        db.collection("books").doc(bookId).delete()
            .catch(err => alert(err.message));
    }
}

function loadSellerChats(email) {
    const sellerChats = document.getElementById("sellerChats");
    if (!sellerChats) return;

    db.collection("chats")
        .where("seller", "==", email)
        .onSnapshot(snapshot => {
            sellerChats.innerHTML = "";
            const badge = document.getElementById("chatCountBadge");

            if (snapshot.empty) {
                sellerChats.innerHTML = "<p style='color:#aaa; text-align:center; padding:20px;'>No messages yet.</p>";
                if (badge) badge.style.display = "none";
                return;
            }

            if (badge) {
                badge.textContent = snapshot.size;
                badge.style.display = "inline";
            }

            snapshot.forEach(doc => {
                const chat = doc.data();
                const chatId = doc.id;

                db.collection("users")
                    .where("email", "==", chat.buyer)
                    .limit(1)
                    .get()
                    .then(buyerSnap => {
                        const buyerName = !buyerSnap.empty
                            ? buyerSnap.docs[0].data().name
                            : chat.buyer;

                        const card = document.createElement("div");
                        card.style.cssText = `
                            padding:15px 20px; margin-bottom:12px;
                            border-radius:12px; background:#fff8f0;
                            border:1px solid #ffe0cc;
                            display:flex; justify-content:space-between;
                            align-items:center; gap:10px;
                        `;
                        card.innerHTML = `
                            <div>
                                <p style="margin:0 0 4px 0; font-size:16px;
                                    font-weight:bold; color:#4b2e1e;">
                                    ${buyerName}
                                </p>
                                <p style="margin:0; font-size:13px; color:#888;">
                                    About: <strong>${chat.bookName}</strong>
                                </p>
                            </div>
                            <button class="btn-save"
                                onclick="window.location.href='chat.html?chatId=${chatId}'"
                                style="margin:0; padding:8px 16px; white-space:nowrap;">
                                Open Chat 💬
                            </button>
                        `;
                        sellerChats.appendChild(card);
                    });
            });
        });
}

function loadRequests(email, uid) {
    db.collection("requests")
        .where("sellerEmail", "==", email)
        .where("status", "==", "pending")
        .onSnapshot(snapshot => {
            const container = document.getElementById("requestsList");
            const badge = document.getElementById("requestCountBadge");
            container.innerHTML = "";

            if (snapshot.empty) {
                container.innerHTML = "<p style='color:#aaa; text-align:center; padding:20px;'>No pending requests.</p>";
                if (badge) badge.style.display = "none";
                return;
            }

            if (badge) {
                badge.textContent = snapshot.size;
                badge.style.display = "inline";
            }

            snapshot.forEach(doc => {
                const req = doc.data();
                const card = document.createElement("div");
                card.style.cssText = `
                    padding:15px 20px; margin-bottom:12px;
                    border-radius:12px; background:#fff8f0;
                    border:1px solid #ffe0cc;
                `;
                card.innerHTML = `
                    <p style="font-size:16px; font-weight:bold; color:#4b2e1e; margin-bottom:6px;">
                        ${req.bookName}
                    </p>
                    <p style="font-size:13px; color:#666; margin:2px 0;">
                        <strong>Buyer:</strong> ${req.buyerName}
                    </p>
                    <p style="font-size:13px; color:#666; margin:2px 0;">
                        <strong>Pickup:</strong> ${req.location}
                    </p>
                    <p style="font-size:13px; color:#ff8c00; font-weight:bold; margin:6px 0;">
                        ₹${req.price}
                    </p>
                    <div style="display:flex; gap:10px; margin-top:12px;">
                        <button class="btn-save" style="flex:1;"
                            onclick="confirmSale('${doc.id}', '${req.bookId}')">
                            ✅ Confirm Sale
                        </button>
                        <button class="btn-clear" style="flex:1;"
                            onclick="declineRequest('${doc.id}')">
                            ❌ Decline
                        </button>
                    </div>
                `;
                container.appendChild(card);
            });
        });
}

async function confirmSale(requestId, bookId) {
    if (!confirm("Confirm this sale? This will mark the book as sold.")) return;

    try {
        const reqDoc = await db.collection("requests").doc(requestId).get();
        const req = reqDoc.data();

        const sellerDoc = await db.collection("users")
            .where("email", "==", req.sellerEmail).limit(1).get();
        const sellerName = !sellerDoc.empty
            ? sellerDoc.docs[0].data().name
            : req.sellerEmail;

        // Create transaction record
        await db.collection("transactions").add({
            bookId: bookId,
            bookName: req.bookName,
            sellerEmail: req.sellerEmail,
            sellerName: sellerName,
            buyerEmail: req.buyerEmail,
            buyerName: req.buyerName,
            buyerUID: req.buyerUID,
            price: req.price,
            location: req.location,
            reviewed: false,
            soldAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Mark book as sold
        await db.collection("books").doc(bookId).update({ status: "sold" });

        // Mark request as completed
        await db.collection("requests").doc(requestId).update({ status: "completed" });

        alert("Sale confirmed! ✅ This book is now marked as sold.");
    } catch (err) {
        alert(err.message);
    }
}

async function declineRequest(requestId) {
    if (!confirm("Decline this request?")) return;
    await db.collection("requests").doc(requestId).update({ status: "declined" });
}

function loadSalesHistory(email) {
    db.collection("transactions")
        .where("sellerEmail", "==", email)
        .orderBy("soldAt", "desc")
        .onSnapshot(snapshot => {
            const container = document.getElementById("salesList");
            container.innerHTML = "";

            if (snapshot.empty) {
                container.innerHTML = "<p style='color:#aaa; text-align:center; padding:20px;'>No sales yet.</p>";
                return;
            }

            snapshot.forEach(doc => {
                const t = doc.data();
                const date = t.soldAt ? t.soldAt.toDate().toLocaleDateString() : "Recently";
                const card = document.createElement("div");
                card.style.cssText = `
                    padding:15px 20px; margin-bottom:12px;
                    border-radius:12px; background:#fff8f0;
                    border:1px solid #ffe0cc;
                    display:flex; justify-content:space-between;
                    align-items:center; flex-wrap:wrap; gap:10px;
                `;
                card.innerHTML = `
                    <div>
                        <p style="font-size:16px; font-weight:bold; color:#4b2e1e; margin-bottom:4px;">
                            ${t.bookName}
                        </p>
                        <p style="font-size:13px; color:#666; margin:2px 0;">
                            <strong>Sold to:</strong> ${t.buyerName}
                        </p>
                        <p style="font-size:13px; color:#666; margin:2px 0;">
                            <strong>Date:</strong> ${date}
                        </p>
                    </div>
                    <div style="text-align:right;">
                        <div class="book-price">₹${t.price}</div>
                        <span style="background:#e8f5e9; color:#2e7d32; padding:3px 10px;
                            border-radius:20px; font-size:12px; font-weight:bold;">
                            ✅ Sold
                        </span>
                    </div>
                `;
                container.appendChild(card);
            });
        }, err => {
            if (err.code === "failed-precondition") {
                document.getElementById("salesList").innerHTML = `
                    <p style="color:red; padding:10px;">
                        ⚠️ Index missing.
                        <a href="${err.message.match(/https:\/\/\S+/)?.[0]}" target="_blank">
                            Click here to create it
                        </a> then refresh.
                    </p>`;
            }
        });
}