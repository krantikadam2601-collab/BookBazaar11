function showTab(tab) {
    ["browse", "wishlist", "orders"].forEach(t => {
        document.getElementById("tab_" + t).style.display = t === tab ? "block" : "none";
        document.getElementById("tabBtn_" + t).classList.toggle("active", t === tab);
    });
}

let allBooks = [];
let currentUID = null;
let currentEmail = null;

document.addEventListener("DOMContentLoaded", () => {

    firebase.auth().onAuthStateChanged(user => {
        if (!user) { window.location.href = "login.html"; return; }
        currentUID = user.uid;
        currentEmail = user.email;

        db.collection("users").doc(user.uid).get().then(doc => {
            if (doc.exists) {
                document.getElementById("buyerName").textContent = doc.data().name;
            }
        });

        loadBooks();
        loadWishlist();
        loadOrderHistory();
    });

    document.getElementById("searchInput").addEventListener("input", filterBooks);
    document.getElementById("categoryFilter").addEventListener("change", filterBooks);

    document.getElementById("closeModal").onclick = closeModal;
    window.onclick = (e) => {
        if (e.target === document.getElementById("bookModal")) closeModal();
    };

    document.getElementById("logoutBtn").addEventListener("click", () => {
        if (confirm("Logout?")) {
            firebase.auth().signOut().then(() => window.location.href = "login.html");
        }
    });
});

function loadBooks() {
    db.collection("books").onSnapshot(snapshot => {
        allBooks = [];
        snapshot.forEach(doc => {
            const book = doc.data();
            if (book.status !== "sold") {
                allBooks.push({ id: doc.id, ...book });
            }
        });
        renderBooks(allBooks);
    });
}

function filterBooks() {
    const search = document.getElementById("searchInput").value.toLowerCase();
    const category = document.getElementById("categoryFilter").value;

    const filtered = allBooks.filter(book => {
        const matchSearch = (book.bookName || "").toLowerCase().includes(search)
            || (book.author || "").toLowerCase().includes(search);
        const matchCategory = category === "all" || book.category === category;
        return matchSearch && matchCategory;
    });

    renderBooks(filtered);
}

function renderBooks(books) {
    const grid = document.getElementById("booksGrid");
    grid.innerHTML = "";

    if (books.length === 0) {
        grid.innerHTML = "<p style='color:#aaa; text-align:center; padding:30px;'>No books found.</p>";
        return;
    }

    books.forEach(book => {
        const card = document.createElement("div");
        card.className = "book-card";
        card.style.cursor = "pointer";
        card.innerHTML = `
            <img src="${book.image || 'BBlogo.jpeg'}"
                style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:12px;">
            <h3>${book.bookName}</h3>
            <p><strong>Author:</strong> ${book.author}</p>
            <p><strong>Category:</strong> ${book.category}</p>
            <div class="book-price">₹${book.price}</div>
            <div style="display:flex; gap:8px; margin-top:10px;">
                <button class="btn-save" style="flex:1;"
                    onclick="event.stopPropagation(); addToWishlist('${book.id}')">
                    ❤️
                </button>
                <button class="btn-clear" style="flex:3;"
                    onclick="event.stopPropagation(); requestBook('${book.id}')">
                    Request Book
                </button>
            </div>
        `;
        card.addEventListener("click", () => openModal(book));
        grid.appendChild(card);
    });
}

function openModal(book) {
    // Load reviews for this book
    db.collection("reviews").where("bookId", "==", book.id).get().then(snap => {
        let reviewsHTML = "<p style='color:#aaa; font-size:13px;'>No reviews yet.</p>";
        if (!snap.empty) {
            let total = 0;
            let reviewList = "";
            snap.forEach(doc => {
                const r = doc.data();
                total += r.rating;
                const stars = "⭐".repeat(r.rating);
                reviewList += `
                    <div style="border-top:1px solid #ffe0cc; padding:8px 0;">
                        <p style="margin:0; font-size:13px;">
                            ${stars} <strong>${r.buyerName}</strong>
                        </p>
                        <p style="margin:4px 0 0 0; font-size:13px; color:#666;">
                            ${r.comment || ""}
                        </p>
                    </div>`;
            });
            const avg = (total / snap.size).toFixed(1);
            reviewsHTML = `
                <p style="font-weight:bold; color:#ff8c00; margin-bottom:8px;">
                    ⭐ ${avg} / 5 &nbsp;(${snap.size} review${snap.size > 1 ? "s" : ""})
                </p>
                ${reviewList}`;
        }

        document.getElementById("modalBody").innerHTML = `
            <img src="${book.image || 'BBlogo.jpeg'}"
                style="width:100%; max-height:220px; object-fit:cover; border-radius:10px; margin-bottom:20px;">
            <h2 style="color:#4b2e1e; margin-bottom:12px;">${book.bookName}</h2>
            <p><strong>Author:</strong> ${book.author}</p>
            <p><strong>Category:</strong> ${book.category}</p>
            <p><strong>Language:</strong> ${book.language}</p>
            <p><strong>Pages:</strong> ${book.pageNo}</p>
            <p><strong>Condition:</strong> ${book.condition}</p>
            <p><strong>Location:</strong> ${book.location}</p>
            <p><strong>Seller:</strong> ${book.seller}</p>
            ${book.otherInfo ? `<p><strong>Note:</strong> ${book.otherInfo}</p>` : ""}
            <div class="book-price" style="margin:15px 0;">₹${book.price}</div>
            <div style="display:flex; gap:10px; margin-bottom:20px;">
                <button class="btn-save" style="flex:1;"
                    onclick="startChat('${book.sellerEmail}', '${book.bookName}')">
                    💬 Chat with Seller
                </button>
                <button class="btn-clear" style="flex:1;"
                    onclick="requestBook('${book.id}')">
                    📩 Request Book
                </button>
            </div>
            <div style="background:#fff8f0; border-radius:10px; padding:15px; border:1px solid #ffe0cc;">
                <p style="font-weight:bold; color:#4b2e1e; margin-bottom:10px;">Reviews</p>
                ${reviewsHTML}
            </div>
        `;

        document.getElementById("bookModal").style.display = "flex";
        document.body.style.overflow = "hidden";
    });
}

