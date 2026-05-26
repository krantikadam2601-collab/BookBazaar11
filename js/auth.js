function signUp() {
    const name = document.getElementById("signupName").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const password = document.getElementById("signupPassword").value;

    if (!name) { alert("Please enter your name."); return; }
    if (!email) { alert("Please enter your email."); return; }
    if (password.length < 6) { alert("Password must be at least 6 characters."); return; }

    firebase.auth().createUserWithEmailAndPassword(email, password)
        .then((userCredential) => {
            const user = userCredential.user;
            return db.collection("users").doc(user.uid).set({
                name: name,
                email: email,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        })
        .then(() => {
            window.location.href = "roleSelection.html";
        })
        .catch((error) => {
            alert(error.message);
        });
}

function login() {
    const email = document.getElementById("loginEmail").value.trim();
    const password = document.getElementById("loginPassword").value;

    if (!email || !password) { alert("Please fill in all fields."); return; }

    firebase.auth().signInWithEmailAndPassword(email, password)
        .then(() => {
            window.location.href = "roleSelection.html";
        })
        .catch((error) => {
            alert(error.message);
        });
}