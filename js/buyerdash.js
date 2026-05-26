function showTab(tab) {
    document.getElementById("tabBrowseContent").style.display = tab === "browse" ? "block" : "none";
    document.getElementById("tabWishlistContent").style.display = tab === "wishlist" ? "block" : "none";
    document.getElementById("tabBrowse").classList.toggle("active", tab === "browse");
    document.getElementById("tabWishlist").classList.toggle("active", tab === "wishlist");
}

let allBooks = [];
let currentUID = null;

document.addEventListener("DOMContentLoaded", () => {

    firebase.auth().onAuthStateChanged(user => {
        if (!user) { window.location.href = "login.html"; return; }
        currentUID = user.uid;

        db.collection("users").doc(user.uid).get().then(doc => {
            if (doc.exists) {
                document.getElementById("buyerName").textContent = doc.data().name;
            }
        });

        loadBooks();
        loadWishlist();
    });

    // Search and filter
    document.getElementById("searchInput").addEventListener("input", filterBooks);
    document.getElementById("categoryFilter").addEventListener("change", filterBooks);

    // Modal close
    document.getElementById("closeModal").onclick = closeModal;
    window.onclick = (e) => { if (e.target === document.getElementById("bookModal")) closeModal(); };

    // Logout
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
            allBooks.push({ id: doc.id, ...doc.data() });
        });
        renderBooks(allBooks);
    });
}

function filterBooks() {
    const search = document.getElementById("searchInput").value.toLowerCase();
    const category = document.getElementById("categoryFilter").value;

    const filtered = allBooks.filter(book => {
        const matchSearch = book.bookName.toLowerCase().includes(search)
            || book.author.toLowerCase().includes(search);
        const matchCategory = category === "all" || book.category === category;
        return matchSearch && matchCategory;
    });

    renderBooks(filtered);
}

function renderBooks(books) {
    const grid = document.getElementById("booksGrid");
    grid.innerHTML = "";

    if (books.length === 0) {
        grid.innerHTML = "<p style='color:#aaa; text-align:center;'>No books found.</p>";
        return;
    }

    books.forEach(book => {
        const card = document.createElement("div");
        card.className = "book-card";
        card.style.cursor = "pointer";
        card.innerHTML = `
            <img src="${book.image || 'BBlogo.jpeg'}" style="width:100%; height:180px; object-fit:cover; border-radius:8px; margin-bottom:12px;">
            <h3>${book.bookName}</h3>
            <p><strong>Author:</strong> ${book.author}</p>
            <p><strong>Category:</strong> ${book.category}</p>
            <div class="book-price">₹${book.price}</div>
            <button class="btn-save" style="width:100%; margin-top:10px;"
                onclick="event.stopPropagation(); addToWishlist('${book.id}')">
                ❤️ Wishlist
            </button>
        `;
        card.addEventListener("click", () => openModal(book));
        grid.appendChild(card);
    });
}

function openModal(book) {
    document.getElementById("modalBody").innerHTML = `
        <img src="${book.image || 'BBlogo.jpeg'}" style="width:100%; max-height:250px; object-fit:cover; border-radius:10px; margin-bottom:20px;">
        <h2>${book.bookName}</h2>
        <p><strong>Author:</strong> ${book.author}</p>
        <p><strong>Category:</strong> ${book.category}</p>
        <p><strong>Language:</strong> ${book.language}</p>
        <p><strong>Pages:</strong> ${book.pageNo}</p>
        <p><strong>Condition:</strong> ${book.condition}</p>
        <p><strong>Location:</strong> ${book.location}</p>
        <p><strong>Seller:</strong> ${book.seller}</p>
        ${book.otherInfo ? `<p><strong>Note:</strong> ${book.otherInfo}</p>` : ""}
        <div class="book-price" style="margin:15px 0;">₹${book.price}</div>
        <button class="btn-save" style="width:100%;"
            onclick="startChat('${book.sellerEmail}', '${book.bookName}')">
            💬 Chat with Seller
        </button>
    `;
    document.getElementById("bookModal").style.display = "flex";
    document.body.style.overflow = "hidden";
}

function closeModal() {
    document.getElementById("bookModal").style.display = "none";
    document.body.style.overflow = "auto";
}

async function startChat(sellerEmail, bookName) {
    const buyer = firebase.auth().currentUser.email;

    if (buyer === sellerEmail) {
        alert("You cannot chat with yourself!");
        return;
    }

    const chatId = buyer.replace(/[^a-z0-9]/gi, '') + "_"
        + sellerEmail.replace(/[^a-z0-9]/gi, '') + "_"
        + bookName.replace(/[^a-z0-9]/gi, '');

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
    } catch (error) {
        alert(error.message);
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
                grid.innerHTML = "<p style='color:#aaa; text-align:center;'>Your wishlist is empty.</p>";
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