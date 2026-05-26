function showTab(tab) {
    document.getElementById("tabListingsContent").style.display = tab === "listings" ? "block" : "none";
    document.getElementById("tabAddContent").style.display = tab === "add" ? "block" : "none";
    document.getElementById("tabMessagesContent").style.display = tab === "messages" ? "block" : "none";

    document.getElementById("tabListings").classList.toggle("active", tab === "listings");
    document.getElementById("tabAdd").classList.toggle("active", tab === "add");
    document.getElementById("tabMessages").classList.toggle("active", tab === "messages");
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
            firebase.auth().signOut().then(() => {
                window.location.href = "login.html";
            });
        }
    });
});

firebase.auth().onAuthStateChanged(user => {
    if (!user) {
        window.location.href = "login.html";
        return;
    }

    db.collection("users").doc(user.uid).get().then(doc => {
        if (doc.exists) {
            document.getElementById("sellerName").textContent = doc.data().name;
            const sellerInput = document.getElementById("seller");
            if (sellerInput) sellerInput.value = doc.data().name;
        }
    });

    loadMyListings(user.uid);
    loadSellerChats(user.email);
});

function loadMyListings(uid) {
    const grid = document.getElementById("myListingsGrid");

    db.collection("books")
        .where("sellerUID", "==", uid)
        .onSnapshot(snapshot => {
            grid.innerHTML = "";

            if (snapshot.empty) {
                grid.innerHTML = "<p style='color:#aaa; text-align:center; padding:20px;'>You have no listings yet. Click Add Book to get started!</p>";
                return;
            }

            snapshot.forEach(doc => {
                const book = doc.data();
                const card = document.createElement("div");
                card.className = "book-card";
                card.innerHTML = `
                    <img src="${book.image}" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:12px;">
                    <h3>${book.bookName}</h3>
                    <p><strong>Author:</strong> ${book.author}</p>
                    <p><strong>Category:</strong> ${book.category}</p>
                    <p><strong>Condition:</strong> ${book.condition}</p>
                    <div class="book-price">₹${book.price}</div>
                    <button class="btn-clear" style="margin-top:10px; width:100%;"
                        onclick="deleteListing('${doc.id}')">
                        Delete Listing 🗑️
                    </button>
                `;
                grid.appendChild(card);
            });
        });
}

function deleteListing(bookId) {
    if (confirm("Delete this listing?")) {
        db.collection("books").doc(bookId).delete()
            .then(() => alert("Listing deleted."))
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
                                <p style="margin:0 0 4px 0; font-size:16px; font-weight:bold; color:#4b2e1e;">
                                    ${buyerName}
                                </p>
                                <p style="margin:0; font-size:13px; color:#888;">
                                    About: <strong>${chat.bookName}</strong>
                                </p>
                            </div>
                            <button class="btn-save"
                                onclick="window.location.href='chat.html?chatId=${chatId}'"
                                style="margin:0; padding:8px 16px;">
                                Open Chat 💬
                            </button>
                        `;
                        sellerChats.appendChild(card);
                    });
            });
        });
}