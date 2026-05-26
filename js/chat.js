const params = new URLSearchParams(window.location.search);
const chatId = params.get("chatId");
let currentUser = "";

firebase.auth().onAuthStateChanged(user => {
    if (!user) { window.location.href = "login.html"; return; }
    currentUser = user.email;
    loadChatInfo();
    loadMessages();
});

function loadChatInfo() {
    db.collection("chats").doc(chatId).get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            const other = data.buyer === currentUser ? data.seller : data.buyer;
            document.getElementById("chatTitle").textContent
                = `💬 ${data.bookName} — with ${other}`;
        }
    });
}

document.getElementById("sendBtn").addEventListener("click", sendMessage);
document.getElementById("messageInput").addEventListener("keydown", e => {
    if (e.key === "Enter") { e.preventDefault(); sendMessage(); }
});

async function sendMessage() {
    const text = document.getElementById("messageInput").value.trim();
    if (!text || !chatId) return;

    document.getElementById("sendBtn").disabled = true;
    try {
        await db.collection("messages").add({
            chatId: chatId,
            sender: currentUser,
            text: text,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
        document.getElementById("messageInput").value = "";
    } catch (err) {
        alert(err.message);
    } finally {
        document.getElementById("sendBtn").disabled = false;
        document.getElementById("messageInput").focus();
    }
}

function loadMessages() {
    db.collection("messages")
        .where("chatId", "==", chatId)
        .orderBy("timestamp", "asc")
        .onSnapshot(snapshot => {
            const box = document.getElementById("chatBox");
            box.innerHTML = "";

            if (snapshot.empty) {
                box.innerHTML = "<p style='color:#aaa; text-align:center; margin-top:20px;'>No messages yet. Say hello! 👋</p>";
                return;
            }

            snapshot.forEach(doc => {
                const msg = doc.data();
                const div = document.createElement("div");
                div.className = "message " + (msg.sender === currentUser ? "sent" : "received");

                let time = "";
                if (msg.timestamp) {
                    time = msg.timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                }

                div.innerHTML = `
                    <p style="margin:0 0 4px 0;">${escapeHTML(msg.text)}</p>
                    <span style="font-size:11px; opacity:0.6;">
                        ${msg.sender === currentUser ? "You" : msg.sender} ${time ? "· " + time : ""}
                    </span>
                `;
                box.appendChild(div);
            });

            box.scrollTop = box.scrollHeight;
        }, err => {
            if (err.code === "failed-precondition") {
                document.getElementById("chatBox").innerHTML = `
                    <p style="color:red; padding:10px;">
                        ⚠️ Index missing.
                        <a href="${err.message.match(/https:\/\/\S+/)?.[0]}" target="_blank">Click here to create it</a>
                        then refresh.
                    </p>`;
            }
        });
}

function escapeHTML(str) {
    const d = document.createElement("div");
    d.appendChild(document.createTextNode(str));
    return d.innerHTML;
}