function closeModal() {
    document.getElementById("bookModal").style.display = "none";
    document.body.style.overflow = "auto";
}

async function requestBook(bookId) {
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;

    if (currentEmail === book.sellerEmail) {
        alert("You cannot request your own book!");
        return;
    }

    try {
        const existing = await db.collection("requests")
            .where("bookId", "==", bookId)
            .where("buyerEmail", "==", currentEmail)
            .get();

        if (!existing.empty) {
            alert("You have already requested this book!");
            return;
        }

        const buyerDoc = await db.collection("users").doc(currentUID).get();
        const buyerName = buyerDoc.exists ? buyerDoc.data().name : currentEmail;

        await db.collection("requests").add({
            bookId: bookId,
            bookName: book.bookName,
            sellerEmail: book.sellerEmail,
            sellerUID: book.sellerUID,
            buyerEmail: currentEmail,
            buyerUID: currentUID,
            buyerName: buyerName,
            price: book.price,
            location: book.location,
            status: "pending",
            requestedAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert(`Request sent to seller for "${book.bookName}"! They will confirm once agreed.`);
    } catch (err) {
        alert(err.message);
    }
}

async function startChat(sellerEmail, bookName) {
    const buyer = currentEmail;
    if (buyer === sellerEmail) {
        alert("You cannot chat with yourself!");
        return;
    }

    const chatId = buyer.replace(/[^a-z0-9]/gi, "")
        + "_" + sellerEmail.replace(/[^a-z0-9]/gi, "")
        + "_" + bookName.replace(/[^a-z0-9]/gi, "");

    try {
        const chatRef = db.collection("chats").doc(chatId);
        const doc = await chatRef.get();
        if (!doc.exists) {
            await chatRef.set({
                buyer: buyer,
                seller: sellerEmail,
                bookName: bookName,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        }
        window.location.href = `chat.html?chatId=${chatId}`;
    } catch (err) {
        alert(err.message);
    }
}

function addToWishlist(bookId) {
    if (!currentUID) return;
    const book = allBooks.find(b => b.id === bookId);
    if (!book) return;

    db.collection("users").doc(currentUID).collection("wishlist").doc(bookId).set({
        bookName: book.bookName,
        author: book.author,
        price: book.price,
        category: book.category,
        image: book.image || "BBlogo.jpeg",
        addedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => alert(`"${book.bookName}" added to wishlist!`))
    .catch(err => alert(err.message));
}

function loadWishlist() {
    db.collection("users").doc(currentUID).collection("wishlist")
        .onSnapshot(snapshot => {
            const grid = document.getElementById("wishlistGrid");
            grid.innerHTML = "";

            if (snapshot.empty) {
                grid.innerHTML = "<p style='color:#aaa; text-align:center; padding:30px;'>Your wishlist is empty.</p>";
                return;
            }

            snapshot.forEach(doc => {
                const book = doc.data();
                const card = document.createElement("div");
                card.className = "book-card";
                card.innerHTML = `
                    <img src="${book.image}"
                        style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:12px;">
                    <h3>${book.bookName}</h3>
                    <p><strong>Author:</strong> ${book.author}</p>
                    <div class="book-price">₹${book.price}</div>
                    <button class="btn-clear" style="width:100%; margin-top:10px;"
                        onclick="removeFromWishlist('${doc.id}')">
                        Remove ❌
                    </button>
                `;
                grid.appendChild(card);
            });
        });
}

function removeFromWishlist(bookId) {
    db.collection("users").doc(currentUID).collection("wishlist")
        .doc(bookId).delete();
}

function loadOrderHistory() {
    db.collection("transactions")
        .where("buyerEmail", "==", firebase.auth().currentUser.email)
        .orderBy("soldAt", "desc")
        .onSnapshot(snapshot => {
            const grid = document.getElementById("ordersGrid");
            grid.innerHTML = "";

            if (snapshot.empty) {
                grid.innerHTML = "<p style='color:#aaa; text-align:center; padding:30px;'>No orders yet. Request a book to get started!</p>";
                return;
            }

            snapshot.forEach(doc => {
                const t = doc.data();
                const date = t.soldAt ? t.soldAt.toDate().toLocaleDateString() : "Recently";
                const alreadyReviewed = t.reviewed || false;

                const card = document.createElement("div");
                card.style.cssText = `
                    background:#fff8f0; border:1px solid #ffe0cc;
                    border-radius:12px; padding:20px; margin-bottom:15px;
                `;
                card.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:start; flex-wrap:wrap; gap:10px;">
                        <div>
                            <h3 style="color:#4b2e1e; margin-bottom:6px;">${t.bookName}</h3>
                            <p style="color:#666; font-size:13px; margin:2px 0;">
                                <strong>Seller:</strong> ${t.sellerName}
                            </p>
                            <p style="color:#666; font-size:13px; margin:2px 0;">
                                <strong>Pickup:</strong> ${t.location}
                            </p>
                            <p style="color:#666; font-size:13px; margin:2px 0;">
                                <strong>Date:</strong> ${date}
                            </p>
                        </div>
                        <div style="text-align:right;">
                            <div class="book-price">₹${t.price}</div>
                            <span style="background:#e8f5e9; color:#2e7d32; padding:3px 10px;
                                border-radius:20px; font-size:12px; font-weight:bold;">
                                ✅ Completed
                            </span>
                        </div>
                    </div>
                    ${!alreadyReviewed ? `
                    <div style="margin-top:15px; border-top:1px solid #ffe0cc; padding-top:15px;">
                        <p style="font-size:13px; font-weight:bold; color:#4b2e1e; margin-bottom:8px;">
                            Leave a Review
                        </p>
                        <div id="stars_${doc.id}" style="font-size:24px; cursor:pointer; margin-bottom:8px;">
                            <span onclick="setRating('${doc.id}', 1)">☆</span>
                            <span onclick="setRating('${doc.id}', 2)">☆</span>
                            <span onclick="setRating('${doc.id}', 3)">☆</span>
                            <span onclick="setRating('${doc.id}', 4)">☆</span>
                            <span onclick="setRating('${doc.id}', 5)">☆</span>
                        </div>
                        <textarea id="comment_${doc.id}" placeholder="Write your review (optional)..."
                            style="width:100%; padding:10px; border:2px solid #ffe0cc; border-radius:8px;
                            font-size:13px; outline:none; resize:none; height:70px;"></textarea>
                        <button class="btn-save" style="margin-top:8px; width:100%;"
                            onclick="submitReview('${doc.id}', '${t.bookId}', '${t.bookName}')">
                            Submit Review ⭐
                        </button>
                    </div>` : `
                    <p style="margin-top:10px; color:#888; font-size:13px;">✅ You reviewed this book</p>
                    `}
                `;
                grid.appendChild(card);
            });
        }, err => {
            if (err.code === "failed-precondition") {
                document.getElementById("ordersGrid").innerHTML = `
                    <p style="color:red; padding:10px;">
                        ⚠️ Index missing.
                        <a href="${err.message.match(/https:\/\/\S+/)?.[0]}" target="_blank">
                            Click here to create it
                        </a> then refresh.
                    </p>`;
            }
        });
}

const ratings = {};

function setRating(transactionId, value) {
    ratings[transactionId] = value;
    const stars = document.getElementById("stars_" + transactionId).children;
    for (let i = 0; i < stars.length; i++) {
        stars[i].textContent = i < value ? "⭐" : "☆";
    }
}

async function submitReview(transactionId, bookId, bookName) {
    const rating = ratings[transactionId];
    if (!rating) { alert("Please select a star rating."); return; }

    const comment = document.getElementById("comment_" + transactionId).value.trim();

    try {
        const userDoc = await db.collection("users").doc(currentUID).get();
        const buyerName = userDoc.exists ? userDoc.data().name : currentEmail;

        await db.collection("reviews").add({
            bookId: bookId,
            bookName: bookName,
            buyerUID: currentUID,
            buyerEmail: currentEmail,
            buyerName: buyerName,
            rating: rating,
            comment: comment,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Mark transaction as reviewed
        await db.collection("transactions").doc(transactionId).update({
            reviewed: true
        });

        alert("Review submitted! Thank you ⭐");
    } catch (err) {
        alert(err.message);
    }
}